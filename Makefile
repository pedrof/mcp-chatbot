.PHONY: help build build-backend build-frontend push push-backend push frontend deploy deploy-argocd clean test kube-create-secret kube-delete-secret

# Version management
VERSION ?= $(shell cat VERSION 2>/dev/null || echo "1.0.0")
REGISTRY ?= git.shadyknollcave.io/micro/mcp-chatbot

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Build targets
build: build-backend build-frontend ## Build all container images
	@echo "Built all images for version $(VERSION)"

build-backend: ## Build backend container image
	@echo "Building backend image: $(REGISTRY):backend-$(VERSION)"
	podman build -f backend/Dockerfile -t $(REGISTRY):backend-$(VERSION) --build-arg VERSION=$(VERSION) backend/
	podman tag $(REGISTRY):backend-$(VERSION) $(REGISTRY):backend-latest

build-frontend: ## Build frontend container image
	@echo "Building frontend image: $(REGISTRY):frontend-$(VERSION)"
	podman build -f frontend/Dockerfile -t $(REGISTRY):frontend-$(VERSION) --build-arg VERSION=$(VERSION) frontend/
	podman tag $(REGISTRY):frontend-$(VERSION) $(REGISTRY):frontend-latest

# Push targets
push: push-backend push-frontend ## Push all container images to registry
	@echo "Pushed all images for version $(VERSION)"

push-backend: ## Push backend image to registry
	@echo "Pushing backend image: $(REGISTRY):backend-$(VERSION)"
	podman push $(REGISTRY):backend-$(VERSION)
	podman push $(REGISTRY):backend-latest

push-frontend: ## Push frontend image to registry
	@echo "Pushing frontend image: $(REGISTRY):frontend-$(VERSION)"
	podman push $(REGISTRY):frontend-$(VERSION)
	podman push $(REGISTRY):frontend-latest

# Full deployment workflow
deploy: build push ## Build and push all images, then trigger ArgoCD sync
	@echo "Deployment images pushed for version $(VERSION)"
	@echo "Run 'make deploy-argocd' to trigger ArgoCD sync"

deploy-argocd: ## Trigger ArgoCD immediate sync
	@echo "Triggering ArgoCD sync for mcp-chatbot..."
	argocd app sync mcp-chatbot
	argocd app wait mcp-chatbot --health

# Kubernetes secrets
kube-create-secret: ## Create sealed secret for APP_SECRET
	@echo "Creating sealed secret for APP_SECRET..."
	@echo "Enter APP_SECRET (must be 32+ characters):"
	@read -s secret; \
	echo "Creating sealed secret with APP_SECRET..."; \
	kubectl create secret generic mcp-chatbot-secret \
		--from-literal=APP_SECRET="$$secret" \
		--from-literal=JWT_SECRET="$$secret" \
		--namespace=mcp-chatbot \
		--dry-run=client -o yaml | \
	kubeseal --format yaml > k8s/base/sealed-secret.yaml
	@echo "Sealed secret created at k8s/base/sealed-secret.yaml"
	@echo "Commit this file to git to deploy the secret"

kube-delete-secret: ## Delete existing secret from cluster
	@echo "Deleting sealed secret from cluster..."
	kubectl delete sealedsecret mcp-chatbot-secret -n mcp-chatbot --ignore-not-found

# Development targets
dev: ## Run development environment with hot reload
	@echo "Starting development environment..."
	podman-compose up --build

dev-logs: ## Follow development logs
	podman-compose logs -f

dev-stop: ## Stop development environment
	podman-compose down

# Testing targets
test: ## Run all tests
	npm test

test-integration: ## Run integration tests
	npm run test:integration --workspace=backend

# Cleanup targets
clean: ## Clean up build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf backend/dist frontend/dist
	podman rmi $(REGISTRY):backend-$(VERSION) $(REGISTRY):frontend-$(VERSION) 2>/dev/null || true

# Git operations
git-setup: ## Initialize git repository with both remotes
	@echo "Setting up git repository..."
	@if [ -z "$$(git remote get-url origin 2>/dev/null)" ]; then \
		git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git; \
		git remote add backup git@github.com:pedrof/mcp-chatbot.git; \
		echo "Added remotes: origin (Gitea) and backup (GitHub)"; \
	else \
		echo "Git remotes already configured"; \
	fi

git-push: ## Push to both Gitea and GitHub
	@echo "Pushing to both remotes..."
	git push origin main
	git push backup main

# Version management
bump-patch: ## Bump patch version (1.0.0 -> 1.0.1)
	@echo "$$(echo $(VERSION) | awk -F. '{$$3++; print $$1"."$$2"."$$3}')" > VERSION
	@echo "Version bumped to: $$(cat VERSION)"

bump-minor: ## Bump minor version (1.0.0 -> 1.1.0)
	@echo "$$(echo $(VERSION) | awk -F. '{$$2++; $$3=0; print $$1"."$$2"."$$3}')" > VERSION
	@echo "Version bumped to: $$(cat VERSION)"

bump-major: ## Bump major version (1.0.0 -> 2.0.0)
	@echo "$$(echo $(VERSION) | awk -F. '{$$1++; $$2=0; $$3=0; print $$1"."$$2"."$$3}')" > VERSION
	@echo "Version bumped to: $$(cat VERSION)"

# Kubernetes utilities
kube-apply: ## Apply manifests directly (bypassing ArgoCD)
	kubectl apply -k k8s/overlays/production

kube-delete: ## Delete all resources
	kubectl delete -k k8s/overlays/production

kube-logs: ## Show application logs
	kubectl logs -n mcp-chatbot -l app=mcp-chatbot --tail=100 -f

kube-status: ## Show deployment status
	kubectl get all -n mcp-chatbot

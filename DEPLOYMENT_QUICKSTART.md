# MCP Chatbot - Quick Deployment Guide

Fast-track deployment guide for mcp-chatbot to K3s cluster.

## Prerequisites Checklist

- [ ] K3s cluster running (v1.34.3+k3s1)
- [ ] Cilium CNI with Ingress Controller
- [ ] cert-manager with Let's Encrypt issuer
- [ ] Sealed Secrets controller installed
- [ ] mcphue MCP server running in cluster
- [ ] Tools installed: kubectl, podman, tea, gh, kubeseal, argocd

## 5-Minute Deployment

### Step 1: Create Gitea Repository

```bash
cd /home/micro/development/mcp-chatbot

# Check if repo exists
tea repo list | grep mcp-chatbot || tea repo create --name mcp-chatbot

# Configure remotes
git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git
git remote add backup git@github.com:pedrof/mcp-chatbot.git
```

### Step 2: Build and Push Images

```bash
# Build and push all images
make build && make push

# Or one command
make deploy
```

### Step 3: Create Sealed Secret

```bash
# Generate secure secret
make kube-create-secret
```

Enter a 32+ character secret when prompted.

### Step 4: Deploy via ArgoCD

```bash
# Apply ArgoCD Application
kubectl apply -f argocd/mcp-chatbot-application.yaml

# Watch sync
argocd app sync mcp-chatbot
argocd app wait mcp-chatbot --health
```

### Step 5: Access Application

```bash
# Check deployment status
kubectl get all -n mcp-chatbot

# Open in browser
echo "Access at: https://mcp-chatbot.local.shadyknollcave.io"
```

## Verification Commands

```bash
# Check pods
kubectl get pods -n mcp-chatbot

# Check services
kubectl get svc -n mcp-chatbot

# Check ingress
kubectl get ingress -n mcp-chatbot

# Check certificate
kubectl get certificate -n mcp-chatbot

# Test backend health
curl https://mcp-chatbot.local.shadyknollcave.io/api/health

# Test frontend
curl https://mcp-chatbot.local.shadyknollcave.io/
```

## Update Workflow

```bash
# 1. Make code changes
# ... edit files ...

# 2. Bump version
make bump-patch

# 3. Build and push
make deploy

# 4. Update kustomization (edit file)
vim k8s/overlays/production/kustomization.yaml
# Change: newTag: backend-1.0.1

# 5. Commit and push
git add .
git commit -m "chore: release version $(cat VERSION)"
git push origin main

# 6. ArgoCD auto-syncs
argocd app sync mcp-chatbot
```

## Troubleshooting Quick Commands

```bash
# View logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f

# Restart deployment
kubectl rollout restart deployment/mcp-chatbot-backend -n mcp-chatbot

# Describe pod
kubectl describe pod -n mcp-chatbot <pod-name>

# Check certificate
kubectl describe certificate -n mcp-chatbot mcp-chatbot-tls

# Test MCP server connection
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  curl http://mcphue.mcphue.svc.cluster.local:8080
```

## Rollback

```bash
# Via ArgoCD
argocd app rollback mcp-chatbot

# Via kubectl
kubectl rollout undo deployment/mcp-chatbot-backend -n mcp-chatbot
```

## Complete Deployment Checklist

- [ ] Gitea repository created
- [ ] Git remotes configured (origin + backup)
- [ ] Container images built and pushed
- [ ] Sealed secret created
- [ ] ArgoCD Application deployed
- [ ] Pods running (2/2 for each deployment)
- [ ] Services created
- [ ] Ingress configured
- [ ] TLS certificate issued
- [ ] Application accessible at https://mcp-chatbot.local.shadyknollcave.io
- [ ] MCP server communication working
- [ ] Health checks passing

## Key Files

- `Makefile` - Build and deploy automation
- `VERSION` - Semantic version tracking
- `k8s/base/` - Base Kubernetes manifests
- `k8s/overlays/production/` - Production overrides
- `argocd/mcp-chatbot-application.yaml` - ArgoCD Application
- `DEPLOYMENT.md` - Comprehensive deployment guide

## Get Help

```bash
# Makefile help
make help

# View all deployment manifests
ls -la k8s/base/

# Check ArgoCD status
argocd app get mcp-chatbot
```

---

**Next Steps**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed documentation.

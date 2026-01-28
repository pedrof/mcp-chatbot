# Deployment Checklist

Use this checklist to ensure all steps are completed before deploying mcp-chatbot to production.

## Phase 1: Prerequisites

### Cluster Requirements
- [ ] K3s v1.34.3+k3s1 running
- [ ] Cilium CNI with Ingress Controller configured
- [ ] cert-manager with Let's Encrypt issuer installed
- [ ] Sealed Secrets controller installed
- [ ] LoadBalancer IP pool configured (10.10.10.200/29)

### Tool Verification
- [ ] kubectl installed and configured
- [ ] podman installed (not Docker)
- [ ] tea CLI installed for Gitea
- [ ] gh CLI installed for GitHub
- [ ] kubeseal installed for Sealed Secrets
- [ ] argocd CLI installed (optional, web UI available)

### MCP Server Verification
- [ ] mcphue MCP server running in cluster
- [ ] mcphue service accessible at `http://mcphue.mcphue.svc.cluster.local:8080`
- [ ] Can resolve internal cluster DNS

## Phase 2: Git Repository Setup

### Gitea Repository
- [ ] Checked if repo exists: `tea repo list | grep mcp-chatbot`
- [ ] Created repo if needed: `tea repo create --name mcp-chatbot`
- [ ] Added Gitea remote: `git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git`

### GitHub Backup Repository
- [ ] Checked if repo exists: `gh repo list | grep mcp-chatbot`
- [ ] Created repo if needed: `gh repo create mcp-chatbot --public`
- [ ] Added GitHub remote: `git remote add backup git@github.com:pedrof/mcp-chatbot.git`

### Git Configuration
- [ ] Verified remotes: `git remote -v`
- [ ] Current branch: `main` or `multitenant`
- [ ] All deployment files committed

## Phase 3: Container Images

### Build Verification
- [ ] Backend builds successfully: `podman build -f backend/Dockerfile`
- [ ] Frontend builds successfully: `podman build -f frontend/Dockerfile`
- [ ] Both images use Node 22 Alpine
- [ ] Health checks included in Dockerfiles
- [ ] Non-root users configured

### Image Registry
- [ ] Logged in to registry: `podman login git.shadyknollcave.io`
- [ ] Backend image pushed: `git.shadyknollcave.io/micro/mcp-chatbot:backend-1.0.0`
- [ ] Frontend image pushed: `git.shadyknollcave.io/micro/mcp-chatbot:frontend-1.0.0`
- [ ] Latest tags created and pushed

### Quick Build
```bash
make build && make push
# OR
make deploy
```

## Phase 4: Kubernetes Secrets

### Secret Generation
- [ ] Generated APP_SECRET (32+ characters): `openssl rand -base64 32`
- [ ] Generated JWT_SECRET (32+ characters, different from APP_SECRET)
- [ ] Created sealed secret: `make kube-create-secret`
- [ ] Sealed secret file created: `k8s/base/sealed-secret.yaml`
- [ ] Secret committed to git (encrypted, safe to commit)

### Secret Verification
```bash
# Verify sealed secret exists
kubectl get sealedsecret -n mcp-chatbot

# Verify secret is decrypted by controller
kubectl get secret -n mcp-chatbot mcp-chatbot-secret
```

## Phase 5: Kubernetes Manifests

### Base Manifests Verification
- [ ] `k8s/base/namespace.yaml` - Namespace defined
- [ ] `k8s/base/configmap.yaml` - Environment variables set
- [ ] `k8s/base/sealed-secret.yaml` - Encrypted secrets
- [ ] `k8s/base/pvc.yaml` - Persistent volume claim (1Gi)
- [ ] `k8s/base/deployment-backend.yaml` - Backend deployment
- [ ] `k8s/base/deployment-frontend.yaml` - Frontend deployment
- [ ] `k8s/base/service-backend.yaml` - Backend service (port 3000)
- [ ] `k8s/base/service-frontend.yaml` - Frontend service (port 80)
- [ ] `k8s/base/ingress.yaml` - Cilium Ingress with TLS
- [ ] `k8s/base/kustomization.yaml` - Base configuration

### Production Overlay Verification
- [ ] `k8s/overlays/production/kustomization.yaml` - Production overrides
- [ ] Image tags updated to current version
- [ ] Replica counts set to 2
- [ ] Resource limits increased for production

### Manifest Validation
```bash
# Validate manifests
kubectl apply -k k8s/overlays/production --dry-run=server

# View what will be deployed
kubectl kustomize k8s/overlays/production
```

## Phase 6: ArgoCD Configuration

### Application Manifest
- [ ] `argocd/mcp-chatbot-application.yaml` created
- [ ] Source repository: Gitea (git.shadyknollcave.io/micro/mcp-chatbot)
- [ ] Target branch: main
- [ ] Path: k8s/overlays/production
- [ ] Destination namespace: mcp-chatbot
- [ ] Sync policy: automated (prune + self-heal)

### ArgoCD Deployment
- [ ] Applied ArgoCD Application: `kubectl apply -f argocd/mcp-chatbot-application.yaml`
- [ ] Application appears in ArgoCD UI
- [ ] Initial sync completed successfully

## Phase 7: Deployment Verification

### Namespace and Resources
- [ ] Namespace created: `kubectl get namespace mcp-chatbot`
- [ ] All pods running: `kubectl get pods -n mcp-chatbot`
- [ ] All services created: `kubectl get svc -n mcp-chatbot`
- [ ] Ingress created: `kubectl get ingress -n mcp-chatbot`
- [ ] Certificate issued: `kubectl get certificate -n mcp-chatbot`

### Pod Health
- [ ] Backend pods: 2/2 Running (production)
- [ ] Frontend pods: 2/2 Running (production)
- [ ] All pods ready: 2/2 containers ready
- [ ] No pod restarts
- [ ] Pod resource usage within limits

### Service Connectivity
- [ ] Backend service accessible: `kubectl port-forward svc/mcp-chatbot-backend 3000:3000`
- [ ] Frontend service accessible: `kubectl port-forward svc/mcp-chatbot-frontend 8080:80`
- [ ] Health endpoint responding: `curl http://localhost:3000/health`

### Ingress and TLS
- [ ] Ingress IP assigned: 10.10.10.200 (Cilium LoadBalancer)
- [ ] TLS certificate issued: `kubectl describe certificate -n mcp-chatbot mcp-chatbot-tls`
- [ ] Certificate valid for: mcp-chatbot.local.shadyknollcave.io
- [ ] Certificate not expired

### DNS Configuration
- [ ] DNS A record created: mcp-chatbot.local.shadyknollcave.io → 10.10.10.200
- [ ] DNS resolves correctly: `nslookup mcp-chatbot.local.shadyknollcave.io`
- [ ] Can access via HTTPS: `curl https://mcp-chatbot.local.shadyknollcave.io`

## Phase 8: Application Testing

### Frontend Access
- [ ] Open browser: https://mcp-chatbot.local.shadyknollcave.io
- [ ] Page loads without errors
- [ ] TobyAI logo visible
- [ ] No console errors in browser

### Backend API
- [ ] Health check: https://mcp-chatbot.local.shadyknollcave.io/api/health
- [ ] Returns 200 OK
- [ ] Configuration endpoint accessible

### MCP Server Communication
- [ ] Backend can reach mcphue service
- [ ] Test from pod: `kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- curl http://mcphue.mcphue.svc.cluster.local:8080`
- [ ] MCP tools discoverable
- [ ] MCP tool execution working

### Database Persistence
- [ ] PVC bound: `kubectl get pvc -n mcp-chatbot`
- [ ] Database file exists: `kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- ls -lah /app/data/`
- [ ] Configuration persists across pod restarts

## Phase 9: Monitoring and Logging

### Log Access
- [ ] Backend logs accessible: `kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend`
- [ ] Frontend logs accessible: `kubectl logs -n microchat -l app=mcp-chatbot-frontend`
- [ ] No error logs in containers
- [ ] Health checks passing

### Resource Usage
- [ ] Pod CPU usage within limits: `kubectl top pods -n mcp-chatbot`
- [ ] Pod memory usage within limits
- [ ] No OOMKilled events

## Phase 10: ArgoCD Operations

### Sync Status
- [ ] ArgoCD application healthy: `argocd app get mcp-chatbot`
- [ ] All resources synced
- [ ] No drift detected
- [ ] Auto-sync enabled

### Rollback Test
- [ ] Can rollback via ArgoCD: `argocd app rollback mcp-chatbot`
- [ ] Rollback successful
- [ ] Roll forward to current version

## Phase 11: Documentation

### Documentation Complete
- [ ] README.md updated with deployment section
- [ ] DEPLOYMENT.md comprehensive guide created
- [ ] DEPLOYMENT_QUICKSTART.md quick guide created
- [ ] GITOPS_SUMMARY.md overview created
- [ ] All documentation committed to git

### Runbooks
- [ ] Update workflow documented
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide available
- [ ] Backup/restore procedures documented

## Phase 12: Security Review

### Security Checks
- [ ] Sealed secrets used (not plain secrets)
- [ ] Non-root containers running
- [ ] Resource limits enforced
- [ ] TLS enabled with valid certificate
- [ ] No plain secrets in git
- [ ] No sensitive data in ConfigMaps
- [ ] Health checks configured
- [ ] Liveness/readiness probes set

## Phase 13: Disaster Recovery

### Backup Verification
- [ ] Database backup procedure tested
- [ ] Sealed secret backup created
- [ ] Git repository backed up (both Gitea and GitHub)
- [ ] Can restore from backup

### High Availability
- [ ] Multiple replicas running (2 for production)
- [ ] Pod disruption budgets considered
- [ ] Rolling update strategy configured

## Phase 14: Final Validation

### Production Readiness
- [ ] All checklist items completed
- [ ] Application accessible via HTTPS
- [ ] All health checks passing
- [ ] MCP integration working
- [ ] Configuration persistence verified
- [ ] Logs clean (no errors)
- [ ] Resource usage normal
- [ ] ArgoCD sync healthy

### Sign-off
- [ ] Deployment reviewed by team
- [ ] Stakeholder sign-off obtained
- [ ] Deployment documented in changelog
- [ ] Release notes prepared

---

## Quick Reference Commands

### Deployment
```bash
make deploy                          # Build and push images
make kube-create-secret              # Create sealed secret
kubectl apply -f argocd/mcp-chatbot-application.yaml
argocd app sync mcp-chatbot          # Trigger ArgoCD sync
```

### Verification
```bash
kubectl get all -n mcp-chatbot       # Check all resources
kubectl get pods -n mcp-chatbot      # Check pods
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f  # View logs
argocd app get mcp-chatbot           # Check ArgoCD status
```

### Troubleshooting
```bash
kubectl describe pod -n mcp-chatbot <pod-name>
kubectl get certificate -n mcp-chatbot
kubectl get sealedsecret -n mcp-chatbot
argocd app sync mcp-chatbot --retry-limit 5
```

---

**Checklist Version:** 1.0.0
**Last Updated:** 2025-01-28
**Status:** Ready for deployment

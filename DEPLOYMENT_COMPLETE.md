# GitOps Deployment - Complete Setup

Congratulations! Your complete GitOps deployment infrastructure for mcp-chatbot is now ready.

## What Was Created

### 1. Kubernetes Infrastructure (10 manifests)
- Namespace, ConfigMap, SealedSecret, PVC
- Separate deployments for backend and frontend
- ClusterIP services for internal communication
- Cilium Ingress with Let's Encrypt TLS
- Kustomize base + production overlay

### 2. ArgoCD Integration
- Application manifest for automatic deployments
- GitOps workflow with Gitea repository
- Auto-sync with self-healing enabled

### 3. Container Registry
- Registry: git.shadyknollcave.io/micro/mcp-chatbot
- Updated Dockerfiles (Node 22, security hardened)
- Multi-stage builds with health checks

### 4. Build Automation
- Makefile with 20+ commands
- Semantic versioning (bump-patch/minor/major)
- One-command deployment workflow

### 5. Documentation (500+ lines)
- DEPLOYMENT.md - Comprehensive guide
- DEPLOYMENT_QUICKSTART.md - 5-minute deployment
- DEPLOYMENT_CHECKLIST.md - Production readiness
- GITOPS_SUMMARY.md - Architecture overview

## Quick Start (5 Minutes)

### Step 1: Create Gitea Repository
```bash
cd /home/micro/development/mcp-chatbot

# Create repository
tea repo create --name mcp-chatbot --description "MCP-Enabled Chatbot"

# Configure remotes
git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git
git remote add backup git@github.com:pedrof/mcp-chatbot.git

# Push current code
git push origin multitenant
git push backup multitenant
```

### Step 2: Build and Push Container Images
```bash
# Build all images
make build

# Push all images
make push

# OR one command
make deploy
```

### Step 3: Create Sealed Secret
```bash
# Generate secure secret (32+ characters)
make kube-create-secret
```

Enter a secure random string when prompted (or use `openssl rand -base64 32`).

### Step 4: Deploy via ArgoCD
```bash
# Apply ArgoCD Application
kubectl apply -f argocd/mcp-chatbot-application.yaml

# Trigger sync
argocd app sync mcp-chatbot

# Wait for health
argocd app wait mcp-chatbot --health
```

### Step 5: Access Application
```bash
# Check deployment
kubectl get all -n mcp-chatbot

# Open in browser
echo "Access at: https://mcp-chatbot.local.shadyknollcave.io"
```

## Architecture Overview

```
Internet (HTTPS:443)
    ↓
Cilium Ingress LoadBalancer (10.10.10.200)
    ↓
Ingress: mcp-chatbot.local.shadyknollcave.io
    ├─ Path: / → Frontend (Nginx + React)
    │               └─ Port 80, 2 replicas (production)
    └─ Path: /api → Backend (Express.js)
                        └─ Port 3000, 2 replicas (production)
                            ├─ SQLite Database (PVC: 1Gi)
                            └─ MCP Servers (internal cluster DNS)
                                └─ mcphue.mcphue.svc.cluster.local:8080
```

## Key Features

### GitOps Workflow
- **Declarative**: All infrastructure in YAML manifests
- **Versioned**: Entire deployment tracked in git
- **Automated**: ArgoCD auto-deploys on git push
- **Self-Healing**: ArgoCD fixes drift automatically
- **Rollback**: Easy rollback to any previous commit

### Security
- **Sealed Secrets**: Encrypted APP_SECRET and JWT_SECRET
- **Non-Root Containers**: Run as UID 1001 (nodejs/nginx-user)
- **TLS/HTTPS**: Let's Encrypt certificates via cert-manager
- **Resource Limits**: CPU and memory constraints enforced
- **Health Checks**: Liveness and readiness probes

### High Availability
- **2 Replicas**: Backend and frontend in production
- **Persistent Storage**: SQLite database on PVC
- **Internal DNS**: MCP server communication via cluster DNS
- **Load Balancing**: Cilium LoadBalancer (shared IP pool)

### Air-Gap Compatible
- **No CDNs**: All assets bundled in images
- **Local Registry**: git.shadyknollcave.io
- **Internal DNS**: MCP servers via cluster.local
- **SQLite Database**: No external database required

## File Structure

```
mcp-chatbot/
├── k8s/
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── sealed-secret.yaml.template
│   │   ├── pvc.yaml
│   │   ├── deployment-backend.yaml
│   │   ├── deployment-frontend.yaml
│   │   ├── service-backend.yaml
│   │   ├── service-frontend.yaml
│   │   ├── ingress.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       └── production/
│           └── kustomization.yaml
├── argocd/
│   └── mcp-chatbot-application.yaml
├── VERSION (1.0.0)
├── Makefile
├── DEPLOYMENT.md
├── DEPLOYMENT_QUICKSTART.md
├── DEPLOYMENT_CHECKLIST.md
├── GITOPS_SUMMARY.md
└── README.md (updated)
```

## Makefile Commands

```bash
# Build commands
make build              # Build all images
make build-backend      # Build backend only
make build-frontend     # Build frontend only

# Push commands
make push               # Push all images
make push-backend       # Push backend only
make push-frontend      # Push frontend only

# Deployment commands
make deploy             # Build + push
make deploy-argocd      # Trigger ArgoCD sync
make kube-apply         # Apply manifests directly

# Secret commands
make kube-create-secret # Create sealed secret
make kube-delete-secret # Delete secret from cluster

# Git commands
make git-setup          # Configure git remotes
make git-push           # Push to both remotes

# Version commands
make bump-patch         # 1.0.0 → 1.0.1
make bump-minor         # 1.0.0 → 1.1.0
make bump-major         # 1.0.0 → 2.0.0

# Utility commands
make kube-logs          # View application logs
make kube-status        # Show deployment status
make help               # Show all commands
```

## Environment Variables

### ConfigMap (Non-Sensitive)
```yaml
PORT: "3000"
NODE_ENV: "production"
DATABASE_PATH: "/app/data/config.db"
TZ: "America/New_York"
VITE_API_URL: "/api"
MCP_HUE_URL: "http://mcphue.mcphue.svc.cluster.local:8080"
```

### SealedSecret (Sensitive)
```yaml
APP_SECRET: "32+ character encryption key (encrypted)"
JWT_SECRET: "32+ character JWT signing key (encrypted)"
```

## Update Workflow

When you need to update the application:

```bash
# 1. Make code changes
# ... edit files ...

# 2. Bump version
make bump-patch  # or bump-minor, bump-major

# 3. Build and push
make deploy

# 4. Update kustomization with new version
vim k8s/overlays/production/kustomization.yaml
# Change: newTag: backend-1.0.1

# 5. Commit and push
git add VERSION k8s/overlays/production/kustomization.yaml
git commit -m "chore: release version $(cat VERSION)"
git push origin main

# 6. ArgoCD auto-syncs
argocd app sync mcp-chatbot
```

## Verification Commands

```bash
# Check all resources
kubectl get all -n mcp-chatbot

# Check pods
kubectl get pods -n mcp-chatbot

# Check services
kubectl get svc -n mcp-chatbot

# Check ingress
kubectl get ingress -n mcp-chatbot

# Check certificate
kubectl get certificate -n mcp-chatbot

# Check ArgoCD status
argocd app get mcp-chatbot

# View logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f

# Test backend health
curl https://mcp-chatbot.local.shadyknollcave.io/api/health

# Test frontend
curl https://mcp-chatbot.local.shadyknollcave.io/
```

## Troubleshooting

### Pods Not Starting
```bash
kubectl get pods -n mcp-chatbot
kubectl describe pod -n mcp-chatbot <pod-name>
kubectl logs -n mcp-chatbot <pod-name>
```

### Certificate Issues
```bash
kubectl get certificate -n mcp-chatbot
kubectl describe certificaterequest -n mcp-chatbot <request-name>
kubectl logs -n cert-manager -l app=cert-manager --tail=100
```

### MCP Server Communication
```bash
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  curl -v http://mcphue.mcphue.svc.cluster.local:8080
```

### Database Issues
```bash
kubectl get pvc -n mcp-chatbot
kubectl describe pvc -n mcp-chatbot mcp-chatbot-data
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  ls -lah /app/data/
```

## Next Steps

1. **Create Gitea Repository** (if not exists)
   ```bash
   tea repo create --name mcp-chatbot
   git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git
   ```

2. **Build and Push Images**
   ```bash
   make deploy
   ```

3. **Create Sealed Secret**
   ```bash
   make kube-create-secret
   ```

4. **Deploy via ArgoCD**
   ```bash
   kubectl apply -f argocd/mcp-chatbot-application.yaml
   argocd app sync mcp-chatbot
   ```

5. **Access Application**
   - URL: https://mcp-chatbot.local.shadyknollcave.io
   - ArgoCD UI: https://argocd.shadyknollcave.io

## Documentation

- **DEPLOYMENT.md** - Comprehensive 500+ line guide
- **DEPLOYMENT_QUICKSTART.md** - 5-minute deployment
- **DEPLOYMENT_CHECKLIST.md** - Production readiness checklist
- **GITOPS_SUMMARY.md** - Architecture overview
- **README.md** - Updated with deployment section

## Support

For issues or questions:
- GitHub: https://github.com/pedrof/mcp-chatbot
- Gitea: https://git.shadyknollcave.io/micro/mcp-chatbot
- Email: microreal@shadyknollcave.io

---

**Status**: Ready for deployment
**Version**: 1.0.0
**Created**: 2025-01-28
**Commits**: 21 files changed, 2300 insertions(+)

**GitOps deployment infrastructure complete! 🚀**

# GitOps Deployment Summary

Complete overview of the GitOps deployment infrastructure for mcp-chatbot.

## Created Files

### 1. Container Infrastructure

**Dockerfiles Updated:**
- `backend/Dockerfile` - Node 22 Alpine, multi-stage, security hardened
- `frontend/Dockerfile` - Node 22 Alpine + Nginx, non-root user

**Container Registry:**
- Registry: `git.shadyknollcave.io/micro/mcp-chatbot`
- Images:
  - `:backend-{version}` - Backend API server
  - `:frontend-{version}` - Frontend Nginx + React
  - `:backend-latest` - Latest backend
  - `:frontend-latest` - Latest frontend

### 2. Kubernetes Manifests

**Base Manifests** (`k8s/base/`):
- `namespace.yaml` - mcp-chatbot namespace
- `configmap.yaml` - Non-sensitive environment variables
- `sealed-secret.yaml` - Encrypted secrets (APP_SECRET, JWT_SECRET)
- `pvc.yaml` - Persistent volume claim for database (1Gi)
- `deployment-backend.yaml` - Backend deployment (Express.js)
- `deployment-frontend.yaml` - Frontend deployment (Nginx)
- `service-backend.yaml` - Backend ClusterIP service (port 3000)
- `service-frontend.yaml` - Frontend ClusterIP service (port 80)
- `ingress.yaml` - Cilium Ingress with Let's Encrypt TLS
- `kustomization.yaml` - Kustomize base configuration

**Production Overlay** (`k8s/overlays/production/`):
- `kustomization.yaml` - Production overrides (2 replicas, increased resources)

**Total Manifests:** 10 files

### 3. ArgoCD Configuration

**Application Manifest** (`argocd/`):
- `mcp-chatbot-application.yaml` - ArgoCD Application resource
  - Source: Gitea repository (git.shadyknollcave.io/micro/mcp-chatbot)
  - Path: `k8s/overlays/production`
  - Sync Policy: Automatic (prune + self-heal)
  - Destination: K3s cluster, mcp-chatbot namespace

### 4. Build Automation

**Makefile** (`Makefile`):
- `make build` - Build all container images
- `make push` - Push all images to registry
- `make deploy` - Build + push
- `make kube-create-secret` - Create sealed secret
- `make deploy-argocd` - Trigger ArgoCD sync
- `make bump-patch/minor/major` - Version management
- `make git-setup` - Configure git remotes
- `make git-push` - Push to both remotes
- `make kube-apply` - Direct kubectl apply (bypass ArgoCD)
- `make kube-logs` - View application logs
- `make kube-status` - Show deployment status

**Version File** (`VERSION`):
- Current version: 1.0.0
- Semantic versioning: MAJOR.MINOR.PATCH

### 5. Documentation

**Deployment Guides:**
- `DEPLOYMENT.md` - Comprehensive deployment guide (500+ lines)
- `DEPLOYMENT_QUICKSTART.md` - 5-minute deployment guide
- `README.md` - Updated with Kubernetes deployment section

## Architecture Overview

### Deployment Strategy

**Separate Deployments** (recommended):
- **Backend Deployment**: Express.js API server
  - Replicas: 1 (base), 2 (production)
  - Resources: 100m-500m CPU, 128Mi-512Mi RAM
  - Health: /health endpoint, liveness/readiness probes
  - Storage: PVC mounted at /app/data

- **Frontend Deployment**: Nginx serving React build
  - Replicas: 1 (base), 2 (production)
  - Resources: 50m-200m CPU, 64Mi-256Mi RAM
  - Health: HTTP / endpoint, liveness/readiness probes
  - Static files: Built React bundle

### Networking Flow

```
Internet (HTTPS:443)
    ↓
Cilium Ingress LoadBalancer (10.10.10.200)
    ↓
Ingress: mcp-chatbot.local.shadyknollcave.io
    ├─ Path: / → mcp-chatbot-frontend Service (port 80)
    │               └─ Frontend Pods (Nginx + React)
    └─ Path: /api → mcp-chatbot-backend Service (port 3000)
                    └─ Backend Pods (Express.js)
                        ├─ SQLite Database (PVC: /app/data/config.db)
                        └─ MCP Servers (internal cluster DNS)
                            └─ mcphue.mcphue.svc.cluster.local:8080
```

### Security Features

- **Sealed Secrets**: APP_SECRET and JWT_SECRET encrypted
- **Non-root Containers**: Run as nodejs (UID 1001) and nginx-user (UID 1001)
- **TLS Termination**: At Cilium Ingress with Let's Encrypt
- **Health Checks**: Liveness and readiness probes for all containers
- **Resource Limits**: CPU and memory constraints enforced
- **Network Policies**: Internal cluster communication only

### Storage

- **PersistentVolumeClaim**: `mcp-chatbot-data` (1Gi)
- **StorageClass**: local-path (K3s default)
- **Access Mode**: ReadWriteOnce
- **Mount Path**: /app/data (backend container)
- **Database**: SQLite at /app/data/config.db

## Deployment Workflow

### Initial Deployment

```bash
# 1. Create Gitea repository
tea repo create --name mcp-chatbot
git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git
git remote add backup git@github.com:pedrof/mcp-chatbot.git

# 2. Build and push images
make build && make push

# 3. Create sealed secret
make kube-create-secret

# 4. Commit and push
git add k8s/ argocd/ VERSION Makefile
git commit -m "feat: add GitOps deployment configuration"
git push origin main
git push backup main

# 5. Deploy via ArgoCD
kubectl apply -f argocd/mcp-chatbot-application.yaml
argocd app sync mcp-chatbot
```

### Update Workflow

```bash
# 1. Make code changes
# ... edit files ...

# 2. Bump version
make bump-patch

# 3. Build and push
make deploy

# 4. Update kustomization
vim k8s/overlays/production/kustomization.yaml
# Change: newTag: backend-1.0.1

# 5. Commit and push
git add VERSION k8s/overlays/production/kustomization.yaml
git commit -m "chore: release version $(cat VERSION)"
git push origin main

# 6. ArgoCD auto-syncs
argocd app sync mcp-chatbot
```

## GitOps Benefits

1. **Declarative Configuration**: All infrastructure in YAML manifests
2. **Version Control**: Entire deployment tracked in git
3. **Automated Sync**: ArgoCD automatically deploys changes
4. **Rollback**: Easy rollback to previous git commits
5. **Audit Trail**: Git history provides complete deployment history
6. **Multi-Environment**: Kustomize overlays for dev/prod
7. **Self-Healing**: ArgoCD automatically fixes drift
8. **Secrets Management**: Sealed Secrets for sensitive data

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

## MCP Server Integration

### Internal Cluster Communication

The backend communicates with MCP servers using Kubernetes internal DNS:

```
http://mcphue.mcphue.svc.cluster.local:8080
```

**Benefits:**
- No internet exposure required
- Low latency internal communication
- Service discovery automatic
- Load balancing via Kubernetes Service

### Configuration

MCP server URLs configured in `k8s/base/configmap.yaml`:
```yaml
MCP_HUE_URL: "http://mcphue.mcphue.svc.cluster.local:8080"
```

## Monitoring and Observability

### Health Checks

**Backend:**
- Liveness: `GET /health` (every 10s, timeout 5s)
- Readiness: `GET /health` (every 5s, timeout 3s)
- Initial delay: 30s (liveness), 10s (readiness)

**Frontend:**
- Liveness: `GET /` (every 10s, timeout 5s)
- Readiness: `GET /` (every 5s, timeout 3s)
- Initial delay: 10s (liveness), 5s (readiness)

### Logs

```bash
# Backend logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f

# Frontend logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-frontend --tail=100 -f

# All logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot --tail=100 -f
```

### Metrics

```bash
# Pod resource usage
kubectl top pods -n mcp-chatbot

# Node resource usage
kubectl top nodes
```

## Troubleshooting

### Common Issues

**Pods Not Starting:**
```bash
kubectl get pods -n mcp-chatbot
kubectl describe pod -n mcp-chatbot <pod-name>
kubectl logs -n mcp-chatbot <pod-name>
```

**Certificate Issues:**
```bash
kubectl get certificate -n mcp-chatbot
kubectl describe certificaterequest -n mcp-chatbot <request-name>
kubectl logs -n cert-manager -l app=cert-manager --tail=100
```

**MCP Server Communication:**
```bash
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  curl -v http://mcphue.mcphue.svc.cluster.local:8080
```

**Database Issues:**
```bash
kubectl get pvc -n mcp-chatbot
kubectl describe pvc -n mcp-chatbot mcp-chatbot-data
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  ls -lah /app/data/
```

## Disaster Recovery

### Backup

```bash
# Database backup
kubectl cp -n mcp-chatbot \
  deployment/mcp-chatbot-backend:/app/data/config.db \
  ./backup-config-$(date +%Y%m%d).db

# Sealed secret backup
kubectl get sealedsecret -n mcp-chatbot mcp-chatbot-secret -o yaml > sealed-secret-backup.yaml

# Manifests backup
git clone https://git.shadyknollcave.io/micro/mcp-chatbot.git mcp-chatbot-backup
```

### Restore

```bash
# Database restore
kubectl cp -n mcp-chatbot ./backup-config.db \
  deployment/mcp-chatbot-backend:/app/data/config.db

# Sealed secret restore
kubectl apply -f sealed-secret-backup.yaml

# Redeploy
argocd app sync mcp-chatbot
```

## Next Steps

1. **Create Gitea Repository**: `tea repo create --name mcp-chatbot`
2. **Build Images**: `make build && make push`
3. **Create Secret**: `make kube-create-secret`
4. **Deploy**: `kubectl apply -f argocd/mcp-chatbot-application.yaml`
5. **Access**: https://mcp-chatbot.local.shadyknollcave.io

## Support

- **Documentation**: `DEPLOYMENT.md`, `DEPLOYMENT_QUICKSTART.md`
- **GitHub**: https://github.com/pedrof/mcp-chatbot
- **Gitea**: https://git.shadyknollcave.io/micro/mcp-chatbot
- **Email**: microreal@shadyknollcave.io

---

**Created**: 2025-01-28
**Version**: 1.0.0
**Status**: Ready for deployment

# MCP Chatbot - GitOps Deployment Guide

Complete guide for deploying the MCP-Enabled Chatbot to K3s Kubernetes cluster using Gitea, ArgoCD, and Sealed Secrets.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Container Registry Setup](#container-registry-setup)
4. [Building and Pushing Images](#building-and-pushing-images)
5. [Secrets Management](#secrets-management)
6. [GitOps Configuration](#gitops-configuration)
7. [Deployment via ArgoCD](#deployment-via-argocd)
8. [Updating the Application](#updating-the-application)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance Operations](#maintenance-operations)

---

## Prerequisites

### Required Tools

- **kubectl** - Kubernetes CLI
- **podman** - Container management (not Docker)
- **tea** - Gitea CLI for git.shadyknollcave.io
- **gh** - GitHub CLI for github.com
- **kubeseal** - Sealed Secrets encryption
- **argocd** - ArgoCD CLI (optional, can use web UI)

### Kubernetes Cluster Requirements

- K3s v1.34.3+k3s1 or later
- Cilium CNI with Ingress Controller
- cert-manager with Let's Encrypt issuer
- LoadBalancer IP pool configured (10.10.10.200/29)
- Sealed Secrets controller installed

### MCP Server Requirements

- mcphue MCP server running in cluster
- Service accessible at: `http://mcphue.mcphue.svc.cluster.local:8080`

---

## Initial Setup

### 1. Create Gitea Repository

Check if repository exists:

```bash
tea repo list | grep mcp-chatbot
```

If not found, create it:

```bash
tea repo create --name mcp-chatbot --description "MCP-Enabled Chatbot with LLM integration"
```

### 2. Configure Git Remotes

```bash
cd /home/micro/development/mcp-chatbot

# Add Gitea remote (primary)
git remote add origin https://git.shadyknollcave.io/micro/mcp-chatbot.git

# Add GitHub remote (backup)
git remote add backup git@github.com:pedrof/mcp-chatbot.git

# Update existing origin if needed
git remote set-url origin https://git.shadyknollcave.io/micro/mcp-chatbot.git

# Verify remotes
git remote -v
```

Expected output:
```
origin	https://git.shadyknollcave.io/micro/mcp-chatbot.git (fetch)
origin	https://git.shadyknollcave.io/micro/mcp-chatbot.git (push)
backup	git@github.com:pedrof/mcp-chatbot.git (fetch)
backup	git@github.com:pedrof/mcp-chatbot.git (push)
```

### 3. Create GitHub Backup Repository

```bash
# Check if exists
gh repo list | grep mcp-chatbot

# Create if not exists
gh repo create mcp-chatbot --public --description "MCP-Enabled Chatbot with LLM integration"
```

### 4. Commit Initial Deployment Files

```bash
cd /home/micro/development/mcp-chatbot

# Add all deployment files
git add k8s/ argocd/ VERSION Makefile Containerfile*

# Commit
git commit -m "feat: add GitOps deployment configuration

- Add Kubernetes manifests (base + production overlays)
- Add ArgoCD Application manifest
- Add VERSION file for semantic versioning
- Add Makefile for build/deploy automation
- Update Dockerfiles to Node 22 with security hardening

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to both remotes
git push origin main
git push backup main
```

---

## Container Registry Setup

### Gitea Container Registry

The registry is integrated with Gitea at `git.shadyknollcave.io`.

### Login to Registry (if authentication required)

```bash
podman login git.shadyknollcave.io
```

Enter your Gitea credentials when prompted.

---

## Building and Pushing Images

### 1. Build All Images

```bash
cd /home/micro/development/mcp-chatbot
make build
```

This builds:
- `git.shadyknollcave.io/micro/mcp-chatbot:backend-1.0.0`
- `git.shadyknollcave.io/micro/mcp-chatbot:frontend-1.0.0`
- `:latest` tags for both images

### 2. Push All Images

```bash
make push
```

### 3. Build and Push in One Command

```bash
make deploy
```

This builds, pushes, and provides instructions for ArgoCD sync.

### 4. Manual Build (if Makefile fails)

```bash
# Backend
podman build -f backend/Dockerfile -t git.shadyknollcave.io/micro/mcp-chatbot:backend-1.0.0 backend/
podman push git.shadyknollcave.io/micro/mcp-chatbot:backend-1.0.0

# Frontend
podman build -f frontend/Dockerfile -t git.shadyknollcave.io/micro/mcp-chatbot:frontend-1.0.0 frontend/
podman push git.shadyknollcave.io/micro/mcp-chatbot:frontend-1.0.0
```

---

## Secrets Management

### 1. Generate Secure Secrets

```bash
# Generate APP_SECRET (32+ characters)
openssl rand -base64 32

# Generate JWT_SECRET (different from APP_SECRET)
openssl rand -base64 32
```

### 2. Create Sealed Secret

**Option A: Using Makefile (Recommended)**

```bash
make kube-create-secret
```

You'll be prompted to enter your APP_SECRET (must be 32+ characters).

**Option B: Manual Creation**

```bash
# Set your secrets
export APP_SECRET="your-32-character-secret-here"
export JWT_SECRET="your-different-32-character-secret-here"

# Create sealed secret
kubectl create secret generic mcp-chatbot-secret \
  --from-literal=APP_SECRET="$APP_SECRET" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --namespace=mcp-chatbot \
  --dry-run=client -o yaml | \
kubeseal --format yaml > k8s/base/sealed-secret.yaml
```

### 3. Commit Sealed Secret

```bash
git add k8s/base/sealed-secret.yaml
git commit -m "feat: add sealed secret for mcp-chatbot"
git push origin main
```

**IMPORTANT:** Never commit plain secrets! Only commit the SealedSecret resource.

---

## GitOps Configuration

### 1. Create ArgoCD Application

Apply the ArgoCD Application manifest:

```bash
kubectl apply -f argocd/mcp-chatbot-application.yaml
```

### 2. Verify ArgoCD Application

```bash
# List applications
argocd app list

# Get application details
argocd app get mcp-chatbot

# Watch sync progress
argocd app sync mcp-chatbot --timeout 300
```

### 3. Access ArgoCD Web UI

1. Open: `https://argocd.shadyknollcave.io`
2. Login with your credentials
3. Navigate to the `mcp-chatbot` application
4. Verify all resources are healthy

---

## Deployment via ArgoCD

### 1. Initial Deployment

Once the ArgoCD Application is created, it will automatically sync:

```bash
# Watch the sync
argocd app watch mcp-chatbot

# Or trigger manual sync
argocd app sync mcp-chatbot
argocd app wait mcp-chatbot --health
```

### 2. Verify Deployment

```bash
# Check all resources in namespace
kubectl get all -n mcp-chatbot

# Check pods
kubectl get pods -n mcp-chatbot

# Check services
kubectl get svc -n mcp-chatbot

# Check ingress
kubectl get ingress -n mcp-chatbot

# Check certificate
kubectl get certificate -n mcp-chatbot
```

Expected output:
```
NAME                                          READY   STATUS    RESTARTS   AGE
pod/mcp-chatbot-backend-xxxxxxxxxx-xxxxx      1/1     Running   0          2m
pod/mcp-chatbot-frontend-xxxxxxxxxx-xxxxx      1/1     Running   0          2m

NAME                             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/mcp-chatbot-backend      ClusterIP   10.43.xxx.xxx   <none>        3000/TCP  2m
service/mcp-chatbot-frontend     ClusterIP   10.43.xxx.xxx   <none>        80/TCP    2m

NAME                                         CLASS    HOSTS                                          ADDRESS         PORTS     AGE
ingress.networking.k8s.io/mcp-chatbot         cilium   mcp-chatbot.local.shadyknollcave.io           10.10.10.200    80, 443   2m
```

### 3. Access the Application

Open in browser: `https://mcp-chatbot.local.shadyknollcave.io`

**Note:** DNS must resolve `mcp-chatbot.local.shadyknollcave.io` to `10.10.10.200` (Cilium LoadBalancer IP).

### 4. Test MCP Server Communication

```bash
# Port forward to backend pod
kubectl port-forward -n mcp-chatbot deployment/mcp-chatbot-backend 3000:3000

# Test MCP connection
curl http://localhost:3000/api/health
```

---

## Updating the Application

### Version Bumping

```bash
# Bump patch version (1.0.0 -> 1.0.1)
make bump-patch

# Bump minor version (1.0.0 -> 1.1.0)
make bump-minor

# Bump major version (1.0.0 -> 2.0.0)
make bump-major
```

### Build and Deploy Updates

```bash
# 1. Build and push new images
make deploy

# 2. Update image tags in k8s/overlays/production/kustomization.yaml
# Edit the file and change:
#   newTag: backend-1.0.1
#   newTag: frontend-1.0.1

# 3. Commit and push
git add VERSION k8s/overlays/production/kustomization.yaml
git commit -m "chore: bump version to 1.0.1"
git push origin main

# 4. ArgoCD will auto-sync (or trigger manually)
argocd app sync mcp-chatbot
argocd app wait mcp-chatbot --health
```

### Automated Deployment Workflow

```bash
# Complete update workflow
make bump-patch && \
  make deploy && \
  git add VERSION k8s/overlays/production/kustomization.yaml && \
  git commit -m "chore: release version $(cat VERSION)" && \
  git push origin main && \
  argocd app sync mcp-chatbot && \
  argocd app wait mcp-chatbot --health
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n mcp-chatbot

# Describe pod
kubectl describe pod -n mcp-chatbot <pod-name>

# Check logs
kubectl logs -n mcp-chatbot <pod-name>
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f
```

### Certificate Issues

```bash
# Check certificate request
kubectl get certificaterequest -n mcp-chatbot

# Describe certificate
kubectl describe certificate -n mcp-chatbot mcp-chatbot-tls

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=100 -f

# Check cluster issuer
kubectl get clusterissuer letsencrypt-prod -o yaml
```

### Sealed Secret Issues

```bash
# Check sealed secret
kubectl get sealedsecret -n mcp-chatbot

# Describe secret
kubectl describe secret -n mcp-chatbot mcp-chatbot-secret

# Verify secret is decrypted
kubectl get secret -n mcp-chatbot mcp-chatbot-secret -o yaml
```

### MCP Server Communication Issues

```bash
# Test backend can reach mcphue service
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  curl -v http://mcphue.mcphue.svc.cluster.local:8080

# Check mcphue service exists
kubectl get svc -n mcphue

# Check DNS resolution
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  nslookup mcphue.mcphue.svc.cluster.local
```

### Ingress Issues

```bash
# Check ingress
kubectl get ingress -n mcp-chatbot

# Describe ingress
kubectl describe ingress -n mcp-chatbot mcp-chatbot

# Check Cilium ingress logs
kubectl logs -n kube-system -l k8s-app=cilium | grep ingress

# Verify LoadBalancer IP assigned
kubectl get svc -n mcp-chatbot

# Test DNS resolution
nslookup mcp-chatbot.local.shadyknollcave.io
```

### Database Issues

```bash
# Check persistent volume claim
kubectl get pvc -n mcp-chatbot

# Check persistent volume
kubectl get pv

# Describe PVC
kubectl describe pvc -n mcp-chatbot mcp-chatbot-data

# Check database file
kubectl exec -n mcp-chatbot deployment/mcp-chatbot-backend -- \
  ls -lah /app/data/
```

---

## Maintenance Operations

### View Logs

```bash
# Backend logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-backend --tail=100 -f

# Frontend logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot-frontend --tail=100 -f

# All logs
kubectl logs -n mcp-chatbot -l app=mcp-chatbot --tail=100 -f
```

### Restart Deployment

```bash
# Restart backend
kubectl rollout restart deployment/mcp-chatbot-backend -n mcp-chatbot

# Restart frontend
kubectl rollout restart deployment/mcp-chatbot-frontend -n mcp-chatbot

# Watch rollout status
kubectl rollout status deployment/mcp-chatbot-backend -n mcp-chatbot
```

### Scale Deployment

```bash
# Scale backend
kubectl scale deployment/mcp-chatbot-backend -n mcp-chatbot --replicas=3

# Scale frontend
kubectl scale deployment/mcp-chatbot-frontend -n mcp-chatbot --replicas=3
```

### Access Pod Shell

```bash
# Backend shell
kubectl exec -it -n mcp-chatbot deployment/mcp-chatbot-backend -- sh

# Frontend shell
kubectl exec -it -n mcp-chatbot deployment/mcp-chatbot-frontend -- sh
```

### Backup Database

```bash
# Copy database from pod
kubectl cp -n mcp-chatbot \
  deployment/mcp-chatbot-backend:/app/data/config.db \
  ./backup-config-$(date +%Y%m%d).db
```

### Restore Database

```bash
# Copy database to pod
kubectl cp -n mcp-chatbot \
  ./backup-config.db \
  deployment/mcp-chatbot-backend:/app/data/config.db

# Restart backend to apply
kubectl rollout restart deployment/mcp-chatbot-backend -n mcp-chatbot
```

### Delete Deployment

```bash
# Delete ArgoCD application (cascading delete)
argocd app delete mcp-chatbot --cascade

# Or delete namespace directly
kubectl delete namespace mcp-chatbot
```

### Upgrade to New Version

```bash
# 1. Bump version
make bump-minor

# 2. Build and push
make deploy

# 3. Update kustomization
sed -i "s/newTag: backend-.*/newTag: backend-$(cat VERSION)/" k8s/overlays/production/kustomization.yaml
sed -i "s/newTag: frontend-.*/newTag: frontend-$(cat VERSION)/" k8s/overlays/production/kustomization.yaml

# 4. Commit and push
git add VERSION k8s/overlays/production/kustomization.yaml
git commit -m "chore: release version $(cat VERSION)"
git push origin main

# 5. ArgoCD auto-syncs
argocd app sync mcp-chatbot
```

---

## Architecture Overview

### Deployment Strategy

**Separate Deployments** (recommended for production):
- `mcp-chatbot-backend` - Express.js API server
- `mcp-chatbot-frontend` - Nginx serving React build

**Benefits:**
- Independent scaling
- Separate health checks
- Easier debugging
- Better resource utilization

### Networking

```
Internet (HTTPS:443)
    ↓
Cilium Ingress LoadBalancer (10.10.10.200)
    ↓
Ingress (mcp-chatbot.local.shadyknollcave.io)
    ├─ / → mcp-chatbot-frontend Service (port 80)
    └─ /api → mcp-chatbot-backend Service (port 3000)
        ↓
    Backend Pods (port 3000)
        ↓
    MCP Server: mcphue.mcphue.svc.cluster.local:8080
```

### Storage

- **PersistentVolumeClaim**: `mcp-chatbot-data` (1Gi, local-path)
- **Mount Path**: `/app/data/config.db`
- **Access Mode**: ReadWriteOnce (single pod write access)

### Security

- **Sealed Secrets**: Encrypted APP_SECRET and JWT_SECRET
- **Non-root containers**: Run as nodejs/nginx-user (UID 1001)
- **Health checks**: Liveness and readiness probes
- **Resource limits**: CPU and memory constraints
- **TLS termination**: At Cilium Ingress with Let's Encrypt

---

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

### Secret (Sensitive)

```yaml
APP_SECRET: "32+ character encryption key"
JWT_SECRET: "32+ character JWT signing key"
```

---

## Resource Requirements

### Backend (per replica)

- **Requests**: 100m CPU, 128Mi memory
- **Limits**: 500m CPU, 512Mi memory
- **Production**: 200m CPU, 256Mi memory (requests)

### Frontend (per replica)

- **Requests**: 50m CPU, 64Mi memory
- **Limits**: 200m CPU, 256Mi memory
- **Production**: 100m CPU, 128Mi memory (requests)

### Storage

- **Capacity**: 1Gi (expandable)
- **StorageClass**: local-path (K3s default)

---

## Monitoring and Observability

### Check Application Health

```bash
# Backend health endpoint
curl https://mcp-chatbot.local.shadyknollcave.io/api/health

# Frontend
curl https://mcp-chatbot.local.shadyknollcave.io/

# Via kubectl port-forward
kubectl port-forward -n mcp-chatbot deployment/mcp-chatbot-backend 3000:3000
curl http://localhost:3000/health
```

### View Pod Metrics

```bash
# Resource usage
kubectl top pods -n mcp-chatbot

# Resource usage per node
kubectl top nodes
```

---

## Disaster Recovery

### Backup Critical Data

```bash
# 1. Backup database
kubectl cp -n mcp-chatbot deployment/mcp-chatbot-backend:/app/data/config.db ./backup-config.db

# 2. Backup sealed secret
kubectl get sealedsecret -n mcp-chatbot mcp-chatbot-secret -o yaml > sealed-secret-backup.yaml

# 3. Backup manifests
git clone https://git.shadyknollcave.io/micro/mcp-chatbot.git mcp-chatbot-backup
```

### Restore from Backup

```bash
# 1. Restore database
kubectl cp -n mcp-chatbot ./backup-config.db deployment/mcp-chatbot-backend:/app/data/config.db

# 2. Restore sealed secret
kubectl apply -f sealed-secret-backup.yaml

# 3. Redeploy application
argocd app sync mcp-chatbot
```

---

## Additional Resources

- [ArgoCD Documentation](https://argocd.readthedocs.io/)
- [Kustomize Documentation](https://kustomize.io/)
- [Sealed Secrets Documentation](https://github.com/bitnami-labs/sealed-secrets)
- [Cilium Documentation](https://docs.cilium.io/)
- [cert-manager Documentation](https://cert-manager.io/)

---

## Support

For issues or questions:
- GitHub: https://github.com/pedrof/mcp-chatbot
- Gitea: https://git.shadyknollcave.io/micro/mcp-chatbot
- Email: microreal@shadyknollcave.io

---

**Last Updated**: 2025-01-28
**Version**: 1.0.0

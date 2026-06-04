# 🚀 Deployment Documentation

## 📋 Overview

This document provides deployment guidelines for Space Analyzer Pro. **Note: This is a local-first, single-user application designed to run on localhost.**

---

## 🎯 Deployment Strategy

### **Local-First Design:**

- **Single User**: Designed for personal use on your local machine
- **No Containerization**: Direct Node.js execution
- **SQLite Database**: Single-file database, no external DB required
- **No Redis**: In-memory caching with automatic cleanup
- **No Kubernetes**: Simple process-based architecture

### **Requirements:**

- Node.js 18+
- npm or yarn
- (Optional) Ollama for AI features

---

## 🏗️ Architecture

### **Simple Local Architecture:**

```
┌─────────────────────────────────────────────────────┐
│                 Space Analyzer                       │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Frontend   │  │   Backend   │  │   SQLite    │ │
│  │  (Vite)     │  │  (Express)  │  │   Database  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                │                │         │
│         └────────────────┴────────────────┘         │
│                      localhost                        │
└─────────────────────────────────────────────────────┘
```

### **Technology Stack:**

| Component    | Technology        | Notes                         |
| ------------ | ----------------- | ----------------------------- |
| **Frontend** | Vue.js 3 + Vite   | SPA with Web Storage caching  |
| **Backend**  | Express.js        | In-memory rate limiting       |
| **Database** | SQLite 3          | Single file, WAL mode enabled |
| **AI**       | Ollama (optional) | Local LLM inference           |
| **Caching**  | Multi-layer       | Memory → Web Storage → SQLite |

---

## 🚀 Local Deployment

### **Quick Start:**

```bash
# 1. Clone and install
git clone <repository>
cd "Space Analyzer"
npm install
cd server && npm install

# 2. Start backend
cd server
npm start

# 3. Start frontend (new terminal)
cd ..
npm run dev

# 4. Open browser
open http://localhost:5173
```

### **Environment Variables (Optional):**

Create `server/.env` for custom configuration:

```env
PORT=8080
JWT_SECRET=your-secret-here
CORS_ORIGIN=http://localhost:5173
```

# Pull recommended models

ollama pull gemma3:latest
ollama pull qwen2.5-coder:7b-instruct

# Start Ollama server

ollama serve

```

metadata:
  name: space-analyzer-frontend
  namespace: space-analyzer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: space-analyzer-frontend
  template:
    metadata:
      labels:
        app: space-analyzer-frontend
    spec:
      containers:
        - name: frontend
          image: space-analyzer/frontend:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: space-analyzer-frontend
  namespace: space-analyzer
spec:
  selector:
    app: space-analyzer-frontend
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

### **Backend Deployment:**

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: space-analyzer-backend
  namespace: space-analyzer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: space-analyzer-backend
  template:
    metadata:
      labels:
        app: space-analyzer-backend
    spec:
      containers:
        - name: backend
          image: space-analyzer/backend:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: space-analyzer-secrets
                  key: database-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: space-analyzer-backend
  namespace: space-analyzer
spec:
  selector:
    app: space-analyzer-backend
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

### **ML Services Deployment:**

```yaml
# ml-services-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: space-analyzer-ml
  namespace: space-analyzer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: space-analyzer-ml
  template:
    metadata:
      labels:
        app: space-analyzer-ml
    spec:
      containers:
        - name: ml-services
          image: space-analyzer/ml-services:latest
          ports:
            - containerPort: 8000
          env:
            - name: MODEL_PATH
              value: "/app/models"
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 60
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: space-analyzer-ml
  namespace: space-analyzer
spec:
  selector:
    app: space-analyzer-ml
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
```

---

## 🗄️ Database Configuration

### **PostgreSQL Configuration:**

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: space-analyzer-postgres
  namespace: space-analyzer
spec:
  serviceName: space-analyzer-postgres
  replicas: 1
  selector:
    matchLabels:
      app: space-analyzer-postgres
  template:
    metadata:
      labels:
        app: space-analyzer-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:14
          env:
            - name: POSTGRES_DB
              value: "space_analyzer"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: space-analyzer-secrets
                  key: postgres-user
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: space-analyzer-secrets
                  key: postgres-password
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "200m"
  volumeClaimTemplates:
    - metadata:
        name: postgres-storage
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
        storageClassName: fast-ssd
---
apiVersion: v1
kind: Service
metadata:
  name: space-analyzer-postgres
  namespace: space-analyzer
spec:
  selector:
    app: space-analyzer-postgres
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP
```

### **Redis Configuration:**

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: space-analyzer-redis
  namespace: space-analyzer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: space-analyzer-redis
  template:
    metadata:
      labels:
        app: space-analyzer-redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          resources:
            requests:
              memory: "128Mi"
              cpu: "50m"
            limits:
              memory: "256Mi"
              cpu: "100m"
          volumeMounts:
            - name: redis-storage
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: redis-storage
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 2Gi
        storageClassName: fast-ssd
---
apiVersion: v1
kind: Service
metadata:
  name: space-analyzer-redis
  namespace: space-analyzer
spec:
  selector:
    app: space-analyzer-redis
  ports:
    - port: 6379
      targetPort: 6379
  type: ClusterIP
```

---

## 🔄 CI/CD Pipeline

### **GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration

      - name: Run ML tests
        run: npm run test:ml

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t space-analyzer/frontend:${{ github.sha }} ./frontend
          docker build -t space-analyzer/backend:${{ github.sha }} ./backend
          docker build -t space-analyzer/ml-services:${{ github.sha }} ./ml-services

      - name: Push to registry
        run: |
          docker push space-analyzer/frontend:${{ github.sha }}
          docker push space-analyzer/backend:${{ github.sha }}
          docker push space-analyzer/ml-services:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/space-analyzer-frontend frontend=space-analyzer/frontend:${{ github.sha }} -n space-analyzer
          kubectl set image deployment/space-analyzer-backend backend=space-analyzer/backend:${{ github.sha }} -n space-analyzer
          kubectl set image deployment/space-analyzer-ml ml-services=space-analyzer/ml-services:${{ github.sha }} -n space-analyzer
          kubectl rollout status deployment/space-analyzer-frontend -n space-analyzer
          kubectl rollout status deployment/space-analyzer-backend -n space-analyzer
          kubectl rollout status deployment/space-analyzer-ml -n space-analyzer

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          # Blue-green deployment logic
          kubectl apply -f k8s/production/
          kubectl rollout status deployment/space-analyzer-frontend -n space-analyzer
          kubectl rollout status deployment/space-analyzer-backend -n space-analyzer
          kubectl rollout status deployment/space-analyzer-ml -n space-analyzer
```

---

## 📊 Monitoring Configuration

### **Prometheus Configuration:**

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: space-analyzer
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - "/etc/prometheus/rules/*.yml"

    scrape_configs:
      - job_name: 'space-analyzer-backend'
        static_configs:
          - targets: ['space-analyzer-backend:3000']
        metrics_path: /metrics
        scrape_interval: 10s

      - job_name: 'space-analyzer-ml'
        static_configs:
          - targets: ['space-analyzer-ml:8000']
        metrics_path: /metrics
        scrape_interval: 30s

      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
            regex: __meta_kubernetes_pod_annotation_prometheus_io_scrape
```

### **Grafana Dashboard:**

```yaml
# grafana-dashboard.json
{
  "dashboard":
    {
      "title": "Space Analyzer Dashboard",
      "panels":
        [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "rate(http_requests_total[5m])",
                  "legendFormat": "{{method}} {{status}}",
                },
              ],
          },
          {
            "title": "Response Time",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                  "legendFormat": "95th percentile",
                },
              ],
          },
          {
            "title": "ML Model Performance",
            "type": "graph",
            "targets": [{ "expr": "ml_model_accuracy", "legendFormat": "{{model}}" }],
          },
        ],
    },
}
```

---

## 🔒 Security Configuration

### **Network Policies:**

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: space-analyzer-network-policy
  namespace: space-analyzer
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: space-analyzer
    - to: []
      ports:
        - protocol: TCP
          port: 53
        - protocol: UDP
          port: 53
```

### **RBAC Configuration:**

```yaml
# rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: space-analyzer
  name: space-analyzer-operator
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: space-analyzer-operator-binding
  namespace: space-analyzer
subjects:
  - kind: ServiceAccount
    name: space-analyzer-operator
    namespace: space-analyzer
roleRef:
  kind: Role
  name: space-analyzer-operator
  apiGroup: rbac.authorization.k8s.io
```

---

## 🚀 Deployment Steps

### **1. Environment Preparation:**

```bash
# Create namespace
kubectl create namespace space-analyzer

# Create secrets
kubectl create secret generic space-analyzer-secrets \
  --from-literal=database-url="postgresql://user:password@postgres:5432/space_analyzer" \
  --from-literal=postgres-user="space_analyzer" \
  --from-literal=postgres-password="secure_password" \
  -n space-analyzer

# Apply configurations
kubectl apply -f k8s/
```

### **2. Database Setup:**

```bash
# Deploy database
kubectl apply -f k8s/postgres-deployment.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=space-analyzer-postgres -n space-analyzer

# Run database migrations
kubectl exec -it deployment/space-analyzer-postgres -n space-analyzer -- psql -U space_analyzer -d space_analyzer -c "CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, version VARCHAR(50), applied_at TIMESTAMP DEFAULT NOW());"
```

### **3. Application Deployment:**

```bash
# Deploy backend services
kubectl apply -f k8s/backend-deployment.yaml

# Deploy ML services
kubectl apply -f k8s/ml-services-deployment.yaml

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=space-analyzer-backend -n space-analyzer
kubectl wait --for=condition=ready pod -l app=space-analyzer-ml -n space-analyzer
kubectl wait --for=condition=ready pod -l app=space-analyzer-frontend -n space-analyzer
```

### **4. Monitoring Setup:**

```bash
# Deploy monitoring stack
kubectl apply -f k8s/monitoring/

# Verify monitoring
kubectl get pods -n monitoring
```

---

## 🔄 Blue-Green Deployment

### **Blue-Green Strategy:**

```bash
# Create green environment
kubectl apply -f k8s/green/

# Switch traffic to green
kubectl patch service space-analyzer-frontend -p '{"spec":{"selector":{"app":"space-analyzer-frontend-green"}}}' -n space-analyzer

# Verify green deployment
kubectl rollout status deployment/space-analyzer-frontend-green -n space-analyzer

# Clean up blue environment
kubectl delete deployment space-analyzer-frontend-blue -n space-analyzer
```

---

## 📊 Health Checks

### **Health Check Endpoints:**

```typescript
// Backend health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    services: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      ml: await checkMLHealth(),
    },
  });
});

// ML services health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    models: {
      complexity: await checkModelHealth("complexity"),
      refactoring: await checkModelHealth("refactoring"),
      pattern: await checkModelHealth("pattern"),
    },
  });
});
```

---

## 🔧 Troubleshooting

### **Common Issues:**

1. **Pod Not Starting**: Check resource limits and image availability
2. **Database Connection**: Verify database credentials and network policies
3. **ML Model Loading**: Check model file paths and permissions
4. **Performance Issues**: Monitor resource usage and optimize configurations

### **Debug Commands:**

```bash
# Check pod status
kubectl get pods -n space-analyzer

# Check pod logs
kubectl logs -f deployment/space-analyzer-backend -n space-analyzer

# Check events
kubectl get events -n space-analyzer --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n space-analyzer

# Port forwarding for debugging
kubectl port-forward deployment/space-analyzer-backend 3000:3000 -n space-analyzer
```

---

## 📈 Performance Optimization

### **Resource Optimization:**

1. **Horizontal Pod Autoscaler**: Automatically scale based on CPU/memory usage
2. **Vertical Pod Autoscaler**: Automatically adjust resource requests/limits
3. **Cluster Autoscaler**: Automatically scale cluster based on demand
4. **Pod Disruption Budgets**: Ensure availability during updates

### **Caching Strategy:**

1. **Redis Cache**: Cache frequently accessed data
2. **Application Cache**: Implement in-memory caching
3. **CDN Cache**: Cache static assets at edge locations
4. **Database Query Cache**: Cache database query results

---

## 🔒 Security Best Practices

### **Security Measures:**

1. **Network Policies**: Restrict network traffic between pods
2. **Pod Security Policies**: Run containers with least privilege
3. **Secrets Management**: Use Kubernetes secrets for sensitive data
4. **TLS Encryption**: Encrypt all network traffic
5. **Image Scanning**: Scan container images for vulnerabilities

### **Compliance:**

1. **Audit Logging**: Log all access and modifications
2. **Data Encryption**: Encrypt sensitive data at rest and in transit
3. **Access Control**: Implement proper RBAC policies
4. **Regular Updates**: Keep dependencies and images updated
5. **Security Scanning**: Regular security assessments

---

## 🎯 Conclusion

The deployment configuration provides a **comprehensive, secure, and scalable** deployment strategy for the refactored Space Analyzer. The **containerized architecture** enables **easy scaling**, **consistent deployments**, and **efficient resource utilization**.

The **Kubernetes orchestration** provides **high availability**, **fault tolerance**, and **automated scaling**, while the **monitoring and logging** stack ensures **observability** and **operational excellence**.

The **blue-green deployment** strategy minimizes risk during updates, while the **security configurations** ensure **compliance** and **data protection**.

This deployment setup serves as a **production-ready foundation** for the **modular, ML-powered Space Analyzer** and demonstrates **best practices** for **modern cloud-native application deployment**.

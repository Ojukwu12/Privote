# Deployment Guide

Production deployment guide for Privote backend.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Platforms](#cloud-platforms)
- [Environment Setup](#environment-setup)
- [Database](#database)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Scaling](#scaling)
- [CI/CD Pipeline](#cicd-pipeline)

---

## Prerequisites

### Required Tools

- Docker & Docker Compose
- Kubernetes (for K8s deployments)
- kubectl CLI
- Helm (optional, for package management)
- AWS CLI / GCP CLI / Azure CLI (for cloud deployments)

### Network Requirements

- Static IP for project wallet
- Domain name with HTTPS certificate
- Outbound access to:
  - Zama Relayer: `https://relayer.testnet.zama.org`
  - Zama Gateway: `https://gateway.testnet.zama.org`
  - Sepolia RPC: `https://rpc.sepolia.org`
  - MongoDB Atlas (if cloud)
  - Redis Cloud (if cloud)

---

## Docker Deployment

### Build Production Image

```bash
# Build with specific tag
docker build -t privote-backend:v1.0.0 .

# Tag for registry
docker tag privote-backend:v1.0.0 your-registry/privote-backend:v1.0.0

# Push to registry
docker push your-registry/privote-backend:v1.0.0
```

### Run with Docker

#### Single Container

```bash
docker run -d \
  --name privote-api \
  --restart always \
  -p 3000:3000 \
  --network privote-network \
  -e NODE_ENV=production \
  -e MONGO_URI=mongodb://mongo:27017/privote \
  -e REDIS_HOST=redis \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e PROJECT_PRIVATE_KEY=$PROJECT_PRIVATE_KEY \
  -e RELAYER_URL=https://relayer.testnet.zama.org \
  -e RPC_URL=https://rpc.sepolia.org \
  -e CHAIN_ID=11155111 \
  -e GATEWAY_CHAIN_ID=10901 \
  -e ACL_CONTRACT_ADDRESS=0xC1820b6Eb60f448E6c44d3A8f36EC6D5fCc76754 \
  -e KMS_CONTRACT_ADDRESS=0x208De73316E44722e16f6dDFF40881A3e4F86104 \
  -e VOTING_CONTRACT_ADDRESS=$VOTING_CONTRACT_ADDRESS \
  -e CORS_ORIGIN=https://your-frontend.com \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  your-registry/privote-backend:v1.0.0
```

#### Docker Compose

For multi-container setup:

```yaml
version: '3.8'

services:
  api:
    image: your-registry/privote-backend:v1.0.0
    container_name: privote-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGO_URI: mongodb://mongo:27017/privote
      REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET}
      PROJECT_PRIVATE_KEY: ${PROJECT_PRIVATE_KEY}
      VOTING_CONTRACT_ADDRESS: ${VOTING_CONTRACT_ADDRESS}
    depends_on:
      - mongo
      - redis
    networks:
      - privote-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: 3

  worker:
    image: your-registry/privote-backend:v1.0.0
    container_name: privote-worker
    restart: always
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://mongo:27017/privote
      REDIS_HOST: redis
      PROJECT_PRIVATE_KEY: ${PROJECT_PRIVATE_KEY}
      VOTING_CONTRACT_ADDRESS: ${VOTING_CONTRACT_ADDRESS}
    command: npm run worker
    depends_on:
      - mongo
      - redis
    networks:
      - privote-network
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: 3

  mongo:
    image: mongo:7.0
    container_name: privote-mongo
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongo-data:/data/db
      - mongo-config:/data/configdb
    networks:
      - privote-network
    command: --auth --wiredTigerCacheSizeGB 1

  redis:
    image: redis:7.0
    container_name: privote-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - privote-network

volumes:
  mongo-data:
  mongo-config:
  redis-data:

networks:
  privote-network:
    driver: bridge
```

---

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace privote
```

### 2. Create Secrets

```bash
# JWT Secret
kubectl create secret generic jwt-secret \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  -n privote

# Project private key
kubectl create secret generic project-wallet \
  --from-literal=PROJECT_PRIVATE_KEY=$PROJECT_PRIVATE_KEY \
  -n privote

# MongoDB credentials
kubectl create secret generic mongo-creds \
  --from-literal=username=admin \
  --from-literal=password=$(openssl rand -hex 16) \
  -n privote

# Redis password
kubectl create secret generic redis-creds \
  --from-literal=password=$(openssl rand -hex 16) \
  -n privote
```

### 3. Create ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: privote-config
  namespace: privote
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  RELAYER_URL: "https://relayer.testnet.zama.org"
  RPC_URL: "https://rpc.sepolia.org"
  CHAIN_ID: "11155111"
  GATEWAY_CHAIN_ID: "10901"
  ACL_CONTRACT_ADDRESS: "0xC1820b6Eb60f448E6c44d3A8f36EC6D5fCc76754"
  KMS_CONTRACT_ADDRESS: "0x208De73316E44722e16f6dDFF40881A3e4F86104"
  VOTING_CONTRACT_ADDRESS: "YOUR_CONTRACT_ADDRESS"
  CORS_ORIGIN: "https://your-frontend.com"
  MONGO_URI: "mongodb://admin:password@privote-mongo:27017/privote?authSource=admin"
  REDIS_HOST: "privote-redis"
  REDIS_PORT: "6379"
```

### 4. Deploy API

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: privote-api
  namespace: privote
  labels:
    app: privote-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: privote-api
  template:
    metadata:
      labels:
        app: privote-api
    spec:
      containers:
      - name: api
        image: your-registry/privote-backend:v1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: privote-config
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: JWT_SECRET
        - name: PROJECT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: project-wallet
              key: PROJECT_PRIVATE_KEY
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

---
apiVersion: v1
kind: Service
metadata:
  name: privote-api
  namespace: privote
spec:
  selector:
    app: privote-api
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: privote-api-hpa
  namespace: privote
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: privote-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 5. Deploy Worker

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: privote-worker
  namespace: privote
  labels:
    app: privote-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: privote-worker
  template:
    metadata:
      labels:
        app: privote-worker
    spec:
      containers:
      - name: worker
        image: your-registry/privote-backend:v1.0.0
        imagePullPolicy: IfNotPresent
        command: ["npm", "run", "worker"]
        envFrom:
        - configMapRef:
            name: privote-config
        env:
        - name: PROJECT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: project-wallet
              key: PROJECT_PRIVATE_KEY
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: privote-worker-hpa
  namespace: privote
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: privote-worker
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

### 6. Apply Manifests

```bash
kubectl apply -f configmap.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f worker-deployment.yaml

# Check status
kubectl get all -n privote
kubectl logs -f deployment/privote-api -n privote
```

---

## Cloud Platforms

### AWS (ECS/Fargate)

#### 1. Create ECR Repository

```bash
aws ecr create-repository --repository-name privote-backend --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag privote-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/privote-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/privote-backend:latest
```

#### 2. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name privote --region us-east-1
```

#### 3. Create Task Definition

```bash
# task-definition.json
{
  "family": "privote-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "api",
    "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/privote-backend:latest",
    "portMappings": [{
      "containerPort": 3000,
      "protocol": "tcp"
    }],
    "environment": [
      {
        "name": "NODE_ENV",
        "value": "production"
      },
      {
        "name": "PORT",
        "value": "3000"
      }
    ],
    "secrets": [
      {
        "name": "JWT_SECRET",
        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:privote/jwt-secret"
      },
      {
        "name": "PROJECT_PRIVATE_KEY",
        "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:privote/project-wallet"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/privote",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}

aws ecs register-task-definition --cli-input-json file://task-definition.json --region us-east-1
```

#### 4. Create ECS Service

```bash
aws ecs create-service \
  --cluster privote \
  --service-name privote-api \
  --task-definition privote-api \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:<account-id>:targetgroup/privote/xxx,containerName=api,containerPort=3000 \
  --region us-east-1
```

### Google Cloud (Cloud Run)

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/privote-backend

# Deploy to Cloud Run
gcloud run deploy privote-backend \
  --image gcr.io/PROJECT_ID/privote-backend \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,MONGO_URI=$MONGO_URI,REDIS_HOST=$REDIS_HOST \
  --set-cloudsql-instances PROJECT_ID:REGION:INSTANCE \
  --allow-unauthenticated
```

### Azure Container Instances

```bash
az acr build --registry myregistry --image privote-backend:latest .

az container create \
  --resource-group mygroup \
  --name privote-api \
  --image myregistry.azurecr.io/privote-backend:latest \
  --cpu 1 \
  --memory 1 \
  --environment-variables NODE_ENV=production \
  --ports 3000 \
  --registry-login-server myregistry.azurecr.io \
  --registry-username <username> \
  --registry-password <password>
```

---

## Environment Setup

### Secrets Management

#### AWS Secrets Manager

```bash
# Store JWT secret
aws secretsmanager create-secret \
  --name privote/jwt-secret \
  --secret-string "$(openssl rand -hex 32)"

# Store project private key
aws secretsmanager create-secret \
  --name privote/project-wallet \
  --secret-string "0x..."
```

#### HashiCorp Vault

```bash
vault kv put secret/privote/jwt \
  value="$(openssl rand -hex 32)"

vault kv put secret/privote/wallet \
  key="0x..."
```

### HTTPS/TLS

#### Let's Encrypt with Nginx Reverse Proxy

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d api.privote.io

# Update Nginx config
server {
    listen 443 ssl http2;
    server_name api.privote.io;
    
    ssl_certificate /etc/letsencrypt/live/api.privote.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.privote.io/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### CloudFlare SSL

Configure SSL mode in CloudFlare dashboard: Settings > SSL/TLS > Full (Strict)

---

## Database

### MongoDB

#### Self-Hosted

```bash
# Enable authentication
mongosh admin --eval "
  db.createUser({
    user: 'admin',
    pwd: 'strong-password',
    roles: ['root']
  })
"

# Enable encryption at rest
mongod --enableEncryption --encryptionKeyFile /path/to/keyfile
```

#### MongoDB Atlas

1. Create cluster on [atlas.mongodb.com](https://atlas.mongodb.com)
2. Add IP to whitelist
3. Create database user
4. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/privote`
5. Update `MONGO_URI` in `.env`

### Redis

#### Self-Hosted

```bash
# Enable authentication
redis-server --requirepass "strong-password"

# Enable persistence
appendonly yes
appendfsync everysec
```

#### Redis Cloud

1. Create database on [redis.com](https://redis.com)
2. Get connection details
3. Update `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

#### Backup

```bash
# Manual backup
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backup/dump.rdb
```

---

## Monitoring & Logging

### Application Monitoring (Sentry)

```bash
npm install @sentry/node

# Initialize in server.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: "YOUR_SENTRY_DSN" });
app.use(Sentry.Handlers.errorHandler());
```

### Logging (ELK Stack)

```bash
# Install ELK stack
docker-compose up -d elasticsearch logstash kibana

# Update Winston logger
const elasticsearch = require('winston-elasticsearch');
logger.add(new elasticsearch.ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: 'http://elasticsearch:9200' }
}));
```

### APM (New Relic)

```bash
npm install newrelic

# In application startup
require('newrelic');

# Configuration in newrelic.js
exports.config = {
  app_name: ['Privote'],
  license_key: 'YOUR_LICENSE_KEY',
  logging: { level: 'info' }
};
```

### CloudWatch (AWS)

```bash
npm install aws-sdk

// Log to CloudWatch
const cloudwatch = new AWS.CloudWatch();
const params = {
  Namespace: 'Privote',
  MetricData: [{
    MetricName: 'VoteSubmission',
    Value: 1,
    Unit: 'Count'
  }]
};
cloudwatch.putMetricData(params).promise();
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Automated daily backup
0 2 * * * mongodump --uri="mongodb://user:pass@host:27017/privote" --out="/backups/mongodb/$(date +\%Y-\%m-\%d)"

# Restore from backup
mongorestore --uri="mongodb://user:pass@host:27017" /backups/mongodb/2025-12-24
```

### Redis Backup

```bash
# Enable RDB persistence
save 900 1     # Save after 900 seconds if 1 key changed
save 300 10    # Save after 300 seconds if 10 keys changed
save 60 10000  # Save after 60 seconds if 10000 keys changed

# Automated backup to S3
0 3 * * * aws s3 cp /var/lib/redis/dump.rdb s3://privote-backups/redis-$(date +\%Y-\%m-\%d).rdb
```

### Database Replication

```yaml
# MongoDB replica set
replication:
  replSetName: privote-rs
  oplogSizeMB: 5000

# Run in MongoDB shell
rs.initiate({
  _id: "privote-rs",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 3 },
    { _id: 1, host: "mongo2:27017", priority: 2 },
    { _id: 2, host: "mongo3:27017", priority: 1 }
  ]
})
```

---

## Scaling

### Horizontal Scaling

Use load balancer (Nginx, AWS ALB, GCP LB) to distribute traffic:

```bash
# Nginx load balancing
upstream privote_api {
    server api1.privote.io:3000 weight=1;
    server api2.privote.io:3000 weight=1;
    server api3.privote.io:3000 weight=1;
}

server {
    listen 80;
    location / {
        proxy_pass http://privote_api;
    }
}
```

### Auto-Scaling Policies

**Kubernetes:**
- CPU > 70%: Scale up
- CPU < 30%: Scale down
- Min: 3 replicas
- Max: 10 replicas

**AWS ASG:**
- Target Tracking Scaling Policy
- Target Metric: Average CPU Utilization
- Target Value: 70%

### Database Scaling

- **MongoDB**: Use sharding for large datasets
- **Redis**: Use Redis Cluster or Sentinel for replication

---

## CI/CD Pipeline

### GitHub Actions

Pipeline already configured in `.github/workflows/ci.yml`:

1. **Lint**: ESLint
2. **Test**: Unit + Integration tests
3. **Build**: Docker image
4. **Push**: To registry
5. **Deploy**: To Kubernetes/Cloud

Customize deployment:

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/privote-api \
      api=your-registry/privote-backend:${{ github.sha }} \
      -n privote
```

---

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-12-24T12:00:00.000Z",
    "uptime": 3600
  }
}
```

### Database Health

```bash
# MongoDB
mongosh --eval "db.adminCommand('ping')"

# Redis
redis-cli ping
```

---

## Disaster Recovery

### RTO/RPO Targets

- **RTO** (Recovery Time Objective): 15 minutes
- **RPO** (Recovery Point Objective): 5 minutes

### Failover Procedure

1. **Database failover**: MongoDB replica set automatic failover
2. **Cache failover**: Redis Sentinel
3. **API failover**: Load balancer health checks
4. **Relayer failover**: Built into Zama SDK

### Recovery Steps

```bash
# 1. Restore MongoDB from backup
mongorestore --uri="mongodb://user:pass@host:27017" /backups/mongodb/latest

# 2. Restore Redis from backup
redis-cli shutdown
cp /backups/redis/latest-dump.rdb /var/lib/redis/dump.rdb
redis-server

# 3. Restart API and worker
kubectl rollout restart deployment/privote-api -n privote
kubectl rollout restart deployment/privote-worker -n privote

# 4. Verify health
curl https://api.privote.io/api/health
```

---

## Performance Tuning

### MongoDB Optimization

```javascript
// Add indexes
db.votes.createIndex({ proposalId: 1, userId: 1 });
db.votes.createIndex({ txHash: 1 });
db.votes.createIndex({ createdAt: -1 });

// Enable compression
storage:
  compression: snappy
```

### Redis Optimization

```bash
# Tune memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Tune persistence
appendfsync everysec
no-appendfsync-on-rewrite no
```

### Node.js Optimization

```javascript
// Use cluster mode
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  for (let i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
} else {
  app.listen(3000);
}
```

---

## Troubleshooting

### Pod Stuck in Pending

```bash
kubectl describe pod <pod-name> -n privote
# Check: resource requests, node availability, image pull errors
```

### High Memory Usage

```bash
kubectl top nodes
kubectl top pods -n privote
# Check: MongoDB pipeline, Redis memory, Node.js heap
```

### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb://user:pass@host:27017/privote"

# Test Redis connection
redis-cli -h redis-host ping
```

---

**Last Updated**: December 2025

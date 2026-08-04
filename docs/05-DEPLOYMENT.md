# 05 - 部署架构（DEPLOYMENT）

> **环境**: Local / Staging / Production
> **技术**: Docker + Kubernetes + Terraform
> **CI/CD**: GitHub Actions + ArgoCD
> **版本**: v1.0.0
> **日期**: 2026-08-03

---

## 1. 部署架构总览

```mermaid
graph LR
    U[用户] --> CDN[CDN<br/>Cloudflare]
    CDN --> LB[Load Balancer<br/>Nginx]
    LB --> K8s[K8s Cluster]
    K8s --> BE[Backend Pods<br/>3+]
    K8s --> FE[Frontend Pods<br/>2+]
    BE --> PG[(PostgreSQL<br/>主+从)]
    BE --> Redis[(Redis<br/>Cluster)]
    BE --> MinIO[(MinIO<br/>S3)]
    BE --> MQ[RabbitMQ]
    K8s --> Monitor[Prometheus<br/>Grafana]
    K8s --> Backup[异地备份<br/>OSS]
```

## 2. 本地开发环境

### 2.1 工具链

- **Node.js 20 LTS**
- **pnpm 8**
- **Docker Desktop**
- **VS Code / WebStorm**
- **Git**

### 2.2 docker-compose.yml

```yaml
version: '3.9'

services:
  # 后端
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://lims:lims@postgres:5432/lims
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio:9000
      NODE_ENV: development
    volumes:
      - ./apps/backend:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
      - minio

  # 前端
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./apps/frontend:/app
      - /app/node_modules

  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lims
      POSTGRES_PASSWORD: lims
      POSTGRES_DB: lims
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # MinIO
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  pg_data:
  redis_data:
  minio_data:
```

### 2.3 启动

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止
docker-compose down

# 清理
docker-compose down -v
```

## 3. 测试环境（Staging）

### 3.1 部署架构

```yaml
# k8s/staging/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: lims-staging
```

```yaml
# k8s/staging/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: lims-staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: registry.example.com/lims/backend:v1.0.0-rc1
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: lims-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### 3.2 部署命令

```bash
# 应用清单
kubectl apply -f k8s/staging/ -n lims-staging

# 查看状态
kubectl get pods -n lims-staging

# 查看日志
kubectl logs -f deployment/backend -n lims-staging

# 扩缩
kubectl scale deployment backend --replicas=3 -n lims-staging
```

## 4. 生产环境（Production）

### 4.1 高可用架构

```mermaid
graph TB
    subgraph K8s
        LB[Load Balancer<br/>Nginx]
        subgraph Backend
            BE1[Pod 1]
            BE2[Pod 2]
            BE3[Pod 3]
        end
    end
    
    subgraph Database
        PG_M[(PG Master)]
        PG_R1[(PG Replica 1<br/>异地)]
        PG_R2[(PG Replica 2<br/>同机房)]
    end
    
    Redis_C[(Redis Cluster<br/>6 节点)]
    MinIO_C[(MinIO<br/>4 节点纠删码)]
    MQ_C[(RabbitMQ<br/>Cluster)]
```

### 4.2 资源配置

| 服务 | 节点数 | CPU | 内存 | 存储 |
|---|---|---|---|---|
| Backend | 3+ | 2 core | 4 GB | - |
| Frontend | 2+ | 1 core | 1 GB | - |
| PostgreSQL Master | 1 | 4 core | 16 GB | 100 GB SSD |
| PostgreSQL Replica | 2 | 4 core | 16 GB | 100 GB SSD |
| Redis | 3 | 2 core | 8 GB | - |
| MinIO | 4 | 2 core | 4 GB | 10 TB |
| RabbitMQ | 3 | 1 core | 2 GB | - |

### 4.3 备份策略

```bash
#!/bin/bash
# scripts/backup.sh
set -euo pipefail

# 1. PostgreSQL 全量备份
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/lims-full-${TIMESTAMP}.sql.gz.enc"

# 导出 + 压缩 + 加密
pg_dump -h $PG_HOST -U $PG_USER $PG_DB |   gzip |   openssl enc -aes-256-gcm -salt -pbkdf2 -pass pass:$BACKUP_KEY |   > $BACKUP_FILE

# 2. 上传到异地 OSS
ossutil cp $BACKUP_FILE oss://lims-backup-prod/daily/   --meta x-oss-storage-class:IA

# 3. 清理 30 天前的本地备份
find /backups -name "lims-full-*" -mtime +30 -delete

# 4. 验证
echo "Backup completed: $BACKUP_FILE"
```

```bash
# 定时任务 (cron)
0 2 * * * /opt/lims/scripts/backup.sh >> /var/log/lims-backup.log 2>&1
```

### 4.4 监控

```yaml
# prometheus/lims.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'lims-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: /metrics

  - job_name: 'lims-frontend'
    static_configs:
      - targets: ['frontend:80']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

## 5. CI/CD

### 5.1 工作流

```mermaid
graph LR
    A[Git Push] --> B[Lint + Test]
    B --> C[Build Docker]
    C --> D[Push to Registry]
    D --> E[Deploy to Staging]
    E --> F[Smoke Test]
    F --> G[Manual Approval]
    G --> H[Deploy to Production]
    H --> I[Smoke Test]
    I --> J[Notify]
```

### 5.2 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm run lint
      
      - name: Type check
        run: pnpm run typecheck
      
      - name: Unit tests
        run: pnpm run test:unit
      
      - name: Integration tests
        run: pnpm run test:integration
        env:
          DATABASE_URL: postgres://lims:lims@localhost:5432/lims_test
      
      - name: Build
        run: pnpm run build
      
      - name: E2E tests
        run: pnpm run test:e2e
```

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build backend
        run: |
          docker build -t registry.example.com/lims/backend:${{ github.ref_name }} ./apps/backend
          docker push registry.example.com/lims/backend:${{ github.ref_name }}
      
      - name: Build frontend
        run: |
          docker build -t registry.example.com/lims/frontend:${{ github.ref_name }} ./apps/frontend
          docker push registry.example.com/lims/frontend:${{ github.ref_name }}
  
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/backend backend=registry.example.com/lims/backend:${{ github.ref_name }} -n lims-staging
          kubectl set image deployment/frontend frontend=registry.example.com/lims/frontend:${{ github.ref_name }} -n lims-staging
          kubectl rollout status deployment/backend -n lims-staging
      
      - name: Run smoke tests
        run: ./scripts/smoke-test.sh staging
  
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/backend backend=registry.example.com/lims/backend:${{ github.ref_name }} -n lims-prod
          kubectl set image deployment/frontend frontend=registry.example.com/lims/frontend:${{ github.ref_name }} -n lims-prod
          kubectl rollout status deployment/backend -n lims-prod --timeout=600s
      
      - name: Notify
        if: always()
        run: |
          curl -X POST $SLACK_WEBHOOK -d "{"text": "Deploy ${{ github.ref_name }}: ${{ job.status }}"}"
```

## 6. Terraform (IaC)

### 6.1 阿里云基础设施

```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.5"
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.200"
    }
  }
}

provider "alicloud" {
  region = "cn-beijing"
}

# VPC
resource "alicloud_vpc" "lims" {
  name       = "lims-vpc"
  cidr_block = "10.0.0.0/16"
}

# VSwitches
resource "alicloud_vswitch" "lims_public" {
  vpc_id     = alicloud_vpc.lims.id
  cidr_block = "10.0.1.0/24"
  zone_id    = "cn-beijing-a"
}

resource "alicloud_vswitch" "lims_private" {
  vpc_id     = alicloud_vpc.lims.id
  cidr_block = "10.0.2.0/24"
  zone_id    = "cn-beijing-a"
}

# ACK (阿里云 K8s)
resource "alicloud_cs_managed_kubernetes" "lims" {
  name                 = "lims-k8s"
  cluster_spec         = "ack.pro.small"
  vswitch_ids          = [alicloud_vswitch.lims_private.id]
  new_nat_gateway      = true
  pod_cidr             = "172.16.0.0/16"
  service_cidr         = "172.17.0.0/16"
  slb_internet_enabled = true
  
  addons {
    name = "logtail-ds"
  }
  addons {
    name = "metrics-server"
  }
}

# RDS PostgreSQL
resource "alicloud_db_instance" "lims_pg" {
  instance_name  = "lims-pg"
  engine         = "PostgreSQL"
  engine_version = "16.0"
  instance_type  = "pg.n2.medium.2c"
  storage_type   = "cloud_essd"
  storage_size   = 100
  
  vswitch_id = alicloud_vswitch.lims_private.id
  security_ips = ["10.0.0.0/16"]
  
  tags = {
    Environment = "production"
    Project     = "lims-expert"
  }
}

# Redis
resource "alicloud_redis_instance" "lims" {
  instance_name  = "lims-redis"
  engine         = "Redis"
  engine_version = "7.0"
  instance_type  = "redis.cluster.sharding.small.1-node"
  shards         = 3
  
  vswitch_id = alicloud_vswitch.lims_private.id
}

# OSS（异地备份）
resource "alicloud_oss_bucket" "lims_backup" {
  bucket = "lims-backup-prod"
  acl    = "private"
  
  redundancy_type = "ZRS"
  
  lifecycle_rule {
    name = "expire-old-backups"
    enabled = true
    expiration {
      days = 365
    }
  }
}
```

### 6.2 部署命令

```bash
# 初始化
cd infrastructure/terraform
terraform init

# 计划
terraform plan -out=tfplan

# 应用
terraform apply tfplan

# 销毁（小心！）
terraform destroy
```

## 7. 灾备

### 7.1 灾备架构

```mermaid
graph LR
    Main[生产环境<br/>北京] --> Backup1[异地备份<br/>上海 OSS]
    Main --> Backup2[异地备份<br/>广州 OSS]
    Backup1 --> DR[灾备中心<br/>杭州]
    Backup2 --> DR
    DR --> Activate[DR 演练]
```

### 7.2 RTO / RPO

| 等级 | RTO | RPO | 触发条件 |
|---|---|---|---|
| **L1 严重** | 4 h | 1 h | 主库宕机 |
| **L2 中等** | 24 h | 4 h | 主区域故障 |
| **L3 轻微** | 72 h | 24 h | 数据损坏 |

### 7.3 灾备演练

- 每季度 1 次
- 全量恢复演练
- 业务连续性测试
- 报告归档

## 8. 运维手册

### 8.1 常用命令

```bash
# 查看服务状态
kubectl get pods -n lims-prod

# 重启服务
kubectl rollout restart deployment/backend -n lims-prod

# 查看日志
kubectl logs -f deployment/backend -n lims-prod --tail=100

# 进入容器调试
kubectl exec -it pod/backend-xxx -n lims-prod -- /bin/sh

# 数据库连接
psql -h pg-host -U lims -d lims

# 备份
/opt/lims/scripts/backup.sh

# 恢复
/opt/lims/scripts/restore.sh /backups/lims-full-20260803_020000.sql.gz.enc

# 验证审计链
node scripts/verify-audit-chain.js
```

### 8.2 故障 Runbook

详见 `docs/runbooks/` 目录（待生成）：
- `postgres-down.md`
- `redis-down.md`
- `minio-down.md`
- `backend-crashloop.md`
- `audit-chain-broken.md`

## 9. 附录

- [架构设计](01-ARCHITECTURE.md)
- [数据库设计](02-DATABASE.md)
- [API 规范](03-API.md)
- [CNAS 合规](04-CNAS-COMPLIANCE.md)
- [实施路线图](06-ROADMAP.md)

# =====================================================
# K8s 部署清单 — Phase 1 Task 2.4
# 架构映射: L6 基础设施架构(ADR-0008 kind/k3d)
# 状态: ⚠️ 待 staging 环境验证(本机无 kind/k3d 集群)
# =====================================================

## 文件清单

| 文件 | 内容 |
|---|---|
| 00-namespace.yaml | namespace lims + 资源配额 |
| 10-backend.yaml | 后端 Deployment(2 副本/滚动发布/健康检查)+ Service |
| 20-postgres-redis.yaml | PostgreSQL StatefulSet(PVC 20Gi)+ Redis Deployment |
| 30-frontend-ingress.yaml | 前端 Deployment + Ingress(TLS) |
| ../monitoring/prometheus.yml | Prometheus 抓取配置 |

## 部署前置

1. kind/k3d 集群(kind create cluster --name lims)
2. ingress-nginx 控制器
3. Secret `lims-env`(namespace lims):
   ```bash
   kubectl create secret generic lims-env -n lims \
     --from-literal=DATABASE_URL='postgresql://dunhuang:xxx@lims-postgres:5432/dunhuang_lims' \
     --from-literal=REDIS_URL='redis://lims-redis:6379' \
     --from-literal=JWT_SECRET='<openssl rand -base64 48>' \
     --from-literal=JWT_REFRESH_SECRET='<openssl rand -base64 48>' \
     --from-literal=PG_PASSWORD='xxx'
   ```
4. 镜像: registry.local/dunhuang-lims-backend:latest(CI 构建推送)

## 应用顺序

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 20-postgres-redis.yaml   # 先数据层
kubectl apply -f 10-backend.yaml
kubectl apply -f 30-frontend-ingress.yaml
```

## 验证清单(待 staging)

- [ ] pod 全部 Running(backend 2 副本)
- [ ] /health/ready 返回 ok(PG/Redis 探活)
- [ ] /health/deep 组件明细正常(含审计链状态)
- [ ] Ingress 访问 https://lims.example.com 正常
- [ ] 滚动发布测试(镜像更新零中断)
- [ ] 数据持久化(PVC 重启不丢)

## 生产注意(Phase 4+)

- PostgreSQL 主备(建议 Operator / Patroni)
- Redis 哨兵或集群模式
- Secret 用 External Secrets / Vault
- 等保 2.0: 网络策略 + 审计日志采集

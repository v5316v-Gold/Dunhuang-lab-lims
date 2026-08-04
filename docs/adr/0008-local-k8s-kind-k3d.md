# ADR-0008:本地 K8s = kind / k3d

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ DevOps
> **影响范围**: 本地开发、CI/CD、部署一致性

## 背景

敦煌金质检 LIMS 最终部署到生产 K8s(阿里云 ACK / 华为云 CCE),但本地开发必须有一个**接近生产**的 K8s 环境,用于:

1. **本地测试 K8s 特性**:Ingress / ConfigMap / Secret / PVC / Service
2. **本地测试 Helm Chart 渲染**
3. **本地测试 CI/CD 流程**
4. **离线开发**(无需连云)
5. **性能 / 负载测试**(本地起 1000 并发)

可选方案:

| 方案 | 资源占用 | 启动速度 | 与生产 K8s 兼容性 | 推荐 |
|---|---|---|---|---|
| **Minikube** | 中(2GB+) | 慢(3-5 分钟) | ⭐⭐⭐ | ⚠️ |
| **kind(K8s in Docker)** | 低(1GB+) | 快(< 1 分钟) | ⭐⭐⭐ | ✅ |
| **k3d(k3s in Docker)** | 极低(< 500MB) | 极快(< 30 秒) | ⭐⭐⭐ | ✅ |
| **k3s(原生)** | 低(512MB) | 中(1-2 分钟) | ⭐⭐ | ⚠️ |
| **Docker Compose** | 低 | 快 | ❌ 不是 K8s | ❌ |
| **直接连阿里云 ACK** | 0 | N/A | ⭐⭐⭐ | ❌ 成本高 |

## 决策

**本地 K8s = kind(K8s in Docker)用于 CI/压测,k3d(k3s in Docker)用于日常开发**。

### 双轨制

| 场景 | 工具 | 原因 |
|---|---|---|
| **日常开发** | k3d | 启动快(< 30 秒);资源占用低;支持多节点 |
| **CI / 压测** | kind | 与上游 K8s 100% 一致;支持多节点 + Ingress + LoadBalancer |
| **生产** | 阿里云 ACK | CNAS 审核员接受;高可用;异地容灾 |

### kind 配置示例

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
      - containerPort: 443
        hostPort: 443
  - role: worker
  - role: worker
  - role: worker
```

```bash
# 创建 kind 集群
kind create cluster --config kind-config.yaml --name lims-dev

# 部署 LIMS
kubectl apply -k infrastructure/k8s/overlays/dev

# 验证
kubectl get pods -n lims
```

### k3d 配置示例

```bash
# 创建 k3d 集群(开发用)
k3d cluster create lims-dev \
  --port 80:80@loadbalancer \
  --port 443:443@loadbalancer \
  --agents 2 \
  --registry-config registries.yaml

# 部署
kubectl apply -k infrastructure/k8s/overlays/dev

# 查看
k3d cluster list
```

### CI 中使用 kind

```yaml
# .github/workflows/ci.yml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create kind cluster
        run: |
          kind create cluster --config tests/k8s/kind-config.yaml --wait 60s
          kubectl cluster-info
      - name: Deploy LIMS
        run: |
          kubectl apply -k infrastructure/k8s/overlays/dev
          kubectl wait --for=condition=ready pod -l app=lims-backend -n lims --timeout=120s
      - name: Run E2E tests
        run: pnpm playwright test
      - name: Cleanup
        if: always()
        run: kind delete cluster --name lims-test
```

## 理由

### 为什么 kind + k3d 双轨(而非只用一种)

| 维度 | kind | k3d |
|---|---|---|
| **与上游 K8s 一致** | ✅ 100%(用 kubeadm) | ⚠️ k3s(轻量级,有差异) |
| **启动速度** | ⚠️ 慢(60 秒) | ✅ 极快(15 秒) |
| **资源占用** | ⚠️ 高(1GB+) | ✅ 低(< 500MB) |
| **多节点** | ✅ | ✅ |
| **Ingress 支持** | ✅ | ✅ |
| **LoadBalancer** | ⚠️ 需 cloud-provider | ✅ 内置 |
| **生产一致性** | ✅ | ⚠️ k3s 与生产 K8s 有小差异 |

**取舍**:
- 日常开发(快迭代)= k3d
- CI / 压测(生产一致性)= kind

### 为什么不用 Minikube

- Minikube 启动慢(3-5 分钟)
- 资源占用大(2GB+)
- 与生产 K8s 兼容性相同
- kind / k3d 已足够

### 为什么不用 Docker Compose

- Docker Compose 不是 K8s,无法测试 K8s 特性
- 生产用 K8s,本地用 Compose = 环境差异
- CNAS 审核员会问"为什么开发与生产不一致"

### 为什么不用直接连阿里云 ACK

- 成本高(开发也需要按量付费)
- 调试不便(网络延迟)
- 离线开发不可行
- 团队成员各自连云 = 资源浪费

## 替代方案

### 备选 1:只用 Minikube
- **优势**: 主流
- **拒绝理由**: 启动慢;资源占用大;kind/k3d 更现代

### 备选 2:只用 k3d
- **优势**: 启动极快
- **拒绝理由**: CI 中与生产 K8s 可能有差异

### 备选 3:只用 kind
- **优势**: 与生产 100% 一致
- **拒绝理由**: 启动慢;日常开发体验差

### 备选 4:直接连阿里云 ACK
- **优势**: 真实环境
- **拒绝理由**: 成本高;调试不便;离线不可行

### 备选 5:Docker Compose
- **优势**: 简单
- **拒绝理由**: 不是 K8s;环境不一致

## 影响

### 正面影响
- ✅ **本地接近生产**:kind 与上游 K8s 100% 一致
- ✅ **离线开发**:无需连云
- ✅ **CI 友好**:kind 在 GitHub Actions 中跑通
- ✅ **成本低**:本机资源消耗小

### 负面影响 + 缓解
- ⚠️ **本机需 Docker**:缓解:Docker Desktop 标配
- ⚠️ **kind / k3d 学习成本**:缓解:`CONTRIBUTING.md` 详细说明
- ⚠️ **生产仍需阿里云 ACK**:缓解:Helm Chart 通用,本地测试过的镜像直接部署

### 关键约束

1. **Helm Chart / Kustomize 通用**:同一份 manifest 在 kind / k3d / 阿里云 ACK 都能跑
2. **本地不模拟云厂商特性**:如 ACK 的 SLB / RDS 不在本地模拟(用本地替代)
3. **压测用 kind 多 worker**:模拟生产多节点
4. **CI 用 ephemeral kind cluster**:每次 PR 创建新集群,跑完销毁

## 验证标准

- [ ] `kind create cluster` < 60 秒
- [ ] `k3d cluster create` < 30 秒
- [ ] LIMS 在 kind / k3d 部署成功
- [ ] 1000 并发压测在 kind 多节点跑通
- [ ] CI 中 ephemeral kind 集群 + E2E 测试通过
- [ ] Helm Chart / Kustomize 在 3 个环境(kind / k3d / ACK)渲染一致

## 相关决策

- ADR-0001: Monorepo
- ADR-0002: NestJS + Prisma + PG

## 参考

- [kind 官方文档](https://kind.sigs.k8s.io/)
- [k3d 官方文档](https://k3d.io/)
- [本地 K8s 工具对比](https://www.cncf.io/blog/2021/04/05/k8s-development-tools/)
- [阿里云 ACK 文档](https://help.aliyun.com/product/85222.html)
# 敦煌金质检 LIMS(专家级)

> **CNAS 合规 · 实验室信息管理系统 · 专家级架构**
> 基于 ISO/IEC 17025:2017 + CNAS-CL01:2018 + 21 CFR Part 11 标准设计
> **业务核心**: 贵金属(黄金)检测 —— 火试金法 + ICP-OES/MS

---

## 🎯 项目愿景

构建**专家级** LIMS 系统,支撑敦煌金质检中心(黄金检测为主)的检测业务、质量控制、合规管理、数据分析,实现 CNAS 实验室认可 + ALCOA+ 数据完整性 + 完整审计追溯。

### 业务画像(给 CNAS 审核员看)

| 项 | 内容 |
|---|---|
| **机构** | 敦煌金质检中心(DunHuangGold Quality Inspection Center) |
| **核心业务** | 黄金纯度检测、贵金属杂质分析 |
| **核心方法** | 火试金法(Fire Assay,GB/T 9288) + ICP-OES/MS(GB/T 21198) |
| **应用领域** | 上海黄金交易所交割、矿山、冶炼厂、首饰制造、回收金料 |
| **数据法律效力** | 检测报告 = 黄金交易结算凭证 |

详见 [ADR-0011 贵金属检测业务约束](./docs/adr/0011-precious-metal-business.md)。

---

## 📁 目录结构

```
Dunhuang-lab-lims-main/
├── README.md                 # 本文件 - 项目入口
├── CONTRIBUTING.md           # 开发规范
├── apps/                     # 应用代码
│   ├── backend/              # NestJS 10 后端
│   └── frontend/             # React 18 前端
├── packages/                 # 共享包
│   ├── shared-types/         # 跨前后端 TS 类型 + Zod
│   ├── ui-kit/               # 业务组件库(基于 Ant Design)
│   ├── compliance-core/      # 合规核心(审计/签名/ALCOA+)
│   └── config/               # 共享配置
├── infrastructure/           # Docker / K8s / Terraform
│   ├── docker/
│   ├── k8s/
│   └── terraform/
├── scripts/                  # 工具脚本
│   ├── audit-verify.ts       # 审计链完整性验证(关键合规)
│   ├── backup.sh             # 备份策略
│   └── restore.sh            # 恢复演练
├── tests/
│   ├── e2e/                  # Playwright E2E
│   ├── integration/          # Supertest 集成测试
│   ├── load/                 # k6 压测
│   └── compliance/           # CNAS 自检脚本
└── docs/
    ├── 00-PROJECT-PLAN.md    # 项目总览
    ├── 01-ARCHITECTURE.md    # 8 层架构设计(v2.0)
    ├── 02-DATABASE.md        # 数据库设计
    ├── 03-API.md             # API 规范
    ├── 04-CNAS-COMPLIANCE.md # CNAS 合规设计(v2.0)
    ├── 05-DEPLOYMENT.md      # 部署架构
    ├── 06-ROADMAP.md         # 13 周路线图(v2.0)
    ├── adr/                  # 🆕 架构决策记录(11 份)
    │   ├── README.md
    │   ├── 0001-monorepo-turborepo.md
    │   ├── 0002-nestjs-prisma-pg.md
    │   ├── 0003-audit-chain-pg-trigger.md
    │   ├── 0004-ca-third-party.md
    │   ├── 0005-xstate-redundant-db.md
    │   ├── 0006-pdf-puppeteer-minio.md
    │   ├── 0007-mvp-slice-not-12months.md
    │   ├── 0008-local-k8s-kind-k3d.md
    │   ├── 0009-jwt-refresh-totp-self-hosted.md
    │   ├── 0010-pwa-indexeddb-lww.md
    │   └── 0011-precious-metal-business.md
    ├── migration/            # 🆕 13 周执行手册
    │   ├── EXECUTION-PLAN.md
    │   ├── PHASE-0-baseline.md
    │   ├── PHASE-1-infra.md
    │   ├── PHASE-2-mvp-slice.md
    │   ├── PHASE-3-horizontal.md
    │   ├── PHASE-4-compliance.md
    │   └── PHASE-5-cnas-audit.md
    └── archive/              # 旧文档归档
        ├── 06-ROADMAP-12months-original.md
        ├── CNAS_GAP_ANALYSIS.md
        └── LIMS_SKILL_BENCHMARK.md
```

---

## 🚀 当前阶段

**Phase 1 - 架构文档**(已完成 v2.0 校准)

**Phase 2+ - 代码实现**(待启动)

详见 [docs/06-ROADMAP.md](./docs/06-ROADMAP.md) 和 [docs/migration/EXECUTION-PLAN.md](./docs/migration/EXECUTION-PLAN.md)。

---

## 🛠️ 技术栈

| 层 | 选型 | 决策 |
|---|---|---|
| **Monorepo** | pnpm + Turborepo | [ADR-0001](./docs/adr/0001-monorepo-turborepo.md) |
| **后端** | NestJS 10 + TypeScript 5 | [ADR-0002](./docs/adr/0002-nestjs-prisma-pg.md) |
| **数据库** | PostgreSQL 16 + TimescaleDB | [ADR-0002](./docs/adr/0002-nestjs-prisma-pg.md) |
| **ORM** | Prisma 5 | [ADR-0002](./docs/adr/0002-nestjs-prisma-pg.md) |
| **审计链** | PG 触发器 SHA256 | [ADR-0003](./docs/adr/0003-audit-chain-pg-trigger.md) |
| **电子签名** | 第三方 CA + 时间戳 | [ADR-0004](./docs/adr/0004-ca-third-party.md) |
| **状态机** | XState 5 + DB 字段冗余 | [ADR-0005](./docs/adr/0005-xstate-redundant-db.md) |
| **报告 PDF** | Puppeteer + MinIO | [ADR-0006](./docs/adr/0006-pdf-puppeteer-minio.md) |
| **认证** | JWT + Refresh + TOTP | [ADR-0009](./docs/adr/0009-jwt-refresh-totp-self-hosted.md) |
| **前端** | React 18 + TypeScript 5 + Vite 5 | 主流 |
| **UI 库** | Ant Design 5 + ECharts 5 | 主流 |
| **缓存** | Redis 7 | 主流 |
| **文件** | MinIO (S3 兼容) | 主流 |
| **离线** | PWA + IndexedDB + LWW | [ADR-0010](./docs/adr/0010-pwa-indexeddb-lww.md) |
| **本地 K8s** | kind / k3d | [ADR-0008](./docs/adr/0008-local-k8s-kind-k3d.md) |
| **监控** | Prometheus + Grafana + Loki + Tempo | 主流 |
| **CI/CD** | GitHub Actions + ArgoCD | 主流 |

---

## 📚 文档导航(按角色)

### 🆕 给架构师 / 新人

1. [00-PROJECT-PLAN.md](./docs/00-PROJECT-PLAN.md) - 项目总览
2. [01-ARCHITECTURE.md](./docs/01-ARCHITECTURE.md) - 8 层架构
3. [docs/adr/README.md](./docs/adr/README.md) - 11 份 ADR(所有"为什么")
4. [06-ROADMAP.md](./docs/06-ROADMAP.md) - 13 周路线图

### 🆕 给开发者

1. [EXECUTION-PLAN.md](./docs/migration/EXECUTION-PLAN.md) - 13 周执行计划
2. [PHASE-0-baseline.md](./docs/migration/PHASE-0-baseline.md) ~ [PHASE-5-cnas-audit.md](./docs/migration/PHASE-5-cnas-audit.md) - 各阶段任务清单
3. [CONTRIBUTING.md](./CONTRIBUTING.md) - 开发规范

### 🆕 给 DBA

1. [02-DATABASE.md](./docs/02-DATABASE.md) - 60+ 表设计
2. ADR-0011 - 业务约束(Decimal / 批次 / 多元素)
3. ADR-0003 - 审计链触发器

### 🆕 给前端

1. [01-ARCHITECTURE.md §3](./docs/01-ARCHITECTURE.md) - 前端 4 层架构
2. [03-API.md](./docs/03-API.md) - API 规范
3. ADR-0010 - PWA 离线

### 🆕 给 CNAS 审核员

1. [04-CNAS-COMPLIANCE.md](./docs/04-CNAS-COMPLIANCE.md) - 合规设计(v2.0 含快速索引)
2. [docs/CNAS-SELF-CHECK.md](./docs/CNAS-SELF-CHECK.md)(Phase 4 输出)
3. ADR-0011 - 业务约束

---

## 🏆 关键特性

- ✅ **CNAS / ISO 17025** 全合规
- ✅ **ALCOA+** 数据完整性 9 原则
- ✅ **SHA256 审计链**(PG 触发器)
- ✅ **电子签名**(CA 证书 + 时间戳)
- ✅ **6σ + Westgard** 质量控制
- ✅ **多级审核**(检测 → 校核 → 审核 → 批准)
- ✅ **火试金 + ICP** 双方法支持
- ✅ **多设备支持**(PC / 移动 / PWA)
- ✅ **离线操作**(采样现场无网络)

---

## 📊 状态

| 项 | 状态 |
|---|---|
| 架构文档(v2.0) | ✅ 7/7 + 11 ADR + 6 阶段手册完成 |
| 后端代码 | ⏳ Phase 0 待启动 |
| 前端代码 | ⏳ Phase 0 待启动 |
| 数据库迁移 | ⏳ Phase 1 待启动 |
| CNAS 认证 | ⏳ W13(2026-11)提交申请 |

---

## 📜 许可证

本项目为内部研发,保留所有权利。

---

**版本**: v2.0.0
**最后更新**: 2026-08-04
**维护团队**: 敦煌金质检 IT 部 + 天枢(架构师)
**业务负责**: 菩提老祖

---

## 快速启动(Phase 0 启动后可用)

```bash
# 克隆仓库
git clone https://github.com/dunhuang-gold/dunhuang-lab-lims.git
cd dunhuang-lab-lims

# 安装依赖
pnpm install

# 启动开发环境
pnpm dev
# 后端:http://localhost:3000
# 前端:http://localhost:5173
# Swagger UI:http://localhost:3000/api/docs

# 启动基础设施
docker compose up -d

# 数据库迁移
cd apps/backend
pnpm prisma migrate dev
pnpm prisma db seed
```

> Phase 0 启动后将填充此节。详见 [PHASE-0-baseline.md](./docs/migration/PHASE-0-baseline.md)。
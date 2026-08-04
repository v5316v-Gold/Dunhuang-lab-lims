# 架构决策记录(Architecture Decision Records)

> **目的**: 记录所有重大技术决策的"为什么",避免 CNAS 审核时无法回答"为什么选 X"。
> **来源**: Michael Nygard 的 ADR 模板
> **维护**: 每次重大决策必增 ADR;每月评审 ADR 有效性

## 索引

| 编号 | 标题 | 状态 | 日期 |
|---|---|---|---|
| [ADR-0001](./0001-monorepo-turborepo.md) | 采用 Monorepo + pnpm + Turborepo | ✅ Accepted | 2026-08-04 |
| [ADR-0002](./0002-nestjs-prisma-pg.md) | 保留 NestJS 10 + Prisma 5 + PostgreSQL 16 | ✅ Accepted | 2026-08-04 |
| [ADR-0003](./0003-audit-chain-pg-trigger.md) | 审计链 = PG 触发器(非应用层) | ✅ Accepted | 2026-08-04 |
| [ADR-0004](./0004-ca-third-party.md) | 电子签名 = 第三方 CA 服务 | ✅ Accepted | 2026-08-04 |
| [ADR-0005](./0005-xstate-redundant-db.md) | 状态机 = XState + DB 字段冗余 | ✅ Accepted | 2026-08-04 |
| [ADR-0006](./0006-pdf-puppeteer-minio.md) | 报告 PDF = Puppeteer + MinIO + 时间戳 | ✅ Accepted | 2026-08-04 |
| [ADR-0007](./0007-mvp-slice-not-12months.md) | MVP 切片优先(13 周而非 12 月) | ✅ Accepted | 2026-08-04 |
| [ADR-0008](./0008-local-k8s-kind-k3d.md) | 本地 K8s = kind / k3d | ✅ Accepted | 2026-08-04 |
| [ADR-0009](./0009-jwt-refresh-totp-self-hosted.md) | 认证 = JWT + Refresh + TOTP(自建) | ✅ Accepted | 2026-08-04 |
| [ADR-0010](./0010-pwa-indexeddb-lww.md) | PWA 离线 + IndexedDB + LWW | ✅ Accepted | 2026-08-04 |
| [ADR-0011](./0011-precious-metal-business.md) | 贵金属检测业务约束(火试金 + ICP) | ✅ Accepted | 2026-08-04 |

## 决策状态说明

- **Proposed**: 提出,待评审
- **Accepted**: 已接受,正在执行
- **Deprecated**: 已过时(被新 ADR 取代)
- **Superseded**: 已被 ADR-XXXX 取代

## 评审流程

1. 提出 ADR(Proposed)→ 在周评审会议讨论
2. 架构师 + 实验室主任 + 质量负责人三方同意 → Accepted
3. 一旦 Accepted,**不可随意更改**;若需变更,必须提出新 ADR 引用旧 ADR
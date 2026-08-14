# 架构规范文档索引 (Architecture Documentation Index)

> **项目**: 敦煌金质检 LIMS
> **版本**: v1.1 | 2026-08-13(全 10 层完成)

---

## 分层架构规范(L0 → L8)✅ 全部完成

| 层级 | 文档 | 状态 | 大小 | 内容 |
|---|---|---|---|---|
| 总纲 | [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) | ✅ | 28 KB | 分层编写执行方案 |
| 模板 | [TEMPLATE.md](./TEMPLATE.md) | ✅ | 4 KB | 20 字段统一模板 |
| **L0** | [L0-project-architecture.md](./L0-project-architecture.md) | ✅ | 8.4 KB | 项目架构(章程/治理/里程碑) |
| **L0.5** | [L0.5-domain-architecture.md](./L0.5-domain-architecture.md) | ✅ | 11.2 KB | 领域架构(10 限界上下文/聚合/事件) |
| **L1** | [L1-business-architecture.md](./L1-business-architecture.md) | ✅ | 10.4 KB | 业务架构(10 步主流程/角色矩阵) |
| **L2** | [L2-compliance-architecture.md](./L2-compliance-architecture.md) | ✅ | 11.2 KB | 合规架构(条款矩阵/ALCOA+/SoD) |
| **L3** | [L3-data-architecture.md](./L3-data-architecture.md) | ✅ | 8.9 KB | 数据架构(30 表/生命周期/备份) |
| **L4** | [L4-application-architecture.md](./L4-application-architecture.md) | ✅ | 8.3 KB | 应用架构(模块/API/状态机) |
| **L5** | [L5-technology-architecture.md](./L5-technology-architecture.md) | ✅ | 6.7 KB | 技术架构(25+ 组件选型) |
| **L6** | [L6-infrastructure-architecture.md](./L6-infrastructure-architecture.md) | ✅ | 6.6 KB | 基础设施架构(拓扑/备份/等保) |
| **L7** | [L7-validation-architecture.md](./L7-validation-architecture.md) | ✅ | 6.2 KB | 验证架构(GAMP 5/测试策略) |
| **L8** | [L8-operations-architecture.md](./L8-operations-architecture.md) | ✅ | 6.6 KB | 运维架构(监控/事件/SLA) |

**模板一致性检查**: 10/10 层 20 字段全 PASS(2026-08-13 校验)
**合计**: 约 92 KB / 11 份文档

---

## 既有文档引用关系

| 既有文档 | 作为哪层的输入 |
|---|---|
| `docs/00-PROJECT-PLAN.md` | L0 输入 |
| `docs/01-ARCHITECTURE.md` | L0-L8 总览 |
| `docs/02-DATABASE.md` | L3 输入 |
| `docs/03-API.md` | L4 输入 |
| `docs/04-CNAS-COMPLIANCE.md` | L2 输入 |
| `docs/05-DEPLOYMENT.md` | L6 输入 |
| `docs/validation/` (VMP/FMEA/Periodic Review) | L7/L8 输入 |
| `docs/PROJECT-STATUS.md` | L0 输入 |
| `docs/adr/`(11 个 ADR) | L0.5-L6 决策依据 |

---

## 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布(执行方案 + 模板) | LIMS-Architect-01 |
| v1.1 | 2026-08-13 | 全 10 层(L0-L8)完成,模板检查 PASS | LIMS-Architect-01 |

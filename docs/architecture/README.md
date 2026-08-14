# 架构规范文档索引 (Architecture Documentation Index)

> **项目**: 敦煌金质检 LIMS
> **版本**: v1.0 | 2026-08-13

---

## 分层架构规范(L0 → L8)

| 层级 | 文档 | 状态 | 内容 |
|---|---|---|---|
| **L0** | [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) | ✅ 定稿 | 分层编写执行方案(总纲) |
| 模板 | [TEMPLATE.md](./TEMPLATE.md) | ✅ 定稿 | 20 字段统一模板 |
| **L0** | L0-project-architecture.md | ⏳ 待编写 | 项目架构(章程/治理) |
| **L0.5** | L0.5-domain-architecture.md | ⏳ 待编写 | 领域架构(DDD) |
| **L1** | L1-business-architecture.md | ⏳ 待编写 | 业务架构(流程/组织) |
| **L2** | L2-compliance-architecture.md | ⏳ 待编写 | 合规架构(CNAS/ALCOA+) |
| **L3** | L3-data-architecture.md | ⏳ 待编写 | 数据架构(模型/字典) |
| **L4** | L4-application-architecture.md | ⏳ 待编写 | 应用架构(模块/API) |
| **L5** | L5-technology-architecture.md | ⏳ 待编写 | 技术架构(选型) |
| **L6** | L6-infrastructure-architecture.md | ⏳ 待编写 | 基础设施架构(部署/灾备) |
| **L7** | L7-validation-architecture.md | ⏳ 待编写 | 验证架构(CSV) |
| **L8** | L8-operations-architecture.md | ⏳ 待编写 | 运维架构(运营/监控) |

**执行顺序**: L0 → L0.5 → L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8(严格顺序,每层 Gate 验收)

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

---

## 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布 | LIMS-Architect-01 |

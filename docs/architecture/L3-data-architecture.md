# L3-数据架构 架构规范 (Data Architecture)

> **版本**: v1.0
> **日期**: 2026-08-13
> **编制**: LIMS-Architect-01(架构规范工程师)
> **评审**: 后端 Lead、DBA
> **批准**: QA Manager
> **状态**: 草案
> **模板依据**: `docs/architecture/TEMPLATE.md` v1.0

---

## 1. 节点名称

**L3-数据架构**(Data Architecture / 数据模型与数据治理)

## 2. 建设目标

1. 固化 **30 表 ER 模型**与数据字典(对齐 schema.prisma)
2. 定义**数据生命周期**(创建→使用→软删除→归档→销毁)
3. 定义**数据完整性约束**(唯一/外键/审计链/软删除)
4. 定义**归档与备份策略**(3-2-1,保留 ≥ 5 年)
5. 定义**数据访问原则**(权限 + 审计)
6. 为 L4 应用层数据访问、L6 备份实现提供规格

## 3. 业务范围

- **In-scope**:
  - 全部业务表(30)+ 枚举(18)+ 索引(113)
  - 审计链表(audit_logs)+ 触发器(27 + 3)
  - 软删除机制(7 模型)
  - 数据归档/备份/恢复
- **Out-of-scope**:
  - 技术选型细节 → 归 L5
  - 基础设施备份执行 → 归 L6
  - 运维恢复演练 → 归 L8

## 4. 背景

schema.prisma 已定义 30 模型 + 18 枚举;baseline migration(20260813_baseline)已实盘 deploy 验证(空库 31 表 + 113 索引 + 197 函数);softdelete migration 已应用(sample_batches.deleted_at)。本层将数据库设计**规范化为架构文档**,作为 L4 数据访问与 L6 备份的契约。

## 5. 参与角色

| 角色 | 职责 | 编写/评审/批准 |
|---|---|---|
| 后端 Lead | schema 维护、迁移管理 | 评审 |
| DBA | 索引/性能/归档评审 | 评审 |
| LIMS-Architect-01(架构师) | 本层编写 | 编写 |
| QA Manager | 数据完整性验收 | 批准 |

## 6. 输入 - 输出

| 方向 | 来源/去向 | 内容 |
|---|---|---|
| 输入 | L0.5 聚合 + L2 合规(保留/防篡改)+ `schema.prisma` + 2 migrations | 模型、规则、现状 |
| 输出 | L4 应用架构(数据访问)+ L6(备份) | 数据字典、生命周期、归档策略 |

## 7. 前置后置条件

- **前置**: L2 GATE PASS(数据保留/防篡改规则确认)
- **后置**: 数据字典与 schema.prisma 100% 对齐、生命周期定义完整

## 8. 业务流程

数据流(文字描述):

```
写入(应用层 → Prisma → PG,触发审计 trigger)
  → 使用(查询/更新,软删除过滤)
  → 软删除(deletedAt = now(),业务记录)
  → 归档(>1 年数据转归档存储)
  → 销毁(>5 年,审计记录)
```

备份流:每日 WAL + 每周全量 → 3-2-1 存储(本地+异地+离线)。

## 9. 状态机

### 9.1 记录生命周期

| 状态 | 含义 | 进入事件 | 离开事件(目标) | 守卫条件 |
|---|---|---|---|---|
| ACTIVE | 活跃 | create | delete() → SOFT-DELETED | 软删除 extension |
| SOFT-DELETED | 软删除 | 软删除 | 归档任务 → ARCHIVED | 超过 1 年 |
| ARCHIVED | 归档 | 归档任务 | 销毁任务 → PURGED | 超过 5 年 |
| PURGED | 销毁 | 销毁任务 | — | 审计记录保留 |

### 9.2 数据表状态

| 表 | 状态 | 说明 |
|---|---|---|
| 30 业务表 | ✅ 已建 | baseline migration |
| audit_logs | ✅ 已建 + 防篡改 | 3 trigger |
| _prisma_migrations | ✅ 已建 | 2 条迁移记录 |

## 10. 数据模型

### 10.1 30 表清单(按 L0.5 上下文)

| 上下文 | 表 | 关键字段 |
|---|---|---|
| 身份组织 | users / departments / personnel / trainings / competencies / user_role_assignments / user_sessions | username 唯一、role、status |
| 设备 | equipment / maintenances / calibrations / periodic_checks | 设备状态、校准日期 |
| 试剂 | reagents / reagent_lots / reagent_usages / reference_materials | 效期、批号、库存 |
| 方法 | methods / method_validations | method_code 唯一 |
| 样品 | samples | sampleNo 唯一 |
| 批次 | sample_batches | batchNo 唯一 |
| 检测 | tests / fire_assay_details / element_results | 结果、纯度 |
| QC | qc_measurements | 测量值、判定 |
| 报告 | reports / report_stages / report_signatures / file_attachments | 报告号唯一 |
| EHS | hazards / emergency_plans | 风险等级 |
| 审计 | audit_logs | prev_hash/curr_hash |

### 10.2 关系要点

- samples.batch_id → sample_batches.id(FK)
- samples.method_id → methods.id
- tests.sample_id → samples.id;tests.batch_id → sample_batches.id
- fire_assay_details.test_id → tests.id(1:1)
- element_results.test_id → tests.id(1:N)
- reports.sample_id → samples.id
- report_signatures.report_id → reports.id(1:N)
- audit_logs.user_id → users.id(FK,可空)

## 11. 字段(数据字典核心)

| 字段 | 类型 | 必填 | 默认 | 约束/说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键(全表) |
| created_at | timestamptz | 是 | now() | 全表 |
| updated_at | timestamptz | 是 | — | 全表,应用写入 |
| deleted_at | timestamptz | 否 | null | 7 表软删除 |
| sample_no | varchar(20) | 是 | — | 唯一,YYMMDD-NNNN |
| batch_no | varchar(30) | 是 | — | 唯一 |
| method_code | varchar(50) | 是 | — | 唯一 |
| username / email | varchar | 是 | — | 唯一 |
| purity_pct | decimal(15,9) | 否 | — | 火试金纯度 |
| weight_g | decimal(15,6) | 是 | — | 称样量 |
| prev_hash / curr_hash | char(64) | 是 | — | audit_logs |

完整字典:30 表 × 字段见 `docs/02-DATABASE.md` 与 schema.prisma(单一真源)。

## 12. 业务规则

| 编号 | 规则 | 来源 | 可测试性 |
|---|---|---|---|
| BR-DATA-01 | 业务表禁止物理删除(7 模型软删除) | L2 BR-C-03 | soft-delete.spec(✅) |
| BR-DATA-02 | audit_logs 禁止 UPDATE/DELETE/TRUNCATE | ALCOA+ | audit-compliance.spec(✅) |
| BR-DATA-03 | 时间统一 timestamptz 存储 | 一致性 | schema 检查 |
| BR-DATA-04 | 唯一业务编号(sampleNo/batchNo/reportNo) | 业务 | schema unique 约束 |
| BR-DATA-05 | 数据保留 ≥ 5 年,归档 > 1 年 | CNAS §8.4 | 归档策略 |
| BR-DATA-06 | 备份 3-2-1(本地+异地+离线) | 灾备 | L6 演练 |
| BR-DATA-07 | 金额/结果用 Decimal 不用 float | 精度 | Decimal 类型 |
| BR-DATA-08 | 迁移必须经 prisma migrate 管理 | 可追溯 | _prisma_migrations |

## 13. 异常处理

| 异常场景 | 检测方式 | 响应策略 |
|---|---|---|
| 迁移失败 | prisma migrate 报错 | 回滚/修复 SQL/重试 |
| 唯一约束冲突 | Prisma P2002 | 业务错误提示 + 重编号 |
| 外键约束失败 | Prisma P2003 | 业务错误提示 |
| 审计链断链 | verify 端点 | P1 告警 + 调查 |
| 备份校验失败 | 备份任务 | 重试 + 告警 |
| 归档失败 | 归档任务 | 重试 + 保留原数据 |

## 14. RBAC 要求

| 数据域 | 检测员 | 质量经理 | 授权签字人 | 管理员 |
|---|---|---|---|---|
| 样品/批次 | 读/写 | 读 | 读 | 全部 |
| 检测结果 | 读/写 | 读 | 读 | 全部 |
| QC | 录入 | 审核 | 读 | 全部 |
| 报告 | 起草 | 审核 | 签发 | 全部 |
| 审计数据 | 只读 | 读 | 读 | 读(不可改) |
| 用户管理 | ❌ | ❌ | ❌ | ✅ |

## 15. 审计要求

| 审计事件 | 触发条件 | 记录字段 |
|---|---|---|
| 业务数据变更 | 27 表 trigger | user/action/table/record/prev_hash/curr_hash |
| 审计篡改 | 3 防篡改 trigger | RAISE 记录 |
| 归档/销毁 | 归档任务 | 范围/时间/操作人 |
| 迁移执行 | prisma migrate | _prisma_migrations |

## 16. 合规要求 (CNAS/CMA/ISO 17025)

| 标准条款 | 要求摘要 | 本层实现 |
|---|---|---|
| CNAS-CL01:2018 §7.5(技术记录) | 记录完整、可追溯 | 审计链 + 数据字典 |
| CNAS-CL01:2018 §7.11(数据控制) | 数据完整性/防篡改 | 防篡改 trigger + 软删除 |
| CNAS-CL01:2018 §8.4(记录控制) | 保留 ≥ 5 年、可读 | 归档策略 |
| ISO/IEC 17025:2017 对应 | 等同 | 同上 |

## 17. API 要求

**API 要求: N/A** — 理由:数据层无直接 API,数据访问经 L4 应用层 Prisma 服务。

## 18. 验收标准

- [ ] 数据字典覆盖 30 表,与 schema.prisma 100% 对齐
- [ ] 记录生命周期 4 态定义完整(ACTIVE/SOFT-DELETED/ARCHIVED/PURGED)
- [ ] 软删除 7 模型确认(soft-delete.spec ✅)
- [ ] 审计链防篡改验证(audit-compliance.spec ✅)
- [ ] 归档策略(>1 年)与保留(≥ 5 年)定稿
- [ ] 备份 3-2-1 策略定稿
- [ ] 2 条 migration 记录确认(_prisma_migrations)
- [ ] Gate 检查表 G1-G8 全 PASS

## 19. 依赖关系

- **上游依赖**: L0.5(聚合)、L2(保留/防篡改)
- **下游供应**: L4(数据访问)、L6(备份/存储)、L8(归档运维)

## 20. 附录

### 20.1 参考资料

- `apps/backend/prisma/schema.prisma`(单一真源)
- `apps/backend/prisma/migrations/20260813_baseline/migration.sql`
- `apps/backend/prisma/migrations/20260813_softdelete_samplebatch/migration.sql`
- `docs/02-DATABASE.md`
- `apps/backend/src/infrastructure/prisma/soft-delete.extension.ts`

### 20.2 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布 | LIMS-Architect-01 |

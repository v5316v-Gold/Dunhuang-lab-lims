# W10-1 NCR 关闭汇总(整改记录总览)

> **用途**: 汇总 Phase 1A → 1B+ → 1C 全部不符合项,确认正式评审前 100% 关闭
> **汇总日期**: 2026-08-15
> **结论**: 全部 NCR 已关闭或已明确 Phase 2 计划

---

## 1. NCR 关闭状态总览

| NCR | 来源 | 条款 | 描述 | 严重度 | 关闭状态 |
|---|---|---|---|---|---|
| NCR-1 | Phase 1A Gate | §7.2 | Sample.methodId 无外键 | 轻微 | ⚠️ Phase 2 计划 |
| NCR-2 | Phase 1A Gate | §7.2 | 审计日志读权限未限 | 轻微 | ⚠️ Phase 2 计划 |
| NCR-3 | Phase 1A Gate | §7.8 | 报告 PDF 中文转 ASCII | 轻微 | ✅ 已关闭(W+4 UTF-16) |
| NCR-4 | Aiden 二次 Gate | §7.9 | P0-C 回归(deletedAt 字段) | 重大 | ✅ 已关闭(W+1) |
| NCR-5 | Aiden 二次 Gate | §7.9 | BLANK 样 expected=0 触发回收率异常 | 重大 | ✅ 已关闭(W+1) |
| NCR-6 | W+4 回归 | §7.8 | ReportStage 无 user 关系 → ISSUE 500 | 重大 | ✅ 已关闭(W+4) |
| NCR-7 | W+4 回归 | §7.10 | SampleStatus 无 DISPOSED | 重大 | ✅ 已关闭(W+4) |
| NCR-8 | W+7-2 回归 | §7.8 | PDF issuedAt 不一致 | 重大 | ✅ 已关闭(W+7) |
| NCR-9 | W+7-2 回归 | §7.8 | ISSUED stage 顺序导致 sha 不匹配 | 重大 | ✅ 已关闭(W+7) |
| NCR-10 | W+7-2 回归 | §7.8 | 历史数据 sha 不匹配 | 轻微 | ✅ 已关闭(宽容自愈) |

---

## 2. 统计

| 类别 | 数量 | 关闭率 |
|---|---|---|
| 已关闭(✅) | 8 | — |
| Phase 2 计划(⚠️) | 2 | 明确计划 |
| **总计** | **10** | **8/10 已关闭 + 2 有明确计划** |

## 3. 结论

- **重大 NCR**: 6 项,**全部已关闭**
- **轻微 NCR**: 4 项,2 已关闭 + 2 有 Phase 2 计划(不影响 CNAS 现场评审)
- **无未处理 NCR**

**判定**: 可进入 CNAS 现场评审。

---

## 4. Phase 2 计划(评审后)

| NCR | 计划 | 估时 |
|---|---|---|
| NCR-1 外键约束 | 补 FK(Sample.methodId 等) | 2h |
| NCR-2 审计 RBAC | Ownership 扩展到 audit-log | 1h |
| 合同评审 | Contract + ContractReview 表 | 3h |
| 投诉处理 | Complaint 表 | 2h |

---

**NCR 关闭完成 → W10-3 文档定稿**

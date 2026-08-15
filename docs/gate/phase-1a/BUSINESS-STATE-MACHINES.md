# BUSINESS-STATE-MACHINES — 业务状态机总览

> **版本**: v2.0(Phase 1A 冻结版)
> **日期**: 2026-08-15
> **基线 commit**: `4691c8a`
> **状态**: **冻结**

---

## 状态机总图

```
┌────────┐  ┌─────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│ Sample │  │ Test    │  │ Report │  │ Waste  │  │ Bar    │
└────────┘  └─────────┘  └────────┘  └────────┘  └────────┘
┌────────────┐  ┌──────────┐  ┌─────────────┐
│ SampleBatch│  │ Container│  │ Gas          │
└────────────┘  └──────────┘  └─────────────┘
┌─────────┐  ┌─────────┐
│Equipment│  │ Report │  ┌────────────┐
└─────────┘  └─────────┘  │ Calibration │
                          └────────────┘
```

共 **11 个状态机**,覆盖所有业务实体。

---

## 1. Sample 状态机(主流程)

### 1.1 状态枚举

```typescript
enum SampleStatus {
  // 接收阶段
  RECEIVED     = 'RECEIVED',     // 已接样
  REJECTED     = 'REJECTED',     // 已拒收
  // 批次阶段
  BATCHED      = 'BATCHED',      // 已编入批次
  // 测试阶段
  IN_TEST      = 'IN_TEST',      // 测试中(可选状态)
  TESTED       = 'TESTED',       // 测试完成
  // 报告阶段
  REPORTED     = 'REPORTED',     // 报告已签发
  // 留样阶段
  ARCHIVED     = 'ARCHIVED',     // 已留样
  // 销毁阶段
  DISPOSED     = 'DISPOSED',     // 已销毁
  // 异常
  VOIDED       = 'VOIDED',       // 作废(操作员手误)
}
```

### 1.2 状态转换图

```
                 ┌──────────┐
                 │  (新)    │
                 └────┬─────┘
                      ↓
        ┌─────────────────────┐
        │     RECEIVED        │ ← 接样员登记
        └────┬───────────┬────┘
             │           │
             ↓           ↓
       ┌─────────┐  ┌──────────┐
       │ REJECTED│  │ BATCHED  │ ← 拒收 / 编入批次
       └─────────┘  └────┬─────┘
                         │
                         ↓
                  ┌──────────┐
                  │ IN_TEST  │ ← (可选)开始测试
                  └────┬─────┘
                       ↓
                ┌──────────┐
                │  TESTED  │ ← 检测完成
                └────┬─────┘
                     │
                     ↓
              ┌────────────┐
              │ REPORTED   │ ← 报告签发
              └────┬───────┘
                   │
                   ↓
            ┌──────────┐
            │ ARCHIVED │ ← 留样
            └────┬─────┘
                 │
                 ↓
          ┌──────────┐
          │ DISPOSED │ ← 销毁
          └──────────┘

       任何状态 → VOIDED(管理员强制作废)
```

### 1.3 转换前置 / 后置

| 转换 | 前置 | 后置 | 触发者 |
|---|---|---|---|
| → RECEIVED | 客户送样 + 接样员登录 | `receivedById` + `receivedAt` 设置 | 任意 |
| RECEIVED → REJECTED | 重量不合格 / 客户撤回 | `rejectedAt` + `rejectReason` | QA |
| RECEIVED → BATCHED | `SampleBatch.id` 已存在 | `sample.batchId` 设置 | SENIOR_ANALYST |
| BATCHED → IN_TEST | `Test.id` 已创建 | — | SENIOR_ANALYST |
| IN_TEST → TESTED | `Test.status = COMPLETED` + qcPassed = true | `Sample.qcPassed = true` | 系统自动 |
| TESTED → REPORTED | `Report.status = ISSUED` | `Sample.reportedAt` | 系统自动 |
| REPORTED → ARCHIVED | 留样柜有空间 | `Sample.archivedAt` + `storageLocation` | QA |
| ARCHIVED → DISPOSED | 留样期到期 + 双人审批 | `Sample.disposedAt` + 销毁记录 | QA + ADMIN |
| 任何 → VOIDED | ADMIN 强制 + reason 必填 | `voidedAt` + `voidedById` | ADMIN |

### 1.4 验收标准

- 任何转换必须满足前置条件,**否则 400 错误**
- 转换触发 `SecurityAuditService.system()` 写 `SAMPLE_STATUS_CHANGED`(新增,需实施)
- 转换后状态字段**不可回退**(只能 VOIDED 强制作废)

### 1.5 实现状态

**✅ 已实现**:`SampleStatus` enum + 转换基本可用
**❌ 缺失**:
- `IN_TEST` 状态未启用(实际是直接 BATCHED → TESTED)
- `ARCHIVED` / `DISPOSED` 字段无(`archivedAt` / `disposedAt` / `storageLocation` 缺失)
- `Sample.status` 转换**未通过 service 强制校验**(应增加 `SampleStateMachine` 服务)
- `SAMPLE_STATUS_CHANGED` 审计事件未实现

---

## 2. Test 状态机

### 2.1 状态枚举

```typescript
enum TestStatus {
  PENDING     = 'PENDING',     // 待开始
  IN_PROGRESS = 'IN_PROGRESS', // 检测中
  COMPLETED   = 'COMPLETED',   // 已完成
  REJECTED    = 'REJECTED',    // 复检重做
  CANCELLED   = 'CANCELLED',   // 取消
}
```

### 2.2 状态转换

```
PENDING ─────→ IN_PROGRESS ─────→ COMPLETED
   ↓                ↓                   ↓
CANCELLED      REJECTED ──────→ (回 PENDING)
```

### 2.3 转换

| 转换 | 前置 | 后置 | 触发 |
|---|---|---|---|
| → PENDING | Test 已创建 | — | 批次编排 |
| PENDING → IN_PROGRESS | `operatorId` 已设置 | `startedAt` | SENIOR_ANALYST |
| IN_PROGRESS → COMPLETED | `purityPct` + `uncertainty` + `qcPassed = true` | `completedAt` | SENIOR_ANALYST |
| → REJECTED | QC 失败 | `rejectedAt` + `rejectedReason` | QA |
| → CANCELLED | ADMIN | `cancelledAt` | ADMIN |

### 2.4 实现状态

**✅ 已实现**:`TestStatus` enum
**❌ 缺失**:
- 无 `PUT /api/v1/tests/:id/start` 端点
- 无 `POST /api/v1/tests/:id/complete` 端点
- 转换在 service 层**未强制**

---

## 3. SampleBatch 状态机

### 3.1 状态枚举

```typescript
enum SampleBatchStatus {
  PENDING     = 'PENDING',     // 待测
  CALCULATING = 'CALCULATING', // 计算中
  COMPLETED   = 'COMPLETED',   // 已完成
  REJECTED    = 'REJECTED',    // 复检
}
```

### 3.2 转换

| 转换 | 前置 | 触发 |
|---|---|---|
| → PENDING | 批次已建 | 系统 |
| PENDING → CALCULATING | 所有 Test 状态 COMPLETED | 系统 |
| CALCULATING → COMPLETED | 平行样 RSD < 阈值 | SENIOR_ANALYST |
| → REJECTED | QC 失败 | QA |

### 3.3 实现状态

**✅ 完整**

---

## 4. Report 状态机

### 4.1 状态枚举

```typescript
enum ReportStatus {
  DRAFT            = 'DRAFT',            // 起草
  INTERNAL_REVIEW  = 'INTERNAL_REVIEW',  // 内部校核
  FINAL_REVIEW     = 'FINAL_REVIEW',     // 终审
  APPROVED         = 'APPROVED',         // 批准
  ISSUED           = 'ISSUED',           // 签发
  SUPERSEDED       = 'SUPERSEDED',       // 被新版替代
  RECALLED         = 'RECALLED',         // 召回
}
```

### 4.2 状态转换

```
DRAFT ─────→ INTERNAL_REVIEW ─────→ FINAL_REVIEW ─────→ APPROVED ─────→ ISSUED
  ↑              ↓                       ↓                    ↓             ↓
  └──────────────┘ (退回)               ↓                    ↓             ↓
                                      (退回)              (退回)        SUPERSEDED
                                                                          RECALLED
```

### 4.3 转换

| 转换 | 前置 | 后置 | 触发 |
|---|---|---|---|
| → DRAFT | Test 完成 | — | ANALYST |
| DRAFT → INTERNAL_REVIEW | 起草者签字 | Stage 记录 | ANALYST |
| INTERNAL_REVIEW → FINAL_REVIEW | 校核者签字 | Stage 记录 | SENIOR_ANALYST |
| FINAL_REVIEW → APPROVED | 复核者签字 | Stage 记录 | SENIOR_ANALYST |
| APPROVED → ISSUED | 批准者签字 + PDF 生成 | `issuedAt` + `pdfSha256` | QUALITY_MANAGER |
| → SUPERSEDED | 新报告替代 | `supersededAt` + `supersededBy` | QA |
| → RECALLED | 错误 / 客户投诉 | `recalledAt` + `recallReason` | QA + ADMIN |

### 4.4 实现状态

**✅ DRAFT → ISSUED 流程完整**
**❌ 缺失**:
- `SUPERSEDED` / `RECALLED` 状态机未实现
- `Report.pdf` 生成缺失(应 `POST /reports/:id/issue` 触发 PDF)
- `Report.recalledAt` 字段无

---

## 5. WasteRecord 状态机(W1)

### 5.1 状态枚举

```typescript
enum WasteStatus {
  STORED       = 'STORED',       // 暂存中
  TRANSFERRED  = 'TRANSFERRED',  // 已转移
  INCINERATED  = 'INCINERATED',  // 已焚烧
  RECYCLED_GOLD= 'RECYCLED_GOLD',// 海绵金回收
  NEUTRALIZED  = 'NEUTRALIZED',  // 已中和
  DISPOSED     = 'DISPOSED',     // 已处置
  REJECTED     = 'REJECTED',     // 拒收
}
```

### 5.2 转换

```
STORED ─────→ TRANSFERRED ──┬──→ INCINERATED
                                ├──→ RECYCLED_GOLD
                                ├──→ NEUTRALIZED
                                └──→ DISPOSED
```

### 5.3 转换

| 转换 | 前置 | 后置 | 触发 |
|---|---|---|---|
| → STORED | 检测产生危废 | `weightKg` + `sourceTestId` | 任意 |
| STORED → TRANSFERRED | `receiverName` + `receiverLicenceNo` + `transferManifestNo` 必填 | `transferredAt` | QA |
| TRANSFERRED → INCINERATED | method 含「焚烧」 | `disposalAt` + `disposalMethod` | QA |
| TRANSFERRED → RECYCLED_GOLD | method 含「回收」+ `recoveredGoldWeightG` | 同上 | QA |
| TRANSFERRED → NEUTRALIZED | method 含「中和」 | 同上 | QA |
| TRANSFERRED → DISPOSED | method 含「填埋」/「其他」 | 同上 | QA |

### 5.4 实现状态

**✅ 完整**(W1 已闭环)

---

## 6. Container 状态机(W3)

### 6.1 状态枚举

```typescript
enum ContainerStatus {
  IN_STOCK     = 'IN_STOCK',     // 在库
  IN_USE       = 'IN_USE',       // 使用中(已领用)
  CLEANING     = 'CLEANING',     // 清洗中
  MAINTENANCE  = 'MAINTENANCE',  // 维护中(破损)
  RETIRED      = 'RETIRED',      // 已退役
  LOST         = 'LOST',         // 丢失
}
```

### 6.2 转换

```
IN_STOCK ─────→ IN_USE ──┬──→ IN_STOCK(完好归还)
                          ├──→ MAINTENANCE(破损归还)
                          └──→ LOST(报告丢失)
IN_STOCK ──→ CLEANING ──→ IN_STOCK
任何 ──→ RETIRED(管理员)
```

### 6.3 转换

| 转换 | 前置 | 后置 | 触发 |
|---|---|---|---|
| → IN_STOCK | 创建 | — | 任意 |
| IN_STOCK → IN_USE | 容器存在 + 无未还 | `borrowedAt` + `usageNo` | 任意 |
| IN_USE → IN_STOCK | `conditionAfter = '完好'` | `returnedAt` | 任意 |
| IN_USE → MAINTENANCE | `conditionAfter` 含「破损」 | `returnedAt` | 任意 |
| IN_USE → LOST | 报失流程 | `lostAt` + `lostReason` | QA |
| IN_STOCK → CLEANING | 清洗流程 | — | EQUIPMENT_MANAGER |
| → RETIRED | 永久退役 | `retireDate` | ADMIN |

### 6.4 实现状态

**✅ IN_STOCK ↔ IN_USE + MAINTENANCE 完整**
**❌ 缺失**:
- `CLEANING` / `LOST` / `RETIRED` 字段虽存在但**转换未在 service 实现**
- `Container.calibrationDate` 字段**无**

---

## 7. Gas 状态机(W2)

### 7.1 隐含状态

```typescript
// Gas 没有独立 status enum,但有 currentStock/minStock
// 状态:正常 / 低库存(自动判定)
```

### 7.2 隐含转换

| 转换 | 触发 |
|---|---|
| → 低库存 | `currentStock <= minStock` |
| → 正常 | 采购入库 + 库存恢复 |
| → 耗尽 | `currentStock = 0` |

### 7.3 实现状态

**✅ 库存变化 + 告警**
**❌ 缺失**:
- 无显式 `GasStatus` enum
- 无 `Gas.reorderPoint` 字段

---

## 8. Equipment 状态机

### 8.1 状态枚举

```typescript
// Equipment 字段:status
// 值:ACTIVE / INACTIVE / MAINTENANCE / RETIRED / BROKEN
```

### 8.2 转换

| 转换 | 前置 | 触发 |
|---|---|---|
| → ACTIVE | 采购入库 + 校准证书 | 系统 |
| ACTIVE → INACTIVE | 暂停使用 | EQUIPMENT_MANAGER |
| ACTIVE → MAINTENANCE | 故障 / 维护 | EQUIPMENT_MANAGER |
| ACTIVE → BROKEN | 严重故障 | EQUIPMENT_MANAGER |
| → RETIRED | 永久退役 | ADMIN |
| MAINTENANCE → ACTIVE | 修复 + 新校准 | 系统 |

### 8.3 实现状态

**✅ 字段存在**
**❌ 缺失**:
- 转换在 service 层**未强制**
- 无 `Equipment.currentCalibrationId` 指向最新证书

---

## 9. Calibration 状态机(隐式)

### 9.1 转换

```
新购入 → 待校准 ──→ 已校准(ACTIVE) ──→ 校准到期 ──→ 需复校 ──→ 已校准
                       ↓
                   RETIRED(退役)
```

### 9.2 实现状态

**⚠️ 部分实现**:`Calibration` 记录存在,但**无强制告警**。
- 当前有 `nextDueDate` 字段,但前端只显示,**无系统级阻断**
- 无超期告警(Phase 1A 缺口)

---

## 10. PreciousMetalBar 状态机(W4)

### 10.1 状态枚举

```typescript
// 字段:status = 'ACTIVE' | 'VOIDED' | 'RECALLED'
```

### 10.2 转换

| 转换 | 前置 | 触发 |
|---|---|---|
| → ACTIVE | 检测完成 + 出证 | SENIOR_ANALYST |
| ACTIVE → VOIDED | 报告错误 | QA |
| ACTIVE → RECALLED | 客户投诉 / 出证后瑕疵 | QA + ADMIN |

### 10.3 实现状态

**✅ ACTIVE / VOIDED 字段**
**❌ 缺失**:
- `RECALLED` 字段值未在 enum 中明确定义
- `recallReason` 字段缺失
- 召回流程未实现

---

## 11. ReportStage 状态机(隐式)

### 11.1 转换

`ReportStage` 不是独立状态机,但**记录 Report 状态变更历史**:

```
DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
 ↑            ↓                ↓             ↓          ↓
 └────────────┘                └─────────────┘          ↓
                                                          SUPERSEDED
                                                          RECALLED
```

每条 ReportStage 记录一个状态 + userId + comments。

### 11.2 实现状态

**✅ 完整**(5 阶段,真实种子测试过)

---

## 12. 状态机总览矩阵

| 实体 | 状态数 | 转换数 | 实现 | 缺口 |
|---|---|---|---|---|
| Sample | 7 | 9 | ⚠️ | IN_TEST 不用 + ARCHIVED/DISPOSED 缺 |
| Test | 5 | 5 | ⚠️ | 转换未强制 |
| SampleBatch | 4 | 4 | ✅ | — |
| Report | 7 | 7 | ✅ | SUPERSEDED / RECALLED 未实现 |
| WasteRecord | 7 | 5 | ✅ | — |
| Container | 6 | 6 | ⚠️ | CLEANING/LOST/RETIRED 转换未实现 |
| Gas | (隐式) | 2 | ⚠️ | 无显式 status enum |
| Equipment | 5 | 5 | ⚠️ | 转换未强制 |
| Calibration | (隐式) | 3 | ⚠️ | 无到期阻断 |
| PreciousMetalBar | 3 | 3 | ⚠️ | RECALLED 未实现 |
| ReportStage | 5 | 5 | ✅ | — |

**总缺口**:7 个状态机的转换未在 service 强制

---

## 13. 关键转换前置条件代码检查清单

Phase 1A 之后的强制实现项:

- [ ] `SampleStateMachine` 服务 — 强制 Sample.status 转换前置
- [ ] `TestStateMachine` 服务 — 强制 Test.status 转换
- [ ] `ReportStateMachine` 服务 — 强制 Report 状态机
- [ ] `ContainerStateMachine` 服务 — 强制 Container 状态机
- [ ] `EquipmentStateMachine` 服务 — 强制 Equipment 状态机
- [ ] `CalibrationGuard` 服务 — 校准到期阻断
- [ ] `ReagentExpiryGuard` 服务 — 试剂过期阻断
- [ ] `ReferenceMaterialExpiryGuard` 服务 — RM 过期阻断

---

## 14. 阶段输出

状态机输出到:
- **L1 业务架构**(`L1-BUSINESS-ARCHITECTURE.md`)已引用本文件
- **审计证据**(`AUDIT-EVIDENCE-INVENTORY.md`)将列出每个状态转换产生的审计事件
- **Gate 报告**(`PHASE-1A-GATE-REPORT.md`)用此评估"状态机强制度"

---

**业务状态机冻结完毕。下一步:Step 8 审计证据清单。**
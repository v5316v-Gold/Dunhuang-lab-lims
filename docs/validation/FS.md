# FS — Functional Specification (功能规格)

> **项目**: 敦煌金质检 LIMS
> **版本**: v1.0 | 2026-08-14
> **编制**: LIMS-Architect-01
> **状态**: 草案(Phase 5 CNAS 预审)
> **来源**: URS v1.0(逐条展开为可测试功能)
> **对接**: DS(详细设计)/IQ/OQ/PQ 测试用例

---

## 1. 文档目的

将 URS 用户级需求展开为**可测试的功能规格**。每条 FS 必须有对应 OQ 测试用例。

## 2. 模块功能规格

### 2.1 样品编号生成(FS-101,来源 URS-101)

| 项 | 规格 |
|---|---|
| 输入 | POST /samples(无需客户端传 sampleNo) |
| 行为 | 事务内 `sample_no_sequences` 表行锁(`SELECT FOR UPDATE`),当日 date_key 不存在则插入(初始 last_seq=1),存在则 last_seq+=1 |
| 输出 | sampleNo 格式 YYMMDD-NNNN(NNNN 为 4 位零填充,1-9999) |
| 错误 | 当日 9999 用尽抛 CapacityExceededError(400) |
| 测试 | 并发 20 次无重复(phase-fills.spec) |

### 2.2 样品状态机守卫(FS-102,来源 URS-102)

| 状态 | 可执行事件 |
|---|---|
| RECEIVED | TO_BATCH(REJECT) |
| BATCHED | START_TEST(REJECT) |
| IN_TEST | COMPLETE_TEST(REJECT) |
| TESTED | TO_REPORT_DRAFT(REJECT) |
| REPORT_DRAFT | SUBMIT_REVIEW(REJECT) |
| REPORT_REVIEW | APPROVE(REJECT→DRAFT) |
| REPORT_APPROVED | ARCHIVE |
| ARCHIVED | — |
| REJECTED | — |

实现:`apps/backend/src/modules/sample/sample.state-machine.ts`(纯函数 + 端点 `POST /samples/:id/transition`)。非法流转 → 400。

### 2.3 火试金 6 步执行守卫(FS-201,来源 URS-201)

字段推导步骤完成(无新表):
- `sampleWeightG` → WEIGHING
- `furnaceTempC` → MELTING
- `cupellationMin` → CUPELLATION
- `partingMin` → PARTING
- `annealingMin` → ANNEALING
- `prillWeightG` → FINAL_WEIGHING

**recordWeights(FINAL_WEIGHING)前必须全部前序完成** → 否则 400 提示缺失步骤。

### 2.4 纯度计算(FS-202)

公式:`Au% = prillWeightG / sampleWeightG × 100 × (100 / qcRecoveryPct)`,使用 Decimal.js(精度 15,6)。QC 回收率范围 99.5-100.5%,超出范围 `qcPassed = false`。

### 2.5 Westgard 规则引擎(FS-301,来源 URS-301)

5 规则(基于 Z-score 历史):
- 1₃s: |Z| > 3
- 2₂s: 连续两点 |Z| > 2 同向
- R₄s: 相邻两点差 > 4σ
- 4₁s: 连续 4 点 |Z| > 1 同向
- 10x: 连续 10 点同侧

实现:`apps/backend/src/modules/qc/westgard.service.ts`(纯函数)。OQ 测试 11 项全 PASS。

### 2.6 报告三级审核(FS-401,来源 URS-401)

状态机:DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED。驳回可回 DRAFT。
**ISSUE 时自动生成 PDF + SHA256**(对接 URS-402)。实现:`report.service.ts` transition 方法。

### 2.7 电子签名(FS-403,来源 URS-403)

实现:`report-signature.service.ts`
- 内容哈希: `SHA256(reportNo + summary + signedAt)`
- Mock TSA token: `TSA-MOCK|hash|ISO时间`
- 守卫:仅 APPROVED 状态可签名
- verifySignature(): 重算哈希比对 + 篡改检测

### 2.8 设备校准拦截(FS-501)

`equipment.service.isUsableForTesting()` 返回 `{usable, reason}`。检测模块调用拦截:
- ACTIVE 状态 → 继续校准检查
- NO_CALIBRATION → 拒用
- EXPIRED(过期) → 拒用(CNAS §6.4)
- EXPIRING_SOON(30 天内) → 仍可用(但告警)

### 2.9 三查健康状态(FS-502)

`getEquipmentHealthStatus()` 返回 {calibration, maintenance, periodicCheck, overall}:
- 三项均 OK → HEALTHY
- 任一项 NO_* 或过期 → ATTENTION

### 2.10 低库存预警(FS-601)

`getLowStockAlerts()` 返回试剂列表(`remainingQty ≤ safetyStock`)。
**安全库存为 0 的试剂不触发**(避免无意义预警)。

### 2.11 能力授权(FS-701)

`personnel.hasValidCompetency(method)` 返回 `{authorized, reason}`:
- 无能力 → 拒绝("无 [方法] 能力授权")
- 过期 → 拒绝("能力已过期")
- TRAINEE → 拒绝("等级不足")
- SENIOR/EXPERT + 未过期 → 通过

### 2.12 审计链 SHA256(FS-801)

27 业务表 trigger + audit_logs 防篡改三层 trigger(UPDATE/DELETE/TRUNCATE 拒绝)。
**manual 事件**经 `SecurityAuditService` 写入,SHA256 与 DB trigger 同算法。
`GET /audit-logs/verify` 全链路校验。

### 2.13 数据归档(FS-803,来源 URS-804)

`dataRetentionService.execute(dryRun)`:
- 归档候选: ARCHIVED + >1 年(RETENTION_ARCHIVE_DAYS)
- 销毁候选: >5 年(RETENTION_PURGE_DAYS)
- dryRun 仅统计;execute 写审计 + 物理删除

### 2.14 配置中心化(FS-902)

`env.schema.ts` 启动时校验(env 缺失/占位符/生产强度)。生产环境 `JWT_SECRET < 32 字符` 或含 `change-me/dev-/test-secret` 关键词 → 拒绝启动。

## 3. API 契约(摘要)

| 端点 | 方法 | 鉴权 | 说明 |
|---|---|---|---|
| /auth/login | POST | 公开 | 返回 accessToken |
| /samples | POST | ADMIN+/ANALYST | 创建样品 |
| /samples/:id/transition | POST | ANALYST+ | 状态机推进 |
| /tests/fire-assay/:id/weights | POST | OPERATOR+ | 记录重量(6 步守卫) |
| /qc/measurements | POST | ANALYST+ | 录入 QC |
| /reports | POST | ANALYST+ | 创建报告 |
| /reports/:id/transition | POST | 角色化 | 报告审核流 |
| /audit-logs/verify | GET | ADMIN/QM | 审计链校验 |
| /health/deep | GET | 公开 | 深度健康 |

## 4. 测试映射

| FS | OQ 用例 |
|---|---|
| FS-101 | `sample-number.spec.ts` 3 用例 |
| FS-102 | `sample-state-machine.spec.ts` 6 用例 |
| FS-201 | `phase-fills.spec.ts` 步骤守卫 1 用例 |
| FS-202 | `fire-assay-calculator.spec.ts` 8 用例 |
| FS-301 | `westgard.spec.ts` 11 用例 |
| FS-401 | `report-flow.spec.ts` 2 用例 |
| FS-501 | `phase3-support.spec.ts` 校准拦截 |
| FS-701 | `phase-fills.spec.ts` 能力授权 |
| FS-801 | `audit-compliance.spec.ts` 6 用例 |

---

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-14 | 首次发布(Phase 5 CNAS 预审) | LIMS-Architect-01 |

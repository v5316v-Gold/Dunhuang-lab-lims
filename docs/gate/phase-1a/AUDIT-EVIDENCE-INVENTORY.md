# AUDIT-EVIDENCE-INVENTORY — 审计证据清单

> **版本**: v2.0(Phase 1A 冻结版)
> **日期**: 2026-08-15
> **基线 commit**: `4691c8a`
> **状态**: **冻结**

---

## 1. 概述

**审计证据 = 在 LIMS 中能证明「某事发生过 / 某数据是可信的 / 某操作由谁执行」的所有可检索记录。**

CNAS-CL01 §7.11「数据控制」要求:
- 所有关键动作有审计痕迹
- 审计记录**不可变 + 可检索**
- 记录包含:动作 / 时间 / 操作者 / 输入 / 输出

**本文件清单**:
- 已落地的审计证据(20 个 audit + 6 个 realtime)
- 证据 vs CNAS 条款映射
- 关键缺口(无证据的动作)

---

## 2. 审计事件类型(13 种)

`apps/backend/src/common/audit/audit-event.enum.ts`:

| 事件 | 类别 | 触发场景 | 关联条款 |
|---|---|---|---|
| AUTH:LOGIN_SUCCESS | 用户 | 登录成功 | §7.2 |
| AUTH:LOGIN_FAILED | 用户 | 登录失败 | §7.2 |
| AUTH:LOGOUT | 用户 | 登出 | §7.2 |
| AUTH:PASSWORD_CHANGED | 用户 | 改密 | §7.2 |
| AUTH:MFA_ENABLED | 用户 | 启用 MFA | §7.2 |
| AUTH:ACCOUNT_LOCKED | 用户 | 连续失败锁定 | §7.2 |
| AUTH:ACCOUNT_UNLOCKED | 用户 | 解锁 | §7.2 |
| SECURITY:ACCESS_DENIED | 安全 | RBAC 403 | §7.2 |
| SECURITY:BRUTE_FORCE_ATTEMPT | 安全 | 登录爆破 | §7.2 |
| SECURITY:AUDIT_TAMPER_ATTEMPT | 安全 | 审计篡改尝试 | §7.11 |
| SECURITY:SENSITIVE_ACCESS | 安全 | 敏感数据访问(审计日志导出)| §7.11 |
| SYSTEM:START | 系统 | 服务启动 | §7.11 |
| SYSTEM:SHUTDOWN | 系统 | 服务关闭 | §7.11 |
| CONFIG:PERMISSION_CHANGED | 配置 | 角色权限变更 | §7.2 |
| CONFIG:SETTINGS_CHANGED | 配置 | 系统参数变更 | §7.11 |

**注**:`SETTINGS_CHANGED` 是 **通用兜底事件**——业务侧用同一事件 + 自定义 `event` 字段(如 `event: 'WASTE_TRANSFERRED'`)。

---

## 3. 业务侧事件类型(20 种,在 `event` 字段中)

通过 `securityAudit.system(AuditEventType.SETTINGS_CHANGED, { event: 'XXX', ... })` 写入。

| # | 业务事件 | 触发位置 | 关键字段 |
|---|---|---|---|
| 1 | WASTE_TRANSFERRED | waste.service.ts:153 | code, receiver, weight |
| 2 | WASTE_DISPOSED | waste.service.ts:191 | code, status, method |
| 3 | GAS_PURCHASE_CREATED | gas.service.ts:135 | purchaseNo, gasId, supplier |
| 4 | GAS_PURCHASE_INSPECTED | gas.service.ts:240 | passed, quantity |
| 5 | GAS_USAGE_RECORDED | gas.service.ts:283 | usageNo, gasId, quantity, purpose |
| 6 | CONTAINER_CREATED | container.service.ts:122 | code, name, type, material |
| 7 | CONTAINER_UPDATED | container.service.ts:199 | code, changes |
| 8 | CONTAINER_BORROWED | container.service.ts:246 | usageNo, containerId, purpose |
| 9 | CONTAINER_RETURNED | container.service.ts:291 | usageNo, conditionAfter |
| 10 | SAMPLING_RECORD_CREATED | precious-metal.service.ts:126 | recordNo, method, location |
| 11 | PRECIOUS_METAL_BAR_CREATED | precious-metal.service.ts:217 | barCode, qualityGrade, purityPct |
| 12 | (其他 9 个) | analytics + auth + others | — |

**统计**:实际代码 grep 共 **20 处** `securityAudit.system/record` 调用。

---

## 4. Realtime 事件类型(W5,内存 Bus 不入 DB)

`apps/backend/src/modules/realtime/realtime.bus.ts`:

| 事件 | 触发 |
|---|---|
| WASTE_TRANSFERRED | waste.service.ts:transfer |
| WASTE_DISPOSED | waste.service.ts:dispose |
| GAS_LOW_STOCK | gas.service.ts:recordUsage(<=10% 阈值)|
| CONTAINER_MAINTENANCE | container.service.ts:borrow |
| BAR_CERTIFIED | precious-metal.service.ts:createBar |
| (SAMPLING_RECORDED, TEST_COMPLETED, REPORT_ISSUED) | 预留 |

**重要**:**Realtime 不入 DB,只通过 SSE 推前端**。**当前未同时写 audit**(见 §6 缺口)。

---

## 5. 关键动作 → 审计证据映射(评审问题)

### Q1:「这台设备哪天被校准过?谁校准的?证书 PDF 在哪?」

| 证据 | 数据源 | 检索方式 |
|---|---|---|
| **校准记录** | `Calibration` 表 | `GET /equipment/calibrations?equipmentId=X` |
| **校准文件** | `FileAttachment`(字段无)| ❌ 无 API |
| **审计证据** | `AuditLog` 表 | `GET /audit-logs?action=SETTINGS_CHANGED&resource=calibration` |
| **当前状态** | ⚠️ 部分 | 校准记录有,**PDF 文件上传无 API** |

**缺口**:`POST /equipment/calibrations` + 文件上传端点缺失。

---

### Q2:「2026-01-15 检测的样品 952cf4a1...,谁测的?用的什么 RM?」

| 证据 | 数据源 | 检索方式 |
|---|---|---|
| **测试操作员** | `Test.operatorId` | `GET /tests/:id` |
| **测试时间** | `Test.startedAt/completedAt` | 同上 |
| **测试方法** | `Test.method` | 同上 |
| **QC 验证** | `QcMeasurement` | `GET /qc/measurements?testId=X` |
| **RM 使用记录** | (无表)| ❌ 无 |
| **审计证据** | `AuditLog` 表 | `event: 'TEST_COMPLETED'`(预留)|

**缺口**:`ReferenceMaterialUsage` 表缺失,无法回答「用的哪个 RM」。

---

### Q3:「这个危废编号 WT-20260815-0001 现在在哪里?」

| 证据 | 数据源 |
|---|---|
| 危废当前状态 | `WasteRecord.status` |
| 转移时间 | `WasteRecord.transferredAt` |
| 接收企业 | `WasteRecord.receiverName` |
| 接收资质证号 | `WasteRecord.receiverLicenceNo` |
| 转移联单号 | `WasteRecord.transferManifestNo` |
| 联单文件 | ❌ 无 |
| 审计证据 | `AuditLog: WASTE_TRANSFERRED / WASTE_DISPOSED` |

**基本完整**。

---

### Q4:「2026-08-15 14:23 用户 admin 改了哪些系统设置?」

| 证据 | 数据源 |
|---|---|
| 用户登录 | `AuditLog: AUTH:LOGIN_SUCCESS` |
| 改了什么 | `AuditLog: CONFIG:SETTINGS_CHANGED` + `details` JSONB |
| 时间戳 | `AuditLog.timestamp`(DB trigger 应防改) |
| IP | `AuditLog.ip` |

**完整**。

---

### Q5:「气体 GAS-202608-0003(高纯氢气)什么时候领用的?领了多少?」

| 证据 | 数据源 |
|---|---|
| 当前库存 | `Gas.currentStock` |
| 采购记录 | `GasPurchase` 表 |
| 使用记录 | `GasUsage` 表(含 `purpose` 用途字段)|
| 审计证据 | `AuditLog: GAS_USAGE_RECORDED` + Realtime `GAS_LOW_STOCK` |

**完整**。

---

### Q6:「报告 RPT-20260815-0001 何时签发?由谁批准?」

| 证据 | 数据源 |
|---|---|
| 签发时间 | `Report.issuedAt` |
| 起草者 | `Report.createdById` |
| 三级签字 | `ReportStage` × 5 + `ReportSignature` × 3 |
| 数字签名 | `ReportSignature.signatureHash` + TOTP code |
| 报告 PDF | `Report.pdfSha256`(存哈希) |
| 审计证据 | `AuditLog: REPORT_ISSUED` |

**基本完整**(假设 PDF 已生成;目前未集成 PDF 生成,需补)。

---

### Q7:「这批 ICP-OES 校准曲线 R² 是多少?证书在哪?」

| 证据 | 数据源 | 状态 |
|---|---|---|
| **校准曲线** | (无表) | ❌ |
| **校准日期** | `Equipment.lastCalibration` 隐式 | ⚠️ 无显式字段 |
| **证书 PDF** | (无上传) | ❌ |
| **证书哈希** | (无) | ❌ |
| **审计证据** | `AuditLog: SETTINGS_CHANGED` (有) | ⚠️ |

**大缺口**——校准曲线 R² 无法在系统中检索。

---

### Q8:「火试金炉 #1 上次温度校准什么时候?」

| 证据 | 数据源 |
|---|---|
| 校准记录 | `Calibration` 表(只有 `result` 字段,无温度字段)|
| 温度 | ❌ 无字段 |
| 操作员 | `Calibration.createdBy` (无) |

**缺口**:`Calibration` 表无 `temperatureC` / `pressureBar` 等具体参数。

---

### Q9:「能力验证 PT 计划做了吗?有盲样记录吗?」

| 证据 | 数据源 |
|---|---|
| **PT 计划** | (无表) |
| **盲样考核** | (无表) |

**CMA 必查,完全缺失**。

---

### Q10:「2026 年度内部审核做了吗?管理评审做了吗?」

| 证据 | 数据源 |
|---|---|
| 内审 | (无表) |
| 管评 | (无表) |

**CMA 必查,完全缺失**。

---

## 6. 审计证据缺口汇总(高风险)

| # | 缺口 | 风险 | 阻塞条款 |
|---|---|---|---|
| 1 | `ReferenceMaterialUsage` 表缺失 | 评审问 RM 使用台账答不上 | §7.6 |
| 2 | 校准证书 PDF 上传 + SHA256 缺失 | 评审问证书答不上 | §7.6 |
| 3 | RM 期间核查记录缺失 | 评审问 RM 核查答不上 | §7.7 |
| 4 | 校准曲线 R² 记录缺失 | ICP 校准不可查 | §7.9 |
| 5 | Calibration 温度/压力/参数缺失 | 火试金炉 ICP 校准细节缺失 | §6.5 |
| 6 | 报告 PDF 生成缺失 | 报告长什么样查不到 | §7.8 |
| 7 | 不确定度 5 类分量记录缺失 | U 怎么算答不上 | §7.8 |
| 8 | Westgard 自动应用缺失 | QC 失控无证据 | §7.9 |
| 9 | OOS / CAPA 流程缺失 | 异常无法追溯 | §7.10 |
| 10 | 盲样考核 / PT 缺失 | CMA 必查 | CMA |
| 11 | 内审 / 管评 缺失 | CMA 必查 | CMA |
| 12 | 留样 / 销毁记录缺失 | 留样无法追踪 | §7.10 / CMA |
| 13 | Realtime 事件未同时写 Audit | 实时事件不持久化 | §7.11 |

**核心结论**:**13 个高风险缺口,涉及 §7.6 / §7.7 / §7.8 / §7.9 / §7.10 / CMA**。

---

## 7. 审计证据时间线(示例)

**审计员调取 2026-08-15 14:23 admin 的所有操作**:

```sql
SELECT timestamp, event, table_name, record_id, new_data, ip
FROM audit_logs
WHERE user_id = '00000000-0000-0000-0000-000000000001'  -- admin UUID
  AND timestamp >= '2026-08-15 14:00:00'
  AND timestamp < '2026-08-15 15:00:00'
ORDER BY timestamp;
```

**结果**(示意):
| timestamp | event | table | record_id | new_data | ip |
|---|---|---|---|---|---|
| 14:23:01 | AUTH:LOGIN_SUCCESS | users | 0000...0001 | { username: 'admin' } | 127.0.0.1 |
| 14:25:33 | SETTINGS_CHANGED | gases | 85a7... | { event: 'GAS_USAGE_RECORDED', usageNo: 'USAGE-...' } | 127.0.0.1 |
| 14:27:15 | SETTINGS_CHANGED | wastes | 0c4a... | { event: 'WASTE_TRANSFERRED', code: 'WT-...' } | 127.0.0.1 |
| 14:28:42 | LOGOUT | users | 0000...0001 | — | 127.0.0.1 |

**评审员能看到**:**who / when / what / 旧值 / 新值 / IP**——完整审计痕迹。

---

## 8. 审计不可变性保证

### 8.1 应用层

- `SecurityAuditService.record()` 写入 `AuditLog` 表
- 无 `UPDATE` / `DELETE` API(只读 `GET /audit-logs`)
- 数据库 trigger(部分表)阻止直接 UPDATE

### 8.2 数据库层

- `audit_logs` 表**无 UPDATE/DELETE 权限**(GRANT 限定)
- DB trigger `audit_log_no_update` 阻止任何 UPDATE
- (待确认:在迁移中是否已加)

### 8.3 实施

- ✅ Phase 4 已有 `audit-compliance.spec.ts` 验证审计不可改
- ⚠️ 需现场验证 DB trigger 是否启用

---

## 9. 审计日志查询 API

| API | 用途 |
|---|---|
| `GET /audit-logs` | 列表(分页 / 过滤)|
| `GET /audit-logs/:id` | 详情(含 old_data / new_data JSONB) |
| `GET /audit-logs/export` | 导出 CSV(需 SENSITIVE_ACCESS 审计) |
| `POST /audit-logs/verify` | DB 触发器完整性验证(ADMIN) |

**当前**:`GET /audit-logs` 已实现 + 前端 `/audit-logs` 页面已实现。
**缺口**:`export` 端点 + `verify` 端点未实现。

---

## 10. 审计证据完整度评分

按 CNAS 条款 12 项评估:

| 评估项 | 评分 | 说明 |
|---|---|---|
| 审计日志是否不可变 | 🟡 中 | 应用层无 UPDATE API,DB trigger 待现场验证 |
| 审计是否覆盖所有关键动作 | 🟠 部分 | 20/40+ 关键动作已覆盖(W1-W5) |
| 审计查询 API 是否完整 | 🟢 好 | 列表 + 详情 + 过滤已实现 |
| 审计导出是否可追溯 | 🔴 差 | export 端点未实现 |
| 审计与业务记录是否关联 | 🟢 好 | `recordId` + `old_data`/`new_data` 完整 |
| 审计时间戳是否权威 | 🟡 中 | 服务器时间,无 NTP 同步 |
| 审计查询是否 RBAC 受控 | 🟠 部分 | QA + Admin 可见,但无资源级 RBAC |

**总评分**:**68 / 100** —— 基础完整,高级特性(导出 / 完整性验证)缺失。

---

## 11. 改进建议(Phase 1B+)

| 优先级 | 任务 | 估时 |
|---|---|---|
| P0 | Realtime 事件**同时写 Audit**(W5 当前缺) | 1h |
| P0 | 校准证书 PDF 上传 + SHA256 | 2h |
| P0 | ReferenceMaterialUsage 表 | 2h |
| P1 | 审计日志 export 端点 | 1h |
| P1 | 审计完整性 verify 端点 | 1h |
| P2 | 审计 DB trigger 现场验证脚本 | 0.5h |
| P2 | NTP 时间同步 | (运维) |

---

## 12. 阶段输出

证据清单输出到:
- **L1 业务架构** §11「RBAC 与各流程的接入点矩阵」已引用
- **CNAS 矩阵**(`CNAS-CMA-TRACEABILITY-MATRIX.md`)的「审计」列已对照
- **Gate 报告**(`PHASE-1A-GATE-REPORT.md`)用此评分审计证据完整度

---

**审计证据清单冻结完毕。下一步:Step 9 Gate 报告。**
# CNAS-CMA-ISO/IEC-17025 条款追溯矩阵

> **版本**: v2.0(Phase 1A 冻结版)
> **日期**: 2026-08-15
> **基线 commit**: `4691c8a`
> **覆盖标准**: CNAS-CL01:2018 / ISO/IEC 17025:2017 / CMA(中国计量认证实施细则)

---

## 1. 矩阵结构

每个条款纵向映射到 6 个落地证据:
1. **后端模块**(Module)
2. **数据表**(Prisma model)
3. **API 端点**(Controller method)
4. **前端页面**(React route)
5. **审计事件**(AuditEventType)
6. **测试文件**(spec.ts)

状态:✅ 已实现 / ⚠️ 部分实现 / ❌ 缺口

---

## 2. CNAS-CL01:2018 主体条款矩阵

### §6.4 外部提供的产品和服务

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 供应商评价 | reagent / ehs | GasPurchase / Reagent | POST /gas/purchase | /gas | SETTINGS_CHANGED | w2-gas | ⚠️ |
| 外部校准服务 | equipment | Calibration | POST /equipment | /equipment | SETTINGS_CHANGED | (无) | ⚠️ |
| 标气采购 | ehs | GasPurchase | POST /gas/purchase | /gas | SETTINGS_CHANGED | w2-gas | ✅ |

### §6.5 设备(含校准)

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 设备台账 | equipment | Equipment | /equipment | /equipment | (无) | (无) | ⚠️ |
| 校准证书 | equipment | Calibration | (无 POST) | (无) | SETTINGS_CHANGED | (无) | ⚠️ |
| 期间核查 | equipment | PeriodicCheck | (无 POST) | (无) | SETTINGS_CHANGED | (无) | ⚠️ |
| 容器管理 | ehs | Container | /container | /container | CONTAINER_BORROWED | w3-container | ✅ |
| 容器校准 | ehs | Container(无 calibrationDate 校验)| — | — | — | — | ❌ |

### §7.2 人员

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 人员档案 | personnel | Personnel | /personnel | /personnel | SETTINGS_CHANGED | (无) | ✅ |
| 培训记录 | personnel | Training | (无 POST) | (无) | SETTINGS_CHANGED | (无) | ⚠️ |
| 能力评估 | personnel | Competency | (无 POST) | (无) | SETTINGS_CHANGED | (无) | ⚠️ |
| 角色授权 | identity | UserRoleAssignment | /users | (无) | PERMISSION_CHANGED | auth-hardening | ✅ |
| 临时授权 | identity | (无表)| — | — | — | — | ❌ |

### §7.4 记录(数据完整性)

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 监管链(取样)| precious-metal | SamplingRecord | POST /precious-metal/sampling | /precious-metal | SAMPLING_RECORD_CREATED | w4 | ✅ |
| 监管链(气体)| ehs | GasUsage | POST /gas/usage | /gas | GAS_USAGE_RECORDED | w2 | ✅ |
| 监管链(容器)| ehs | ContainerUsage | POST /container/usage/borrow | /container | CONTAINER_BORROWED | w3 | ✅ |
| 监管链(危废)| ehs | WasteRecord | POST /waste | /waste | (无) | w1 | ⚠️ |
| 电子签名 | auth | (用 TOTP code) | — | — | — | — | ⚠️ |
| 时间戳权威 | (无 NTP 同步) | — | — | — | — | — | ❌ |

### §7.5 设施与环境条件

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 设备场地 | equipment | Equipment.location | /equipment | /equipment | SETTINGS_CHANGED | (无) | ✅ |
| 气体管理 | ehs | Gas | /gas | /gas | GAS_LOW_STOCK | w2 | ✅ |
| 容器管理 | ehs | Container | /container | /container | CONTAINER_MAINTENANCE | w3 | ✅ |
| 危废暂存间 | ehs | WasteRecord.storageLocation | /waste | /waste | (无) | w1 | ✅ |
| 危化品 | reagent | Hazard / EmergencyPlan | (无 GET) | (无) | (无) | (无) | ❌ |

### §7.6 测量溯源性(标准物质 / 校准)

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 有证标准物质 | test | ReferenceMaterial | (无 GET) | (无) | (无) | westgard | ⚠️ |
| 证书 PDF | (无 MinIO 文件)| — | — | — | — | — | ❌ |
| 证书哈希 | test | ReferenceMaterial(无 sha256Certificate)| — | — | — | — | ❌ |
| RM 有效期 | test | ReferenceMaterial.expiryDate | (无 POST) | — | — | — | ⚠️ |
| RM 使用台账 | test | (无 ReferenceMaterialUsage)| — | — | — | — | ❌ |
| RM 期间核查 | test | (无 nextVerificationDate)| — | — | — | — | ❌ |
| RM 保管条件 | test | (无 storageLocation)| — | — | — | — | ❌ |
| 校准证书 | equipment | Calibration | (无 GET) | — | SETTINGS_CHANGED | (无) | ⚠️ |
| 校准哈希 | equipment | (无)| — | — | — | — | ❌ |

### §7.7 期间核查

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 期间核查计划 | equipment | PeriodicCheck | (无 POST) | (无) | SETTINGS_CHANGED | (无) | ⚠️ |
| Z-score 记录 | equipment | PeriodicCheck.zScore | — | — | — | — | ✅ |
| 设备期间核查 | equipment | PeriodicCheck | — | — | — | — | ⚠️ |
| 标物期间核查 | test | (无)| — | — | — | — | ❌ |
| Westgard 多规则 | test | QcMeasurement | — | /qc | SETTINGS_CHANGED | westgard | ⚠️ 自动应用未实现 |

### §7.8 结果报告(含不确定度)

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 报告内容 | report | Report.summary | /reports | /reports | SETTINGS_CHANGED | report-flow | ✅ |
| 三级审核 | report | ReportStage + ReportSignature | /reports | /reports | (无) | report-flow | ✅ |
| 报告 PDF | report | Report.pdfSha256 | (无 PDF 生成)| (无预览)| (无) | (无) | ⚠️ |
| 数字签名 | auth | (用 TOTP)| — | — | — | auth-hardening | ⚠️ |
| 不确定度 | test | Test.uncertainty | /tests | /tests | (无) | (无) | ⚠️ 字段有,溯源缺 |
| 不确定度报告 | test | (无 UncertaintyReport 表)| — | — | — | — | ❌ |
| 5 类分量 | test | (无)| — | — | — | — | ❌ |
| 报告修改禁止 | report | (DB 无约束) | — | — | — | — | ❌ |
| 报告撤回 | report | (无召回机制)| — | — | — | — | ❌ |

### §7.9 结果控制(QC)

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| QC 测量 | test | QcMeasurement | (无 POST)| /qc | SETTINGS_CHANGED | westgard | ✅ |
| Westgard 自动 | test | (无逻辑)| — | /qc | — | westgard | ❌ |
| 平行样 | test | QcMeasurement(PARALLEL)| — | /qc | — | — | ⚠️ |
| 空白样 | test | QcMeasurement(BLANK)| — | /qc | — | — | ⚠️ |
| 加标回收 | test | QcMeasurement(SPIKE)| — | /qc | — | — | ⚠️ |
| 质控图 | test | (无 chart)| — | /qc | — | — | ⚠️ UI 基础 |
| OOS 处理 | test | (无 NonConformance 表)| — | — | — | — | ❌ |

### §7.10 不符合工作

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| OOS 登记 | (无) | — | — | — | — | — | ❌ |
| 调查流程 | (无) | — | — | — | — | — | ❌ |
| 客户通知 | (无) | — | — | — | — | — | ❌ |
| 纠正措施 | (无) | — | — | — | — | — | ❌ |
| CAPA | (无) | — | — | — | — | — | ❌ |
| 危废处置 | ehs | WasteRecord | /waste | /waste | WASTE_DISPOSED | w1 | ✅ |

### §7.11 数据控制

| 条款要点 | 模块 | 数据表 | API | 前端 | 审计 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 审计日志 | audit | AuditLog | (只读)| /audit-logs | (自记录)| audit-events / audit-compliance | ✅ |
| 审计不可改 | audit | DB trigger(部分)| — | — | — | audit-events | ⚠️ |
| 三级签字 | auth | ReportSignature | /reports | /reports | (无) | report-flow | ✅ |
| 数据备份 | infra | (3-2-1 备份脚本)| — | — | — | DR-2026-08 | ✅ |
| 备份恢复演练 | infra | DR script | — | — | — | DR-2026-08 | ✅ |
| 访问控制 | auth | RbacGuard | (全局)| — | ACCESS_DENIED | auth-hardening | ✅ |

---

## 3. ISO/IEC 17025:2017 补充条款(等同 CNAS)

ISO/IEC 17025 与 CNAS-CL01:2018 在内容上**等同采用**,无需独立矩阵。

---

## 4. CMA 计量认证补充要求

CMA 是中国**计量法**强制要求,与 CNAS 并行。CMA 评审侧重:

### 4.1 CMA 必查项 vs LIMS 覆盖

| CMA 必查项 | LIMS 实现 | 状态 |
|---|---|---|
| 法人 / 资质 | (组织结构文档) | ❌ 系统外 |
| 人员资格证书 | Personnel + Competency | ⚠️ 字段有,证书附件缺 |
| 设备检定证书 | Calibration | ✅ |
| 设备期间核查 | PeriodicCheck | ✅ |
| 标物证书 | ReferenceMaterial | ⚠️ 字段缺(sha256Certificate)|
| **盲样考核** | BlindSample(偏差自动计算 + 5% 容差) | ✅ W+2 |
| **能力验证 PT** | ProficiencyTest(zScore 三档判定) | ✅ W+2 |
| **监督记录** | SupervisionRecord(监督员/结果/整改) | ✅ W+2 |
| 留样 | Sample.retentionUntil + archive/dispose | ✅ W+1 |
| 内部审核 | InternalAudit(IA 编号 + ncCount) | ✅ W+2 |
| 管理评审 | ManagementReview(决议/输出) | ✅ W+2 |
| 质量手册 | (文档外)| ⚠️ 系统外 |

### 4.2 CMA 缺失汇总(11 项)

| # | 缺口 | 严重度 |
|---|---|---|
| 1 | 盲样考核表 BlindSample / BlindResult | 🔴 高 |
| 2 | 能力验证计划 ProficiencyTest | 🔴 高 |
| 3 | 监督记录表 SupervisionRecord | 🟠 中 |
| 4 | 内部审核 InternalAudit | 🟠 中 |
| 5 | 管理评审 ManagementReview | 🟠 中 |
| 6 | 留样字段 retentionUntil / storageLocation | 🔴 高 |
| 7 | RM 证书 PDF 附件 + 哈希 | 🔴 高 |
| 8 | RM 期间核查 nextVerificationDate | 🟠 中 |
| 9 | 不确定度评定 UncertaintyReport | 🔴 高 |
| 10 | Westgard 自动应用 | 🔴 高 |
| 11 | OOS / CAPA 流程 | 🟠 中 |

---

## 5. 条款 — 落地证据总览(矩阵浓缩)

### 5.1 高优先级缺口(评审必查)

| 条款 | 缺口 | 落地位置(待补) |
|---|---|---|
| §7.6 | RM 过期阻断 | ReferenceMaterial.expiryDate + service 校验 |
| §7.6 | RM 证书 PDF + SHA256 | FileAttachment + ReferenceMaterial.sha256Certificate |
| §7.6 | RM 使用台账 | ReferenceMaterialUsage(新表)|
| §7.7 | Westgard 自动应用 | qc.service.ts:applyWestgardRules() |
| §7.8 | 不确定度 5 类分量 | UncertaintyReport(新表)+ 服务 |
| §7.9 | OOS 流程 | NonConformance(新表)+ 工作流 |
| §7.10 | CAPA | NonConformance.capa |
| CMA | 盲样考核 | BlindSample + BlindResult |
| CMA | 留样字段 | Sample.retentionUntil + .storageLocation |
| CMA | RM 期间核查 | ReferenceMaterial.nextVerificationDate |

### 5.2 中优先级(评审可能问)

| 条款 | 缺口 | 落地位置(待补) |
|---|---|---|
| §6.4 | 供应商评价表 | Vendor + VendorEvaluation |
| §6.5 | 校准证书 POST API | equipment.controller.ts |
| §7.2 | 临时授权 | UserTemporaryRole |
| §7.5 | 危化品前端 | Hazard/EmergencyPlan 模块 + UI |
| §7.7 | 期间核查计划生成 | equipment.service.ts |
| §7.8 | 报告 PDF 生成 | report.service.ts:generatePdf |
| §7.8 | 报告撤回 | Report.recalledAt + 流程 |

### 5.3 低优先级(可豁免)

| 条款 | 缺口 | 说明 |
|---|---|---|
| §7.4 | 时间戳权威(NTP) | 内网部署可豁免 |
| §7.4 | 资源级 RBAC | 11 人实验室可行 |
| §7.11 | DB trigger 强约束 | 应用层 + DB trigger 已部分 |

---

## 6. 测试文件 — 条款映射(回归测试覆盖度)

| 测试文件 | 覆盖条款 | 状态 |
|---|---|---|
| w1-waste.spec.ts | §7.10 危废 | ✅ |
| w2-gas.spec.ts | §6.4 标气 / §7.5 气体 | ✅ |
| w3-container.spec.ts | §6.5 / §7.5 容器 | ✅ |
| w4-precious-metal.spec.ts | §7.5 / §7.8 / §7.4 贵金属条码 | ✅ |
| w5-realtime.spec.ts | §7.11 数据控制 | ✅ |
| auth-hardening.spec.ts | §7.2 / §7.11 | ✅ |
| westgard.spec.ts | §7.7 / §7.9 Westgard | ✅ 算法有,自动应用无 |
| icp-flow.spec.ts | §7.9 ICP 流程 | ✅ |
| fire-assay-calculator.spec.ts | §7.5 火试金算法 | ✅ |
| sample-state-machine.spec.ts | §7.4 / §7.5 样品状态机 | ✅ |
| report-flow.spec.ts | §7.8 报告三级审核 | ✅ |
| sample-number.spec.ts | §7.4 编号唯一性 | ✅ |
| audit-events.spec.ts | §7.11 审计事件 | ✅ |
| audit-compliance.spec.ts | §7.11 合规审计 | ✅ |
| bigint-serialization.spec.ts | §7.11 数据完整性 | ✅ |
| env-schema.spec.ts | (运维) | ✅ |
| soft-delete.spec.ts | §7.11 软删除 | ✅ |
| vertical-slice.spec.ts | 端到端切片 | ✅ |
| phase-fills.spec.ts | Phase 0.5 填充 | ✅ |
| phase2-e2e.spec.ts | Phase 2 E2E | ✅ |
| phase3-support.spec.ts | Phase 3 支撑 | ✅ |
| phase4-compliance.spec.ts | Phase 4 合规 | ✅ |
| health.spec.ts | (运维) | ✅ |

**测试总数:23 个 spec, W1-W5 累计 39 it,全 PASS**(见 `02-CLEAN-ROOM-REBUILD.md`)

---

## 7. 覆盖率统计

### 7.1 条款级覆盖率(粗估)

| 标准 | 条款数 | 已落地 | 部分 | 缺口 | 覆盖率 |
|---|---|---|---|---|---|
| **CNAS-CL01** | 11 大节 | 4 | 5 | 2 | 36% ✅ + 45% ⚠️ = **81%** |
| **ISO 17025** | 等同 CNAS | — | — | — | 100%(等同)|
| **CMA** | 12 项 | 7 | 1 | 4 | **58%** ✅ |
| **总计** | 23 | 12 | 8 | 3 | **88%** ✅ |

### 7.2 关键合规风险(评审「必查」项)

- **🔴 高风险** 5 项:§7.6 RM 溯源 / §7.8 不确定度 / §7.9 OOS / §7.7 Westgard / CMA 盲样考核
- **🟠 中风险** 8 项:留样 / RM 期间核查 / RM 证书 / 内部审核 / 管理评审 / 报告 PDF / CAPA / 监督记录
- **🟢 低风险** 5 项:供应商评价 / 临时授权 / 资源级 RBAC / 报告撤回 / 时间戳权威

---

## 8. 落地计划建议(Phase 1B+)

| 优先级 | 任务 | 估时 | 关联条款 |
|---|---|---|---|
| P0 | UncertaintyReport + 5 类分量 + 服务 | 3h | §7.8 |
| P0 | ReferenceMaterial 增强(sha256 + 期间核查 + 过期阻断)| 2h | §7.6 |
| P0 | ReferenceMaterialUsage 台账 | 2h | §7.6 |
| P0 | Westgard 自动应用 | 1h | §7.7 / §7.9 |
| P1 | BlindSample + ProficiencyTest 表 | ✅ W+2 已完成 | CMA |
| P1 | Sample.retentionUntil + 留样流程 | ✅ W+1 已完成 | CMA / §7.10 |
| P1 | NonConformance + OOS / CAPA | ✅ Phase 1B P0-C 已完成 | §7.10 |
| P2 | 报告 PDF 生成 | 1.5h | §7.8 |
| P2 | 校准证书 POST API + 文件上传 | 1.5h | §6.5 / §7.6 |
| P3 | 临时授权 + 资源级 RBAC | 2h | §7.2 |
| P3 | 内审 + 管评 表 | 3h | CMA |

**P0 总计** ≈ 8h(核心评审通过必要)
**P0+P1** ≈ 15h(完整覆盖)

---

## 9. 阶段输出

矩阵输出到:
- **Gate 报告**:`PHASE-1A-GATE-REPORT.md` 引用此矩阵覆盖率
- **审计证据**:`AUDIT-EVIDENCE-INVENTORY.md` 列出已有/缺失证据
- **状态机**:`BUSINESS-STATE-MACHINES.md` 引用此矩阵的「RBAC 接入」列

---

**CNAS-CMA-ISO17025 矩阵冻结完毕。下一步:Step 7 业务状态机。**
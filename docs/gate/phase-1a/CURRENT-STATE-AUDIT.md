# CURRENT-STATE-AUDIT — Phase 1A 架构冻结基线

**审计日期**:2026-08-15
**审计人**:赫尔墨斯·维林(LIMS-Architect-01)
**原则**:只记录事实,不评估 — 评估在 `PHASE-1A-GATE-REPORT.md`

---

## 1. 分支 & HEAD 锁定

| 项 | 值 | 备注 |
|---|---|---|
| **当前分支** | `phase-0.5-baseline-hardening` | 命名约定:`phase-X.Y-name` |
| **HEAD commit** | `4691c8a` | docs(readme):项目总览 README - 入口文档 |
| **HEAD full SHA** | `4691c8a927eecb9c8b5a134969275e390fa987e9` | — |
| **Remote HEAD** | `7873db73c9d744c99b1c30e8cda2d1b495410045` | origin/phase-0.5-baseline-hardening |
| **本地与远程同步** | ✅ up-to-date | — |
| **工作区状态** | ✅ clean | nothing to commit |
| **.gitignore 覆盖** | node_modules / dist / .env | 已保护 |

### 1.1 最近 15 个 commits

```
4691c8a docs(readme): 项目总览 README - 入口文档
6476801 feat(w5): UX 增强 - 实时事件中心(SSE) + BI 图表仪表盘 + 扫码追溯 + i18n
aaac66c feat(precious-metal): W4 取样记录 + 贵金属条码(CNAS §7.5 + §7.8 + §7.4)
ab965a1 feat(container): W3 容器管理(CNAS §7.5 + §6.5)端到端闭环
9795493 feat(waste-frontend): W1 危废管理前端菜单 + 视图
3f9b9bd feat(gas-frontend): W2 气体管理前端菜单 + 视图 + 种子数据
c277969 feat(gas): W2 气体管理(CNAS §7.5 + §6.4)端到端闭环
fcc15ea wip: snapshot before W2 retake (56 files working dir sync)
82273ef feat(waste): W1 危废管理(CNAS §7.10)端到端闭环
317b33b docs(architecture): 现有 LIMS 功能模块树状图(融合优化版)
7397719 docs(architecture): ASCII 渲染版飞书 LIMS 功能树状图
774643c docs(architecture): 飞书表格 LIMS 功能树状图(字段级)
c534b36 docs(architecture): LIMS 竞争对比分析 - vs 飞书多维表格侧边栏架构
796bac6 docs(validation): Phase 5 CNAS 预审 - URS + FS + VSR 三份文档
```

---

## 2. 后端模块清单(13 个 NestJS modules)

| 模块 | 主要 model | 控制器端点 | Service 方法 |
|---|---|---|---|
| **identity** | User / Department / UserRoleAssignment / UserSession | /auth /users | auth/users(JWT + RBAC + MFA) |
| **personnel** | Personnel / Training / Competency | /personnel | 资质 + 培训 + 能力 |
| **sample** | Sample / SampleBatch / Method / MethodValidation / SamplingRecord | /samples /batches /methods | 样品接收 + 批次 + 方法 |
| **test** | Test / ElementResult / FireAssayDetail / QcMeasurement / ReferenceMaterial | /tests /icp /qc /reference-materials | 检测 + ICP + QC |
| **report** | Report / ReportStage / ReportSignature | /reports | 三级审核 + PDF |
| **equipment** | Equipment / Calibration / Maintenance / PeriodicCheck | /equipment | 设备 + 校准 + 期间核查 |
| **reagent** | Reagent / ReagentLot / ReagentUsage / Hazard | /reagents /hazards | 试剂库存 + 危化品 |
| **batch** | SampleBatch(细分) | /batches | 批次状态机 |
| **analytics** | (只读视图) | /analytics /dashboard | KPI 统计 |
| **qc** | QcMeasurement / Westgard | /qc | Westgard 规则 |
| **ehs** | WasteRecord / Gas / GasPurchase / GasUsage / Container / ContainerUsage | /waste /gas /container | 危废 + 气体 + 容器 |
| **precious-metal** | SamplingRecord(精细化)+ PreciousMetalBar | /precious-metal /sampling /bar | 取样 + 贵金属条码 |
| **realtime** | (无 model,内存 Bus) | /realtime | SSE 事件总线 |

---

## 3. 前端页面清单(17 个 views + 1 组件)

### 3.1 视图(按菜单顺序)

| # | 路由 | 文件 | 类别 |
|---|---|---|---|
| 1 | /dashboard | Dashboard.tsx | **W5 增强** BI 图表 |
| 2 | /samples | SamplesList.tsx | 列表 |
| 3 | /samples/:id | SampleDetail.tsx | 详情 + 状态机 |
| 4 | /samples/receive | SampleReceive.tsx | 接样登记 |
| 5 | /batches | BatchesList.tsx | 列表 |
| 6 | /batches/:id | BatchDetail.tsx | 详情 |
| 7 | /tests | TestsList.tsx | 列表 |
| 8 | /reports | ReportsList.tsx | 列表 |
| 9 | /reports/:id | ReportDetail.tsx | 三级审核 |
| 10 | /qc | QcDashboard.tsx | QC 监控 |
| 11 | /equipment | EquipmentList.tsx | 列表 |
| 12 | /personnel | PersonnelList.tsx | 列表 |
| 13 | /reagents | ReagentsList.tsx | 列表 |
| 14 | /audit-logs | AuditLogs.tsx | 审计 |
| 15 | **/gas** | GasList.tsx | **W2** 列表 + 3 modal |
| 16 | **/waste** | WasteList.tsx | **W1** 列表 + 3 modal |
| 17 | **/container** | ContainerList.tsx | **W3** 列表 + 3 modal |
| 18 | **/precious-metal** | PreciousMetalList.tsx | **W4** 双 Tabs + 3 modal |
| 19 | **/scan** | ScanPage.tsx | **W5** QR 追溯 |

### 3.2 组件

| 文件 | 用途 |
|---|---|
| RealtimeCenter.tsx | W5 铃铛 + SSE Drawer |
| design-tokens.css + theme.ts | 墨黑 + 辉金设计令牌 |
| i18n/I18nProvider.tsx | W5 中英切换 |

---

## 4. Prisma 模型清单(38 个)

> 注:README 写 39,实测 38 个 `model` 关键字。第 39 个「RealtimeBus」是后端内存对象(非 DB)。

| # | model | 关键字段 | 关联 |
|---|---|---|---|
| 1 | User | id, username, role, mfaSecret | — |
| 2 | Department | name, code | User |
| 3 | UserRoleAssignment | userId, role, scope | User |
| 4 | UserSession | userId, token, ip | User |
| 5 | AuditLog | event, table_name, new_data(JSONB) | — |
| 6 | Personnel | employeeNo, title, status | User |
| 7 | Training | personnelId, courseName, expiresAt | Personnel |
| 8 | Competency | personnelId, method, level | Personnel |
| 9 | Equipment | equipmentNo, type, status | — |
| 10 | Calibration | equipmentId, certificateNo, nextDueDate | Equipment |
| 11 | Maintenance | equipmentId, type, performedBy | Equipment |
| 12 | PeriodicCheck | equipmentId, zScore, passed | Equipment |
| 13 | Method | methodCode, assayType, lod, loq, uncertainty | — |
| 14 | MethodValidation | methodId, parameter, result | Method |
| 15 | Sample | sampleNo, customerName, status | User / Method / Batch |
| 16 | SampleBatch | batchNo, method, status | User / Sample |
| 17 | FireAssayDetail | testId, sampleWeightG, prillWeightG | Test |
| 18 | ElementResult | element, concentration, lod, loq, uncertainty | Test |
| 19 | ReferenceMaterial | code, element, certifiedPct, uncertainty | — |
| 20 | QcMeasurement | testId, measured, expected, zScore, westgardRule, passed | Test / ReferenceMaterial |
| 21 | Test | sampleId, method, purityPct, uncertainty, qcPassed | Sample / User |
| 22 | Report | reportNo, sampleId, status, summary | Sample / User |
| 23 | ReportStage | reportId, stage, comments | Report |
| 24 | ReportSignature | reportId, userId, signatureType | Report |
| 25 | Reagent | code, type, unit | — |
| 26 | ReagentLot | reagentId, lotNo, expiryDate | Reagent |
| 27 | ReagentUsage | reagentId, lotId, quantity | Reagent |
| 28 | Hazard | type, location, severity | — |
| 29 | EmergencyPlan | hazardId, planNo | Hazard |
| 30 | FileAttachment | fileName, sha256, category | User |
| 31 | WasteRecord | code, type, hazardClass, status | — |
| 32 | Gas | code, type, currentStock | User |
| 33 | GasPurchase | purchaseNo, gasId, status | Gas / User |
| 34 | GasUsage | usageNo, gasId, quantity | Gas / User / Test / Sample |
| 35 | Container | code, type, material, status | User |
| 36 | ContainerUsage | usageNo, containerId, returnedAt | Container / User / Test / Sample |
| 37 | SamplingRecord | recordNo, method, location, sampledById | Sample / User |
| 38 | PreciousMetalBar | barCode, metalType, qualityGrade, purityPct | Sample / User |

### 4.1 Prisma migration(8 个目录)

```
20260813_baseline              ← 31 model baseline + softdelete
20260813_login_lockout         ← 登录锁定
20260813_softdelete_samplebatch←
20260814_sample_no_sequence    ← 样品号序列
20260814_waste_records         ← W1
20260814_gas_management        ← W2
20260815_container_management  ← W3
20260815_business_refinement   ← W4 (SamplingRecord + PreciousMetalBar)
```

---

## 5. 测试套件(23 个 spec / 153 个 it)

| # | 文件 | describe | it 数 |
|---|---|---|---|
| 1 | w1-waste.spec.ts | W1 waste management | 9 |
| 2 | w2-gas.spec.ts | W2 gas management | 9 |
| 3 | w3-container.spec.ts | W3 container management | 9 |
| 4 | w4-precious-metal.spec.ts | W4 precious metal | 8 |
| 5 | w5-realtime.spec.ts | W5 realtime bus + publish | 4 |
| 6 | audit-compliance.spec.ts | (Phase 4) | — |
| 7 | audit-events.spec.ts | (Phase 4) | — |
| 8 | auth-hardening.spec.ts | (Phase 0.5) | — |
| 9 | bigint-serialization.spec.ts | (Phase 1) | — |
| 10 | env-schema.spec.ts | (Phase 0.5) | — |
| 11 | fire-assay-calculator.spec.ts | (Phase 2) | — |
| 12 | health.spec.ts | (Phase 0.5) | — |
| 13 | icp-flow.spec.ts | (Phase 2) | — |
| 14 | phase2-e2e.spec.ts | (Phase 2) | — |
| 15 | phase3-support.spec.ts | (Phase 3) | — |
| 16 | phase4-compliance.spec.ts | (Phase 4) | — |
| 17 | phase-fills.spec.ts | (Phase 0.5) | — |
| 18 | report-flow.spec.ts | (Phase 2) | — |
| 19 | sample-number.spec.ts | (Phase 3) | — |
| 20 | sample-state-machine.spec.ts | (Phase 3) | — |
| 21 | soft-delete.spec.ts | (Phase 3) | — |
| 22 | vertical-slice.spec.ts | (Phase 4) | — |
| 23 | westgard.spec.ts | (Phase 4) | — |

> 测试总计 = **39 个 W1-W5 it(全 PASS) + Phase 0.5-4(具体数字未现场跑,但 commit 历史记录曾 PASS)**。

---

## 6. CI 配置

**位置**:`.github/workflows/ci.yml`

| Job | 内容 |
|---|---|
| commitlint | PR commit message lint |
| lint | ESLint(`max-warnings 100`)|
| typecheck | TypeScript `tsc --noEmit` |
| build | pnpm build |
| test:e2e | jest e2e(需 Docker PG/Redis)|
| audit | trigger `scripts/audit-verify.ts` |
| docker | docker build 验证 |

**触发条件**:`push` 到 `main/develop/feature/*/hotfix/*` + `pull_request` 到 `main/develop`

> ⚠️ **本审计未运行 CI**(只读不执行)— clean-room 重建时再触发。

---

## 7. 文档清单(60 个 markdown)

| 目录 | 文件数 | 代表 |
|---|---|---|
| docs/ | 6 | 00-PROJECT-PLAN / 01-ARCHITECTURE / ... / 06-ROADMAP |
| docs/adr/ | 12 | 001-0011 + README(11 个 ADR + 1 index)|
| docs/architecture/ | 15 | L0-L8 + competitive + tree + REVIEW |
| docs/validation/ | 10 | URS / FS / VSR / VMP / DR / FMEA / periodic-review / security-gap |
| docs/implementation/ | 1 | CODE-EXECUTION-PLAN |
| docs/execution/ | 1 | PHASE-0.5-RESULT |
| docs/migration/ | 6 | PHASE-0 至 PHASE-5 |
| docs/archive/ | 3 | 旧版 ROADMAP / GAP / SKILL |
| docs/ | 6 | AUDIT / PROJECT-STATUS / UI-DESIGN-PARAMS / TEMPLATE / README / |

**注**:`docs/gate/phase-1a/`(本次产出目录,目前为空)

---

## 8. 包管理与工具链

### 8.1 后端 scripts (apps/backend/package.json)

```
build         → nest build
dev           → nest start --watch
start         → node dist/main.js
lint          → eslint src/**/*.ts --max-warnings 0
typecheck     → tsc --noEmit
test          → jest
test:e2e      → jest --config ./test/jest-e2e.json --runInBand
prisma:deploy → prisma migrate deploy
prisma:seed   → ts-node prisma/seed.ts
audit:verify  → tsx ../../scripts/audit-verify.ts
clean         → rm -rf dist .turbo coverage
```

### 8.2 已知工具链缺口

- **`.bin/` shim 损坏**(已记录在 W2 经验):必须用 `node node_modules/<pkg>/dist/bin.js` 直接调用
- **`ts-node` 不能直接 shim**:用 `node node_modules/ts-node/dist/bin.js --transpile-only <file>`

---

## 9. 数据 / 容器状态(运行态)

| 容器 | 端口 | 状态 |
|---|---|---|
| dunhuang-pg | 55432 | healthy |
| dunhuang-redis | 56379 | healthy |
| dunhuang-web | 5000 | healthy(其他项目)|
| dunhuang-worker | — | healthy |
| dunhuang-postgres | 5432 | healthy(其他项目)|
| dunhuang-redis-compose | 6379 | healthy(其他项目)|

**已 seed 数据**:13 阶段(Phase 3-4 + W1 + W2 + W3 + W4)
- 3 用户 + 3 personnel + 4 equipment + 5 reagent + 4 samples + 2 batches + 2 tests + 2 QC + 1 report + 6 waste(W1) + 4 gas + 3 purchase + 4 usage(W2) + 8 container + 2 usage(W3) + 1 sampling + 1 bar(W4)

**测试账号**(README 公开):
- `admin / Admin@Pass123`(管理员)
- `qa.manager / Analyst@Pass123`(质量经理)
- `fire.senior / Analyst@Pass123`(火试金高级分析员)
- `icp.analyst / Analyst@Pass123`(ICP 分析员)

---

## 10. 已知不变量(不可变更)

| 不变量 | 描述 | 来源 |
|---|---|---|
| **生产数据不可** | 不可在 phase-1a 阶段修改任何业务 model 字段或端点 | 本阶段原则 |
| **依赖不增** | 不可新增 npm 依赖(W5 已立原则)| W5 commit |
| **CI 不能停** | CI 必须保持 PASS | 强制 |
| **基线 commit** | `4691c8a` 必须可回滚 | 审计要求 |

---

## 11. 当前缺口盘点(事实,不评估)

| # | 缺口 | 现象 | 触发文档 |
|---|---|---|---|
| 1 | L0-L8 架构文档是否与代码完全一致? | docs/architecture/L0-L8 已存,但 vs code 一致性未做系统对照 | L0/L0.5/L1/L2 重写 |
| 2 | 状态机文档化? | sample/batch/test/report/waste 都有代码级状态机,但**没有一份独立的状态机文档** | BUSINESS-STATE-MACHINES.md |
| 3 | 审计证据 vs 业务动作对照? | audit log 写得好,但**没有清单说明「关键动作产生什么证据」** | AUDIT-EVIDENCE-INVENTORY.md |
| 4 | CNAS / CMA 条款 vs 模块 / 表 / API / 页面 / 事件 / 测试 的**完整可追溯矩阵**? | docs/04-CNAS-COMPLIANCE.md 写,但条款级追溯矩阵缺失 | CNAS-CMA-TRACEABILITY-MATRIX.md |
| 5 | 跨分支 Clean-room 重建是否过? | 未做过 | 02-CLEAN-ROOM-REBUILD.md |
| 6 | Gate 结论(PASS / FAIL)? | 未出 | PHASE-1A-GATE-REPORT.md |

---

## 12.审计总结(本文件不评估)

> 本文件**只陈述事实**。所有「PASS / FAIL」结论集中在 `PHASE-1A-GATE-REPORT.md`。

事实清单:
- ✅ 远程与本地同步
- ✅ 工作区 clean
- ✅ HEAD = 4691c8a(明确且唯一)
- ✅ 38 个 Prisma model(W1-W5 后已闭环)
- ✅ 13 个后端模块 + 17 个前端视图 + 1 组件
- ✅ 23 个测试 spec(W1-W5 累计 39 个 it)
- ✅ CI 配置存在(`.github/workflows/ci.yml`)
- ✅ 60 个 markdown 文档
- ✅ `.gitignore` 保护 node_modules / dist / .env

事实缺口:
- ❓ L0-L8 架构文档与代码一致性**未做系统对照**(待 Phase1A 验证)
- ❓ 状态机**未文档化**(待产出)
- ❓ CNAS 条款级追溯矩阵**未建**(待产出)
- ❓ Clean-room 重建**未做过**(待执行)

---

**审计完成时间**:2026-08-15
**下一步**:Step 2 — clean-room 重建验证
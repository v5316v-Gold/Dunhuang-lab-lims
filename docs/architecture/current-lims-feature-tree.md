# 现有 LIMS 功能模块树状图(融合优化版)

> **基线**: Dunhuang-LIMS Phase 0.5-4 已完成(30 模型 11 模块 76+ 测试 PASS)
> **融合**: 飞书 GDW实验室管理.xlsx 22 张表为补充来源(不绑死字段,以现有 LIMS 为主)
> **版本**: v1.0 | 2026-08-14
> **编制**: LIMS-Architect-01

---

## 1. 设计原则

| # | 原则 | 体现 |
|---|---|---|
| P1 | **以现有 LIMS 为主** | 不重构 schema,仅补充缺失能力 |
| P2 | **不绑死字段** | 飞书表头字段作为**能力指引**,实现可弹性 |
| P3 | **数据独立** | P0 缺失的三大模块(耗材/气体/废料)独立模型,不与现有表耦合 |
| P4 | **审计闭环** | 每个新模块自动接入 SHA256 审计链 |
| P5 | **CNAS 优先** | P0 三项直接影响 §6.4(器具校准) / §7.10(不符合工作) |

---

## 2. 三层架构树(模块 → 子模块 → 功能)

### 2.1 模块全景(11 + 4 = 15 个)

```
Dunhuang LIMS
│
├── A. 核心业务域 (10 模块) ✅ 全部落地
│   ├── A1 样品 (Sample + SampleBatch)         ── 13 个模型
│   ├── A2 检测 (Test + FireAssayDetail + ElementResult)
│   ├── A3 报告 (Report + ReportStage + ReportSignature)
│   ├── A4 QC (QcMeasurement)
│   ├── A5 设备 (Equipment + Calibration + Maintenance + PeriodicCheck)
│   ├── A6 试剂 (Reagent + ReagentLot + ReagentUsage)
│   ├── A7 人员 (Personnel + Training + Competency)
│   ├── A8 方法 (Method + MethodValidation + ReferenceMaterial)
│   ├── A9 EHS (Hazard + EmergencyPlan)
│   └── A10 分析 (analytics, 无独立模型,聚合视图)
│
├── B. 身份与权限 (1 模块) ✅
│   └── B1 身份 (User + Department + UserRoleAssignment + UserSession)
│
└── C. 横切基础 (1 个 prisma 触发器集)
    ├── C1 审计 (AuditLog + 27 trigger + 3 防篡改)
    ├── C2 文件 (FileAttachment — PDF/图片附件)
    └── C3 软删除 (Prisma Extension 7 模型)
```

### 2.2 完整树状图(子模块级别)

```
Dunhuang LIMS
│
├─ 1. 样品接收管理                       [模块: A1 sample]
│   ├─ 1.1 样品接收(单样品)              Sample.create + 编号生成器(行锁)
│   │     字段: sampleNo(YYMMDD-NNNN)│customerName│sampleType
│   │            │weightG│declaredPurityPct│photoFileIds│receivedBy│storageLocation│remarks
│   ├─ 1.2 样品状态机(9 态)              sample.state-machine.ts + POST /:id/transition
│   │     RECEIVED → BATCHED → IN_TEST → TESTED → REPORT_DRAFT → REPORT_REVIEW
│   │             → REPORT_APPROVED → ARCHIVED  + 任意态可 REJECT
│   ├─ 1.3 样品列表+筛选                 GET /samples (sampleNo/customer/type/status)
│   ├─ 1.4 样品详情                      GET /samples/:id (含 tests + reports)
│   ├─ 1.5 样品软删除                    DELETE → deletedAt(Prisma Extension)
│   └─ 1.6 留样登记                      sample.storageLocation + remarks(≥6 个月,CNAS §7.4)
│
├─ 2. 批次管理                           [模块: A1 batch]
│   ├─ 2.1 批次创建                      POST /batches(method/replicateCount≥3)
│   ├─ 2.2 批次状态机(11 态)             batch.state-machine.ts(XState 5)
│   │     PENDING→MIXING→FUSING→CUPELLING→PARTING→ANNEALING→WEIGHING
│   │     →CALCULATING→COMPLETED  + 任意态可 REJECT
│   ├─ 2.3 加入样品                       POST /:id/samples(sampleIds[])
│   ├─ 2.4 批次状态推进                   POST /:id/transition(START/ADVANCE/REJECT)
│   ├─ 2.5 工艺参数记录                   POST /:id/process(furnaceTemp/cupellationMin/partingMin/annealingMin)
│   └─ 2.6 批次列表+详情                  GET /batches, GET /:id
│
├─ 3. 检测执行管理                       [模块: A2 test]
│   ├─ 3.1 创建火试金检测                  POST /tests/fire-assay(sampleId/batchId)
│   ├─ 3.2 创建 ICP 检测                  POST /tests/icp
│   ├─ 3.3 记录火试金重量(6 步守卫)      POST /tests/fire-assay/:id/weights
│   │     前序 5 步必须完成(称样→熔融→灰吹→分金→退火)才能称重
│   ├─ 3.4 添加 ICP 元素结果              POST /tests/icp/:testId/results
│   ├─ 3.5 完成检测                        POST /tests/fire-assay/:id/complete + POST /tests/icp/:id/complete
│   ├─ 3.6 检测详情(纯度+QC)               GET /tests/:testId
│   ├─ 3.7 纯度计算引擎                   fire-assay.calculator.ts
│   │     Au% = prillWeight/sampleWeight × 100 × (100/qcRecoveryPct)
│   │     Decimal.js 精度 / QC 99.5-100.5% 范围
│   └─ 3.8 纯度等级判定                   Au99999/Au9999/Au999/Au990/Au950
│
├─ 4. 质量控制(QC)                       [模块: A4 qc]
│   ├─ 4.1 录入 QC 测量                   POST /qc/measurements(testId/qcType/element/measured/expected/sd)
│   ├─ 4.2 Westgard 规则引擎              westgard.service.ts(5 规则)
│   │     1�s / 2₂s / R₄s / 4₁s / 10x
│   ├─ 4.3 QC 趋势图                       GET /qc/trend(element/days)
│   ├─ 4.4 Westgard 评估                  GET /qc/westgard(element)
│   ├─ 4.5 QC 汇总                         GET /qc/summary(days)
│   └─ 4.6 QC 失败联动(待加)             批次自动 REJECTED
│
├─ 5. 报告管理                           [模块: A3 report]
│   ├─ 5.1 创建报告(快照)                 POST /reports(sampleId)
│   │     自动生成 summary(样品/检测/纯度/QC/元素结果)+ pdfSha256
│   ├─ 5.2 三级审核状态机(纯函数)         report.state-machine.ts(7 态)
│   │     DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
│   ├─ 5.3 报告状态推进                   POST /:id/transition(action: SUBMIT/REVIEW_PASS/APPROVE/ISSUE/REVIEW_REJECT)
│   ├─ 5.4 报告电子签名                   POST /:id/sign(userId/role/certificateSerial)
│   │     内容哈希 SHA256(reportNo+summary+signedAt) + Mock TSA token
│   │     仅 APPROVED 状态可签
│   ├─ 5.5 报告详情                       GET /:id
│   ├─ 5.6 报告 PDF 生成                  report-pdf.service.ts(纯 Node PDF 1.4)
│   └─ 5.7 报告列表                       GET /reports
│
├─ 6. 设备管理                           [模块: A5 equipment]
│   ├─ 6.1 设备信息                       Equipment CRUD(type/model/serialNo/location)
│   ├─ 6.2 设备健康状态(三查)             equipment.service.getEquipmentHealthStatus()
│   │     校准 + 维护 + 期间核查 → HEALTHY/ATTENTION
│   ├─ 6.3 校准记录                       POST /:id/calibrations(certificateNo/nextDueDate)
│   ├─ 6.4 校准可用性检查                  equipment.service.isUsableForTesting()
│   │     CNAS §6.4:过期设备禁止用于检测
│   ├─ 6.5 维护记录                       POST /:id/maintenances(maintenanceType/nextDueDate)
│   ├─ 6.6 期间核查                       POST /:id/periodic-checks(performedBy/passed/zScore)
│   └─ 6.7 设备退役                       POST /:id/retire
│
├─ 7. 试剂管理                           [模块: A6 reagent]
│   ├─ 7.1 试剂基本信息                   Reagent CRUD(code/casNo/purity/safetyStock)
│   ├─ 7.2 入库批号                       ReagentLot.addLot(lotNo/expiryDate/quantity)
│   ├─ 7.3 出库记录                       ReagentUsage.recordUsage(quantity/testId/operatorId)
│   │     Decimal 原子扣减 + 库存预警
│   ├─ 7.4 库存预警                      reagent.service.getLowStockAlerts()
│   │     remainingQty ≤ safetyStock
│   ├─ 7.5 效期预警(30 天)               ReagentLot.expiryDate
│   └─ 7.6 试剂列表+详情                  GET /reagents
│
├─ 8. 人员管理                           [模块: A7 personnel]
│   ├─ 8.1 人员档案                       Personnel CRUD(employeeNo/title)
│   ├─ 8.2 培训记录                       personnel.addTraining(trainingType/result/certificateNo)
│   ├─ 8.3 能力矩阵                       personnel.addCompetency(method/level/certifiedAt/expiresAt)
│   ├─ 8.4 能力授权检查                  personnel.hasValidCompetency(method)
│   │     4 态:无授权/过期/TRAINEE 拒/SENIOR 通过
│   └─ 8.5 能力矩阵汇总                   GET /personnel/matrix/competencies
│
├─ 9. 方法管理                           [模块: A8 method]
│   ├─ 9.1 方法基本信息                   Method CRUD(methodCode/standard/equipmentType)
│   ├─ 9.2 方法验证记录                   MethodValidation(parameter/range/accuracy/uncertainty)
│   └─ 9.3 标准物质                       ReferenceMaterial(certNo/expiryDate/certifiedValue)
│
├─ 10. EHS / 实验室安全                  [模块: A9 ehs]
│   ├─ 10.1 隐患登记                      EhsService.createHazard(severity/location)
│   ├─ 10.2 隐患查询                      GET /ehs/hazards
│   ├─ 10.3 隐患处理                       EhsService.resolveHazard
│   └─ 10.4 应急预案                       EmergencyPlan(planNo/scenario/steps)
│
├─ 11. 数据分析                          [模块: A10 analytics]
│   ├─ 11.1 趋势聚合                      GET /analytics/trend
│   ├─ 11.2 数据保留                      DataRetentionService.execute(dryRun)
│   │     归档(>1 年)+ 销毁(>5 年) + dryRun
│   └─ 11.3 备份恢复演练                  DR-2026-08(RTO 实测 10s)
│
├─ 12. 身份与权限                       [模块: B1 identity]
│   ├─ 12.1 登录                          POST /auth/login → JWT + Refresh
│   ├─ 12.2 刷新 Token                    POST /auth/refresh
│   ├─ 12.3 MFA(TOTP)                    POST /auth/mfa/enable + /verify
│   ├─ 12.4 部门管理                      Department CRUD
│   ├─ 12.5 角色分配                      UserRoleAssignment(role/permissions)
│   ├─ 12.6 Session 管理                  UserSession
│   └─ 12.7 退出                          POST /auth/logout
│
├─ 13. 审计与合规                       [横切 C1]
│   ├─ 13.1 审计日志(append-only)        AuditLog + 27 trigger
│   ├─ 13.2 防篡改三层                   trigger UPDATE/DELETE/TRUNCATE 拒绝
│   ├─ 13.3 审计链 verify                GET /audit-logs/verify(返回 passed: bool)
│   └─ 13.4 手动事件(系统/安全)         SecurityAuditService(4 类 15 事件)
│
├─ 14. 文件附件                          [横切 C2]
│   ├─ 14.1 文件上传                     FileAttachment(model/originalName/mime/size/sha256)
│   ├─ 14.2 检定证书附件                  Calibration.certificateFileId(待前端上传入口)
│   ├─ 14.3 采购单据附件                  GasPurchase.attachment(微信图片/PDF)
│   └─ 14.4 样品照片                      Sample.photoFileIds[]
│
└─ 15. 软删除                            [横切 C3]
    ├─ 15.1 软删除过滤                  Prisma Extension(7 模型自动过滤 deletedAt)
    ├─ 15.2 数据保留与销毁              dataRetentionService(归档 >1 年,销毁 >5 年)
    └─ 15.3 归档审计留痕                 SECURITY:SETTINGS_CHANGED 事件
```

---

## 3. 飞书 22 表能力映射(到现有架构,标记已覆盖/部分覆盖/缺失)

### 3.1 完整映射表

| # | 飞书功能 | 行数 | 映射到现有 LIMS | 状态 | 改进建议 |
|---|---|---|---|---|---|
| **1.1** | 【车间】送样返样 | 316 | A1 Sample + transition(TO_BATCH) | ✅ | — |
| **1.2** | 【国外】送样返样 | 2 | Sample.sourceType(需新增枚举) | 🟡 | 加 Sample.sourceType = FOREIGN + hsCode/customsRef/exchangeRate/origin 字段 |
| **1.3** | 【贵金属】入库 | 107 | 用 A6 Reagent 兼代(概念错位) | 🟡 | 新增 **PreciousMetalBar** 模型(金条独立于试剂) |
| **1.4** | 【贵金属】出库 | 126 | 同上 | 🟡 | 同上 + 出库类型(学习/生产/个人)字段 |
| **1.5** | 【贵金属】库存 | 12 | 简易库存预警 | 🟡 | PreciousMetalBar 独立盘点 + 月份分区 |
| **2.1** | 检测领样 | 326 | Test.create + Sample BATCHED | 🟡 | 新增 **SamplingRecord** 实体(领样单) |
| **2.2** | 【国外】检测领样 | 2 | 同 2.1 | 🟡 | + 国际样品字段 |
| **2.3** | 检测记录 | 432 | Test + FireAssayDetail + ElementResult | ✅ 完整 | — |
| **2.4** | 【国外】检测记录 | 2 | 同 2.3 | ✅ 完整 | — |
| **2.5** | 人员信息 | 7 | Personnel + Training + Competency | ✅ | + 检测组/工号字段 |
| **3.1** | **器皿管理** | **150** | **无** | 🔴 **P0-1** | **新增 Container + ContainerUsage(损耗字段)** |
| **4.1** | 采购记录(气体) | 18 | 无 | 🔴 **P0-2a** | 新增 GasPurchase |
| **4.2** | 使用记录(气体) | 161 | 无 | 🔴 **P0-2b** | 新增 GasUsage(父记录溯源链) |
| **4.3** | 库存记录(气体) | 3 | 无 | 🔴 **P0-2c** | 新增 Gas 库存表 |
| **5.1** | 【入库】试剂 | 38 | Reagent.addLot | ✅ | + 试剂图片附件 |
| **5.2** | 【出库】试剂 | 107 | ReagentUsage | ✅ | — |
| **5.3** | 【库存】试剂 | 8 | findAll + getLowStockAlerts | ✅ | + 月份分区索引 |
| **5.4** | 【记录】取用 | 369 | ReagentUsage | ✅ | — |
| **6.1** | 设备信息 | 37 | Equipment | ✅ | + 重要等级/配件字段 |
| **6.2** | 检定记录 | 70 | Calibration | ✅ | + 检定类型/单位 |
| **6.3** | 维保记录 | 1969 | Maintenance + PeriodicCheck | ✅ | + 维护内容字段 |
| **7.1** | **废液废样登记** | **10** | **无** | 🔴 **P0-3** | **新增 WasteRecord + 处置闭环** |

### 3.2 覆盖统计

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 完整覆盖 | 13 | 59% |
| 🟡 部分覆盖 | 6 | 27% |
| 🔴 完全缺失 | 3 | 14% |

---

## 4. P0 三大缺失模块详细设计

### 4.1 🔴 器皿管理(`Container` + `ContainerUsage`)

**为什么 P0**:CNAS §6.4 设备管理覆盖"仪器",但器皿(坩埚/烧杯)属灰色地带;实际损耗影响定量结果

```
器皿管理
├── 模型 Container(15 字段)
│   ├── code 唯一编号(如 V-200ML-001)
│   ├── name 类型(CRUCIBLE/BEAKER/FLASK/PIPETTE/CYLINDER/CAPACITANCE)
│   ├── material(QUARTZ/PLATINUM/GLASS/POLYETHYLENE)
│   ├── capacityMl 容量(ml)
│   ├── totalQuantity 入库总数
│   ├── inUse 在用数
│   ├── damaged 已损耗数(关键:CNAS 损耗记录)
│   ├── available = total - inUse - damaged(计算列)
│   ├── purchaseDate / retireDate / status(IN_USE/RETIRED/DISPOSED)
│   ├── responsiblePersonId(使用人)
│   ├── location(天平室/ICP室/火试金室)
│   ├── remarks + photoFileIds(实物照)
│   └── createdAt/updatedAt/deletedAt(软删除)
│
├── 模型 ContainerUsage(样品-器皿关联)
│   ├── containerId / sampleId / testId
│   ├── borrowedAt / returnedAt
│   ├── conditionAtReturn(NORMAL/DAMAGED/CLEANED/LOST)
│   ├── damagedDelta(本次损耗增量)
│   └── signedBy(电子签退)
│
└── 模块 container/(CRUD +5 端点)
    ├── POST /containers              新增器皿入库
    ├── GET  /containers              列表+筛选
    ├── GET  /containers/:id          详情+使用历史
    ├── POST /containers/:id/usage    出借+归还登记
    └── GET  /containers/inventory     库存盘点
```

### 4.2 🔴 气体管理(`Gas` + `GasPurchase` + `GasUsage`)

**为什么 P0**:氩气(ICP)与乙炔(火试金)是检测必备消耗品,采购/使用/库存失控将直接影响生产

```
气体管理
├── 模型 Gas(库存实体)
│   ├── code 编号(如 GAS-AR-001)
│   ├── type(ARGON/ACETYLENE/OXYGEN/NITROGEN)
│   ├── purity 纯度(如 99.999%)
│   ├── cylinderSpec 规格(40L/50L)
│   ├── currentQuantity 当前瓶数(支持 0.5 瓶)
│   ├── location / responsiblePersonId
│   ├── nextInspectionDate 检定到期
│   └── status(IN_STOCK/IN_USE/EXHAUSTED/RETIRED)
│
├── 模型 GasPurchase(采购单)
│   ├── gasId / code
│   ├── purchaseDate / manufacturer
│   ├── quantity 采购瓶数
│   ├── unitPrice / totalPrice
│   ├── invoiceFileId(发票附件)
│   ├── inspectionCertFileId(检定证书附件)
│   └── purchaserId
│
├── 模型 GasUsage(使用追溯链)
│   ├── gasId / purchaseId(父记录,溯源到采购)
│   ├── testId(关联检测任务)
│   ├── usedDate / quantity(瓶)
│   ├── usedById(检测员)
│   └── remarks
│
└── 模块 gas/(CRUD +6 端点)
    ├── POST /gas                新增气体库存项
    ├── GET  /gas                列表+预警
    ├── POST /gas/:id/purchase  采购登记
    ├── POST /gas/:id/usage     使用登记
    ├── GET  /gas/inventory      库存盘点(支持 0.5 瓶)
    └── POST /gas/:id/inspect   检定记录
```

### 4.3 🔴 废料管理(`WasteRecord` + `WasteManifest`)

**为什么 P0**:CNAS §7.10 不符合工作强制项;危废处置合规(对接《国家危险废物名录》HW34 废酸)

```
废料管理
├── 模型 WasteRecord(废液/废样登记)
│   ├── code 编号(如 WT-2025-001)
│   ├── type(WASTE_LIQUID/SAMPLE/SOLVENT/OTHER)
│   ├── hazardClass(废酸 HW34/含汞 HW29/含氰 HW37 等)
│   ├── sourceType(TEST/SAMPLE_PREP/CLEANING)
│   ├── sourceTestId(若来自某次检测)
│   ├── weightKg 重量(kg)
│   ├── containerCount 容器数量
│   ├── generatedAt 产生时间
│   ├── storageLocation 暂存区
│   ├── hazardManagerId 危废管理负责人
│   ├── status(STORED/TRANSFERRED/INCINERATED/RECYCLED/RECYCLED_GOLD)
│   ├── transferredAt / receiverName / receiverLicenceNo(危废处置企业资质证号)
│   ├── transferManifestNo 转移联单编号
│   ├── transferManifestFileId(电子联单 PDF)
│   └── disposalAt 处置完成时间
│
├── 模型 WasteManifest(电子转移联单,可选)
│   └── 与 WasteRecord 一对多(每批转移一张联单)
│
└── 模块 waste/(CRUD +4 端点)
    ├── POST /waste                   新增废料登记
    ├── GET  /waste                   列表(按状态/类型)
    ├── POST /waste/:id/transfer      转移登记(双字段校验)
    └── GET  /waste/summary           危废合规摘要(CNAS 评审)
```

---

## 5. 飞书 vs 现有架构对应能力分布

```
飞书 8 大模块        现有 30 模型对应度
─────────────────────────────────────────────────
1. 收发台账(5)        Sample + SampleBatch + PreciousMetalBar(待) → 🟡 80%
2. 检测数据(5)        Test + FireAssayDetail + ElementResult + Qc + Report → ✅ 90%
3. 耗材管理(1)        Container(待 P0-1)               → 🔴 0%
4. 气体管理(3)        Gas(待 P0-2)                    → 🔴 0%
5. 试剂管理(4)        Reagent + ReagentLot + Usage    → ✅ 100%
6. 设备管理(3)        Equipment + Calibration + Maintenance + PeriodicCheck → ✅ 100%
7. 废料管理(1)        WasteRecord(待 P0-3)           → 🔴 0%
─────────────────────────────────────────────────
合计 22/22 → 当前覆盖 14(64%) → 改进后 22/22(100%)
```

---

## 6. 实施优先级路线

| 阶段 | 周次 | 内容 | 影响 |
|---|---|---|---|
| **P0-3 废料管理** | W1 | WasteRecord 模型 + 模块 + 端点 + 测试 | CNAS §7.10 闭环 |
| **P0-2 气体管理** | W2 | Gas + GasPurchase + GasUsage 模型 + 模块 + 测试 | ICP/火试金生产保障 |
| **P0-1 器皿管理** | W3 | Container + ContainerUsage 模型 + 模块 + 测试 | §6.4 器具合规 |
| **P1 业务细化** | W4 | SamplingRecord + 国外字段 + PreciousMetalBar | 业务完整性 |
| **P2 体验增强** | W5 | QR/RFID + WebSocket + BI 看板 + i18n | 体验升级 |

**5 周达成 100% 飞书能力覆盖 + CNAS 评审准备窗口(2026-11-03)**

---

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-14 | 首次发布(以现有 LIMS 为主 + 飞书融合) | LIMS-Architect-01 |

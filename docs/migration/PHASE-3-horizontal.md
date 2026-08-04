# Phase 3:横向扩展(第 7-10 周)

> **周期**: 2026-09-22 ~ 2026-10-19(4 周,20 工作日)
> **目标**: 13 个核心模块全部上线,业务能力完整
> **业务核心**: 在 Phase 2 MVP 基础上扩展剩余模块
> **负责人**: 后端工程师 + 前端工程师 + 天枢(Review)

## 1. 任务清单

### Week 1(第 7 周):人员 + 培训 + 能力矩阵

#### Day 1-2:人员管理

- [ ] **Task 3.1**: 创建 `apps/backend/src/modules/personnel/`
  - `personnel.module.ts`
  - `personnel.controller.ts`
  - `personnel.service.ts`
  - `personnel.repository.ts`
  - `dto/create-personnel.dto.ts`

- [ ] **Task 3.2**: 实现人员 API
  - `POST /personnel` 创建人员(employeeNo / name / gender / birthDate / idCard / phone / email / education / title / certNo / hiredate)
  - `GET /personnel` 列表(分页 + 过滤)
  - `GET /personnel/:id` 详情
  - `PATCH /personnel/:id` 更新
  - `POST /personnel/:id/user` 关联用户账户

- [ ] **Task 3.3**: 前端人员管理页面
  - `apps/frontend/src/views/personnel/List.tsx`
  - `apps/frontend/src/views/personnel/Detail.tsx`

#### Day 3-4:培训管理

- [ ] **Task 3.4**: 实现培训 API
  - `POST /trainings` 创建培训(trainingType / trainingName / trainingDate / durationHours / trainer / content / result / certificateNo / certificateFileId)
  - `GET /personnel/:id/trainings` 人员培训记录
  - `POST /trainings/:id/attach-cert` 上传培训证书(MinIO)

- [ ] **Task 3.5**: 前端培训管理页面
  - `apps/frontend/src/views/personnel/Trainings.tsx`

#### Day 5:能力矩阵

- [ ] **Task 3.6**: 实现能力矩阵 API
  - `POST /competencies` 创建能力记录(personnelId / method / level / certifiedAt / expiresAt)
  - `GET /personnel/:id/competencies` 人员能力
  - `GET /competencies/matrix` 全员能力矩阵(用于排班)
  - `POST /competencies/:id/renew` 续证

- [ ] **Task 3.7**: 前端能力矩阵页面
  - `apps/frontend/src/views/personnel/CompetencyMatrix.tsx`(表格:人员 × 方法)

### Week 2(第 8 周):设备 + 校准 + 维护 + 期间核查

#### Day 6-8:设备管理

- [ ] **Task 3.8**: 创建 `apps/backend/src/modules/equipment/`
  - `equipment.module.ts`
  - `equipment.controller.ts`
  - `equipment.service.ts`
  - `equipment.repository.ts`
  - `equipment.lifecycle.ts`(全生命周期状态机)

- [ ] **Task 3.9**: 实现设备 API
  - `POST /equipment` 创建设备(equipmentNo / name / type / model / serialNo / manufacturer / purchaseDate / warrantyExpiresAt / location)
  - `GET /equipment` 列表(分页 + 过滤)
  - `GET /equipment/:id` 详情
  - `PATCH /equipment/:id` 更新
  - `POST /equipment/:id/retire` 报废

- [ ] **Task 3.10**: 设备类型枚举(敦煌金专用)
  ```prisma
  enum EquipmentType {
    FIRE_ASSAY_FURNACE      // 试金炉
    CUPELLATION_FURNACE     // 灰吹炉
    ANALYTICAL_BALANCE      // 分析天平
    ICP_OES                 // ICP-OES
    ICP_MS                  // ICP-MS
    XRF                     // X 射线荧光光谱仪
    MICROWAVE_DIGESTION     // 微波消解仪
    WATER_PURIFIER          // 超纯水机
    OTHER
  }
  ```

#### Day 9-10:校准 + 维护 + 期间核查

- [ ] **Task 3.11**: 实现校准 API
  - `POST /calibrations` 创建校准记录(equipmentId / calibrationDate / calibrationOrg / certificateNo / certificateFileId / result / nextDueDate)
  - `GET /equipment/:id/calibrations` 设备校准历史
  - `GET /calibrations/due-soon?days=30` 即将到期校准

- [ ] **Task 3.12**: 实现维护 API
  - `POST /maintenances` 创建维护记录(equipmentId / maintenanceType / maintenanceDate / performedBy / content / nextDueDate)
  - `GET /equipment/:id/maintenances` 设备维护历史

- [ ] **Task 3.13**: 实现期间核查 API
  - `POST /periodic-checks` 创建期间核查(equipmentId / checkDate / performedBy / result / remarks)
  - `GET /periodic-checks/due-soon?days=7` 即将到期核查

- [ ] **Task 3.14**: 前端设备管理页面
  - `apps/frontend/src/views/equipment/List.tsx`
  - `apps/frontend/src/views/equipment/Detail.tsx`(含校准/维护/核查历史)
  - `apps/frontend/src/views/equipment/CalibrationSchedule.tsx`

### Week 3(第 9 周):试剂耗材 + 库存 + 预警

#### Day 11-12:试剂耗材管理

- [ ] **Task 3.15**: 创建 `apps/backend/src/modules/reagent/`
  - `reagent.module.ts`
  - `reagent.controller.ts`
  - `reagent.service.ts`
  - `reagent.repository.ts`

- [ ] **Task 3.16**: 试剂类型枚举(敦煌金专用)
  ```prisma
  enum ReagentType {
    GOLD_STANDARD         // 金标准物质(GBW 系列)
    SILVER_STANDARD       // 银标准物质
    LEAD_BUTTON           // 铅粒
    BORAX                 // 硼砂
    SILICA_SAND           // 硅砂
    SODIUM_CARBONATE      // 碳酸钠
    NITRIC_ACID           // 硝酸(分金用)
    HYDROCHLORIC_ACID     // 盐酸
    AQUA_REGIA            // 王水
    HYDROFLUORIC_ACID     // 氢氟酸
    PERCHLORIC_ACID       // 高氯酸
    ICP_CALIBRATION_STD   // ICP 校准标液
    ARGON_GAS             // 氩气(ICP 用)
    OTHER
  }
  ```

- [ ] **Task 3.17**: 实现试剂 API
  - `POST /reagents` 创建试剂(name / type / casNo / purity / manufacturer / unit / packageSize / storageCondition / hazardClass)
  - `GET /reagents` 列表(分页 + 过滤)
  - `PATCH /reagents/:id` 更新

- [ ] **Task 3.18**: 实现试剂批次(关键)
  - `POST /reagent-lots` 创建批次(lotNo / reagentId / receivedDate / expiryDate / quantity / unitPrice / supplier / certificateFileId)
  - 关键字段:**certificateNo**(标准物质证书号)、**uncertainty**(不确定度)
  - `GET /reagents/:id/lots` 试剂批次列表
  - `GET /reagent-lots/expiring-soon?days=30` 即将过期

#### Day 13-14:库存管理

- [ ] **Task 3.19**: 实现库存 API
  - `GET /inventory` 库存总览(试剂 × 批次 × 余量)
  - `POST /inventory/usage` 试剂使用登记(reagentLotId / quantity / testId / operatorId)
  - `POST /inventory/discard` 试剂报废(reagentLotId / quantity / reason)
  - `GET /inventory/low-stock` 库存预警(余量 < 阈值)

- [ ] **Task 3.20**: 库存预警规则引擎
  ```typescript
  // 触发预警:余量 < 安全库存 OR 有效期 < 30 天
  ```

- [ ] **Task 3.21**: 前端试剂库存页面
  - `apps/frontend/src/views/reagent/List.tsx`
  - `apps/frontend/src/views/reagent/Lots.tsx`
  - `apps/frontend/src/views/reagent/Inventory.tsx`(含预警列表)

#### Day 15:标准物质证书管理

- [ ] **Task 3.22**: 标准物质证书(P0 关键)
  - `GET /reference-materials` 标准物质列表(Au / Ag / Pt / Pd)
  - `POST /reference-materials` 新增
  - `GET /reference-materials/:id/certificate` 下载证书 PDF(MinIO)
  - 与 `qc_measurements` 关联(火试金 QC 样 = 标准物质)

### Week 4(第 10 周):EHS 隐患 + 分析报表

#### Day 16-17:隐患管理(EHS)

- [ ] **Task 3.23**: 创建 `apps/backend/src/modules/ehs/`
  - `ehs.module.ts`
  - `ehs.controller.ts`
  - `ehs.service.ts`

- [ ] **Task 3.24**: 实现隐患 API
  - `POST /hazards` 创建隐患(source / description / severity / location / reportedBy / reportedAt)
  - `GET /hazards` 列表(过滤:severity / status)
  - `PATCH /hazards/:id` 更新(整改记录)
  - `POST /hazards/:id/resolve` 整改完成

- [ ] **Task 3.25**: 实现应急预案 API
  - `POST /emergency-plans` 创建预案(planType / title / content / version / approvedAt)
  - `GET /emergency-plans` 列表
  - `POST /emergency-drills` 演练记录

- [ ] **Task 3.26**: 前端 EHS 页面
  - `apps/frontend/src/views/ehs/Hazards.tsx`
  - `apps/frontend/src/views/ehs/EmergencyPlans.tsx`

#### Day 18-19:数据分析 + 报表

- [ ] **Task 3.27**: 创建 `apps/backend/src/modules/analytics/`
  - `analytics.module.ts`
  - `analytics.controller.ts`
  - `analytics.service.ts`
  - `analytics.timescale.ts`(时序聚合)

- [ ] **Task 3.28**: 实现分析 API
  - `GET /analytics/dashboard` 仪表盘数据(今日样品数 / 检测中 / 待审核 / 库存预警)
  - `GET /analytics/sample-trend?days=30` 样品趋势
  - `GET /analytics/method-distribution` 方法分布(火试金 / ICP / XRF)
  - `GET /analytics/customer-distribution` 客户分布
  - `GET /analytics/equipment-utilization` 设备利用率

- [ ] **Task 3.29**: 实现报表导出
  - `POST /reports/export` 生成月报/季报/年报(PDF)
  - 含数据:样品数、检测数、各方法占比、QC 趋势、客户分布、设备使用率、人员工作量

- [ ] **Task 3.30**: 前端分析报表页面
  - `apps/frontend/src/views/analytics/Dashboard.tsx`(ECharts)
  - `apps/frontend/src/views/analytics/Reports.tsx`(报表导出)

#### Day 20:周回顾 + 集成测试

- [ ] **Task 3.31**: 13 模块全部上线集成测试
- [ ] **Task 3.32**: E2E 全模块流程测试
- [ ] **Task 3.33**: 性能基线测试(Phase 5 压测对比基线)

## 2. 交付物清单

| 类别 | 文件 |
|---|---|
| **人员** | `apps/backend/src/modules/personnel/`(8 文件) + 前端 3 文件 |
| **设备** | `apps/backend/src/modules/equipment/`(10 文件) + 前端 3 文件 |
| **试剂** | `apps/backend/src/modules/reagent/`(8 文件) + 前端 3 文件 |
| **EHS** | `apps/backend/src/modules/ehs/`(5 文件) + 前端 2 文件 |
| **分析** | `apps/backend/src/modules/analytics/`(6 文件) + 前端 2 文件 |
| **标准物质** | `apps/backend/src/modules/reference-material/`(4 文件) |
| **测试** | `tests/integration/*`、`tests/e2e/*` |

## 3. 验证标准

### 功能验证

- [ ] **V-3.1**: 13 模块 API 全部上线(可在 Swagger UI 看到)
- [ ] **V-3.2**: 人员 CRUD + 培训 + 能力矩阵
- [ ] **V-3.3**: 设备 CRUD + 校准 + 维护 + 期间核查 + 到期预警
- [ ] **V-3.4**: 试剂批次 + 库存 + 使用登记 + 预警
- [ ] **V-3.5**: 隐患上报 + 整改 + 应急预案 + 演练
- [ ] **V-3.6**: 仪表盘 + 趋势 + 报表导出

### 性能验证

- [ ] **V-3.7**: 13 模块综合查询 P95 < 500ms
- [ ] **V-3.8**: 仪表盘加载 P95 < 1s(含 ECharts 渲染)

### 业务验证

- [ ] **V-3.9**: 设备校准到期前 30 天预警
- [ ] **V-3.10**: 试剂库存低于安全库存预警
- [ ] **V-3.11**: 试剂有效期前 30 天预警
- [ ] **V-3.12**: 能力矩阵:某检测任务分配 → 自动校验人员能力

## 4. 里程碑 M4:功能完整

Phase 3 完成后,LIMS 达到 **M4 里程碑:功能完整**。13 个核心模块全部上线,业务能力完整,可支撑敦煌金质检中心的全量业务。

## 5. 下阶段交付

Phase 3 完成后,进入 [Phase 4:合规加固](./PHASE-4-compliance.md)(2 周,CNAS 审核准备)
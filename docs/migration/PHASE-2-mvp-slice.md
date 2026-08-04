# Phase 2:垂直切片 MVP —— 样品→检测→报告(第 4-6 周)

> **周期**: 2026-09-01 ~ 2026-09-21(3 周,15 工作日)
> **目标**: 火试金 + ICP 检测端到端可演示,CNAS 8 大条款可逐条验证
> **业务核心**: 黄金检测(火试金法 + ICP-OES/MS)
> **负责人**: 后端工程师(主)+ 前端工程师(主)+ 天枢(Review)

## 1. 业务垂直切片总览

本阶段是整个项目**最关键的 3 周**。完成后,LIMS 将具备 CNAS 现场审核所需的最小可演示闭环:

```
客户送检(金锭/金粉)
  ↓
样品接收 → 编号 + 称重 + 拍照
  ↓
批次创建(FB-20260804-001 火试金 或 ICP-20260804-001 ICP)
  ↓
QC 样插入 + 平行样 3 份
  ↓
检测执行(火试金 4-6h / ICP 1-2h)
  ↓
结果录入 + QC 验证
  ↓
校核 → 审核 → 批准(CA 电子签名 + 时间戳)
  ↓
PDF 报告(含二维码 + SHA256)
  ↓
留样归档
```

## 2. 任务清单

### Week 1(第 4 周):样品接收 + 批次管理 + 任务分配

#### Day 1-2:样品接收模块

- [ ] **Task 2.1**: 创建 `apps/backend/src/modules/sample/`
  - `sample.module.ts`
  - `sample.controller.ts`(`POST /samples`、`GET /samples`、`GET /samples/:id`、`PATCH /samples/:id`)
  - `sample.service.ts`
  - `dto/create-sample.dto.ts`
  - `dto/sample-filter.dto.ts`
  - `entities/sample.entity.ts`
  - `sample.repository.ts`

- [ ] **Task 2.2**: 实现 `POST /samples` 业务逻辑
  - 接收:customerName / customerRef / sampleType / declaredPurityPct / weightG
  - 自动生成 sampleNo: `YYMMDD-NNNN`(每日重置)
  - 调用 MinIO 上传样品照片(2 张:正面 + 侧面)
  - 调用 BullMQ 异步生成二维码
  - 触发审计(自动)
  - 返回 sampleNo + 二维码

- [ ] **Task 2.3**: 实现 `GET /samples` 列表
  - 分页 + 过滤(sampleNo / customerName / status / dateRange)
  - 返回包含批次信息 + 报告信息(join)

- [ ] **Task 2.4**: 前端样品接收页面 `apps/frontend/src/views/sample/Receive.tsx`
  - 表单:Ant Design Form + Zod 校验
  - 上传照片:Ant Design Upload → MinIO
  - 提交后跳转详情页

- [ ] **Task 2.5**: 前端样品列表页 `apps/frontend/src/views/sample/List.tsx`
  - Ant Design Table + ProTable
  - 过滤:状态 / 客户 / 日期
  - 跳转详情/检测/报告

#### Day 3-4:批次管理

- [ ] **Task 2.6**: 创建 `apps/backend/src/modules/sample/batch/`
  - `batch.controller.ts`
  - `batch.service.ts`
  - `batch.repository.ts`

- [ ] **Task 2.7**: 实现批次 API
  - `POST /batches` 创建批次
    - 输入:method / replicateCount / furnaceNo / qcSampleId
    - 自动生成 batchNo: `FB-20260804-001`(火试金)/ `ICP-20260804-001`(ICP)
    - 关联样品:一个批次可包含多个样品

  - `POST /batches/:id/samples` 批量加入样品
  - `POST /batches/:id/qc-sample` 设置 QC 样
  - `POST /batches/:id/start` 开始批次(状态 → MIXING)
  - `POST /batches/:id/advance` 推进批次状态
    - 火试金:PENDING → MIXING → FUSING → CUPELLING → PARTING → ANNEALING → WEIGHING → CALCULATING → COMPLETED
    - ICP:PENDING → MIXING → FUSING(消解)→ CALCULATING → COMPLETED
  - `GET /batches/:id` 批次详情

- [ ] **Task 2.8**: 实现批次状态机(XState + DB 字段冗余)
  - `apps/backend/src/modules/sample/batch/batch.machine.ts`
  ```typescript
  import { createMachine } from 'xstate';

  export const batchMachine = createMachine({
    id: 'fireAssayBatch',
    initial: 'PENDING',
    states: {
      PENDING: { on: { START: 'MIXING' } },
      MIXING: { on: { COMPLETE: 'FUSING', FAIL: 'REJECTED' } },
      FUSING: { on: { COMPLETE: 'CUPELLING', FAIL: 'REJECTED' } },
      CUPELLING: { on: { COMPLETE: 'PARTING', FAIL: 'REJECTED' } },
      PARTING: { on: { COMPLETE: 'ANNEALING', FAIL: 'REJECTED' } },
      ANNEALING: { on: { COMPLETE: 'WEIGHING', FAIL: 'REJECTED' } },
      WEIGHING: { on: { COMPLETE: 'CALCULATING', FAIL: 'REJECTED' } },
      CALCULATING: { on: { COMPLETE: 'COMPLETED', FAIL: 'REJECTED' } },
      COMPLETED: { type: 'final' },
      REJECTED: { type: 'final' },
    },
  });
  ```

- [ ] **Task 2.9**: 前端批次管理页面
  - `apps/frontend/src/views/batch/Create.tsx`
  - `apps/frontend/src/views/batch/Detail.tsx`(含状态机可视化)

- [ ] **Task 2.10**: 任务分配
  - `POST /tasks/assign` 检测任务分配给检测员
  - 检测员工作台 `apps/frontend/src/views/workbench/Analyst.tsx`(显示分配给当前用户的任务)

#### Day 5:周回顾 + 集成测试

- [ ] **Task 2.11**: 集成测试样品+批次端到端
- [ ] **Task 2.12**: E2E 测试样品接收页面

### Week 2(第 5 周):火试金 + ICP 检测 + QC

#### Day 6-8:火试金检测模块

- [ ] **Task 2.13**: 创建 `apps/backend/src/modules/test/fire-assay/`
  - `fire-assay.controller.ts`
  - `fire-assay.service.ts`(纯计算 + 校验)
  - `fire-assay.repository.ts`

- [ ] **Task 2.14**: 实现火试金 API
  - `POST /tests/fire-assay` 创建火试金检测
    - 输入:testId / sampleWeightG
  - `PATCH /tests/fire-assay/:id/lead-button` 记录铅扣重
  - `PATCH /tests/fire-assay/:id/prill` 记录金粒重
  - `PATCH /tests/fire-assay/:id/process` 记录工艺参数(furnaceTempC / cupellationMin / partingMin / annealingMin / partingAcid)
  - `POST /tests/fire-assay/:id/complete` 完成检测
    - 计算 Au 纯度:`purityPct = prillWeightG / sampleWeightG * 100`(扣除 QC 修正)
    - 写入 `tests.purityPct`
    - 计算不确定度(基于平行样 RSD)

- [ ] **Task 2.15**: 火试金纯度计算服务
  ```typescript
  // fire-assay.purity.calculator.ts
  export function calculatePurity(params: {
    sampleWeightG: Decimal;
    prillWeightG: Decimal;
    qcRecoveryPct: Decimal; // 99.5-100.5
  }): { purityPct: Decimal; uncertainty: Decimal } {
    // Au% = (prillWeight / sampleWeight) × 100 × (100 / qcRecovery)
    // 不确定度 = 平行样 RSD × k=2
  }
  ```

- [ ] **Task 2.16**: 前端火试金检测页面
  - `apps/frontend/src/views/test/FireAssayExecute.tsx`
  - 分步骤表单:称样 → 熔融 → 灰吹 → 分金 → 退火 → 称重 → 计算
  - 实时显示纯度计算

#### Day 9-10:ICP 检测模块

- [ ] **Task 2.17**: 创建 `apps/backend/src/modules/test/icp/`
  - `icp.controller.ts`
  - `icp.service.ts`
  - `icp.repository.ts`

- [ ] **Task 2.18**: 实现 ICP API
  - `POST /tests/icp` 创建 ICP 检测
  - `POST /tests/icp/:id/results` 批量录入多元素结果(Au/Ag/Cu/Fe/Pb/Pt/Pd...)
  - `POST /tests/icp/:id/complete` 完成检测
  - `GET /tests/icp/calibration` 查看校准曲线数据

- [ ] **Task 2.19**: 前端 ICP 检测页面
  - `apps/frontend/src/views/test/IcpExecute.tsx`
  - 多元素结果录入表格(动态增删行)

#### Day 11:QC 模块 + Westgard + 6σ

- [ ] **Task 2.20**: 创建 `apps/backend/src/modules/qc/`
  - `qc.controller.ts`
  - `qc.service.ts`
  - `qc.westgard.ts`(Westgard 规则引擎)
  - `qc.zscore.ts`(6σ Z-score 计算)
  - `qc.timeseries.ts`(时序查询)

- [ ] **Task 2.21**: 实现 QC API
  - `POST /qc/blank` 空白样测量
  - `POST /qc/parallel` 平行样测量(自动计算 RSD)
  - `POST /qc/spike` 加标样测量(自动计算回收率)
  - `POST /qc/standard` QC 样测量(自动比对证书值)
  - `GET /qc/trend?element=Au&days=30` 趋势图数据(TimescaleDB)
  - `GET /qc/zscore?element=Au` Z-score 监控

- [ ] **Task 2.22**: Westgard 规则引擎
  ```typescript
  // qc.westgard.ts
  export const westgardRules = {
    '1_3s': (z: number) => Math.abs(z) > 3,                    // 1 个点超过 3σ
    '2_2s': (z: number, prevZ: number) => Math.abs(z) > 2 && Math.abs(prevZ) > 2, // 连续 2 点超 2σ
    'R_4s': (z: number, prevZ: number) => Math.abs(z - prevZ) > 4, // 2 点间差超 4σ
    '4_1s': (zs: number[]) => zs.slice(-4).every(v => Math.abs(v) > 1), // 连续 4 点超 1σ
    '10x': (zs: number[]) => zs.slice(-10).every(v => v > 0), // 连续 10 点同侧
  };
  ```

- [ ] **Task 2.23**: 前端 QC 监控页面
  - `apps/frontend/src/views/qc/Trend.tsx`(ECharts 时序图)
  - `apps/frontend/src/views/qc/LeveyJennings.tsx`(LJ 图 + Westgard 规则可视化)
  - `apps/frontend/src/views/qc/QCInput.tsx`

- [ ] **Task 2.24**: QC 集成到检测流程
  - 火试金完成前,自动验证 QC 样回收率 99.5-100.5%
  - ICP 完成前,自动验证空白 + 平行样 RSD + 加标回收率
  - 任一 QC 不通过 → Test.status = QC_FAILED

### Week 3(第 6 周):多级审核 + 电子签名 + PDF 报告

#### Day 12-13:多级审核 + 工作流

- [ ] **Task 2.25**: 创建 `apps/backend/src/modules/report/`
  - `report.controller.ts`
  - `report.service.ts`
  - `report.workflow.ts`(XState 状态机)
  - `report-signature.service.ts`

- [ ] **Task 2.26**: 实现报告工作流 API
  - `POST /reports` 创建报告(草稿)
  - `POST /reports/:id/submit` 提交审核(DRAFT → INTERNAL_REVIEW)
  - `POST /reports/:id/review` 校核(INTERNAL_REVIEW → FINAL_REVIEW)
  - `POST /reports/:id/approve` 批准(FINAL_REVIEW → APPROVED)
  - `POST /reports/:id/reject` 驳回(回到 DRAFT)
  - `POST /reports/:id/issue` 签发(APPROVED → ISSUED,生成 PDF)
  - `GET /reports/:id/stages` 查看流转记录
  - `GET /reports/:id/audit-trail` 查看完整审计链

- [ ] **Task 2.27**: 报告状态机
  ```typescript
  export const reportMachine = createMachine({
    id: 'report',
    initial: 'DRAFT',
    states: {
      DRAFT: {
        on: { SUBMIT: 'INTERNAL_REVIEW' },
      },
      INTERNAL_REVIEW: {
        on: {
          REVIEW_PASS: 'FINAL_REVIEW',
          REVIEW_REJECT: 'DRAFT',
        },
      },
      FINAL_REVIEW: {
        on: {
          APPROVE: 'APPROVED',
          REVIEW_REJECT: 'DRAFT',
        },
      },
      APPROVED: {
        on: {
          ISSUE: 'ISSUED',
        },
      },
      ISSUED: { type: 'final' },
      REJECTED: { type: 'final' },
    },
  });
  ```

- [ ] **Task 2.28**: 前端报告审核页面
  - `apps/frontend/src/views/report/Review.tsx`
  - `apps/frontend/src/views/report/Approve.tsx`(批准人专用)

#### Day 14-15:电子签名 + 时间戳 + PDF

- [ ] **Task 2.29**: 创建 `apps/backend/src/common/signature/`
  - `signature.service.ts`(CA 证书签名)
  - `timestamp.service.ts`(RFC 3161 时间戳)
  - 集成第三方 CA(Phase 1 已选定)

- [ ] **Task 2.30**: PDF 报告生成
  - 创建 `apps/backend/src/modules/report/pdf/`
  - `pdf-template.html`(EJS / Pug 模板)
  - `pdf.service.ts`(Puppeteer 渲染)
  - `pdf-storage.service.ts`(MinIO 存储 + SHA256)

- [ ] **Task 2.31**: PDF 报告内容(中文 + 英文双语)
  ```
  ┌────────────────────────────────────────┐
  │  敦煌金质检中心                       │
  │  DunHuangGold Quality Inspection Center │
  │  ─────────────────────────────────     │
  │  检测报告 / Inspection Report         │
  │                                        │
  │  报告编号: LIMS-2026-000001            │
  │  样品编号: 240806-0001                │
  │  客户名称: 上海黄金交易所              │
  │                                        │
  │  样品类型: 金锭 (GOLD_INGOT)           │
  │  样品重量: 1.0234 g                    │
  │  检测方法: 火试金法 (Fire Assay)       │
  │                                        │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
  │  检测结果                              │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
  │  Au(金)纯度: 99.998%                  │
  │  不确定度(k=2): 0.05%                  │
  │  单位: %                               │
  │                                        │
  │  QC 状态: ✅ PASSED                    │
  │  平行样 RSD: 0.12%                    │
  │  QC 样回收率: 99.85%                   │
  │                                        │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
  │  检测: 张三    [电子签名]  2026-09-15  │
  │  校核: 李四    [电子签名]  2026-09-15  │
  │  审核: 王五    [电子签名]  2026-09-15  │
  │  批准: 赵六    [电子签名]  2026-09-15  │
  │                                        │
  │  CA 证书: Serial=ABC1234567            │
  │  时间戳: 2026-09-15T10:30:00+08:00     │
  │  PDF SHA256: a1b2c3d4...               │
  │                                        │
  │  [二维码:扫码验证报告真伪]              │
  │  验证网址: https://lims.dhg.example/verify/... │
  └────────────────────────────────────────┘
  ```

- [ ] **Task 2.32**: 报告二维码 + 验证 API
  - `GET /verify/:reportNo` - 公开访问,显示报告基本信息和 SHA256 验证
  - 扫码 → 跳转验证页 → 报告真伪可查

- [ ] **Task 2.33**: 前端报告详情 + PDF 预览
  - `apps/frontend/src/views/report/Detail.tsx`
  - PDF 预览(react-pdf)
  - 下载按钮(签名后 PDF)
  - 流转时间线

#### Day 16-18(可选):收尾 + 集成测试 + E2E

- [ ] **Task 2.34**: 完整 E2E 测试
  - Playwright:登录 → 接收样品 → 创建批次 → 火试金检测 → QC 验证 → 报告审核 → 签发 PDF
  - 性能测试:从样品接收到 PDF 生成 ≤ 5 秒(不含火试金工艺等待)

- [ ] **Task 2.35**: CNAS 8 大条款演示准备
  1. **ALCOA+ Attributable**:`GET /audit-logs?user_id=X` 演示每条操作归属
  2. **Legible**:`GET /reports/:id/pdf` 演示报告清晰可读
  3. **Contemporaneous**:审计日志 created_at 与业务操作时间差 < 1s
  4. **Original**:DB 触发器阻止覆盖原值
  5. **Accurate**:SHA256 链 100% 完整
  6. **电子签名**:PDF 内嵌 CA 证书
  7. **多级审核**:XState 状态机 5 状态可视化
  8. **备份恢复**:演示脚本(Phase 4 完整演练)

- [ ] **Task 2.36**: 演示视频录制(15 分钟端到端)

## 3. 交付物清单

| 类别 | 文件 |
|---|---|
| **后端 - 样品** | `apps/backend/src/modules/sample/`(6 文件) |
| **后端 - 批次** | `apps/backend/src/modules/sample/batch/`(5 文件) |
| **后端 - 火试金** | `apps/backend/src/modules/test/fire-assay/`(5 文件) |
| **后端 - ICP** | `apps/backend/src/modules/test/icp/`(5 文件) |
| **后端 - QC** | `apps/backend/src/modules/qc/`(8 文件) |
| **后端 - 报告** | `apps/backend/src/modules/report/`(8 文件) |
| **后端 - 签名** | `apps/backend/src/common/signature/`(3 文件) |
| **后端 - PDF** | `apps/backend/src/modules/report/pdf/`(4 文件) |
| **前端 - 样品** | `apps/frontend/src/views/sample/`(3 文件) |
| **前端 - 批次** | `apps/frontend/src/views/batch/`(3 文件) |
| **前端 - 检测** | `apps/frontend/src/views/test/`(4 文件) |
| **前端 - QC** | `apps/frontend/src/views/qc/`(3 文件) |
| **前端 - 报告** | `apps/frontend/src/views/report/`(4 文件) |
| **前端 - 工作台** | `apps/frontend/src/views/workbench/`(2 文件) |
| **测试** | `tests/e2e/mvp-slice.spec.ts`、`tests/integration/fire-assay.spec.ts`、`tests/integration/icp.spec.ts` |

## 4. 验证标准

### 功能验证

- [ ] **V-2.1**: 样品接收流程可走通:填写 → 拍照 → 提交 → 样品编号生成
- [ ] **V-2.2**: 批次创建+加入样品+QC 样+平行样 流程通畅
- [ ] **V-2.3**: 火试金检测流程:称样 → 工艺记录 → 纯度计算 → QC 验证
- [ ] **V-2.4**: ICP 检测流程:多元素录入 → 校准曲线 → 浓度计算 → QC 验证
- [ ] **V-2.5**: 报告多级审核:草稿 → 校核 → 审核 → 批准 → 签发
- [ ] **V-2.6**: PDF 报告生成,含 CA 签名 + 时间戳 + 二维码 + SHA256
- [ ] **V-2.7**: 二维码扫码可验证报告真伪

### 合规验证(关键)

- [ ] **V-2.8**: 每个样品接收操作,audit_logs 表 +1 条,SHA256 链完整
- [ ] **V-2.9**: 每个检测操作,audit_logs 表 +1 条,SHA256 链完整
- [ ] **V-2.10**: 每个报告流转操作,audit_logs 表 +1 条,SHA256 链完整
- [ ] **V-2.11**: 断链自检 `GET /audit-logs/verify` 返回 200
- [ ] **V-2.12**: ALCOA+ 9 原则自检脚本通过

### 性能验证

- [ ] **V-2.13**: 样品接收 → 报告 PDF 生成 ≤ 5 秒(不含工艺等待)
- [ ] **V-2.14**: 报告列表查询 P95 < 500ms(1000 条数据)
- [ ] **V-2.15**: QC 趋势图查询 P95 < 200ms(30 天数据)

### 业务验证(火试金 + ICP)

- [ ] **V-2.16**: 火试金纯度计算公式正确(差减法 + QC 修正)
- [ ] **V-2.17**: ICP 多元素结果可批量录入
- [ ] **V-2.18**: Westgard 规则引擎:1₃s / 2₂s / R₄s / 4₁s / 10x 全部实现
- [ ] **V-2.19**: 6σ Z-score 计算正确
- [ ] **V-2.20**: QC 样回收率 99.5-100.5% 验证

### CNAS 现场审核就绪

- [ ] **V-2.21**: 8 大条款可逐条现场演示(ALCOA+ + 电子签名 + 多级审核 + 备份恢复)
- [ ] **V-2.22**: 演示视频完整,可给审核员离线观看
- [ ] **V-2.23**: 检测员/校核员/审核员/批准人 4 级角色账户齐全

## 5. 防御性兜底

| 坑点 | 影响 | 预防 |
|---|---|---|
| 火试金纯度计算公式错误 | 检测结论错误 | 单元测试覆盖所有边界;算法 Review;双人复核 |
| ICP 多元素数据错位 | 报告结论错误 | 测试 ID 严格;批次事务 |
| QC 不通过但被强制通过 | 数据质量问题 | DB 触发器阻止 status=COMPLETED when qcPassed=false |
| 电子签名私钥泄露 | 签名失效 | 私钥从 Vault 注入;定期轮换;签名记录入审计 |
| 时间戳服务不可用 | 签名失效 | 备用 TSA;签名时若 TSA 不可用,临时本地时间 + 标记 |
| Puppeteer 渲染慢 | 报告卡顿 | 浏览器实例池 + 缓存模板 |
| 报告 PDF 体积过大 | 传输慢 | 图片压缩 + 字体子集化 |
| 二维码被伪造 | 报告真伪 | 报告验证需 SHA256 + CA 证书 + 数据库对账 |
| 多级审核越权 | 合规缺陷 | RBAC 守卫 + DB 字段冗余 |
| Westgard 规则触发误报 | QC 误判 | 规则可配置;误报可由质量负责人审核覆盖 |

## 6. 里程碑 M3:可演示 MVP

Phase 2 完成后,LIMS 达到 **M3 里程碑:垂直切片 MVP**。这是**整个项目最重要的节点**:

- ✅ 可向客户演示完整流程
- ✅ 可向 CNAS 审核员现场演示
- ✅ 可支撑 50 件/日的真实业务
- ✅ 审计链 100% 完整
- ✅ 多级审核 + 电子签名落地

**这是从"零代码"到"可演示"的跃迁**。

## 7. 下阶段交付

Phase 2 完成后,进入 [Phase 3:横向扩展](./PHASE-3-horizontal.md)(13 个模块全部上线)
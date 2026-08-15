# L1 — 业务架构(Business Architecture)

> **版本**: v2.0(Phase 1A 冻结版)
> **日期**: 2026-08-15
> **基线 commit**: `4691c8a`
> **状态**: **冻结**

---

## 1. 节点定位

L1 业务架构描述**实验室如何在系统中工作**——把 L0.5 领域对象映射到**实验室业务流程 / 角色 / RBAC**,并定义每个流程的输入 / 输出 / 前置 / 后置 / 状态转换 / 验收。

---

## 2. 实验室组织与 RBAC

### 2.1 组织结构

```
敦煌金质检实验室 (LIMS)
├── 实验室主任 (1 人)              ← 法人 / 批准管理评审
├── 质量负责人 (1 人)              ← QA Manager / 报告最终批准
├── 技术负责人 (1 人)              ← 高级分析员 / 方法批准
├── 实验室管理层 (3 人)            ← 上述 3 人
│
├── 检测组
│   ├── 火试金组 (2 人)            ← 高级分析员 1 + 分析员 1
│   └── ICP 组 (3 人)              ← 高级分析员 1 + 分析员 2
│
├── 设备组 (1 人)                  ← 设备员 / 校准 / 期间核查
├── 试剂 / 危废管理 (1 人)         ← 危废 / 气体 / 试剂
└── 系统管理员 (1 人)              ← LIMS 配置 + 用户管理
```

**总人数**:11 人(规模中等,实验室主任身兼数职)。

### 2.2 RBAC 模型

**5 种角色 + 资源 / 操作二维矩阵**

| 角色 / 资源 | 样品 | 检测 | 报告 | QC | 设备 | 容器 | 危废 | 气体 | 贵金属 | 用户 |
|---|---|---|---|---|---|---|---|---|---|---|
| **ADMIN** | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| **QUALITY_MANAGER** | R | R | **Approve** | CRUD | R | R | R | R | R | R |
| **SENIOR_ANALYST** | CRUD | **CRUD**(自) | Create + Review | R | R | R | R | R | R | R |
| **ANALYST** | **CRUD**(自己接的) | **CRUD**(自己执行) | Create | R | R | CRUD(借用) | Create | R | R | R |
| **EQUIPMENT_MANAGER** | R | R | R | R | **CRUD** | R | R | R | R | R |

**关键 RBAC 规则**:
- **R-RBAC-01**:分析员只能**修改自己执行的检测**(`Test.operatorId == currentUser.id`)
- **R-RBAC-02**:报告批准必须是 `QUALITY_MANAGER` 角色
- **R-RBAC-03**:用户管理只有 `ADMIN` 可操作
- **R-RBAC-04**:审计日志查询所有 `QUALITY_MANAGER` + `ADMIN` 可访问
- **R-RBAC-05**:分析员的样品列表显示**自己接的 + 公开的**

### 2.3 RBAC 实现 vs 缺口

**已实现**:
- ✅ 5 种角色 enum
- ✅ JWT + TOTP MFA
- ✅ RbacGuard(基于角色字符串检查)
- ✅ Throttler 限流

**缺口**:
- ❌ **资源级别 RBAC 缺位** — 目前是粗粒度角色,**未实现「按数据所有权」过滤**
  - 例: `Test.operatorId == user.id` 才可改 — 当前**代码层无校验**
- ❌ **`Test.method` 限定操作员资质** — 应校验 `User.qualifications.includes(method)`
- ❌ **临时授权机制缺** — 检测员外出时代班机制
- ❌ **审计日志读权限** — 当前所有登录用户都能看(应限定 QA + Admin)

---

## 3. 样品全生命周期

### 3.1 状态机

```
[客户送样] ─→ RECEIVED ─→ BATCHED ─→ TESTED ─→ REPORTED ─→ ARCHIVED ─→ DISPOSED
   │             │           │           │           │           │
   │             ↓           ↓           ↓           ↓           ↓
   │         (创建 batch) (检测开始) (检测完成) (报告签发) (留样登记)
   │             │           │           │           │
   │             │           │           │           └── (可选) SUPERSEDED
   │             │           │           │
   │             │           │           ├── qcPassed=false → OOS 流程
   │             │           │           └── purityPct < lod → 复测
   │             │           │
   │             │           └── (批量检测中) SAMPLE_BATCHED
   │             │
   │             ├── REJECTED(拒收,极少)
   │             │
   │             └── (作废) VOIDED
   │
   └── 接收窗口:含 ID + 接样员 + 时间
```

### 3.2 流程定义

#### 流程 S-01:样品接样

| 项 | 内容 |
|---|---|
| **触发** | 客户持样品到窗口 |
| **前置** | 客户出示身份 / 委托单(纸质) |
| **输入** | 客户名称 / 联系人 / 样品类型 / 重量 / 接样员 / 来源(SampleReceive page) |
| **输出** | Sample.status = `RECEIVED` + `receivedById` + `receivedAt` |
| **后置** | 自动生成 `sampleNo`(YYMMDD-NNNN) |
| **状态转换** | `null → RECEIVED` |
| **验收标准** | `sampleNo` 唯一 / `weightG > 0` / `receivedAt <= now()` |
| **审计事件** | `SAMPLING_RECORDED`(W4) |
| **API** | `POST /api/v1/samples` |

#### 流程 S-02:批次编排

| 项 | 内容 |
|---|---|
| **触发** | 接样达到一定数量,或特定检测方法需要批量(如火试金 3 平行样)|
| **前置** | ≥ 1 个 Sample.status = `RECEIVED` |
| **输入** | `batchNo`(BATCH-FA-NNNN), `method`, `replicateCount`, `furnaceNo` |
| **输出** | SampleBatch + 关联 Sample.batchId |
| **状态转换** | `RECEIVED → BATCHED`(批量) |
| **验收标准** | replicateCount ≥ 2(火试金法硬性要求) |
| **审计事件** | (无,应加 `BATCH_CREATED`)|

#### 流程 S-03:检测完成

| 项 | 内容 |
|---|---|
| **触发** | 分析员完成原始数据录入 |
| **前置** | `Test.status = IN_PROGRESS` |
| **输入** | `purityPct`, `uncertainty`, `startedAt`, `completedAt`, `qcRemarks`, `method` |
| **输出** | `Test.status = COMPLETED` + ElementResult[] |
| **状态转换** | `IN_PROGRESS → COMPLETED` |
| **验收标准** | purityPct ∈ (0, 100], uncertainty > 0, qcPassed = true |
| **审计事件** | `TEST_COMPLETED`(realtime) |
| **API** | `PUT /api/v1/tests/:id`(无此端点,缺口)|

**缺口**:
- ❌ 没有 `PUT /api/v1/tests/:id` 端点 — 只能通过种子直接插入
- ❌ 没有 `POST /api/v1/tests/:id/start` 起测端点
- ❌ 没有 `POST /api/v1/tests/:id/complete` 完成端点

#### 流程 S-04:报告生成与签发

| 项 | 内容 |
|---|---|
| **触发** | Test.status = COMPLETED + qcPassed = true |
| **前置** | Test 关联 Sample + SampleBatch(可选) |
| **输入** | `summary`(报告文本), `pdf`(可选) |
| **输出** | Report + ReportStage[] + ReportSignature[] + `pdfSha256` |
| **状态转换** | `DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED` |
| **验收标准** | 3 个 Signature 齐全 + `pdfSha256` 长度 64 + `issuedAt` ≥ now - 1h |
| **审计事件** | `REPORT_ISSUED` |
| **API** | `POST /api/v1/reports` + `POST /api/v1/reports/:id/sign` |

#### 流程 S-05:留样登记

| 项 | 内容 |
|---|---|
| **触发** | Report.status = ISSUED |
| **前置** | 留样柜有空间 |
| **输入** | 留样位置(干燥器 / 冷藏), 留样期(默认 6 个月)|
| **输出** | Sample.status = `ARCHIVED` + 留样位置字段 |
| **验收标准** | Sample.archivedAt ≥ issuedAt |
| **审计事件** | `SAMPLE_ARCHIVED` |

**缺口**:
- ❌ 没有留样表 / 字段(应 `Sample.storageLocation` + `Sample.retentionUntil`)
- ❌ 留样销毁流程未建模(应 `Sample.status: ARCHIVED → DISPOSED`)
- ❌ 无提前销毁流程(应走 OOS + 审批)

#### 流程 S-06:样品销毁

| 项 | 内容 |
|---|---|
| **触发** | 留样期到期 + 客户通知 + 审批 |
| **前置** | Sample.status = `ARCHIVED`, `retentionUntil < now()` |
| **输入** | 销毁方式(交付客户 / 实验室集中销毁 / 海绵金回收)|
| **输出** | Sample.status = `DISPOSED` + 销毁记录 |
| **验收标准** | 双人审批 + 称重记录 + 影像证据 |
| **审计事件** | `SAMPLE_DISPOSED` |

**完全缺失** — **需 Phase 1B/2 补**。

---

## 4. 火试金法(FIRE_ASSAY)流程

### 4.1 流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 火试金法检测流程(GB/T 9288)                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 接样(已 S-01 完成)                                                │
│           ↓                                                           │
│  2. 称样(精密天平, 1.0000~2.0000 g)                                   │
│     → Test.purityPct 暂时未填,FireAssayDetail.sampleWeightG = 1.0230 │
│           ↓                                                           │
│  3. 包铅(纯铅箔 + 银丝, 留 Ag 钉)                                     │
│     → 详细操作记录(原始记录,纸质 + LIMS)                            │
│           ↓                                                           │
│  4. 灰吹(试金炉 950°C, 氧化除杂)                                     │
│     → FireAssayDetail.furnaceNo + 温度 / 时间                        │
│           ↓                                                           │
│  5. 灰吹后称重(铅扣重)                                                │
│     → 计算金 + 银比例                                                │
│           ↓                                                           │
│  6. 二次灰吹 + 熔融(铂金坩埚, 1100°C)                                │
│           ↓                                                           │
│  7. 退火 + 碾片(锤扁 + 碾片机)                                       │
│           ↓                                                           │
│  8. 分金(硝酸 1:7 + 1:1, 溶解银)                                     │
│           ↓                                                           │
│  9. 二次退火 + 称重(金卷重 prillWeightG)                             │
│     → Test.purityPct = (prillWeightG / sampleWeightG) × 100        │
│     → Test.uncertainty = ±0.02%(k=2)(经验值 / 5 平行)              │
│           ↓                                                           │
│  10. QC 平行样验证(2~3 次平行, RSD < 0.05%)                          │
│           ↓                                                           │
│  11. 录入 LIMS + 上传原始记录扫描件                                    │
│     → FileAttachment(原始数据 + 分金视频/照片)                     │
│           ↓                                                           │
│  12. 进入报告生成(S-04)                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 关键控制点(KCP)

| # | KCP | 当前 LIMS 支撑 |
|---|---|---|
| KCP-FA-1 | 样品重量 1.0000 ± 0.0001 g(天平精度)| ⚠️ 无天平校准自动校验 |
| KCP-FA-2 | 试金炉温度 950 ± 5°C | ⚠️ 无炉温记录字段(FireAssayDetail 应加 `furnaceTempC`) |
| KCP-FA-3 | 灰吹时间 ≥ 30 min | ❌ 无字段 |
| KCP-FA-4 | 平行样 RSD < 0.05% | ⚠️ QC 表有 `sd` 但无自动 RSD 计算 |
| KCP-FA-5 | 退火温度 750°C | ❌ 无字段 |
| KCP-FA-6 | 称重天平校准证书有效期 | ⚠️ Equipment 有,但无"检测用前校验"流程 |
| KCP-FA-7 | 标准物质 GBW02757 验证回收率 99.95~100.05% | ⚠️ RM 已有,无系统级校验 |

### 4.3 FireAssayDetail 表(13 字段)

已实现字段:`sampleWeightG`, `prillWeightG`, `furnaceNo`

**缺口**:
- `furnaceTempC` 灰吹温度
- `cupellationDurationMin` 灰吹时长
- `partingAcidRatio` 分金酸比例
- `finalAnnealingTempC` 终退火温度
- `rawDataFileId` 原始数据附件
- `videoFileId` 操作视频附件

---

## 5. ICP-OES 流程

### 5.1 流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│ ICP-OES 多元素分析流程                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 样品消解(王水 / 逆王水 / 微波消解)                                │
│     → ElementResult.sampleId → Test                                  │
│           ↓                                                           │
│  2. 定容(容量瓶 100 mL / 250 mL, A 级)                                │
│     → 体积校准证书 + 稀释倍数                                       │
│           ↓                                                           │
│  3. ICP-OES 开机 + 点炬                                              │
│     → Equipment(ICP)状态 = ACTIVE, 校准有效期                        │
│           ↓                                                           │
│  4. 校准曲线(标准溶液多浓度点 + 线性回归 R² > 0.999)                 │
│     → Method.calibrationCurveFileId(缺失)                           │
│           ↓                                                           │
│  5. QC 样品插入(GBW 系列 + 空白)                                     │
│     → QcMeasurement.qcType = PARALLEL / BLANK / STANDARD             │
│           ↓                                                           │
│  6. 样品测量(自动进样 + 多波长扫描)                                  │
│     → ElementResult.concentration                                    │
│           ↓                                                           │
│  7. 数据处理(背景扣除 + 谱线选择 + 积分)                            │
│     → ElementResult.wavelengthNm, intensity                          │
│           ↓                                                           │
│  8. 计算 LOD / LOQ(3σ + 10σ 法)                                      │
│     → ElementResult.lod / loq                                        │
│           ↓                                                           │
│  9. 与标准物质比对(回收率 95~105%)                                  │
│     → QcMeasurement.recoveryPct                                      │
│           ↓                                                           │
│  10. 录入 LIMS(多元素结果)                                            │
│           ↓                                                           │
│  11. 进入报告生成                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 关键控制点

| # | KCP | 当前 LIMS 支撑 |
|---|---|---|
| KCP-ICP-1 | 校准曲线 R² > 0.999 | ❌ 无字段 |
| KCP-ICP-2 | 检出限 LOD ≤ 0.01 ppm | ⚠️ ElementResult.lod 字段有 |
| KCP-ICP-3 | 精密度 RSD < 2% | ⚠️ QcMeasurement.sd |
| KCP-ICP-4 | 回收率 95~105% | ⚠️ QcMeasurement.recoveryPct |
| KCP-ICP-5 | 标气有效期 | ❌ RM 过期检测未阻断 |
| KCP-ICP-6 | ICP-OES 校准有效期 | ⚠️ Equipment.nextDueDate |

### 5.3 ElementResult 表(12 字段)

已实现:`element`, `wavelengthNm`, `intensity`, `concentration`, `unit`, `lod`, `loq`, `uncertainty`

**缺口**:
- `calibrationCurveId` 校准曲线引用
- `isAboveLOQ` 是否高于 LOQ
- `isWithinCalibrationRange` 是否在校准范围内
- `referenceMaterialId` 该结果用的哪个 RM

---

## 6. QC 流程(Westgard 规则)

### 6.1 QC 类型

| qcType | 用途 | 频次 | 规则 |
|---|---|---|---|
| `BLANK` | 空白样(检测本底)| 每批次 | < LOD |
| `PARALLEL` | 平行样(精密度) | 每 5 样品 | RSD < 5% |
| `STANDARD` | 标准物质(准确度) | 每 10 样品 | 回收 95~105% |
| `SPIKE` | 加标回收 | 抽检 | 回收 80~120% |

### 6.2 Westgard 多规则(系统应自动应用)

| 规则 | 含义 | 触发条件 | 当前 LIMS |
|---|---|---|---|
| **1-3s** | 1 个点超 ±3 SD | \|z\| > 3 | ❌ 字段存但不自动计算 |
| **2-2s** | 连续 2 个点超 ±2 SD | z(n) AND z(n-1) 同号 > 2 | ❌ |
| **R-4s** | 连续 2 点极差 > 4 SD | \|z(n)-z(n-1)\| > 4 | ❌ |
| **4-1s** | 连续 4 点同侧超 ±1 SD | 同号 > 1,4 次 | ❌ |
| **10-x** | 连续 10 点同侧 | 同号 10 次 | ❌ |
| **12-x** | 12 点同侧 | 同号 12 次 | ❌ |

**总判定**:**Westgard 规则系统未实现**,目前 `passed` 字段是手动写入的字符串。

### 6.3 QC 流程

```
测试开始前 → BLANK + STANDARD 测量
  ├─ 通过 → 继续
  └─ 失败 → 停机 + 维护 Equipment + 重新校准

每 5 样品 → PARALLEL
  ├─ 通过 → 继续
  └─ 失败 → 复测 + OOS

每 10 样品 → STANDARD
  ├─ 通过 → 继续
  └─ 失败 → 停机 + 调查

抽检 → SPIKE
  ├─ 通过 → 留档
  └─ 失败 → 复检 + OOS
```

---

## 7. 报告流程(三级审核)

### 7.1 流程

```
Analyst 完成检测
    ↓
生成 Report.status = DRAFT
    ↓ (Analyst)
    ↓
Report.status = INTERNAL_REVIEW
    ↓ (SeniorAnalyst 校核)
    ↓
Report.status = FINAL_REVIEW
    ↓ (SeniorAnalyst 复核)
    ↓
Report.status = APPROVED
    ↓ (QualityManager 批准)
    ↓
Report.status = ISSUED (生成 PDF, 派发客户)

后续 → SUPERSEDED(被新版报告替代,可选)
```

### 7.2 ReportStage 记录

每个状态变更产生一条 ReportStage 记录:
- `reportId`, `stage`, `userId`, `comments`, `signedAt`(无)

### 7.3 ReportSignature 数字签名

每个签字生成 SHA256 + TOTP code:
- `reportId`, `userId`, `signatureType`(DRAFT/REVIEW/APPROVE)
- `signatureHash`, `mfaCode`

**缺口**:
- ❌ `ReportSignature.signedAt` 时间字段(只能从 createdAt 推断)
- ❌ **数字签名时间戳权威性** — 应使用 NTP 同步的服务器时间
- ❌ **报告 PDF 生成** — 当前无 PDF 生成(应 puppeteer 或 @nestjs/pdf)

---

## 8. 留样与销毁流程

### 8.1 留样

| 项 | 内容 |
|---|---|
| 触发 | Report.status = ISSUED |
| 输入 | 留样位置 + 留样期 |
| 输出 | 留样登记表 |
| 留样期 | 黄金 6 个月 / 客户特殊要求可延长 |
| 验收 | 称重 + 影像 + 双人签字 |

**完全缺失** — Sample 表无 `storageLocation`, 无 `retentionUntil`, 无 `custodyChain` 字段。

### 8.2 销毁

| 项 | 内容 |
|---|---|
| 触发 | 留样期到期 + 客户通知 + 实验室负责人审批 |
| 方式 | (1) 客户取回(签字) (2) 实验室集中销毁(双人) (3) 海绵金回收 |
| 验收 | 销毁记录 + 影像 + 双人签字 + 称重 |
| 输出 | Sample.status = DISPOSED |

**完全缺失**。

---

## 9. 异常流程(OOS / 不符合工作)

### 9.1 OOS(Out of Specification)

**触发**:
- QC 失败(Westgard 触发)
- 检测结果超出客户规格
- 检测过程中设备异常

**流程**:
```
1. OOS 发生 → 创建 NonConformance 记录
2. 调查:复测 / 设备检查 / 方法验证
3. 决定:接受结果 / 重新检测 / 报告偏离
4. 客户通知(必要时)
5. 关闭 OOS(归档)
```

**完全缺失** — 无 NonConformance 表 / 流程。

### 9.2 设备异常

```
Equipment 故障 → 停用 + Maintenance 记录
  ↓
启用备份设备(如有)
  ↓
故障修复 → 重新校准(Calibration 新记录)
  ↓
启用 Equipment.status = ACTIVE
```

**基本流程存在**,但无故障预警机制(无 IoT 集成)。

### 9.3 不符合工作(CNAS §7.10)

涵盖 OOS + 客户投诉 + 内部审核发现。

**缺口**:无统一 NonConformance 表 / 流程。

---

## 10. RBAC 与各流程的接入点矩阵

| 流程 | 触发角色 | 审批角色 | 系统支撑 |
|---|---|---|---|
| 接样 S-01 | 任意登录用户 | — | ✅ |
| 批次 S-02 | SENIOR_ANALYST | QUALITY_MANAGER | ✅ |
| 检测 S-03 | ANALYST(SENIOR 可代)| — | ⚠️ 部分 |
| 报告 DRAFT | ANALYST | — | ✅ |
| 报告校核 | SENIOR_ANALYST | — | ✅ |
| 报告复核 | SENIOR_ANALYST | — | ✅ |
| 报告批准 | QUALITY_MANAGER | — | ✅ |
| 留样 | QUALITY_MANAGER | — | ❌ |
| 销毁 | QUALITY_MANAGER + ADMIN | — | ❌ |
| OOS 处理 | ANALYST → SENIOR → QA | — | ❌ |
| 校准 | EQUIPMENT_MANAGER | QUALITY_MANAGER | ✅ |
| 期间核查 | EQUIPMENT_MANAGER | SENIOR_ANALYST | ✅ |
| 危废登记 | 任意 | — | ✅ |
| 危废转移 | QUALITY_MANAGER | — | ✅ |
| 危废处置 | QUALITY_MANAGER | — | ✅ |
| 气体领用 | ANALYST | — | ✅ |
| 容器领用 | ANALYST | — | ✅ |
| 容器归还 | ANALYST | — | ✅ |
| 取样登记 | 任意 | — | ✅ |
| 贵金属条码 | SENIOR_ANALYST | QUALITY_MANAGER | ✅ |

---

## 11. 关键缺口汇总(L1 视角)

| # | 缺口 | 影响 |
|---|---|---|
| 1 | 无 `PUT /tests/:id/complete` 端点 | 检测完成无法走标准流程 |
| 2 | 无 `NonConformance` 表 | OOS 无法追踪 |
| 3 | 无 `Sample.retentionUntil` 字段 | 留样销毁无依据 |
| 4 | Westgard 自动应用未实现 | QC 失控 |
| 5 | `FireAssayDetail` 缺关键参数(温度 / 时长)| 火试金不可复现 |
| 6 | 无 `ElementResult` 校准曲线引用 | ICP 不合规 |
| 7 | 无 RM 过期应用层阻断 | §7.6 不达标 |
| 8 | 报告 PDF 生成缺位 | 评审会问"报告长什么样" |
| 9 | 资源级 RBAC 缺位 | 越权风险 |
| 10 | 临时授权机制缺 | 代班场景无解 |

---

## 12. 阶段输出

L1 输出到 Step 6 / Step 7:
- 业务状态机(样品 / 批次 / 检测 / 报告 / 留样 / 危废 / 容器 / 气体 / 贵金属 条码)→ `BUSINESS-STATE-MACHINES.md`
- 各流程审计钩子 → `AUDIT-EVIDENCE-INVENTORY.md`
- 业务流 + RBAC → `CNAS-CMA-TRACEABILITY-MATRIX.md` 的「业务」列

---

**L1 冻结完毕。下一步:Step 6 CNAS-CMA 条款追溯矩阵。**
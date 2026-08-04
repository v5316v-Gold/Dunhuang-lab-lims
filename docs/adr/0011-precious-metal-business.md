# ADR-0011:敦煌金质检中心业务约束 —— 贵金属(黄金)检测

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 菩提老祖
> **影响范围**: 业务模型、数据库 schema、检测流程、报告格式、合规要求

## 这是什么

本 ADR 是**业务约束真源**,所有后续 ADR、数据库 schema、检测流程、报告格式都必须遵守本约束。CNAS 审核员会问"你们的业务是什么 / 检测能力范围",本 ADR 就是答案。

## 业务画像

**敦煌金质检中心(DunHuangGold Quality Inspection Center)** —— 专业贵金属检测机构,以**黄金**为核心检测对象。

### 核心定位

| 项 | 内容 |
|---|---|
| **机构性质** | CNAS 认可第三方检测实验室 |
| **核心业务** | 贵金属(黄金为主)成分检测与纯度鉴定 |
| **核心方法** | **火试金法(Fire Assay)** + **ICP(ICP-OES / ICP-MS)** |
| **目标客户** | 上海黄金交易所、矿山、冶炼厂、首饰制造商、回收商、监管机构 |
| **法律效力** | 检测报告具有**法律效力**(可作为黄金交易结算凭证) |
| **行业地位** | (待补充:具体定位) |

## 检测方法清单

### 主方法 1:火试金法(Fire Assay)—— 占比 ~70%

**方法原理**: 试样与助熔剂(铅、硼砂、硅砂)混合,在 1000-1100°C 高温下熔融;贵金属被铅吸收形成铅扣,铅扣在灰吹炉中氧化除去,剩余金银合粒;硝酸分金后称重,差减法得黄金纯度。

**应用场景**:
- ✅ 黄金纯度**仲裁检测**(99.0% - 99.999%)
- ✅ 仲裁依据:GB/T 9288(首饰含金量)、GB/T 17373(金化学分析方法)
- ✅ 适用于:金锭、金粉、合金、首饰、回收金料

**关键设备**:
- 试金炉 / 马弗炉(熔融,1000-1100°C)
- 灰吹炉 / 灰皿(铅扣灰吹)
- 分析天平(0.001 mg / 0.01 mg)
- 铸模机

**工艺时长**:
- 熔融:60-90 分钟
- 灰吹:30-60 分钟
- 分金:30-60 分钟
- 退火:30 分钟
- 称重 + 计算:15 分钟
- **单批总时长:4-6 小时**

**关键参数**:
- 称样量:0.2-2 g(精称至 0.00001g)
- 平行样:每批**至少 3 份**
- QC 样:每批插入 1-2 个标准物质(如 GBW02757 99.999%)
- 回收率要求:99.5-100.5%

**检测能力范围**:
- 含金量:50.00% - 99.999%
- 不确定度:0.05% - 0.3%(k=2)

### 主方法 2:ICP-OES / ICP-MS —— 占比 ~25%

**方法原理**: 样品经王水/HF/HClO4 消解后雾化进入等离子体,元素被激发产生特征光谱/质谱,定量分析多元素含量。

**应用场景**:
- ✅ 多元素痕量分析(杂质检测)
- ✅ 仲裁依据:GB/T 17373、GB/T 21198
- ✅ 黄金中杂质:Ag、Cu、Fe、Pb、Pt、Pd、Ni、Zn 等
- ✅ 高纯金中痕量元素:ppb/ppt 级

**关键设备**:
- ICP-OES:电感耦合等离子体发射光谱仪
- ICP-MS:电感耦合等离子体质谱仪
- 微波消解仪
- 超纯水机(18.2 MΩ·cm)

**常见检测元素**(必须枚举):

| 元素符号 | 中文名 | 典型检出限 | 单位 | 备注 |
|---|---|---|---|---|
| Au | 金 | - | % | 主元素 |
| Ag | 银 | 1 ppm | ppm | 杂质 |
| Cu | 铜 | 1 ppm | ppm | 杂质 |
| Fe | 铁 | 5 ppm | ppm | 杂质 |
| Pb | 铅 | 5 ppm | ppm | 杂质 |
| Pt | 铂 | 1 ppm | ppm | 贵金属 |
| Pd | 钯 | 1 ppm | ppm | 贵金属 |
| Rh | 铑 | 0.5 ppm | ppm | 贵金属 |
| Ir | 铱 | 0.5 ppm | ppm | 贵金属 |
| Ni | 镍 | 1 ppm | ppm | 杂质 |
| Zn | 锌 | 1 ppm | ppm | 杂质 |
| Sn | 锡 | 5 ppm | ppm | 杂质 |
| Bi | 铋 | 5 ppm | ppm | 杂质 |
| Sb | 锑 | 5 ppm | ppm | 杂质 |
| As | 砷 | 5 ppm | ppm | 杂质 |

**工艺时长**:
- 样品消解:2-4 小时
- ICP 测量:30-60 分钟
- **单批总时长:1-2 小时**

**检测能力范围**:
- 元素浓度:ppb - %
- 不确定度:1-10%

### 辅助方法:占比 ~5%

| 方法 | 应用场景 |
|---|---|
| **XRF(X 荧光光谱)** | 快速筛选(非仲裁)、来料检验 |
| **重量法** | 高纯金仲裁复核 |
| **滴定法(碘量法)** | 金、银快速检测 |
| **分光光度法** | 痕量元素 |

## 业务规则

### 样品接收规则

| 规则 | 说明 |
|---|---|
| **样品编号** | `YYMMDD-NNNN`(日期+流水号),每日重置 |
| **样品重量** | 火试金 0.2-2 g;ICP 0.5-1 g |
| **样品拍照** | 接收时必须拍照存档(MinIO) |
| **客户委托单** | PDF/纸质扫描件存档 |
| **留样** | 检测后留样 ≥ 6 个月(贵金属),存档 ≥ 2 年 |

### 检测流程规则

```
样品接收 → 编号/称重/拍照 → 任务分配 → 检测执行(火试金 / ICP)
   → 平行样结果 → QC 样验证 → 数据校核 → 报告起草 → 多级审核
   → 电子签名 + 时间戳 → 报告出具 → 留样归档
```

### QC 规则(关键合规要求)

| 规则 | 阈值 | 来源 |
|---|---|---|
| **空白样** | 信号值 < 检出限 | CNAS-CL01 |
| **平行样 RSD** | Au ≥ 99.9% 时 RSD ≤ 0.3%;Au 99.0-99.9% 时 RSD ≤ 0.5% | GB/T 9288 |
| **加标回收率** | 95-105% | CNAS-CL01 |
| **QC 样回收率** | 99.5-100.5%(火试金) | ISO 17025 |
| **6σ 监控** | Z-score < 3 | Westgard 规则 |
| **Westgard 规则** | 1₃s / 2₂s / R₄s / 4₁s / 10x | 临床实验室标准 |

### 多级审核规则(报告出具)

```
检测员录入 → 校核员审核(数据合理性) → 审核员(报告完整性) → 批准人(电子签名) → 出具
```

| 角色 | 人数 | 权限 |
|---|---|---|
| 检测员 | 5-10 | 录入 |
| 校核员 | 3-5 | 数据校核 |
| 审核员 | 2-3 | 报告审核 |
| 批准人 | 1-2 | 签名 + 出具 |
| 实验室主任 | 1 | 全部 |

### 报告规则

| 项 | 规格 |
|---|---|
| **报告格式** | PDF,A4,中文 + 英文双语 |
| **报告要素** | 样品编号、客户、检测方法、检测结果、不确定度、检测日期、签发日期、检测/校核/审核/批准签名 |
| **报告编号** | `LIMS-YYYY-NNNNNN`(年度流水) |
| **电子签名** | **必须 CA 证书 + 时间戳**(见 ADR-0004) |
| **二维码** | PDF 含二维码,扫码验证报告真伪 |
| **防伪** | PDF + SHA256 哈希入审计链 + CA 数字签名 |

## 合规要求(直接落地 CNAS)

### 必须遵守的标准

| 标准 | 内容 |
|---|---|
| **ISO/IEC 17025:2017** | 检测和校准实验室能力的通用要求 |
| **CNAS-CL01:2018** | 《检测和校准实验室能力认可准则》(等同 ISO 17025) |
| **21 CFR Part 11** | 电子记录与电子签名(美国 FDA,但国内黄金交易所认可) |
| **GB/T 9288** | 金饰品含金量火试金法测定 |
| **GB/T 17373** | 金化学分析方法 |
| **GB/T 11066** | 银化学分析方法 |
| **GB/T 21198** | 贵金属首饰中杂质元素的 ICP 法 |
| **ALCOA+** | 数据完整性 9 原则(详见 ADR-0003 + 04-CNAS-COMPLIANCE) |

### 关键合规设计

| 原则 | 实现 |
|---|---|
| **Attributable(可归属)** | 每条数据记录操作者 + 时间戳 |
| **Legible(清晰可读)** | 报告 PDF + 原始数据 JSON 双存档 |
| **Contemporaneous(同步)** | 操作与数据产生在同一秒级 |
| **Original(原始)** | 原始检测数据不可修改,只可"标记修正" |
| **Accurate(准确)** | QC 验证 + 平行样 RSD 控制 |
| **Complete(完整)** | 审计链 SHA256 100% 完整 |
| **Consistent(一致)** | 跨表数据一致性 + 触发器约束 |
| **Enduring(持久)** | 异地备份 ≥ 5 年 |
| **Available(可用)** | 报告可查询 ≥ 5 年 |

## 关键业务约束(对架构的硬要求)

### 1. 黄金纯度精度不可妥协

- **Decimal(10,6)**:Au 99.999000
- **Decimal(15,9)**:杂质检出限 ppb 级
- **禁止 float / double**

### 2. 数据法律效力强

- 每条检测数据 = 可能的法律纠纷
- 审计链 SHA256 + 多级审核 + 电子签名 + 时间戳
- 5 年留存 + 异地备份

### 3. 样品批 + 平行样管理

- 火试金 1 批 = 1-N 个样品 + 1-2 QC 样 + 3 平行样
- ICP 1 批 = 1-M 个样品 + 多元素测量
- 批次状态机:接收 → 配料 → 熔融 → 灰吹 → 分金 → 称重 → 计算

### 4. 检测流程长,异步任务多

- 火试金 4-6 小时,必须 BullMQ 异步 + 状态轮询
- 不阻塞用户操作

### 5. 客户报告 = 黄金交易凭证

- PDF 报告 = 法律文件
- CA 证书 + 时间戳 + 二维码防伪 + SHA256 入审计链

### 6. 数据迁移风险高

- 原有 LIMS(如有)数据迁移,小批量分阶段
- 双重备份 + 完整性校验

## 对数据库 schema 的具体影响

```prisma
// 必须枚举
enum AssayMethod {
  FIRE_ASSAY      // 火试金法(主)
  ICP_OES         // ICP-OES(主)
  ICP_MS          // ICP-MS(主)
  XRF             // X 射线荧光
  FIRE_ASSAY_GRAVIMETRIC  // 火试金重量法
  VOLUMETRIC      // 滴定法
  ICP_GBC         // 比较法
  OTHER
}

enum PreciousMetalElement {
  Au  // 金
  Ag  // 银
  Pt  // 铂
  Pd  // 钯
  Rh  // 铑
  Ir  // 铱
  Cu  // 铜
  Fe  // 铁
  Pb  // 铅
  Ni  // 镍
  Zn  // 锌
  Sn  // 锡
  Bi  // 铋
  Sb  // 锑
  As  // 砷
  Ru  // 钌
  Os  // 锇
}

enum ConcentrationUnit {
  PERCENTAGE   // %
  PPM          // mg/kg
  PPB          // μg/kg
  PPT          // ng/kg
  MG_PER_G     // mg/g
}

// 必须有样品批
model SampleBatch {
  id           String       @id @default(uuid())
  batchNo      String       @unique  // FB-20260804-001
  method       AssayMethod  // FIRE_ASSAY / ICP_OES
  startedAt    DateTime
  completedAt  DateTime?
  operatorId   String
  qcSampleId   String?
  replicateCount Int        @default(3)  // 平行样数
  samples      Sample[]
  status       BatchStatus  @default(PENDING)
}

enum BatchStatus {
  PENDING       // 待开始
  MIXING        // 配料
  FUSING        // 熔融
  CUPELLING     // 灰吹
  PARTING       // 分金
  ANNEALING     // 退火
  WEIGHING      // 称重
  CALCULATING   // 计算
  COMPLETED     // 完成
  REJECTED      // 异常
}

// 火试金专用字段
model FireAssayDetail {
  id                String  @id @default(uuid())
  testId            String  @unique
  sampleWeightG     Decimal @db.Decimal(15, 6)
  leadButtonWeightG Decimal? @db.Decimal(15, 6)
  prillWeightG      Decimal? @db.Decimal(15, 6)
  partingAcid       String?
  furnaceTempC      Int?
  cupellationMin    Int?
  partingMin        Int?
  annealingMin      Int?
  qcRecoveryPct     Decimal? @db.Decimal(5, 2)
}

// ICP 多元素结果(一对多)
model ElementResult {
  id            String  @id @default(uuid())
  testId        String
  element       PreciousMetalElement
  wavelengthNm  Decimal? @db.Decimal(8, 3)
  intensity     Decimal? @db.Decimal(15, 3)
  concentration Decimal @db.Decimal(15, 9)
  unit          ConcentrationUnit
  lod           Decimal? @db.Decimal(15, 9)  // 检出限
  loq           Decimal? @db.Decimal(15, 9)  // 定量限
  uncertainty   Decimal? @db.Decimal(15, 9)
}

// 检测结果(主表)
model TestResult {
  id          String  @id @default(uuid())
  sampleId    String
  method      AssayMethod
  purityPct   Decimal @db.Decimal(10, 6)  // 主元素纯度(黄金用)
  uncertainty Decimal? @db.Decimal(10, 6) // 不确定度 k=2
  unit        ConcentrationUnit @default(PERCENTAGE)
  elementResults ElementResult[]  // ICP 多元素时一对多
  fireAssayDetail FireAssayDetail? // 火试金时一对一
  testedAt    DateTime
  operatorId  String
  qcPassed    Boolean
}
```

## 影响

### 正面影响
- ✅ 业务模型清晰,CNAS 审核可解释
- ✅ 数据库 schema 直接对接检测方法,无需复杂业务映射
- ✅ 枚举化标准(元素/方法/单位),减少脏数据

### 负面影响 + 缓解
- ⚠️ **方法扩展性**:未来新增检测方法(原子吸收等),需扩展枚举;缓解:用 `AssayMethod.OTHER` + 备注
- ⚠️ **数据迁移复杂度**:旧 LIMS 数据迁移可能需映射;缓解:数据迁移脚手架预留

### 关键约束(给后续 ADR 的强约束)

1. **黄金纯度必须 Decimal(10,6)** —— ADR-0002 已落实
2. **必须有 SampleBatch(火试金批次)** —— 数据库 schema 必须包含
3. **必须有 ElementResult(ICP 多元素)** —— 数据库 schema 必须包含
4. **必须有 FireAssayDetail(火试金工艺参数)** —— 数据库 schema 必须包含
5. **必须有 Westgard + 6σ QC 规则** —— ADR-0014 后续补充
6. **必须有客户报告双 PDF + JSON 双存档** —— ADR-0006 已落实
7. **报告必须含元素 + 纯度 + 不确定度 + 方法 + QC 状态**

## 验证标准

- [ ] AssayMethod 枚举含 FIRE_ASSAY / ICP_OES / ICP_MS
- [ ] PreciousMetalElement 枚举含 Au/Ag/Pt/Pd 等
- [ ] SampleBatch 模型存在
- [ ] FireAssayDetail 模型存在
- [ ] ElementResult 模型存在
- [ ] Westgard + 6σ 规则引擎实现
- [ ] 火试金批次 E2E 测试
- [ ] ICP 多元素结果查询 P95 < 200ms
- [ ] 报告 PDF 含双签名(检测员 + 批准人)
- [ ] CNAS 审核员可独立验证每个结果

## 相关决策

- ADR-0002: 技术栈(NestJS + Prisma + PG)
- ADR-0003: 审计链
- ADR-0004: CA 证书
- ADR-0006: PDF 报告
- ADR-0014: Westgard QC 规则(待补充)

## 参考

- [GB/T 9288 首饰含金量火试金法测定](https://openstd.samr.gov.cn/)
- [GB/T 17373 金化学分析方法](https://openstd.samr.gov.cn/)
- [GB/T 11066 银化学分析方法](https://openstd.samr.gov.cn/)
- [ISO 17025:2017 检测和校准实验室能力](https://www.iso.org/standard/66912.html)
- [CNAS-CL01:2018 检测和校准实验室能力认可准则](https://www.cnas.org.cn/)
- [21 CFR Part 11 电子记录与电子签名](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11)
- [上海黄金交易所交割标准](https://www.sge.com.cn/)
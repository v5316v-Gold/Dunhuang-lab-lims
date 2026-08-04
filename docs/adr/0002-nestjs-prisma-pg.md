# ADR-0002:保留 NestJS 10 + Prisma 5 + PostgreSQL 16(含 TimescaleDB)

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 菩提老祖
> **影响范围**: 后端运行时、ORM、数据库选型

## 业务背景(关键约束)

**敦煌金质检中心**是专业贵金属(黄金为主)检测机构,核心业务:

| 检测方法 | 占比 | 应用场景 | 关键设备 |
|---|---|---|---|
| **火试金法(Fire Assay)** | ~70% | 黄金纯度仲裁检测(99.0%-99.999%) | 试金炉(马弗炉)、灰吹炉、天平(0.001mg) |
| **ICP-OES / ICP-MS** | ~25% | 多元素痕量分析(杂质 Pt/Pd/Ag/Cu/Fe/Pb) | 电感耦合等离子体光谱/质谱仪 |
| **XRF / 化学法 / 分光** | ~5% | 快速筛选、补测 | X 荧光光谱仪、原子吸收 |

**关键业务特征**:
- **样品类型**: 金锭(标准锭/非标)、金粉、合金、首饰、工业用金、回收金料
- **样品重量**: 0.1g - 10kg 不等(火试金需 0.2-2g 称样)
- **结果精度**: 纯度表示到 **0.001%**(如 Au 99.999%)
- **检测周期**: 火试金 4-6 小时/批;ICP 1-2 小时/批
- **法规合规**: 国家标准 GB/T 9288(贵金属首饰)、GB/T 11066(银)、上海黄金交易所交割标准
- **客户**: 黄金交易所、矿山、冶炼厂、首饰制造厂、回收商、质检监管机构
- **数据重要性**: 黄金检测数据涉及**巨额贸易结算**(单批价值可达千万),**数据不可篡改是核心**

**对架构的影响**:
- 火试金需要"批次管理"(一批多样品 + QC 样 + 平行样),**LIMS 必须支持样品批 + 平行样**
- 黄金纯度结果小数位严格,**Decimal 类型不能是 float**
- ICP 多元素检测 = **结果表是一对多(样品 → N 个元素结果)**,schema 必须支持
- 检测数据法律效力强,**审计链 + 电子签名 + 时间戳是合规底线**
- 客户往往需要**检测报告 = 黄金交易所交割凭证**,PDF 报告格式必须规范

## 背景

原 7 份架构文档(4411 行)已为 NestJS + Prisma + PostgreSQL 16 + TimescaleDB 量身定做,数据库设计 60+ 表、API 规范 683 行、CNAS 合规章节 618 行全部围绕这一技术栈展开。

CNAS 审核员会问"为什么选 X 技术",**文档/代码一致性是合规硬指标**。改语言 = 重写文档 = 推翻一切。

## 决策

**保留 NestJS 10 + Prisma 5 + PostgreSQL 16(+ TimescaleDB 扩展)技术栈**,不引入新后端语言或 ORM。

### 技术栈组件

| 层 | 选型 | 版本 | 用途 |
|---|---|---|---|
| **运行时** | Node.js | 20 LTS | 长期支持,生态成熟 |
| **框架** | NestJS | 10.x | 依赖注入 + 模块化 + OpenAPI |
| **语言** | TypeScript | 5.x | 严格模式,strict: true |
| **ORM** | Prisma | 5.x | Schema-first + 类型生成 + 迁移 |
| **数据库** | PostgreSQL | 16.x | ACID + JSONB + 触发器 + 分区 |
| **时序扩展** | TimescaleDB | 2.x | QC 趋势、设备日志、检测时序 |
| **缓存** | Redis | 7.x | 会话、限流、MFA、模板缓存 |
| **对象存储** | MinIO | latest | PDF 报告、原始证书、附件 |

## 理由

### 为什么 NestJS(而不选 Spring Boot / Go-Zero / FastAPI)

| 维度 | NestJS | Spring Boot | Go-Zero | FastAPI |
|---|---|---|---|---|
| **TypeScript 全栈** | ✅ | ❌ Java/Kotlin | ❌ Go | ❌ Python |
| **DI/模块化** | ✅ 完善 | ✅ 完善 | ⚠️ 手动 | ⚠️ 手动 |
| **OpenAPI 自动生成** | ✅ nestia/swagger | ✅ springdoc | ⚠️ 手写 | ✅ fastapi 内置 |
| **学习曲线** | ⭐ 中 | ⭐⭐ 陡 | ⭐ 中 | ⭐ 低 |
| **团队熟悉度** | ✅ 主仓经验 | ✅ 但 Java 工程师少 | ⚠️ 需新学 | ⚠️ 性能风险 |
| **CNAS 审计可解释性** | ✅ 主流 | ✅ 主流 | ⚠️ 较少见 | ⚠️ 较少见 |
| **文档成熟度** | ✅ 4411 行已定 | - | - | - |

**核心理由**:
1. 文档已定,改语言 = 重写 4411 行 = 浪费 1-2 周
2. 主仓 DunhuangGold-Design-AI 已有 NestJS 经验,降低学习成本
3. TypeScript 强类型在审计关键路径上减少运行时错误

### 为什么 Prisma(而不选 TypeORM / Drizzle / 原生 SQL)

| 维度 | Prisma | TypeORM | Drizzle | 原生 SQL |
|---|---|---|---|---|
| **类型生成** | ✅ 自动 | ⚠️ 装饰器反射 | ✅ 完整 | ❌ 无 |
| **Schema-first** | ✅ DSL 清晰 | ❌ 装饰器 | ✅ TS-first | - |
| **迁移工具** | ✅ 内置 | ⚠️ 弱 | ⚠️ 自研 | ⚠️ 手写 |
| **运行时性能** | ⭐⭐ 中 | ⭐⭐ 中 | ⭐⭐⭐ 高 | ⭐⭐⭐⭐ 最高 |
| **复杂查询** | ⚠️ `$queryRaw` | ✅ QueryBuilder | ✅ 链式 | ✅ 完全自由 |
| **审计链触发器** | ✅ 通过 migration 管理 | ✅ | ✅ | ✅ |
| **学习曲线** | ⭐ 低 | ⭐⭐ 中 | ⭐⭐ 中 | - |

**核心理由**:
1. Schema-first 设计利于 CNAS 审核员理解数据模型
2. 自动类型生成 + Zod schema 共享,与 ADR-0001 Monorepo 契合
3. 复杂审计/时序查询走 `$queryRaw` + 原生 SQL 触发器(性能关键路径)

### 为什么 PostgreSQL 16 + TimescaleDB

| 优势 | 详情 |
|---|---|
| **ACID 完整** | 黄金检测数据法律效力强,强事务必须 |
| **JSONB** | 检测结果动态字段(如 ICP 多元素结果)用 JSONB 存储 |
| **触发器** | **审计链 SHA256 在 DB 侧算**(ADR-0003 核心) |
| **UUID 原生** | `gen_random_uuid()` 无需扩展 |
| **TimescaleDB 时序** | QC 趋势、设备日志、检测时序自动分区,查询性能 10-100x |
| **FDW / 外部表** | 后续对接黄金交易所/ERP 留接口 |
| **审计日志就足够** | WAL + append-only audit_logs + 异地备份 |

## 业务驱动的技术决策

### 1. Decimal 类型不可妥协

```prisma
// ✅ 正确:黄金纯度小数位严格
model TestResult {
  id          String   @id @default(uuid())
  sampleId    String
  element     String   // 'Au', 'Ag', 'Cu', 'Pt', 'Pd'...
  purityPct   Decimal  @db.Decimal(10, 6)  // 999.999000
  uncertainty Decimal? @db.Decimal(10, 6)  // 不确定度
  unit        String   @default("ppm")    // 'ppm' | '%' | 'ppb'
}
```

**关键约束**:
- 黄金纯度 `Au%` 必须 Decimal(10,6),**禁止 float**(精度丢失 = 法律纠纷)
- 重量/质量 `Decimal(15,6)`,克到公斤
- ICP 检出限 `Decimal(15,9)`,ppb/ppt 级

### 2. 火试金法批次管理

```prisma
model SampleBatch {
  id          String   @id @default(uuid())
  batchNo     String   @unique  // 批次号 FB-20260804-001
  method      AssayMethod  // FIRE_ASSAY(火试金)/ ICP_OES / ICP_MS
  firedAt     DateTime
  furnaceNo   String   // 试金炉编号
  qcSampleId  String?  // QC 样 ID
  replicateCount Int @default(3)  // 平行样数(默认 3)
  samples     Sample[]
}

enum AssayMethod {
  FIRE_ASSAY      // 火试金法
  ICP_OES         // ICP-OES 光谱
  ICP_MS          // ICP-MS 质谱
  XRF             // X 荧光
  GRAVIMETRIC     // 重量法
  VOLUMETRIC      // 滴定法
  OTHER
}
```

### 3. ICP 多元素结果

```prisma
model IcpElementResult {
  id          String   @id @default(uuid())
  testId      String
  element     String   // 'Au','Ag','Pt','Pd','Cu','Fe','Pb','Ni','Zn','Rh','Ir'
  wavelength  Decimal? @db.Decimal(8,3)  // 波长 nm
  intensity   Decimal? @db.Decimal(15,3) // 强度
  concentration Decimal @db.Decimal(15,9) // 浓度
  unit        String   @default("ppm")
  lod         Decimal? @db.Decimal(15,9) // 检出限
  loq         Decimal? @db.Decimal(15,9) // 定量限
}
```

### 4. 火试金专用字段

```prisma
model FireAssayRecord {
  id            String   @id @default(uuid())
  testId        String   @unique
  sampleWeight  Decimal  @db.Decimal(15,6)  // 称样量 g
  leadButtonWeight Decimal? @db.Decimal(15,6)  // 铅扣重 g
  prillWeight   Decimal?  @db.Decimal(15,6)  // 金粒重 g
  partingAcid   String?  // 'HNO3(1:7)'  分金酸
  cupelLoss     Decimal? @db.Decimal(15,6)  // 灰吹损失
  furnaceTemp   Int?     // °C
  cupellationDuration Int?  // min 灰吹时长
  partingTime   Int?     // min 分金时长
  annealingTime Int?     // min 退火时长
  qcRecovery    Decimal? @db.Decimal(5,2)  // QC 样回收率 %
}
```

## 替代方案

### 备选 1:Java Spring Boot + MyBatis
- **优势**: 金融/合规行业主流;JDBC 性能最佳
- **拒绝理由**: 文档已为 NestJS 写定;改 Java = 重写 4411 行文档

### 备选 2:Go-Zero + GORM
- **优势**: 性能高;并发强
- **拒绝理由**: 文档不一致;Go 团队稀缺;CNAS 审核员对 Go LIMS 较少见

### 备选 3:Python FastAPI + SQLAlchemy
- **优势**: AI 集成方便;学习曲线低
- **拒绝理由**: 性能瓶颈(黄金检测并发不高可接受);但 TS 全栈优势丧失

## 影响

### 正面影响
- ✅ 文档/代码 100% 一致
- ✅ TypeScript 强类型减少运行时错误
- ✅ Prisma 自动生成类型与 Monorepo 共享类型契合
- ✅ TimescaleDB 时序查询性能极佳(QC 趋势/设备日志)

### 负面影响 + 缓解
- ⚠️ **Prisma 复杂查询性能**:缓解:`$queryRaw` 走原生 SQL
- ⚠️ **Node.js 单线程**:缓解:Cluster + BullMQ 队列处理 CPU 密集任务(PDF 渲染/QC 计算)
- ⚠️ **TypeScript 编译开销**:缓解:增量编译 + SWC/esbuild

### 关键约束

1. **黄金数据必须 Decimal**:`@db.Decimal(10,6)` 起,**禁止 float**
2. **批次管理**:火试金必须有 SampleBatch 概念
3. **多元素结果**:ICP 必须一对多结果表
4. **元素枚举**:Au/Ag/Pt/Pd/Cu/Fe/Pb/Ni/Zn/Rh/Ir 等贵金属常用元素必须枚举
5. **单位枚举**:`%`(纯度)、`ppm`、`ppb`、`g`(重量)
6. **方法枚举**:必须包含 AssayMethod(火试金/ICP-OES/ICP-MS 等)

## 验证标准

- [x] NestJS 10.x 安装成功
- [x] Prisma 5.x schema 定义 60+ 表
- [x] PG 16 + TimescaleDB 扩展启用
- [ ] 黄金纯度字段全部 Decimal(10,6)(测试)
- [ ] 火试金批次管理 E2E 测试通过
- [ ] ICP 多元素结果查询性能 P95 < 200ms
- [ ] 审计链触发器在 DB 侧正常工作

## 相关决策

- ADR-0001: Monorepo
- ADR-0003: 审计链 PG 触发器
- ADR-0011: 贵金属检测业务约束 ⬅ 新增

## 参考

- [NestJS 官方文档](https://docs.nestjs.com/)
- [Prisma 官方文档](https://www.prisma.io/docs)
- [TimescaleDB 官方文档](https://docs.timescale.com/)
- [GB/T 9288 首饰含金量火试金法测定](https://openstd.samr.gov.cn/)
- [GB/T 11066 银化学分析方法](https://openstd.samr.gov.cn/)
# 敦煌金质检 LIMS (Dunhuang Gold Quality LIMS)

> **CNAS-CL01:2018 / ISO/IEC 17025:2017 / CMA** 合规实验室信息管理系统
> 面向贵金属(黄金 / 白银 / 铂 / 钯)检测业务的端到端闭环 LIMS

[![Phase](https://img.shields.io/badge/phase-0.5%20%E2%86%92%20W5-brightgreen)]()
[![Tests](https://img.shields.io/badge/tests-39%2F39%20PASS-success)]()
[![CNAS](https://img.shields.io/badge/CNAS-CL01:2018-blue)]()
[![CMA](https://img.shields.io/badge/CMA-2026--11--03-orange)]()
[![License](https://img.shields.io/badge/license-UNLICENSED-red)]()

---

## 一、项目定位

**敦煌金质检 LIMS** 是为「敦煌金质检」黄金检测实验室定制的 **CNAS + CMA 双合规** 实验室信息管理系统,
服务于「黄金检测 → 出证 → 贵金属条码 → 客户取回/留存」全流程。

| 项目 | 内容 |
|---|---|
| **业务领域** | 贵金属纯度检测(黄金 / 白银 / 铂 / 钯 等 8 种) |
| **核心场景** | 火试金法(GB/T 9288)、ICP-OES 多元素分析、容量法、滴定法 |
| **合规目标** | CNAS-CL01:2018(等同 ISO/IEC 17025:2017)+ CMA 计量认证 |
| **现场评审目标** | **2026-11-03** |
| **开发阶段** | Phase 0.5-4 基线 + W1-W5 功能闭环(已全部交付)|
| **代码量** | 后端 ~5500 行 + 前端 ~5000 行 + 数据库 schema 39 个 model |

---

## 二、技术栈

### 后端
| 技术 | 版本 | 用途 |
|---|---|---|
| **NestJS** | 10.4 | Web 框架 |
| **TypeScript** | 5.x | 类型安全 |
| **Prisma** | 5.22 | ORM |
| **PostgreSQL** | 16 | 数据库 |
| **Redis** | 7 | 缓存 + Session |
| **JWT** | — | 认证 |
| **Argon2** | — | 密码哈希 |
| **MFA/TOTP** | — | 双因素 |
| **SSE** | — | W5 实时事件推送 |
| **class-validator** | — | DTO 校验 |
| **Swagger** | 7.4 | API 文档 |

### 前端
| 技术 | 版本 | 用途 |
|---|---|---|
| **React** | 18 | UI 框架 |
| **Vite** | 5.4 | 构建工具 |
| **TypeScript** | 5.x | 类型安全 |
| **Ant Design** | 5.x | 组件库 |
| **TanStack Query** | 5 | 数据获取 |
| **React Router** | 6 | 路由 |
| **Zustand** | 4 | 状态管理 |
| **EventSource API** | — | W5 SSE 客户端 |

### 基础设施
| 技术 | 用途 |
|---|---|
| **Docker Compose** | PostgreSQL / Redis / MinIO 容器化 |
| **pnpm Monorepo** | 多包管理 |
| **Turbo** | 构建编排 |

---

## 三、模块清单(39 个 model)

### 核心业务(8 个)
```
User              Department          Personnel          Training
Competency        Sample              SampleBatch        Report
ReportStage       ReportSignature     AuditLog           MethodValidation
```

### 检测支撑(8 个)
```
Equipment         Calibration         Maintenance         PeriodicCheck
Method            ReferenceMaterial   QcMeasurement      ElementResult
```

### 试剂 / 危废 / 气体 / 容器(11 个)
```
Reagent           ReagentLot           ReagentUsage        Hazard
EmergencyPlan     FileAttachment       WasteRecord         Gas
GasPurchase       GasUsage            Container           ContainerUsage
```

### 贵金属业务(2 个 — W4)
```
SamplingRecord    PreciousMetalBar
```

### 实时事件(W5 — Global 模块)
```
RealtimeBus(内存,无 model)
```

### 监管合规(2 个)
```
UserSession        UserRoleAssignment
```

---

## 四、W1-W5 功能模块(树状图已 100% 落地)

| 模块 | 后端 | 前端 | 测试 | 状态 |
|---|---|---|---|---|
| **W1 危废管理** CNAS §7.10 | ✅ waste.service(7方法) | ✅ WasteList.tsx + 3 modal | 9/9 PASS | ✅ |
| **W2 气体管理** CNAS §7.5 + §6.4 | ✅ gas.service(10方法) | ✅ GasList.tsx + 3 modal | 9/9 PASS | ✅ |
| **W3 容器管理** CNAS §7.5 + §6.5 | ✅ container.service(10方法) | ✅ ContainerList.tsx + 3 modal | 9/9 PASS | ✅ |
| **W4 贵金属业务** CNAS §7.5 + §7.8 + §7.4 | ✅ precious-metal.service(10方法) | ✅ PreciousMetalList.tsx + 3 modal + 双 Tabs | 8/8 PASS | ✅ |
| **W5 UX 增强** | ✅ realtime bus + SSE | ✅ Dashboard + RealtimeCenter + ScanPage + i18n | 4/4 PASS | ✅ |

**累计**:39/39 测试全 PASS / 40+ API 端点 / 15 项前端菜单 / 13 种审计事件 / 8 种实时事件

---

## 五、CNAS-CL01:2018 合规覆盖

| 条款 | 内容 | 支撑模块 |
|---|---|---|
| **§6.4 外部提供的产品和服务** | 供应商管理 | W2 气体采购 |
| **§6.5 设备** | 设备校准 + 期间核查 + 维护 | Equipment / Calibration / PeriodicCheck / Maintenance / **W3 容器** |
| **§7.2 人员** | 资质 + 培训 + 授权 | Personnel / Training / Competency |
| **§7.4 记录** | 监管链追溯 | SampleBatch + W4 取样记录(ChainOfCustody) |
| **§7.5 设施与环境条件** | 设备 + 容器 + 气体管理 | Equipment / **W2 / W3** |
| **§7.6 测量溯源性** | 标准物质 + 校准 | ReferenceMaterial / Calibration |
| **§7.7 期间核查** | Westgard 规则 + 期间核查 | QcMeasurement / PeriodicCheck |
| **§7.8 结果报告(含不确定度)** | 三级审核 + PDF | Report / ReportStage / ReportSignature |
| **§7.10 不符合工作** | 危废 + 偏差 + CAPA | **W1 危废** + EmergencyPlan |
| **§7.11 数据控制** | 审计链 | AuditLog + 13 种事件 |

---

## 六、CNAS 评审现场准入

### 6.1 入口地址
| 服务 | URL | 说明 |
|---|---|---|
| 前端 Web UI | http://127.0.0.1:5173/ | 评审现场演示 |
| 后端 API | http://127.0.0.1:3030/api/v1 | Swagger 文档 |
| Swagger UI | http://127.0.0.1:3030/api/docs | API 在线文档 |
| 健康检查 | http://127.0.0.1:3030/api/v1/health/live | — |

### 6.2 测试账号
| 用户名 | 密码 | 角色 |
|---|---|---|
| `admin` | `Admin@Pass123` | 管理员 |
| `qa.manager` | `Analyst@Pass123` | 质量经理 |
| `fire.senior` | `Analyst@Pass123` | 高级分析员(火试金) |
| `icp.analyst` | `Analyst@Pass123` | ICP 分析员 |

### 6.3 Docker 容器(已运行)
| 容器 | 端口 | 用途 |
|---|---|---|
| dunhuang-pg | 55432 | PostgreSQL 16 |
| dunhuang-redis | 56379 | Redis 7 |
| dunhuang-postgres | 5432 | (其他项目) |
| dunhuang-redis-compose | 6379 | (其他项目) |

---

## 七、本地启动

### 7.1 前置依赖
```bash
node >= 22
pnpm >= 9
Docker Desktop(运行中)
```

### 7.2 数据库(Docker)
```bash
cd apps/backend
# 容器已在跑,可跳过
# 手动启动:
docker run -d --name dunhuang-pg \
  -e POSTGRES_USER=lims -e POSTGRES_PASSWORD=lims_dev_pwd \
  -e POSTGRES_DB=dunhuang_lims \
  -p 55432:5432 postgres:16
```

### 7.3 后端
```bash
cd apps/backend

# 1) 安装依赖
node node_modules/.bin/pnpm install  # 或用 pnpm 实际安装

# 2) 数据库迁移
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

# 3) 生成 Prisma Client
node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma

# 4) 编译 + 启动
NODE_ENV=development node node_modules/@nestjs/cli/bin/nest.js build
NODE_ENV=development node dist/src/main.js

# 5) 种子数据(可选)
node node_modules/ts-node/dist/bin.js --transpile-only prisma/seed-example.ts
```

### 7.4 前端
```bash
cd apps/frontend
NODE_ENV=development node node_modules/vite/bin/vite.js --port 5173 --host 127.0.0.1
```

### 7.5 测试
```bash
cd apps/backend
# 全部测试
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --no-coverage --forceExit

# 单个 spec
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --no-coverage --forceExit \
  --testPathPattern w5-realtime
```

---

## 八、关键文档

| 文档 | 路径 | 状态 |
|---|---|---|
| **架构 - 现有 LIMS 功能树状图** | `docs/architecture/current-lims-feature-tree.md` | ✅ |
| **架构 - 飞书 LIMS 功能树(融合)** | `docs/architecture/lims-feature-tree-from-feishu.md` | ✅ |
| **架构 - 竞争对比分析** | `docs/architecture/competitive-analysis.md` | ✅ |
| **UI 设计令牌** | `apps/frontend/src/styles/design-tokens.css` | ✅ |
| **CNAS 评审 URS** | `docs/validation/URS-CNAS-LIMS.md` | ✅ |
| **CNAS 评审 FS** | `docs/validation/FS-CNAS-LIMS.md` | ✅ |
| **CNAS 评审 VSR** | `docs/validation/VSR-CNAS-LIMS.md` | ✅ |
| **2026-08-13 阶段审计** | `docs/AUDIT-2026-08-13.md` | ✅ |

---

## 九、版本演进路线

```
Phase 0.5 基线加固     ✅ commit fcc15ea
Phase 1-4 核心闭环    ✅ commit 86dcba1 - 99c7c7d (含批次/检测/报告/校准/QC)
W1 危废管理(CNAS §7.10)   ✅ commit 82273ef
W2 气体管理(CNAS §7.5+§6.4) ✅ commit c277969
W3 容器管理(CNAS §7.5+§6.5) ✅ commit ab965a1
W4 贵金属业务(CNAS §7.5+§7.8+§7.4) ✅ commit aaac66c
W5 UX 增强(SSE+BI+QR+i18n) ✅ commit 6476801
W6 计划 — MU 不确定度评定 + RM 溯源闭环  ⏳ 待启动
CNAS 现场评审准备             ⏳ 2026-11-03
```

---

## 十、关键设计原则

1. **数据完整性(ALCOA+)**:所有业务字段可追溯到操作者(`createdById` / `operatorId` / `sampledById`)
2. **审计链贯穿**:每次状态变更触发 `SecurityAuditService.system()` 写 13 类事件之一
3. **CNAS-CL01 合规映射**:每个模块 header 注明对应条款(§6.4 / §6.5 / §7.5 / §7.6 等)
4. **零新依赖原则**(W5 阶段):浏览器原生 API + antd 已有组件,避免安装重型包
5. **测试驱动**:每个新模块均含 `*.spec.ts` 集成测试,必须 100% PASS

---

## 十一、贡献者

- **赫尔墨斯·维林 (LIMS-Architect-01)** — 资深 LIMS 架构师 / CNAS 实验室信息化高级专家 / 全栈技术专家
- **菩提老祖** — 项目主导方 / 敦煌金质检业务负责人

---

## 十二、许可证

UNLICENSED — 内部使用,需经「敦煌金质检」书面授权。

---

**最后更新**:2026-08-15
**当前 commit**:`a9bc085` feat(phase-1b): P0 合规硬化冲刺
**CNAS 评审目标**:2026-11-03(距今 80 天)
**阶段状态**:

| 阶段 | 状态 | 关键 commit | 评估 |
|---|---|---|---|
| Phase 0 / 0.5 / 1-4 | ✅ 完成 | 86dcba1 - 99c7c7d | 基础闭环 |
| W1 危废管理 (§7.10) | ✅ 完成 | 82273ef + 9795493 | 评审合规 |
| W2 气体管理 (§7.5+§6.4) | ✅ 完成 | c277969 + 3f9b9bd | 评审合规 |
| W3 容器管理 (§7.5+§6.5) | ✅ 完成 | ab965a1 | 评审合规 |
| W4 贵金属业务 (§7.5+§7.8+§7.4) | ✅ 完成 | aaac66c | 评审合规 |
| W5 UX 增强 (SSE+BI+QR+i18n) | ✅ 完成 | 6476801 | 体验增强 |
| Phase 1A 架构冻结+证据链 | ✅ PASS | 6a01acf / ea929d6 / a443054 | 9 文档 + DB trigger |
| **Phase 1B P0 合规硬化** | ✅ **PASS** | **a9bc085** | **6 块 P0 全部闭环** |
| Phase 1C 功能开发 | ⏸️ 待启动 | — | 允许(条件见下) |

**累计**:39 个 model / 39/39 测试 PASS / 15 项前端菜单 / 7 个 DB migration / 12 个后端模块 / 4 个 ADR / 60+ 文档 / 1500+ 行 Phase 1B 新代码

---

## 十三、Phase 1B P0 合规硬化详情

**任务定义**:**不是功能开发**,而是把 Phase 1A Gate Review 识别的 8 项 🔴 风险全部闭环。

### 6 块 P0 产出

| # | 块 | 文档 | 代码 | 验证 |
|---|---|---|---|---|
| **P0-A** 不确定度模块 (§7.8) | `docs/adr/0012-uncertainty-evaluation.md` | `UncertaintyReport` 表 + `common/qc/westgard.ts` GUM 5 类分量 + 6 端点 | build 0 错 |
| **P0-B** 标准物质全链路 (§7.6) | (本 README) | `ReferenceMaterialUsage` 台账 + 7 字段增强 + 过期阻断 + 期间核查 | 3 migration apply |
| **P0-C** OOS + Westgard (§7.9/§7.10) | (本 README) | `NonConformance` 表 + 6 规则算法 + 自动 OOS 触发 | migration apply |
| **P0-D** 状态机强制 (§7.4) | (本 README) | 5 实体状态机(`Sample/Test/Report/WasteRecord/Container`)+ `Report.issue()` 守卫 | build 0 错 |
| **P0-E** 报告签字链路 (§7.8/§7.11) | (本 README) | `ReportStage.signedAt` + `ReportSignature.signatureHash`(SHA256) | migration apply |
| **P0-F** RBAC 资源级 (§7.2) | (本 README) | `@Ownership` 装饰器 + `OwnershipGuard` + ADMIN/QA bypass | build 0 错 |

### 评审必答问题 — Phase 1A → Phase 1B 对比

| 评审问题 | Phase 1A 之前 | **Phase 1B 之后** |
|---|---|---|
| "你这 Au 99.99% ± 0.02% 怎么算的?" | ❌ 手填 | ✅ **5 类分量 + GUM u_c + 公式快照** |
| "用了哪个标准物质?证书呢?" | ❌ 无台账 | ✅ **ReferenceMaterialUsage + SHA256 证书** |
| "RM 过期了怎么办?" | ❌ 不阻断 | ✅ **系统级 `assertUsable` 阻断** |
| "QC 失控了你怎么知道?" | ❌ 字段是字符串 | ✅ **6 规则 Westgard 自动应用** |
| "QC 失控后呢?" | ❌ 无流程 | ✅ **自动触发 OOS + NonConformance** |
| "这批样品到哪一步了?" | ❌ 可乱跳 | ✅ **5 实体状态机守卫** |
| "分析员 A 改 B 的数据?" | ❌ 任意 | ✅ **`@Ownership` 装饰器** |

### Phase 1B Gate 结论:**PASS** → 允许进入 Phase 1C(条件)

| 条件 | 状态 | 说明 |
|---|---|---|
| 6 块 P0 完成 | ✅ | 见上表 |
| 39/39 回归测试 | ✅ | W1-W5 全保留 |
| Build 0 错 | ✅ | 1100+ 行新代码 |
| Migration apply | ✅ | 4 个新 migration |

**Phase 1C 准入条件**(必做第一周):
1. **补 P0 专项 spec 测试**(Westgard/StateMachine/Ownership/Uncertainty/ReferenceMaterial 各 1 spec)— 3h
2. 启动 P1 任务(报告 PDF / 校准证书 / RM 期间核查 / 留样 / 内审 / 管评)— 11h
3. Phase 1C 末:模拟内部评审(实验室主任扮 CNAS 评审员)

### 关键文档索引

| 文档 | 路径 |
|---|---|
| Phase 1A Gate Review(Aiden 独立) | `docs/gate/phase-1a/AIDEN-GATE-REVIEW-REPORT.md` |
| Phase 1A 9 份架构文档 | `docs/gate/phase-1a/*.md` |
| Phase 1B Gate Report | `docs/gate/phase-1b/PHASE-1B-GATE-REPORT.md` |
| ADR-0012(不确定度决策) | `docs/adr/0012-uncertainty-evaluation.md` |
| CNAS-CMA 条款矩阵 | `docs/gate/phase-1a/CNAS-CMA-TRACEABILITY-MATRIX.md` |
| URS / FS / VSR | `docs/validation/URS.md` / `FS.md` / `VSR.md` |

---

## 十四、Phase 1C 功能开发(12 项全部完成)

| 周 | 功能 | 测试 |
|---|---|---|
| W+4 | 报告 PDF 深化 / 校准证书下载 / 留样到期告警 | 报告 PDF 9 it + 留样证书 7 it |
| W+5 | RBAC 全表 / 火试金表单 / 校准曲线 R² / Levey-Jennings 图 | 各 3-4 it |
| W+6 | 临时授权 UI / 监督 CRUD / 盲样流程 / 安全扫描 | 各 3-4 it |
| W+7 | PT 流程 / 报告 PDF 完整闭环 / MU 报告 PDF | 各 3-5 it |

## 十五、Phase 2 试运行 + 内审 + 管评 + 模拟评审(流程文档 8 份)

- W8: 培训大纲 / 试运行指南 / bug 模板
- W9: 内审检查表(CNAS §4-§7 全 15 条款)/ 内审整改 / 管评 / 模拟评审计划 / 模拟整改
- W10: NCR 关闭汇总 / URS/FS/VSR 定稿 v2.0 / 现场演练脚本 / Aiden 最终 Gate

## 十六、最终状态(全项目收官)

| 维度 | 数值 |
|---|---|
| **Prisma 模型** | **47** |
| **测试 spec / 用例** | **43 / 365(全绿)** |
| **迁移** | **21** |
| **API 端点** | **138+** |
| **覆盖率** | CNAS 85% / CMA 58% / 总 88% |
| **前端菜单** | 16 项 |

### Aiden 最终 Gate 结论

> # 🚦 **PASS — 系统具备 CNAS 现场评审演示能力(置信度 90%)**

### 交付链(Phase 0.5 → 2 全部闭环)

```
Phase 0.5-4  基线 + W1-W5(危废/气体/容器/贵金属/UX)
Phase 1A     架构冻结 + 证据链补强(PASS WITH CONDITIONS)
Phase 1B     P0 合规硬化 6 块(不确定度/标准物质/Westgard/状态机/签字/RBAC)
Phase 1B+    P1 任务 + 模拟评审
Phase 1C     12 项功能开发
Phase 2      试运行 + 内审 + 管评 + 模拟评审 + 最终 Gate
```

---

**最后更新**: 2026-08-15
**当前 commit**: `8e79a1a`(Phase 2 收官)
**CNAS 现场评审**: 2026-11-03
**状态**: **全项目收官,系统具备 CNAS 现场评审演示能力**。剩余 3 项系统外工作(试运行数据录入 / 质量手册 / 现场演练)需实验室主任在评审前完成。
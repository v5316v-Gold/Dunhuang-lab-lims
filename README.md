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
**当前 commit**:6476801 feat(w5): UX 增强
**CNAS 评审目标**:2026-11-03
**状态**:Phase 0.5-4 + W1-W5 全部闭环,39 个 model / 39 测试 PASS
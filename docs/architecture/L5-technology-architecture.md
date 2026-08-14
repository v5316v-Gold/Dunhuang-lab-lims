# L5-技术架构 架构规范 (Technology Architecture)

> **版本**: v1.0
> **日期**: 2026-08-13
> **编制**: LIMS-Architect-01(架构规范工程师)
> **评审**: 全栈 Lead、DevOps、QA
> **批准**: QA Manager
> **状态**: 草案
> **模板依据**: `docs/architecture/TEMPLATE.md` v1.0

---

## 1. 节点名称

**L5-技术架构**(Technology Architecture / 技术选型与工程规范)

## 2. 建设目标

1. 固化**技术选型矩阵**(语言/框架/数据库/中间件/测试/DevOps)
2. 定义**代码规范与分层约束**(ESLint/TypeScript/目录)
3. 定义**CI/CD 流水线设计**
4. 建立**依赖管理规范**(pnpm lockfile + 版本策略)
5. 为 L6 部署、L7 验证提供工具链依据

## 3. 业务范围

- **In-scope**:
  - 后端技术栈(NestJS/Prisma/PG/Redis)
  - 前端技术栈(React/Vite/状态管理/图表)
  - 测试技术栈(Jest/supertest/ts-jest)
  - 工程化(pnpm/Turbo/ESLint/TypeScript/GitHub Actions)
- **Out-of-scope**:
  - 部署拓扑 → 归 L6
  - 验证体系 → 归 L7

## 4. 背景

Phase 0 + 0.5 已落地完整技术栈(见 package.json 与 pnpm-lock.yaml)。Phase 0.5 Task F 已修复 ESLint monorepo resolver,CI lint job 已启用。本层将技术选型**固化为规范**,并记录版本与替代项,确保演进可控。

## 5. 参与角色

| 角色 | 职责 | 编写/评审/批准 |
|---|---|---|
| 全栈 Lead | 选型确认 | 评审 |
| DevOps | CI/CD 确认 | 评审 |
| QA | 测试栈确认 | 评审 |
| LIMS-Architect-01(架构师) | 本层编写 | 编写 |

## 6. 输入 - 输出

| 方向 | 来源/去向 | 内容 |
|---|---|---|
| 输入 | L4 模块 + 现有 package.json/pnpm-lock/CI + ADR-0001/0002/0009 | 模块需求、现状、决策 |
| 输出 | L6 部署、L7 工具链 | 选型矩阵、工程规范 |

## 7. 前置后置条件

- **前置**: L4 GATE PASS(模块与契约确认)
- **后置**: 选型矩阵评审通过、每项有 ADR 依据、CI 流水线设计完成

## 8. 业务流程

技术演进流程(文字描述):

```
需求(来自 L4 模块)→ 选型评估(五维评分:能力/生态/性能/合规/成本)
  → 定稿 → ADR 记录 → 落地实施 → 持续维护(版本升级/漏洞修复)
```

## 9. 状态机

技术项生命周期:

| 状态 | 含义 | 进入事件 | 离开事件(目标) |
|---|---|---|---|
| EVALUATING | 评估中 | 新需求 | 决策 → DECIDED |
| DECIDED | 已决策 | 评审通过 | 落地 → ADOPTED |
| ADOPTED | 已采用 | 首次使用 | 弃用 → DEPRECATED |
| DEPRECATED | 已弃用 | 替代品 | 移除 → REMOVED |

## 10. 数据模型

技术栈清单(组件级):

| 层 | 组件 | 版本 | 定位 | ADR |
|---|---|---|---|---|
| 工程 | pnpm | 9.x | 包管理 | 0001 |
| 工程 | Turborepo | 2.x | 构建编排 | 0001 |
| 语言 | TypeScript | 5.4+(5.9 实装) | 全栈语言 | 0001 |
| 后端 | NestJS | 10.4 | 应用框架 | 0002 |
| ORM | Prisma | 5.22 | 数据访问 | 0002 |
| DB | PostgreSQL | 16 | 主数据库 | 0002 |
| DB | TimescaleDB | PG16 版 | 时序/趋势 | 0002 |
| 缓存 | Redis | 7 | 缓存/会话 | 0009 |
| 认证 | @nestjs/jwt + passport | 10.x | JWT | 0009 |
| 认证 | speakeasy(TOTP) | 2.x | MFA | 0009 |
| 前端 | React + Vite | 18/5.x | SPA | 0001 |
| 前端 | Ant Design | 5.x | UI 组件 | — |
| 前端 | TanStack Query / Zustand | 5.x/4.x | 数据/状态 | — |
| 前端 | ECharts | 5.x | 图表 | — |
| 前端 | Zod | 3.x | 校验 | — |
| 状态机 | XState | 5.x | 流程编排 | 0005 |
| 测试 | Jest + ts-jest | 29.x | 单元/集成 | — |
| 测试 | supertest | 7.x | HTTP 测试 | — |
| Lint | ESLint 8 + TS-eslint + import | 8.57 | 代码质量 | 0001 |
| 格式化 | Prettier | 3.x | 代码格式 | — |
| CI | GitHub Actions | — | 流水线 | — |
| 容器 | Docker Compose | — | 本地环境 | 0008 |

## 11. 字段(工程规范关键项)

| 规范项 | 值 | 说明 |
|---|---|---|
| 包管理器 | pnpm 9 | lockfile 强制提交 |
| Node 版本 | 20.x(CI)/22.x(本地) | engines 约束 |
| TypeScript strict | 开启 | 代码质量 |
| 目录规范 | src/modules / src/common / src/infrastructure | 分层约束 |
| commit 规范 | 约定式提交(conventional) | fix/feat/test/docs/ci |
| 分支模型 | main + feature/* | PR 合入 |

## 12. 业务规则

| 编号 | 规则 | 可测试性 |
|---|---|---|
| BR-T-01 | 版本锁定(pnpm-lock.yaml 提交) | lockfile 检查 |
| BR-T-02 | 新依赖须评审 + ADR 记录 | 依赖变更检查 |
| BR-T-03 | ESLint 0 errors 才可合入 | CI lint job |
| BR-T-04 | 测试 PASS 才可合入 | CI test job |
| BR-T-05 | 向后兼容 ≥ 1 个版本 | 升级策略 |
| BR-T-06 | 禁止生产使用 devDependencies | package 检查 |

## 13. 异常处理

| 异常场景 | 检测方式 | 响应策略 |
|---|---|---|
| 依赖漏洞 | SCA 扫描 | 升级 + 回归 |
| 版本冲突 | pnpm 冲突 | 升级策略评审 |
| 构建失败 | CI build | 修复 + 重跑 |
| Windows shim 兼容问题 | 本地运行报错 | 直接调 node 入口(jest/prisma) |

## 14. RBAC 要求

| 角色 | 依赖安装 | CI 修改 | 版本升级 | main 合入 |
|---|---|---|---|---|
| 全栈 Lead | ✅ | ✅ | ✅(评审) | PR |
| DevOps | ✅ | ✅ | ❌ | PR |
| QA | ❌ | ❌ | ❌ | ❌ |
| 架构师 | ❌ | ✅ | ✅ | PR |

## 15. 审计要求

| 审计事件 | 触发条件 | 记录字段 |
|---|---|---|
| 依赖变更 | lockfile 变更 | diff + PR |
| 版本升级 | 升级 PR | 版本前后 + 影响 |
| CI 失败 | 流水线 | 日志留存 |

## 16. 合规要求 (CNAS/CMA/ISO 17025)

| 标准条款 | 要求摘要 | 本层实现 |
|---|---|---|
| CNAS-CL01:2018 §6.3(设备) | 软件视为设备,需确认适用性 | 选型评估 + ADR |
| CNAS-CL01:2018 §6.5(外部服务) | 外部软件供应商管理 | 供应商清单 |
| GAMP 5 | COTS 验证 | L7 验证架构 |

## 17. API 要求

**API 要求: N/A** — 理由:本层为技术选型,接口契约归 L4。

## 18. 验收标准

- [ ] 选型矩阵覆盖 25+ 组件,每项有版本与 ADR 依据
- [ ] ESLint 0 errors(实盘验证)
- [ ] CI 流水线设计完成(lint/typecheck/build/test)
- [ ] pnpm-lock.yaml 提交确认
- [ ] commit 规范与分支模型定稿
- [ ] Gate 检查表 G1-G8 全 PASS

## 19. 依赖关系

- **上游依赖**: L4 应用架构
- **下游供应**: L6 部署、L7 验证工具链、L8 运维监控选型

## 20. 附录

### 20.1 参考资料

- `package.json` / `pnpm-lock.yaml`
- `.github/workflows/ci.yml`
- `docs/adr/0001-monorepo-turborepo.md`、`0002-nestjs-prisma-pg.md`、`0008-local-k8s-kind-k3d.md`、`0009-jwt-refresh-totp-self-hosted.md`
- `.eslintrc.cjs`

### 20.2 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布 | LIMS-Architect-01 |

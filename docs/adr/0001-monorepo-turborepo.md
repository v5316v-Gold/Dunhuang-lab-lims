# ADR-0001:采用 Monorepo + pnpm + Turborepo

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 菩提老祖
> **影响范围**: 仓库结构、CI/CD、依赖管理

## 背景

LIMS 系统需要前后端共享大量类型定义(DTO、枚举、错误码)、共享业务组件库、合规核心包(审计链/SHA256/电子签名)。如果采用多仓库,会面临:

1. **类型同步问题**:前端 TypeScript 类型与后端 Prisma 类型不一致,接口联调时反复返工
2. **共享组件复用难**:登录页、错误页、PDF 预览组件无法跨项目复用
3. **合规包版本管理**:审计链/CA 签名这些合规关键模块,版本漂移会导致 CNAS 审核失败
4. **CI 重复构建**:多仓库各自跑 CI,资源浪费

## 决策

**采用 Monorepo + pnpm workspaces + Turborepo**,目录结构:

```
Dunhuang-lab-lims-main/
├── apps/backend/        # NestJS 后端
├── apps/frontend/       # React 前端
├── packages/shared-types/      # 跨前后端 TS 类型 + Zod
├── packages/ui-kit/            # 业务组件库
├── packages/compliance-core/   # 合规核心(审计/签名/ALCOA+)
└── packages/config/            # 共享配置
```

## 理由

### 为什么 Monorepo

| 优势 | 详情 |
|---|---|
| **类型共享零摩擦** | `@dunhuang/lims-shared-types` 一处定义,前后端同步消费 |
| **合规包强一致** | `compliance-core`(审计链/SHA256/电子签名)是 CNAS 审核关键模块,版本必须强一致 |
| **代码评审一体化** | 一个 PR 即可看到端到端改动,无需跨仓库协调 |
| **CI 缓存命中** | Turborepo 远程缓存 + 本地缓存,二次构建提速 5-10x |

### 为什么 pnpm 而非 npm/yarn

| 优势 | 详情 |
|---|---|
| **磁盘节省 70%+** | pnpm 用硬链接 + 内容寻址存储,`node_modules` 不重复 |
| **更严格的依赖解析** | phantom dependency(幽灵依赖)在 pnpm 下被强制禁止,避免"没在 package.json 里却能 import"的隐患 |
| **monorepo 友好** | `pnpm-workspace.yaml` 原生支持 workspace 协议,`"@dunhuang/lims-shared-types": "workspace:*"` |
| **速度快** | 安装速度比 npm 快 2-3x,比 yarn 略快 |

### 为什么 Turborepo 而非 Nx/Lerna

| 维度 | Turborepo | Nx | Lerna |
|---|---|---|---|
| **学习曲线** | ⭐ 极低 | 较高 | 中 |
| **配置复杂度** | 极简(`turbo.json`) | 复杂 | 中 |
| **远程缓存** | ✅ 内置 Vercel | ✅ 内置 | ❌ 需第三方 |
| **任务编排** | `dependsOn` + `cache` | 完整图引擎 | 基础 |
| **与 pnpm 集成** | 完美 | 良好 | 良好 |
| **运维成本** | 极低 | 中 | 中 |
| **社区成熟度** | ⭐ Vercel 主推 | ⭐⭐ 成熟 | ⭐ 维护减少 |

**选择 Turborepo**:与 DunhuangGold-Design-AI 主仓技术栈一致;运维成本最低;任务编排够用。

## 替代方案

### 备选 1:Nx Monorepo
- **优势**: 更完整的任务图;插件生态丰富
- **拒绝理由**: 学习曲线陡;配置复杂度高;当前团队规模不需要这么强大的能力

### 备选 2:多仓库(multi-repo)
- **优势**: 仓库独立,权限隔离
- **拒绝理由**: 类型同步难;共享包版本漂移;CI 重复构建

### 备选 3:yarn workspaces
- **优势**: 兼容性好
- **拒绝理由**: 磁盘浪费;phantom dependency 问题严重;pnpm 更现代

## 影响

### 正面影响
- ✅ 类型 100% 同步(后端 Prisma schema 改动,前端 IDE 立即报错)
- ✅ 合规核心包单一真源(`compliance-core` 升级即生效)
- ✅ CI 构建提速(本地缓存命中)

### 负面影响 + 缓解
- ⚠️ **仓库体积膨胀**:缓解措施:`.gitignore` 严格过滤 `node_modules`、`dist`、`.turbo`
- ⚠️ **CI 单点失败**:全仓 lint/test 失败会阻断合并;缓解:按包拆分 CI 任务(`turbo run test --filter=@dunhuang/lims-backend`)
- ⚠️ **新人学习成本**:理解 workspace 协议;缓解:`CONTRIBUTING.md` 详细说明

### 关键约束
1. **依赖方向强约束**:ESLint `no-restricted-imports` 强制:
   - `apps/*` 可依赖 `packages/*`
   - `packages/*` 不可依赖 `apps/*`
   - `packages/compliance-core` 仅依赖第三方包,不可依赖任何业务包
2. **包命名空间统一**:所有内部包以 `@dunhuang/lims-` 为前缀
3. **版本协议统一**:内部包统一 `"workspace:*"` 协议

## 验证标准

- [x] `pnpm install` 一次安装全部依赖
- [x] `pnpm -F @dunhuang/lims-backend dev` 可启动后端
- [x] `pnpm -F @dunhuang/lims-frontend dev` 可启动前端
- [x] `turbo run build` 全量构建成功
- [x] 共享类型在前后端均能消费:`import { SampleDto } from '@dunhuang/lims-shared-types'`
- [ ] 远程缓存命中率 ≥ 80%(生产 CI 阶段)

## 相关决策

- ADR-0002: NestJS + Prisma + PG 技术栈
- ADR-0003: 审计链 PG 触发器
- ADR-0010: PWA 离线

## 参考

- [Turborepo 官方文档](https://turbo.build/repo/docs)
- [pnpm workspace 协议](https://pnpm.io/workspaces)
- DunhuangGold-Design-AI 主仓架构(已采用相同模式)
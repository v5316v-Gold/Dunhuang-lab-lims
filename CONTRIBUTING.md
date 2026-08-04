# 贡献指南(CONTRIBUTING)

> **版本**: v1.0.0
> **日期**: 2026-08-04
> **维护者**: 天枢(架构师)

欢迎加入敦煌金质检 LIMS 项目!本指南说明开发规范、PR 流程、代码风格。

---

## 1. 仓库结构

```
Dunhuang-lab-lims-main/
├── apps/              # 应用代码
│   ├── backend/       # NestJS 后端
│   └── frontend/      # React 前端
├── packages/          # 共享包
│   ├── shared-types/  # TS 类型 + Zod
│   ├── ui-kit/        # 业务组件
│   ├── compliance-core/  # 合规核心
│   └── config/        # 共享配置
├── infrastructure/    # Docker / K8s / Terraform
├── scripts/           # 工具脚本
├── tests/             # E2E / 集成 / 压测
└── docs/              # 文档
    ├── adr/           # 架构决策记录
    └── migration/     # 13 周执行手册
```

详见 [README.md §目录结构](./README.md#-目录结构)。

---

## 2. 开发环境

### 2.1 必备工具

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 20 LTS | 运行时 |
| pnpm | 9.x | 包管理 |
| Docker Desktop | 4.x+ | 容器化基础设施 |
| Git | 2.40+ | 版本控制 |
| Visual Studio Code | 最新 | 推荐 IDE |

### 2.2 推荐 VSCode 插件

- **ESLint**(`dbaeumer.vscode-eslint`)
- **Prettier**(`esbenp.prettier-vscode`)
- **Prisma**(`Prisma.prisma`)
- **NestJS Files**(`nestjs.vscode-nestjs-snippets`)
- **Tailwind CSS IntelliSense**(如果用 Tailwind)
- **Error Lens**(`usernamehw.errorlens`)
- **GitLens**(`eamodio.gitlens`)

### 2.3 初始化

```bash
# 1. 克隆仓库
git clone https://github.com/dunhuang-gold/dunhuang-lab-lims.git
cd dunhuang-lab-lims

# 2. 安装依赖
pnpm install

# 3. 启动基础设施(PG + Redis + MinIO + RabbitMQ + Prometheus + Grafana)
docker compose up -d

# 4. 数据库迁移
cd apps/backend
pnpm prisma migrate dev
pnpm prisma db seed
cd ../..

# 5. 启动开发服务器
pnpm dev
# 后端:http://localhost:3000
# 前端:http://localhost:5173
```

---

## 3. 代码规范

### 3.1 命名规范

| 类型 | 规范 | 示例 |
|---|---|---|
| **文件名(组件)** | PascalCase | `SampleReceive.tsx` |
| **文件名(工具)** | kebab-case | `audit-chain.ts` |
| **文件名(类型)** | kebab-case | `sample.dto.ts` |
| **变量名** | camelCase | `sampleNo`、`batchId` |
| **常量名** | UPPER_SNAKE_CASE | `MAX_REPLICATE_COUNT` |
| **类名** | PascalCase | `SampleService` |
| **接口名** | PascalCase,前缀 I(可选) | `ISampleRepository` |
| **类型名** | PascalCase,无前缀 | `SampleType` |
| **枚举名** | PascalCase + 值 UPPER_SNAKE | `SampleStatus.RECEIVED` |
| **数据库表名** | snake_case 复数 | `samples`、`test_results` |
| **数据库字段** | snake_case | `sample_no`、`batch_id` |
| **API 端点** | kebab-case | `/samples/:id/start-test` |

### 3.2 TypeScript 规范

- **严格模式**:`tsconfig.json` 必须 `strict: true`
- **禁止 `any`**:必要时用 `unknown` + 类型守卫
- **明确返回值**:函数必须明确返回类型
- **接口 vs 类型别名**:对象结构用 `interface`,联合类型用 `type`
- **可选属性**:用 `?`,不用 `| undefined`

```typescript
// ✅ 好的示例
interface CreateSampleDto {
  customerName: string;
  sampleType: SampleType;
  weightG: Decimal;
}

function calculatePurity(params: CreateSampleDto): { purityPct: Decimal } {
  // ...
}

// ❌ 不好的示例
function calculatePurity(params: any) {  // 禁止 any
  // ...
}
```

### 3.3 依赖方向(强约束)

**强约束**:由 ESLint `no-restricted-imports` 自动检查。

```
apps/*         → 可依赖 packages/*
packages/*     → 不可依赖 apps/*
modules/*      → 不可依赖其他 modules/*(通过 shared-types 共享)
packages/compliance-core  → 仅依赖第三方包,不可依赖任何业务包
infrastructure/*  → 不依赖任何业务模块
common/*         → 不依赖任何业务模块
```

### 3.4 包命名空间

所有内部包以 `@dunhuang/lims-` 为前缀:

```typescript
// apps/backend/src/modules/sample/sample.service.ts
import { SampleDto, SampleStatus } from '@dunhuang/lims-shared-types';
import { AuditChain } from '@dunhuang/lims-compliance-core';
```

---

## 4. Git 规范

### 4.1 分支命名

| 分支类型 | 命名格式 | 示例 |
|---|---|---|
| **主分支** | `main` | `main` |
| **功能分支** | `feat/<scope>-<desc>` | `feat/sample-receive-form` |
| **修复分支** | `fix/<scope>-<desc>` | `fix/audit-chain-hash` |
| **重构分支** | `refactor/<scope>-<desc>` | `refactor/fire-assay-state-machine` |
| **文档分支** | `docs/<scope>-<desc>` | `docs/adr-0007-mvp-slice` |
| **发布分支** | `release/vX.Y.Z` | `release/v1.0.0` |

### 4.2 提交信息(Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | 说明 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `refactor` | 重构(非新功能,非 bug 修复) |
| `docs` | 仅文档变更 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |
| `style` | 代码格式(无逻辑变更) |
| `perf` | 性能优化 |

**示例**:

```
feat(sample): 实现样品接收 API

- POST /samples 创建样品
- 自动生成 sampleNo (YYMMDD-NNNN)
- MinIO 上传样品照片
- 触发审计链

Closes #123
```

### 4.3 PR 流程

1. **创建功能分支**:`git checkout -b feat/sample-receive`
2. **开发 + 测试**:写代码 + 单测 + 集成测试
3. **本地 CI 通过**:`pnpm turbo run lint build test`
4. **提交**:`git commit -m "feat(sample): ..."`
5. **推送**:`git push origin feat/sample-receive`
6. **创建 PR**:GitHub 上创建,填写模板
7. **Code Review**:至少 1 个 reviewer 通过
8. **CI 通过**:GitHub Actions 全绿
9. **合并**:Squash merge 到 `main`
10. **删除分支**

### 4.4 PR 模板

```markdown
## 变更说明
<!-- 描述本次 PR 做了什么 -->

## 关联 Issue
<!-- Closes #XXX / Fixes #XXX -->

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 文档
- [ ] 测试

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] E2E 测试通过(如适用)

## 截图/视频(如适用)
<!-- UI 变更附截图 -->

## 检查清单
- [ ] 代码符合命名规范
- [ ] TypeScript 严格模式 0 错误
- [ ] ESLint 0 错误
- [ ] 文档已更新
- [ ] ADR 已更新(如有架构变更)
- [ ] OpenAPI 同步(如有 API 变更)
- [ ] 数据库迁移已测试
```

---

## 5. 测试规范

### 5.1 测试金字塔

```
        ╱  ╲
       ╱ E2E ╲          5%  - Playwright
      ╱────────╲
     ╱ 集成测试 ╲        25% - Supertest
    ╱────────────╲
   ╱   单元测试   ╲      70% - Jest
  ╱────────────────╲
```

### 5.2 覆盖率要求

| 层 | 覆盖率 |
|---|---|
| **业务逻辑层(L4)** | ≥ 85% |
| **应用服务层(L5)** | ≥ 70% |
| **数据访问层(L3)** | ≥ 60% |
| **控制器** | ≥ 50% |
| **总计** | ≥ 70% |

### 5.3 测试命名

```typescript
describe('SampleService.create', () => {
  it('should create a sample with auto-generated sampleNo', async () => {
    // given
    const dto: CreateSampleDto = {
      customerName: '上海黄金交易所',
      sampleType: SampleType.GOLD_INGOT,
      weightG: new Decimal('1.0234'),
    };

    // when
    const result = await service.create(dto);

    // then
    expect(result.sampleNo).toMatch(/^\d{6}-\d{4}$/);
    expect(result.status).toBe(SampleStatus.RECEIVED);
  });
});
```

---

## 6. ADR(架构决策记录)

### 6.1 何时写 ADR

**当决策满足以下任一条件时,必须写 ADR**:

- ✅ 引入新的技术/库/框架
- ✅ 改变架构(分层、模块边界、依赖方向)
- ✅ 选择一种方案而拒绝其他方案(有取舍)
- ✅ 影响性能/安全/合规/成本
- ✅ CNAS 审核员可能问"为什么选 X"

### 6.2 ADR 模板

参考 [docs/adr/README.md](./docs/adr/README.md) 和现有 ADR。

```markdown
# ADR-XXXX:<决策标题>

> **状态**: Proposed | Accepted | Deprecated | Superseded
> **日期**: YYYY-MM-DD
> **决策人**: <谁参与决策>
> **影响范围**: <哪些模块/层>

## 背景
<为什么需要做这个决策>

## 决策
<最终选择了什么>

## 理由
<为什么选这个方案>

## 替代方案
<考虑过但拒绝的方案 + 拒绝理由>

## 影响
### 正面影响
- ...

### 负面影响 + 缓解
- ...

## 验证标准
- [ ] ...

## 相关决策
- ADR-XXXX: ...

## 参考
- <外部链接>
```

### 6.3 ADR 流程

1. 复制 `docs/adr/README.md` 中的模板
2. 编号:下一个 `ADR-XXXX`
3. 写完提交 PR,标题:`docs(adr): 新增 ADR-XXXX <决策标题>`
4. Reviewer:架构师 + 实验室主任 + 质量负责人(至少 1 人)
5. 合并后状态变为 **Accepted**

---

## 7. 性能规范

### 7.1 性能预算

| 维度 | 目标 |
|---|---|
| **API 响应** | P95 < 500ms |
| **页面加载** | LCP < 2.5s |
| **数据库查询** | P95 < 100ms(简单),< 500ms(复杂) |
| **并发** | ≥ 1000 用户 |
| **数据量** | 100 万样品流畅查询 |

### 7.2 性能检查清单

每次 PR 涉及性能敏感代码:

- [ ] DB 查询有索引?
- [ ] 避免 N+1 查询?(用 Prisma `include` / `select`)
- [ ] 大数据量使用分页 + 索引?
- [ ] 频繁查询用 Redis 缓存?
- [ ] CPU 密集任务用 BullMQ 队列?
- [ ] 大文件上传用流式 + MinIO?
- [ ] 必要时使用 TimescaleDB?

---

## 8. 安全规范

### 8.1 必做项

- [ ] **永远不要** 提交密钥、密码、token 到 Git
- [ ] **永远不要** 使用 `any`(可能绕过类型检查引入漏洞)
- [ ] **永远不要** 直接拼接 SQL(用 Prisma 参数化)
- [ ] **永远不要** 在前端存储敏感数据(密码、密钥)
- [ ] **永远不要** 关闭 HTTPS / TLS
- [ ] **永远不要** 用 root 账户连接数据库

### 8.2 推荐项

- 所有 Controller 加 `@RequireRole()` 守卫
- 所有写操作加审计(自动通过 PG 触发器)
- 所有外部输入用 Zod 校验
- 所有 API 加 Rate Limiting
- 所有错误统一格式(不暴露堆栈)

---

## 9. CNAS 合规规范

### 9.1 必做项

- [ ] **审计日志**:每个写操作自动产生 audit_logs(SHA256 链)
- [ ] **不可篡改**:不要尝试 UPDATE/DELETE audit_logs(DB 触发器拒绝)
- [ ] **黄金纯度**:必须 `Decimal(10,6)`,**禁止 float**
- [ ] **批次管理**:火试金必须有 SampleBatch
- [ ] **多元素结果**:ICP 必须 ElementResult(一对多)
- [ ] **多级审核**:报告必须经过 4 级审核
- [ ] **电子签名**:PDF 必须含 CA 签名 + 时间戳
- [ ] **不可绕过**:任何"绕过审计""跳过审核"的功能都不允许

### 9.2 自检清单

详见 [docs/CNAS-SELF-CHECK.md](./docs/CNAS-SELF-CHECK.md)(Phase 4 输出)。

---

## 10. 文档规范

- 所有新功能必须有文档(README/API/ADR 之一)
- 所有重大决策必须有 ADR
- 所有数据库变更必须有 Prisma migration
- 所有 API 变更必须更新 OpenAPI(自动)
- 所有架构变更必须更新 [docs/01-ARCHITECTURE.md](./docs/01-ARCHITECTURE.md)

---

## 11. 联系方式

- **架构问题**:找天枢(架构师)
- **业务问题**:找菩提老祖(产品负责人)
- **CNAS 合规问题**:找质量负责人 + CNAS 顾问
- **紧急问题**:GitHub Issues + `@天枢`

---

**记住**:本系统是**合规级** LIMS,所有代码都可能影响 CNAS 审核结果。
**保守优于激进,显式优于隐式,可追溯优于方便**。

**最后更新**: 2026-08-04
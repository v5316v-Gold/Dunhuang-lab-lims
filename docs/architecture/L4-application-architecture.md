# L4-应用架构 架构规范 (Application Architecture)

> **版本**: v1.0
> **日期**: 2026-08-13
> **编制**: LIMS-Architect-01(架构规范工程师)
> **评审**: 后端 Lead、前端 Lead、QA
> **批准**: QA Manager
> **状态**: 草案
> **模板依据**: `docs/architecture/TEMPLATE.md` v1.0

---

## 1. 节点名称

**L4-应用架构**(Application Architecture / 模块与服务边界)

## 2. 建设目标

1. 固化**模块划分**(11 业务模块 + 8 横切模块)与服务边界
2. 定义**API 契约**(与 `docs/03-API.md` 对齐)
3. 定义**状态机实现规格**(Sample/Batch/Test/Report)
4. 定义**业务规则实现策略**(服务层校验 + 状态机守卫)
5. 定义**RBAC 落地**(守卫链:Throttler → Jwt → Rbac)
6. 为 L5 技术实现、L7 测试用例提供规格

## 3. 业务范围

- **In-scope**:
  - 后端模块结构(NestJS)
  - API 端点契约(认证/样品/批次/检测/QC/审计等)
  - 状态机规格与守卫
  - 全局管道(ValidationPipe/异常过滤/拦截器)
  - RBAC 守卫链
- **Out-of-scope**:
  - 技术框架细节 → 归 L5
  - 部署 → 归 L6

## 4. 背景

系统已实现:NestJS 10 后端,11 业务模块 + 8 横切模块,25 个集成测试 PASS(E2E 垂直切片验证 auth→sample→batch→fire-assay→qc→audit)。本层将现状**规范化为应用架构契约**,确保后续 Phase 1-5 扩展不破坏边界。

## 5. 参与角色

| 角色 | 职责 | 编写/评审/批准 |
|---|---|---|
| 后端 Lead | 模块/契约确认 | 评审 |
| 前端 Lead | API 消费确认 | 评审 |
| QA | 可测性评审 | 评审 |
| LIMS-Architect-01(架构师) | 本层编写 | 编写 |

## 6. 输入 - 输出

| 方向 | 来源/去向 | 内容 |
|---|---|---|
| 输入 | L1 流程 + L3 数据模型 + `03-API.md` + 现有 controller/service | 流程、模型、契约、现状 |
| 输出 | L5 技术实现、L7 测试用例 | 模块规格、API 契约、状态机 |

## 7. 前置后置条件

- **前置**: L3 GATE PASS(数据模型确认)
- **后置**: API 契约评审通过、模块依赖无环、状态机规格完整

## 8. 业务流程

服务调用链(文字描述):

```
HTTP 请求 → ThrottlerGuard(限流)→ JwtAuthGuard(认证)
  → RbacGuard(角色)→ Controller(DTO 校验)
  → Service(业务规则 + 状态机)
  → PrismaService(软删除 extension + 审计上下文)
  → PostgreSQL(审计 trigger 落链)
```

响应路径:Service → Controller → 全局拦截器(BigInt 序列化/日志)→ HTTP 响应。

## 9. 状态机

### 9.1 Sample(9 态)

| 状态 | 进入事件 | 守卫 |
|---|---|---|
| RECEIVED | 样品接收 | 委托确认 |
| BATCHED | 加入批次 | 批次存在 |
| IN_TEST | 检测开始 | 批次 COMPLETED 前 |
| TESTED | 检测完成 | QC 通过 |
| REPORT_DRAFT | 报告起草 | TESTED |
| REPORT_REVIEW | 提交审核 | 起草完成 |
| REPORT_APPROVED | 批准 | 三级审核 |
| ARCHIVED | 归档 | 报告交付 + 留样 |
| REJECTED | 拒收/失败 | 记录原因 |

### 9.2 Batch(11 态)

PENDING → MIXING → FUSING → CUPELLING → PARTING → ANNEALING → WEIGHING → CALCULATING → COMPLETED;任一步 REJECTED。守卫:平行样 ≥3、QC 样回收率 99.5-100.5%。

### 9.3 Test(5 态)

PENDING → IN_PROGRESS → COMPLETED / QC_FAILED / REJECTED。守卫:方法/设备有效、结果完整。

### 9.4 Report(多态)

DRAFT → REVIEW → APPROVED → SIGNED → DELIVERED / REJECTED。守卫:QC 通过、三级审核、电子签名。

## 10. 数据模型

### 10.1 模块结构(现有)

| 类型 | 模块 | 路径 |
|---|---|---|
| 横切 | auth / audit / logger / health / prisma / redis / minio / queue | src/common/* + src/infrastructure/* |
| 业务 | identity / personnel / equipment / sample / batch / test / qc / report / reagent / ehs / analytics | src/modules/* |

### 10.2 依赖规则

- 业务模块 → 基础设施模块(Prisma/Redis)✅
- 业务模块之间:Sample ↔ Batch ↔ Test ↔ Report 单向依赖(经服务层)
- 禁止:业务模块反向依赖横切业务细节

## 11. 字段(API DTO 核心)

| DTO | 关键字段 | 校验 |
|---|---|---|
| LoginDto | username/password/totpCode? | IsString/IsNotEmpty/MaxLength(50) |
| CreateSampleDto | customerName/sampleType/weightG | IsNotEmpty/IsEnum/IsNumberString |
| CreateBatchDto | method/replicateCount? | IsEnum/IsInt Min(1) Max(10) |
| RecordWeightsDto | prillWeightG/leadButtonWeightG?/qcRecoveryPct? | IsNumberString |
| QcMeasurement body | qcType/element/measured | 枚举/必填 |
| AuditLogFilterDto | page/pageSize/userId?/recordId? | IsInt/Min/Max/IsUUID |

## 12. 业务规则

| 编号 | 规则 | 实现 | 可测试性 |
|---|---|---|---|
| BR-APP-01 | 状态转换必须经状态机 | state-machine.ts | 单元测试 |
| BR-APP-02 | 所有写操作走审计上下文 | audit-context.interceptor | ✅ |
| BR-APP-03 | DTO 校验 whitelist+forbidNonWhitelisted | ValidationPipe | ✅ 400 测试 |
| BR-APP-04 | BigInt 序列化为字符串 | bigint-replacer | ✅ |
| BR-APP-05 | 幂等(重试安全) | 业务键唯一 | Phase 2 补 |
| BR-APP-06 | 软删除默认过滤 | Prisma extension | ✅ |
| BR-APP-07 | 分页参数上限 | DTO Max(200) | ✅ |

## 13. 异常处理

| 异常场景 | 检测方式 | 响应策略 |
|---|---|---|
| DTO 校验失败 | ValidationPipe | 400 + 错误字段 |
| 认证失败 | JwtAuthGuard | 401 |
| 角色不足 | RbacGuard | 403 |
| 业务错误 | 业务异常 | 409/422 + 错误码 |
| 未找到 | NotFoundException | 404 |
| Prisma 错误 | 异常过滤器 | 500 映射 |
| 限流 | ThrottlerGuard | 429 |

## 14. RBAC 要求

守卫链(执行顺序):ThrottlerGuard → JwtAuthGuard → RbacGuard

| 端点域 | 允许角色 |
|---|---|
| /auth/login | 公开 |
| /samples POST | ANALYST 及以上 |
| /batches POST | SENIOR_ANALYST 及以上 |
| /tests/fire-assay POST | ANALYST 及以上 |
| /tests/fire-assay/:id/complete | SENIOR_ANALYST 及以上 |
| /qc/measurements POST | ANALYST 及以上 |
| /audit-logs | ADMIN/LAB_DIRECTOR/QUALITY_MANAGER |
| /reports 签发 | LAB_DIRECTOR |

## 15. 审计要求

| 审计事件 | 触发条件 | 记录 |
|---|---|---|
| 业务写操作 | 27 表 trigger | 自动 |
| 登录 | auth 事件 | user_sessions |
| 越权尝试 | RBAC 拒绝 | 安全日志(待补) |

## 16. 合规要求 (CNAS/CMA/ISO 17025)

| 标准条款 | 要求摘要 | 本层实现 |
|---|---|---|
| CNAS-CL01:2018 §7.5(技术记录) | 记录完整 | 审计上下文 + trigger |
| CNAS-CL01:2018 §7.11(数据控制) | 数据控制 | 软删除 + 审计 |
| CNAS-CL01:2018 §6.1(人员) | 授权 | RBAC 守卫链 |

## 17. API 要求(核心契约,完整见 03-API.md)

| 方法 | 路径 | 鉴权 | 状态码 |
|---|---|---|---|
| POST | /auth/login | 公开 | 200 |
| POST | /auth/refresh | 公开 | 200 |
| GET | /auth/me | Bearer | 200 |
| POST | /samples | Bearer | 200/201 |
| GET | /samples | Bearer | 200 |
| PATCH | /samples/:id | Bearer | 200 |
| POST | /batches | Bearer | 200/201 |
| POST | /batches/:id/samples | Bearer | 200/201 |
| POST | /batches/:id/transition | Bearer | 200 |
| POST | /tests/fire-assay | Bearer | 200/201 |
| POST | /tests/fire-assay/:id/weights | Bearer | 200 |
| POST | /tests/fire-assay/:id/complete | Bearer | 200 |
| POST | /qc/measurements | Bearer | 200/201 |
| GET | /audit-logs | Bearer(ADMIN/QM) | 200 |
| GET | /audit-logs/verify | Bearer(ADMIN/QM) | 200 |

版本前缀:`/api/v1/*`(main.ts enableVersioning)。

## 18. 验收标准

- [ ] 模块依赖无环(架构测试或评审确认)
- [ ] API 契约 ≥ 20 端点文档化(03-API.md 对齐)
- [ ] 4 套状态机规格完整(Sample/Batch/Test/Report)
- [ ] 守卫链顺序确认(Throttler→Jwt→Rbac)
- [ ] RBAC 矩阵覆盖 ≥ 9 角色 × 15 端点域
- [ ] 25 集成测试作为回归基线
- [ ] Gate 检查表 G1-G8 全 PASS

## 19. 依赖关系

- **上游依赖**: L1(流程)、L3(数据模型)
- **下游供应**: L5(技术实现)、L7(测试用例)、L6(部署)

## 20. 附录

### 20.1 参考资料

- `docs/03-API.md`
- `apps/backend/src/app.module.ts`(模块注册)
- `apps/backend/src/main.ts`(全局管道/守卫/前缀)
- `apps/backend/test/integration/vertical-slice.spec.ts`(E2E 基线)

### 20.2 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布 | LIMS-Architect-01 |

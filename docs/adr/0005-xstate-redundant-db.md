# ADR-0005:状态机 = XState 5 + DB 字段冗余

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 后端工程师
> **影响范围**: 业务逻辑层(L4)、数据库 schema、报告流转、批次流转

## 背景

敦煌金质检 LIMS 有多个关键业务流涉及**状态流转**:

1. **样品批次**(火试金 / ICP):PENDING → MIXING → FUSING → ... → COMPLETED
2. **检测任务**:PENDING → IN_PROGRESS → COMPLETED / QC_FAILED / REJECTED
3. **报告**:DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
4. **隐患排查**:REPORTED → INVESTIGATING → RESOLVED / ESCALATED

这些状态流转必须满足:
- **明确的状态边界**:不允许"跳跃"(如 DRAFT → APPROVED 跳过审核)
- **角色权限绑定**:每个状态的进入/退出有特定角色
- **可恢复**:系统崩溃后能从 DB 恢复状态
- **可视化**:CNAS 审核员可看到流转图

## 决策

**采用 XState 5(应用层)+ 数据库字段冗余(DB 状态真值)**。

### 1. 应用层 XState(表达力)

```typescript
// apps/backend/src/modules/report/report.machine.ts
import { createMachine } from 'xstate';

export const reportMachine = createMachine({
  id: 'report',
  initial: 'DRAFT',
  states: {
    DRAFT: {
      on: { SUBMIT: 'INTERNAL_REVIEW' },
      meta: { allowedRoles: ['ANALYST', 'SENIOR_ANALYST'] },
    },
    INTERNAL_REVIEW: {
      on: {
        REVIEW_PASS: 'FINAL_REVIEW',
        REVIEW_REJECT: 'DRAFT',
      },
      meta: { allowedRoles: ['SENIOR_ANALYST'] },
    },
    FINAL_REVIEW: {
      on: {
        APPROVE: 'APPROVED',
        REVIEW_REJECT: 'DRAFT',
      },
      meta: { allowedRoles: ['QUALITY_MANAGER', 'LAB_DIRECTOR'] },
    },
    APPROVED: {
      on: { ISSUE: 'ISSUED' },
      meta: { allowedRoles: ['LAB_DIRECTOR'] },
    },
    ISSUED: { type: 'final' },
    REJECTED: { type: 'final' },
  },
});
```

### 2. DB 字段冗余(崩溃恢复 + 查询性能)

```prisma
enum ReportStatus {
  DRAFT
  INTERNAL_REVIEW
  FINAL_REVIEW
  APPROVED
  ISSUED
  REJECTED
  SUPERSEDED
}

model Report {
  id       String       @id @default(uuid())
  status   ReportStatus @default(DRAFT)  // ← DB 字段冗余,真值
  // ... 其他字段
}

model ReportStage {
  id        String       @id @default(uuid())
  reportId  String
  stage     ReportStatus  // 历史阶段
  userId    String
  comments  String?
  createdAt DateTime     @default(now())
}
```

### 3. 双写策略

```typescript
// apps/backend/src/modules/report/report.service.ts
async function transition(reportId: string, event: ReportEvent, userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. 取当前报告
    const report = await tx.report.findUnique({ where: { id: reportId } });

    // 2. 用 XState 计算新状态
    const nextState = reportMachine.transition(report.status, event);

    // 3. 校验角色权限(nextState.meta.allowedRoles 包含 user.role)
    await assertRole(userId, nextState.meta.allowedRoles);

    // 4. 写 DB
    await tx.report.update({
      where: { id: reportId },
      data: { status: nextState.value as ReportStatus },
    });

    // 5. 写流转历史
    await tx.reportStage.create({
      data: { reportId, stage: nextState.value, userId },
    });

    // 6. 触发审计(自动通过 PG 触发器)
  });
}
```

## 理由

### 为什么用 XState

| 优势 | 详情 |
|---|---|
| **可视化** | 状态图可导出给 CNAS 审核员看 |
| **形式化** | 状态转换可数学验证(无遗漏状态) |
| **元数据** | `meta.allowedRoles` 集中表达权限 |
| **测试友好** | XState 提供独立测试 API |
| **生态** | 与 React/Vue 集成良好(可视化 UI) |

### 为什么 DB 字段冗余(而非仅 XState)

| 维度 | XState 单独 | XState + DB 冗余 |
|---|---|---|
| **崩溃恢复** | ❌ 内存丢失,DB 状态未更新 | ✅ DB 是真值 |
| **跨服务查询** | ❌ 需调用 service 才能转 | ✅ 直接 SQL 过滤 |
| **历史追溯** | ⚠️ 需单独写历史表 | ✅ ReportStage 自动 |
| **性能** | ⚠️ 每次需解释 | ✅ 直接查 status |
| **审计链兼容** | ⚠️ XState 在应用层,审计需手工 | ✅ DB 触发器自动审计 |

### 为什么 DB 冗余 + XState 双写是合规的

1. **DB 字段是权威**:任何状态以 DB 为准,XState 仅用于计算
2. **XState 是辅助**:仅用于"如果当前是 X,事件 Y → 新状态 Z"
3. **崩溃恢复**:重启后 XState 从 DB 加载当前 status,继续工作
4. **审计链自动**:DB update → PG 触发器自动写 audit_logs

## 替代方案

### 备选 1:仅用 DB 状态字段(无 XState)
- **优势**: 简单
- **拒绝理由**: 状态转换逻辑散落在 Service 代码,易出错;可视化差

### 备选 2:仅用 XState(无 DB 字段)
- **优势**: 应用层完整
- **拒绝理由**: 崩溃丢失状态;查询需先解释;审计链断裂

### 备选 3:用 NestJS 自带状态机库(nestjs-statemachine)
- **优势**: NestJS 生态
- **拒绝理由**: 表达力不如 XState;无 meta.allowedRoles;无可视化

### 备选 4:用 Temporal / Camunda(外部工作流引擎)
- **优势**: 持久化;可视化强大
- **拒绝理由**: 增加基础设施;CNAS 审核员不熟;过度设计

## 影响

### 正面影响
- ✅ **崩溃可恢复**:DB 是状态真值,XState 重新解释
- ✅ **可视化**:CNAS 审核员可看 XState 图 + ReportStage 历史
- ✅ **角色权限集中**:`meta.allowedRoles` 不分散在代码各处
- ✅ **审计链自动**:DB update → PG 触发器 → SHA256 链

### 负面影响 + 缓解
- ⚠️ **双写不一致风险**:XState 转 X,DB 写 Y;**缓解**:`$transaction` + 单元测试覆盖所有 transition
- ⚠️ **新增状态需双改**:XState machine + Prisma enum;**缓解**:CI 检查两者同步
- ⚠️ **历史表膨胀**:ReportStage 与审计类似;**缓解**:TimescaleDB 冷热分层

### 关键约束

1. **XState 状态值必须与 Prisma enum 1:1 对应**:CI 检查
2. **每次 transition 必须写 ReportStage**:用于历史追溯
3. **每次 transition 必须经 RBAC 守卫**:`meta.allowedRoles` 校验
4. **不允许跳跃**:DRAFT → APPROVED 会被 XState 拒绝(未定义 transition)
5. **XState 是单例**:每个 Module 一个 machine 实例,通过 Service 注入

## 验证标准

- [ ] 4 个核心状态机实现(sample-batch / test / report / hazard)
- [ ] Prisma enum 与 XState 状态 1:1 对应
- [ ] 所有 transition 经 `$transaction`
- [ ] 角色权限校验集中在 `meta.allowedRoles`
- [ ] 单元测试:`*.machine.spec.ts` 覆盖所有合法/非法 transition
- [ ] 集成测试:状态机持久化(模拟崩溃重启,DB 状态 = XState 解释状态)
- [ ] 历史追溯:`GET /reports/:id/stages` 返回完整流转
- [ ] CNAS 现场:可导出 XState 图作为审核证据

## 相关决策

- ADR-0003: 审计链 SHA256
- ADR-0011: 贵金属检测业务约束

## 参考

- [XState 官方文档](https://xstate.js.org/docs/)
- [状态机模式(经典)](https://refactoring.guru/design-patterns/state)
- [有限状态机在合规系统中的应用](https://martinfowler.com/eaaDev/StatefulWidget.html)
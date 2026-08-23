// =====================================================
// 领域事件定义 — 跨模块副作用解耦(架构优化 A1)
// 约定: 事件名用 实体.行为 命名(test.completed)
//       监听方只依赖事件载荷,不依赖发布方模块
// =====================================================

export const DomainEvents = {
  /** 检测完成(火试金 recordWeights/complete、ICP complete 发布) */
  TEST_COMPLETED: 'test.completed',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface TestCompletedEvent {
  testId: string;
  sampleId: string;
  method: 'FIRE_ASSAY' | 'ICP_OES' | 'ICP_MS';
  /** QC 是否通过(通过 → 样品 TESTED;失败 → 保持 IN_TEST 且不自动建报告) */
  qcPassed: boolean;
  operatorId: string | null;
}

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  payload: T;
  occurredAt: Date;
}

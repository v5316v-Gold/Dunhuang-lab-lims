// =====================================================
// 领域事件 — eventId 自动生成(用于幂等)
// W1 架构改进
// =====================================================

export const DomainEvents = {
  /** 检测完成(火试金 recordWeights/complete、ICP complete 发布) */
  TEST_COMPLETED: 'test.completed',
  // 后续扩展(W2+):
  // SAMPLE_RECEIVED: 'sample.received',
  // QC_FAILED: 'qc.failed',
  // SOD_VIOLATION_BLOCKED: 'sod.violation.blocked',
  // REPORT_ISSUED: 'report.issued',
  // etc.
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface TestCompletedEvent {
  testId: string;
  sampleId: string;
  method: 'FIRE_ASSAY' | 'ICP_OES' | 'ICP_MS';
  qcPassed: boolean;
  operatorId: string | null;
}

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  payload: T;
  occurredAt: Date;
  /** W1: 事件唯一标识,监听器用此判重(ProcessedEvent 表) */
  eventId: string;
}

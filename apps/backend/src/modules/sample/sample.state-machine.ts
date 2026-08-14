// =====================================================
// 样品状态机 — Phase 2 Task 2.2 (CODE-EXECUTION-PLAN §3.2.2)
// 架构映射: L0.5 Sample 聚合状态 / L1 业务流转 / L4 状态机规格
//
// 状态(9 态):
//   RECEIVED → BATCHED → IN_TEST → TESTED → REPORT_DRAFT
//   → REPORT_REVIEW → REPORT_APPROVED → ARCHIVED
//   ↓ 任意状态可 REJECTED
//
// 纯函数,可单测(不依赖 DB/框架)
// =====================================================

import { SampleStatus } from '@prisma/client';

export type SampleEvent =
  | 'TO_BATCH'        // 加入批次
  | 'START_TEST'      // 开始检测
  | 'COMPLETE_TEST'   // 检测完成(QC 通过)
  | 'TO_REPORT_DRAFT' // 生成报告草稿
  | 'SUBMIT_REVIEW'   // 提交审核
  | 'APPROVE'         // 审核通过
  | 'ARCHIVE'         // 归档
  | 'REJECT';         // 拒收/失败(任意状态)

/** 状态转换表: { 状态: { 事件: 目标状态 } } */
const TRANSITIONS: Record<SampleStatus, Partial<Record<SampleEvent, SampleStatus>>> = {
  [SampleStatus.RECEIVED]: {
    TO_BATCH: SampleStatus.BATCHED,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.BATCHED]: {
    START_TEST: SampleStatus.IN_TEST,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.IN_TEST]: {
    COMPLETE_TEST: SampleStatus.TESTED,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.TESTED]: {
    TO_REPORT_DRAFT: SampleStatus.REPORT_DRAFT,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.REPORT_DRAFT]: {
    SUBMIT_REVIEW: SampleStatus.REPORT_REVIEW,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.REPORT_REVIEW]: {
    APPROVE: SampleStatus.REPORT_APPROVED,
    REJECT: SampleStatus.REJECTED,
  },
  [SampleStatus.REPORT_APPROVED]: {
    ARCHIVE: SampleStatus.ARCHIVED,
  },
  [SampleStatus.ARCHIVED]: {},
  [SampleStatus.REJECTED]: {},
};

/**
 * 计算状态转换结果(纯函数)
 * @returns 合法则返回目标状态;非法返回 null
 */
export function transitionSample(
  current: SampleStatus,
  event: SampleEvent,
): SampleStatus | null {
  return TRANSITIONS[current]?.[event] ?? null;
}

/** 校验转换合法性 */
export function canTransition(current: SampleStatus, event: SampleEvent): boolean {
  return transitionSample(current, event) !== null;
}

/** 所有合法事件(供前端下拉/按钮渲染) */
export function allowedEvents(current: SampleStatus): SampleEvent[] {
  return (Object.keys(TRANSITIONS[current] ?? {}) as SampleEvent[]);
}

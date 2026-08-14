// =====================================================
// 报告状态机 - XState
// 详见 ADR-0005
//
// 流程:
//   DRAFT → INTERNAL_REVIEW(校核) → FINAL_REVIEW(审核) → APPROVED(批准) → ISSUED(签发)
//                          ↓                  ↓
//                       DRAFT(驳回)         DRAFT(驳回)
// =====================================================

import { ReportStatus, UserRole } from '@prisma/client';
import { createMachine } from 'xstate';

export const reportMachine = createMachine({
  id: 'report',
  initial: ReportStatus.DRAFT,
  states: {
    [ReportStatus.DRAFT]: {
      on: {
        SUBMIT: ReportStatus.INTERNAL_REVIEW,
      },
      meta: { allowedRoles: [UserRole.ANALYST, UserRole.SENIOR_ANALYST] },
    },
    [ReportStatus.INTERNAL_REVIEW]: {
      on: {
        REVIEW_PASS: ReportStatus.FINAL_REVIEW,
        REVIEW_REJECT: ReportStatus.DRAFT,
      },
      meta: { allowedRoles: [UserRole.SENIOR_ANALYST, UserRole.QUALITY_MANAGER] },
    },
    [ReportStatus.FINAL_REVIEW]: {
      on: {
        APPROVE: ReportStatus.APPROVED,
        REVIEW_REJECT: ReportStatus.DRAFT,
      },
      meta: { allowedRoles: [UserRole.QUALITY_MANAGER, UserRole.LAB_DIRECTOR] },
    },
    [ReportStatus.APPROVED]: {
      on: {
        ISSUE: ReportStatus.ISSUED,
      },
      meta: { allowedRoles: [UserRole.LAB_DIRECTOR] },
    },
    [ReportStatus.ISSUED]: { type: 'final' },
    [ReportStatus.REJECTED]: { type: 'final' },
  },
});

export type ReportEvent = 'SUBMIT' | 'REVIEW_PASS' | 'REVIEW_REJECT' | 'APPROVE' | 'ISSUE';


// =====================================================
// Phase 2 Task 2.5: 纯函数转换表(与上方 XState 定义一致)
// 原因: XState 5.32 的 createActor/resolveState/transition API
//       在运行时存在兼容问题(见 report-flow.spec 调试记录),
//       此处提供确定性的纯函数入口,供 service 层调用。
// 注意: 修改上方 XState 定义时必须同步本表(单一真源为 XState 注释)
// =====================================================

/** 报告状态转换表: { 当前状态: { 事件: 目标状态 } } */
const REPORT_TRANSITIONS: Record<string, Partial<Record<ReportEvent, ReportStatus>>> = {
  [ReportStatus.DRAFT]: {
    SUBMIT: ReportStatus.INTERNAL_REVIEW,
  },
  [ReportStatus.INTERNAL_REVIEW]: {
    REVIEW_PASS: ReportStatus.FINAL_REVIEW,
    REVIEW_REJECT: ReportStatus.DRAFT,
  },
  [ReportStatus.FINAL_REVIEW]: {
    APPROVE: ReportStatus.APPROVED,
    REVIEW_REJECT: ReportStatus.DRAFT,
  },
  [ReportStatus.APPROVED]: {
    ISSUE: ReportStatus.ISSUED,
  },
  [ReportStatus.ISSUED]: {},
  [ReportStatus.REJECTED]: {},
};

/**
 * 计算报告状态转换(纯函数)
 * @returns 合法返回目标状态;非法返回 null
 */
export function transitionReport(
  current: ReportStatus,
  event: ReportEvent,
): ReportStatus | null {
  return REPORT_TRANSITIONS[current]?.[event] ?? null;
}

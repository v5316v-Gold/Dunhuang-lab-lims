// =====================================================
// 报告状态机 - XState
// 详见 ADR-0005
//
// 流程:
//   DRAFT → INTERNAL_REVIEW(校核) → FINAL_REVIEW(审核) → APPROVED(批准) → ISSUED(签发)
//                          ↓                  ↓
//                       DRAFT(驳回)         DRAFT(驳回)
// =====================================================

import { createMachine } from 'xstate';
import { ReportStatus, UserRole } from '@prisma/client';

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
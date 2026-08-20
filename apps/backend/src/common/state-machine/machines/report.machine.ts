// =====================================================
// 报告状态机 — CNAS §7.8 结果报告
// 详见 ADR-0012
// =====================================================

import { createMachine } from 'xstate';

export type ReportState =
  | 'DRAFT'
  | 'SUBMITTED'         // 已提交
  | 'REVIEWED'          // 已复核
  | 'APPROVED'          // 已批准
  | 'ISSUED'            // 已签发(含电子签名)
  | 'AMENDED'           // 已修改
  | 'WITHDRAWN'         // 已撤销
  | 'REISSUED';         // 重新签发

export type ReportEvent =
  | { type: 'SUBMIT' }
  | { type: 'REVIEW' }
  | { type: 'APPROVE' }
  | { type: 'ISSUE' }
  | { type: 'AMEND'; reason: string }
  | { type: 'WITHDRAW'; reason: string }
  | { type: 'REISSUE' };

export const reportMachine = createMachine({
  id: 'report',
  initial: 'DRAFT',
  states: {
    DRAFT: {
      on: {
        SUBMIT: 'SUBMITTED',
        WITHDRAW: 'WITHDRAWN',
      },
    },
    SUBMITTED: {
      on: {
        REVIEW: 'REVIEWED',
        WITHDRAW: 'WITHDRAWN',
      },
    },
    REVIEWED: {
      on: {
        APPROVE: 'APPROVED',
        WITHDRAW: 'WITHDRAWN',
      },
    },
    APPROVED: {
      on: {
        ISSUE: 'ISSUED',
        WITHDRAW: 'WITHDRAWN',
      },
    },
    ISSUED: {
      on: {
        AMEND: 'AMENDED',
        WITHDRAW: 'WITHDRAWN',
        REISSUE: 'REISSUED',
      },
    },
    AMENDED: { type: 'final' },
    WITHDRAWN: { type: 'final' },
    REISSUED: { type: 'final' },
  },
});

export const reportStateTransitions: Record<ReportState, ReportState[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['REVIEWED', 'WITHDRAWN'],
  REVIEWED: ['APPROVED', 'WITHDRAWN'],
  APPROVED: ['ISSUED', 'WITHDRAWN'],
  ISSUED: ['AMENDED', 'WITHDRAWN', 'REISSUED'],
  AMENDED: [],
  WITHDRAWN: [],
  REISSUED: [],
};

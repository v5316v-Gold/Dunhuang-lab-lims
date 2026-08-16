// =====================================================
// 样品状态机 — CNAS §7.4 监管链 + 贵金属检测 SOP
// 详见 docs/01-ARCHITECTURE.md §业务状态机
// =====================================================

import { createMachine } from 'xstate';

export type SampleState =
  | 'RECEIVED'         // 已接收
  | 'REGISTERED'       // 已登记(赋予样品号)
  | 'IN_BATCH'         // 在批次中
  | 'TESTING'          // 检测中
  | 'TESTED'           // 检测完成
  | 'REPORTED'         // 报告已发
  | 'RETURNED'         // 已归还客户
  | 'DISPOSED'         // 已处置
  | 'RETAINED';        // 留样

export type SampleEvent =
  | { type: 'REGISTER' }
  | { type: 'ADD_TO_BATCH'; batchId: string }
  | { type: 'START_TEST' }
  | { type: 'FINISH_TEST' }
  | { type: 'ISSUE_REPORT' }
  | { type: 'RETURN_TO_CUSTOMER' }
  | { type: 'DISPOSE' }
  | { type: 'TRANSFER_TO_RETENTION' };

export const sampleMachine = createMachine({
  id: 'sample',
  initial: 'RECEIVED',
  states: {
    RECEIVED: {
      on: {
        REGISTER: 'REGISTERED',
        DISPOSE: 'DISPOSED',
      },
    },
    REGISTERED: {
      on: {
        ADD_TO_BATCH: 'IN_BATCH',
        TRANSFER_TO_RETENTION: 'RETAINED',
        DISPOSE: 'DISPOSED',
      },
    },
    IN_BATCH: {
      on: {
        START_TEST: 'TESTING',
        TRANSFER_TO_RETENTION: 'RETAINED',
        DISPOSE: 'DISPOSED',
      },
    },
    TESTING: {
      on: {
        FINISH_TEST: 'TESTED',
      },
    },
    TESTED: {
      on: {
        ISSUE_REPORT: 'REPORTED',
        TRANSFER_TO_RETENTION: 'RETAINED',
        DISPOSE: 'DISPOSED',
      },
    },
    REPORTED: {
      on: {
        RETURN_TO_CUSTOMER: 'RETURNED',
        TRANSFER_TO_RETENTION: 'RETAINED',
        DISPOSE: 'DISPOSED',
      },
    },
    RETURNED: { type: 'final' },
    DISPOSED: { type: 'final' },
    RETAINED: {
      on: {
        DISPOSE: 'DISPOSED',
        RETURN_TO_CUSTOMER: 'RETURNED',
      },
    },
  },
});

export const sampleStateTransitions: Record<SampleState, SampleState[]> = {
  RECEIVED: ['REGISTERED', 'DISPOSED'],
  REGISTERED: ['IN_BATCH', 'RETAINED', 'DISPOSED'],
  IN_BATCH: ['TESTING', 'RETAINED', 'DISPOSED'],
  TESTING: ['TESTED'],
  TESTED: ['REPORTED', 'RETAINED', 'DISPOSED'],
  REPORTED: ['RETURNED', 'RETAINED', 'DISPOSED'],
  RETURNED: [],
  DISPOSED: [],
  RETAINED: ['DISPOSED', 'RETURNED'],
};

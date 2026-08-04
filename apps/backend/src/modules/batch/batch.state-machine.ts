// =====================================================
// 批次状态机 - XState
// 详见 ADR-0005(状态机 = XState + DB 字段冗余)
// =====================================================

import { createMachine } from 'xstate';
import { BatchStatus } from '@prisma/client';

/**
 * 火试金法批次状态机
 *
 * PENDING → MIXING → FUSING → CUPELLING → PARTING → ANNEALING → WEIGHING → CALCULATING → COMPLETED
 *                                                                                    ↓
 *                                                                                 REJECTED (任意阶段失败)
 */
export const fireAssayBatchMachine = createMachine({
  id: 'fireAssayBatch',
  initial: BatchStatus.PENDING,
  states: {
    [BatchStatus.PENDING]: {
      on: { START: BatchStatus.MIXING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.MIXING]: {
      on: { ADVANCE: BatchStatus.FUSING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.FUSING]: {
      on: { ADVANCE: BatchStatus.CUPELLING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.CUPELLING]: {
      on: { ADVANCE: BatchStatus.PARTING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.PARTING]: {
      on: { ADVANCE: BatchStatus.ANNEALING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.ANNEALING]: {
      on: { ADVANCE: BatchStatus.WEIGHING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.WEIGHING]: {
      on: { ADVANCE: BatchStatus.CALCULATING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.CALCULATING]: {
      on: { COMPLETE: BatchStatus.COMPLETED, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.COMPLETED]: { type: 'final' },
    [BatchStatus.REJECTED]: { type: 'final' },
  },
});

/**
 * ICP 批次状态机(简化版)
 *
 * PENDING → MIXING → FUSING(消解) → CALCULATING → COMPLETED
 */
export const icpBatchMachine = createMachine({
  id: 'icpBatch',
  initial: BatchStatus.PENDING,
  states: {
    [BatchStatus.PENDING]: {
      on: { START: BatchStatus.MIXING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.MIXING]: {
      on: { ADVANCE: BatchStatus.FUSING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.FUSING]: {
      on: { ADVANCE: BatchStatus.CALCULATING, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.CALCULATING]: {
      on: { COMPLETE: BatchStatus.COMPLETED, REJECT: BatchStatus.REJECTED },
    },
    [BatchStatus.COMPLETED]: { type: 'final' },
    [BatchStatus.REJECTED]: { type: 'final' },
  },
});

/**
 * 选择状态机
 */
export function getBatchMachine(method: 'FIRE_ASSAY' | 'ICP_OES' | 'ICP_MS') {
  if (method === 'FIRE_ASSAY') return fireAssayBatchMachine;
  return icpBatchMachine;
}

/**
 * 状态机事件类型
 */
export type BatchEvent = 'START' | 'ADVANCE' | 'COMPLETE' | 'REJECT';
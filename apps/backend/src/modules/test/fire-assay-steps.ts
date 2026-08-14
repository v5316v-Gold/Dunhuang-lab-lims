// =====================================================
// 火试金多步骤执行 — Phase 2 填充 (F1)
// 架构映射: ADR-0011 §4 火试金工艺(6 步)
//
// 步骤:
//   WEIGHING(称样)→ MELTING(熔融)→ CUPELLATION(灰吹)
//   → PARTING(分金)→ ANNEALING(退火)→ FINAL_WEIGHING(称重)
//
// 实现: 从 fire_assay_details 字段推导步骤完成状态(无新表)
//   sampleWeightG → 称样完成
//   furnaceTempC  → 熔融完成
//   cupellationMin→ 灰吹完成
//   partingMin    → 分金完成
//   annealingMin  → 退火完成
//   prillWeightG  → 称重完成(最终)
// 守卫: recordWeights(称重)前必须已完成全部前序步骤(工艺完整性)
// =====================================================

import { FireAssayDetail } from '@prisma/client';

export type FireAssayStep =
  | 'WEIGHING'        // 称样
  | 'MELTING'         // 熔融
  | 'CUPELLATION'     // 灰吹
  | 'PARTING'         // 分金
  | 'ANNEALING'       // 退火
  | 'FINAL_WEIGHING'; // 称重

export const FIRE_ASSAY_STEP_ORDER: FireAssayStep[] = [
  'WEIGHING',
  'MELTING',
  'CUPELLATION',
  'PARTING',
  'ANNEALING',
  'FINAL_WEIGHING',
];

export interface StepStatus {
  step: FireAssayStep;
  done: boolean;
  order: number;
}

/**
 * 从 fireAssayDetail 推导步骤完成状态(纯函数)
 */
export function getFireAssayStepStatus(detail: Pick<FireAssayDetail, 
  'sampleWeightG' | 'furnaceTempC' | 'cupellationMin' | 'partingMin' | 'annealingMin' | 'prillWeightG'
>): StepStatus[] {
  const checks: Array<{ step: FireAssayStep; done: boolean }> = [
    { step: 'WEIGHING', done: detail.sampleWeightG !== null },
    { step: 'MELTING', done: detail.furnaceTempC !== null },
    { step: 'CUPELLATION', done: detail.cupellationMin !== null },
    { step: 'PARTING', done: detail.partingMin !== null },
    { step: 'ANNEALING', done: detail.annealingMin !== null },
    { step: 'FINAL_WEIGHING', done: detail.prillWeightG !== null },
  ];
  return checks.map((c, i) => ({ ...c, order: i + 1 }));
}

/**
 * 校验步骤顺序: 前 N-1 步完成才允许第 N 步
 * @param targetStep 将要执行的步骤
 * @param detail 当前详情
 * @returns { ok, missingSteps } 缺失的前序步骤
 */
export function validateStepOrder(
  targetStep: FireAssayStep,
  detail: Parameters<typeof getFireAssayStepStatus>[0],
): { ok: boolean; missingSteps: FireAssayStep[] } {
  const statuses = getFireAssayStepStatus(detail);
  const targetIdx = FIRE_ASSAY_STEP_ORDER.indexOf(targetStep);
  if (targetIdx < 0) return { ok: false, missingSteps: [] };

  // 前置步骤 = 顺序在 target 之前的步骤
  const missing = statuses
    .filter((s) => s.order < targetIdx + 1 && s.step !== targetStep && !s.done)
    .map((s) => s.step);

  return { ok: missing.length === 0, missingSteps: missing };
}

/**
 * 全部 6 步完成
 */
export function isAllStepsDone(detail: Parameters<typeof getFireAssayStepStatus>[0]): boolean {
  return getFireAssayStepStatus(detail).every((s) => s.done);
}

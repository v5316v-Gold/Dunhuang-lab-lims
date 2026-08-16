// =====================================================
// 人员状态机 — CNAS §7.2 人员
// 关键:资质过期 / 培训缺失 → 自动 SUSPENDED
// =====================================================

export type PersonnelState =
  | 'TRAINEE'           // 见习
  | 'QUALIFIED'         // 已培训完成
  | 'AUTHORIZED'        // 已授权(可独立操作)
  | 'SUSPENDED'         // 暂停(资质过期 / 培训缺失)
  | 'RETIRED';

export type PersonnelEvent =
  | { type: 'COMPLETE_TRAINING' }
  | { type: 'PASS_COMPETENCY' }
  | { type: 'AUTHORIZE' }
  | { type: 'SUSPEND'; reason: string }
  | { type: 'REINSTATE' }
  | { type: 'RETIRE' };

export const personnelStateTransitions: Record<PersonnelState, PersonnelState[]> = {
  TRAINEE: ['QUALIFIED', 'RETIRED'],
  QUALIFIED: ['AUTHORIZED', 'SUSPENDED', 'RETIRED'],
  AUTHORIZED: ['SUSPENDED', 'RETIRED'],
  SUSPENDED: ['AUTHORIZED', 'QUALIFIED', 'RETIRED'],
  RETIRED: [],
};

export function canPerformTesting(state: PersonnelState): boolean {
  return state === 'AUTHORIZED';
}

export function canApproveReport(state: PersonnelState): boolean {
  return state === 'AUTHORIZED';
}

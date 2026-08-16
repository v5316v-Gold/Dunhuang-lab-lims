// =====================================================
// 设备状态机 — CNAS §6.5 设备 + §7.7 期间核查
// 关键:校准逾期 1 天 → 自动 QUARANTINED
// =====================================================

export type EquipmentState =
  | 'IDLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'CALIBRATION'
  | 'PERIODIC_CHECK'
  | 'QUARANTINED'      // 隔离(校准逾期 / 期间核查失败)
  | 'RETIRED';

export type EquipmentEvent =
  | { type: 'START_USE' }
  | { type: 'STOP_USE' }
  | { type: 'START_MAINTENANCE' }
  | { type: 'FINISH_MAINTENANCE' }
  | { type: 'START_CALIBRATION' }
  | { type: 'FINISH_CALIBRATION'; passed: boolean }
  | { type: 'START_PERIODIC_CHECK' }
  | { type: 'FINISH_PERIODIC_CHECK'; passed: boolean }
  | { type: 'CALIBRATION_OVERDUE' }
  | { type: 'PERIODIC_CHECK_FAILED' }
  | { type: 'RELEASE' }      // QA 批准解封
  | { type: 'RETIRE' };

export const equipmentStateTransitions: Record<EquipmentState, EquipmentState[]> = {
  IDLE: ['IN_USE', 'CALIBRATION', 'PERIODIC_CHECK', 'MAINTENANCE', 'RETIRED'],
  IN_USE: ['IDLE', 'MAINTENANCE', 'CALIBRATION'],
  MAINTENANCE: ['IDLE', 'QUARANTINED'],
  CALIBRATION: ['IDLE', 'QUARANTINED'],
  PERIODIC_CHECK: ['IDLE', 'QUARANTINED'],
  QUARANTINED: ['CALIBRATION', 'MAINTENANCE', 'RETIRED'],   // 必须走维修或报废
  RETIRED: [],
};

/**
 * 是否可被用于检测
 */
export function canUseForTesting(state: EquipmentState): boolean {
  return state === 'IDLE' || state === 'IN_USE';
}

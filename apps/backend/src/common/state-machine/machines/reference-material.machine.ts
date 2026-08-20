// =====================================================
// 标准物质状态机 — CNAS §7.6 测量溯源性
// 关键:过期必须阻断使用(系统级 assertUsable)
// =====================================================

export type ReferenceMaterialState =
  | 'ACTIVE'         // 正常
  | 'IN_USE'         // 使用中
  | 'NEAR_EXPIRY'    // 临近过期(30/15/7/1 天告警)
  | 'EXPIRED'        // 已过期
  | 'DEPLETED'       // 用尽
  | 'DISPOSED';      // 已处置

export type ReferenceMaterialEvent =
  | { type: 'START_USE' }
  | { type: 'NEAR_EXPIRY_WARN'; daysLeft: number }
  | { type: 'EXPIRE' }
  | { type: 'DEPLETE' }
  | { type: 'DISPOSE' };

export const referenceMaterialTransitions: Record<ReferenceMaterialState, ReferenceMaterialState[]> = {
  ACTIVE: ['IN_USE', 'NEAR_EXPIRY', 'EXPIRED', 'DEPLETED', 'DISPOSED'],
  IN_USE: ['ACTIVE', 'NEAR_EXPIRY', 'EXPIRED', 'DEPLETED'],
  NEAR_EXPIRY: ['EXPIRED', 'IN_USE', 'DISPOSED'],
  EXPIRED: ['DISPOSED'],
  DEPLETED: ['DISPOSED'],
  DISPOSED: [],
};

export function canBeUsed(state: ReferenceMaterialState): boolean {
  return state === 'ACTIVE' || state === 'IN_USE' || state === 'NEAR_EXPIRY';
}

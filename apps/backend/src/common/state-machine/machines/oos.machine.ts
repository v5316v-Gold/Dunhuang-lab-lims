// =====================================================
// OOS(Out of Specification)状态机 — CNAS §7.9 / §7.10
// 详见 ADR-0012
// =====================================================

export type OosState =
  | 'OPENED'             // 已开(Westgard 触发 / 客户投诉)
  | 'INVESTIGATING'      // 调查中
  | 'CAUSE_IDENTIFIED'   // 原因已识别
  | 'CAPA_IN_PROGRESS'   // CAPA 实施中
  | 'CAPA_VERIFIED'      // CAPA 已验证
  | 'CLOSED';            // 已关闭

export type OosEvent =
  | { type: 'START_INVESTIGATION' }
  | { type: 'IDENTIFY_CAUSE'; cause: string }
  | { type: 'START_CAPA' }
  | { type: 'VERIFY_CAPA'; passed: boolean }
  | { type: 'CLOSE'; resolution: string }
  | { type: 'REOPEN'; reason: string };

export const oosStateTransitions: Record<OosState, OosState[]> = {
  OPENED: ['INVESTIGATING', 'CLOSED'],
  INVESTIGATING: ['CAUSE_IDENTIFIED', 'CLOSED'],
  CAUSE_IDENTIFIED: ['CAPA_IN_PROGRESS', 'CLOSED'],
  CAPA_IN_PROGRESS: ['CAPA_VERIFIED', 'CAUSE_IDENTIFIED'],
  CAPA_VERIFIED: ['CLOSED', 'CAPA_IN_PROGRESS'],   // 验证失败可重做
  CLOSED: ['OPENED'],                              // 发现新证据可重开
};

/**
 * OOS 最大关闭时限(天)
 * 评审关注:超过此时间应自动告警
 */
export const OOS_MAX_OPEN_DAYS = 7;

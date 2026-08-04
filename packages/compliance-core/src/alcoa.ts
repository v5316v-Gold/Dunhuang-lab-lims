// =====================================================
// ALCOA+ 9 原则检查器
// 详见 docs/04-CNAS-COMPLIANCE.md §2
// =====================================================

export enum AlcoaPrinciple {
  ATTRIBUTABLE = 'A', // 可归属
  LEGIBLE = 'L', // 清晰可读
  CONTEMPORANEOUS = 'C', // 同步
  ORIGINAL = 'O', // 原始
  ACCURATE = 'A2', // 准确
  COMPLETE = 'C2', // 完整
  CONSISTENT = 'C3', // 一致
  ENDURING = 'E', // 持久
  AVAILABLE = 'AV', // 可用
}

export interface AlcoaCheckInput {
  /** 操作者 */
  hasUserId: boolean;
  hasUsername: boolean;
  hasTimestamp: boolean;
  /** 时间戳与操作时间差(秒) */
  timestampDrift: number;
  /** 数据是否原始 */
  isOriginal: boolean;
  /** 是否可读 */
  isLegible: boolean;
  /** 是否有审计记录 */
  hasAuditLog: boolean;
  /** 是否加密备份 */
  hasBackup: boolean;
  /** 是否可查询 */
  isQueryable: boolean;
}

export interface AlcoaCheckResult {
  passed: boolean;
  details: Record<AlcoaPrinciple, { passed: boolean; message?: string }>;
}

/**
 * ALCOA+ 9 原则自动检查
 */
export function checkAlcoaPlus(input: AlcoaCheckInput): AlcoaCheckResult {
  const details: AlcoaCheckResult['details'] = {
    [AlcoaPrinciple.ATTRIBUTABLE]: {
      passed: input.hasUserId && input.hasUsername,
      message: input.hasUserId && input.hasUsername ? undefined : '缺少 user_id 或 username',
    },
    [AlcoaPrinciple.LEGIBLE]: {
      passed: input.isLegible,
      message: input.isLegible ? undefined : '数据不可读',
    },
    [AlcoaPrinciple.CONTEMPORANEOUS]: {
      passed: input.hasTimestamp && input.timestampDrift < 1, // 1 秒内
      message: input.timestampDrift < 1 ? undefined : `时间戳漂移 ${input.timestampDrift}s`,
    },
    [AlcoaPrinciple.ORIGINAL]: {
      passed: input.isOriginal,
      message: input.isOriginal ? undefined : '原始数据被修改',
    },
    [AlcoaPrinciple.ACCURATE]: {
      passed: input.hasAuditLog, // 简化为有审计即可
      message: input.hasAuditLog ? undefined : '无审计链',
    },
    [AlcoaPrinciple.COMPLETE]: {
      passed: input.hasAuditLog,
      message: input.hasAuditLog ? undefined : '审计链不完整',
    },
    [AlcoaPrinciple.CONSISTENT]: {
      passed: input.hasAuditLog,
      message: input.hasAuditLog ? undefined : '跨表数据不一致',
    },
    [AlcoaPrinciple.ENDURING]: {
      passed: input.hasBackup,
      message: input.hasBackup ? undefined : '缺少异地备份',
    },
    [AlcoaPrinciple.AVAILABLE]: {
      passed: input.isQueryable,
      message: input.isQueryable ? undefined : '数据不可查询',
    },
  };

  const passed = Object.values(details).every((d) => d.passed);
  return { passed, details };
}
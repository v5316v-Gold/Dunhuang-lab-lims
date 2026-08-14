// =====================================================
// 审计事件类型枚举 — Phase 1 Task 2.1 (CODE-EXECUTION-PLAN §3.1 audit)
// 架构映射: L2 审计要求(4 类事件: 用户/数据/系统/安全)
//
// 约定:
//   - action 前缀 = 事件类别(写入 audit_logs.action)
//     SECURITY:xxx  = 安全事件
//     SYSTEM:xxx    = 系统事件
//     AUTH:xxx      = 用户认证事件
//     CONFIG:xxx    = 配置变更事件
//   - 业务数据事件(INSERT:xxx / UPDATE:xxx / DELETE:xxx)由 DB trigger 自动产生,不在此列
// =====================================================

export const AuditEventType = {
  // ===== 用户事件(AUTH) =====
  LOGIN_SUCCESS: 'AUTH:LOGIN_SUCCESS',
  LOGIN_FAILED: 'AUTH:LOGIN_FAILED',
  LOGOUT: 'AUTH:LOGOUT',
  PASSWORD_CHANGED: 'AUTH:PASSWORD_CHANGED',
  MFA_ENABLED: 'AUTH:MFA_ENABLED',
  ACCOUNT_LOCKED: 'AUTH:ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'AUTH:ACCOUNT_UNLOCKED',

  // ===== 安全事件(SECURITY) =====
  ACCESS_DENIED: 'SECURITY:ACCESS_DENIED',       // RBAC 403
  BRUTE_FORCE_ATTEMPT: 'SECURITY:BRUTE_FORCE_ATTEMPT', // 登录爆破
  AUDIT_TAMPER_ATTEMPT: 'SECURITY:AUDIT_TAMPER_ATTEMPT', // 审计篡改尝试
  SENSITIVE_ACCESS: 'SECURITY:SENSITIVE_ACCESS', // 敏感数据访问(审计日志导出等)

  // ===== 系统事件(SYSTEM) =====
  SYSTEM_START: 'SYSTEM:START',
  SYSTEM_SHUTDOWN: 'SYSTEM:SHUTDOWN',

  // ===== 配置事件(CONFIG) =====
  PERMISSION_CHANGED: 'CONFIG:PERMISSION_CHANGED', // 角色/权限变更
  SETTINGS_CHANGED: 'CONFIG:SETTINGS_CHANGED',     // 系统参数变更
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

// =====================================================
// 密码策略 — Phase 1 Task 2.2 (CODE-EXECUTION-PLAN §3.1 auth)
// 架构映射: L2 认证安全(BR-C-22 弱密码) + L4 RBAC
//
// 设计:
//   - 统一密码强度校验(注册/改密共用)
//   - 规则: 长度 8-128 / 大小写 / 数字 / 特殊字符 / 不含用户名
//   - 纯函数可单测
// 适配: TypeScript 5.4
// =====================================================

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/** 特殊字符集(与 ChangePasswordDto 正则一致) */
const SPECIAL_CHARS = `!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>/?\`~`;

/**
 * 校验密码强度
 * @param password 待校验密码
 * @param username 关联用户名(禁止包含,防弱口令)
 * @param options 可覆盖默认规则
 */
export function validatePasswordPolicy(
  password: string,
  username?: string,
  options?: { minLength?: number; maxLength?: number },
): PasswordPolicyResult {
  const min = options?.minLength ?? 8;
  const max = options?.maxLength ?? 128;
  const errors: string[] = [];

  if (!password) {
    return { ok: false, errors: ['密码不能为空'] };
  }

  // 长度
  if (password.length < min) {
    errors.push(`密码长度至少 ${min} 位(当前 ${password.length})`);
  }
  if (password.length > max) {
    errors.push(`密码长度不能超过 ${max} 位`);
  }

  // 复杂度(满足至少 3 类: 小写/大写/数字/特殊,且必须同时含大小写与数字)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = new RegExp(`[${SPECIAL_CHARS}]`).test(password);

  if (!hasLower) errors.push('密码必须包含小写字母');
  if (!hasUpper) errors.push('密码必须包含大写字母');
  if (!hasDigit) errors.push('密码必须包含数字');
  if (!hasSpecial) errors.push('密码必须包含特殊字符');

  // 禁用弱模式
  if (/^(123456|password|qwerty|abc123)/i.test(password)) {
    errors.push('密码不能为常见弱口令(如 123456/password)');
  }
  if (/(.)\1{3,}/.test(password)) {
    errors.push('密码不能包含连续 4 个相同字符');
  }

  // 不含用户名(用户名 ≥ 3 字符时检查)
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('密码不能包含用户名');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * 生成策略提示文案(用于前端展示)
 */
export function passwordPolicyHint(): string {
  return '密码需 ≥8 位,包含大小写字母、数字、特殊字符,不含用户名,不得为常见弱口令';
}

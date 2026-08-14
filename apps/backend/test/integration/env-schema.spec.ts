// =====================================================
// env.schema 单元测试 — Phase 1 Task 2.3
// 验证:
//   1. 完整合法 env → ok=true
//   2. 缺失必填 → 报错列表
//   3. 占位符 *** → 报错
//   4. DATABASE_URL/REDIS_URL 格式错误 → 报错
//   5. 生产环境 JWT 弱密钥 → 报错;开发环境 → 仅警告
//   6. 生产 JWT_SECRET == JWT_REFRESH_SECRET → 报错
// =====================================================

import { validateEnv, assertEnv } from '../../src/config/env.schema';

/** 构造一个合法 base env */
function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://dunhuang:dunhuang_dev_pwd@127.0.0.1:55432/dunhuang_lims?schema=public',
    REDIS_URL: 'redis://127.0.0.1:56379',
    JWT_SECRET: 'a-strong-dev-secret-32-characters-long!!',
    JWT_REFRESH_SECRET: 'another-strong-dev-secret-32-characters!!',
    APP_PORT: '3030',
    THROTTLE_TTL: '60',
    ...overrides,
  };
}

describe('env.schema (Phase 1 Task 2.3)', () => {
  // ===== 测试 1: 完整合法 env → ok =====
  it('valid env passes (development)', () => {
    const r = validateEnv(baseEnv(), 'development');
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  // ===== 测试 2: 缺失必填 → 报错 =====
  it('missing required env fails', () => {
    const env = baseEnv();
    delete env.DATABASE_URL;
    delete env.JWT_SECRET;
    const r = validateEnv(env, 'development');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('DATABASE_URL');
    expect(r.errors.join(' ')).toContain('JWT_SECRET');
  });

  // ===== 测试 3: 占位符 *** → 报错 =====
  it('placeholder *** in env fails', () => {
    const r = validateEnv(
      baseEnv({ DATABASE_URL: 'postgresql://dunhuang:***@127.0.0.1:5432/db' }),
      'development',
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('占位符');
  });

  // ===== 测试 4: 格式错误 → 报错 =====
  it('invalid URL format fails', () => {
    const r1 = validateEnv(baseEnv({ DATABASE_URL: 'mysql://x' }), 'development');
    expect(r1.ok).toBe(false);
    expect(r1.errors.join(' ')).toContain('DATABASE_URL');

    const r2 = validateEnv(baseEnv({ REDIS_URL: 'http://x' }), 'development');
    expect(r2.ok).toBe(false);
    expect(r2.errors.join(' ')).toContain('REDIS_URL');
  });

  // ===== 测试 5: 生产弱密钥 → 报错 =====
  it('production weak JWT secret fails; development only warns', () => {
    const weak = { JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'short' };
    const rProd = validateEnv(baseEnv(weak), 'production');
    expect(rProd.ok).toBe(false);
    expect(rProd.errors.join(' ')).toContain('JWT_SECRET');

    const rDev = validateEnv(baseEnv(weak), 'development');
    expect(rDev.ok).toBe(true);
    expect(rDev.warnings.length).toBeGreaterThan(0);
  });

  // ===== 测试 6: 生产同密钥 → 报错 =====
  it('production same secret for JWT and refresh fails', () => {
    const same = {
      JWT_SECRET: 'x'.repeat(40),
      JWT_REFRESH_SECRET: 'x'.repeat(40),
    };
    const r = validateEnv(baseEnv(same), 'production');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('必须不同');
  });

  // ===== 测试 7: assertEnv 返回布尔 =====
  it('assertEnv returns true for valid, false for invalid', () => {
    expect(assertEnv(baseEnv(), 'development')).toBe(true);
    expect(assertEnv(baseEnv({ JWT_SECRET: '' }), 'development')).toBe(false);
  });
});

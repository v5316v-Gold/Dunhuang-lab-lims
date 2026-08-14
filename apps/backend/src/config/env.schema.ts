// =====================================================
// 环境变量校验 Schema — Phase 1 Task 2.3 (CODE-EXECUTION-PLAN §2.2)
// 架构映射: L5 (配置中心化) + BR-T 工程规范
//
// 设计:
//   1. 启动时校验必填 env,缺失/非法 → 明确报错退出(防"静默用默认值"陷阱)
//   2. 生产(NODE_ENV=production)额外强校验 JWT_SECRET 强度
//   3. 测试环境宽容(CI 注入测试值)
//   4. 纯函数,无依赖,可单测
// 适配: TypeScript 5.4 + Node 20/22
// =====================================================

export interface EnvCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** 必填项:缺失即启动失败 */
const REQUIRED_ENV: Array<{ key: string; desc: string }> = [
  { key: 'DATABASE_URL', desc: 'PostgreSQL 连接串' },
  { key: 'REDIS_URL', desc: 'Redis 连接串' },
  { key: 'JWT_SECRET', desc: 'JWT 签名密钥' },
  { key: 'JWT_REFRESH_SECRET', desc: 'Refresh Token 签名密钥' },
];

/** 生产环境额外强校验 */
const PROD_STRONG_CHECKS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];

/**
 * 校验环境变量
 * @param env 环境变量对象(默认 process.env,可注入测试)
 * @param nodeEnv 运行环境(默认 process.env.NODE_ENV,可注入测试)
 */
export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
  nodeEnv: string | undefined = env.NODE_ENV,
): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = nodeEnv === 'production';

  // 1. 必填检查
  for (const { key, desc } of REQUIRED_ENV) {
    const value = env[key];
    if (!value || value.trim() === '') {
      errors.push(`环境变量 ${key} 缺失(${desc})`);
    } else if (value.includes('***')) {
      // 检测 .env.example 占位符误用
      errors.push(`环境变量 ${key} 含有占位符 ***,请填入真实值`);
    }
  }

  // 2. 格式检查
  const dbUrl = env.DATABASE_URL;
  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
    errors.push('DATABASE_URL 必须以 postgres:// 或 postgresql:// 开头');
  }
  const redisUrl = env.REDIS_URL;
  if (redisUrl && !/^redis:\/\//.test(redisUrl)) {
    errors.push('REDIS_URL 必须以 redis:// 开头');
  }
  const appPort = env.APP_PORT;
  if (appPort && !/^\d{2,5}$/.test(appPort)) {
    errors.push(`APP_PORT 非法: ${appPort}(应为 2-5 位数字)`);
  }

  // 3. 生产强校验:JWT 密钥强度
  if (isProd) {
    for (const key of PROD_STRONG_CHECKS) {
      const v = env[key] || '';
      if (v.length < 32) {
        errors.push(`生产环境 ${key} 长度必须 ≥ 32 字符(当前 ${v.length})`);
      }
      if (/change-me|dev-|test-secret/i.test(v)) {
        errors.push(`生产环境 ${key} 含开发占位关键词(change-me/dev-/test-secret),禁止上线`);
      }
    }
    if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      errors.push('生产环境 JWT_SECRET 与 JWT_REFRESH_SECRET 必须不同');
    }
  } else {
    // 开发/测试:警告不阻断
    for (const key of PROD_STRONG_CHECKS) {
      const v = env[key] || '';
      if (v.length < 32) {
        warnings.push(`建议 ${key} 长度 ≥ 32 字符(开发环境不阻断)`);
      }
    }
  }

  // 4. 数字/布尔格式
  const throttleTtl = env.THROTTLE_TTL;
  if (throttleTtl && !/^\d+$/.test(throttleTtl)) {
    errors.push(`THROTTLE_TTL 非法: ${throttleTtl}(应为正整数)`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * 启动入口调用:校验失败打印错误并退出
 * @returns true=通过; false=失败(已打印,调用方决定是否退出)
 */
export function assertEnv(
  env: NodeJS.ProcessEnv = process.env,
  nodeEnv: string | undefined = env.NODE_ENV,
): boolean {
  const result = validateEnv(env, nodeEnv);

  for (const w of result.warnings) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  [env] ${w}`);
  }
  if (!result.ok) {
    for (const e of result.errors) {
      // eslint-disable-next-line no-console
      console.error(`❌ [env] ${e}`);
    }
    return false;
  }
  // eslint-disable-next-line no-console
  console.info(`✅ [env] 环境变量校验通过(${env.NODE_ENV || 'development'})`);
  return true;
}

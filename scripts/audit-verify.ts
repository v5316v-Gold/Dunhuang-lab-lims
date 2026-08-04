/**
 * 敦煌金质检 LIMS - 审计链 SHA256 离线断链自检工具
 * 详见 ADR-0003
 *
 * 用法:
 *   pnpm audit:verify                    # 验证整条审计链
 *   pnpm audit:verify --id 12345        # 验证指定 ID 的记录
 *   pnpm audit:verify --stats           # 仅输出统计信息
 *
 * 独立于 NestJS,直接通过 PG 客户端(不需要启动 LIMS 服务)。
 * 算法与 PG 触发器 audit_chain.sql 完全一致:
 *   SHA256(prev_hash || user_id || username || action || table_name || record_id || new_data || created_at)
 */

import { Client } from 'pg';
import { createHash } from 'node:crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 多路径兜底加载 .env(兼容 scripts/ 在仓库根或 apps/backend 下)
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'), // scripts/audit-verify.ts → 仓库根
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];
for (const p of envCandidates) {
  const result = dotenv.config({ path: p });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    console.error(`✓ loaded env from ${p} (${Object.keys(result.parsed).length} vars)`);
    break;
  }
}

const ZERO_HASH = '0'.repeat(64);
const BATCH_SIZE = 1000;

// 解析命令行参数
const args = process.argv.slice(2);
const flags = {
  id: 0,
  stats: args.includes('--stats'),
  help: args.includes('--help') || args.includes('-h'),
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) flags.id = parseInt(args[i + 1], 10);
}

if (flags.help) {
  console.log(`
审计链 SHA256 断链自检工具 (ADR-0003)

用法:
  tsx scripts/audit-verify.ts                  验证整条审计链
  tsx scripts/audit-verify.ts --id <N>        验证指定 ID 的记录
  tsx scripts/audit-verify.ts --stats          仅输出统计信息(不校验哈希)

环境变量(从 .env 自动加载):
  DATABASE_URL    postgresql://user:pass@host:port/db
`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 未设置');
  console.error('   请在 .env 中配置,或通过环境变量传入');
  process.exit(1);
}

/**
 * 计算 SHA256 哈希(与 PG 触发器 audit_chain.sql 严格一致)
 */
function computeHash(input: {
  prevHash: string;
  userId: string | null;
  username: string;
  action: string;
  tableName: string;
  recordId: string;
  newData: unknown;
  createdAt: Date;
}): string {
  const concat = [
    input.prevHash || ZERO_HASH,
    input.userId ?? 'null',
    input.username,
    input.action,
    input.tableName ?? '',
    input.recordId ?? '',
    JSON.stringify(input.newData ?? null),
    input.createdAt.toISOString(),
  ].join('|');

  return createHash('sha256').update(concat, 'utf8').digest('hex');
}

/**
 * 验证整条审计链(分批流式)
 */
async function verifyChain(client: Client): Promise<{
  passed: boolean;
  total: number;
  errors: Array<{ id: number; reason: string; expected?: string; actual?: string }>;
  durationMs: number;
}> {
  const start = Date.now();
  const errors: Array<{ id: number; reason: string; expected?: string; actual?: string }> = [];
  let prevHash = ZERO_HASH;
  let total = 0;
  let lastId = 0;

  while (true) {
    const { rows } = await client.query<{
      id: string;
      prev_hash: string;
      curr_hash: string;
    }>(
      `SELECT id, prev_hash, curr_hash FROM audit_logs
       WHERE id > $1 ORDER BY id ASC LIMIT $2`,
      [lastId, BATCH_SIZE],
    );

    if (rows.length === 0) break;

    for (const row of rows) {
      if (row.prev_hash !== prevHash) {
        errors.push({
          id: Number(row.id),
          reason: 'prev_hash 不匹配上一条 curr_hash(断链)',
          expected: prevHash,
          actual: row.prev_hash,
        });
      }
      prevHash = row.curr_hash;
      lastId = Number(row.id);
      total++;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return {
    passed: errors.length === 0,
    total,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * 验证单条记录(重算 curr_hash 并对比)
 */
async function verifyRecord(
  client: Client,
  id: number,
): Promise<{ passed: boolean; reason?: string; expected?: string; actual?: string }> {
  const { rows } = await client.query<{
    id: string;
    user_id: string | null;
    username: string;
    action: string;
    table_name: string | null;
    record_id: string | null;
    new_data: string; // JSONB 在 pg 库中默认返回 string;若为 object 则需 ::text
    prev_hash: string;
    curr_hash: string;
    created_at: Date;
  }>(
    `SELECT id, user_id, username, action, table_name, record_id, new_data::text AS new_data, prev_hash, curr_hash, created_at
     FROM audit_logs WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return { passed: false, reason: `记录 ${id} 不存在` };
  }
  const r = rows[0];

  // 校验 prev_hash 链
  const { rows: prevRows } = await client.query<{ curr_hash: string }>(
    `SELECT curr_hash FROM audit_logs WHERE id < $1 ORDER BY id DESC LIMIT 1`,
    [id],
  );
  const expectedPrevHash = prevRows[0]?.curr_hash ?? ZERO_HASH;
  if (r.prev_hash !== expectedPrevHash) {
    return {
      passed: false,
      reason: 'prev_hash 不匹配(断链)',
      expected: expectedPrevHash,
      actual: r.prev_hash,
    };
  }

  // 重算 curr_hash —— 使用 PG 原生 timestamp 格式(与触发器算法严格一致)
  const { rows: tsRows } = await client.query<{ ts: string }>(
    `SELECT to_char($1::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ts`,
    [r.created_at],
  );
  const tsStr = tsRows[0].ts;

  const concat = [
    r.prev_hash,
    r.user_id ?? 'null',
    r.username,
    r.action,
    r.table_name ?? '',
    r.record_id ?? '',
    r.new_data ?? '',
    tsStr,
  ].join('|');

  const computed = createHash('sha256').update(concat, 'utf8').digest('hex');

  if (computed !== r.curr_hash) {
    return {
      passed: false,
      reason: 'curr_hash 重算不匹配(数据被篡改)',
      expected: computed,
      actual: r.curr_hash,
    };
  }

  return { passed: true };
}

/**
 * 统计信息
 */
async function getStats(client: Client): Promise<void> {
  const total = await client.query<{ count: string }>(`SELECT COUNT(*) FROM audit_logs`);
  const byTable = await client.query<{ table_name: string | null; count: string }>(
    `SELECT table_name, COUNT(*) FROM audit_logs GROUP BY table_name ORDER BY 2 DESC LIMIT 20`,
  );
  const byAction = await client.query<{ action: string; count: string }>(
    `SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY 2 DESC LIMIT 10`,
  );
  const timeRange = await client.query<{ first: Date; last: Date }>(
    `SELECT MIN(created_at) AS first, MAX(created_at) AS last FROM audit_logs`,
  );

  console.log('📊 审计链统计信息:');
  console.log(`   总记录数: ${total.rows[0].count}`);
  console.log(`   时间范围: ${timeRange.rows[0].first?.toISOString()} → ${timeRange.rows[0].last?.toISOString()}`);
  console.log('\n   按表统计 (TOP 20):');
  for (const r of byTable.rows) {
    console.log(`     ${(r.table_name ?? 'NULL').padEnd(25)} ${r.count}`);
  }
  console.log('\n   按动作统计 (TOP 10):');
  for (const r of byAction.rows) {
    console.log(`     ${r.action.padEnd(35)} ${r.count}`);
  }
}

/**
 * 主流程
 */
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ 已连接 PostgreSQL\n');

  try {
    if (flags.stats) {
      await getStats(client);
      return;
    }

    if (flags.id > 0) {
      console.log(`🔍 验证单条审计记录: ID = ${flags.id}`);
      const result = await verifyRecord(client, flags.id);
      if (result.passed) {
        console.log(`✅ 记录 ${flags.id} 验证通过`);
      } else {
        console.error(`❌ 记录 ${flags.id} 验证失败: ${result.reason}`);
        if (result.expected && result.actual) {
          console.error(`   期望: ${result.expected}`);
          console.error(`   实际: ${result.actual}`);
        }
        process.exit(1);
      }
      return;
    }

    console.log('🔍 验证整条审计链...');
    const result = await verifyChain(client);

    console.log('\n📊 验证结果:');
    console.log(`   通过:        ${result.passed ? '✅ 是' : '❌ 否'}`);
    console.log(`   总记录数:    ${result.total}`);
    console.log(`   错误数:      ${result.errors.length}`);
    console.log(`   耗时:        ${result.durationMs}ms`);

    if (!result.passed) {
      console.error('\n🚨 断链详情(最多展示前 10 条):');
      for (const err of result.errors.slice(0, 10)) {
        console.error(`   ID ${err.id}: ${err.reason}`);
        if (err.expected && err.actual) {
          console.error(`     期望: ${err.expected.slice(0, 16)}...`);
          console.error(`     实际: ${err.actual.slice(0, 16)}...`);
        }
      }
      if (result.errors.length > 10) {
        console.error(`   ... 还有 ${result.errors.length - 10} 条未展示`);
      }
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('❌ 验证失败:', e.message);
  if (e.code) console.error(`   错误码: ${e.code}`);
  process.exit(1);
});
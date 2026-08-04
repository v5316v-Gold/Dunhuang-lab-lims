#!/usr/bin/env node
/**
 * 迁移 audit_logs 历史数据到 hash chain
 * 2026-08-03 P0-2 CNAS 改造
 *
 * 使用:
 *   node scripts/migrate-audit-chain.js
 *   或
 *   node scripts/migrate-audit-chain.js --verify-only
 */
const path = require('path');
const Database = require('better-sqlite3');
const { AuditChain, GENESIS_HASH } = require('../lib/audit-chain');

const DB_PATH = process.env.DB_DATA_PATH ||
  'D:\\lab lims\\lims_data\\lims_cnas.data';

const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify-only');

function safeJSONParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

function main() {
  console.log('========================================');
  console.log('SHA256 Audit Chain Migration');
  console.log('========================================');
  console.log('DB:', DB_PATH);

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  // 1. 准备：确保列存在
  const audit = new AuditChain(db);
  audit.installTriggers();

  // 2. verify-only 模式
  if (VERIFY_ONLY) {
    console.log('\n[verify-only mode]');
    const result = audit.verify();
    console.log(JSON.stringify(result, null, 2));
    db.close();
    process.exit(result.valid ? 0 : 1);
  }

  // 3. 查所有现有 audit_logs
  const rows = db.prepare(`
    SELECT id, created_at, user_id, action, table_name, record_id, old_data, new_data, prev_hash, curr_hash
    FROM audit_logs
    ORDER BY id ASC
  `).all();

  console.log(`\nFound ${rows.length} existing audit logs`);

  if (rows.length === 0) {
    console.log('No data to migrate. Exiting.');
    db.close();
    return;
  }

  // 4. 重新计算所有 hash
  let prevHash = GENESIS_HASH;
  let updated = 0;
  let skipped = 0;

  const update = db.prepare(
    'UPDATE audit_logs SET prev_hash = ?, curr_hash = ? WHERE id = ?'
  );

  const migrateAll = db.transaction(() => {
    for (const row of rows) {
      // 跳过已有 curr_hash 的（如果数据没变）
      if (row.curr_hash && row.curr_hash !== 'pending') {
        // 但要验证 prev_hash 是否一致
        if (row.prev_hash === prevHash) {
          prevHash = row.curr_hash;
          skipped++;
          continue;
        }
      }
      // 重新计算
      const data = {
        ts: row.created_at,
        user_id: row.user_id,
        action: row.action,
        table_name: row.table_name,
        record_id: row.record_id,
        old_data: safeJSONParse(row.old_data),
        new_data: safeJSONParse(row.new_data)
      };
      const json = JSON.stringify(data);
      const crypto = require('crypto');
      const newHash = crypto.createHash('sha256').update(prevHash + json).digest('hex');
      update.run(prevHash, newHash, row.id);
      prevHash = newHash;
      updated++;
    }
  });
  migrateAll();

  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already valid): ${skipped}`);

  // 5. 验证
  console.log('\nVerifying hash chain...');
  const result = audit.verify();
  if (result.valid) {
    console.log(`✅ VALID: ${result.total} records, hash chain intact`);
  } else {
    console.log(`❌ INVALID: broken at id=${result.brokenAt}, reason=${result.reason}`);
    process.exit(1);
  }

  db.close();
  console.log('\nMigration complete.');
}

try {
  main();
} catch (e) {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
}

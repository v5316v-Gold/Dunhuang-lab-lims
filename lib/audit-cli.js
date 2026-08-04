#!/usr/bin/env node
/**
 * Audit Chain CLI 工具
 * 2026-08-03 P0-2 CNAS 改造
 *
 * 使用:
 *   node lib/audit-cli.js verify      # 验证整个 hash chain
 *   node lib/audit-cli.js list [N]    # 列出最近 N 条（默认 10）
 *   node lib/audit-cli.js test-trigger # 测试触发器（尝试 UPDATE/DELETE）
 */
const Database = require('better-sqlite3');
const { AuditChain } = require('./audit-chain');

const DB_PATH = process.env.DB_DATA_PATH ||
  'D:\\lab lims\\lims_data\\lims_cnas.data';

const cmd = process.argv[2] || 'verify';
const arg = process.argv[3];

function main() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const audit = new AuditChain(db);
  audit.installTriggers();

  switch (cmd) {
    case 'verify': {
      const result = audit.verify();
      if (result.valid) {
        console.log(`✅ Audit chain VALID: ${result.total} records`);
        if (result.total === 0) console.log('  (no records yet)');
      } else {
        console.log(`❌ Audit chain BROKEN at id=${result.brokenAt}`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Total records: ${result.total}`);
        process.exit(1);
      }
      break;
    }
    case 'list': {
      const n = parseInt(arg) || 10;
      const rows = audit.list({ limit: n });
      console.log(`Last ${rows.length} audit logs:`);
      for (const r of rows) {
        console.log(`  #${r.id} ${r.created_at} user=${r.user_id} action=${r.action} table=${r.table_name} record=${r.record_id}`);
        console.log(`     prev=${(r.prev_hash||'').slice(0,16)}... curr=${(r.curr_hash||'').slice(0,16)}...`);
      }
      break;
    }
    case 'test-trigger': {
      // 尝试直接 UPDATE - 应该被触发器拒绝
      // 先插入测试行
      console.log('Inserting test row...');
      const crypto = require('crypto');
      const lastRow = db.prepare("SELECT curr_hash FROM audit_logs ORDER BY id DESC LIMIT 1").get();
      const testPrev = lastRow && lastRow.curr_hash ? lastRow.curr_hash : '0'.repeat(64);
      const testTs = new Date().toISOString();
      const testData = JSON.stringify({ts:testTs,user_id:1,action:'TEST',table_name:'test_trigger',record_id:0,old_data:null,new_data:null});
      const testCurr = crypto.createHash('sha256').update(testPrev+testData).digest('hex');
      const ins = db.prepare(`
        INSERT INTO audit_logs
          (user_id, action, table_name, record_id, old_data, new_data, ip_address, prev_hash, curr_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        1, 'TEST', 'test_trigger', 0, null, null, '127.0.0.1', testPrev, testCurr, testTs
      );
      const testId = ins.lastInsertRowid;
      console.log('Test row id=' + testId);

      console.log('\nTesting UPDATE trigger...');
      try {
        db.prepare(`UPDATE audit_logs SET action='hacked' WHERE id=?`).run(testId);
        console.log('❌ FAIL: UPDATE was allowed (trigger not working)');
      } catch (e) {
        if (e.message.includes('append-only')) {
          console.log('✅ PASS: UPDATE rejected with:', e.message);
        } else {
          console.log('⚠️  UPDATE rejected but message:', e.message);
        }
      }
      console.log('\nTesting DELETE trigger...');
      try {
        db.prepare(`DELETE FROM audit_logs WHERE id=?`).run(testId);
        console.log('❌ FAIL: DELETE was allowed (trigger not working)');
      } catch (e) {
        if (e.message.includes('append-only')) {
          console.log('✅ PASS: DELETE rejected with:', e.message);
        } else {
          console.log('⚠️  DELETE rejected but message:', e.message);
        }
      }
      break;
    }
    default:
      console.log('Unknown command:', cmd);
      console.log('Usage: node lib/audit-cli.js {verify|list|test-trigger}');
      process.exit(1);
  }

  db.close();
}

try {
  main();
} catch (e) {
  console.error('FATAL:', e.message);
  process.exit(1);
}

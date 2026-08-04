/**
 * AuditChain - SHA256 hash chain audit log
 * 2026-08-03 P0-2 CNAS 改造
 *
 * 依据: ISO/IEC 17025:2017 §7.5 技术记录 + §7.11.2 数据控制
 * 依据: ALCOA+ Original/Enduring/Complete
 *
 * 核心特性:
 * - 每条 audit_log 含 prev_hash + curr_hash = SHA256(prev_hash + data)
 * - 触发器阻止 UPDATE/DELETE (append-only)
 * - 验证工具: verify() 可独立检测 hash 链断裂
 */
const crypto = require('crypto');

const GENESIS_HASH = '0'.repeat(64);

class AuditChain {
  constructor(db) {
    this.db = db;
    this.ensureColumns();
  }

  /**
   * 确保 audit_logs 表有 hash 字段
   * （幂等操作，可重复调用）
   */
  ensureColumns() {
    const cols = this.db.prepare("PRAGMA table_info(audit_logs)").all();
    const colNames = cols.map(c => c.name);
    if (!colNames.includes('prev_hash')) {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT DEFAULT '${GENESIS_HASH}'`);
      console.log('[AUDIT-CHAIN] Added column: prev_hash');
    }
    if (!colNames.includes('curr_hash')) {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN curr_hash TEXT`);
      console.log('[AUDIT-CHAIN] Added column: curr_hash');
    }
  }

  /**
   * 计算一条记录的 hash
   * @private
   */
  computeHash(prevHash, entry) {
    const data = JSON.stringify({
      ts: entry.ts,
      user_id: entry.user_id,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id,
      old_data: entry.old_data,
      new_data: entry.new_data
    });
    return crypto
      .createHash('sha256')
      .update(prevHash + data)
      .digest('hex');
  }

  /**
   * 写入一条审计日志，自动计算 hash
   * @param {Object} entry - { user_id, action, table_name, record_id, old_data, new_data, ip_address }
   * @returns {Object} { id, curr_hash }
   */
  append(entry) {
    // 取上一条 hash
    const last = this.db.prepare(
      'SELECT curr_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
    ).get();
    const prevHash = (last && last.curr_hash) || GENESIS_HASH;

    // 构造数据
    const ts = new Date().toISOString();
    const data = {
      ts,
      user_id: entry.user_id,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id,
      old_data: entry.old_data,
      new_data: entry.new_data
    };

    // 计算 hash
    const currHash = this.computeHash(prevHash, data);

    // 写入
    const info = this.db.prepare(`
      INSERT INTO audit_logs
        (user_id, action, table_name, record_id, old_data, new_data, ip_address, prev_hash, curr_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.user_id || null,
      entry.action || 'unknown',
      entry.table_name || null,
      entry.record_id || null,
      JSON.stringify(entry.old_data || null),
      JSON.stringify(entry.new_data || null),
      entry.ip_address || null,
      prevHash,
      currHash,
      ts
    );

    return { id: info.lastInsertRowid, curr_hash: currHash, prev_hash: prevHash };
  }

  /**
   * 校验整个 hash chain 完整性
   * @returns {Object} { valid: boolean, brokenAt: number|null, total: number }
   */
  verify() {
    const rows = this.db.prepare(`
      SELECT id, prev_hash, curr_hash, created_at, user_id, action, table_name, record_id, old_data, new_data
      FROM audit_logs
      ORDER BY id ASC
    `).all();

    if (rows.length === 0) {
      return { valid: true, brokenAt: null, total: 0, message: 'No audit logs' };
    }

    let expectedPrev = GENESIS_HASH;
    for (const row of rows) {
      // 1. 检查 prev_hash 是否对得上
      if (row.prev_hash !== expectedPrev) {
        return { valid: false, brokenAt: row.id, total: rows.length, reason: 'prev_hash mismatch' };
      }
      // 2. 重算 hash 验证
      const data = {
        ts: row.created_at,
        user_id: row.user_id,
        action: row.action,
        table_name: row.table_name,
        record_id: row.record_id,
        old_data: safeJSONParse(row.old_data),
        new_data: safeJSONParse(row.new_data)
      };
      const recalculated = this.computeHash(row.prev_hash, data);
      if (recalculated !== row.curr_hash) {
        return { valid: false, brokenAt: row.id, total: rows.length, reason: 'curr_hash mismatch (data tampered)' };
      }
      expectedPrev = row.curr_hash;
    }
    return { valid: true, brokenAt: null, total: rows.length };
  }

  /**
   * 获取审计日志列表（带可选过滤）
   */
  list({ limit = 100, offset = 0, table_name = null, user_id = null } = {}) {
    let sql = 'SELECT * FROM audit_logs';
    const params = [];
    const where = [];
    if (table_name) { where.push('table_name = ?'); params.push(table_name); }
    if (user_id) { where.push('user_id = ?'); params.push(user_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return this.db.prepare(sql).all(...params);
  }

  /**
   * 按 id 查一条
   */
  get(id) {
    return this.db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
  }

  /**
   * 安装 append-only 触发器
   * （必须单独调用，幂等）
   */
  installTriggers() {
    // 检查触发器是否已存在
    const exists = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='trigger' AND name IN ('audit_logs_no_update', 'audit_logs_no_delete')
    `).all();
    const names = exists.map(t => t.name);

    if (!names.includes('audit_logs_no_update')) {
      this.db.exec(`
        CREATE TRIGGER audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is forbidden (CNAS compliance)');
        END
      `);
      console.log('[AUDIT-CHAIN] Installed trigger: audit_logs_no_update');
    }
    if (!names.includes('audit_logs_no_delete')) {
      this.db.exec(`
        CREATE TRIGGER audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is forbidden (CNAS compliance)');
        END
      `);
      console.log('[AUDIT-CHAIN] Installed trigger: audit_logs_no_delete');
    }
  }
}

function safeJSONParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

module.exports = { AuditChain, GENESIS_HASH };

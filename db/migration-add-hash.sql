-- ===================================================================
-- P0-2: SHA256 审计链迁移
-- 2026-08-03 CNAS 改造
--
-- 作用:
-- 1. 添加 prev_hash 和 curr_hash 列
-- 2. 安装 append-only 触发器
-- ===================================================================

-- 1. 添加列（SQLite 12+ 支持 IF NOT EXISTS 写法，但 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS）
-- 使用 PRAGMA table_info 检查后再添加
ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE audit_logs ADD COLUMN curr_hash TEXT;

-- 2. 安装 append-only 触发器
CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is forbidden (CNAS compliance)');
END;

CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is forbidden (CNAS compliance)');
END;

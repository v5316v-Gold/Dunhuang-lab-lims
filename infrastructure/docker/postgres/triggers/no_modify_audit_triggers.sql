-- =====================================================
-- Phase 0.5 Task C — audit_logs 防篡改保障
-- 详见 ADR-0003:audit_logs append-only
--
-- 设计:三层防护,任何 DML/DDL 改 audit_logs 全部 RAISE EXCEPTION
--   1. prevent_audit_modification() BEFORE UPDATE/DELETE — 拦截 row-level DML
--   2. prevent_audit_truncate()   BEFORE TRUNCATE      — 拦截 table-level DDL
--   3. 挂到 audit_logs 表
--   4. 幂等:CREATE OR REPLACE + DROP TRIGGER IF EXISTS
--
-- 执行:psql ... -f no_modify_audit_triggers.sql
-- =====================================================

SET search_path = public;

-- ---------- 1. 防 row-level DML 篡改 ----------
CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs 是 append-only,禁止 UPDATE/DELETE 操作(ID: %, OP: %)',
    COALESCE(OLD.id, NEW.id), TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_audit_modification IS '阻止 audit_logs UPDATE/DELETE(row-level)';

-- ---------- 2. 防 table-level TRUNCATE ----------
CREATE OR REPLACE FUNCTION prevent_audit_truncate() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs 是 append-only,禁止 TRUNCATE 操作'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_audit_truncate IS '阻止 audit_logs TRUNCATE(table-level)';

-- ---------- 3. 挂 trigger 到 audit_logs ----------
DROP TRIGGER IF EXISTS trg_prevent_audit_modification ON audit_logs;
CREATE TRIGGER trg_prevent_audit_modification
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON audit_logs;
CREATE TRIGGER trg_prevent_audit_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_truncate();

DO $$
BEGIN
  RAISE NOTICE 'Phase 0.5 Task C: 已挂 audit_logs 防篡改 trigger (UPDATE/DELETE/TRUNCATE 三层)';
END $$;

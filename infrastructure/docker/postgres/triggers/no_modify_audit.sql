-- =====================================================
-- 禁止直接修改 audit_logs - 触发器
-- 详见 ADR-0003
-- =====================================================

SET search_path = public;

CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs 是 append-only,禁止 UPDATE/DELETE 操作(ID: %, OP: %)',
    COALESCE(OLD.id, NEW.id), TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_audit_modification IS '阻止 audit_logs UPDATE/DELETE,确保审计日志不可篡改';

DO $$
BEGIN
  RAISE NOTICE '审计链防篡改触发器函数已创建';
END $$;
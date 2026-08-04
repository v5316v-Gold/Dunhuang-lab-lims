-- =====================================================
-- 审计链 SHA256 - PostgreSQL 触发器
-- 详见 ADR-0003:审计链 = PG 触发器(非应用层)
--
-- 原理:
--   1. compute_audit_hash() 计算 SHA256(prev_hash + 当前记录)
--   2. audit_trigger() 是通用触发器,所有关键业务表挂载它
--   3. 应用层通过 SET LOCAL app.current_user_id / app.current_username
--      把当前用户塞进 PG session
--   4. 每条业务 INSERT/UPDATE/DELETE → 自动 audit_logs +1 条
--   5. SHA256 链式结构:任一节点修改必断链
-- =====================================================

-- 设置 search_path
SET search_path = public;

-- ---------- 1. SHA256 计算函数 ----------
-- 注意: STABLE 而非 IMMUTABLE
-- 因为依赖 current_setting('app.current_user_id') 和 now()
CREATE OR REPLACE FUNCTION compute_audit_hash(
  p_prev_hash TEXT,
  p_user_id   TEXT,
  p_username  TEXT,
  p_action    TEXT,
  p_table_name TEXT,
  p_record_id TEXT,
  p_new_data  JSONB,
  p_created_at TIMESTAMPTZ
) RETURNS TEXT AS $$
DECLARE
  v_concat TEXT;
BEGIN
  v_concat :=
    COALESCE(p_prev_hash, '0000000000000000000000000000000000000000000000000000000000000000')
    || '|' || COALESCE(p_user_id, 'null')
    || '|' || COALESCE(p_username, 'null')
    || '|' || COALESCE(p_action, '')
    || '|' || COALESCE(p_table_name, '')
    || '|' || COALESCE(p_record_id, '')
    || '|' || COALESCE(p_new_data::TEXT, '')
    || '|' || p_created_at::TEXT;

  RETURN encode(digest(v_concat, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION compute_audit_hash IS 'SHA256 计算函数:输入上一节点哈希+当前记录,输出当前哈希';

-- ---------- 2. 通用审计触发器函数 ----------
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash   TEXT;
  v_curr_hash   TEXT;
  v_user_id     TEXT;
  v_username    TEXT;
  v_action      TEXT;
  v_table       TEXT;
  v_record_id   TEXT;
  v_new_data    JSONB;
  v_created_at  TIMESTAMPTZ := now();
BEGIN
  -- 从 PG session 变量取当前用户
  -- 默认 'system' 表示系统级操作(如 Prisma migration)
  BEGIN
    v_user_id := NULLIF(current_setting('app.current_user_id', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  BEGIN
    v_username := COALESCE(NULLIF(current_setting('app.current_username', true), ''), 'system');
  EXCEPTION WHEN OTHERS THEN
    v_username := 'system';
  END;

  -- 取上一条 audit_logs 的 curr_hash(全表最新)
  SELECT curr_hash INTO v_prev_hash
  FROM audit_logs
  ORDER BY id DESC
  LIMIT 1;

  -- 若没有上一条,初始化为全零
  IF v_prev_hash IS NULL THEN
    v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;

  v_table := TG_TABLE_NAME;
  v_record_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT);

  -- 构造 action: TG_OP:TG_TABLE_NAME
  v_action := TG_OP || ':' || v_table;

  -- 收集数据
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_new_data := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF TG_OP = 'DELETE' THEN
    v_new_data := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- 计算当前哈希
  v_curr_hash := compute_audit_hash(
    v_prev_hash, v_user_id, v_username, v_action, v_table, v_record_id, v_new_data, v_created_at
  );

  -- 写入 audit_logs
  INSERT INTO audit_logs (
    user_id, username, action, table_name, record_id,
    new_data, prev_hash, curr_hash, created_at
  ) VALUES (
    v_user_id, v_username, v_action, v_table, v_record_id,
    v_new_data, v_prev_hash, v_curr_hash, v_created_at
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit_trigger IS '通用审计触发器:任意关键业务表挂载,自动写入 SHA256 链';

-- 输出启动信息
DO $$
BEGIN
  RAISE NOTICE '审计链 SHA256 触发器函数已创建(详见 ADR-0003)';
END $$;
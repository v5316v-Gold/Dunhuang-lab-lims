-- =====================================================
-- TimescaleDB 时序扩展
-- 详见 ADR-0002 / Phase 1 文档
-- =====================================================

SET search_path = public;

-- 创建 QC 测量时序表(hypertable)
-- 注意:Prisma migrate 后由 Prisma 管理;此处为备份 / 直接 SQL 用法
CREATE TABLE IF NOT EXISTS qc_measurements (
  time         TIMESTAMPTZ NOT NULL,
  element      TEXT        NOT NULL,
  method       TEXT        NOT NULL,
  operator_id  UUID,
  z_score      DECIMAL(8,4),
  measured     DECIMAL(15,9),
  expected     DECIMAL(15,9),
  sd           DECIMAL(15,9),
  westgard_rule TEXT,
  passed       BOOLEAN
);

-- 转为 hypertable(若未转换)
SELECT create_hypertable(
  'qc_measurements',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '7 days'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_qc_measurements_element
  ON qc_measurements (element, time DESC);
CREATE INDEX IF NOT EXISTS idx_qc_measurements_method
  ON qc_measurements (method, time DESC);

-- 创建设备日志 hypertable
CREATE TABLE IF NOT EXISTS equipment_logs (
  time         TIMESTAMPTZ NOT NULL,
  equipment_id UUID        NOT NULL,
  event_type   TEXT        NOT NULL,
  message      TEXT,
  metadata     JSONB
);

SELECT create_hypertable(
  'equipment_logs',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_equipment
  ON equipment_logs (equipment_id, time DESC);

DO $$
BEGIN
  RAISE NOTICE 'TimescaleDB hypertable 已创建(qc_measurements, equipment_logs)';
END $$;
-- ==========================================================
-- Phase 0.5 P0-Fix-1: SOP / 期间核查 / 设备校准字段补齐
-- 日期: 2026-08-16
-- 目的: 修复 feat/cnas-hardening 分支引用的新字段/表缺失
-- 影响:
--   - equipment: 新增 code, next_calibration_at, next_periodic_check_at
--   - periodic_checks: 新增 equipment_name, scheduled_date, submitted_at,
--                      operator_id, template, checks_json, results_json,
--                      westgard_violations, status
--   - reference_materials: 新增 remaining_g, status 扩展
--   - 新增 sop_executions / sop_step_executions 表
--   - Sample / User 加反向关系
-- ==========================================================

-- ---------- 1. equipment: 加 code + 校准/核查到期 ----------
ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- 历史数据回填:code 默认与 equipmentNo 相同
UPDATE equipment SET code = equipment_no WHERE code IS NULL;

-- 设为 NOT NULL + UNIQUE(分两步,先 unique 再 not null,避免一次性失败)
CREATE UNIQUE INDEX IF NOT EXISTS equipment_code_unique ON equipment(code);

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS next_calibration_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_periodic_check_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS equipment_next_calibration_at_idx ON equipment(next_calibration_at);
CREATE INDEX IF NOT EXISTS equipment_next_periodic_check_at_idx ON equipment(next_periodic_check_at);

-- ---------- 2. periodic_checks: 扩展字段 ----------
ALTER TABLE periodic_checks
    ADD COLUMN IF NOT EXISTS equipment_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scheduled_date DATE,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS operator_id UUID,
    ADD COLUMN IF NOT EXISTS template VARCHAR(50),
    ADD COLUMN IF NOT EXISTS checks_json JSONB,
    ADD COLUMN IF NOT EXISTS results_json JSONB,
    ADD COLUMN IF NOT EXISTS westgard_violations JSONB,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- 历史数据回填
UPDATE periodic_checks
SET equipment_name = e.name,
    status = CASE WHEN passed THEN 'PASSED' ELSE 'FAILED' END
FROM equipment e
WHERE periodic_checks.equipment_id = e.id
  AND periodic_checks.equipment_name IS NULL;

-- operator_id 默认等于 performed_by
UPDATE periodic_checks
SET operator_id = performed_by
WHERE operator_id IS NULL;

-- 让 status NOT NULL(先填好再 not null)
ALTER TABLE periodic_checks
    ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE periodic_checks
    ALTER COLUMN equipment_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS periodic_checks_scheduled_date_idx ON periodic_checks(scheduled_date);
CREATE INDEX IF NOT EXISTS periodic_checks_status_idx ON periodic_checks(status);

-- ---------- 3. reference_materials: 扩展字段 ----------
ALTER TABLE reference_materials
    ADD COLUMN IF NOT EXISTS remaining_g DECIMAL(15, 6);

CREATE INDEX IF NOT EXISTS reference_materials_status_expiry_idx
    ON reference_materials(status, expiry_date);

-- ---------- 4. 新增 sop_executions 表 ----------
CREATE TYPE sop_execution_status AS ENUM ('in_progress', 'completed', 'cancelled', 'failed');

CREATE TABLE IF NOT EXISTS sop_executions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id       UUID NOT NULL,
    batch_id        UUID NOT NULL,
    sop_code        VARCHAR(50) NOT NULL,
    sop_version     VARCHAR(20) NOT NULL,
    operator_id     UUID NOT NULL,
    current_step    INTEGER NOT NULL DEFAULT 1,
    total_steps     INTEGER NOT NULL,
    status          sop_execution_status NOT NULL DEFAULT 'in_progress',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,

    CONSTRAINT sop_executions_sample_fk FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE,
    CONSTRAINT sop_executions_operator_fk FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS sop_executions_sample_id_idx ON sop_executions(sample_id);
CREATE INDEX IF NOT EXISTS sop_executions_batch_id_idx ON sop_executions(batch_id);
CREATE INDEX IF NOT EXISTS sop_executions_operator_id_idx ON sop_executions(operator_id);
CREATE INDEX IF NOT EXISTS sop_executions_sop_code_idx ON sop_executions(sop_code);
CREATE INDEX IF NOT EXISTS sop_executions_status_idx ON sop_executions(status);

-- ---------- 5. 新增 sop_step_executions 表 ----------
CREATE TABLE IF NOT EXISTS sop_step_executions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sop_execution_id  UUID NOT NULL,
    step_order        INTEGER NOT NULL,
    step_code         VARCHAR(50) NOT NULL,
    step_name         VARCHAR(100) NOT NULL,
    params_json       JSONB NOT NULL,
    operator_id       UUID NOT NULL,
    completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sop_step_executions_execution_fk FOREIGN KEY (sop_execution_id)
        REFERENCES sop_executions(id) ON DELETE CASCADE,
    CONSTRAINT sop_step_executions_operator_fk FOREIGN KEY (operator_id)
        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS sop_step_executions_sop_execution_id_idx ON sop_step_executions(sop_execution_id);
CREATE INDEX IF NOT EXISTS sop_step_executions_step_code_idx ON sop_step_executions(step_code);

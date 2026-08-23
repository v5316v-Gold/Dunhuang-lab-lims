-- =====================================================
-- W1 架构框架增量 — SoD 互斥 + 授权签字人 + 留样期 + 事件幂等 + 扫码审计
-- 2026-08-25 开工:评审组通过框架代码改进,数据迁移/老数据回填留待后续
-- =====================================================

-- 1. FireAssayDetail 工艺字段独立化(混料/熔融/灰吹/分金/退火 9 步独立)
-- 老字段 furnace_temp_c/cupellation_min/parting_min/annealing_min 保留(兼容性)
ALTER TABLE "fire_assay_details" ADD COLUMN "annealing_temp_c" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "cupellation_duration_min" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "cupellation_temp_c" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "fusing_duration_min" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "fusing_temp_c" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "mixing_duration_min" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "mixing_temp_c" DECIMAL(8,2);
ALTER TABLE "fire_assay_details" ADD COLUMN "parting_duration_min" DECIMAL(8,2);

-- 2. Report 加 5 个签名人字段(CNAS-CL01:2018 §7.8.4 SoD 互斥)
ALTER TABLE "reports" ADD COLUMN "submitter_id" UUID;
ALTER TABLE "reports" ADD COLUMN "reviewer_id" UUID;
ALTER TABLE "reports" ADD COLUMN "approver_id" UUID;
ALTER TABLE "reports" ADD COLUMN "authorizer_id" UUID;
ALTER TABLE "reports" ADD COLUMN "issuer_id" UUID;

-- 3. Report 签名人 FK
ALTER TABLE "reports" ADD CONSTRAINT "reports_submitter_id_fkey"
  FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_approver_id_fkey"
  FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_authorizer_id_fkey"
  FOREIGN KEY ("authorizer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_issuer_id_fkey"
  FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 授权签字人名录(CNAS-CL01:2018 §7.5.3)
CREATE TABLE "authorized_signatories" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "methods" TEXT[],
  "sample_types" TEXT[],
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "approved_by_id" UUID NOT NULL,
  "approval_doc_file_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "authorized_signatories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "authorized_signatories_user_id_is_active_idx"
  ON "authorized_signatories"("user_id", "is_active");
CREATE INDEX "authorized_signatories_active_window_idx"
  ON "authorized_signatories"("is_active", "effective_from", "effective_to");

ALTER TABLE "authorized_signatories"
  ADD CONSTRAINT "authorized_signatories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorized_signatories"
  ADD CONSTRAINT "authorized_signatories_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorized_signatories"
  ADD CONSTRAINT "authorized_signatories_approval_doc_file_id_fkey"
  FOREIGN KEY ("approval_doc_file_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. SoD 互斥策略(可配置 STRICT/RELAXED)
CREATE TABLE "sod_policies" (
  "id" UUID NOT NULL,
  "apply_to_sample_types" TEXT[],
  "mode" TEXT NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "approved_by_id" UUID NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sod_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sod_policies_active_window_idx"
  ON "sod_policies"("effective_from", "effective_to");

ALTER TABLE "sod_policies"
  ADD CONSTRAINT "sod_policies_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. 留样/记录保存期(CNAS-CL01 §7.5.2 可配置)
CREATE TABLE "retention_policies" (
  "id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "retention_months" INTEGER NOT NULL,
  "archive_after_months" INTEGER NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "approved_by_id" UUID NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retention_policies_entity_type_key"
  ON "retention_policies"("entity_type");
CREATE INDEX "retention_policies_active_window_idx"
  ON "retention_policies"("entity_type", "effective_from", "effective_to");

ALTER TABLE "retention_policies"
  ADD CONSTRAINT "retention_policies_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. 事件幂等(防止 qc.failed 等副作用重复触发)
CREATE TABLE "processed_events" (
  "id" BIGSERIAL NOT NULL,
  "event_id" UUID NOT NULL,
  "event_name" VARCHAR(100) NOT NULL,
  "listener_name" VARCHAR(100) NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processed_events_event_id_key" ON "processed_events"("event_id");
CREATE INDEX "processed_events_event_name_processed_at_idx"
  ON "processed_events"("event_name", "processed_at");

-- 8. 扫码审计(QR 设备操作记录)
CREATE TABLE "scan_logs" (
  "id" BIGSERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "entity" VARCHAR(50) NOT NULL,
  "entity_id" UUID NOT NULL,
  "ip" VARCHAR(64),
  "user_agent" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_logs_user_id_created_at_idx" ON "scan_logs"("user_id", "created_at");
CREATE INDEX "scan_logs_entity_entity_id_idx" ON "scan_logs"("entity", "entity_id");

ALTER TABLE "scan_logs"
  ADD CONSTRAINT "scan_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

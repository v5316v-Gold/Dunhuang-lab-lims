-- W4-interaction: QC 测量作废字段(数据保留,ALCOA+)
ALTER TABLE "qc_measurements" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMPTZ;
ALTER TABLE "qc_measurements" ADD COLUMN IF NOT EXISTS "void_reason" VARCHAR(500);

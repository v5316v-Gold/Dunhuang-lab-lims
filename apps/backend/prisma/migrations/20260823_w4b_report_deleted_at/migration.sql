-- W4-interaction: 报告草稿软删字段
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

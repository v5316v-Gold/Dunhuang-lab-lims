-- W4-B 原始记录单表(CNAS-CL01:2018 §7.5 记录控制)
CREATE TABLE "raw_record_sheets" (
  "id" UUID NOT NULL,
  "sheet_no" VARCHAR(30) NOT NULL,
  "test_id" UUID,
  "sample_id" UUID NOT NULL,
  "method" VARCHAR(50) NOT NULL,
  "data_json" JSONB NOT NULL,
  "operator_id" UUID,
  "reviewer_id" UUID,
  "approver_id" UUID,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "pdf_file_id" UUID,
  "pdf_sha256" CHAR(64),
  "locked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "raw_record_sheets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "raw_record_sheets_sheet_no_key" ON "raw_record_sheets"("sheet_no");
CREATE INDEX "raw_record_sheets_sample_id_idx" ON "raw_record_sheets"("sample_id");
CREATE INDEX "raw_record_sheets_test_id_idx" ON "raw_record_sheets"("test_id");

ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_sample_id_fkey"
  FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_test_id_fkey"
  FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_approver_id_fkey"
  FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_record_sheets" ADD CONSTRAINT "raw_record_sheets_pdf_file_id_fkey"
  FOREIGN KEY ("pdf_file_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

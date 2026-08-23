-- =====================================================
-- W3-A 飞书多维表格导入框架 — 6 张新表 + 枚举
-- 2026-08-23 基于 GDW实验室管理.xlsx 22 张表真实字段
-- =====================================================

-- 1. 导入实体类型枚举(22 个)
CREATE TYPE "ImportEntityType" AS ENUM ('STAFF', 'SAMPLE_WORKSHOP', 'SAMPLE_OVERSEAS', 'SAMPLE_INBOUND', 'SAMPLE_OUTBOUND', 'SAMPLE_INVENTORY', 'TEST_RECEIPT_DOMESTIC', 'TEST_RECEIPT_OVERSEAS', 'TEST_RECORD_DOMESTIC', 'TEST_RECORD_OVERSEAS', 'CONTAINER', 'GAS_PURCHASE', 'GAS_USAGE', 'GAS_INVENTORY', 'REAGENT_INBOUND', 'REAGENT_OUTBOUND', 'REAGENT_INVENTORY', 'REAGENT_USAGE', 'EQUIPMENT', 'EQUIPMENT_CALIBRATION', 'EQUIPMENT_MAINTENANCE', 'WASTE_RECORD');

-- 2. 导入批次
CREATE TABLE "import_batches" (
  "id" UUID NOT NULL,
  "entity_type" "ImportEntityType" NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "storage_path" VARCHAR(500),
  "total_rows" INTEGER NOT NULL,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMPTZ,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_batches_entity_type_created_at_idx" ON "import_batches"("entity_type", "created_at");

-- 3. 导入批次明细
CREATE TABLE "import_batch_details" (
  "id" BIGSERIAL NOT NULL,
  "batch_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "parsed_json" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "error_json" JSONB,
  "created_id" UUID,
  CONSTRAINT "import_batch_details_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_batch_details_batch_id_idx" ON "import_batch_details"("batch_id");

-- 4. 自定义列映射模板
CREATE TABLE "import_column_mappings" (
  "id" UUID NOT NULL,
  "entity_type" "ImportEntityType" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "mappings" JSONB NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_column_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_column_mappings_entity_type_name_key" ON "import_column_mappings"("entity_type", "name");

-- 5. 库存事务(入库/出库/盘点)
CREATE TABLE "inventory_transactions" (
  "id" UUID NOT NULL,
  "sample_id" UUID NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "quantity" DECIMAL(15,6) NOT NULL,
  "destination" VARCHAR(200),
  "reason" TEXT,
  "ref_type" VARCHAR(50),
  "operator_id" UUID,
  "reviewer_id" UUID,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_transactions_sample_id_occurred_at_idx" ON "inventory_transactions"("sample_id", "occurred_at");
CREATE INDEX "inventory_transactions_type_occurred_at_idx" ON "inventory_transactions"("type", "occurred_at");

-- 6. 检测参与人员(多对多)
CREATE TABLE "test_participants" (
  "id" BIGSERIAL NOT NULL,
  "test_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" VARCHAR(20) NOT NULL DEFAULT 'PARTICIPANT',
  CONSTRAINT "test_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "test_participants_test_id_user_id_key" ON "test_participants"("test_id", "user_id");

-- 7. 实体关联附件(照片/PDF)
CREATE TABLE "entity_attachments" (
  "id" BIGSERIAL NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "role" VARCHAR(50),
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entity_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "entity_attachments_entity_type_entity_id_idx" ON "entity_attachments"("entity_type", "entity_id");
CREATE INDEX "entity_attachments_file_id_idx" ON "entity_attachments"("file_id");

-- 8. 外键
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batch_details" ADD CONSTRAINT "import_batch_details_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_column_mappings" ADD CONSTRAINT "import_column_mappings_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_sample_id_fkey"
  FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "test_participants" ADD CONSTRAINT "test_participants_test_id_fkey"
  FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_participants" ADD CONSTRAINT "test_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entity_attachments" ADD CONSTRAINT "entity_attachments_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "file_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entity_attachments" ADD CONSTRAINT "entity_attachments_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

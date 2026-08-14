-- =====================================================
-- W1 废料管理(WasteRecord + 3 enum)
-- 注意: sample_no_sequences 表未在 Prisma schema 中管理(由触发器/seed 维护)
-- 本 migration 不动该表,避免误删
-- =====================================================

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('WASTE_LIQUID', 'WASTE_SOLID', 'WASTE_GOLD_BEARING', 'WASTE_REAGENT', 'CONTAMINATED_SAMPLE', 'OTHER');

-- CreateEnum
CREATE TYPE "WasteHazardClass" AS ENUM ('HW34', 'HW29', 'HW37', 'HW35', 'GENERIC_HAZARDOUS', 'NON_HAZARDOUS');

-- CreateEnum
CREATE TYPE "WasteStatus" AS ENUM ('STORED', 'TRANSFERRED', 'INCINERATED', 'RECYCLED_GOLD', 'NEUTRALIZED', 'DISPOSED', 'REJECTED');

-- CreateTable
CREATE TABLE "waste_records" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "type" "WasteType" NOT NULL,
    "hazard_class" "WasteHazardClass" NOT NULL,
    "hazard_desc" VARCHAR(500),
    "source_type" VARCHAR(50) NOT NULL,
    "source_test_id" UUID,
    "source_sample_id" UUID,
    "weight_kg" DECIMAL(15,6) NOT NULL,
    "volume_l" DECIMAL(15,6),
    "container_count" INTEGER NOT NULL DEFAULT 1,
    "container_type" VARCHAR(50),
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_location" VARCHAR(200) NOT NULL,
    "hazard_manager_id" UUID,
    "status" "WasteStatus" NOT NULL DEFAULT 'STORED',
    "transferred_at" TIMESTAMPTZ,
    "receiver_name" VARCHAR(200),
    "receiver_licence_no" VARCHAR(100),
    "transfer_manifest_no" VARCHAR(100),
    "transfer_manifest_file_id" UUID,
    "disposal_at" TIMESTAMPTZ,
    "disposal_method" VARCHAR(200),
    "recovered_gold_weight_g" DECIMAL(15,6),
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "waste_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waste_records_code_key" ON "waste_records"("code");

-- CreateIndex
CREATE INDEX "waste_records_code_idx" ON "waste_records"("code");

-- CreateIndex
CREATE INDEX "waste_records_type_idx" ON "waste_records"("type");

-- CreateIndex
CREATE INDEX "waste_records_hazard_class_idx" ON "waste_records"("hazard_class");

-- CreateIndex
CREATE INDEX "waste_records_status_idx" ON "waste_records"("status");

-- CreateIndex
CREATE INDEX "waste_records_generated_at_idx" ON "waste_records"("generated_at" DESC);

-- CreateIndex
CREATE INDEX "waste_records_hazard_manager_id_idx" ON "waste_records"("hazard_manager_id");


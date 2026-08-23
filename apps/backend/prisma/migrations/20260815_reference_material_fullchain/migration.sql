-- =====================================================
-- Phase 1B P0-B:标准物质全链路(CNAS §7.6)
-- 字段增强 + ReferenceMaterialUsage 台账
-- =====================================================

-- AlterTable
ALTER TABLE "reference_materials" ADD COLUMN     "is_crm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "next_verification_date" DATE,
ADD COLUMN     "sha256_cert" CHAR(64),
ADD COLUMN     "standard_u" DECIMAL(15,9),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "storage_location" VARCHAR(100),
ADD COLUMN     "storage_temp" VARCHAR(50),
ADD COLUMN     "verification_method" VARCHAR(50);

-- CreateTable
CREATE TABLE "reference_material_usages" (
    "id" UUID NOT NULL,
    "usage_no" VARCHAR(50) NOT NULL,
    "reference_material_id" UUID NOT NULL,
    "lot_no" VARCHAR(50) NOT NULL,
    "test_id" UUID,
    "qc_measurement_id" UUID,
    "element_result_id" UUID,
    "uncertainty_report_id" UUID,
    "purpose" VARCHAR(50) NOT NULL,
    "used_amount" DECIMAL(15,6) NOT NULL,
    "remaining_amount" DECIMAL(15,6) NOT NULL,
    "used_by_id" UUID NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recovery_pct" DECIMAL(5,2),
    "certificate_file_id" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_material_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_material_usages_usage_no_key" ON "reference_material_usages"("usage_no");

-- CreateIndex
CREATE INDEX "reference_material_usages_usage_no_idx" ON "reference_material_usages"("usage_no");

-- CreateIndex
CREATE INDEX "reference_material_usages_reference_material_id_idx" ON "reference_material_usages"("reference_material_id");

-- CreateIndex
CREATE INDEX "reference_material_usages_test_id_idx" ON "reference_material_usages"("test_id");

-- CreateIndex
CREATE INDEX "reference_material_usages_qc_measurement_id_idx" ON "reference_material_usages"("qc_measurement_id");

-- CreateIndex
CREATE INDEX "reference_material_usages_element_result_id_idx" ON "reference_material_usages"("element_result_id");

-- CreateIndex
CREATE INDEX "reference_material_usages_uncertainty_report_id_idx" ON "reference_material_usages"("uncertainty_report_id");

-- CreateIndex
CREATE INDEX "reference_material_usages_used_at_idx" ON "reference_material_usages"("used_at" DESC);

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_reference_material_id_fkey" FOREIGN KEY ("reference_material_id") REFERENCES "reference_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_qc_measurement_id_fkey" FOREIGN KEY ("qc_measurement_id") REFERENCES "qc_measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_element_result_id_fkey" FOREIGN KEY ("element_result_id") REFERENCES "element_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- uncertainty_report_id FK 暂时移除(uncertainty_reports 表在后续 migration 才建),
-- 等所有 migration 完成后通过新修复 migration 单独补这个 FK
-- ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_uncertainty_report_id_fkey" FOREIGN KEY ("uncertainty_report_id") REFERENCES "uncertainty_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_material_usages" ADD CONSTRAINT "reference_material_usages_certificate_file_id_fkey" FOREIGN KEY ("certificate_file_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


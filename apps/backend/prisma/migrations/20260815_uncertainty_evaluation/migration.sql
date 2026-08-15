-- =====================================================
-- Phase 1B P0-A:测量不确定度(MU)评定模块(CNAS §7.8)
-- GUM JCGM 100:2008 5 类分量 + k=2 扩展
-- =====================================================

-- CreateEnum
CREATE TYPE "uncertainty_report_status" AS ENUM ('draft', 'reviewed', 'published', 'voided');

-- CreateTable
CREATE TABLE "uncertainty_reports" (
    "id" UUID NOT NULL,
    "reportNo" VARCHAR(50) NOT NULL,
    "test_id" UUID NOT NULL,
    "status" "uncertainty_report_status" NOT NULL DEFAULT 'draft',
    "measured_value" DECIMAL(15,6) NOT NULL,
    "combined_u" DECIMAL(15,9) NOT NULL,
    "expanded_u" DECIMAL(15,9) NOT NULL,
    "coverage_factor" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    "coverage_prob" DECIMAL(5,2) NOT NULL DEFAULT 95.00,
    "uc_type_a" DECIMAL(15,9),
    "uc_type_b_std" DECIMAL(15,9),
    "uc_type_b_equip" DECIMAL(15,9),
    "uc_type_b_vol" DECIMAL(15,9),
    "uc_type_b_env" DECIMAL(15,9),
    "uc_type_b_other" DECIMAL(15,9),
    "parallel_runs" JSONB,
    "method" VARCHAR(50) NOT NULL DEFAULT 'GUM_JCGM_100',
    "method_description" TEXT,
    "reference_material_id" UUID,
    "equipment_ids" UUID[],
    "calibration_ids" UUID[],
    "calculation_file_id" UUID,
    "calculated_by_id" UUID NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ,
    "formula_snapshot" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "uncertainty_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uncertainty_reports_reportNo_key" ON "uncertainty_reports"("reportNo");

-- CreateIndex
CREATE UNIQUE INDEX "uncertainty_reports_test_id_key" ON "uncertainty_reports"("test_id");

-- CreateIndex
CREATE INDEX "uncertainty_reports_reportNo_idx" ON "uncertainty_reports"("reportNo");

-- CreateIndex
CREATE INDEX "uncertainty_reports_test_id_idx" ON "uncertainty_reports"("test_id");

-- CreateIndex
CREATE INDEX "uncertainty_reports_status_idx" ON "uncertainty_reports"("status");

-- CreateIndex
CREATE INDEX "uncertainty_reports_calculated_at_idx" ON "uncertainty_reports"("calculated_at" DESC);

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_reference_material_id_fkey" FOREIGN KEY ("reference_material_id") REFERENCES "reference_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_calculated_by_id_fkey" FOREIGN KEY ("calculated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uncertainty_reports" ADD CONSTRAINT "uncertainty_reports_calculation_file_id_fkey" FOREIGN KEY ("calculation_file_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


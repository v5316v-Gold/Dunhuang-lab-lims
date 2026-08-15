-- =====================================================
-- Phase 1B P0-C: Westgard 自动应用 + OOS(CNAS §7.9/§7.10)
-- NonConformance 表 + 3 enum
-- =====================================================

-- CreateEnum
CREATE TYPE "non_conformance_type" AS ENUM ('oos_qc_failed', 'oos_result_failed', 'equipment_failure', 'method_deviation', 'sample_integrity', 'client_complaint', 'internal_audit', 'other');

-- CreateEnum
CREATE TYPE "non_conformance_status" AS ENUM ('open', 'investigating', 'capa_in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "non_conformance_severity" AS ENUM ('minor', 'major', 'critical');

-- CreateTable
CREATE TABLE "non_conformances" (
    "id" UUID NOT NULL,
    "ncNo" VARCHAR(50) NOT NULL,
    "type" "non_conformance_type" NOT NULL,
    "severity" "non_conformance_severity" NOT NULL DEFAULT 'minor',
    "status" "non_conformance_status" NOT NULL DEFAULT 'open',
    "qc_measurement_id" UUID,
    "test_id" UUID,
    "sample_id" UUID,
    "equipment_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "root_cause" TEXT,
    "immediate_action" TEXT,
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to_id" UUID,
    "investigated_by_id" UUID,
    "investigated_at" TIMESTAMPTZ,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ,
    "close_remarks" TEXT,
    "corrective_action" TEXT,
    "preventive_action" TEXT,
    "effectiveness_verification" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "non_conformances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "non_conformances_ncNo_key" ON "non_conformances"("ncNo");

-- CreateIndex
CREATE INDEX "non_conformances_ncNo_idx" ON "non_conformances"("ncNo");

-- CreateIndex
CREATE INDEX "non_conformances_type_idx" ON "non_conformances"("type");

-- CreateIndex
CREATE INDEX "non_conformances_status_idx" ON "non_conformances"("status");

-- CreateIndex
CREATE INDEX "non_conformances_severity_idx" ON "non_conformances"("severity");

-- CreateIndex
CREATE INDEX "non_conformances_reported_at_idx" ON "non_conformances"("reported_at" DESC);

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_qc_measurement_id_fkey" FOREIGN KEY ("qc_measurement_id") REFERENCES "qc_measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_investigated_by_id_fkey" FOREIGN KEY ("investigated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


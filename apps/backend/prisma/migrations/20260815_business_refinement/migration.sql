-- =====================================================
-- W4 业务精化(SamplingRecord + PreciousMetalBar)
-- CNAS §7.5 + §7.8(抽样) + §7.4(记录)
-- =====================================================

-- CreateEnum
CREATE TYPE "sampling_method" AS ENUM ('on_site', 'customer_delivered', 'express', 'court_seizure', 'production_line', 'other');

-- CreateEnum
CREATE TYPE "sampling_location" AS ENUM ('mine', 'refinery', 'bank', 'exchange', 'workshop', 'customer_office', 'lab', 'other');

-- CreateEnum
CREATE TYPE "sample_form" AS ENUM ('ingot', 'jewelry', 'powder', 'solution', 'wire', 'leaf', 'scrap', 'alloy', 'other');

-- CreateEnum
CREATE TYPE "metal_type" AS ENUM ('au', 'ag', 'pt', 'pd', 'rh', 'ir', 'os', 'ru');

-- CreateEnum
CREATE TYPE "bar_quality_grade" AS ENUM ('au9999', 'au999', 'au995', 'au990', 'au916', 'au750', 'au585', 'custom');

-- CreateTable
CREATE TABLE "sampling_records" (
    "id" UUID NOT NULL,
    "recordNo" VARCHAR(50) NOT NULL,
    "sample_id" UUID,
    "method" "sampling_method" NOT NULL,
    "location" "sampling_location" NOT NULL,
    "location_detail" VARCHAR(200),
    "sampled_at" TIMESTAMPTZ NOT NULL,
    "sampled_by_id" UUID NOT NULL,
    "customer_rep_name" VARCHAR(50),
    "customer_rep_id_no" VARCHAR(20),
    "witness_name" VARCHAR(50),
    "witness_id_no" VARCHAR(20),
    "sample_form" "sample_form" NOT NULL,
    "metal_type" "metal_type" NOT NULL,
    "declared_weight_g" DECIMAL(15,6),
    "declared_purity_pct" DECIMAL(10,6),
    "packaging_type" VARCHAR(50),
    "seal_no" VARCHAR(50),
    "photo_file_ids" UUID[],
    "chain_of_custody" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "sampling_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precious_metal_bars" (
    "id" UUID NOT NULL,
    "bar_code" VARCHAR(50) NOT NULL,
    "sample_id" UUID NOT NULL,
    "report_id" UUID,
    "metal_type" "metal_type" NOT NULL,
    "quality_grade" "bar_quality_grade" NOT NULL,
    "weight_g" DECIMAL(15,6) NOT NULL,
    "purity_pct" DECIMAL(10,6) NOT NULL,
    "serial_no" VARCHAR(50),
    "shape" VARCHAR(50),
    "dimensions" VARCHAR(100),
    "manufacturer" VARCHAR(100),
    "manufacture_date" TIMESTAMPTZ,
    "inspected_by_id" UUID,
    "inspected_at" TIMESTAMPTZ,
    "certified_at" TIMESTAMPTZ,
    "qr_code_url" VARCHAR(500),
    "custody_location" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "precious_metal_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sampling_records_recordNo_key" ON "sampling_records"("recordNo");

-- CreateIndex
CREATE UNIQUE INDEX "sampling_records_sample_id_key" ON "sampling_records"("sample_id");

-- CreateIndex
CREATE INDEX "sampling_records_recordNo_idx" ON "sampling_records"("recordNo");

-- CreateIndex
CREATE INDEX "sampling_records_sample_id_idx" ON "sampling_records"("sample_id");

-- CreateIndex
CREATE INDEX "sampling_records_sampled_at_idx" ON "sampling_records"("sampled_at" DESC);

-- CreateIndex
CREATE INDEX "sampling_records_method_idx" ON "sampling_records"("method");

-- CreateIndex
CREATE UNIQUE INDEX "precious_metal_bars_bar_code_key" ON "precious_metal_bars"("bar_code");

-- CreateIndex
CREATE UNIQUE INDEX "precious_metal_bars_sample_id_key" ON "precious_metal_bars"("sample_id");

-- CreateIndex
CREATE INDEX "precious_metal_bars_bar_code_idx" ON "precious_metal_bars"("bar_code");

-- CreateIndex
CREATE INDEX "precious_metal_bars_sample_id_idx" ON "precious_metal_bars"("sample_id");

-- CreateIndex
CREATE INDEX "precious_metal_bars_report_id_idx" ON "precious_metal_bars"("report_id");

-- CreateIndex
CREATE INDEX "precious_metal_bars_quality_grade_idx" ON "precious_metal_bars"("quality_grade");

-- CreateIndex
CREATE INDEX "precious_metal_bars_status_idx" ON "precious_metal_bars"("status");

-- AddForeignKey
ALTER TABLE "sampling_records" ADD CONSTRAINT "sampling_records_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sampling_records" ADD CONSTRAINT "sampling_records_sampled_by_id_fkey" FOREIGN KEY ("sampled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precious_metal_bars" ADD CONSTRAINT "precious_metal_bars_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precious_metal_bars" ADD CONSTRAINT "precious_metal_bars_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


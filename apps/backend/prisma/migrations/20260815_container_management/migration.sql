-- =====================================================
-- W3 容器管理(Container + ContainerUsage)
-- CNAS §7.5(设备与设施)+ §6.5(设备)
-- =====================================================

-- CreateEnum
CREATE TYPE "container_type" AS ENUM ('crucible', 'volumetric_flask', 'burette', 'beaker', 'test_tube', 'conical_flask', 'cylinder', 'pipette', 'weighing_bottle', 'other');

-- CreateEnum
CREATE TYPE "container_material" AS ENUM ('porcelain', 'platinum', 'quartz', 'borosilicate', 'ptfe', 'stainless_steel', 'polyethylene', 'other');

-- CreateEnum
CREATE TYPE "container_status" AS ENUM ('in_stock', 'in_use', 'cleaning', 'maintenance', 'retired', 'lost');

-- CreateTable
CREATE TABLE "containers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "container_type" NOT NULL,
    "material" "container_material" NOT NULL,
    "capacity_ml" DECIMAL(10,2),
    "tolerance_ml" DECIMAL(10,4),
    "tolerance_class" VARCHAR(10),
    "serial_no" VARCHAR(50),
    "manufacturer" VARCHAR(100),
    "purchase_date" TIMESTAMPTZ,
    "purchase_price" DECIMAL(10,2),
    "location" VARCHAR(100),
    "status" "container_status" NOT NULL DEFAULT 'in_stock',
    "responsible_user_id" UUID,
    "calibration_date" TIMESTAMPTZ,
    "next_cal_date" TIMESTAMPTZ,
    "retire_date" TIMESTAMPTZ,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_usages" (
    "id" UUID NOT NULL,
    "usage_no" VARCHAR(50) NOT NULL,
    "container_id" UUID NOT NULL,
    "used_by_id" UUID NOT NULL,
    "test_id" UUID,
    "sample_id" UUID,
    "purpose" VARCHAR(200),
    "borrowed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMPTZ,
    "condition_before" VARCHAR(50),
    "condition_after" VARCHAR(50),
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "container_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "containers_code_key" ON "containers"("code");

-- CreateIndex
CREATE INDEX "containers_code_idx" ON "containers"("code");

-- CreateIndex
CREATE INDEX "containers_type_idx" ON "containers"("type");

-- CreateIndex
CREATE INDEX "containers_material_idx" ON "containers"("material");

-- CreateIndex
CREATE INDEX "containers_status_idx" ON "containers"("status");

-- CreateIndex
CREATE INDEX "containers_next_cal_date_idx" ON "containers"("next_cal_date");

-- CreateIndex
CREATE UNIQUE INDEX "container_usages_usage_no_key" ON "container_usages"("usage_no");

-- CreateIndex
CREATE INDEX "container_usages_usage_no_idx" ON "container_usages"("usage_no");

-- CreateIndex
CREATE INDEX "container_usages_container_id_idx" ON "container_usages"("container_id");

-- CreateIndex
CREATE INDEX "container_usages_used_by_id_idx" ON "container_usages"("used_by_id");

-- CreateIndex
CREATE INDEX "container_usages_borrowed_at_idx" ON "container_usages"("borrowed_at" DESC);

-- CreateIndex
CREATE INDEX "container_usages_returned_at_idx" ON "container_usages"("returned_at");

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_usages" ADD CONSTRAINT "container_usages_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_usages" ADD CONSTRAINT "container_usages_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_usages" ADD CONSTRAINT "container_usages_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_usages" ADD CONSTRAINT "container_usages_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;


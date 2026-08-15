-- =====================================================
-- W2 气体管理(Gas + GasPurchase + GasUsage)
-- CNAS §7.5(设备与设施)+ §6.4(外部提供的产品与服务)
-- =====================================================

-- CreateEnum
CREATE TYPE "gas_type" AS ENUM ('argon', 'nitrogen', 'oxygen', 'hydrogen', 'helium', 'acetylene', 'compressed_air');

-- CreateEnum
CREATE TYPE "gas_unit" AS ENUM ('cylinder', 'm3', 'liter', 'kg');

-- CreateEnum
CREATE TYPE "gas_purchase_status" AS ENUM ('ordered', 'shipped', 'received', 'inspected', 'rejected', 'returned');

-- CreateTable
CREATE TABLE "gases" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "gas_type" NOT NULL,
    "purity" VARCHAR(20),
    "unit" "gas_unit" NOT NULL DEFAULT 'cylinder',
    "current_stock" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(15,4),
    "storage_location" VARCHAR(100),
    "hazard_level" VARCHAR(50),
    "msds_file_id" UUID,
    "inspection_cert_file_id" UUID,
    "responsible_user_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "gases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gas_purchases" (
    "id" UUID NOT NULL,
    "purchase_no" VARCHAR(50) NOT NULL,
    "gas_id" UUID NOT NULL,
    "supplier" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" "gas_unit" NOT NULL,
    "unit_price" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2),
    "order_date" TIMESTAMPTZ NOT NULL,
    "expected_date" TIMESTAMPTZ,
    "received_date" TIMESTAMPTZ,
    "inspected_by_id" UUID,
    "status" "gas_purchase_status" NOT NULL DEFAULT 'ordered',
    "batch_no" VARCHAR(100),
    "certificate_file_id" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "gas_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gas_usages" (
    "id" UUID NOT NULL,
    "usage_no" VARCHAR(50) NOT NULL,
    "gas_id" UUID NOT NULL,
    "purchase_id" UUID,
    "test_id" UUID,
    "used_by_id" UUID NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" "gas_unit" NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL,
    "purpose" VARCHAR(200),
    "sample_id" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "gas_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gases_code_key" ON "gases"("code");

-- CreateIndex
CREATE INDEX "gases_code_idx" ON "gases"("code");

-- CreateIndex
CREATE INDEX "gases_type_idx" ON "gases"("type");

-- CreateIndex
CREATE INDEX "gases_status_idx" ON "gases"("status");

-- CreateIndex
CREATE INDEX "gases_current_stock_idx" ON "gases"("current_stock");

-- CreateIndex
CREATE UNIQUE INDEX "gas_purchases_purchase_no_key" ON "gas_purchases"("purchase_no");

-- CreateIndex
CREATE INDEX "gas_purchases_purchase_no_idx" ON "gas_purchases"("purchase_no");

-- CreateIndex
CREATE INDEX "gas_purchases_gas_id_idx" ON "gas_purchases"("gas_id");

-- CreateIndex
CREATE INDEX "gas_purchases_status_idx" ON "gas_purchases"("status");

-- CreateIndex
CREATE INDEX "gas_purchases_order_date_idx" ON "gas_purchases"("order_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gas_usages_usage_no_key" ON "gas_usages"("usage_no");

-- CreateIndex
CREATE INDEX "gas_usages_usage_no_idx" ON "gas_usages"("usage_no");

-- CreateIndex
CREATE INDEX "gas_usages_gas_id_idx" ON "gas_usages"("gas_id");

-- CreateIndex
CREATE INDEX "gas_usages_used_by_id_idx" ON "gas_usages"("used_by_id");

-- CreateIndex
CREATE INDEX "gas_usages_used_at_idx" ON "gas_usages"("used_at" DESC);

-- AddForeignKey
ALTER TABLE "gases" ADD CONSTRAINT "gases_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_purchases" ADD CONSTRAINT "gas_purchases_gas_id_fkey" FOREIGN KEY ("gas_id") REFERENCES "gases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_purchases" ADD CONSTRAINT "gas_purchases_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_usages" ADD CONSTRAINT "gas_usages_gas_id_fkey" FOREIGN KEY ("gas_id") REFERENCES "gases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_usages" ADD CONSTRAINT "gas_usages_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "gas_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_usages" ADD CONSTRAINT "gas_usages_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_usages" ADD CONSTRAINT "gas_usages_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gas_usages" ADD CONSTRAINT "gas_usages_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;


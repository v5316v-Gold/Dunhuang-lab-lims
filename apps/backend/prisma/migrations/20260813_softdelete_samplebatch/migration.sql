-- =====================================================
-- Phase 0.5 Task E — sample_batches 软删除支持
-- 详见 ADR-0004 (软删除策略)
--
-- 设计:sample_batches 表增加 deleted_at 列(可空),
--      软删除时 UPDATE deleted_at = now() 而非 DELETE
--      Prisma client extension 自动给所有 find*/update 加上
--      where: { deletedAt: null } 过滤
-- 幂等:ALTER TABLE ADD COLUMN(无 IF NOT EXISTS 兼容旧 PG)
-- =====================================================

-- AlterTable
ALTER TABLE "sample_batches" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "sample_batches_deleted_at_idx" ON "sample_batches"("deleted_at");

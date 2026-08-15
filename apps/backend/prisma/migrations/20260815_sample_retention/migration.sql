-- =====================================================
-- W+1-10: 样品留样(CNAS §7.10 / CMA)
-- retentionUntil + archivedAt + disposedAt
-- =====================================================

-- AlterTable
ALTER TABLE "samples" ADD COLUMN     "archived_at" TIMESTAMPTZ,
ADD COLUMN     "disposed_at" TIMESTAMPTZ,
ADD COLUMN     "retention_until" TIMESTAMPTZ;


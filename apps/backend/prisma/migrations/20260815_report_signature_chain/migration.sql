-- =====================================================
-- Phase 1B P0-E:报告签字链路(CNAS §7.8/§7.11)
-- ReportStage.signedAt + signComment + ReportSignature 完整字段
-- =====================================================

-- AlterTable
ALTER TABLE "report_stages" ADD COLUMN     "sign_comment" TEXT,
ADD COLUMN     "signed_at" TIMESTAMPTZ;


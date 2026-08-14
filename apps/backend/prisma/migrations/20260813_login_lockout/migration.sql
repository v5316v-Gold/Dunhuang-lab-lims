-- =====================================================
-- Phase 1 Task 2.2 — 登录锁定支持 (users 表)
-- 设计: 连续登录失败计数 + 锁定截止时间
--   failed_login_count INTEGER DEFAULT 0
--   locked_until       TIMESTAMPTZ NULL
-- =====================================================

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ;

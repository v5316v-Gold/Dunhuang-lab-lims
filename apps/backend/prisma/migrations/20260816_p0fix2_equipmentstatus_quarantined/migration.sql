-- ==========================================================
-- Phase 0.5 P0-Fix-2 (TYPECHECK): 补 EquipmentStatus.QUARANTINED enum
-- 原因: P2-1 状态机用了 QUARANTINED 但 schema 没定义
-- 修复: tsc 28 个错误中的 4 个
-- ==========================================================

-- PG enum 加值(必须 IF NOT EXISTS 否则重复执行失败)
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'QUARANTINED';
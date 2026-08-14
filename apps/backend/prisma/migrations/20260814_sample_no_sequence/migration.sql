-- =====================================================
-- Phase 2 Task 2.1 — 样品编号序列表(并发安全)
-- 设计:
--   1. sample_no_sequences 按日期一行,SELECT ... FOR UPDATE 行锁
--   2. 事务内生成编号,避免"取最大+1"的并发竞态
--   3. 日期变化自动开启新序列
-- =====================================================

-- CreateTable
CREATE TABLE "sample_no_sequences" (
    "date_key" VARCHAR(10) NOT NULL,      -- YYYY-MM-DD(本地时区)
    "last_seq" INTEGER NOT NULL DEFAULT 0, -- 当日已用编号
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sample_no_sequences_pkey" PRIMARY KEY ("date_key")
);

-- 初始化今天(若不存在)
INSERT INTO "sample_no_sequences" ("date_key", "last_seq")
VALUES (to_char(CURRENT_DATE, 'YYYY-MM-DD'), 0)
ON CONFLICT ("date_key") DO NOTHING;

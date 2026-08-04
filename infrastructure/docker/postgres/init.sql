-- =====================================================
-- 敦煌金质检 LIMS - PostgreSQL 初始化
-- 在 docker-entrypoint-initdb.d/ 自动执行
-- =====================================================

-- 启用必需扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";        -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- 加密 / SHA256
CREATE EXTENSION IF NOT EXISTS "citext";           -- 不区分大小写文本

-- 启用 TimescaleDB(由镜像预装,这里保险起见再执行一次)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 设置时区(全库)
ALTER DATABASE dunhuang_lims SET timezone = 'Asia/Shanghai';

-- 设置默认字符集
ALTER DATABASE dunhuang_lims SET client_encoding = 'UTF8';
ALTER DATABASE dunhuang_lims SET lc_collate = 'en_US.UTF8';
ALTER DATABASE dunhuang_lims SET lc_ctype = 'en_US.UTF8';

-- 输出启动信息
DO $$
BEGIN
  RAISE NOTICE '敦煌金质检 LIMS - PostgreSQL initialized successfully';
  RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto, citext, timescaledb';
  RAISE NOTICE 'Timezone: Asia/Shanghai, Encoding: UTF8';
END $$;
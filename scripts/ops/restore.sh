#!/usr/bin/env bash
# =====================================================
# LIMS 数据库恢复脚本 — Phase 1 Task 2.5
# 用法:
#   ./scripts/ops/restore.sh <backup-file.dump> [target-db]
# 说明:
#   - 默认恢复到 dunhuang_lims_restore_test(不覆盖生产)
#   - 生产恢复请显式传目标库 + 确认
# =====================================================
set -euo pipefail

CONTAINER="${PG_CONTAINER:-dunhuang-pg}"
DB_USER="${PG_USER:-dunhuang}"
SOURCE_DB="${PG_NAME:-dunhuang_lims}"
TARGET_DB="${2:-dunhuang_lims_restore_test}"
BACKUP_FILE="${1:?用法: restore.sh <backup.dump> [target-db]}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[restore] 错误: 备份文件不存在: ${BACKUP_FILE}"
  exit 1
fi

echo "[restore] 目标: ${TARGET_DB} (源 ${SOURCE_DB})"

# 生产保护: 目标为生产库时需要显式确认
if [ "${TARGET_DB}" = "${SOURCE_DB}" ] && [ "${FORCE_RESTORE:-}" != "1" ]; then
  echo "[restore] 警告: 目标库=${SOURCE_DB} 是生产库!"
  echo "[restore] 如需覆盖生产,请设置 FORCE_RESTORE=1 再执行"
  exit 1
fi

# 1. 删除旧目标库(若存在)
docker exec "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD:-dunhuang_dev_pwd}" \
  psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};" > /dev/null

# 2. 创建新目标库
docker exec "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD:-dunhuang_dev_pwd}" \
  psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${TARGET_DB} OWNER ${DB_USER};" > /dev/null

# 3. 恢复
echo "[restore] 执行 pg_restore..."
docker exec -i "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD:-dunhuang_dev_pwd}" \
  pg_restore -U "${DB_USER}" -d "${TARGET_DB}" --no-owner --no-privileges \
  < "${BACKUP_FILE}"

# 4. 验证: 表数量
TABLES=$(docker exec "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD:-dunhuang_dev_pwd}" \
  psql -U "${DB_USER}" -d "${TARGET_DB}" -t -A -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
echo "[restore] 完成: ${TARGET_DB} 恢复 ${TABLES} 张表"
exit 0

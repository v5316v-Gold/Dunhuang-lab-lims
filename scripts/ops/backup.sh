#!/usr/bin/env bash
# =====================================================
# LIMS 数据库备份脚本 — Phase 1 Task 2.5 (CODE-EXECUTION-PLAN §2.5)
# 架构映射: L3 备份 3-2-1 / L6 BR-INF-02 / L8 每日自动检查
#
# 策略:
#   - 每日全量 pg_dump(自定义格式,容器内生成 → docker cp 导出)
#     (注: Windows git-bash 下 stdout 重定向会破坏二进制,故用容器内文件)
#   - 容器内校验归档完整性(pg_restore -l)
#   - 保留最近 14 份;退出码: 0=成功 1=备份失败 2=校验失败
#
# 用法:
#   ./scripts/ops/backup.sh                    # 备份到默认目录
#   BACKUP_DIR=/backup ./scripts/ops/backup.sh # 自定义目录
# =====================================================
set -euo pipefail

# ---------- 配置 ----------
CONTAINER="${PG_CONTAINER:-dunhuang-pg}"
DB_USER="${PG_USER:-dunhuang}"
DB_NAME="${PG_NAME:-dunhuang_lims}"
PG_PASSWORD="${PG_PASSWORD:-dunhuang_dev_pwd}"
BACKUP_DIR="${BACKUP_DIR:-/e/hermes/workspace/lims-master/project/Dunhuang-lab-lims-main/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE_DIR="${REMOTE_BACKUP_DIR:-}"   # 异地备份目录(可选,3-2-1 第 3 份)
CONTAINER_TMP="/tmp/lims-backup.dump"

# docker cp 需要 Windows 风格路径(git-bash 的 /e/... 会被误认为容器路径)
if command -v cygpath >/dev/null 2>&1; then
  HOST_BACKUP_DIR="$(cygpath -w "${BACKUP_DIR}")"
  HOST_REMOTE_DIR="${REMOTE_DIR:+$(cygpath -w "${REMOTE_DIR}")}"
else
  HOST_BACKUP_DIR="${BACKUP_DIR}"
  HOST_REMOTE_DIR="${REMOTE_DIR}"
fi

# ---------- 主流程 ----------
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/dunhuang_lims-${TS}.dump"
LOG_FILE="${BACKUP_DIR}/backup-${TS}.log"

mkdir -p "${BACKUP_DIR}"
echo "[backup] 开始: $(date -Is)" | tee "${LOG_FILE}"

# 1. 容器存在性检查
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[backup] 错误: 容器 ${CONTAINER} 未运行" | tee -a "${LOG_FILE}"
  exit 1
fi

# 2. 容器内生成全量备份(自定义格式)
echo "[backup] 容器内 pg_dump (${DB_NAME} @ ${CONTAINER})..." | tee -a "${LOG_FILE}"
docker exec "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD}" \
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc -f "${CONTAINER_TMP}" \
  >>"${LOG_FILE}" 2>&1

# 3. 容器内校验(pg_restore -l 只读)
echo "[backup] 容器内校验归档完整性..." | tee -a "${LOG_FILE}"
if ! docker exec "${CONTAINER}" \
  env PGPASSWORD="${PG_PASSWORD}" \
  pg_restore -l "${CONTAINER_TMP}" > /dev/null 2>>"${LOG_FILE}"; then
  echo "[backup] 错误: 归档校验失败" | tee -a "${LOG_FILE}"
  docker exec "${CONTAINER}" rm -f "${CONTAINER_TMP}"
  exit 2
fi

# 4. 导出到宿主机(docker cp,用 Windows 路径)
docker cp "${CONTAINER}:${CONTAINER_TMP}" "${HOST_BACKUP_DIR}/dunhuang_lims-${TS}.dump" >>"${LOG_FILE}" 2>&1
docker exec "${CONTAINER}" rm -f "${CONTAINER_TMP}"

SIZE="$(stat -c %s "${BACKUP_FILE}" 2>/dev/null || echo 0)"
if [ "${SIZE}" -lt 10240 ]; then
  echo "[backup] 错误: 备份文件过小 (${SIZE} bytes),疑似失败" | tee -a "${LOG_FILE}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi
echo "[backup] 备份完成: ${BACKUP_FILE} (${SIZE} bytes)" | tee -a "${LOG_FILE}"

# 5. 异地拷贝(可选)
if [ -n "${REMOTE_DIR}" ]; then
  mkdir -p "${REMOTE_DIR}"
  cp "${BACKUP_FILE}" "${REMOTE_DIR}/" 2>>"${LOG_FILE}"
  echo "[backup] 异地拷贝完成: ${REMOTE_DIR}" | tee -a "${LOG_FILE}"
fi

# 6. 清理过期备份
echo "[backup] 清理 ${KEEP_DAYS} 天前备份..." | tee -a "${LOG_FILE}"
find "${BACKUP_DIR}" -name "dunhuang_lims-*.dump" -mtime +"${KEEP_DAYS}" -delete 2>>"${LOG_FILE}"
echo "[backup] 完成: $(date -Is)" | tee -a "${LOG_FILE}"
exit 0

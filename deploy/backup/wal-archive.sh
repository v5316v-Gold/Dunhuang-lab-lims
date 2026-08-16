#!/usr/bin/env bash
# ============================================================
# PostgreSQL WAL 归档(PITR 增量)
# 详见 docs/05-DEPLOYMENT.md §备份策略
#
# 策略:每 15 分钟把 PG 容器内的 WAL 归档到备份目录
#      配合每日全量备份,可实现 PITR(Point-In-Time Recovery)
#
# 配置(在 postgres 容器内):
#   archive_mode = on
#   archive_command = '/usr/local/bin/wal-archive.sh %p %f'
#   或者通过 docker exec 拉取
#
# Cron 建议(每 15 分钟):
#   */15 * * * * /opt/dunhuang-lab-lims/deploy/backup/wal-archive.sh >> /var/log/lims-wal.log 2>&1
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dunhuang-lims/wal}"
WAL_CONTAINER="${WAL_CONTAINER:-dunhuang-pg-prod}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] WAL 归档..."

# 通过 docker exec 把当前 WAL 段拉到本地
# 注意:这是简化方案,生产应该用 archive_command + ssh
docker exec "$WAL_CONTAINER" \
    bash -c 'ls /var/lib/postgresql/data/pgdata/pg_wal/*.ready 2>/dev/null || true' | while read ready_file; do
    if [[ -n "$ready_file" ]]; then
        WAL_NAME=$(basename "$ready_file" .ready)
        WAL_SOURCE="/var/lib/postgresql/data/pgdata/pg_wal/$WAL_NAME"
        docker cp "$WAL_CONTAINER:$WAL_SOURCE" "$BACKUP_DIR/" 2>/dev/null || true
        # 标记已归档
        docker exec "$WAL_CONTAINER" touch "${WAL_SOURCE}.done" 2>/dev/null || true
        echo "  归档: $WAL_NAME ($(du -h "$BACKUP_DIR/$WAL_NAME" 2>/dev/null | cut -f1))"
    fi
done

# 清理超过 7 天的 WAL(全量备份已经覆盖)
find "$BACKUP_DIR" -name "0*" -mtime +7 -delete 2>/dev/null || true

echo "  当前 WAL 数:$(ls "$BACKUP_DIR" 2>/dev/null | wc -l)"
echo "  占用空间:$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"

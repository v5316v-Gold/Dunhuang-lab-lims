#!/usr/bin/env bash
# ============================================================
# PostgreSQL 全量备份 + 加密 + 归档
# 详见 docs/05-DEPLOYMENT.md §备份策略
#
# 策略:
#   - 每日 02:00 cron 执行
#   - pg_dump 自定义格式(-Fc),支持并行还原
#   - AES-256-CBC 加密(gpg)
#   - 本地保留 30 天
#   - 异地 rsync(可选)
#
# Cron 建议:
#   0 2 * * * /opt/dunhuang-lab-lims/deploy/backup/pg-full-backup.sh >> /var/log/lims-backup.log 2>&1
# ============================================================

set -euo pipefail

# ---------- 配置 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dunhuang-lims}"
REMOTE_DIR="${REMOTE_DIR:-}"   # 留空则不 rsync;设成 user@host:/path/ 则同步过去
RETENTION_DAYS="${RETENTION_DAYS:-30}"
GPG_RECIPIENT="${GPG_RECIPIENT:-lims-backup@dunhuang-lab.local}"   # gpg --gen-key 后填
PG_CONTAINER="${PG_CONTAINER:-dunhuang-pg-prod}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="pg_full_${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "============================================================"
echo "  PostgreSQL 全量备份"
echo "  时间: $(date -Iseconds)"
echo "  容器: $PG_CONTAINER"
echo "  目标: $BACKUP_FILE"
echo "============================================================"

# ---------- 1. 备份 ----------
echo "[1/4] 导出数据库(自定义格式 + 压缩 + 并行)..."
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$PG_CONTAINER" \
    pg_dump -U "${POSTGRES_USER:-dunhuang}" \
            -d "${POSTGRES_DB:-dunhuang_lims}" \
            -Fc \
            -Z 9 \
            --no-owner \
            --no-acl \
            --serializable-deferrable \
            -j 4 \
    > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "    ✅ 备份完成:$BACKUP_SIZE"

# ---------- 2. 校验 ----------
echo "[2/4] 校验备份完整性(pg_restore -l)..."
RESTORE_LIST=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$PG_CONTAINER" \
    pg_restore -l "$BACKUP_FILE" 2>&1 | wc -l)
echo "    ✅ 备份条目数: $RESTORE_LIST"
if [[ $RESTORE_LIST -lt 50 ]]; then
    echo "    ⚠️  备份条目数过少,可能异常"
    exit 1
fi

# ---------- 3. 加密 ----------
echo "[3/4] 加密备份(gpg AES256)..."
if command -v gpg >/dev/null 2>&1 && gpg --list-keys "$GPG_RECIPIENT" >/dev/null 2>&1; then
    gpg --batch --yes --recipient "$GPG_RECIPIENT" \
        --cipher-algo AES256 --compress-algo none \
        --output "${BACKUP_FILE}.gpg" \
        --encrypt "$BACKUP_FILE"
    rm -f "$BACKUP_FILE"
    FINAL_FILE="${BACKUP_FILE}.gpg"
    echo "    ✅ 加密完成:$FINAL_FILE"
else
    echo "    ⚠️  gpg 未配置,跳过加密(生产环境必须配置!)"
    FINAL_FILE="$BACKUP_FILE"
fi

# ---------- 4. 异地同步 + 清理 ----------
echo "[4/4] 清理过期备份(保留 ${RETENTION_DAYS} 天)..."
find "$BACKUP_DIR" -name "pg_full_*.dump*" -mtime +$RETENTION_DAYS -delete -print
echo "    ✅ 当前备份文件:"
ls -lh "$BACKUP_DIR"/pg_full_*.dump* 2>/dev/null | awk '{print "       "$NF" ("$5")"}' || true

if [[ -n "$REMOTE_DIR" ]]; then
    echo "    同步到异地:$REMOTE_DIR"
    rsync -avz --progress "$FINAL_FILE" "$REMOTE_DIR/" || echo "    ⚠️  异地同步失败,但本地备份完整"
fi

# ---------- 5. 健康检查 ping ----------
echo
echo "    数据库恢复点(RPO)标记: $TIMESTAMP"
echo "============================================================"
echo "  ✅ 备份完成:$FINAL_FILE"
echo "============================================================"

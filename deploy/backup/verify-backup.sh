#!/usr/bin/env bash
# ============================================================
# 备份健康检查(每日 cron)
# 详见 docs/05-DEPLOYMENT.md §备份策略
#
# 检查项:
#   1. 最近 24h 是否有全量备份
#   2. WAL 归档是否正常(< 30 分钟前)
#   3. 磁盘空间(> 20%)
#   4. 备份文件是否可解/可读
# ============================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dunhuang-lims}"
WAL_DIR="${WAL_DIR:-$BACKUP_DIR/wal}"
GPG_RECIPIENT="${GPG_RECIPIENT:-lims-backup@dunhuang-lab.local}"

ERRORS=0

check_last_full_backup() {
    local latest
    latest=$(find "$BACKUP_DIR" -name "pg_full_*.dump*" -type f -mtime -1 2>/dev/null | sort | tail -1)
    if [[ -z "$latest" ]]; then
        echo "❌ 最近 24 小时无全量备份"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ 最近全量备份: $(basename "$latest") ($(du -h "$latest" | cut -f1))"
    fi
}

check_wal_archive() {
    if [[ ! -d "$WAL_DIR" ]]; then
        echo "⚠️  WAL 目录不存在"
        return
    fi
    local latest_wal
    latest_wal=$(find "$WAL_DIR" -type f -mmin -30 2>/dev/null | head -1)
    if [[ -z "$latest_wal" ]]; then
        echo "⚠️  最近 30 分钟无新 WAL"
    else
        local count
        count=$(find "$WAL_DIR" -type f 2>/dev/null | wc -l)
        echo "✅ WAL 归档正常($count 个文件)"
    fi
}

check_disk_space() {
    local usage
    usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | tr -d '%')
    if [[ $usage -gt 80 ]]; then
        echo "❌ 备份盘使用率过高: ${usage}%"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ 备份盘使用率: ${usage}%"
    fi
}

check_backup_integrity() {
    local latest
    latest=$(find "$BACKUP_DIR" -name "pg_full_*.dump*" -type f 2>/dev/null | sort | tail -1)
    if [[ -z "$latest" ]]; then
        return
    fi
    if [[ "$latest" == *.gpg ]]; then
        if gpg --batch --yes --decrypt "$latest" 2>/dev/null | head -c 5 | grep -q "PGDMP"; then
            echo "✅ 备份可解密"
        else
            echo "❌ 备份解密失败"
            ERRORS=$((ERRORS + 1))
        fi
    else
        if head -c 5 "$latest" | grep -q "PGDMP"; then
            echo "✅ 备份文件头有效"
        else
            echo "❌ 备份文件头无效"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

echo "============================================================"
echo "  备份健康检查"
echo "  时间: $(date -Iseconds)"
echo "============================================================"
check_last_full_backup
check_wal_archive
check_disk_space
check_backup_integrity
echo "============================================================"

if [[ $ERRORS -gt 0 ]]; then
    echo "❌ 发现 $ERRORS 个问题,请人工介入"
    # 发送告警(可对接 Prometheus alertmanager webhook)
    exit 1
fi
echo "✅ 备份系统健康"

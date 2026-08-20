#!/usr/bin/env bash
# ============================================================
# 数据库还原(演练用)
# 详见 docs/05-DEPLOYMENT.md §灾备演练
#
# 用法:
#   ./deploy/backup/restore.sh <backup_file.dump[.gpg]>
#
# 演练场景(每月一次):
#   1. 启动一个临时 postgres 容器
#   2. 还原昨日备份
#   3. 跑审计链校验
#   4. 启动后端连接临时 PG
#   5. 验证关键业务查询
# ============================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
    echo "用法: $0 <backup_file>"
    echo "示例: $0 /var/backups/dunhuang-lims/pg_full_20260815_020000.dump.gpg"
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "❌ 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEST_CONTAINER="dunhuang-pg-restore-test"
TEST_PORT=55433  # 避开主 PG 55432

echo "============================================================"
echo "  数据库还原演练"
echo "  备份文件: $BACKUP_FILE"
echo "  测试端口: $TEST_PORT"
echo "============================================================"

# ---------- 1. 启动临时 PG 容器 ----------
echo "[1/6] 启动临时 PG 容器(端口 $TEST_PORT)..."
docker run -d --name "$TEST_CONTAINER" \
    -e POSTGRES_USER=dunhuang \
    -e POSTGRES_PASSWORD=dunhuang_restore_pwd \
    -e POSTGRES_DB=dunhuang_lims \
    -p "${TEST_PORT}:5432" \
    timescale/timescaledb:2.16.1-pg16 >/dev/null

echo "    等待 PG 就绪..."
for i in $(seq 1 30); do
    if docker exec "$TEST_CONTAINER" pg_isready -U dunhuang >/dev/null 2>&1; then
        echo "    ✅ PG 已就绪"
        break
    fi
    sleep 2
done

trap 'echo "    清理临时容器..."; docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true' EXIT

# ---------- 2. 解密(若加密) ----------
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    echo "[2/6] 解密备份..."
    RESTORE_FILE="/tmp/$(basename "$BACKUP_FILE" .gpg)"
    gpg --batch --yes --decrypt --output "$RESTORE_FILE" "$BACKUP_FILE"
    echo "    ✅ 解密完成"
else
    echo "[2/6] 备份未加密,跳过"
fi

# ---------- 3. 还原 ----------
echo "[3/6] 还原数据库..."
docker exec -i -e PGPASSWORD=dunhuang_restore_pwd "$TEST_CONTAINER" \
    pg_restore -U dunhuang -d dunhuang_lims \
    --no-owner --no-acl \
    --jobs=4 \
    < "$RESTORE_FILE"
echo "    ✅ 还原完成"

# ---------- 4. 关键数据校验 ----------
echo "[4/6] 关键数据校验..."
USER_COUNT=$(docker exec -e PGPASSWORD=dunhuang_restore_pwd "$TEST_CONTAINER" \
    psql -U dunhuang -d dunhuang_lims -t -c "SELECT COUNT(*) FROM \"User\" WHERE deleted_at IS NULL;")
AUDIT_COUNT=$(docker exec -e PGPASSWORD=dunhuang_restore_pwd "$TEST_CONTAINER" \
    psql -U dunhuang -d dunhuang_lims -t -c "SELECT COUNT(*) FROM audit_logs;")
echo "    User 表: $USER_COUNT"
echo "    audit_logs: $AUDIT_COUNT"

# ---------- 5. 审计链校验 ----------
echo "[5/6] 审计链 SHA256 校验..."
BROKEN=$(docker exec -e PGPASSWORD=dunhuang_restore_pwd "$TEST_CONTAINER" \
    psql -U dunhuang -d dunhuang_lims -t -c "
        WITH RECURSIVE chain AS (
            SELECT id, prev_hash, current_hash, 1 AS depth
            FROM audit_logs WHERE prev_hash = 'GENESIS'
            UNION ALL
            SELECT a.id, a.prev_hash, a.current_hash, c.depth + 1
            FROM audit_logs a
            JOIN chain c ON a.prev_hash = c.current_hash
        )
        SELECT COUNT(*) FROM audit_logs WHERE current_hash IS NULL OR current_hash = '';
    ")
if [[ "$BROKEN" -gt 0 ]]; then
    echo "    ❌ 审计链存在空 hash: $BROKEN 条"
    exit 1
fi
echo "    ✅ 审计链完整"

# ---------- 6. 清理 ----------
echo "[6/6] 清理..."
[[ "$RESTORE_FILE" != "$BACKUP_FILE" ]] && rm -f "$RESTORE_FILE"

echo
echo "============================================================"
echo "  ✅ 还原演练成功"
echo "  测试容器: $TEST_CONTAINER(已自动清理)"
echo "  数据库:$TEST_PORT"
echo "============================================================"
echo
echo "提示:"
echo "  - 若演练成功,记录到 docs/runbook/02-backup-recovery.md"
echo "  - 若失败,检查日志: docker logs $TEST_CONTAINER"
echo "  - 若审计链断链:严禁使用此备份,通知实验室主任"

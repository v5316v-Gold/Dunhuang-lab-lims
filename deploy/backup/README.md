# 备份与灾备

详见 [`docs/05-DEPLOYMENT.md §备份策略`](../../docs/05-DEPLOYMENT.md)。

## 策略(3-2-1)

| 层级 | 频率 | 保留 | 存储 |
|---|---|---|---|
| 全量备份 | 每日 02:00 | 30 天 | 本地 `/var/backups/dunhuang-lims/` |
| WAL 归档 | 每 15 分钟 | 7 天 | 同上 |
| 周备份 | 每周日 03:00 | 12 周 | 同上 + 异地 |
| 月备份 | 每月 1 日 05:00 | 12 月 | 同上 + 异地 + 加密离线 |

## 安装定时任务

```bash
# 1. 复制并修改环境变量
cp deploy/backup/crontab.txt /etc/cron.d/dunhuang-lims
vim /etc/cron.d/dunhuang-lims   # 替换 __FROM_ENV_FILE__

# 2. 设置执行权限
chmod +x /opt/dunhuang-lab-lims/deploy/backup/*.sh

# 3. 创建备份用户(cron 以此用户运行)
useradd -r -s /bin/bash lims-backup
mkdir -p /var/backups/dunhuang-lims
chown -R lims-backup:lims-backup /var/backups/dunhuang-lims
chmod 700 /var/backups/dunhuang-lims

# 4. 启动 cron(部分容器没有 cron)
service cron start   # Debian
```

## GPG 加密

```bash
# 1. 生成备份专用 GPG key
gpg --batch --gen-key <<EOF
    Key-Type: RSA
    Key-Length: 4096
    Name-Real: Dunhuang LIMS Backup
    Name-Email: lims-backup@dunhuang-lab.local
    Expire-Date: 0
    Passphrase: __强密码__
EOF

# 2. 备份私钥到保险柜
gpg --export-secret-keys lims-backup@dunhuang-lab.local > /secure/gpg-private.key

# 3. 异地保存
```

## 还原演练(每月必做)

```bash
# 自动演练(测试容器,自动清理)
/opt/dunhuang-lab-lims/deploy/backup/restore.sh \
    $(find /var/backups/dunhuang-lims -name "pg_full_*.dump*" -mtime -2 | sort | tail -1)

# 真实还原(生产环境紧急情况)
/opt/dunhuang-lab-lims/deploy/backup/restore.sh /var/backups/dunhuang-lims/pg_full_20260815.dump.gpg
```

## RPO / RTO 目标

| 指标 | 目标 | 当前能力 |
|---|---|---|
| **RPO**(数据丢失容忍) | ≤ 24 小时 | 15 分钟(WAL 归档) |
| **RTO**(恢复时间容忍) | ≤ 4 小时 | 30-60 分钟(全量还原) |

## 紧急恢复流程

```
1. 通知实验室主任
   ↓
2. IT 评估:故障类型 / 数据损坏范围
   ↓
3. 选备份源:
   - 软故障(应用层):重启 → 失败 → 选昨日备份
   - 硬故障(磁盘):换盘 → 拉取异地备份 → 重建
   - 误操作(删数据):WAL PITR → 精确到分钟
   ↓
4. 还原到临时容器
   ↓
5. 审计链校验
   ↓
6. 切换流量
   ↓
7. 写偏差报告 + 评审材料
```

## 注意事项

- **永远不要在生产 PG 容器内执行还原**——必须独立测试容器
- 备份文件异地存放至少 50 公里外(检测中心机房 vs 总公司机房)
- GPG 私钥双控:IT 主管 + 实验室主任各持一半,合并才能解密
- 每月演练失败 → 暂停下一月备份策略,人工排查

# 敦煌金质检 LIMS - 部署与运行手册

> 面向:检测中心 IT 工程师 / 运维人员
> 目标:从零搭建生产环境、部署、运维、升级、应急
> 最后更新:2026-08-15

---

## 目录

1. [生产部署(局域网)](#1-生产部署局域网)
2. [TLS / 内网 CA](#2-tls--内网-ca)
3. [备份与灾备](#3-备份与灾备)
4. [可观测性](#4-可观测性-prometheus--grafana)
5. [检测仪器对接](#5-检测仪器对接)
6. [升级流程](#6-升级流程)
7. [故障应急响应](#7-故障应急响应)
8. [CNAS 评审准备](#8-cnas-评审准备)

---

## 1. 生产部署(局域网)

### 1.1 主机规划

| 角色 | IP | 规格 | 操作系统 | 服务 |
|---|---|---|---|---|
| **应用服务器** | 192.168.x.50 | 4C/8G/100G SSD | Ubuntu 22.04 LTS | Docker Engine |
| **数据库服务器** | 192.168.x.51 | 4C/16G/500G SSD | Ubuntu 22.04 LTS | Docker Engine |
| **运维服务器** | 192.168.x.52 | 2C/4G/200G | Ubuntu 22.04 LTS | Docker Engine |

> 若预算紧,数据库与应用可合并到一台(单机不推荐生产)

### 1.2 一次性准备

```bash
# 在所有主机上
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install -y openssl gpg rsync cron

# 在应用服务器和数据库服务器
sudo mkdir -p /opt/dunhuang-lab-lims
cd /opt/dunhuang-lab-lims
git clone https://github.com/v5316v-Gold/Dunhuang-lab-lims.git .

# 在数据库服务器(单独)
#   不需要 docker-compose.prod.yml,只跑 PG 和 Redis
```

### 1.3 配置环境变量

```bash
cd /opt/dunhuang-lab-lims
cp .env.prod.example .env.prod

# 生成密码
openssl rand -base64 32  # 复制到 POSTGRES_PASSWORD
openssl rand -base64 32  # 复制到 REDIS_PASSWORD
openssl rand -base64 64  # 复制到 JWT_SECRET
openssl rand -base64 64  # 复制到 JWT_REFRESH_SECRET
openssl rand -base64 32  # 复制到 TOTP_ENCRYPTION_KEY

vim .env.prod  # 填入
chmod 600 .env.prod
```

### 1.4 初始化内网 CA + 生成证书

```bash
./deploy/ca/init-ca.sh dunhuang-lab.local
./deploy/ca/gen-server-cert.sh lims.dunhuang-lab.local 192.168.x.50
./deploy/ca/gen-client-cert.sh report-signer  # 报告签名专用
```

### 1.5 启动服务

```bash
# 数据库服务器(192.168.x.51)
docker compose -f docker-compose.db-only.yml up -d

# 应用服务器(192.168.x.50)
cd /opt/dunhuang-lab-lims
docker compose -f docker-compose.prod.yml up -d

# 查看启动状态
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

### 1.6 客户端信任 CA

把 `infrastructure/nginx/ssl/ca.crt` 推到所有工作站:

Windows:
```
certutil -addstore -f "Root" ca.crt
```

Ubuntu:
```
sudo cp ca.crt /usr/local/share/ca-certificates/dunhuang-ca.crt
sudo update-ca-certificates
```

### 1.7 验证

```bash
# 健康检查
curl -k https://lims.dunhuang-lab.local/health/ready

# 登录
curl -k -X POST https://lims.dunhuang-lab.local/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"Admin@Pass123"}'

# 浏览器访问
# https://lims.dunhuang-lab.local
```

### 1.8 网络分段(重要)

```
检测中心内网 192.168.0.0/16
  ├─ 应用段 192.168.10.0/24      (应用服务器)
  ├─ 数据段 192.168.20.0/24      (数据库服务器,internal network)
  ├─ 仪器段 192.168.30.0/24      (检测仪器)
  └─ 办公段 192.168.40.0/24      (检测员工作站)
```

防火墙规则:
- 办公段 → 应用段:443/tcp ✅
- 应用段 → 数据段:5432/tcp ✅
- 应用段 → 仪器段:8000-9999/tcp(白名单端口)✅
- 数据段 → 外网:❌ (PG/Redis 不允许出公网)
- 办公段 → 数据段:❌ (不允许直接访问数据库)

---

## 2. TLS / 内网 CA

详见 [`deploy/ca/README.md`](../../deploy/ca/README.md)。

要点:
- CA 私钥(`ca.key`)严格保密,只能由 IT 主管 + 实验室主任双控
- 服务器证书 825 天有效期,评审前 1 个月续签
- 客户端证书(仪器对接)同样 825 天
- 内网 HTTPS 是必须的(CNAS §6.5 数据保密,即便内部也要 TLS)

---

## 3. 备份与灾备

详见 [`deploy/backup/README.md`](../../deploy/backup/README.md)。

策略:
- **每日 02:00** 全量备份 + 加密
- **每 15 分钟** WAL 归档(支持 PITR)
- **每周日 03:00** 周备份
- **每月 1 日 06:00** 还原演练

RPO / RTO:
- **RPO ≤ 15 分钟**(WAL 归档粒度)
- **RTO ≤ 1 小时**(全量还原到测试容器的时间)

---

## 4. 可观测性 (Prometheus + Grafana)

详见 [`docs/05-DEPLOYMENT.md §可观测性`](../05-DEPLOYMENT.md)。

部署版 docker-compose 已包含:
- Prometheus:`http://192.168.x.52:9090`
- Grafana:`http://192.168.x.52:3001`(默认 admin/admin,首次登录改)
- Loki:`http://192.168.x.52:3100`
- Tempo:`http://192.168.x.52:3200`

关键仪表盘:
- **LIMS 系统总览** — 业务核心 KPI(收样数 / 待审核 / OOS / 校准逾期 / 审计链)
- **审计链完整性** — 实时监控审计链写入
- **API 性能** — P95/P99 延迟 + 错误率

关键告警规则(`infrastructure/docker/prometheus/alerts.yml`):
- `AuditChainBroken` — 审计链断链(severity: critical)
- `HighErrorRate` — API 5xx > 1%
- `CriticalLatency` — API P99 > 1s
- `DatabaseDown` — PG 不可达

告警对接:AlertManager → 企业微信 / 钉钉 / 邮件 / 短信

---

## 5. 检测仪器对接

详见 [`docs/05-DEPLOYMENT.md §检测仪器对接`](../05-DEPLOYMENT.md)。

每个仪器:
1. 用 `deploy/ca/gen-client-cert.sh <device-name>` 生成证书
2. 把 `client.p12` 导入仪器控制电脑
3. 在 LIMS 后台注册设备(`Equipment` 表,记录 `certSerial`)
4. 配置仪器数据上报到 `POST https://lims:443/api/v1/instruments/data`
5. Header 必填:`X-Instrument-Cert-SN` / `-Timestamp` / `-Signature`
6. Payload:`{ measurements: [{sampleId, element, value, unit}] }`

支持的设备:ICP-OES / 电子天平 / 分光光度计 / 火试金熔样炉(需数据采集模块)

---

## 6. 升级流程

### 6.1 标准升级

```bash
# 1. 备份(必做)
cd /opt/dunhuang-lab-lims
./deploy/backup/pg-full-backup.sh

# 2. 拉取新代码
git fetch
git checkout v1.x.x    # 切到稳定 tag

# 3. 重建镜像
docker compose -f docker-compose.prod.yml build

# 4. 滚动重启(零停机)
docker compose -f docker-compose.prod.yml up -d --no-deps backend

# 5. 健康检查
curl -k https://lims.dunhuang-lab.local/health/ready

# 6. 跑数据库迁移
docker compose -f docker-compose.prod.yml exec backend \
    npx prisma migrate deploy
```

### 6.2 数据库迁移注意事项

- **永远不在生产 PG 容器内手动改 schema**
- 新 migration 必须先在 staging 演练
- 大表 migration 选低峰期(周末)
- 迁移前**必须**有完整备份

### 6.3 回滚

```bash
# 镜像回滚
git checkout v1.x.x
docker compose -f docker-compose.prod.yml up -d --no-deps backend

# 数据库回滚(慎用)
./deploy/backup/restore.sh /var/backups/dunhuang-lims/pg_full_20260815.dump.gpg
```

---

## 7. 故障应急响应

### 7.1 分级

| 级别 | 场景 | 响应时间 | 处理人 |
|---|---|---|---|
| **P0** | 系统宕机 / 审计链断链 / 数据丢失 | 15 分钟 | IT + QA |
| **P1** | 单模块故障 / 部分功能不可用 | 1 小时 | IT |
| **P2** | 性能下降 / 告警 | 4 小时 | IT |
| **P3** | UI 问题 / 小 bug | 24 小时 | 开发 |

### 7.2 P0 应急脚本

```bash
# 系统宕机
cd /opt/dunhuang-lab-lims
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 backend
docker compose -f docker-compose.prod.yml restart backend

# 审计链断链
./scripts/audit-verify.ts --verify-now
# 若真的断链,看告警详情,联系实验室主任 + 写偏差报告

# 数据丢失
# 1. 立即停止写入(只读模式)
docker compose -f docker-compose.prod.yml exec postgres \
    psql -U dunhuang -d dunhuang_lims -c "REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM dunhuang;"
# 2. 评估丢失范围
# 3. 从备份恢复
```

### 7.3 常见问题 FAQ

**Q: 登录后立刻 401?**
A: 检查 JWT_SECRET 是否改变,变了就会让所有旧 token 失效

**Q: /metrics 502?**
A: backend 容器未启动或 OOM,看 `docker stats`

**Q: 前端页面空白?**
A: F12 看 network,大概率是 nginx 反代配置错误,或后端 CORS 没放行前端域名

**Q: 仪器数据收不到?**
A: 检查 (1) 客户端证书是否过期 (2) sharedSecret 是否配对 (3) timestamp 是否在 ±5min 内

---

## 8. CNAS 评审准备

### 8.1 评审前 1 周 — 自检清单

- [ ] 系统能正常启动(`docker compose ps` 全 healthy)
- [ ] 备份最近 7 天有完整备份
- [ ] 还原演练成功执行过(本月)
- [ ] 审计链 `verify-audit-chain.sh` 全绿
- [ ] 所有人员账号 MFA 已启用
- [ ] 所有校准在有效期内
- [ ] 所有标准物质在有效期内
- [ ] OOS / NCR 无超过 7 天未关闭

### 8.2 评审现场演示脚本(30 分钟)

详见 [`docs/06-ROADMAP.md §CNAS 现场演示`](../06-ROADMAP.md)。

### 8.3 评审员常问 + 系统秒答表

| 评审问题 | 系统演示 |
|---|---|
| "你的电子记录怎么保证不被篡改?" | `verify-audit-chain.sh` 离线整链校验 |
| "改了的数据能恢复吗?" | `audit_logs` 历史 + 软删除表 |
| "OOS 怎么处理的?" | Westgard → OOS → CAPA 全流程 |
| "不确定度怎么算的?" | Au 99.95% ± 0.02% 展开 5 类分量 |
| "人员资质过期了怎么办?" | 人员状态自动 `SUSPENDED` |
| "校准过期了能用吗?" | 设备自动 `QUARANTINED` |
| "标准物质过期了能用吗?" | `assertUsable` 阻断 |
| "MFA 强制吗?" | 弹窗输入 TOTP → 二次验证 |
| "电子签名有法律效力吗?" | SHA256 + RFC 3161 时间戳 |
| "你们怎么做管理评审?" | 系统自动汇总 12 项管评输入 |

### 8.4 评审当天应急联系

| 角色 | 姓名 | 电话 |
|---|---|---|
| 实验室主任 | 菩提老祖 | xxx-xxxx-xxxx |
| IT 主管 | (李四) | xxx-xxxx-xxxx |
| QA 经理 | qa.manager | 系统账号 |

---

## 附录: 故障决策树

```
系统不可访问
  │
  ├─ DNS 解析失败?
  │   → 检查 /etc/hosts 或内网 DNS
  │
  ├─ 503 Service Unavailable?
  │   ├─ 后端崩溃 → docker logs backend → 重启
  │   └─ PG 不可达 → docker logs postgres
  │
  ├─ 502 Bad Gateway?
  │   → nginx → backend 网络问题
  │   → docker exec nginx ping backend
  │
  ├─ 504 Gateway Timeout?
  │   → 后端慢查询
  │   → 看 Grafana 慢 SQL
  │
  ├─ 401 Unauthorized?
  │   ├─ token 过期 → 刷新 token
  │   └─ MFA 失败 → 用备份码 / 联系主任
  │
  └─ 403 Forbidden?
      ├─ RBAC → 角色权限不够
      └─ MFA → 弹窗输入 TOTP
```

# Periodic Review Plan (周期性复核计划)

> **项目**: 敦煌金质检 LIMS
> **版本**: v1.0
> **日期**: 2026-08-13
> **依据**: GAMP 5 §9.6 Operational Phase / ISO/IEC 17025:2017 §8.5 风险与改进
> **范围**: Dunhuang-LIMS 系统全生命周期

---

## 1. 目的

确保 LIMS 系统在生产运行阶段:
1. **持续满足** CNAS-CL01:2018 + ISO/IEC 17025:2017 + ALCOA+ 要求
2. **及时发现** 性能退化、安全漏洞、审计异常
3. **预防性维护** 而不是被动修复
4. **完整记录** 复核过程与发现,作为 CNAS 现场评审证据

---

## 2. 复核类型与周期

### 2.1 复核类型

| 复核类型 | 周期 | 主要内容 | 责任方 | 文档输出 |
|---|---|---|---|---|
| **每日自动检查** | 每日 02:00 | 健康检查、备份、审计链 verify | 系统(cron) | 自动日志 |
| **每周运营检查** | 每周一 09:00 | 备份验证、磁盘空间、慢查询 | LIMS 架构师 | 每周简报 |
| **每月性能评审** | 每月 1 号 | 性能指标、容量趋势、错误率 | LIMS 架构师 | 月度报告 |
| **每季度风险评审** | 每季度末 | FMEA 复核、新增风险识别 | QA Manager | 季度报告 |
| **半年变更评审** | 每年 4 月 + 10 月 | 6 个月内变更汇总、影响分析 | QA + IT | 半年变更报告 |
| **年度完整复核** | 每年 8 月(系统 anniversary) | 全部验证项重测、DR 演练 | QA + IT + 实验室 | **完整 VSR 刷新** |
| **重大事件复核** | 事件触发 | 任何 P1 故障 / 数据丢失 / 安全事件 | QA Manager | 事件报告 + CAPA |
| **CNAS 复评前复核** | 复评前 1 个月 | VMP 全部文件清单 + 现场演练 | QA Manager | Pre-audit 报告 |

### 2.2 复核频率总览

```
每日   每周   每月   季度   半年   年度
  │     │      │      │     │      │
  ▼     ▼      ▼      ▼     ▼      ▼
 自动   简报   报告   风险   变更   完整
 检查   1页    3页    评审   汇总   复核
                                │
                                └─── VSR v2.x
```

---

## 3. 每日自动检查(Operational Health Check)

### 3.1 cron 任务清单(每日 02:00)

| 检查项 | 工具 | 通过条件 | 失败动作 |
|---|---|---|---|
| 1. PostgreSQL 连接 | `psql -c "SELECT 1"` | exit 0 | 邮件 + 钉钉告警 |
| 2. Redis 连接 | `redis-cli ping` | PONG | 邮件 + 钉钉告警 |
| 3. 应用 health endpoint | `curl http://localhost:3030/health` | 200 OK | 邮件 + 钉钉告警 |
| 4. audit chain verify | 应用端点 `GET /audit-logs/verify` | passed=true | **P1 告警**(立即) |
| 5. 昨日 audit_log 数量 | SQL `count(*) WHERE created_at > now() - 1d` | > 0(有业务活动时) | 邮件告警 |
| 6. 数据库备份 | `pg_dump` 成功 | exit 0 + 文件 > 100MB | 邮件告警 |
| 7. 磁盘空间 | `df -h /var/lib/postgresql` | < 80% | 邮件告警 |
| 8. 索引膨胀 | `pg_stat_user_indexes` | dead_tuples < 10000 | 周报累积 |
| 9. 长事务 | `pg_stat_activity` | 持续 < 5min | 周报累积 |
| 10. Prisma 日志错误 | grep ERROR in logs | 0 行 | 邮件告警 |

### 3.2 自动报告路径

```
/var/log/lims/
├── daily-health-2026-08-13.log     # 每日自动检查日志
├── weekly-report-2026-W33.md       # 每周简报
├── monthly-report-2026-08.md       # 月度报告
├── quarterly-review-2026-Q3.md     # 季度评审
├── annual-vsr-2026.md              # 年度 VSR
└── incidents/
    ├── INC-2026-08-13-001.md       # 事件报告
    └── ...
```

### 3.3 检查脚本伪代码(Phase 1 实施)

```bash
#!/bin/bash
# /opt/lims/scripts/daily-health-check.sh
# Cron: 0 2 * * * /opt/lims/scripts/daily-health-check.sh

DATE=$(date +%Y-%m-%d)
LOG=/var/log/lims/daily-health-$DATE.log

{
  echo "=== Daily Health Check: $DATE ==="

  # 1. PG
  docker exec dunhuang-pg psql -U dunhuang -d dunhuang_lims -c "SELECT 1" > /dev/null 2>&1 && echo "✅ PG OK" || echo "❌ PG FAIL"

  # 2. Redis
  docker exec dunhuang-redis redis-cli ping > /dev/null 2>&1 && echo "✅ Redis OK" || echo "❌ Redis FAIL"

  # 3. App health
  curl -fsS http://localhost:3030/health > /dev/null 2>&1 && echo "✅ App OK" || echo "❌ App FAIL"

  # 4. Audit chain verify
  RESULT=$(curl -fsS http://localhost:3030/api/v1/audit-logs/verify -H "Authorization: Bearer $ADMIN_TOKEN")
  if echo "$RESULT" | grep -q '"passed":true'; then
    echo "✅ Audit chain OK"
  else
    echo "🚨 AUDIT CHAIN BROKEN - P1 INCIDENT"
    mail -s "🚨 P1: LIMS Audit Chain Broken" alerts@dunhuang-lims.cn
  fi

  # 5. Audit log count yesterday
  YESTERDAY=$(docker exec dunhuang-pg psql -U dunhuang -d dunhuang_lims -t -c "SELECT count(*) FROM audit_logs WHERE created_at > now() - interval '1 day'")
  echo "Audit logs yesterday: $YESTERDAY"

  # 6. Backup
  pg_dump -U dunhuang -h localhost dunhuang_lims > /backup/lims-$DATE.dump 2>/dev/null
  SIZE=$(stat -c %s /backup/lims-$DATE.dump 2>/dev/null || echo 0)
  [ $SIZE -gt 100000000 ] && echo "✅ Backup OK ($SIZE bytes)" || echo "❌ Backup FAIL or too small"

  # 7. Disk
  DISK=$(df /var/lib/postgresql | tail -1 | awk '{print $5}' | tr -d '%')
  [ $DISK -lt 80 ] && echo "✅ Disk OK ($DISK%)" || echo "⚠️ Disk $DISK%"

  echo "=== Done ==="
} >> $LOG 2>&1
```

---

## 4. 每周运营检查(Weekly Operational Review)

**时间**: 每周一 09:00
**责任**: LIMS 架构师
**输出**: 每周简报(1 页)

### 4.1 简报模板

```markdown
# LIMS 每周简报 - 2026-W33

## 业务指标
- 样品接收: 247 件
- 报告签发: 189 份
- 用户登录: 1,203 次
- QC 测量: 456 条

## 系统指标
- 正常运行时间: 99.95% (SLA 99.9% ✅)
- 平均响应时间: 120ms (P95 320ms)
- 错误率: 0.02%
- 数据库大小: 1.2 GB

## 审计指标
- 审计日志条数: 12,456 (本周)
- 链 verify 状态: ✅ PASSED
- 防篡改 trigger 测试: ✅ PASSED

## 备份与恢复
- 周备份: ✅ 成功
- 备份文件大小: 850MB
- 恢复演练: 下次 2026-09-01

## 安全指标
- 失败登录: 12 次(其中 2 次 IP 封禁)
- 越权尝试: 0
- 漏洞扫描: 下次 2026-09-15

## 变更与事件
- 本周部署: 0
- 本周事件: 1(已解决)
  - INC-2026-08-15-003: Redis 临时无响应(12:34-12:38)
- 待办: 2

## 下周计划
- [ ] 部署 Phase 1 监控栈
- [ ] 用户培训(新入 2 人)
- [ ] 数据库 VACUUM ANALYZE
```

---

## 5. 每月性能评审(Monthly Performance Review)

**时间**: 每月 1 号 10:00
**责任**: LIMS 架构师
**输出**: 月度报告(3-5 页)

### 5.1 月度报告内容

1. **业务增长趋势**
   - 月度样品量(过去 12 月)
   - 用户活跃度
   - 报告量

2. **性能指标**
   - 响应时间 P50 / P95 / P99
   - 数据库查询慢查询 top 10
   - 并发用户数峰值
   - 内存 / CPU / 磁盘使用趋势

3. **审计与合规**
   - audit_logs 总条数与月增量
   - 链 verify 状态(每日 PASS / 失败次数)
   - 软删除操作数
   - 越权尝试数

4. **备份与恢复**
   - 备份成功率
   - 备份文件大小趋势
   - 最近一次恢复演练日期

5. **安全指标**
   - 失败登录
   - 漏洞扫描结果
   - 异常 IP

6. **容量规划**
   - 数据库预估 6/12 月后大小
   - audit_logs 预估 6/12 月后行数
   - 是否需要归档/分表

7. **下月计划**

### 5.2 触发条件:告警阈值

| 指标 | 阈值 | 动作 |
|---|---|---|
| 响应时间 P95 > 1s | 连续 3 天 | 月度报告重点分析 |
| 数据库增长 > 30%/月 | 持续 2 月 | 触发归档计划 |
| 备份失败 | 任何 | P1 告警 + 即时报告 |
| 链 verify 失败 | 任何 | P1 告警 + 即时调查 |
| 磁盘使用 > 80% | 任何 | 周报加黄 + 容量规划 |
| 越权尝试 > 0 | 任何 | 安全事件报告 |

---

## 6. 每季度风险评审(Quarterly Risk Review)

**时间**: 每季度末(3/6/9/12 月 30 日)
**责任**: QA Manager
**输出**: 季度评审报告(5-10 页)
**参与**: LIMS 架构师 + IT 负责人 + 实验室主任

### 6.1 评审议程

1. **FMEA 复核** — 重新评估所有风险点
2. **新增风险识别** — 本季度出现的新风险
3. **风险降低措施跟踪** — 上季度措施是否落实
4. **变更影响分析** — 本季度所有变更
5. **事件趋势分析** — 本季度事件 / 偏差
6. **下季度风险降低计划**

### 6.2 触发条件:专项风险评审

- 任何 P1 事件
- 重大功能上线
- 法规/标准变化
- 一年内 ≥ 3 次同类偏差

---

## 7. 半年变更评审(Semi-Annual Change Review)

**时间**: 每年 4 月 + 10 月
**责任**: QA + IT
**输出**: 半年变更报告

### 7.1 报告内容

| 变更 ID | 日期 | 类型 | 描述 | 影响 | 验证结果 |
|---|---|---|---|---|---|
| CR-2026-001 | 2026-04-15 | 中 | 加 TimescaleDB hypertable | 性能 +50% | ✅ PASS |
| CR-2026-002 | 2026-05-02 | 轻 | 改 UI 顶部导航 | 无 | ✅ Smoke test |
| CR-2026-003 | 2026-06-20 | 重大 | 升级 PostgreSQL 16 | 全部 | ✅ 完整 V-model |

---

## 8. 年度完整复核(Annual Full Review)

**时间**: 每年 8 月(system anniversary)
**责任**: QA + IT + 实验室 + 管理层
**输出**: **VSR v2.x 刷新**(完整重做验证总结报告)
**参与**: 内审员 + 外部顾问(可选)

### 8.1 复核范围

1. **重新执行全部 OQ 测试** — 25 个 jest 集成测试 + 新增
2. **DR 演练** — 模拟主库宕机,验证 4h 内恢复
3. **渗透测试** — 邀请外部安全公司
4. **性能 PQ** — 1000 样品/天压测
5. **用户满意度调查**
6. **FMEA 完整重评**
7. **VMP 版本更新**(v1.0 → v2.0)

### 8.2 年度 VSR 输出

- VSR-v2.x.md
- 完整测试报告附件
- 偏差 / CAPA 清单
- 残余风险评估
- 下年度验证计划

---

## 9. 重大事件复核(Incident-triggered Review)

### 9.1 事件分级

| 级别 | 定义 | 例子 | 响应时间 |
|---|---|---|---|
| **P0** | 完全中断,数据丢失 | DB 损坏、备份恢复失败 | 15 min |
| **P1** | 关键功能失效,合规风险 | audit chain 断链、auth 失效、TRUNCATE 成功 | 1 h |
| **P2** | 部分功能异常,有 workaround | 仪器集成失败、报表错 | 4 h |
| **P3** | 轻微问题 | UI bug、慢查询 | 1 工作日 |

### 9.2 事件复核流程

1. **即时**: PagerDuty 告警
2. **2 小时内**: 初步 RCA(root cause analysis)
3. **24 小时内**: 详细 RCA + 短期修复
4. **1 周内**: 长期修复 + CAPA
5. **2 周内**: 事件报告(给 QA + 管理层)
6. **季度评审**: 事件入 FMEA

### 9.3 事件报告模板

```markdown
# Incident Report: INC-2026-XX-XX-XXX

## 概要
- 级别: P1
- 开始: 2026-08-15 12:34:00
- 结束: 2026-08-15 12:38:00
- 持续: 4 分钟
- 影响: 期间报告查询失败

## 时间线
- 12:34 - Redis 实例无响应
- 12:35 - 自动告警
- 12:36 - IT 介入
- 12:38 - Redis 重启,服务恢复

## 根因
Redis OOM 触发内存保护,自动重启。

## 短期修复
- 12:40 - 重启完成
- 12:45 - 验证正常

## 长期修复(CAPA)
- [ ] 增加 Redis 内存监控告警(2026-08-30)
- [ ] 设置 maxmemory 80% 告警
- [ ] 调整 Redis 配置,启用 lazy free
- [ ] 添加到下次季度评审

## 影响评估
- 数据丢失: 0
- 报告延期: 0(4 分钟内恢复)
- 合规风险: 0
```

---

## 10. CNAS 复评前复核(Pre-Assessment Review)

**时间**: CNAS 复评前 1 个月
**责任**: QA Manager
**输出**: Pre-audit 报告

### 10.1 Pre-audit 报告清单

- [ ] VMP 最新版本
- [ ] VSR 完整测试证据
- [ ] FMEA + 风险降低措施执行情况
- [ ] 全部变更记录(过去 3 年)
- [ ] 全部事件报告 + CAPA
- [ ] 周期性复核报告(全部 12 个月)
- [ ] 培训记录
- [ ] 内审报告
- [ ] 管理评审记录
- [ ] 抱怨与反馈
- [ ] 设备校准证书
- [ ] 供应商审计

### 10.2 模拟评审

- 内部 mock 评审(由非日常人员担任评审员)
- 按 CNAS 评审员检查表走一遍
- 修正发现的问题

---

## 11. 复核发现与改进

每次复核发现的**改进项**:
1. 录入 `docs/validation/findings.md`
2. 分配责任人与截止日期
3. 跟踪到完成
4. 在下月/季报中验证

### 11.1 改进优先级

| 优先级 | 响应 |
|---|---|
| **P0 / P1** | 1 周内 |
| **P2** | 1 月内 |
| **P3** | 季度内 |
| **P4** | 年度计划 |

---

## 12. 复核文档存档

所有复核报告保存于:
- `docs/validation/review/`
  - `daily/` 每日自动检查
  - `weekly/` 每周简报
  - `monthly/` 月度报告
  - `quarterly/` 季度评审
  - `semi-annual/` 半年变更
  - `annual/` 年度完整复核
  - `incidents/` 事件报告

保存期限:**6 年**(CNAS 要求 ≥ 5 年 + 1 buffer)。

---

## 13. 复核责任矩阵(RACI)

| 活动 | LIMS 架构师 | QA Manager | IT 运维 | 实验室主任 | 质量经理 |
|---|---|---|---|---|---|
| 每日自动检查 | **R**(系统) | I | **A** | I | I |
| 每周运营检查 | **R** | I | A | I | I |
| 每月性能评审 | **R** | A | C | I | I |
| 每季度风险评审 | C | **R** | C | I | A |
| 半年变更评审 | C | **R** | C | I | A |
| 年度完整复核 | C | **R** | C | C | A |
| 重大事件复核 | R | **R** | C | I | A |
| CNAS 复评前 | C | **R** | C | C | A |

R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 14. 文档版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布,Phase 0.5 完成 | LIMS-Architect-01 |

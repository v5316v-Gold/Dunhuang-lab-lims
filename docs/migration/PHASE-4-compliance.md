# Phase 4:合规加固(第 11-12 周)

> **周期**: 2026-10-20 ~ 2026-11-02(2 周,10 工作日)
> **目标**: CNAS 审核准备就绪,所有合规要求可演示
> **业务核心**: ALCOA+ 9 原则 + 备份恢复 + 审计链完整性
> **负责人**: 后端工程师 + DevOps + 天枢 + CNAS 顾问

## 1. 任务清单

### Week 1(第 11 周):审计链 GUI + 自检 + 备份恢复

#### Day 1-2:审计链 GUI + 自检

- [ ] **Task 4.1**: 审计链管理界面
  - `apps/frontend/src/views/audit/Chain.tsx`
  - 可视化审计链:节点图(每条记录 = 一个节点,边 = 哈希指针)
  - 过滤:用户 / 表 / 日期 / 操作类型
  - 详情:点击节点显示 old_data / new_data / prev_hash / curr_hash

- [ ] **Task 4.2**: 断链自检增强
  - `scripts/audit-verify.ts` 增强:支持全库扫描 / 单表扫描
  - `GET /audit-logs/verify?table=samples&from=2026-09-01&to=2026-09-30`
  - 返回:`{ passed: true, totalRecords: 12345, errors: [] }`

- [ ] **Task 4.3**: 审计链导出(给 CNAS 审核员)
  - `POST /audit-logs/export` 生成审计链 PDF/EV 报告
  - 含每条记录的 prev_hash / curr_hash / 时间 / 操作者

#### Day 3-4:备份恢复演练

- [ ] **Task 4.4**: 备份策略落地
  - `infrastructure/docker/postgres/backup.sh`
  - 每日全量备份 + 6 小时增量备份
  - 异地备份(对象存储 OSS / S3)
  - 备份加密(AES-256)

- [ ] **Task 4.5**: 备份脚本
  ```bash
  #!/bin/bash
  # scripts/backup.sh
  DATE=$(date +%Y%m%d_%H%M%S)
  BACKUP_DIR=/var/backups/dunhuang-lims
  mkdir -p $BACKUP_DIR

  # 全量备份
  pg_dump -h localhost -U dunhuang -d dunhuang_lims -F c -f $BACKUP_DIR/full_$DATE.dump

  # 加密
  gpg --symmetric --cipher-algo AES256 --passphrase-file /etc/lims/backup.key \
    -o $BACKUP_DIR/full_$DATE.dump.gpg $BACKUP_DIR/full_$DATE.dump

  # 异地备份
  aws s3 cp $BACKUP_DIR/full_$DATE.dump.gpg s3://dunhuang-backup/$DATE/

  # 清理 30 天前
  find $BACKUP_DIR -name "*.dump*" -mtime +30 -delete
  ```

- [ ] **Task 4.6**: 恢复演练
  - `scripts/restore.sh`
  - **必须验证 RTO ≤ 4 小时**(CNAS 要求)
  - 演练脚本:删除部分数据 → 恢复 → 校验 SHA256 链 → 校验业务数据完整性

- [ ] **Task 4.7**: 备份监控 + 告警
  - 每日备份成功/失败状态
  - 备份文件大小异常告警
  - 异地备份验证(下载校验)

#### Day 5:灾备文档

- [ ] **Task 4.8**: 灾备方案文档 `docs/DISASTER-RECOVERY.md`
  - 灾难场景:机房故障 / 数据库损坏 / 网络中断 / 勒索软件
  - RTO/RPO 目标:RTO ≤ 4h,RPO ≤ 1h
  - 切换流程:主库 → 备库 → 异地
  - 通讯录:关键人员 + 备用联系

- [ ] **Task 4.9**: 异地备份实施
  - 选择对象存储(阿里云 OSS / AWS S3 / 腾讯云 COS)
  - 配置自动同步(cron + aws-cli)
  - 异地端加密 + 访问控制

### Week 2(第 12 周):CNAS 自检清单 + 文档完善

#### Day 6-7:CNAS 自检清单

- [ ] **Task 4.10**: 创建 `docs/CNAS-SELF-CHECK.md`
  ```markdown
  # CNAS 自检清单(给审核员用)

  ## ALCOA+ 9 原则自检

  ### 1. Attributable(可归属)
  - [ ] 每条记录 user_id + username 字段
  - [ ] 演示:`GET /audit-logs?user_id=xxx`

  ### 2. Legible(清晰可读)
  - [ ] 报告 PDF + 原始 JSON 双存档
  - [ ] 演示:打开任意一份报告

  ### 3. Contemporaneous(同步)
  - [ ] 审计日志 created_at 与业务操作时间差 < 1s
  - [ ] 演示:对比审计日志时间与业务数据时间

  ### 4. Original(原始)
  - [ ] DB 触发器阻止覆盖原值
  - [ ] 演示:尝试 UPDATE 任意业务表 → 数据库拒绝或仅追加

  ### 5. Accurate(准确)
  - [ ] QC 验证(空白/平行/加标) + SHA256 链 100% 完整
  - [ ] 演示:查看 QC 数据 + 断链自检

  ### 6. Complete(完整)
  - [ ] 审计链无缺失
  - [ ] 演示:`GET /audit-logs/verify` 通过

  ### 7. Consistent(一致)
  - [ ] 跨表数据一致性
  - [ ] 演示:用户禁用 → 所有 session 失效

  ### 8. Enduring(持久)
  - [ ] 异地备份 ≥ 5 年
  - [ ] 演示:备份文件列表

  ### 9. Available(可用)
  - [ ] 报告查询 ≥ 5 年
  - [ ] 演示:查询 5 年前的报告

  ## ISO 17025 条款对照(给审核员)

  ### 5.2 人员
  - [ ] 人员档案完整
  - [ ] 培训记录 + 能力矩阵齐全

  ### 5.3 设施和环境条件
  - [ ] 设备位置记录
  - [ ] 环境监控(温度/湿度)

  ### 5.4 设备
  - [ ] 设备清单
  - [ ] 校准证书
  - [ ] 期间核查记录

  ### 5.5 计量溯源性
  - [ ] 标准物质证书
  - [ ] 溯源链清晰

  ### 5.6 外部提供的产品和服务
  - [ ] 供应商评价

  ### 6.2 人员
  - [ ] (同 5.2)

  ### 6.4 设备
  - [ ] (同 5.4)

  ### 6.5 计量溯源性
  - [ ] (同 5.5)

  ### 7.2 选样、验证和确认方法
  - [ ] 方法验证记录

  ### 7.5 技术记录
  - [ ] 所有检测原始数据完整

  ### 7.8 报告结果
  - [ ] 报告完整性
  - [ ] 电子签名合规
  ```

- [ ] **Task 4.11**: 内部审核(模拟 CNAS 审核)
  - 由 CNAS 顾问 + 内部质量负责人执行
  - 按 `docs/CNAS-SELF-CHECK.md` 逐条检查
  - 输出:`docs/INTERNAL-AUDIT-REPORT.md`

#### Day 8:补漏整改

- [ ] **Task 4.12**: 整改项
  - 根据内部审核发现的问题整改
  - 常见整改项:
    - 增加操作日志详情
    - 完善权限矩阵
    - 增加数据导出功能
    - 完善异常处理

- [ ] **Task 4.13**: 培训操作员
  - 检测员培训(3 人)
  - 校核员培训(2 人)
  - 审核员培训(1 人)
  - 批准人培训(1 人)
  - 设备/试剂管理员培训(2 人)
  - 系统管理员培训(1 人)

#### Day 9-10:文档完善

- [ ] **Task 4.14**: 完善操作手册
  - `docs/USER-MANUAL.md`(分角色:检测员 / 校核员 / 审核员 / 批准人 / 设备管理员 / 试剂管理员)
  - `docs/ADMIN-MANUAL.md`
  - `docs/TROUBLESHOOTING.md`

- [ ] **Task 4.15**: 完善架构决策记录
  - 补充任何新增的 ADR
  - 审查 ADR 状态(Proposed → Accepted)

- [ ] **Task 4.16**: 应急预案文档
  - `docs/EMERGENCY-PLAN.md`
  - 系统故障:切换备库
  - 数据库损坏:从备份恢复
  - 网络中断:离线模式启用
  - 勒索软件:隔离 + 异地恢复
  - 数据泄露:应急响应 + 通知监管

## 2. 交付物清单

| 类别 | 文件 |
|---|---|
| **审计 GUI** | `apps/frontend/src/views/audit/Chain.tsx` |
| **备份** | `infrastructure/docker/postgres/backup.sh`、`scripts/restore.sh` |
| **异地备份** | `infrastructure/terraform/oss-backup.tf` |
| **灾备文档** | `docs/DISASTER-RECOVERY.md` |
| **CNAS 自检** | `docs/CNAS-SELF-CHECK.md` |
| **内部审核** | `docs/INTERNAL-AUDIT-REPORT.md` |
| **操作手册** | `docs/USER-MANUAL.md`、`docs/ADMIN-MANUAL.md` |
| **应急预案** | `docs/EMERGENCY-PLAN.md` |
| **告警规则** | `infrastructure/docker/prometheus/alerts.yml` |
| **监控仪表盘** | `infrastructure/docker/grafana/dashboards/*.json` |

## 3. 验证标准

### 合规验证(关键)

- [ ] **V-4.1**: 审计链断链自检脚本通过(全库扫描 0 错误)
- [ ] **V-4.2**: 备份恢复演练 RTO ≤ 4 小时
- [ ] **V-4.3**: 异地备份验证成功(下载 + 解密 + SHA256 一致)
- [ ] **V-4.4**: CNAS 自检清单 100% 通过
- [ ] **V-4.5**: 内部审核报告输出

### 备份验证

- [ ] **V-4.6**: 每日自动备份成功
- [ ] **V-4.7**: 备份文件加密(AES-256)
- [ ] **V-4.8**: 备份文件异地同步成功
- [ ] **V-4.9**: 备份监控告警正常

### 文档验证

- [ ] **V-4.10**: 操作手册完整(分角色)
- [ ] **V-4.11**: 灾备方案完整
- [ ] **V-4.12**: 应急预案完整
- [ ] **V-4.13**: 培训记录齐全

## 4. 里程碑 M5:合规就绪

Phase 4 完成后,LIMS 达到 **M5 里程碑:合规就绪**。所有 CNAS 自检项目通过,内部审核报告完整,可正式申请 CNAS 现场审核。

## 5. 下阶段交付

Phase 4 完成后,进入 [Phase 5:CNAS 预审](./PHASE-5-cnas-audit.md)(1 周,性能压测 + 渗透测试 + 整改)
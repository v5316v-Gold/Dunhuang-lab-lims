# VMP — Validation Master Plan (验证主计划)

> **项目**: 敦煌金质检 LIMS
> **版本**: v1.0
> **日期**: 2026-08-13
> **编制依据**: GAMP 5 V-Model + ISO/IEC 17025:2017 §6.4 + CNAS-CL01:2018
> **范围**: Dunhuang-LIMS 全部计算机化系统(后端 + 前端 + 数据库 + 集成)
> **Phase**: 0.5 Baseline Hardening 完成版

---

## 1. 目的与范围

### 1.1 目的
本 VMP 描述 Dunhuang-LIMS 系统的**验证策略、文件清单、责任划分、风险评估方法、变更与周期性复核流程**,确保系统:
- 满足 CNAS-CL01:2018 §6.4「设备」+ §7.5「技术记录」+ §7.11「数据控制」
- 满足 ISO/IEC 17025:2017 同等条款
- 满足 ALCOA+ 数据完整性 9 原则
- 为 2026-11-03 CNAS 现场评审提供完整证据链

### 1.2 范围
| 范围项 | 是否包含 | 备注 |
|---|---|---|
| 后端 NestJS 应用 | ✅ | apps/backend |
| 前端 React + Vite SPA | ✅ | apps/frontend |
| PostgreSQL 16 + TimescaleDB | ✅ | 含 27 张业务表 + audit_logs |
| Redis 7 缓存/会话 | ✅ | 含认证与限流 |
| Prisma ORM | ✅ | 含 migration 系统 |
| audit_logs SHA256 链 | ✅ | 27 个 audit trigger + 3 个防篡改 trigger |
| 软删除机制 | ✅ | 7 个 model 自动 deletedAt 过滤 |
| 仪器数据采集(模拟) | ⏸ Phase 2+ | 当前 demo 用手工录入 |
| MinIO 对象存储 | ⏸ Phase 4 | 报告 PDF 存储,Phase 0 暂未集成 |
| CA 第三方电子签名 | ⏸ Phase 4 | mock 模式 |
| RabbitMQ 队列 | ⏸ Phase 3+ | 异步任务 |
| RFC 3161 时间戳 | ⏸ Phase 4 | CNAS 高级要求 |

### 1.3 不在范围
- 生产部署 K8s / CI-CD 流水线本身(由 IT 部门管理)
- 业务逻辑的市场/财务审计
- 单个仪器型号的校准证书(由设备管理员管理)

---

## 2. GAMP 5 分类判定

> **参考**: ISPE GAMP 5 — A Risk-Based Approach to Compliant GxP Computerized Systems, 2nd Edition (2022)

### 2.1 分类总览

| 组件 | GAMP 5 分类 | 理由 | 验证深度 |
|---|---|---|---|
| **PostgreSQL 16 + TimescaleDB** | **G1** 基础设施 | 商品化,厂商管理 | 厂商资质确认 + 安装验证(IQ) |
| **Redis 7** | **G1** 基础设施 | 商品化,厂商管理 | 厂商资质确认 + 安装验证(IQ) |
| **Docker 容器引擎** | **G1** 基础设施 | 商品化 | IQ |
| **Prisma ORM** | **G3** 可配置 COTS | 商业 COTS,通过 prisma schema 配置 | URS + FS + IQ + OQ + PQ |
| **NestJS 框架** | **G3** 可配置 COTS | 商业 COTS,配置文件路由 | URS + FS + IQ + OQ + PQ |
| **React + Vite 前端** | **G3** 可配置 COTS | 商业 COTS | URS + FS + IQ + OQ + PQ |
| **认证模块(AuthModule)** | **G4** 配置型 | 基于 NestJS/Passport 配置,JWT 密钥、TTL、RBAC 策略 | URS + FS + DS + IQ + OQ + PQ |
| **审计链 PostgreSQL 触发器** | **G4** 配置型 | 业务规则硬编码 SQL | URS + FS + DS + IQ + OQ + PQ + VSR |
| **软删除 Prisma Extension** | **G4** 配置型 | TypeScript 业务逻辑 | URS + FS + DS + IQ + OQ + PQ |
| **业务模块(样品/批次/检测/QC)** | **G4** 配置型 | TypeScript 业务逻辑 | URS + FS + DS + IQ + OQ + PQ |
| **业务 SQL 视图/存储过程** | **G5** 定制开发 | 任何自定义 PL/pgSQL | URS + FS + DS + Code Review + IQ + OQ + PQ |

### 2.2 关键判定依据

**为什么整个系统不上 G5**:
- 业务逻辑用 TypeScript(高级语言),不是 G5 定义的"底层代码"(汇编/二进制/C 中无类型部分)
- 数据库 schema 由 Prisma schema 描述,业务 SQL 用 Prisma migrate 生成,可追溯

**为什么审计链(审计 trigger)是 G4 不是 G3**:
- G3 是「不动配置」,COTS 本身有功能
- G4 是「配置 + 自定义代码」,我们写了 audit_chain.sql(自定义函数 + trigger)
- 防篡改是业务规则,不是商品化功能

---

## 3. 验证文件清单(V-Model)

### 3.1 完整 V-Model 文档层级

```
┌─ URS (User Requirements Specification)  ─── 用户需求
│    ↓
├─ FS  (Functional Specification)          ─── 功能规格
│    ↓
├─ DS  (Design Specification)               ─── 设计规格 (G4+)
│    ↓
├─ CC  (Configuration / Code)              ─── 配置/代码
│    ↓
├─ IQ  (Installation Qualification)        ─── 安装确认
├─ OQ  (Operational Qualification)         ─── 运行确认
├─ PQ  (Performance Qualification)         ─── 性能确认
│
├─ RTM (Requirements Traceability Matrix)   ─── 需求追溯矩阵
└─ VSR (Validation Summary Report)         ─── 验证总结报告
```

### 3.2 实际产出文件

| 文档 | 状态 | 路径 / 位置 |
|---|---|---|
| **VMP**(本文档) | ✅ v1.0 | `docs/validation/VMP.md` |
| **URS** 用户需求 | ⏸ 规划 | `docs/validation/URS.md`(Phase 5 完成) |
| **FS** 功能规格 | ⏸ 规划 | `docs/validation/FS.md` |
| **DS** 设计规格 | ⏸ 规划 | `docs/validation/DS.md` |
| **IQ** 安装确认 | ✅ Phase 0.5 | `docs/validation/IQ-checklist.md` |
| **OQ** 运行确认 | ✅ Phase 0.5 | 25 个 jest 集成测试(自动化) |
| **PQ** 性能确认 | ⏸ Phase 5 | `docs/validation/PQ-report.md` |
| **RTM** 需求追溯矩阵 | ⏸ Phase 5 | `docs/validation/RTM.md` |
| **VSR** 验证总结 | ⏸ Phase 5 | `docs/validation/VSR.md`(CNAS 现场前) |
| **FMEA** 风险评估 | ✅ Phase 0.5 | `docs/validation/FMEA-risk-assessment.md` |
| **Periodic Review** 计划 | ✅ Phase 0.5 | `docs/validation/periodic-review-plan.md` |
| **CSV Traceability** 追溯 | ⏸ Phase 5 | 记录每个 commit 对应 URS 编号 |
| **Vendor Audit** 供应商审计 | ⏸ Phase 5 | PostgreSQL / TimescaleDB / Prisma / NestJS 厂商 |

### 3.3 Phase 0.5 已完成验证(本 Gate)

| 验证项 | 类型 | 工具 | 结果 |
|---|---|---|---|
| BigInt JSON 序列化 | OQ | 集成测试 4 项 | ✅ PASS |
| AuditLog DTO 校验 | OQ | 集成测试 1 项 | ✅ PASS |
| Audit chain SHA256 链 | OQ | 集成测试 2 项 | ✅ PASS |
| audit_logs 防篡改 trigger | OQ | 集成测试 3 项 | ✅ PASS |
| 软删除 extension | OQ | 集成测试 6 项 | ✅ PASS |
| 核心垂直切片 E2E | OQ | 集成测试 7 项 | ✅ PASS |
| ESLint 0 errors | OQ | pnpm lint | ✅ PASS |
| Prisma migration baseline | IQ | migrate deploy on empty DB | ✅ PASS |
| **总计** | | **25 个 OQ 测试 + IQ** | **25/25 PASS** |

### 3.4 Phase 5 待完成验证

| 验证项 | 计划日期 | 责任方 |
|---|---|---|
| URS 编写(完整覆盖 11 域业务) | 2026-10-01 | LIMS 架构师 + 实验室主任 |
| FS 编写 | 2026-10-08 | 后端 Lead |
| DS 编写 | 2026-10-15 | 后端 Lead |
| PQ 性能测试(1000+ 样品/天) | 2026-10-22 | QA + 性能测试工程师 |
| RTM 需求追溯矩阵 | 2026-10-25 | QA |
| 供应商审计(3 家) | 2026-10-28 | IT + 采购 |
| VSR 验证总结报告 | 2026-10-30 | QA Manager |
| 内审 | 2026-11-01 | 内审员 |
| 管理评审 | 2026-11-02 | 实验室主任 + 管理层 |
| CNAS 现场评审 | 2026-11-03 | 接受外部评审 |

---

## 4. 责任划分

| 角色 | 责任 |
|---|---|
| **项目负责人 / LIMS 架构师**(用户) | VMP 维护,Phase gate 决策,跨 Phase 协调 |
| **后端 Lead** | FS/DS 编写,代码评审,G4 配置变更管理 |
| **QA Manager** | URS 评审,OQ/PQ 测试用例编写,VSR 编写 |
| **实验室主任** | 业务需求确认,UAT 用户验收测试 |
| **质量经理** | 偏差调查,变更控制,周期性复核 |
| **IT 运维** | IQ 安装确认,基础设施监控 |
| **CNAS 内审员** | 独立审计 VMP/VSR/Periodic Review |
| **实验室管理层** | 管理评审批准 |

---

## 5. 验证方法学

### 5.1 风险驱动验证

**核心原则**: 验证深度 ∝ 风险(严重性 × 可能性 × 可检测性)

| 风险等级 | 验证要求 |
|---|---|
| **极高** | G5 级:URS/FS/DS/CC + IQ/OQ/PQ + 独立代码评审 + 强化测试 |
| **高** | G4 级:URS/FS/DS + IQ/OQ/PQ + 代码评审 + 集成测试 |
| **中** | G3 级:URS/FS + IQ/OQ/PQ + 集成测试 |
| **低** | G1-2 级:厂商资质 + 安装验证 + 基础 smoke test |

### 5.2 详细 FMEA 见 [`FMEA-risk-assessment.md`](./FMEA-risk-assessment.md)

---

## 6. 变更控制

### 6.1 变更分级

| 变更类型 | 例子 | 验证要求 |
|---|---|---|
| **重大变更** | 改 audit 链算法,改认证机制 | 完整 V-Model 重跑 + VSR 更新 |
| **中等变更** | 改业务模块逻辑,改 SQL trigger | 影响分析 + 受影响 OQ 重跑 |
| **轻微变更** | 改 UI 样式,改日志格式 | 代码评审 + 回归测试 |
| **配置变更** | 改 env,改权限矩阵 | 文档更新 + 复核确认 |

### 6.2 变更流程
1. 提交变更申请(CR 编号)
2. 风险评估(GAMP 影响分析)
3. 影响范围评估(影响哪些 URS/FS/DS)
4. QA 审批
5. 实施 + 测试
6. 部署 + 验证
7. 文档更新

---

## 7. 偏差与 CAPA

任何验证过程中发现的偏差:
1. **记录**: 偏差报告(Deviation Report)
2. **分类**: 关键/重大/次要
3. **调查**: 根本原因分析(5 Whys / Fishbone)
4. **措施**: 短期 + 长期
5. **CAPA**: 预防 + 纠正
6. **关闭**: QA 复核 + 签字

---

## 8. 数据完整性(ALCOA+)

| 原则 | 实现机制 | 验证测试 |
|---|---|---|
| **A** ttributable | user_id UUID + JWT + audit chain | OQ: audit_log 含 user_id + username |
| **L** egible | UTF-8 + JSONB 原始数据 | OQ: 查询可见 |
| **C** ontemporaneous | DB `now()` 默认 + NTP | OQ: created_at 接近 now |
| **O** riginal | 27 trigger + append-only | OQ: 防篡改 trigger 验证 |
| **A** ccurate | Decimal 精度 + 多级审核 | OQ: 计算精度 + 范围校验 |
| **+ Complete** | DTO 必填校验 | OQ: 缺字段 400 |
| **+ Consistent** | FK + 事务 | OQ: 跨表外键 + rollback |
| **+ Enduring** | WAL + 备份 3-2-1 | IT 测试 |
| **+ Available** | 双机 + 灾备 | DR 演练(年度) |

---

## 9. 培训与资质

| 角色 | 必需培训 |
|---|---|
| 验证执行人员 | GAMP 5 基础 + ISO 17025 + 部门 SOP |
| QA 人员 | 风险管理 + 验证方法学 + 审计技巧 |
| 系统管理员 | LIMS 运维 + 备份恢复 + 安全加固 |
| 实验室用户 | 业务 SOP + 系统操作 + 数据录入规范 |
| 内审员 | ISO 19011 审核 + CNAS 认可准则 |

培训记录保存于 `docs/training/`。

---

## 10. VMP 维护

- **版本控制**: Git(本文件)
- **变更触发**:
  - 新增/删除 GAMP 分类组件
  - CNAS 条款更新
  - 重大事故 / 偏差
  - 周期性复核(每年)

- **当前版本**: v1.0(Phase 0.5 Baseline Hardening 完成)
- **下次评审**: 2026-11-03(CNAS 现场评审前) + 2027-08-13(年度复核)

---

## 11. 批准签字

| 角色 | 姓名 | 签字 | 日期 |
|---|---|---|---|
| 编制人(LIMS 架构师) | (用户) | _________ | 2026-08-13 |
| 审核(QA Manager) | _________ | _________ | _________ |
| 批准(实验室主任) | _________ | _________ | _________ |
| 批准(质量经理) | _________ | _________ | _________ |

---

## 附录 A:参考资料

1. **ISPE GAMP 5** — A Risk-Based Approach to Compliant GxP Computerized Systems (2nd Edition, 2022)
2. **ISO/IEC 17025:2017** — General requirements for the competence of testing and calibration laboratories
3. **CNAS-CL01:2018** — 《检测和校准实验室能力的通用要求》(等同采用 ISO/IEC 17025:2017)
4. **GB/T 27025-2019** — 中国等同采用 ISO/IEC 17025
5. **21 CFR Part 11** — Electronic Records; Electronic Signatures (FDA)
6. **EU GMP Annex 11** — Computerised Systems
7. **ICH Q9** — Quality Risk Management
8. **PIC/S PI 011-3** — Good Practices for Computerised Systems in Regulated Environments
9. **MHRA GxP** — Data Integrity Definitions and Guidance
10. **WHO TRS 996** — Annex 5 Guidance on Good Data and Record Management Practices

## 附录 B:本文件版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布,Phase 0.5 完成 | LIMS-Architect-01 |

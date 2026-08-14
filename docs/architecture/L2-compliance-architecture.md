# L2-合规架构 架构规范 (Compliance Architecture)

> **版本**: v1.0
> **日期**: 2026-08-13
> **编制**: LIMS-Architect-01(架构规范工程师)
> **评审**: 合规顾问、QA Manager
> **批准**: 实验室管理层 + 质量经理
> **状态**: 草案
> **模板依据**: `docs/architecture/TEMPLATE.md` v1.0

---

## 1. 节点名称

**L2-合规架构**(Compliance Architecture / CNAS-CL01 合规架构)

## 2. 建设目标

1. 建立 **CNAS-CL01:2018(等同 ISO/IEC 17025:2017)条款 → 系统功能**映射矩阵
2. 固化 **ALCOA+ 九原则**的系统实现方案
3. 定义**电子签名 / 审计追踪 / 权限分离(SoD)** 设计
4. 定义**数据保留与防篡改**红线
5. 为 L3-L7 提供合规输入,为 CNAS 现场评审提供证据框架

## 3. 业务范围

- **In-scope**:
  - CNAS-CL01:2018 全部适用条款的 LIMS 落地
  - ALCOA+ 九原则实现机制
  - 审计追踪(4 类事件:用户/数据/系统/安全)
  - 电子签名(21 CFR Part 11 对齐)
  - RBAC + 职责分离(SoD)
  - 数据保留策略(≥ 5 年)
- **Out-of-scope**:
  - 物理环境合规(设施/安全)→ 归 L6 基础设施
  - 验证证据链 → 归 L7 验证架构
  - 运维合规监控 → 归 L8 运维架构

## 4. 背景

系统已实现:27 张业务表审计 trigger + audit_logs 防篡改三层(UPDATE/DELETE/TRUNCATE)+ SHA256 审计链 + 软删除 extension + JWT/MFA 认证 + RBAC 守卫。`docs/04-CNAS-COMPLIANCE.md` 已有合规设计,`docs/validation/FMEA-risk-assessment.md` 有 48 风险点。本层将这些**固化为合规架构规范**,形成条款→实现→证据的完整链条。

## 5. 参与角色

| 角色 | 职责 | 编写/评审/批准 |
|---|---|---|
| 合规顾问 | 条款解读确认 | 评审 |
| QA Manager | 合规机制验收 | 评审/批准 |
| LIMS-Architect-01(架构师) | 本层编写 | 编写 |
| 实验室主任 | 合规决策 | 批准 |

## 6. 输入 - 输出

| 方向 | 来源/去向 | 内容 |
|---|---|---|
| 输入 | L1 业务架构 + `04-CNAS-COMPLIANCE.md` + `validation/FMEA` + 已实现审计链 | 流程、条款要求、风险、实现现状 |
| 输出 | L3(保留/防篡改)、L4(RBAC/审计实现)、L7(验证证据) | 条款映射矩阵、ALCOA+ 方案 |

## 7. 前置后置条件

- **前置**: L1 GATE PASS(流程确认)
- **后置**: 条款映射 100% 覆盖、ALCOA+ 九项各有实现、审计事件 4 类定义完整

## 8. 业务流程

合规落地流程(文字描述):

1. **法规识别**:识别适用标准(CNAS-CL01:2018 / ISO 17025:2017 / GB/T 27025-2019 / 21 CFR Part 11)
2. **条款映射**:逐条映射到系统功能(§16 矩阵)
3. **差距分析**:对照已实现功能找差距
4. **实现方案**:审计/签名/权限/保留机制设计
5. **验证**:OQ 测试证据(25 项已 PASS)
6. **持续监控**:L8 周期性复核

## 9. 状态机

### 9.1 合规项生命周期

| 状态 | 含义 | 进入事件 | 离开事件(目标) | 守卫条件 |
|---|---|---|---|---|
| IDENTIFIED | 条款识别 | 法规解读 | 映射完成 → MAPPED | 条款清单完整 |
| MAPPED | 已映射 | 条款→功能 | 实现完成 → IMPLEMENTED | 功能存在 |
| IMPLEMENTED | 已实现 | 代码完成 | 验证通过 → VERIFIED | OQ 测试 PASS |
| VERIFIED | 已验证 | 测试通过 | 监控启用 → MONITORED | 证据归档 |
| MONITORED | 持续监控 | 上线 | 失效 → 重新 VERIFIED | 周期复核 |

### 9.2 审计事件类型(4 类)

| 类型 | 事件 | 现状 |
|---|---|---|
| 用户事件 | 登录/登出/密码变更/MFA | ✅ JWT + user_sessions |
| 数据事件 | 业务数据增删改 | ✅ 27 trigger |
| 系统事件 | 服务启停/配置变更 | ⏳ Phase 3 补系统日志 |
| 安全事件 | 越权/爆破/审计篡改尝试 | ⏳ 部分(登录失败记录) |

## 10. 数据模型

合规数据模型:

| 实体 | 说明 |
|---|---|
| audit_logs | 审计链主表(prev_hash/curr_hash/action/table_name/record_id/new_data) |
| users + user_role_assignments | 身份与角色 |
| user_sessions | 会话/refresh token |
| reports + report_signatures | 电子签名记录 |
| reference_materials | 标准物质(QC 用) |

## 11. 字段

合规关键字段:

| 字段 | 类型 | 必填 | 约束/说明 |
|---|---|---|---|
| audit_logs.prev_hash/curr_hash | char(64) | 是 | SHA256 链 |
| audit_logs.action | varchar(100) | 是 | INSERT/UPDATE/DELETE:表名 |
| audit_logs.user_id | uuid | 否 | FK→users(系统操作可空) |
| report_signatures.signature | text | 是 | 电子签名数据 |
| user_role_assignments | 关联 | 是 | 角色分配 |

## 12. 业务规则

| 编号 | 规则 | 来源 | 可测试性 |
|---|---|---|---|
| BR-C-01 | audit_logs 禁止 UPDATE/DELETE/TRUNCATE | ALCOA+ Original | DB trigger(已验证) |
| BR-C-02 | 审计链 SHA256 逐条衔接 | ALCOA+ Enduring | verify 端点(已验证) |
| BR-C-03 | 业务表禁止物理删除(软删除) | §8.4 记录控制 | Prisma extension(已验证) |
| BR-C-04 | 电子签名 = 双因素 + 时间戳 + 不可否认 | 21 CFR Part 11 §11.50 | 签名流程 |
| BR-C-05 | 职责分离:检测≠审核≠签发 | CNAS §5.1 | RBAC 矩阵 |
| BR-C-06 | 数据保留 ≥ 5 年 | CNAS §8.4 | 归档策略 |
| BR-C-07 | 越权尝试记录安全审计事件 | §7.11 | 登录/访问日志 |
| BR-C-08 | 检测数据修改需原因 + 审批 | §7.5 | 修改流程 |
| BR-C-09 | 管理员不可修改审计数据 | ALCOA+ | trigger 无豁免 |

## 13. 异常处理

| 异常场景 | 检测方式 | 响应策略 |
|---|---|---|
| 审计链断链 | verify 端点 | P1 告警 + 调查(不得静默) |
| 审计篡改尝试 | trigger RAISE | 记录 + 安全事件 |
| 软删除绕过 | extension 拦截 | 拒绝 + 审计 |
| 电子签名失败 | 签名服务错误 | 重试/降级(mock) |
| 越权访问 | RBAC 拒绝 | 安全日志 + 告警 |

## 14. RBAC 要求

### 14.1 角色矩阵(SoD)

| 角色 | 样品 | 检测 | QC | 报告起草 | 报告审核 | 报告签发 | 审计查询 | 用户管理 |
|---|---|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LAB_DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| QUALITY_MANAGER | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| EQUIPMENT_MANAGER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| REAGENT_MANAGER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SENIOR_ANALYST | ✅ | ✅ | ✅ | ✅ | ✅ 一级 | ❌ | ❌ | ❌ |
| ANALYST | ✅ | ✅ | ✅ 录入 | ✅ | ❌ | ❌ | ❌ | ❌ |
| INTERN | 读 | 录入(受监督) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| EXTERNAL_AUDITOR | 只读 | 只读 | 只读 | 只读 | 只读 | 只读 | ✅ 只读 | ❌ |

**职责分离强制项**:检测员 ≠ 审核员 ≠ 签发人;质量经理可审核不可签发;管理员可管理用户不可改审计。

## 15. 审计要求

| 审计事件 | 触发条件 | 记录字段 | 现状 |
|---|---|---|---|
| 业务数据增删改 | 27 表 trigger | user/action/table/record/prev_hash/curr_hash | ✅ |
| 审计篡改尝试 | 防篡改 trigger | RAISE + 错误日志 | ✅ |
| 登录成功/失败 | 认证事件 | username/ip/时间/结果 | ✅ |
| 权限变更 | 角色分配 | 操作人/对象/新角色 | ⏳ 补 |
| 配置变更 | env/参数修改 | 变更内容/操作人 | ⏳ 补 |
| 电子签名 | 报告签发 | 签名人/时间戳/报告 | ✅ |

## 16. 合规要求 (CNAS/CMA/ISO 17025) — 条款映射矩阵

| CNAS-CL01:2018 条款 | 要求摘要 | 系统实现 | 验证证据 |
|---|---|---|---|
| §4.1 公正性 | 独立判断 | 角色隔离 + 审计 | RBAC 矩阵 |
| §4.2 保密性 | 客户数据保护 | 权限 + TLS | L6 安全 |
| §5.1 组织 | 职责清晰 | RACI + SoD | 本层 §14 |
| §6.1 人员 | 能力授权 | personnel/competency 模块 | Phase 3 |
| §6.2 设施和环境 | 环境监测 | EHS 模块(温湿度) | Phase 3 |
| §6.3 设备 | 设备管理 | equipment 模块 | Phase 3 |
| §6.4 计量溯源性 | 校准溯源 | calibrations 模块 | Phase 3 |
| §6.5 外部服务和供应品 | 分包/供应商 | 分包流程(归 L1) | Phase 3 |
| §7.1 要求、标书和合同评审 | 合同评审 | 委托流程 | vertical-slice |
| §7.2 方法的选择、验证和确认 | 方法验证 | methods + method_validations | Phase 3 |
| §7.3 抽样 | 抽样程序 | 样品接收流程 | Phase 3 |
| §7.4 检测物品处置 | 样品标识/留样 | sampleNo 唯一 + 留样 | ✅ |
| §7.5 技术记录 | 记录完整可追溯 | 27 trigger 审计链 | ✅ 25 测试 |
| §7.6 测量不确定度 | 不确定度评定 | purityPct + uncertainty | Phase 2 |
| §7.7 确保结果有效性 | 质量控制 | qc_measurements + Westgard | Phase 2 |
| §7.8 结果报告 | 报告内容/三级审核 | 报告状态机 | Phase 2 |
| §7.9 投诉 | 投诉处理 | 投诉流程 | Phase 3 |
| §7.10 不符合工作 | 不符合处理 | 不符合流程 | Phase 3 |
| §7.11 数据控制和信息管理 | 数据完整性 | ALCOA+ 全实现 | ✅ |
| §8.2 文件控制 | 文件版本管理 | 文件管理模块 | Phase 3 |
| §8.4 记录控制 | 记录保留 ≥5 年 | 归档策略 | L3 |
| §8.5 风险 | 风险管理 | FMEA(48 项) | ✅ |
| §8.7 纠正措施 | CAPA | 偏差/CAPA 模块 | Phase 3 |
| §8.8 内部审核 | 内审 | 内审模块 | Phase 5 |
| §8.9 管理评审 | 管理评审 | 管理评审记录 | Phase 5 |

### ALCOA+ 九原则实现

| 原则 | 实现机制 | 验证 |
|---|---|---|
| A ttributable | user_id + JWT + 强制登录 | ✅ |
| L egible | UTF-8 + JSONB 原始数据 | ✅ |
| C ontemporaneous | DB now() + NTP | ✅ |
| O riginal | append-only trigger | ✅ |
| A ccurate | Decimal 精度 + 校验 | ✅ |
| + Complete | DTO 必填 | ✅ |
| + Consistent | FK + 事务 | ✅ |
| + Enduring | WAL + 备份 3-2-1 | L6 |
| + Available | 灾备 | L6 |

## 17. API 要求

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /audit-logs | ADMIN/QUALITY_MANAGER | 审计查询 |
| GET | /audit-logs/verify | ADMIN/QUALITY_MANAGER | 链验证 |
| GET | /audit-logs/:id/verify | ADMIN/QUALITY_MANAGER | 单条验证 |

## 18. 验收标准

- [ ] 条款映射矩阵覆盖 CNAS-CL01:2018 全部适用条款(§4-§8)
- [ ] ALCOA+ 九原则每项有关联实现与验证
- [ ] 审计事件 4 类定义完整(用户/数据/系统/安全)
- [ ] SoD 矩阵强制项生效(检测≠审核≠签发)
- [ ] 电子签名规格符合 21 CFR Part 11 §11.50/§11.70/§11.100
- [ ] 数据保留策略 ≥ 5 年定稿
- [ ] 已有 25 项合规相关测试作为验证证据
- [ ] Gate 检查表 G1-G8 全 PASS

## 19. 依赖关系

- **上游依赖**: L1 业务架构(流程)
- **下游供应**: L3(保留/防篡改数据层)、L4(RBAC/审计实现)、L7(验证证据链)

## 20. 附录

### 20.1 参考资料

- `docs/04-CNAS-COMPLIANCE.md`
- `docs/validation/FMEA-risk-assessment.md`
- `infrastructure/docker/postgres/triggers/audit_chain.sql` + `audit_chain_triggers.sql` + `no_modify_audit_triggers.sql`
- `apps/backend/src/infrastructure/prisma/soft-delete.extension.ts`
- 21 CFR Part 11(Electronic Records; Electronic Signatures)

### 20.2 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布 | LIMS-Architect-01 |

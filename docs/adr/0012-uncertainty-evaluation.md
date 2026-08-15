# ADR-0012: 测量不确定度(MU)评定模块设计

> **状态**: APPROVED(Phase 1B P0-A)
> **日期**: 2026-08-15
> **决策人**: LIMS-Architect-01
> **关联**: CNAS-CL01:2018 §7.8 / ISO/IEC 17025:2017 §7.6.1 / GUM JCGM 100:2008

---

## 1. 背景(CNAS 评审必问)

CNAS-CL01:2018 §7.8.1 报告需含"**结果的不确定度**" + §7.6.1 需"**评定不确定度**"。

**当前缺口**(Phase 1A 报告 G-01):
- `Test.uncertainty` 字段是手填的,无 5 类分量来源
- 评审员问"你这 Au 99.99% ± 0.02% 怎么算?"答不上来
- 无计算附件(Excel / GUM Workbench 输出)
- 无标准评定流程(国标 / 北师大公式 / 简化 GUM)

## 2. 决策

### 2.1 不确定度分类(5 类 GUM A/B)

| 类别 | 含义 | 本实验室具体来源 |
|---|---|---|
| **u_A(Type A)** | 统计不确定度 | 平行样 n 次测量的标准偏差 / √n |
| **u_B(Type B-std)** | 标准物质证书 | GBW 标准物质的 U(k=2)证书值 |
| **u_B(Type B-equip)** | 仪器校准 | 天平 / ICP / 试金炉校准证书的 U |
| **u_B(Type B-vol)** | 容量器具 | 容量瓶 / 滴定管 / 移液管的允差 |
| **u_B(Type B-env)** | 环境条件 | 温度 / 湿度波动影响 |
| **u_B(Type B-other)** | 其他 | 试剂纯度 / 回收率等 |

### 2.2 计算方法

**合成标准不确定度**:
$$u_c = \sqrt{u_A^2 + u_{B,std}^2 + u_{B,equip}^2 + u_{B,vol}^2 + u_{B,env}^2 + u_{B,other}^2}$$

**扩展不确定度**(k=2,95% 置信):
$$U = k \cdot u_c = 2 \cdot u_c$$

**纯度结果表达**:
$$X = \bar{x} \pm U, \quad k=2$$

### 2.3 自动计算实现

**MVP 方案** — 不引入 R 语言 / numpy,纯 TypeScript:
- 输入 5 类分量(数字 + 单位)
- 实时计算 u_c、U
- 输出 UncertaintyReport(状态 DRAFT)
- 状态机:`DRAFT → REVIEWED → PUBLISHED`,每步审计
- PUBLISHED 后冻结(Test.uncertainty 自动从 report 同步,不可改)

### 2.4 报告与 Test 关系

| 项 | 决定 |
|---|---|
| 每个 Test 1 对 1 UncertaintyReport | ✅ |
| Test.uncertainty 字段保留 | ✅(同步自 report,避免破坏现有数据) |
| 计算附件(PDF/Excel)上传 | ✅(FileAttachment 关联) |
| 自动同步触发时机 | `report.publishedAt` 时,异步写 Test.uncertainty |
| 历史 Test(无 report) | 保留 `uncertainty` 字段(手填) |

## 3. Schema 设计(5 类分量 + 5 状态)

见 `prisma/schema.prisma` `UncertaintyReport` model。

## 4. 替代方案评估

| 方案 | 优劣 |
|---|---|
| ✅ TypeScript 手写(选)| 零新依赖,与现有 stack 一致 |
| ❌ numpy via Pyroscope | 引入 Python 运行时,过重 |
| ❌ 调用 GUM Workbench 外部 API | 依赖外部服务,不可控 |
| ❌ R + Plumber | 新语言栈,运维成本高 |

## 5. 影响

- 新增 1 张表 `UncertaintyReport`
- 新增 6 个字段到 `Test`(uncertainty 派生自 report)
- 新增 2 个 API 端点
- 新增 1 个 state machine(UncertaintyReportStatus)
- 新增 1 个 RBAC role:`REVIEW_UNCERTAINTY` (QA)
- 新增 3 个 audit 事件:`UNCERTAINTY_DRAFTED` / `UNCERTAINTY_REVIEWED` / `UNCERTAINTY_PUBLISHED`

## 6. 验收

- 测试覆盖率:u_c、U、k 系数 5+ 边界用例
- E2E:创建 Test → 创建 UncertaintyReport DRAFT → 录入 5 类分量 → 提交 REVIEWED → 批准 PUBLISHED → Test.uncertainty 自动同步
- 评审现场演示:打开测试 → "这把'0.02%'是怎么算的?" → 显示 5 类分量 + GUM 计算过程 + 附件
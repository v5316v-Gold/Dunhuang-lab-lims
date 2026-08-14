# 专家级代码执行方案 (CODE-EXECUTION-PLAN)

> **项目**: 敦煌金质检 LIMS
> **方案版本**: v1.0
> **日期**: 2026-08-13
> **编制**: LIMS-Architect-01(架构规范工程师)
> **输入**: `docs/architecture/` L0-L8 架构规范(GATE 10/10 PASS)
> **基线**: commit `6011509`(Phase 0.5 PASS,25/25 测试)
> **目标**: 2026-11-03 CNAS 现场评审

---

## 0. 方案定位

本方案将 **L0-L8 架构规范** 转化为**可执行的分阶段代码任务清单**,每个任务精确到**文件级**。严格遵循架构层级约束,不调整层级、不越层实现。

```
架构(L0-L8,已完成)→ 本方案(代码执行)→ 分阶段落地(Phase 1-5)→ CNAS(2026-11-03)
```

---

## 1. 架构 → 代码映射(总纲)

| 架构层 | 代码落点 | 关键工件 |
|---|---|---|
| L0 项目架构 | 仓库根 + `docs/` + `.github/workflows/` | CI 流水线、ADR、项目章程 |
| L0.5 领域架构 | `apps/backend/prisma/schema.prisma` + `src/modules/*/domain/` | 30 表模型、领域枚举、领域常量 |
| L1 业务架构 | `src/modules/*/service/` + `state-machine.ts` | 业务流程服务、状态机 |
| L2 合规架构 | `src/common/audit/` + `infrastructure/docker/postgres/triggers/` + `guards/` | 审计链、防篡改、RBAC、签名 |
| L3 数据架构 | `prisma/` + `src/infrastructure/prisma/` | migrations、软删除 extension、归档脚本 |
| L4 应用架构 | `src/modules/*/controller+dto/` | API 契约、校验 DTO |
| L5 技术架构 | `package.json` / `tsconfig` / `.eslintrc.cjs` / `turbo.json` | 工程规范 |
| L6 基础设施架构 | `docker-compose.yml` / `infrastructure/k8s/` / 备份脚本 | 部署、备份 |
| L7 验证架构 | `apps/backend/test/` + `docs/validation/` | 测试体系、VMP |
| L8 运维架构 | `scripts/ops/` + 监控配置 | SOP、监控、告警 |

---

## 2. 工程基座(先决条件,1-2 天)

### 2.1 现状(Phase 0.5 已具备)
- ✅ pnpm workspace + Turborepo
- ✅ ESLint 0 errors(52 warnings 待清)
- ✅ Jest 25 集成测试
- ✅ CI 4 jobs(lint/typecheck/build/test)
- ✅ Prisma 2 migrations + 软删除 extension
- ✅ 27 审计 trigger + 3 防篡改

### 2.2 需补齐(本方案 Phase 1 首周)

| 任务 | 文件 | 说明 |
|---|---|---|
| commitlint 接入 | `commitlint.config.js` + CI job | 强制约定式提交 |
| 路径别名统一 | 各 `tsconfig.json` `paths` | `@lims/*` 替代长相对路径 |
| 覆盖率门禁 | `jest.config` `coverageThreshold` | 单元 ≥ 70%,集成 ≥ 60% |
| 代码评审模板 | `.github/PULL_REQUEST_TEMPLATE.md` | 五维评审清单 |
| 依赖漏洞扫描 | CI job(OSV/SNYK) | 每周扫描 |
| 环境变量 Schema | `apps/backend/src/config/env.schema.ts` | 启动时校验 env 完整性 |

---

## 3. 后端代码实现规格(按模块)

> 每个模块规格:现状 → 补全任务(文件级)→ 验收测试。顺序遵循 L4 依赖:横切 → 核心域 → 支撑域。

### 3.1 横切层(common + infrastructure)

| 模块 | 现状 | 补全任务 | 文件 |
|---|---|---|---|
| auth | JWT+refresh+TOTP+RBC 完整 | ① 密码强度策略增强 ② MFA 强制开关 ③ 登录失败锁定(5 次/15min) ④ refresh 旋转已验证 | `auth.service.ts`、`password.service.ts`、`dto/auth.dto.ts` |
| audit | 4 端点 + DTO + 链验证 | ① 系统事件(启动/配置变更)审计 ② 安全事件(越权/爆破)审计 ③ 审计查询导出 CSV | `audit.service.ts`、`audit.controller.ts`、`audit-event.enum.ts` |
| rbac | 角色守卫完整 | ① row-level 权限(样品归属校验)② 角色-权限矩阵常量抽取 | `guards/rbac.guard.ts`、`permissions.ts` |
| prisma | 软删除 extension | ① 分页/过滤公共工具 ② 事务重试(冲突重试 3 次) | `prisma.service.ts`、`prisma.utils.ts` |
| redis | 连接 | ① 缓存抽象(查询缓存)② 限流计数器 | `redis.service.ts`、`cache.service.ts` |
| minio | 模块骨架 | ① 文件上传/下载 ② 预签名 URL ③ 样品照片关联 | `minio.service.ts`(Phase 4 启用) |
| queue | 骨架 | ① BullMQ 接入(Phase 3 启用) | `queue.service.ts` |
| health | 完整 | ① 深度健康检查(DB/Redis/MinIO) | `health.controller.ts` |

### 3.2 核心域模块(Phase 2 主战场)

#### 3.2.1 identity(用户/部门)— 已有基础
| 任务 | 文件 | 验收 |
|---|---|---|
| users CRUD 完整化(软删除已自动) | `users.service.ts`、`dto/user.dto.ts` | 集成测试:创建/禁用/恢复 |
| 部门树 + 用户归属校验 | `departments.service.ts` | 部门唯一、删除级联校验 |
| 用户状态机(ACTIVE/LOCKED/PENDING) | `users.state-machine.ts`(新) | 锁定→解锁流程测试 |

#### 3.2.2 sample(样品)— 已有基础
| 任务 | 文件 | 验收 |
|---|---|---|
| 样品状态机补全(9 态守卫) | `sample.state-machine.ts`(新) | 非法流转拒绝测试 |
| 编号生成器(YYMMDD-NNNN 并发安全) | `sample-number.generator.ts`(新) | 并发 100 次无重复 |
| 样品照片上传关联 | `sample.service.ts` | 上传→关联→查询 |
| 留样到期提醒 | `sample-retention.service.ts`(新) | 定时任务提醒 |

#### 3.2.3 batch(批次)— 已有基础
| 任务 | 文件 | 验收 |
|---|---|---|
| 11 态状态机守卫完整化(工艺参数校验) | `batch.state-machine.ts` | 状态推进参数校验测试 |
| 平行样数量校验(≥3) | `batch.service.ts` | 创建批次校验 |
| 批次-样品-检测联动事务 | `batch.service.ts` | 添加样品原子性测试 |

#### 3.2.4 test(检测)— 已有基础
| 任务 | 文件 | 验收 |
|---|---|---|
| 火试金计算器精度审计(decimal 全链路) | `fire-assay.calculator.ts` | 已知值测试(0.1% 误差内) |
| 纯度+不确定度计算完整化 | `fire-assay.calculator.ts` | GB/T 9288 算例 |
| ICP 模块补全(元素结果录入/解析) | `icp.service.ts`、`icp.controller.ts` | ICP 流程集成测试 |
| 结果修改留痕(原因+审批) | `test.service.ts` | 修改审计测试 |

#### 3.2.5 qc(质控)— 已有 Westgard 服务
| 任务 | 文件 | 验收 |
|---|---|---|
| Westgard 规则引擎完整(1-2s/1-3s/R-4s 等) | `westgard.service.ts` | 规则表驱动测试 |
| QC 趋势图数据接口 | `qc.controller.ts` | 趋势端点测试 |
| 回收率/RSD 自动计算入库 | `qc.service.ts` | 计算正确性测试 |
| QC 失败 → 批次联动(REJECTED) | `qc.service.ts` | 联动测试 |

#### 3.2.6 report(报告)— 骨架
| 任务 | 文件 | 验收 |
|---|---|---|
| 报告模板引擎(模板→数据渲染) | `report-template.service.ts`(新) | 模板渲染测试 |
| 三级审核流程(起草→审核→批准→签发) | `report.state-machine.ts` | 状态机测试 |
| 电子签名(双因素+时间戳,Phase 4 接 CA) | `report-signature.service.ts`(新) | 签名验证测试 |
| 报告 PDF 生成(Phase 4 接 Puppeteer/MinIO) | `report/pdf/` | 生成+存储测试 |
| 报告退改流程(留痕) | `report.service.ts` | 退改审计测试 |

### 3.3 支撑域模块(Phase 3)

| 模块 | 任务 | 验收 |
|---|---|---|
| equipment | 全生命周期(校准/维护/期间核查)+ 校准到期拦截检测 | 设备-检测联动测试 |
| reagent | 库存/效期预警/批号追溯 + 用量核算 | 库存扣减原子性测试 |
| personnel | 培训/能力矩阵/上岗授权 + 授权-任务联动 | 无授权不可检测测试 |
| ehs | 隐患/应急 + 环境监测(温湿度) | 报警测试 |
| analytics | 趋势/统计/BI 接口 | 聚合正确性测试 |

---

## 4. 前端代码实现规格

### 4.1 工程层
| 任务 | 文件 | 说明 |
|---|---|---|
| API client 统一(错误码映射/重试/401 跳转) | `src/data/api.ts`(重构) | 拦截器统一 |
| 路由守卫(未登录/权限) | `src/app/router.tsx` | 前端 RBAC 对齐 |
| 表单校验统一(Zod schema 复用) | `src/utils/validation.ts` | 与后端 DTO 对齐 |
| 错误提示统一(Toast/页级) | `src/components/ErrorBoundary.tsx` | 全局异常 |

### 4.2 页面清单(Phase 2 交付)

| 页面 | 现有 | 补全 |
|---|---|---|
| 登录 + MFA | `Login.tsx` ✅ | MFA 输入流 |
| 样品接收 | `SampleReceive.tsx` ✅ | 拍照上传、编号回显 |
| 样品列表 | `SamplesList.tsx` ✅ | 筛选/分页 |
| 批次列表/详情 | `BatchesList/BatchDetail.tsx` ✅ | 11 态推进面板、工艺参数录入 |
| 火试金录入 | `FireAssayForm.tsx` ✅ | 平行样表格、计算实时预览 |
| QC 看板 | `QcDashboard.tsx` ✅ | Westgard 图、趋势 |
| 报告列表/详情 | `ReportsList.tsx` | 模板预览、审核流、签发 |
| 设备/试剂/人员 | 列表页 ✅ | 详情/表单 |
| 审计日志 | `AuditLogs.tsx` ✅ | 筛选/导出 |

---

## 5. 数据库与迁移计划

| 迁移 | 内容 | 触发 |
|---|---|---|
| `20260813_baseline` ✅ | 30 表全量 | 已应用 |
| `20260813_softdelete_samplebatch` ✅ | deleted_at | 已应用 |
| Phase 2 迁移(1) | report 模板字段、qc 规则表、sample 照片关联 | Phase 2 首周 |
| Phase 2 迁移(2) | 编号序列(并发安全)、设备-校准关联补全 | Phase 2 次周 |
| Phase 3 迁移 | personnel 能力矩阵、ehs 环境监测、analytics 物化视图 | Phase 3 |
| Phase 4 迁移 | 签名密钥表、归档分区、数据保留策略表 | Phase 4 |

**规则**:每次迁移必须空库 deploy 验证(影子库)+ 回滚预案;migration 文件入 git。

---

## 6. 测试策略(与 L7 对齐)

| 层 | 类型 | 现有 | 目标 | 位置 |
|---|---|---|---|---|
| 单元 | 计算器/状态机/Westgard/编号生成器 | 0 | ≥ 40 用例 | `test/unit/` |
| 集成 | 模块 API + 审计链 | 25 | ≥ 60 | `test/integration/` |
| E2E | 垂直切片 | 7 | ≥ 15(全流程含报告) | `test/integration/vertical-slice.spec.ts` |
| 性能 | PQ | 0 | Phase 5:1000 样品/天 | `test/performance/` |

**门禁**:CI 中 `pnpm test` 全 PASS + 覆盖率阈值;P1 缺陷不合并。

---

## 7. CI/CD 演进

| 阶段 | 新增 | 说明 |
|---|---|---|
| 现在 | 4 jobs | lint/typecheck/build/test |
| Phase 1 | commitlint + 覆盖率门禁 + SCA | 质量门禁完整 |
| Phase 2 | 自动部署 staging | 合并 main → 自动部署 |
| Phase 4 | 生产发布流水线(滚动+回滚) | 审批门禁 |

---

## 8. 分阶段执行计划(映射 Phase 1-5)

### Phase 1 — 基础设施 + 工程加固(2026-08 下旬,1-2 周)

**目标**:工程基座完备 + 横切补全 + 基础设施落地。

| # | 任务 | 层映射 | 验收 |
|---|---|---|---|
| 1.1 | commitlint + PR 模板 + 覆盖率门禁 | L5 | CI 绿 |
| 2.1 | 系统/安全审计事件补全 | L2 | 审计测试 PASS |
| 2.2 | row-level 权限 + 密码策略 + 登录锁定 | L2/L4 | 安全测试 PASS |
| 2.3 | env schema 校验 + 配置中心化 | L5 | 启动校验 |
| 2.4 | K8s 部署(dev/staging)+ 监控栈(Prometheus/Grafana) | L6 | staging 可用 |
| 2.5 | 备份脚本(WAL+全量)+ 恢复演练 | L6 | 恢复 < 4h |
| 2.6 | 深度健康检查 | L6 | /health 全绿 |

**Gate**:CI 全绿 + 25 测试不回归 + staging 部署成功。

### Phase 2 — 核心业务闭环(2026-09 上旬,2-3 周)

**目标**:样品→批次→火试金/ICP→QC→报告**端到端业务化**(可演示)。

| # | 任务 | 层映射 | 验收 |
|---|---|---|---|
| 2.1 | sample 状态机 + 编号生成器 + 照片 | L0.5/L1 | 集成测试 |
| 2.2 | batch 11 态完整 + 平行样校验 | L0.5/L1 | 状态机测试 |
| 2.3 | fire-assay 计算器精度审计 + ICP 补全 | L0.5 | 算例测试 |
| 2.4 | Westgard 引擎完整 + QC 联动 | L0.5 | 规则测试 |
| 2.5 | 报告模板 + 三级审核 + 退改 | L1 | 流程测试 |
| 2.6 | 前端页面补全(火试金表单/QC 看板/报告) | L4 | E2E 15 项 |
| 2.7 | 单元测试 ≥ 40 用例 | L7 | 覆盖率 ≥ 70% |

**Gate**:E2E 15 项 PASS + 集成 ≥ 60 项 + 可演示完整流程。

### Phase 3 — 横向扩展(2026-09 下旬,2-3 周)

| # | 任务 | 验收 |
|---|---|---|
| 3.1 | equipment 全生命周期 + 校准拦截 | 联动测试 |
| 3.2 | reagent 库存/效期/追溯 | 原子性测试 |
| 3.3 | personnel 能力矩阵 + 授权联动 | 授权测试 |
| 3.4 | ehs 环境监测 + 报警 | 报警测试 |
| 3.5 | analytics BI 接口 | 聚合测试 |
| 3.6 | 前端 13 模块页面全覆盖 | E2E 扩展 |

**Gate**:13 模块全上线 + 测试全绿。

### Phase 4 — 合规加固(2026-10 上旬,2 周)

| # | 任务 | 层映射 | 验收 |
|---|---|---|---|
| 4.1 | 电子签名(CA mock→真实,双因素+时间戳) | L2 | 签名验证测试 |
| 4.2 | 报告 PDF(Puppeteer)+ MinIO 存储 | L2/L4 | 生成+存储 |
| 4.3 | 数据归档(>1 年)与销毁(>5 年)策略实现 | L3 | 归档任务测试 |
| 4.4 | 灾备 DR 演练(季度第 1 次) | L6 | RTO ≤ 4h |
| 4.5 | 等保 2.0 差距整改 | L6 | 差距 ≤ 3 |

**Gate**:签名/PDF/归档可用 + DR 演练报告。

### Phase 5 — CNAS 预审(2026-10 下旬,2 周)

| # | 任务 | 验收 |
|---|---|---|
| 5.1 | URS/FS/DS/RTM 文档完成 | V-Model 齐全 |
| 5.2 | 性能 PQ(1000 样品/天压测) | P95 < 500ms |
| 5.3 | 安全渗透测试 | 无高危 |
| 5.4 | VSR 验证总结 + 内审 + 管理评审 | 证据链完整 |
| 5.5 | 模拟 CNAS 现场评审 | 不符合项 ≤ 3 |

**Gate**:CNAS 现场评审可申请(2026-11-03)。

---

## 9. 依赖顺序与并行度

```
Phase 1 (横切+基础设施)
   │
Phase 2 (核心业务闭环) ← 依赖 Phase 1 的 row-level/审计
   │
Phase 3 (支撑域) ← 可与 Phase 2 尾期并行(equipment/reagent 独立)
   │
Phase 4 (合规加固) ← 依赖 Phase 2 报告模块
   │
Phase 5 (CNAS 预审) ← 全依赖
```

**并行建议**:Phase 2 期间,equipment/reagent/personnel 可 2 人并行(独立模块,仅依赖 schema);analytics 最后。

---

## 10. 代码评审五维清单(每次 PR)

| 维度 | 检查项 |
|---|---|
| 可读性 | 命名/注释/复杂度 ≤ 15 |
| 可维护性 | 模块边界/依赖方向(ADR-0001)/重复代码 |
| 性能 | N+1 查询/大表扫描/缓存命中 |
| 安全 | 注入/越权/敏感数据/限流 |
| 合规 | 审计事件覆盖/软删除/电子签名链/状态机守卫 |

---

## 11. 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| 火试金计算精度 | 报告错误 | 算例驱动测试 + 双人复核 |
| 电子签名集成 | Phase 4 延期 | 提前 POC + mock 兜底 |
| 前端工作量 | Phase 2 延期 | 组件复用 + 后端先行 |
| 性能不达标 | Phase 5 | 提前压测 + 索引优化预案 |
| 人员并行冲突 | 模块耦合 | schema 冻结 + 接口先行 |

---


### 技术备注(Phase 1 实盘发现)

**覆盖率收集**: 集成测试(jest-e2e.json)在 ts-jest + tsconfig `rootDirs` 组合下 coverage 收集为 0(已知兼容性限制,coverageMap 为空)。处理:
- Phase 1: CI 跑 --coverage 收集报告上传 artifact(不设硬门禁)
- Phase 2: 建独立单元测试 jest config(tsconfig.unit.json 不含 rootDirs)启用 coverageThreshold(statements ≥ 70)
- 已记录于 commitlint/PR 模板/覆盖率相关 commit

## 12. 版本历史

| 版本 | 日期 | 变更 | 编制 |
|---|---|---|---|
| v1.0 | 2026-08-13 | 首次发布(基于 L0-L8 架构) | LIMS-Architect-01 |

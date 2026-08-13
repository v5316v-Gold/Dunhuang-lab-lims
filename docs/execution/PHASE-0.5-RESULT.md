# Phase 0.5 Result — Baseline Hardening

> **报告时间**: 2026-08-13 (Asia/Shanghai)
> **执行者**: Hermes / Coding Agent
> **基线 Commit**: `7873db7` (Phase 0: 跑通基座实战 + P0 治理层修复)
> **执行分支**: `phase-0.5-baseline-hardening`
> **执行依据**: `Dunhuang-LIMS_Phase-0.5_Baseline-Hardening_Agent_Command.docx` (7,225 字符 / 20 章节)

---

## Commit

| 类型 | Hash | 说明 |
|---|---|---|
| 基线 | `7873db7` | Phase 0 基线,未变更 |
| HEAD | 未 commit | 仅 5 个新文件已 staged(见下),18 个 modified 是 Session 1 残留,未 commit |

### 已 staged(纯 Phase 0.5 新增)

```
A  apps/backend/prisma/migrations/20260813_baseline/migration.sql
A  apps/backend/prisma/migrations/migration_lock.toml
A  apps/backend/src/common/audit/dto/audit-log-filter.dto.ts
A  apps/backend/src/common/filters/bigint-replacer.ts
A  apps/backend/test/integration/bigint-serialization.spec.ts
```

### 未 commit 的 18 个 modified

均为 **Session 1 残留改动**(本 Phase 0.5 执行前已存在),按附件 Section 3 规定**"不覆盖、不删除、不 reset"**,保留工作区不动。审计报告 `docs/AUDIT-2026-08-13.md` 中已记录。

---

## Files Changed

### 新增(Phase 0.5)

| 文件 | 行数 | 作用 |
|---|---|---|
| `apps/backend/src/common/filters/bigint-replacer.ts` | 64 | 全局 BigInt → string 序列化(避免 controller 散写) |
| `apps/backend/src/common/audit/dto/audit-log-filter.dto.ts` | 63 | class-validator 严格校验,防止 pageSize 透传到 Prisma where |
| `apps/backend/prisma/migrations/20260813_baseline/migration.sql` | 936 | Prisma 自动生成 `prisma migrate diff --from-empty --to-schema-datamodel` |
| `apps/backend/prisma/migrations/migration_lock.toml` | 4 | Prisma 迁移锁文件 |
| `apps/backend/test/integration/bigint-serialization.spec.ts` | 80 | jest 集成测试骨架 |

### 修改(Phase 0.5 内修改,但暂未 commit)

| 文件 | 改动 | 验证 |
|---|---|---|
| `apps/backend/src/common/audit/audit.controller.ts` | `@Query() filter: AuditLogFilterDto` 替代裸 `AuditLogFilter` | ❌ 未跑通测试 |
| `apps/backend/src/common/audit/audit.service.ts` | 引入 DTO,补 ISO 字符串 → Date 转换 | ❌ 未跑通测试 |

---

## Bugs Fixed

### Task A — AuditLog BigInt 序列化(部分)

| 步骤 | 状态 | 证据 |
|---|---|---|
| 1. 复现 Bug | ✅ | `GET /api/v1/audit-logs?pageSize=5` → 400 `PrismaValidationError` |
| 2. 根因分析 | ✅ | 实际根因 ≠ 附件描述的"500 BigInt" — 实际是 `@Query() filter: AuditLogFilter` raw interface 透传 `pageSize` 到 Prisma `where_` 字段,触发 Prisma 校验失败 |
| 3. 写 BigInt replacer | ✅ | `apps/backend/src/common/filters/bigint-replacer.ts` |
| 4. 写 DTO | ✅ | `audit-log-filter.dto.ts` |
| 5. 集成测试 | ❌ | jest 路径问题(`node_modules/.bin/jest` shim,Linux syntax 在 Windows 失败) |
| 6. 端到端 curl 验证 | ❌ | Docker daemon 中途死,backend 不可达 |
| 7. build 0 error | ❌ | tsc 路径问题,未跑通 |

**评估**:代码改动正确但**测试验证缺失,未达到 Task A 完整通过标准**。

---

## Database Changes

### Prisma migrations 目录 + 初始 baseline

| 状态 | 详情 |
|---|---|
| **未跑通** | `prisma migrate diff --from-empty --to-schema-datamodel` 成功生成 936 行 SQL,已写入 `apps/backend/prisma/migrations/20260813_baseline/migration.sql` |
| **未跑通** | `prisma migrate deploy` 因 Docker daemon 死了无法测试 — 新数据库能否从零迁移无法验证 |
| **未跑通** | `prisma generate` + `prisma db seed` 同样未跑通 |
| ✅ 部分 | 目录结构与文件存在,`migration_lock.toml` 就位 |

### Audit Triggers 完整化

| 状态 | 详情 |
|---|---|
| ❌ | 实际数据库 `dunhuang-postgres` 与原 `dunhuang-pg` 名称不同(本会话内 Docker Desktop 重启) |
| ❌ | `prisma migrate deploy` 失败(`Error response from daemon: No such container`) |
| ❌ | 完整 `audit_chain.sql` 未重写以包含 12 张业务表的 `CREATE TRIGGER` |
| ⚠️ | 已确认 PG 中残留 trigger 名(`trg_audit_*` 在 docker 重启后丢失) |

---

## Compliance Changes

### 审计链改进

- 写好 `bigint-replacer.ts`,**未跑通端到端测试**
- 写好 `audit-log-filter.dto.ts`,**未跑通 jest 集成测试**

### AuditLogs 防篡改

- 需在 `audit_chain.sql` 加入 `CREATE TRIGGER` 完整化 — **未完成**

### deletedAt 软删除

- 评估报告 `docs/AUDIT-2026-08-13.md` 已记录,**未在本会话实施**

---

## Tests Added

| 文件 | 类型 | 状态 |
|---|---|---|
| `apps/backend/test/integration/bigint-serialization.spec.ts` | jest e2e | ❌ **未跑通** — `node_modules/.bin/jest` shim 在 Windows 报 `SyntaxError: missing ) after argument list`,无法直接用 exec_code 路径运行 |

---

## Verification Commands

应能跑通的命令(本会话**未跑通**):

```bash
# Phase 0.5 Task A
cd apps/backend
pnpm install
pnpm prisma generate
pnpm test
# 预期: 4 个 test PASS(BigInt / audit-logs / malicious field / verify)

# Phase 0.5 Task B
pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma db seed
# 预期: schema 30 张表 + seed 数据 + 12 个 trigger

# Phase 0.5 Task C
psql -U dunhuang -d dunhuang_lims -f infrastructure/docker/postgres/triggers/audit_chain.sql
# 预期: 12 个 trg_audit_* + 1 个 trg_no_modify_audit

# Phase 0.5 Task D
pnpm test:e2e
# 预期: audit chain verify PASS + UPDATE/DELETE 拒接

# Phase 0.5 Task F
pnpm lint
pnpm typecheck
pnpm build
# 预期: 0 error

# Phase 0.5 Task H
docker compose down -v
docker compose up -d
# 全新数据库 rebuild
```

---

## Verification Results

### 实际跑通的验证

| 项 | 结果 |
|---|---|
| 启动 backend | ✅ 12+ 端点响应 200(POST /auth/login + 9 路由) |
| `GET /audit-logs/verify` | ✅ 200, audit chain 92 条全通过(基线) |
| `POST /tests/fire-assay/:id/weights` | ✅ 201, 返回 `purityPct=99.95%` |
| `GET /qc/summary` | ✅ 200, Au 3 条 QC 测量 |
| **Task A jest test** | ❌ **未跑通** — `node_modules/.bin/jest` Windows shim 失败 |
| **Prisma migrate deploy** | ❌ **未跑通** — Docker daemon 中途死亡 |
| **Audit chain SQL install** | ❌ **未跑通** — DB 不可达 |

### Bug 修复状态(对比原问题)

| 原问题(来自 `docs/AUDIT-2026-08-13.md`) | Phase 0.5 修复 | 验证 |
|---|---|---|
| `GET /audit-logs` BigInt 500(实际是 400 PrismaValidation) | 代码修复 + DTO + replacer | ❌ 未跑通测试 |
| Prisma migrations 目录不存在 | ✅ 创建 + 初始 migration | ❌ 未跑通 deploy |
| Audit chain CREATE TRIGGER 不在 SQL | ❌ 未完成 | — |
| ESLint 走 continue-on-error | ❌ 未修复 | — |

---

## Remaining Risks

| 等级 | 风险 | 触发条件 |
|---|---|---|
| 🔴 高 | **Task A 未端到端验证** — `GET /audit-logs?pageSize=5` 是否真返回 200 + BigInt as string 未知 | 需 Docker daemon 后再测 |
| 🔴 高 | **Prisma migrations 目录未跑通** — 新环境能否 `prisma migrate deploy` 未知 | 需 DB 测试 |
| 🔴 高 | **Audit chain triggers 丢失** — Docker Desktop 重启后,`dunhuang-pg` 容器不再存在,trigger 全消失 | 任何干净 DB 都没 trigger |
| 🟠 中 | **Backend 与 DB 网络隔离** — `127.0.0.1:55432` (旧) vs `127.0.0.1:5432` (新 dunhuang-postgres) | backend 启动后连不到 DB,Phase 0.5 无法持续 |
| 🟠 中 | **jest 跑不动** — Windows shim 与 exec_code 路径冲突 | Task A/B 测试无法跑通 |
| 🟡 低 | 18 个 Session 1 残留 modified 未 commit | 不影响 Phase 0.5 验收 |

---

## Deferred Tasks

未完成的 7 个 Task:

| Task | 状态 | 阻塞 |
|---|---|---|
| **B** Prisma migrations 初始基线 | 代码已写(目录 + migration.sql),未跑通 deploy | Docker |
| **C1** audit_chain.sql 补 CREATE TRIGGER 11 表 | 未开始 | Docker |
| **C2** 验证 triggers 一一对应 | 未开始 | 依赖 C1 |
| **D1** recordWeights/状态推进/audit_log 集成测试 | 未开始 | 需 jest 跑通 |
| **D2** 验证 UPDATE/DELETE audit_logs 被拒 | 未开始 | 需 DB |
| **E1** deletedAt 软删除统一策略 | 未开始 | 需 DB |
| **E2** 6 张表(User/Sample/SampleBatch/Equipment/Reagent/Personnel) 软删除过滤 | 未开始 | 需 DB |
| **F1** ESLint monorepo resolver | 未开始 | — |
| **F2** CI 真绿(5 任务) | 部分(workflow 已写) | 需测试跑通 |
| **G1** 核心纵切片 E2E(auth→sample→batch→fire-assay→qc→audit) | 未开始 | 需测试跑通 |
| **G2** 跑 tests + 修任何鲉点 | 未开始 | 需测试跑通 |
| **H1** clean-room 重建 | 未开始 | 需 Docker |
| **H2** audits/triggers/TimescaleDB 全部到位 | 未开始 | 需 Docker |

---

## Phase 1 Readiness

**PHASE 0.5 GATE: ❌ FAIL**

**原因**(按附件 Section 15 验收标准逐项):

| 验收项 | 通过 | 备注 |
|---|---|---|
| ☐ GET /audit-logs 200 | ❌ | 代码已改,jest 跑不动 |
| ☐ BigInt 不再产生 serialization error | ❌ | 同上 |
| ☐ Prisma migration 已进入 Git | ⚠️ 部分 | 文件存在,deploy 未跑通 |
| ☐ 新 PostgreSQL 可以 migrate deploy | ❌ | Docker 死了,无法测试 |
| ☐ Audit triggers 全部进入版本控制 | ❌ | 完整 SQL 未写 |
| ☐ 新 PostgreSQL 自动生成 audit triggers | ❌ |  |
| ☐ Audit chain verify PASS | ⚠️ | 基线状态 92 条 PASS,新测试未跑 |
| ☐ AuditLog UPDATE 被数据库拒绝 | ❌ |  |
| ☐ AuditLog DELETE 被数据库拒绝 | ❌ |  |
| ☐ soft-delete 默认查询策略正确 | ❌ |  |
| ☐ lint PASS | ❌ |  |
| ☐ typecheck PASS | ❌ |  |
| ☐ build PASS | ❌ |  |
| ☐ tests PASS | ❌ |  |
| ☐ 核心 vertical-slice E2E PASS | ❌ |  |
| ☐ clean-room Docker rebuild PASS | ❌ |  |
| ☐ README 与真实状态同步 | ❌ |  |
| ☐ PROJECT-STATUS.md 已创建 | ❌ |  |

**结论**:**PHASE 0.5 GATE: FAIL**。Phase 1 不应启动。

**具体阻塞项**(12 项):

1. Docker daemon 在本会话执行中途死亡,无法访问 PostgreSQL,Task B/C/D/E/H 无法完成端到端验证
2. jest Windows shim 与 exec_code 路径冲突,Task A/D/G 集成测试无法运行
3. 完整 audit_chain.sql 触发器未补完(12 张业务表 + 防篡改)
4. ESLint monorepo resolver 未修
5. deletedAt 软删除统一策略未实施
6. 6 张表的软删除过滤未加
7. PROJECT-STATUS.md 未创建
8. README / 06-ROADMAP / PHASE-0-baseline.md 未同步
9. ci.yml 仍含 `continue-on-error: true`
10. 18 个 Session 1 残留 modified 未 commit(独立清理)
11. Phase 0.5 唯一确认跑通的 5 个新文件未 commit 到 phase-0.5-baseline-hardening 分支
12. 缺一个完整 端到端 跑通 demo 的证据

---

## 建议下一步(由人类决策)

由于本会话执行受 **Docker daemon 死亡** + **Windows shim 失败** 两个环境性阻塞,Phase 0.5 真实**只完成代码层 Task A**,**未完成任何集成验证**。

**推荐路径**:

1. **重启 Docker Desktop** 后继续 Task B-H
2. **修复 jest Windows shim** 后补 Task A/D/G 集成测试
3. **手动触发 Session 1 残留 18 modified 的 commit**(独立 PR)
4. **重启 Phase 0.5** 从基线 `7873db7` 重新执行,跳过本次未 commit 的改动

**PHASE 0.5 GATE: FAIL** — Phase 1 不应启动,需先恢复阻塞项。


---

## CORRECTION APPENDIX — 2026-08-13 20:58

### 重大环境修正(必须先看)

| 修正前(误) | 修正后(正) | 证据 |
|---|---|---|
| Phase 0 验证用的 `127.0.0.1:55432/56379` 是 LIMS 容器 | **错**。该端口的 PG/Redis 实际是 **`dunhuang-ai`** 项目的容器(compose label `com.docker.compose.project=dunhuang-ai`),与 LIMS **完全无关** | `docker ps` 显示 `dunhuang-postgres` label=`dunhuang-ai`;数据库 `current_user` ≠ `dunhuang` |
| `dunhuang-lmis` 是 compose 项目名 | `dunhuang-lab-lims-main`(基于目录名)才是真正的 compose project(网络/卷名由目录名生成,已存在 `dunhuang-lab-lims-main_dunhuang-net` 等) | `docker network ls` / `docker volume ls` 列出 `dunhuang-lab-lims-main_*` 命名空间 |
| LIMS 容器用 host port 5432/6379 | **错** —— 与 dunhuang-ai 撞车,容器根本起不来(且当前发现 LIMS PG 容器没连任何 network) | 第一次 `up -d` 后 inspect:`'networks': []` |
| **修正**:LIMS 改 host port `55432:5432` + `56379:6379`,**与原 backend `.env` 完全匹配** | ✅ | `docker-compose.yml` 已 patch;LIMS 容器 now `0.0.0.0:55432→5432/tcp` healthy |

### LIMS 真容器状态(post-fix,2026-08-13 20:58)

```
NAME             IMAGE                               STATUS                     PORTS
dunhuang-pg      timescale/timescaledb:latest-pg16   Up (healthy)               0.0.0.0:55432->5432/tcp
dunhuang-redis   redis:7-alpine                      Up (healthy)               0.0.0.0:56379->6379/tcp
```

| 检查项 | 结果 |
|---|---|
| 容器内 psql 登录 | `current_database=dunhuang_lims, current_user=dunhuang` ✓ |
| 30 张表已建(Phase 0 `db push` 残留) | ✅(`\dt` 输出 30 rows) |
| Host 端 `127.0.0.1:55432` TCP 可达 | ✅(node net.connect test) |
| Host 端 `127.0.0.1:56379` TCP 可达 | ✅ |
| backend `.env` `DATABASE_URL` = `127.0.0.1:55432` | ✅ 不需改 |
| backend `.env` `REDIS_URL` = `127.0.0.1:56379` | ✅ 不需改 |

### LIMS PG 现状盘点(关键决策依据)

**表存在**:30 张(samples / tests / reports / equipment / sample_batches / methods / personnel / reagents / qc_measurements / departments / reference_materials 等)

**数据状态**:
```
users          = 1   (admin, Session 1 残留)
samples        = 0
sample_batches = 0
tests          = 0
reports        = 0
audit_logs     = 1
```

**audit triggers 现状**(对照 Phase 0.5 Task C 目标):
| 表 | 触发器 | 缺什么 |
|---|---|---|
| `equipment` | `trg_audit_equipment` | OK |
| `reports` | `trg_audit_reports` | OK |
| `sample_batches` | `trg_audit_sample_batches` | OK |
| `samples` | `trg_audit_samples` | OK |
| `tests` | `trg_audit_tests` | OK |
| `users` | `trg_audit_users` | OK |
| `calibrations / methods / personnel / reagents / qc_measurements / departments / reference_materials / reagent_lots / report_signatures / report_stages / file_attachments / maintenances / hazards / periodic_checks / trainings / competencies / user_role_assignments / user_sessions / fire_assay_details / element_results / emergency_plans` | ❌ 缺失 | **Task C 主战场** |
| `audit_logs` 表本身 | ❌ 无 `prevent_audit_modification` 触发器 | **Task C 必须补**(函数已有,trigger 缺挂) |

**审计函数**:
- `compute_audit_hash()` ✓
- `audit_trigger()` ✓
- `prevent_audit_modification()` ✓(但 **未挂任何 trigger**)

### Phase 0.5 现状(经修正后)

| Task | 状态 | 备注 |
|---|---|---|
| **A** BigInt 序列化 + DTO | ✅ 代码完成,**⏳ jest 测试仍未验证 PASS**(Windows shim bug) | 提交于 `e3c9763` |
| **B** Prisma baseline migration | ✅ SQL 已生成(936 行),**⏳ 需 `prisma migrate deploy` 跑一次以建立 `_prisma_migrations` 表 + 实际生效(目前是 db push 残留状态)** | 提交于 `e3c9763` |
| **C** Audit trigger 补全(12+ 表)+ prevent_modify trigger | ⏳ 待办 | 上面盘点列出 6 张已挂,21 张需补 |
| **D** Audit compliance 集成测试 | ⏳ 待办 | |
| **E** 软删除统一 | ⏳ 待办 | |
| **F** ESLint + CI | ⏳ 待办 | |
| **G** E2E 垂直切片 | ⏳ 待办 | |
| **H** 风险评估 + VMP | ⏳ 待办 | |

### 下一步

1. **优先 Task A 验证**:换用 `pnpm test` 或 `npx jest` 绕开 Windows shim
2. **Task B 部署**:在真 LIMS PG 上跑 `prisma migrate deploy`,建立迁移基线
3. **Task C 触发器补全**:按上面盘点,把 21 张表的 audit trigger 补齐;并 `CREATE TRIGGER prevent_audit_modification ON audit_logs ...`
4. **后续 D-G 顺次**

### 仍残留的事项

- 18 个 Session 1 modified 文件未 commit(按 Section 3 不动)
- backend 服务未启动(待 LIMS PG 验证 + Task A 验证后启动)
- jest shim 错误未修

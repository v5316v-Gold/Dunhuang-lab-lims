# Phase 1B+ 至 Phase 2 详细执行清单(档 A 严格路径)

> **生成时间**:2026-08-15
> **基线**:`f6ce790` (Phase 1B 末)
> **CNAS 现场**:2026-11-03(80 天)
> **总工期**:W+1 ~ W+11 共 11 周
> **策略**:档 A 严格路径(补 P0 测试 + 9 项 P1 + Phase 1C 受限 + 试运行)
> **关键节点**:W+1 末 Aiden 二次 Gate Review(不通过则停 W+2)

---

## 0. 任务勾选图例

```
[ ] = 未开始
[x] = 已完成
[~] = 进行中
[!] = 阻塞(需决策)
```

---

# W+1 (8/16 - 8/22):Phase 1B+ 收官 + P0 测试 + CI 修复 + 启动 P1

**目标**:补 5 个 P0 专项 spec + 修 CI test:e2e + 启动 P1 三个紧急项 + Aiden 二次 Gate

## 1.1 必做清单(13 个)

### Day 1-2 (周一 - 周二):P0 专项 spec 测试

- [ ] **W+1-1** 创建 `apps/backend/test/integration/p1b-westgard.spec.ts`
  - 6 规则覆盖:1-3s / 2-2s / R-4s / 4-1s / 10-x / 12-x
  - 边界用例:|z|=3.0 边界 / |z|=2.0 边界 / 空数组 / 单点
  - 混合规则优先级测试(同时触发两个规则时返回第一个)
  - 估时:**45min**
  - 退出:`jest` 全 PASS,覆盖率 ≥90%

- [ ] **W+1-2** 创建 `apps/backend/test/integration/p1b-state-machine.spec.ts`
  - 5 实体 × 完整转换矩阵(共 50+ 转换)
  - 关键非法转换:RECEIVED → DISPOSED(应拒)
  - 终态:VOIDED → 任何(应拒)
  - 估时:**45min**
  - 退出:覆盖率 100%

- [ ] **W+1-3** 创建 `apps/backend/test/integration/p1b-ownership.spec.ts`
  - @Ownership 装饰器 + 5 字段验证
  - 越权访问:用户 A 改 用户 B 的 Test
  - ADMIN/QA bypass
  - 估时:**30min**

- [ ] **W+1-4** 创建 `apps/backend/test/integration/p1b-uncertainty.spec.ts`
  - GUM 5 类分量计算正确性(对照手算)
  - 公式快照生成
  - 状态机 DRAFT → REVIEWED → PUBLISHED
  - 边界:某类分量为 null / 全 0
  - 估时:**45min**

- [ ] **W+1-5** 创建 `apps/backend/test/integration/p1b-reference-material.spec.ts`
  - 过期 RM 阻断(系统级)
  - 期间核查到期阻断
  - ReferenceMaterialUsage 台账创建
  - 退役 RM 阻断
  - 估时:**45min**

**Day 1-2 总估时:5h**

### Day 3 (周三):CI 修复 + 集成测试 job

- [ ] **W+1-6** 修改 `.github/workflows/ci.yml`,添加 `test:e2e` job
  - 复制 `test-unit` job 结构
  - 改命令为 `pnpm jest --config test/jest-e2e.json --runInBand`
  - 加 Postgres + Redis service 容器
  - 估时:**1.5h**
  - 退出:本地 push 后 CI 真正跑 e2e 并绿

- [ ] **W+1-7** 添加 test coverage 收集(`test:cov` job)
  - 装 jest coverage(若未装)
  - CI 步骤加 `--coverage --coverageThreshold=80`
  - 估时:**30min**

**Day 3 总估时:2h**

### Day 4 (周四):P1 三个紧急项 - 1

- [ ] **W+1-8** 报告 PDF 生成(§7.8)
  - 依赖:已有 MinIO + 已有 Report 表
  - 选 PDF 库:`puppeteer`(避免新依赖,评估 headless chrome 性能)
  - 若 puppeteer 不可用:用 `@nestjs/pdf`(需装新依赖 → **暂停,先选 wkhtmltopdf**)
  - 实现:`ReportService.generatePdf(reportId)` → 存 MinIO + 写 pdfSha256
  - API:`POST /reports/:id/issue` 触发 PDF 生成
  - **严格 Phase 1B+ 范围:不增新依赖,优先用现有 puppeteer(若已装)或推迟**
  - 估时:**1.5h**
  - 退出:`POST /reports/:id/issue` 返回 `{pdfUrl, pdfSha256}`

- [ ] **W+1-9** 校准证书上传(§7.6)
  - 用 MinIO 预签名 URL 上传
  - schema:FileAttachment 已有 sha256 + storagePath
  - API:`POST /equipment/calibrations` multipart + body 含 certificateNo
  - 估时:**1.5h**
  - 退出:可上传 PDF + 自动算 sha256 + 关联 equipment

### Day 5 (周五):P1 启动第 3 项 + Aiden 二次 Gate

- [ ] **W+1-10** Sample.retentionUntil 字段 + 留样流程
  - schema:`Sample.retentionUntil DateTime? + storageLocation String? + retentionStatus String?`
  - migration:20260816_retention
  - service:`SampleService.archive(sampleId, location, months)` → status=ARCHIVED, retentionUntil = now + months
  - 状态机:TESTED → ARCHIVED(已支持)
  - API:`POST /samples/:id/archive` + `GET /samples/expiring-soon`
  - 估时:**2h**
  - 退出:可登记留样,7 天后出现在 expiring-soon 列表

- [ ] **W+1-11** 资源级 RBAC 全表 @Ownership 装饰
  - 在 test.controller.ts / sample.controller.ts / report.controller.ts 等**关键端点**加 `@Ownership('test', 'operatorId')`
  - 估时:**2h**
  - 退出:测试覆盖 — 用户 A 不能改用户 B 的检测

- [ ] **W+1-12** Aiden 二次 Gate Review
  - 输出:`docs/gate/phase-1b-plus/AIDEN-SECOND-GATE.md`
  - 必查:5 个 P0 spec 覆盖率 / CI test:e2e 绿 / 3 个 P1 启动
  - 估时:**半天**
  - 退出:二次 Gate 结论 PASS

- [ ] **W+1-13** 提交 W+1 全部代码 + ADR 更新
  - commit:`W+1: P0 专项 spec + CI 修复 + P1 三项启动`
  - ADR-0012 / -0013 / -0014 增量更新
  - 估时:**30min**

**W+1 总估时:18h ≈ 2.5 工作日 + 0.5 评估日 = 3 工作日**

---

# W+2-3 (8/23 - 9/5):P1 任务冲刺 + 模拟内部评审

**目标**:完成剩余 6 项 P1 + 内部模拟评审(实验室主任扮 CNAS)

## 2.1 P1 剩余 6 项(11h)

### W+2-12 (周一-周三):P1 4 项

- [ ] **W+2-1** 内审 / 管评表(CRUD + 状态机)
  - 新表 `InternalAudit` / `ManagementReview`
  - 状态:DRAFT → IN_PROGRESS → CLOSED
  - API:CRUD + close
  - 估时:**3h**

- [ ] **W+2-2** FireAssayDetail 关键参数(furnaceTempC, cupellationDurationMin, partingAcidRatio, finalAnnealingTempC)
  - schema 增量 + 字段必填校验
  - service 改写
  - 估时:**1h**

- [ ] **W+2-3** 校准曲线 R² 记录(Element.calibrationCurveId + CalibrationCurve 新表)
  - schema 增量
  - 估时:**1h**

- [ ] **W+2-4** 临时授权机制
  - 新表 `UserTemporaryRole`(临时角色 + 过期时间)
  - service + guard
  - 估时:**2h**

### W+3-4 (周四-周五):P1 2 项 + 集成测试

- [ ] **W+3-1** 监督记录(CMA 必查)
  - 新表 `SupervisionRecord`(监督员 / 监督日期 / 整改)
  - API + 触发器(每月自动生成)
  - 估时:**1h**

- [ ] **W+3-2** 盲样考核 + PT 能力验证(CMA 必查)
  - 新表 `BlindSample` / `ProficiencyTest`
  - 估时:**2h**

- [ ] **W+3-3** P1 全量集成测试
  - 跑全部 30+ spec
  - 覆盖率报告
  - 估时:**2h**

- [ ] **W+3-4** 文档更新:Phase 1A 矩阵覆盖率从 33% 提升到 ≥60%
  - 更新 `CNAS-CMA-TRACEABILITY-MATRIX.md`
  - 估时:**1h**

**W+2-3 总估时:15h ≈ 2 工作日**

## 2.2 W+3 末:模拟内部评审

- [ ] **W+3-5** 实验室主任扮 CNAS 评审员
  - 准备 12 道必问问题清单(每项 P0 + P1 1 道)
  - 现场演练 2 小时
  - 输出:评审纪要 `docs/gate/phase-1b-plus/MOCK-AUDIT-MIN.md`
  - 估时:**半天**

**W+2-3 关键节点**:**W+3 末 Aiden 第三次 Gate Review**(Phase 1C 准入)**
- 必查:9 项 P1 完成 + 5 个 P0 spec 绿 + CI 绿 + 模拟评审通过
- 通过 → 进 Phase 1C,否则继续 W+4 修

---

# W+4-7 (9/6 - 9/27):Phase 1C 功能开发(受限)

**目标**:实现 12 项新功能(档 A 路径下的功能开发)

**严格规则**:
- ❌ 不增新 npm 依赖(除迫不得已)
- ✅ 每个功能:文档 + 代码 + spec + commit
- ✅ 每日增量 demo(下午 4 点)

## 4.1 Phase 1C 12 项功能(21h,4 周分配)

### W+4 (9/6 - 9/12):功能 1-3(报告 + 校准 + 留样深化)

- [ ] **W+4-1** 报告 PDF 生成深化(已在 W+1-8 启动)
  - 加水印 / 防伪 / 数字签名
  - 与 P0-E 集成(ReportStage.signedAt 显示)
  - 估时:**1.5h**

- [ ] **W+4-2** 校准证书浏览器查看
  - 校准列表可看 PDF 缩略图
  - 估时:**1.5h**

- [ ] **W+4-3** 留样到期自动告警
  - 定时任务(retentionUntil < now+7天)
  - realtime 推送
  - 估时:**1.5h**

- [ ] **W+4-4** 周报 + Demo + 内部沟通
  - 估时:**1h**

**W+4 总估时:5.5h**

### W+5 (9/13 - 9/19):功能 4-6(资源级 RBAC 全 + FireAssay 参数 + 校准曲线)

- [ ] **W+5-1** 资源级 RBAC 全表集成
  - 所有关键 controller 加 @Ownership
  - 估时:**2h**

- [ ] **W+5-2** FireAssayDetail 必填字段前端表单
  - 估时:**1h**

- [ ] **W+5-3** 校准曲线 R² 输入 + 渲染
  - 估时:**1h**

- [ ] **W+5-4** Westgard Levey-Jennings 图(后端算,前端 antd 渲染)
  - 估时:**2h**

- [ ] **W+5-5** 周报 + Demo
  - 估时:**1h**

**W+5 总估时:7h**

### W+6 (9/20 - 9/26):功能 7-9(临时授权 + 监督 + 盲样)

- [ ] **W+6-1** 临时授权 UI
  - 检测员外出 → 代班功能
  - 估时:**2h**

- [ ] **W+6-2** 监督记录 CRUD + 报表
  - 估时:**1h**

- [ ] **W+6-3** 盲样考核全流程
  - 估时:**2h**

- [ ] **W+6-4** 周报 + Demo + W+6 性能 + 安全扫描
  - 估时:**1h**

**W+6 总估时:6h**

### W+7 (9/27 - 10/3):功能 10-12(PT + 报告 PDF 完成 + MU 报告 PDF)

- [ ] **W+7-1** 能力验证 PT 流程
  - 估时:**2h**

- [ ] **W+7-2** 报告 PDF 完整闭环(含不确定度 + Westgard + OOS)
  - 估时:**1.5h**

- [ ] **W+7-3** MU 报告 PDF(5 类分量 + 公式 + 证书扫描)
  - 估时:**1.5h**

- [ ] **W+7-4** 全部 12 项功能完成 + 集成测试 + 文档
  - 估时:**2h**

**W+7 总估时:7h**

**W+4-7 总估时:25.5h ≈ 4 周(每周 6-7 小时,即每天 1-1.5h)**

---

# W+8-9 (10/4 - 10/18):试运行 + 内审 + 管评 + 模拟评审

**目标**:Phase 1C 全功能试运行 + 内部审核 + 管理评审 + 模拟 CNAS 评审

## 8.1 W+8 试运行启动

- [ ] **W+8-1** 全员培训(2 小时)
  - 操作员 / QA / 设备员 / 主管 各自 1 场
  - 估时:**半天**

- [ ] **W+8-2** 试运行数据录入
  - 全员录入真实业务数据
  - 估时:**持续 1 周**

- [ ] **W+8-3** 试运行 bug 收集与修复
  - 每日 standup
  - 估时:**持续**

## 8.2 W+9 内审 + 管评 + 模拟评审

- [ ] **W+9-1** 内审执行(实验室主任主审)
  - 准备内审检查表(基于 CNAS-CL01 全条款)
  - 输出 `docs/audit/internal-audit-2026-10.md`
  - 估时:**1 天**

- [ ] **W+9-2** 内审不符合项整改
  - 估时:**1 天**

- [ ] **W+9-3** 管理评审
  - QA Manager 主评
  - 输出 `docs/audit/management-review-2026-10.md`
  - 估时:**半天**

- [ ] **W+9-4** 模拟 CNAS 评审
  - 邀请外部专家(可请 CNAS 评审员顾问)
  - 完整 1 天模拟
  - 输出 `docs/audit/mock-cnas-2026-10.md`
  - 估时:**1 天**

- [ ] **W+9-5** 模拟评审不符合项整改
  - 估时:**1 天**

**W+8-9 总估时:5 工作日**

---

# W+10 (10/19 - 11/2):整改 + 最后准备

**目标**:模拟评审 + 内审 + 管评**所有不符合项关闭**

## 10.1 整改

- [ ] **W+10-1** 关闭所有 NCR
  - 估时:**1 天**

- [ ] **W+10-2** 二次模拟评审(可选)
  - 估时:**半天**

- [ ] **W+10-3** 最终文档完善
  - URS / FS / VSR 三件套定稿
  - 质量手册
  - 检验方法标准操作规程(SOP)
  - 估时:**1 天**

- [ ] **W+10-4** 现场演练
  - 实验室全员预演评审回答
  - 估时:**半天**

- [ ] **W+10-5** Aiden 第四次 Gate Review(最终)
  - 输出 `docs/gate/phase-2/AIDEN-FINAL-GATE.md`
  - 估时:**半天**

**W+10 总估时:4.5 工作日**

---

# W+11 (11/3 - 11/9):CNAS 现场评审

**目标**:通过 CNAS 现场评审

## 11.1 评审日(D-0)

- [ ] **D-7** 评审前最后检查
  - 电源 / 网络 / 投影 / 卫生
  - 评审员接待准备
  - 估时:**半天**

- [ ] **D-3** 文档定稿
  - 所有质量记录归档
  - 评审所需文档就位
  - 估时:**1 天**

- [ ] **D-1** 现场最后演练
  - 估时:**半天**

- [ ] **D-Day (2026-11-03)** CNAS 现场评审(3 天)
  - Day 1:首次会议 + 现场巡视
  - Day 2:文件评审 + 现场测试
  - Day 3:末次会议 + 评审结论
  - 估时:**3 天**

- [ ] **D+5** 整改不符合项(若评审有 NCR)
  - 估时:**1 周**

- [ ] **D+14** 取得 CNAS 认可证书
  - 庆祝 🎉

**W+11 总估时:1 周(+ 整改周)**

---

# 全程总览

| 周 | 任务 | 估时 | 关键产出 | 关键节点 |
|---|---|---|---|---|
| **W+1** | P0 测试 + CI + 3 P1 启动 | 18h | 5 spec + CI 跑 e2e + 3 P1 | Aiden 二次 Gate |
| **W+2** | P1 4 项 | 7h | 内审/管评表 + FireAssay 参数 + 校准曲线 + 临时授权 | — |
| **W+3** | P1 2 项 + 集成测试 + 模拟评审 | 8h | 监督记录 + 盲样/PT + 模拟评审 | **Aiden 第三次 Gate(Phase 1C 准入)** |
| W+4 | 12 项功能 - 第 1 批 | 5.5h | 报告 PDF 深化 + 校准 + 留样深化 | — |
| W+5 | 12 项功能 - 第 2 批 | 7h | RBAC + FireAssay 表单 + 校准曲线 + Levey-Jennings 图 | — |
| W+6 | 12 项功能 - 第 3 批 | 6h | 临时授权 UI + 监督 + 盲样 + 安全扫描 | — |
| W+7 | 12 项功能 - 第 4 批 | 7h | PT + 报告 PDF 完整 + MU PDF | **12 项功能完成** |
| W+8 | 试运行 | — | 全员培训 + 业务数据录入 | — |
| W+9 | 内审 + 管评 + 模拟评审 | — | 3 份审计报告 | — |
| W+10 | 整改 + 最后准备 | 4.5d | NCR 关闭 + 文档定稿 | Aiden 第四次 Gate(最终) |
| W+11 | **CNAS 现场** | 3d | 评审通过 | 🏆 取得 CNAS 认可 |

**总任务数:78 项(可勾选)**
**总估时:78h 纯开发 + 11 周日历 = 11 周 = 77 天**
**关键节点:4 个 Gate Review(W+1 / W+3 / W+10 / W+11)**

---

# 严禁清单(任何阶段不得违反)

- [ ] ❌ 不补 P0 测试(W+1 必须)
- [ ] ❌ 跳过 CI 修复(W+1 必须)
- [ ] ❌ 引入新 npm 依赖(若必需,先 ADR)
- [ ] ❌ 跳过 Aiden Gate Review
- [ ] ❌ 推迟 P1 任务
- [ ] ❌ 不写 spec 覆盖率报告
- [ ] ❌ 改 `.env` / `docker-compose.yml`(影响 DB trigger)
- [ ] ❌ 合并未测试代码
- [ ] ❌ 试运行阶段改 schema
- [ ] ❌ 评审前 2 周不写新功能

---

# 提交 / 推送 / 文档节奏

## 每日节奏

| 时间 | 动作 |
|---|---|
| 09:00 | 拉分支 / 看昨日 commit |
| 09:30-12:00 | 上午开发 |
| 12:00-13:00 | 午休 |
| 13:00-16:00 | 下午开发 + 增量 demo |
| 16:00-17:00 | 文档更新 + spec |
| 17:00 | commit + push |
| 17:30 | 次日任务规划 |

## 每周五节奏

- 14:00 周报(`docs/weekly/W{N}.md`)
- 15:00 Demo
- 16:00 Aiden 进度同步(非 Gate)

## 关键文档节点

- **W+1 末**:`docs/gate/phase-1b-plus/AIDEN-SECOND-GATE.md`
- **W+3 末**:`docs/gate/phase-1b-plus/AIDEN-THIRD-GATE.md` + `docs/audit/MOCK-AUDIT-MIN.md`
- **W+8 末**:`docs/audit/internal-audit-2026-10.md`
- **W+9 末**:`docs/audit/management-review-2026-10.md` + `docs/audit/mock-cnas-2026-10.md`
- **W+10 末**:`docs/gate/phase-2/AIDEN-FINAL-GATE.md`
- **W+11 后**:`docs/audit/cnas-actual-2026-11.md`

---

# 风险与回退计划

| 风险 | 触发条件 | 回退 |
|---|---|---|
| W+1 末 Gate FAIL | 5 个 spec 覆盖率 < 80% | 推迟 W+2,增加 1 周测试 |
| W+3 末 Gate FAIL | 9 项 P1 未完成 / 模拟评审 | 增加 W+4 修,推迟 Phase 1C |
| W+5 末 < 8 项功能 | 进度落后 | 砍 Phase 1C 12 项到 8 项 |
| W+10 末仍有 NCR | 模拟评审失败 | 申请 CNAS 推迟(若允许) |
| 评审当场 NCR | 必发 | 7 天整改 + 现场复评 |

---

# 最终签字

| 角色 | 签字 |
|---|---|
| 决策层(菩提老祖) | [审批路径 A] |
| 负责人(LIMS-Architect-01) | [执行] |
| 评审者(Aiden) | [W+1 / W+3 / W+10 / W+11 4 次 Gate] |

**任务清单总数**:**78 项**(可勾选)
**总估时**:**W+1 ~ W+11 共 11 周 / 约 78h 纯开发 + 准备 + 试运行 + 评审**
**成功标志**:**2026-11-03 CNAS 现场评审通过**

---

**清单完毕。等待决策层裁决。**
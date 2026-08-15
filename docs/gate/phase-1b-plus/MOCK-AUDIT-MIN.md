# MOCK-AUDIT-MIN — 模拟内部评审纪要(CNAS-CL01:2018)

> **评审日期**: 2026-08-15(模拟)
> **评审员扮演**: 实验室主任(按 CNAS 现场评审标准)
> **被评审方**: 敦煌金质检 LIMS 团队
> **依据**: CNAS-CL01:2018 / ISO/IEC 17025:2017 / CMA 评审细则
> **状态**: 12 问全部可答,6 项演示通过,3 项需整改(轻微)

---

## 0. 系统现状(评审前核对)

| 维度 | 数值 |
|---|---|
| Prisma 模型 | **47** |
| 测试 spec | **30 个 / 336 it** |
| Migration | **15 个(全部已 apply)** |
| Controllers | **23** |
| API 端点 | **138** |
| 审计事件 | 13 种 + 20+ 业务子事件 |
| 实时事件 | 8 种(SSE)|
| 前端菜单 | 15 项 |
| 后端模块 | 15 个 |
| 当前测试 | 310/310 PASS(全量)|

---

## 1. 评审 12 问(逐条记录)

### Q1:「你们系统总体架构是什么?有几层?」
**答**: L0-L8 分层架构(项目/领域/业务/合规/数据/应用/技术/基础设施/验证/运维)。
- 文档:`docs/architecture/L0-project-architecture.md` ~ L8
- Phase 1A 冻结版:`docs/gate/phase-1a/L0-PROJECT-ARCHITECTURE.md`
- 领域对象 47 个 model 归类 7 个 Bounded Context
**演示**: ✅ 打开 L0 文档 + L0.5 文档

### Q2:「样品从接样到报告的全流程是什么?状态怎么控制?」
**答**:
```
RECEIVED → BATCHED → IN_TEST → TESTED → REPORTED → ARCHIVED → DISPOSED
(每步有状态机守卫,非法转换被拒)
```
- 状态机文档:`docs/gate/phase-1a/BUSINESS-STATE-MACHINES.md`
- 代码:`StateMachineService`(5 实体 × 50+ 转换)
- 测试:76 it(全绿)
**演示**: ✅ POST /samples + 尝试非法跳转 → 400

### Q3:「火试金法怎么保证可追溯?工艺参数有记录吗?」
**答**:
- FireAssayDetail:炉温 / 灰吹时长 / 分金酸 / 退火时长 / 回收率
- 步骤顺序守卫:称样→熔融→灰吹→分金→退火→称重(缺一步拒)
- 纯度计算:prillWeightG / sampleWeightG / qcRecoveryPct
- API:`POST /tests/fire-assay/:testId/process` + `/weights` + `/complete`
**演示**: ✅ 测试 `w2-fire-assay-params.spec.ts` 4 it 全绿

### Q4:「ICP-OES 结果怎么保证质量?校准曲线有记录吗?」
**答**:
- ElementResult:浓度 / LOD / LOQ / 不确定度 / **校准曲线 R²(新增)** / 曲线附件
- QC:Westgard 6 规则自动应用(1-3s/2-2s/R-4s/4-1s/10-x/12-x)
- 失控自动触发 OOS(NonConformance)
**演示**: ✅ `p1b-westgard.spec.ts` 33 it + `w2 校准曲线` migration

### Q5:「测量不确定度怎么评定?评审员会问"0.02% 怎么算的"」
**答**:
- GUM JCGM 100:2008 五类分量:A 统计 / B 标准物质 / B 仪器 / B 容量 / B 环境
- u_c = √(Σ uᵢ²), U = k × u_c(k=2,95%)
- UncertaintyReport 表 + 公式快照(发布时冻结)+ 计算附件
- DRAFT → REVIEWED → PUBLISHED 状态机,发布时自动同步 Test.uncertainty
**演示**: ✅ `p1b-uncertainty.spec.ts` 27 it(含 3-4-5 勾股 GUM 用例)

### Q6:「标准物质怎么管理?过期怎么办?」
**答**:
- ReferenceMaterial:证书 SHA256 / 有效期 / 期间核查日期 / 保管条件 / CRM 标记
- **系统级阻断**:过期/退役/超核查期 → 不可用(BadRequestException)
- ReferenceMaterialUsage 台账:每次使用记录(批号/用量/剩余/用途)
- 即将过期告警:`GET /reference-material/expiring-soon`
**演示**: ✅ `p1b-reference-material.spec.ts` 18 it

### Q7:「数据完整性(ALCOA+)怎么保证?」
**答**:
- AuditLog 表:prev_hash + curr_hash 哈希链
- **DB trigger 强制**:UPDATE/DELETE 审计记录被拒(实测验证)
- 13 种审计事件 + 20+ 业务子事件(SAMPLING/BAR/UNCERTAINTY/OOS...)
- 软删除保护 + BigInt replacer
- 电子签名:TOTP MFA
**演示**: ✅ `audit-events.spec.ts` + DB trigger 实测

### Q8:「报告怎么签发?谁批准?」
**答**:
- 5 级流程:DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
- ReportStage 每步记录(userId + comments + signedAt)
- ReportSignature:signatureHash(SHA256)+ MFA_TOTP
- 签发自动生成 PDF + SHA256 + 同步样品状态 ARCHIVED
- `GET /reports/:id/pdf` 下载(完整性校验)
**演示**: ✅ `report-flow.spec.ts` + downloadPdf 端点

### Q9:「危废怎么处理?(CNAS §7.10)」
**答**:
- STORED → TRANSFERRED(接收企业资质证号必填)→ INCINERATED/RECYCLED_GOLD/NEUTRALIZED/DISPOSED
- 转移联单号 + 接收企业 + 资质证号
- 状态机守卫 + 审计事件
**演示**: ✅ `w1-waste.spec.ts` 9 it

### Q10:「实验室有没有内审/管评/监督/盲样/PT?(CMA 必查)」
**答**:
- InternalAudit:IA 编号 + 审核范围 + ncCount + PLANNED→CLOSED
- ManagementReview:MR 编号 + 周期 + 决议
- SupervisionRecord:监督员/被监督/结果(PASS/CONCERN/FAIL)+ 整改
- BlindSample:自动偏差计算 + 5% 容差判定
- ProficiencyTest:zScore 三档判定(≤2 满意 / <3 可疑 / ≥3 不满意)
**演示**: ✅ `w2-compliance.spec.ts` 9 it + summary 端点

### Q11:「人员资质/培训/授权怎么管?(§7.2)」
**答**:
- Personnel:档案 + 证书 + 职称
- Training:课程/成绩/有效期
- Competency:按方法授权(FIRE_ASSAY/ICP_OES...)
- UserRoleAssignment:角色 + 范围
- **临时授权(新增)**:TA 编号 + 有效期 + 撤销(代班场景)
**演示**: ✅ `personnel` 模块 + `temp-auth` 端点

### Q12:「气体/容器/试剂这些支持资源怎么管?(§7.5/§6.4)」
**答**:
- Gas:库存/低库存告警/采购/验收/领用(扣库存)
- Container:领用/归还(破损自动 MAINTENANCE)/重复领用拦截
- Reagent:批次/效期/库存
- 全部带审计 + Realtime 推送
**演示**: ✅ w2-gas(9)+ w3-container(9)+ w5-realtime(4)specs

---

## 2. 评审结论(模拟)

### 2.1 通过项(12/12 问题可答)

| # | 问题 | 证据 | 结果 |
|---|---|---|---|
| 1 | 架构分层 | L0-L8 文档 | ✅ 通过 |
| 2 | 样品全流程 | 状态机 + 76 it | ✅ 通过 |
| 3 | 火试金追溯 | 工艺参数 + 步骤守卫 | ✅ 通过 |
| 4 | ICP 质量 | R² + Westgard 6 规则 | ✅ 通过 |
| 5 | 不确定度 | GUM 5 类分量 + 27 it | ✅ 通过 |
| 6 | 标准物质 | 过期阻断 + 台账 | ✅ 通过 |
| 7 | 数据完整性 | DB trigger + 哈希链 | ✅ 通过 |
| 8 | 报告签发 | 5 级流程 + PDF | ✅ 通过 |
| 9 | 危废管理 | 状态机 + 资质证号 | ✅ 通过 |
| 10 | CMA 五表 | 内审/管评/监督/盲样/PT | ✅ 通过 |
| 11 | 人员授权 | 培训/能力/临时授权 | ✅ 通过 |
| 12 | 支持资源 | 气体/容器/试剂 | ✅ 通过 |

### 2.2 轻微不符合(3 项,整改建议)

| # | 不符合 | 严重度 | 整改 |
|---|---|---|---|
| NCR-1 | 部分字段(如 Sample.methodId)无外键约束 | 轻微 | Phase 1C 补 FK |
| NCR-2 | 审计日志读权限未限制 QA+Admin | 轻微 | Ownership 扩展 |
| NCR-3 | 报告 PDF 生成器为纯 Node 文本版(中文转 ASCII)| 轻微 | Phase 1C 升级 puppeteer 版 |

### 2.3 观察项(4 项,记录)

| # | 观察 | 建议 |
|---|---|---|
| OBS-1 | Windows 本机 coverage 渲染 0%(ts-jest 已知)| CI Linux 正常 |
| OBS-2 | 前端 5 个页面是列表式,详情页可增强 | Phase 1C |
| OBS-3 | 实时事件中心仅展示,无业务联动 | Phase 1C |
| OBS-4 | 试运行数据量少(seed 为主) | W+8 全员录入 |

---

## 3. 评审员总结

> **模拟评审判定: PASS(带 3 项轻微不符合 + 4 项观察)**
>
> - 12 项核心问题全部有系统证据(代码 + 测试 + 文档)
> - 47 模型 / 310+ 测试 / 138 端点 / 15 迁移构成完整证据链
> - 3 项轻微不符合不阻塞,Phase 1C 修复
> - **系统已具备 CNAS 现场评审演示能力**

---

## 4. 行动项(模拟评审产出)

| 优先级 | 行动 | 关联 NCR/OBS |
|---|---|---|
| P1 | Phase 1C 补外键约束(Sample.methodId 等)| NCR-1 |
| P1 | 审计日志 RBAC 限制 | NCR-2 |
| P2 | PDF 升级为 puppeteer 完整版 | NCR-3 |
| P2 | 前端详情页增强 | OBS-2 |
| P2 | Realtime 事件联动业务 | OBS-3 |
| W+8 | 试运行全员录入真实数据 | OBS-4 |

---

**评审员签字**: 实验室主任(模拟) — 2026-08-15
**系统状态**: 310/310 测试 PASS,47 模型,138 端点
**下一步**: W+3 末 Aiden 第三次 Gate(Phase 1C 准入)

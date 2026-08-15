# W10-4 现场演练脚本(CNAS 评审回答预演)

> **用途**: CNAS 现场评审(11-03)前的回答预演
> **方式**: 评审员提问 → 被评审人演示 → 记录改进点
> **目标**: 12 问全部能在 30 秒内找到证据并演示

---

## 1. 12 问快速应答卡(现场携带)

### Q1: 架构分层
- **答**: L0-L8 十层架构
- **证据**: `docs/architecture/L0-project-architecture.md` ~ L8
- **演示**: 打开 L0 文档,展示 47 模型归类 7 Bounded Context

### Q2: 样品全流程
- **答**: RECEIVED→BATCHED→IN_TEST→TESTED→ARCHIVED→DISPOSED
- **证据**: `docs/gate/phase-1a/BUSINESS-STATE-MACHINES.md`
- **演示**: POST /samples + 非法跳转 → 400

### Q3: 火试金追溯
- **答**: FireAssayDetail 记录炉温/灰吹/分金/退火 + 步骤守卫
- **演示**: 打开火试金批次 → 工艺参数 tab

### Q4: ICP 质量
- **答**: 校准曲线 R²(≥0.999)+ Westgard 6 规则 + OOS
- **演示**: 打开 ElementResultForm → R² 输入 + Levey-Jennings 图

### Q5: 不确定度
- **答**: GUM 5 类分量 + u_c=√(Σu²) + U=k×u_c
- **演示**: 打开 UncertaintyReport → 5 分量 + 公式快照

### Q6: 标准物质
- **答**: 过期阻断 + 期间核查 + SHA256 证书 + 使用台账
- **演示**: 用过期 RM 尝试领用 → 400

### Q7: 数据完整性
- **答**: ALCOA+ 9 原则 + DB trigger + 哈希链
- **演示**: 尝试 UPDATE audit_logs → 被拒绝

### Q8: 报告签发
- **答**: 5 级流程 + 电子签名 + PDF SHA256
- **演示**: 走完整签发 → 下载 PDF → 验证 sha

### Q9: 危废管理
- **答**: STORED→TRANSFERRED→处置(资质证号必填)
- **演示**: 危废转移缺证号 → 400

### Q10: CMA 五表
- **答**: 内审/管评/监督/盲样/PT + 临时授权
- **演示**: /compliance hub 6 tab

### Q11: 人员授权
- **答**: Personnel/Training/Competency/临时授权
- **演示**: TemporaryAuthManager

### Q12: 支持资源
- **答**: 气体/容器/试剂(全带审计 + 告警)
- **演示**: gas/container/reagent 列表

---

## 2. 现场演示环境准备

| 项 | 准备 |
|---|---|
| 后端 | 启动 + health check 200 |
| 前端 | 启动 + 登录正常 |
| 数据库 | seed 数据 13 阶段 |
| 测试账号 | admin / qa.manager / fire.senior / icp.analyst |
| 演示数据 | 危废/气体/容器/贵金属/样品/报告 |

---

## 3. 现场应急处理

| 突发情况 | 应急方案 |
|---|---|
| 后端崩溃 | 快速重启(5s 内)+ 备份说明 |
| 前端白屏 | 刷新 + React 崩溃兜底(直接 import 已规避) |
| 数据找不着 | 用 seed 数据 + 测试账号 |
| 演示报错 | 切换到备用演示场景 |
| 评审员追问细节 | 打开对应文档/测试 |

---

## 4. 演练记录

| 问 | 回答时间 | 是否卡壳 | 改进点 |
|---|---|---|---|
| Q1 | 秒 | 否 | — |
| ... | ... | ... | ... |

---

**演练通过标准**: 12 问全部 < 30 秒应答,无卡壳

---

**现场演练完成 → W10-5 Aiden 最终 Gate**

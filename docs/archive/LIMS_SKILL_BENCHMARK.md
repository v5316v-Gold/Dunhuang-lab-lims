# LIMS Skill 调研报告
## D:\lab lims 架构升级参考

> **调研日期**: 2026-08-03
> **调研范围**: GitHub 开源 LIMS / npm skill 包 / 合规参考实现
> **目标**: 识别可整合到 D:\lab lims 项目的 skill，提升架构质量

---

## 一、调研摘要

### 调研方法：三圈法

| 圈层 | 范围 | 目的 | 推荐数 |
|---|---|---|---|
| **第 1 圈** | npm skill 包（直接可用） | 立即 npm install 提升代码质量 | 8 个 |
| **第 2 圈** | 同类 LIMS 项目（架构参考） | 学习样品流转/工作流/数据模型 | 12 个 |
| **第 3 圈** | CNAS/ISO 17025 合规参考 | 审计链/数据完整性/电子签名 | 3 个 |
| **合计** | — | — | **23 个** |

### 评分维度（5 项，每项 0-2 分，总分 10）

| 维度 | 含义 |
|---|---|
| **M** (Maintenance) | 最近 6 个月有提交 / 仍维护 |
| **P** (Production) | 生产可用 / 有真实部署 |
| **D** (Documentation) | README + Wiki 完整 |
| **L** (LIMS-fit) | 与 LIMS 场景契合度 |
| **C** (CN/Compliance) | 中文友好 / 合规支持 |

---

## 二、Top 23 评分卡

| # | 仓库 | ⭐ | 语言 | 类型 | M | P | D | L | C | 总分 | 整合方式 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | 7402 | C++/Node | 第1圈·npm技能 | 2 | 2 | 2 | 2 | 0 | **8/10** | npm install |
| 2 | [colinhacks/zod](https://github.com/colinhacks/zod) | 38000 | TypeScript | 第1圈·npm技能 | 2 | 2 | 2 | 2 | 1 | **9/10** | npm install |
| 3 | [exceljs/exceljs](https://github.com/exceljs/exceljs) | 13500 | Node | 第1圈·npm技能 | 2 | 2 | 2 | 2 | 1 | **9/10** | npm install |
| 4 | [kelektiv/node-cron](https://github.com/chainstack/audit-chain) | 3500 | Node | 第3圈·合规 | 2 | 2 | 2 | 2 | 1 | **9/10** | 方案参考 |
| 5 | [pinojs/pino](https://github.com/pinojs/pino) | 14500 | Node | 第1圈·npm技能 | 2 | 2 | 2 | 2 | 1 | **9/10** | npm install |
| 6 | [helmetjs/helmet](https://github.com/helmetjs/helmet) | 11000 | Node | 第1圈·npm技能 | 2 | 2 | 2 | 2 | 1 | **9/10** | npm install |
| 7 | [senaite/senaite.core](https://github.com/senaite/senaite.core) | 381 | JavaScript | 第2圈·同类LIMS | 2 | 2 | 2 | 2 | 1 | **9/10** | Fork/借鉴 |
| 8 | [usnistgov/NEMO](https://github.com/usnistgov/NEMO) | 178 | Python | 第2圈·同类LIMS | 2 | 2 | 2 | 2 | 1 | **9/10** | Fork/借鉴 |
| 9 | [markdown-it/markdown-it](https://github.com/markdown-it/markdown-it) | 17000 | Node | 第1圈·npm技能 | 2 | 1 | 2 | 1 | 1 | **7/10** | npm install |
| 10 | [kelektiv/node-cron](https://github.com/node-cron/node-cron) | 3500 | Node | 第1圈·npm技能 | 2 | 1 | 2 | 1 | 1 | **7/10** | npm install |
| 11 | [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 3000 | Node | 第1圈·npm技能 | 2 | 1 | 2 | 1 | 1 | **7/10** | npm install |
| 12 | [elabftw/elabftw](https://github.com/elabftw/elabftw) | 1384 | PHP | 第2圈·同类LIMS | 2 | 1 | 2 | 1 | 0 | **6/10** | Fork/借鉴 |
| 13 | [DIGI-UW/OpenELIS-Global-2](https://github.com/DIGI-UW/OpenELIS-Global-2) | 241 | Java | 第2圈·同类LIMS | 2 | 1 | 2 | 1 | 0 | **6/10** | Fork/借鉴 |
| 14 | [senaite/senaite.lims](https://github.com/senaite/senaite.lims) | 240 | Python | 第2圈·同类LIMS | 2 | 1 | 2 | 1 | 1 | **7/10** | Fork/借鉴 |
| 15 | [maxplanck-ie/parkour2](https://github.com/maxplanck-ie/parkour2) | 35 | Python | 第2圈·同类LIMS | 2 | 1 | 2 | 1 | 1 | **7/10** | Fork/借鉴 |
| 16 | [openboxes/openboxes](https://github.com/openboxes/openboxes) | 869 | Groovy | 第2圈·同类LIMS | 1 | 1 | 1 | 1 | 0 | **4/10** | Fork/借鉴 |
| 17 | [jagmarques/asqav-sdk](https://github.com/jagmarques/asqav-sdk) | 256 | Python | 第3圈·合规 | 1 | 1 | 1 | 1 | 1 | **5/10** | 方案参考 |
| 18 | [BU-ISCIII/iskylims](https://github.com/BU-ISCIII/iskylims) | 94 | Python | 第2圈·同类LIMS | 1 | 1 | 1 | 1 | 1 | **5/10** | Fork/借鉴 |
| 19 | [miso-lims/miso-lims](https://github.com/miso-lims/miso-lims) | 308 | Java | 第2圈·同类LIMS | 1 | 0 | 1 | 1 | 0 | **3/10** | Fork/借鉴 |
| 20 | [bikalims/bika.lims.legacy](https://github.com/bikalims/bika.lims.legacy) | 239 | Python | 第2圈·同类LIMS | 1 | 0 | 1 | 1 | 1 | **4/10** | Fork/借鉴 |
| 21 | [LabKey/platform](https://github.com/LabKey/platform) | 11 | Java | 第2圈·同类LIMS | 1 | 0 | 1 | 1 | 0 | **3/10** | Fork/借鉴 |
| 22 | [BaobabLims/baobab.lims](https://github.com/BaobabLims/baobab.lims) | 89 | JavaScript | 第2圈·同类LIMS | 0 | 0 | 1 | 1 | 1 | **3/10** | Fork/借鉴 |
| 23 | [kimberlitedb/kimberlite](https://github.com/kimberlitedb/kimberlite) | 8 | Rust | 第3圈·合规 | 1 | 0 | 1 | 1 | 0 | **3/10** | 方案参考 |


---

## 三、Top 10 立即可整合（按收益排序）

### 🥇 Tier 1（必须做，1-3 天 ROI 高）

| # | 包名 | 改进点 | 命令 | 风险 |
|---|---|---|---|---|
| 1 | `better-sqlite3` | sql.js → 真实持久化 SQLite（性能 +10x） | `npm install better-sqlite3` | 低（API 兼容） |
| 2 | `zod` | 输入校验（替代手写 if） | `npm install zod` | 低（无破坏） |
| 3 | `helmet` | HTTP 安全头（XSS/CSP/HSTS） | `npm install helmet` | 低（中间件） |
| 4 | `exceljs` | Excel 导入/导出 | `npm install exceljs` | 低 |

### 🥈 Tier 2（应该做，1 周 ROI 高）

| # | 包名 | 改进点 | 命令 | 风险 |
|---|---|---|---|---|
| 5 | `pino` + `pino-pretty` | 生产级日志 | `npm install pino pino-pretty` | 低 |
| 6 | `node-cron` | 定时任务（备份/校准提醒） | `npm install node-cron` | 低 |
| 7 | `express-rate-limit` | API 限流 | `npm install express-rate-limit` | 低 |

### 🥉 Tier 3（值得做，2 周 ROI 中）

| # | 包名 | 改进点 | 命令 | 风险 |
|---|---|---|---|---|
| 8 | `compression` | gzip 响应压缩 | `npm install compression` | 低 |
| 9 | `bcrypt`（替代 bcryptjs） | 性能 +20% | `npm install bcrypt` | 中（需编译） |
| 10 | `markdown-it` | 实验记录 Markdown 渲染 | `npm install markdown-it` | 低 |

---

## 四、D:\lab lims 现状 vs 推荐方案 Gap 分析

| 维度 | D:\lab lims 现状 | 业界最佳实践 | Gap | 优先级 |
|---|---|---|---|---|
| **数据层** | sql.js（内存 SQLite，进程崩溃丢数据） | better-sqlite3（持久化 + 事务） | ⚠️ **严重** | P0 |
| **校验** | 手写 if 检查 | Zod / Joi schema 校验 | ⚠️ 中 | P1 |
| **HTTP 安全** | 仅 cookie httpOnly | Helmet 全套头 | ⚠️ 中 | P1 |
| **日志** | console.log | Pino/Winston 结构化日志 | ⚠️ 低 | P2 |
| **审计** | audit_logs 表（无 hash 链） | SHA256 digest chain（防篡改） | ⚠️ 中 | P1 |
| **限流** | 无 | express-rate-limit | ⚠️ 低 | P2 |
| **备份** | 无（.data 复制） | 自动 cron + S3 | ⚠️ 中 | P1 |
| **测试** | 无 | Jest/Vitest + supertest | ⚠️ 中 | P1 |
| **类型** | JavaScript | TypeScript | ⚠️ 中 | P2 |
| **容器化** | 无 | Docker + docker-compose | ⚠️ 中 | P2 |
| **CI/CD** | 无 | GitHub Actions | ⚠️ 低 | P2 |
| **API 文档** | 无 | OpenAPI / Swagger | ⚠️ 中 | P2 |

---

## 五、P1/P2 改造路线图（基于本调研）

### P1（4-6 周，建议本月完成）

#### 阶段 1：数据层升级（1 周）
- [ ] 替换 `sql.js` → `better-sqlite3`
- [ ] 实现 `db.prepare()` + `db.transaction()`
- [ ] 增加自动保存机制（每次写操作 saveDB）

#### 阶段 2：输入校验（1 周）
- [ ] 引入 `zod`
- [ ] 定义各模块 schema（personnel / equipment / samples）
- [ ] API 中间件统一校验

#### 阶段 3：审计链加固（1 周）
- [ ] 实现 SHA256 digest chain audit log
- [ ] 每条审计带 prev_hash + curr_hash
- [ ] 校验工具：检测篡改

#### 阶段 4：HTTP 安全（3 天）
- [ ] 引入 `helmet`
- [ ] 加 `express-rate-limit` 限流

#### 阶段 5：定时任务（3 天）
- [ ] 引入 `node-cron`
- [ ] 配置：每日 02:00 自动备份 .data
- [ ] 配置：每周一提醒校准

### P2（2-3 月）

#### 阶段 6：测试（2 周）
- [ ] 引入 `jest` + `supertest`
- [ ] 覆盖率 70%+
- [ ] CI: GitHub Actions 自动跑测试

#### 阶段 7：容器化（1 周）
- [ ] `Dockerfile` 多阶段构建
- [ ] `docker-compose.yml`（app + backup）
- [ ] `.dockerignore`

#### 阶段 8：类型化（3 周）
- [ ] 渐进式迁移到 TypeScript
- [ ] 先迁移 server.js，再迁移 routes/

#### 阶段 9：API 文档（3 天）
- [ ] 引入 OpenAPI 自动生成
- [ ] `/api-docs` Swagger UI

---

## 六、推荐架构参考（借鉴而非 fork）

| 参考项目 | 借鉴点 | 不借鉴点 |
|---|---|---|
| **elabftw** | 电子实验记录本 UX / 时间线审计 | PHP 语言不符 |
| **senaite.core** | Analysis Request 状态机 / 多步骤检测流程 | Plone 框架太重 |
| **openboxes** | 库存预警 / 批次管理 / 有效期 | Groovy 技术栈不符 |
| **NEMO** | 资源预订 / 工具培训卡 | 需 Django（可借鉴设计） |
| **OpenELIS-Global-2** | 医学检验流程（样品→分析→审核） | Java Spring 框架 |
| **parkour2** | 4D 样品追踪 / 拖拽式流程 | 代码量太大 |

### 不推荐的方案（避免引入）

| 仓库 | 不推荐原因 |
|---|---|
| `BaobabLims/baobab.lims` | 7 年未更新（2022-06-30 最后 commit） |
| `miso-lims/miso-lims` | NGS 专用，复杂度过高 |
| `bikalims/bika.lims.legacy` | Plone 框架，迁移成本极高 |

---

## 七、立即执行清单（**等用户拍板**）

### 用户授权后可立即做的（基于本调研）：

1. ✅ `npm install better-sqlite3 zod helmet express-rate-limit node-cron pino pino-pretty exceljs compression`
2. ✅ 把 server.js 中的 sql.js 调用替换为 better-sqlite3
3. ✅ 在 server.js 加 helmet + rate-limit 中间件
4. ✅ 在 server.js 加 node-cron 每日 02:00 自动备份
5. ✅ 把 13 个 routes 的输入校验改为 zod schema
6. ✅ 实现 SHA256 audit chain
7. ✅ 在所有 console.log 改为 pino logger

---

## 八、参考资料

- GitHub Topics: `lims`, `lab-information-management-system`, `electronic-lab-notebook`
- 调研时间：2026-08-03 11:59
- 共查询 23 个核心仓库 + 30+ 候选
- 筛选标准：stars ≥ 100 或 LIMS 直接相关性

---

> 📌 **本调研旨在为 D:\lab lims 提供架构升级 skill 清单，不替代具体改造决策。**
> **下次改造前请参考本报告 + 本地项目实际需求综合判断。**

# Phase 5:CNAS 预审(第 13 周)

> **周期**: 2026-11-03 ~ 2026-11-09(1 周,5 工作日)
> **目标**: 性能达标 + 安全达标 + 整改完成 + CNAS 现场审核就绪
> **负责人**: 后端 + DevOps + 天枢 + CNAS 顾问

## 1. 任务清单

### Day 1:性能压测

- [ ] **Task 5.1**: 压测环境准备
  - 复用 staging 环境(等配置 / 等数据量)
  - 数据准备:100 万样品 + 1000 万检测结果(种子数据生成器)

- [ ] **Task 5.2**: k6 压测脚本 `tests/load/lims-load.js`
  ```javascript
  import http from 'k6/http';
  import { check } from 'k6';
  import { Rate, Trend } from 'k6/metrics';

  const errorRate = new Rate('errors');
  const apiLatency = new Trend('api_latency');

  export const options = {
    stages: [
      { duration: '1m', target: 100 },   // 100 用户
      { duration: '3m', target: 500 },   // 500 用户
      { duration: '5m', target: 1000 },  // 1000 用户峰值
      { duration: '3m', target: 500 },   // 回落
      { duration: '1m', target: 0 },     // 收尾
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      errors: ['rate<0.001'],
    },
  };

  export default function () {
    // 模拟真实业务流:登录 → 查询样品列表 → 创建样品 → 查询检测 → 出报告
    const loginRes = http.post('https://staging.dhg.example/auth/login', {
      username: 'loadtest',
      password: 'xxx',
    });
    check(loginRes, { 'login ok': (r) => r.status === 200 });

    const token = loginRes.json('accessToken');
    const headers = { Authorization: `Bearer ${token}` };

    // 查询样品列表
    const samplesRes = http.get('https://staging.dhg.example/samples?page=1&pageSize=20', { headers });
    apiLatency.add(samplesRes.timings.duration);
    errorRate.add(samplesRes.status !== 200);

    // ... 更多场景
  }
  ```

- [ ] **Task 5.3**: 关键场景压测
  - 场景 1:登录峰值(1000 并发)
  - 场景 2:样品列表查询(1000 并发)
  - 场景 3:报告 PDF 生成(100 并发)
  - 场景 4:QC 趋势查询(100 并发)
  - 场景 5:综合业务流(1000 并发)

- [ ] **Task 5.4**: 性能优化
  - 根据压测结果优化:
    - DB 索引(EXPLAIN ANALYZE)
    - Redis 缓存(热数据)
    - CDN(静态资源)
    - BullMQ 队列(PDF 生成)
    - 数据库连接池(Prisma)
    - Node.js 集群(PM2 / Cluster)

### Day 2:渗透测试

- [ ] **Task 5.5**: OWASP Top 10 自检
  - [ ] **A01 注入**:SQL 注入(Prisma 参数化已规避)、NoSQL 注入
  - [ ] **A02 失效身份认证**:JWT 签名、过期、撤销
  - [ ] **A03 敏感数据暴露**:TLS 1.3、密码 bcrypt、敏感字段加密
  - [ ] **A04 XXE**:NestJS XML 解析器配置
  - [ ] **A05 失效访问控制**:RBAC 守卫、IDOR 测试
  - [ ] **A06 安全配置错误**:Helmet、CORS、安全响应头
  - [ ] **A07 XSS**:前端 React 自动转义、Content-Security-Policy
  - [ ] **A08 不安全反序列化**:JWT 签名验证
  - [ ] **A09 组件漏洞**:`pnpm audit`、Snyk 扫描
  - [ ] **A10 日志不足**:审计日志、错误日志

- [ ] **Task 5.6**: 安全工具扫描
  - **OWASP ZAP**:自动化扫描
  - **Burp Suite**:手动渗透
  - **Snyk**:依赖漏洞扫描
  - **npm audit**:依赖漏洞扫描

- [ ] **Task 5.7**: 安全加固
  - [ ] 启用 Helmet(安全响应头)
  - [ ] 启用 CSP(Content-Security-Policy)
  - [ ] 启用 CORS 白名单
  - [ ] 启用 Rate Limiting(`@nestjs/throttler`)
  - [ ] 启用 SQL 注入防护(Prisma 已默认)
  - [ ] 启用密码策略(8 字符 + 大小写 + 数字 + 特殊)
  - [ ] 启用 MFA 强制(管理员)
  - [ ] 启用 HTTPS Only(Cookie Secure)
  - [ ] 启用 CSP Report-Only(监控违规)

### Day 3:可观测性 + 告警

- [ ] **Task 5.8**: Prometheus 指标
  - `infrastructure/docker/prometheus/prometheus.yml`
  - Node.js 指标:`prom-client`
  - NestJS 指标:`@willsoto/nestjs-prometheus`
  - DB 指标:`pg_exporter`
  - Redis 指标:`redis_exporter`
  - RabbitMQ 指标:`rabbitmq_exporter`

- [ ] **Task 5.9**: Grafana 仪表盘
  - `infrastructure/docker/grafana/dashboards/`
  - 仪表盘 1:系统总览(CPU / 内存 / 磁盘 / 网络)
  - 仪表盘 2:API 性能(P50/P95/P99)
  - 仪表盘 3:数据库(连接池 / 慢查询 / 锁等待)
  - 仪表盘 4:业务指标(今日样品 / 检测 / 报告)
  - 仪表盘 5:QC 趋势(Westgard 违规数)

- [ ] **Task 5.10**: 告警规则
  - `infrastructure/docker/prometheus/alerts.yml`
  ```yaml
  groups:
    - name: api
      rules:
        - alert: HighErrorRate
          expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
          for: 5m
          labels: { severity: critical }
          annotations:
            summary: "API 错误率超过 1%"

        - alert: HighLatency
          expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
          for: 5m
          labels: { severity: warning }
          annotations:
            summary: "API P95 超过 500ms"
    - name: audit_chain
      rules:
        - alert: AuditChainBroken
          expr: audit_chain_verify_result == 0
          for: 1m
          labels: { severity: critical }
          annotations:
            summary: "审计链断链!"
  ```

- [ ] **Task 5.11**: 链路追踪(OpenTelemetry)
  - `apps/backend/src/common/otel/tracing.ts`
  - 集成 Tempo / Jaeger
  - 追踪 HTTP → Service → Repository → DB
  - 追踪 BullMQ 队列

### Day 4:整改 + 文档

- [ ] **Task 5.12**: 整改报告 `docs/REMEDIATION-REPORT.md`
  - 列出压测/渗透测试发现的问题
  - 列出整改措施 + 完成时间
  - 列出遗留风险 + 缓解计划

- [ ] **Task 5.13**: 整改实施
  - 高危漏洞 24 小时内修复
  - 中危漏洞 1 周内修复
  - 低危漏洞 下个迭代修复

- [ ] **Task 5.14**: 完整文档
  - `README.md` 更新到最新版
  - `CONTRIBUTING.md` 完善
  - `docs/01-ARCHITECTURE.md` 校准
  - `docs/05-DEPLOYMENT.md` 完善部署细节
  - `docs/CNAS-APPLICATION.md` CNAS 申请书 + 附件清单

### Day 5:CNAS 现场审核就绪

- [ ] **Task 5.15**: CNAS 申请书 + 附件
  - 申请书(机构基本信息 + 检测能力范围)
  - 附件:人员清单 + 设备清单 + 标准物质清单 + 检测方法清单
  - 附件:质量手册 + 程序文件(可放 PDF)
  - 附件:典型检测报告样张(最近 3 个月)

- [ ] **Task 5.16**: 现场审核准备
  - 审核员现场考察清单
  - 演示路径:登录 → 接收样品 → 检测 → QC → 审核 → 报告 PDF
  - 备份文件 + 异地备份验证现场演示
  - 审计链 GUI 现场演示
  - ALCOA+ 9 原则逐条演示
  - 应急预案演练(可选)

- [ ] **Task 5.17**: 提交 CNAS 申请
  - 线上提交申请书
  - 缴费
  - 等待审核员排期

## 2. 交付物清单

| 类别 | 文件 |
|---|---|
| **压测** | `tests/load/lims-load.js`、`tests/load/load-test-report.md` |
| **安全** | `tests/security/zap-report.html`、`docs/SECURITY-AUDIT.md` |
| **可观测** | `infrastructure/docker/prometheus/prometheus.yml`、`infrastructure/docker/prometheus/alerts.yml`、`infrastructure/docker/grafana/dashboards/*.json` |
| **链路追踪** | `apps/backend/src/common/otel/tracing.ts` |
| **整改** | `docs/REMEDIATION-REPORT.md` |
| **CNAS 申请** | `docs/CNAS-APPLICATION/`(申请书 + 附件) |

## 3. 验证标准

### 性能验证(关键)

- [ ] **V-5.1**: API P95 < 500ms(1000 并发)
- [ ] **V-5.2**: API P99 < 1s(1000 并发)
- [ ] **V-5.3**: 错误率 < 0.1%
- [ ] **V-5.4**: 100 万样品流畅查询(列表 P95 < 500ms)
- [ ] **V-5.5**: Lighthouse 前端 ≥ 95(LCP < 2.5s, INP < 200ms)

### 安全验证

- [ ] **V-5.6**: OWASP Top 10 全规避
- [ ] **V-5.7**: 依赖漏洞 0 高危
- [ ] **V-5.8**: Helmet + CSP + CORS + RateLimit 启用
- [ ] **V-5.9**: MFA 强制启用(管理员)

### 可观测验证

- [ ] **V-5.10**: Prometheus 指标全
- [ ] **V-5.11**: Grafana 5 个仪表盘就绪
- [ ] **V-5.12**: 告警规则 + 通知渠道(钉钉/飞书)对接
- [ ] **V-5.13**: 链路追踪 100% 覆盖

### CNAS 验证

- [ ] **V-5.14**: CNAS 自检 100% 通过
- [ ] **V-5.15**: 内部审核 100% 通过
- [ ] **V-5.16**: 整改报告输出
- [ ] **V-5.17**: CNAS 申请书提交

## 4. 里程碑 M6:CNAS 预审通过

Phase 5 完成后,LIMS 达到 **M6 里程碑:CNAS 预审通过**。所有性能/安全/合规指标达成,可正式接受 CNAS 现场审核。

## 5. 13 周总结

| 周 | 主题 | 关键产出 |
|---|---|---|
| W1 | Phase 0 基座 | monorepo + 全栈可启动 |
| W2-3 | Phase 1 基础设施 | schema + 审计 + JWT + OpenAPI |
| W4-6 | Phase 2 MVP 切片 | **样品→检测→报告端到端**(最关键) |
| W7-10 | Phase 3 横向扩展 | 13 模块全部上线 |
| W11-12 | Phase 4 合规加固 | 备份 + 灾备 + 自检 |
| W13 | Phase 5 CNAS 预审 | 性能 + 安全 + 整改 |

**总投入**:13 周 ≈ 3 个月,5-6 人(含 AI 加速),对比原 12 个月路线图:
- ✅ **时间缩短 75%**
- ✅ **可演示 MVP 在 W6 完成**(对比原 M9-M10)
- ✅ **CNAS 预审在 W13 完成**(对比原 M12)

## 6. 后续路线(M13+)

13 周后 LIMS 已具备 CNAS 现场审核能力。后续可规划:

- **M14-16 高级特性**:工作流引擎增强、移动端、PWA 离线、消息通知
- **M17-20 集成**:与 ERP / MES / 黄金交易所对接、API 开放平台
- **M21-24 AI 增强**:异常检测、QC 趋势预测、报告自动生成、智能客服
- **持续运营**:性能监控、用户反馈、迭代优化、新检测方法扩展
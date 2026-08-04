# 03 - API 规范（API）

> **协议**: REST + JSON
> **认证**: JWT Bearer Token
> **文档**: OpenAPI 3.0
> **版本**: v1
> **日期**: 2026-08-03

---

## 1. 设计原则

1. **RESTful 风格**：资源 + HTTP 方法
2. **统一前缀**：`/api/v1/`
3. **JSON 格式**：UTF-8，无 BOM
4. **小写 + 复数**：`/users`, `/samples`
5. **HTTP 语义**：GET/POST/PUT/DELETE
6. **状态码标准**：2xx/4xx/5xx
7. **分页**：cursor-based
8. **限流**：100 req/min/IP

## 2. URL 规范

### 2.1 命名约定

| 资源 | 单数 | 复数 (URL) |
|---|---|---|
| 用户 | user | /users |
| 样品 | sample | /samples |
| 检测 | test | /tests |
| 设备 | equipment | /equipments |
| 试剂 | reagent | /reagents |
| 报告 | report | /reports |
| 隐患 | hazard | /hazards |

### 2.2 URL 结构

```
GET    /api/v1/{resource}                # 列表
GET    /api/v1/{resource}/:id            # 详情
POST   /api/v1/{resource}                # 创建
PUT    /api/v1/{resource}/:id            # 完整更新
PATCH  /api/v1/{resource}/:id            # 部分更新
DELETE /api/v1/{resource}/:id            # 删除

# 关系
GET    /api/v1/samples/:id/tests         # 样品的检测列表
POST   /api/v1/samples/:id/tests         # 为样品创建检测

# 动作
POST   /api/v1/samples/:id/receive       # 接收样品
POST   /api/v1/samples/:id/transfer      # 流转
POST   /api/v1/samples/:id/dispose       # 处置

# 特殊
GET    /api/v1/dashboard/stats            # 仪表盘
POST   /api/v1/auth/login                # 登录
POST   /api/v1/auth/logout               # 登出
POST   /api/v1/auth/refresh              # 刷新 token
```

## 3. 请求格式

### 3.1 通用头

```http
POST /api/v1/samples HTTP/1.1
Host: lims.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-Trace-ID: abc123
Accept: application/json
```

### 3.2 请求体（创建样品）

```json
{
  "sample_name": "金矿石 #001",
  "sample_type": "mineral",
  "client_name": "甘肃金矿集团",
  "client_contact": "张经理 / 13800138000",
  "project_id": "uuid-of-icp-ms-project",
  "test_item": "Au, Ag, Cu",
  "priority": "high",
  "remark": "加急"
}
```

## 4. 响应格式

### 4.1 成功响应

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sample_code": "MIN-20260803-0001",
    "sample_name": "金矿石 #001",
    "state": "received",
    "created_at": "2026-08-03T08:00:00Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "trace_id": "abc123",
    "timestamp": "2026-08-03T08:00:00.123Z"
  }
}
```

### 4.2 列表 + 分页

```json
{
  "success": true,
  "data": [
    { "id": "uuid1", "sample_code": "MIN-20260803-0001" },
    { "id": "uuid2", "sample_code": "MIN-20260803-0002" }
  ],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "cursor": "eyJpZCI6IjU1MCJ9",
    "next_cursor": "eyJpZCI6IjYwMCJ9",
    "has_more": true
  }
}
```

### 4.3 错误响应

```json
{
  "success": false,
  "error": {
    "code": "SAMPLE_NOT_FOUND",
    "message": "样品 MIN-20260803-0001 不存在",
    "details": {
      "sample_code": "MIN-20260803-0001"
    },
    "path": "/api/v1/samples/MIN-20260803-0001",
    "timestamp": "2026-08-03T08:00:00.123Z",
    "trace_id": "abc123"
  }
}
```

## 5. 错误码

### 5.1 业务错误码（4xx）

| 错误码 | HTTP | 含义 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 数据校验失败 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `TOKEN_EXPIRED` | 401 | Token 过期 |
| `FORBIDDEN` | 403 | 无权限 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 |
| `SAMPLE_NOT_FOUND` | 404 | 样品不存在 |
| `EQUIPMENT_NOT_FOUND` | 404 | 设备不存在 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `RESOURCE_CONFLICT` | 409 | 资源冲突（如重复） |
| `SAMPLE_CODE_DUPLICATE` | 409 | 样品编号重复 |
| `STATE_INVALID` | 409 | 状态机非法转换 |
| `EQUIPMENT_OUT_OF_SERVICE` | 409 | 设备停用 |
| `RATE_LIMIT_EXCEEDED` | 429 | 限流 |
| `QC_OUT_OF_CONTROL` | 422 | QC 失控 |

### 5.2 系统错误码（5xx）

| 错误码 | HTTP | 含义 |
|---|---|---|
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `DATABASE_ERROR` | 500 | 数据库错误 |
| `EXTERNAL_SERVICE_ERROR` | 502 | 外部服务错误 |
| `MAINTENANCE` | 503 | 维护中 |

## 6. 关键端点清单

### 6.1 认证 Auth

```yaml
/api/v1/auth/login:
  post:
    summary: 登录
    body: { username, password, mfa_code? }
    returns: { access_token, refresh_token, user }
    errors: [401 UNAUTHORIZED, 423 MFA_REQUIRED]

/api/v1/auth/refresh:
  post:
    summary: 刷新 Token
    body: { refresh_token }
    returns: { access_token, refresh_token }

/api/v1/auth/logout:
  post:
    summary: 登出
    body: { refresh_token }
    returns: { success: true }

/api/v1/auth/me:
  get:
    summary: 当前用户
    returns: { id, username, name, role, permissions[] }
```

### 6.2 样品 Sample

```yaml
/api/v1/samples:
  get:
    summary: 样品列表
    query: { state?, sample_type?, client_name?, from?, to?, limit?, cursor? }
    returns: Sample[]
  post:
    summary: 接收样品
    body: CreateSampleDto
    returns: Sample
    errors: [409 SAMPLE_CODE_DUPLICATE]

/api/v1/samples/:id:
  get:
    summary: 样品详情
    returns: Sample (with tests, storage)
  patch:
    summary: 部分更新
    body: UpdateSampleDto
    returns: Sample

/api/v1/samples/:id/receive:
  post:
    summary: 接收样品（带二维码扫描）
    body: { qr_code, location? }
    returns: Sample

/api/v1/samples/:id/transfer:
  post:
    summary: 流转（转检测人/转留样）
    body: { to_user_id, to_storage, reason? }
    returns: Sample

/api/v1/samples/:id/dispose:
  post:
    summary: 处置（销毁/回收/归还）
    body: { method, witness_id, remark? }
    returns: { success: true }
```

### 6.3 检测 Test

```yaml
/api/v1/tests:
  get:
    summary: 检测任务列表
    query: { state?, sample_id?, project_id?, assigned_to? }
    returns: Test[]

  post:
    summary: 创建检测任务
    body: { sample_id, project_id, test_method, assigned_to? }
    returns: Test

/api/v1/tests/:id:
  get:
    summary: 检测详情（含结果）
    returns: Test (with results, qc_data)

/api/v1/tests/:id/results:
  post:
    summary: 录入检测结果
    body: [{ analyte, value, unit, judgement, equipment_id, reagent_lot }]
    returns: Test

/api/v1/tests/:id/review:
  post:
    summary: 校核
    body: { passed, remark? }
    returns: Test (state=reviewed)

/api/v1/tests/:id/approve:
  post:
    summary: 审核
    body: { passed, remark? }
    returns: Test (state=approved)

/api/v1/tests/:id/qc-evaluate:
  get:
    summary: 评估 QC 状态
    returns: { in_control, violations[], z_scores[] }
```

### 6.4 设备 Equipment

```yaml
/api/v1/equipments:
  get:
    query: { state?, dept_id?, type?, next_calib_before? }
  post:
    body: CreateEquipmentDto
    returns: Equipment

/api/v1/equipments/:id/calibrate:
  post:
    summary: 提交校准记录
    body: { calibration_date, calibration_org, certificate_no, valid_date, result, file_id }
    returns: EquipmentCalibration

/api/v1/equipments/:id/maintain:
  post:
    body: { maintenance_type, content, cost, next_maintenance_date }
    returns: EquipmentMaintenance

/api/v1/equipments/due-calibration:
  get:
    summary: 即将到期校准（30 天内）
    returns: Equipment[]
```

### 6.5 报告 Report

```yaml
/api/v1/reports:
  get:
    query: { state?, sample_id?, test_id?, from?, to? }
  post:
    body: { test_id }
    returns: Report (state=draft)

/api/v1/reports/:id:
  get:
    returns: Report (with signatures, revisions)

/api/v1/reports/:id/sign:
  post:
    body: { stage, password, mfa_code }
    returns: { signed_at, certificate_serial }

/api/v1/reports/:id/pdf:
  get:
    summary: 下载 PDF
    returns: application/pdf
    headers: Content-Disposition: attachment

/api/v1/reports/:id/revise:
  post:
    body: { reason }
    returns: { new_version, pdf_url }
```

### 6.6 QC 质控

```yaml
/api/v1/qc/samples:
  get:
    query: { project_id?, analyte?, valid_before? }
  post:
    body: { qc_no, project_id, analyte, expected_value, expected_sd, unit, lot_no, valid_date }

/api/v1/qc/samples/:id/measurements:
  get:
    query: { from?, to? }
  post:
    body: { measured_value, equipment_id, reagent_lot }
    returns: { z_score, rule_violations[], status }

/api/v1/qc/trend:
  get:
    query: { qc_id, from, to }
    returns: { measurements, mean, sd, control_limits }
```

### 6.7 人员 Personnel

```yaml
/api/v1/personnel:
  get, post, get/:id, patch/:id

/api/v1/personnel/:id/trainings:
  get:
    query: { type?, year? }
  post:
    body: { training_type, training_name, training_date, duration_hours, trainer, result, certificate_no?, valid_until? }

/api/v1/personnel/:id/competency:
  get:
    summary: 人员能力
    returns: Competency[] (per project)

/api/v1/personnel/competency-matrix:
  get:
    summary: 人员能力矩阵
    returns: { personnel[], projects[], matrix[][] }
```

### 6.8 审计 Audit

```yaml
/api/v1/audit/logs:
  get:
    summary: 审计日志查询
    query: { user_id?, action?, table_name?, from?, to?, limit?, cursor? }
    returns: AuditLog[]

/api/v1/audit/verify:
  get:
    summary: 验证 hash chain
    returns: { valid: boolean, broken_at?: number, total: number }

  post:
    summary: 触发验证
    body: { from?, to? }
    returns: { valid, broken_at, report_url }
```

### 6.9 隐患 EHS

```yaml
/api/v1/ehs/hazards:
  get, post, get/:id, patch/:id

/api/v1/ehs/hazards/:id/close:
  post:
    body: { closed_at, control_measures_done }
    returns: Hazard

/api/v1/ehs/inspections:
  get, post
```

### 6.10 仪表盘 Dashboard

```yaml
/api/v1/dashboard/stats:
  get:
    returns: {
      samples_today, samples_pending, tests_running,
      equipment_available, equipment_maintenance,
      reagents_low_stock, standards_expiring,
      hazards_open, qc_in_control_rate
    }

/api/v1/dashboard/trend:
  get:
    query: { metric, from, to, interval? }
    returns: { points: [{ ts, value }] }

/api/v1/dashboard/heatmap:
  get:
    query: { type, from, to }
    returns: { matrix: number[][] }
```

## 7. 认证

### 7.1 JWT 流程

```
1. POST /api/v1/auth/login { username, password, mfa_code? }
   ↓
2. 验证通过 → 返回 { access_token, refresh_token }
   - access_token: 15 分钟过期
   - refresh_token: 7 天过期

3. 后续请求：
   Authorization: Bearer <access_token>

4. access_token 过期：
   POST /api/v1/auth/refresh { refresh_token }
   ↓
   返回新的 token pair
```

### 7.2 JWT Payload

```json
{
  "sub": "user-uuid",
  "username": "yuwangang",
  "role": "analyst",
  "permissions": ["sample:read", "sample:create", "test:read"],
  "iat": 1691059200,
  "exp": 1691060100
}
```

## 8. 限流

```yaml
# 全局
/api/v1/*: 100 req / 1 min / IP

# 特殊
/api/v1/auth/login: 5 req / 5 min / IP
/api/v1/auth/refresh: 30 req / 1 min / IP
/api/v1/*/export/*: 10 req / 1 hour / IP
```

## 9. 缓存策略

| 端点 | 缓存 | TTL |
|---|---|---|
| GET /api/v1/dashboard/stats | Redis | 5 min |
| GET /api/v1/projects | Redis | 1 hour |
| GET /api/v1/departments | Redis | 1 hour |
| GET /api/v1/users/me | Redis | 5 min |
| 列表类（带 cursor） | 不缓存 | - |
| 详情类 | 不缓存 | - |

## 10. 幂等性

- POST 请求支持 `Idempotency-Key` 头
- 同一 key 24 小时内只生效一次
- 用于：支付、报告生成、签名

## 11. 分页

### 11.1 Cursor-based

```http
GET /api/v1/samples?limit=50&cursor=eyJpZCI6IjU1MCJ9
```

```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "cursor": "eyJpZCI6IjU1MCJ9",
    "next_cursor": "eyJpZCI6IjYwMCJ9",
    "has_more": true
  }
}
```

### 11.2 Page-based（少数端点）

```http
GET /api/v1/audit/logs?page=1&limit=50
```

## 12. OpenAPI 3.0 摘录

```yaml
openapi: 3.0.3
info:
  title: 敦煌金质检 LIMS API
  version: 1.0.0
  description: 专家级 LIMS 系统 API

servers:
  - url: https://lims.example.com/api/v1
    description: 生产环境
  - url: https://test.lims.example.com/api/v1
    description: 测试环境
  - url: http://localhost:3000/api/v1
    description: 本地开发

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id: { type: string, format: uuid }
        username: { type: string }
        email: { type: string, format: email }
        name: { type: string }
        role: { type: string, enum: [admin, manager, analyst, intern] }
        status: { type: string, enum: [active, inactive] }

    Sample:
      type: object
      properties:
        id: { type: string, format: uuid }
        sample_code: { type: string }
        sample_name: { type: string }
        sample_type: { type: string }
        state: { type: string, enum: [received, transferred, testing, completed, stored, disposed] }
        received_at: { type: string, format: date-time }

    Error:
      type: object
      properties:
        success: { type: boolean, example: false }
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: object }
            path: { type: string }
            timestamp: { type: string, format: date-time }
            trace_id: { type: string }

security:
  - BearerAuth: []

paths:
  /auth/login:
    post:
      summary: 用户登录
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string }
                password: { type: string, format: password }
                mfa_code: { type: string }
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      access_token: { type: string }
                      refresh_token: { type: string }
                      user: { $ref: '#/components/schemas/User' }

  /samples:
    get:
      summary: 样品列表
      parameters:
        - { name: state, in: query, schema: { type: string } }
        - { name: sample_type, in: query, schema: { type: string } }
        - { name: from, in: query, schema: { type: string, format: date-time } }
        - { name: to, in: query, schema: { type: string, format: date-time } }
        - { name: limit, in: query, schema: { type: integer, default: 50 } }
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        '200':
          description: 成功

    post:
      summary: 接收样品
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSampleDto'
      responses:
        '201':
          description: 创建成功
        '409':
          description: 编号重复
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

## 13. 版本管理

- URL 中包含版本：`/api/v1/`
- 不兼容变更 → `/api/v2/`
- 兼容变更 → 同版本
- 旧版本至少保留 6 个月

## 14. 附录

- [架构设计](01-ARCHITECTURE.md)
- [数据库设计](02-DATABASE.md)
- [CNAS 合规](04-CNAS-COMPLIANCE.md)
- [部署架构](05-DEPLOYMENT.md)
- [实施路线图](06-ROADMAP.md)

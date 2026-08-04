# Phase 1:基础设施(第 2-3 周)

> **周期**: 2026-08-18 ~ 2026-08-31(2 周,10 工作日)
> **目标**: 数据库 schema 落地 + 审计链 + 认证 + OpenAPI
> **业务约束**: 优先 9 张核心表(users / departments / user_roles / user_sessions / audit_logs + samples / tests / results / reports)
> **负责人**: 后端工程师(主)+ 天枢(Review)+ DevOps(基础设施)

## 1. 任务清单

### Week 1(第 2 周):Prisma Schema + 数据库

#### Day 1-3:Prisma Schema 定义

- [ ] **Task 1.1**: 创建 `apps/backend/prisma/schema.prisma`
  ```prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  // ========== identity 域 ==========
  model User {
    id              String    @id @default(uuid())
    username        String    @unique
    email           String    @unique
    passwordHash    String
    name            String
    phone           String?
    deptId          String?
    title           String?
    role            UserRole  @default(ANALYST)
    status          UserStatus @default(ACTIVE)
    mfaSecret       String?
    mfaEnabled      Boolean   @default(false)
    mfaBackupCodes  String[]  // 加密存储
    lastLoginAt     DateTime?
    lastLoginIp     String?
    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt
    createdById     String?
    updatedById     String?
    deletedAt       DateTime?

    dept            Department? @relation(fields: [deptId], references: [id])
    sessions        UserSession[]
    roles           UserRoleAssignment[]
    auditLogs       AuditLog[]

    @@index([username])
    @@index([email])
    @@index([deptId])
    @@index([deletedAt])
  }

  enum UserRole {
    ADMIN
    LAB_DIRECTOR
    QUALITY_MANAGER
    EQUIPMENT_MANAGER
    REAGENT_MANAGER
    SENIOR_ANALYST
    ANALYST
    INTERN
    EXTERNAL_AUDITOR
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    PENDING
  }

  model Department {
    id        String   @id @default(uuid())
    code      String   @unique
    name      String
    parentId  String?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    deletedAt DateTime?

    parent    Department?  @relation("DeptHierarchy", fields: [parentId], references: [id])
    children  Department[] @relation("DeptHierarchy")
    users     User[]

    @@index([code])
    @@index([parentId])
  }

  model UserRoleAssignment {
    id        String   @id @default(uuid())
    userId    String
    role      UserRole
    scope     String?  // 资源范围(如部门 ID)
    grantedBy String?
    grantedAt DateTime @default(now())
    expiresAt DateTime?

    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([userId, role, scope])
    @@index([userId])
  }

  model UserSession {
    id               String   @id @default(uuid())
    userId           String
    refreshTokenHash String
    userAgent        String?
    ip               String?
    expiresAt        DateTime
    revoked          Boolean  @default(false)
    createdAt        DateTime @default(now())

    user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
    @@index([expiresAt])
  }

  // ========== 审计日志(SHA256 链)==========
  // 详见 ADR-0003:审计链 PG 触发器
  model AuditLog {
    id         BigInt   @id @default(autoincrement())
    userId     String?
    username   String   // 冗余存储,user 删除后不丢
    action     String   // 'sample.received' / 'test.created' / 'report.signed'
    tableName  String?
    recordId   String?
    oldData    Json?
    newData    Json?
    ip         String?
    prevHash   String   // SHA256 hex 64 chars
    currHash   String   // SHA256 hex 64 chars
    createdAt  DateTime @default(now())

    user       User?    @relation(fields: [userId], references: [id])

    @@index([userId, createdAt])
    @@index([tableName, recordId])
    @@index([createdAt])
    @@index([currHash])  // 断链自检
  }

  // ========== sample 域(垂直切片核心)==========
  model Sample {
    id           String      @id @default(uuid())
    sampleNo     String      @unique  // YYMMDD-NNNN
    batchId      String?
    customerName String
    customerRef  String?     // 客户委托单号
    sampleType   SampleType  // GOLD_INGOT / GOLD_POWDER / ALLOY / JEWELRY / RECYCLED
    declaredPurityPct Decimal? @db.Decimal(10, 6)  // 客户声明纯度
    weightG      Decimal     @db.Decimal(15, 6)
    receivedAt   DateTime    @default(now())
    receivedById String?
    storageLocation String?  // 留样位置
    status       SampleStatus @default(RECEIVED)
    photoFileIds String[]    // MinIO 照片 ID
    remarks      String?
    createdAt    DateTime    @default(now())
    updatedAt    DateTime    @updatedAt
    deletedAt    DateTime?

    batch        SampleBatch? @relation(fields: [batchId], references: [id])
    tests        Test[]
    reports      Report[]

    @@index([sampleNo])
    @@index([batchId])
    @@index([status])
    @@index([receivedAt])
  }

  enum SampleType {
    GOLD_INGOT       // 金锭
    GOLD_POWDER      // 金粉
    GOLD_ALLOY       // 金合金
    JEWELRY          // 首饰
    RECYCLED_GOLD    // 回收金料
    SILVER           // 银
    PLATINUM         // 铂
    PALLADIUM        // 钯
    OTHER
  }

  enum SampleStatus {
    RECEIVED       // 已接收
    BATCHED        // 已分批
    IN_TEST        // 检测中
    TESTED         // 已检测
    REPORT_DRAFT   // 报告起草中
    REPORT_REVIEW  // 报告审核中
    REPORT_APPROVED // 报告已批准
    ARCHIVED       // 已归档
    REJECTED       // 拒收
  }

  model SampleBatch {
    id              String      @id @default(uuid())
    batchNo         String      @unique  // FB-20260804-001(火试金) / ICP-20260804-001(ICP)
    method          AssayMethod
    startedAt       DateTime?
    completedAt     DateTime?
    operatorId      String?
    qcSampleId      String?
    replicateCount  Int         @default(3)
    furnaceNo       String?     // 火试金:试金炉编号
    status          BatchStatus @default(PENDING)
    createdAt       DateTime    @default(now())
    updatedAt       DateTime    @updatedAt

    samples         Sample[]

    @@index([batchNo])
    @@index([method, status])
  }

  enum AssayMethod {
    FIRE_ASSAY              // 火试金法(主)
    ICP_OES                 // ICP-OES(主)
    ICP_MS                  // ICP-MS(主)
    XRF                     // X 射线荧光
    FIRE_ASSAY_GRAVIMETRIC  // 火试金重量法
    VOLUMETRIC              // 滴定法
    ICP_GBC                 // 比较法
    OTHER
  }

  enum BatchStatus {
    PENDING
    MIXING
    FUSING         // 火试金:熔融
    CUPELLING      // 火试金:灰吹
    PARTING        // 火试金:分金
    ANNEALING      // 火试金:退火
    WEIGHING       // 火试金:称重
    CALCULATING
    COMPLETED
    REJECTED
  }

  // ========== test 域(垂直切片核心)==========
  model Test {
    id           String   @id @default(uuid())
    sampleId     String
    batchId      String?
    method       AssayMethod
    startedAt    DateTime?
    completedAt  DateTime?
    operatorId   String?
    status       TestStatus @default(PENDING)
    purityPct    Decimal?  @db.Decimal(10, 6)
    uncertainty  Decimal?  @db.Decimal(10, 6)
    unit         String    @default("%")
    qcPassed     Boolean?
    createdAt    DateTime  @default(now())
    updatedAt    DateTime  @updatedAt

    sample       Sample     @relation(fields: [sampleId], references: [id], onDelete: Cascade)
    fireAssay    FireAssayDetail?
    elementResults ElementResult[]

    @@index([sampleId])
    @@index([method, status])
  }

  enum TestStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    QC_FAILED
    REJECTED
  }

  // 火试金专用字段(一对一)
  model FireAssayDetail {
    id                 String   @id @default(uuid())
    testId             String   @unique
    sampleWeightG      Decimal  @db.Decimal(15, 6)
    leadButtonWeightG  Decimal? @db.Decimal(15, 6)
    prillWeightG       Decimal? @db.Decimal(15, 6)
    partingAcid        String?
    furnaceTempC       Int?
    cupellationMin     Int?
    partingMin         Int?
    annealingMin       Int?
    qcRecoveryPct      Decimal? @db.Decimal(5, 2)

    test               Test     @relation(fields: [testId], references: [id], onDelete: Cascade)
  }

  // ICP 多元素结果(一对多)
  model ElementResult {
    id            String   @id @default(uuid())
    testId        String
    element       String   // Au / Ag / Cu / Fe / Pb / Pt / Pd ...
    wavelengthNm  Decimal? @db.Decimal(8, 3)
    intensity     Decimal? @db.Decimal(15, 3)
    concentration Decimal  @db.Decimal(15, 9)
    unit          String   @default("ppm")
    lod           Decimal? @db.Decimal(15, 9)  // 检出限
    loq           Decimal? @db.Decimal(15, 9)  // 定量限
    uncertainty   Decimal? @db.Decimal(15, 9)

    test          Test     @relation(fields: [testId], references: [id], onDelete: Cascade)

    @@index([testId])
    @@index([element])
  }

  // ========== report 域(垂直切片核心)==========
  model Report {
    id           String   @id @default(uuid())
    reportNo     String   @unique  // LIMS-2026-NNNNNN
    sampleId     String
    status       ReportStatus @default(DRAFT)
    pdfFileId    String?  // MinIO PDF ID
    pdfSha256    String?  // PDF 内容 SHA256
    qrCode       String?  // 二维码内容
    createdAt    DateTime @default(now())
    issuedAt     DateTime?
    createdById  String?

    sample       Sample   @relation(fields: [sampleId], references: [id])
    stages       ReportStage[]
    signatures   ReportSignature[]

    @@index([reportNo])
    @@index([sampleId])
    @@index([status])
  }

  enum ReportStatus {
    DRAFT
    INTERNAL_REVIEW   // 内部审核
    FINAL_REVIEW      // 终审
    APPROVED          // 已批准
    ISSUED            // 已签发
    REJECTED
    SUPERSEDED        // 被替代
  }

  model ReportStage {
    id          String   @id @default(uuid())
    reportId    String
    stage       ReportStatus  // 当前阶段
    userId      String
    comments    String?
    createdAt   DateTime @default(now())

    report      Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)

    @@index([reportId])
  }

  model ReportSignature {
    id              String   @id @default(uuid())
    reportId        String
    signerId        String
    signerRole      UserRole
    signatureData   String   // Base64 CA 签名
    certificateSerial String  // CA 证书序列号
    timestampToken  String   // 时间戳 token
    signedAt        DateTime @default(now())
    ipAddress       String?

    report          Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)

    @@index([reportId])
    @@index([signerId])
  }

  // 详见 ADR-0011
  ```

- [ ] **Task 1.2**: 执行首次迁移
  ```bash
  cd apps/backend
  pnpm prisma migrate dev --name init_identity_sample_test_report
  ```

- [ ] **Task 1.3**: 创建数据库种子(`prisma/seed.ts`)
  - 1 个实验室主任、1 个质量负责人、3 个检测员、1 个实习生
  - 5 个角色枚举
  - 3 个部门
  - 10 个示例样品 + 5 个批次

#### Day 4:审计链触发器(关键合规设计)

- [ ] **Task 1.4**: 创建 `prisma/triggers/audit_chain.sql`
  ```sql
  -- 详见 ADR-0003:审计链 SHA256 PG 触发器

  -- 1. 创建 SHA256 函数
  CREATE OR REPLACE FUNCTION compute_audit_hash(
    p_prev_hash TEXT,
    p_user_id TEXT,
    p_username TEXT,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id TEXT,
    p_new_data JSONB,
    p_created_at TIMESTAMPTZ
  ) RETURNS TEXT AS $$
  DECLARE
    v_concat TEXT;
  BEGIN
    v_concat := COALESCE(p_prev_hash, '0000000000000000000000000000000000000000000000000000000000000000')
      || '|' || COALESCE(p_user_id, '')
      || '|' || p_username
      || '|' || p_action
      || '|' || COALESCE(p_table_name, '')
      || '|' || COALESCE(p_record_id, '')
      || '|' || COALESCE(p_new_data::TEXT, '')
      || '|' || p_created_at::TEXT;
    RETURN encode(digest(v_concat, 'sha256'), 'hex');
  END;
  $$ LANGUAGE plpgsql IMMUTABLE;

  -- 2. 通用审计触发器函数
  CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
  DECLARE
    v_prev_hash TEXT;
    v_curr_hash TEXT;
    v_username  TEXT;
    v_user_id   TEXT;
    v_action    TEXT;
    v_table     TEXT;
    v_record_id TEXT;
    v_new_data  JSONB;
    v_created_at TIMESTAMPTZ := now();
  BEGIN
    -- 从 session variable 获取当前用户(Passport/Interceptor 设置)
    v_user_id := current_setting('app.current_user_id', true);
    v_username := current_setting('app.current_username', true);

    -- 取上一条哈希
    SELECT curr_hash INTO v_prev_hash
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 1;

    v_table := TG_TABLE_NAME;
    v_record_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT);
    v_action := TG_OP || ':' || v_table;

    IF TG_OP = 'INSERT' THEN
      v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
      v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
      v_new_data := to_jsonb(OLD);
    END IF;

    v_curr_hash := compute_audit_hash(
      v_prev_hash, v_user_id, v_username, v_action, v_table, v_record_id, v_new_data, v_created_at
    );

    INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_data, prev_hash, curr_hash, created_at)
    VALUES (v_user_id, v_username, v_action, v_table, v_record_id, v_new_data, v_prev_hash, v_curr_hash, v_created_at);

    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;

  -- 3. 给所有关键业务表加触发器
  CREATE TRIGGER audit_samples AFTER INSERT OR UPDATE OR DELETE ON samples
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_sample_batches AFTER INSERT OR UPDATE OR DELETE ON sample_batches
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_tests AFTER INSERT OR UPDATE OR DELETE ON tests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_element_results AFTER INSERT OR UPDATE OR DELETE ON element_results
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_fire_assay_details AFTER INSERT OR UPDATE OR DELETE ON fire_assay_details
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_reports AFTER INSERT OR UPDATE OR DELETE ON reports
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  CREATE TRIGGER audit_report_signatures AFTER INSERT OR UPDATE OR DELETE ON report_signatures
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

  -- 4. 禁止直接修改审计日志
  CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'audit_logs is append-only, modification not allowed';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER no_modify_audit BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
  ```

- [ ] **Task 1.5**: 创建断链自检脚本 `scripts/audit-verify.ts`
  ```typescript
  // 跑遍所有 audit_logs,验证 prev_hash == 上一条 curr_hash
  // 任一不匹配即报红
  ```

#### Day 5:TimescaleDB 时序扩展(QC 趋势表)

- [ ] **Task 1.6**: 创建时序 hypertable
  ```sql
  CREATE TABLE qc_measurements (
    time        TIMESTAMPTZ NOT NULL,
    element     TEXT        NOT NULL,
    method      TEXT        NOT NULL,
    z_score     DECIMAL(8,4),
    measured    DECIMAL(15,9),
    expected    DECIMAL(15,9),
    sd          DECIMAL(15,9),
    westgard_rule TEXT,    -- '1_3s' / '2_2s' / 'R_4s' / '4_1s' / '10x'
    passed      BOOLEAN
  );
  SELECT create_hypertable('qc_measurements', 'time');
  ```

### Week 2(第 3 周):认证 + RBAC + OpenAPI

#### Day 6-7:JWT + MFA + RBAC

- [ ] **Task 1.7**: 创建 `apps/backend/src/common/auth/`
  - `auth.module.ts` - Passport JWT + Refresh Token + TOTP
  - `jwt.strategy.ts` - JWT 解析
  - `local.strategy.ts` - 用户名密码
  - `totp.service.ts` - TOTP MFA(speakeasy)
  - `rbac.guard.ts` - `@RequireRole('ADMIN')` 守卫
  - `decorators/require-role.decorator.ts`
  - `decorators/current-user.decorator.ts`
  - `dto/login.dto.ts`、`dto/refresh.dto.ts`、`dto/totp.dto.ts`

- [ ] **Task 1.8**: 创建登录/刷新/MFA API
  ```
  POST /auth/login         - 用户名密码,返回 access + refresh
  POST /auth/refresh       - 刷新 access token
  POST /auth/mfa/verify    - 验证 TOTP
  POST /auth/mfa/enable    - 启用 MFA(返回二维码 + 备份码)
  POST /auth/logout        - 撤销 refresh token
  GET  /auth/me            - 当前用户信息
  ```

- [ ] **Task 1.9**: 创建审计上下文中间件 `apps/backend/src/common/audit/audit-context.middleware.ts`
  ```typescript
  // 从 JWT 解析 user_id + username,设置 PG session variable
  // SET LOCAL app.current_user_id = '...'
  // SET LOCAL app.current_username = '...'
  ```

- [ ] **Task 1.10**: 创建用户管理 API
  ```
  GET    /users            - 列表(分页 + 过滤)
  POST   /users            - 创建(仅 ADMIN)
  GET    /users/:id        - 详情
  PATCH  /users/:id        - 更新
  DELETE /users/:id        - 软删除
  POST   /users/:id/roles  - 分配角色
  POST   /users/:id/reset-mfa - 重置 MFA(仅 ADMIN)
  ```

- [ ] **Task 1.11**: 创建部门管理 API(CRUD)
- [ ] **Task 1.12**: 创建审计日志 API
  ```
  GET /audit-logs          - 列表(过滤: user / table / date)
  GET /audit-logs/:id      - 详情
  GET /audit-logs/verify   - 断链自检(返回 200 = 通过,4xx = 失败)
  ```

#### Day 8-9:OpenAPI + Swagger

- [ ] **Task 1.13**: 安装 nestia + swagger
  ```bash
  pnpm add @nestia/core @nestia/swagger
  ```

- [ ] **Task 1.14**: 配置 `nestia.config.ts`
  ```typescript
  import { NestiaSwaggerComposer } from '@nestia/sdk/lib/swagger';
  import { OpenApi } from '@samchon/openapi';
  // 自动生成 OpenAPI 3.0 + Swagger UI
  ```

- [ ] **Task 1.15**: 给所有 Controller 加 `@TypedRoute()` + `@TypedBody()` + `@TypedParam()` 装饰器(强类型)
- [ ] **Task 1.16**: 创建 `GET /api/docs` Swagger UI
- [ ] **Task 1.17**: 创建 `GET /api/openapi.json` OpenAPI 3.0 JSON
- [ ] **Task 1.18**: CI 中加 OpenAPI 同步检查(防止文档漂移)

#### Day 10:测试 + 验证

- [ ] **Task 1.19**: 单元测试(Jest)
  - `auth.service.spec.ts` - 登录/刷新/MFA
  - `audit.service.spec.ts` - 触发器测试
  - `users.service.spec.ts` - CRUD
  - 覆盖率 ≥ 70%

- [ ] **Task 1.20**: 集成测试(Supertest)
  - 登录 → 审计 → 追溯 闭环测试
  - 权限拒绝测试(无 ADMIN 角色访问失败)

- [ ] **Task 1.21**: E2E 测试(Playwright)
  - 登录页面 → 输入凭证 → 进入 Dashboard
  - MFA 启用流程

## 2. 交付物清单

| 类别 | 文件 |
|---|---|
| **Prisma** | `apps/backend/prisma/schema.prisma`、`apps/backend/prisma/migrations/*`、`apps/backend/prisma/seed.ts` |
| **触发器** | `apps/backend/prisma/triggers/audit_chain.sql` |
| **时序** | `apps/backend/prisma/triggers/timescaledb.sql` |
| **认证** | `apps/backend/src/common/auth/`(8 文件) |
| **审计** | `apps/backend/src/common/audit/`(3 文件) |
| **RBAC** | `apps/backend/src/common/guards/rbac.guard.ts` 等 |
| **用户/部门** | `apps/backend/src/modules/identity/` |
| **审计日志 API** | `apps/backend/src/modules/audit/` |
| **OpenAPI** | `apps/backend/nestia.config.ts`、`apps/backend/src/main.ts`(Swagger UI) |
| **脚本** | `scripts/audit-verify.ts` |
| **测试** | `apps/backend/test/unit/`、`apps/backend/test/integration/`、`apps/backend/test/e2e/` |

## 3. 验证标准

### 功能验证

- [ ] **V-1.1**: `pnpm prisma migrate deploy` 可重放所有迁移
- [ ] **V-1.2**: `pnpm prisma db seed` 成功创建种子数据
- [ ] **V-1.3**: `POST /auth/login` 返回 access + refresh token
- [ ] **V-1.4**: `POST /auth/mfa/enable` 返回 otpauth URL + 备份码
- [ ] **V-1.5**: `POST /users` 创建用户 → 数据库触发器自动写入 audit_logs,SHA256 链完整
- [ ] **V-1.6**: `GET /audit-logs/verify` 返回 200(断链自检通过)
- [ ] **V-1.7**: `GET /api/docs` Swagger UI 可见,所有端点列示
- [ ] **V-1.8**: `GET /api/openapi.json` 可下载 OpenAPI 3.0 JSON

### 合规验证

- [ ] **V-1.9**: 任意用户 CRUD 操作,audit_logs 表自动 +1 条,SHA256 链不断
- [ ] **V-1.10**: 直接 `UPDATE audit_logs SET ...` 数据库报 `audit_logs is append-only`
- [ ] **V-1.11**: 跨表数据一致性(用户被禁用 → user_sessions 自动 revoke)
- [ ] **V-1.12**: TimescaleDB hypertable `qc_measurements` 创建成功

### 测试验证

- [ ] **V-1.13**: 单元测试覆盖率 ≥ 70%
- [ ] **V-1.14**: 集成测试 `auth.e2e.spec.ts` 通过
- [ ] **V-1.15**: E2E 测试 `login.spec.ts` 通过

### CI 验证

- [ ] **V-1.16**: GitHub Actions CI 全绿
- [ ] **V-1.17**: OpenAPI diff 检查(若有变更则 fail)

## 4. 防御性兜底

| 坑点 | 影响 | 预防 |
|---|---|---|
| SHA256 函数不可变(IMMUTABLE 限制) | 触发器报错 | 用 `STABLE` 而非 `IMMUTABLE`,因依赖 current_setting |
| Prisma 触发器与事务冲突 | 审计丢失 | Prisma `$transaction` 包住所有写操作 |
| 时区不一致 | 审计时间乱 | 全库 `SET timezone = 'Asia/Shanghai'` |
| JWT 密钥泄露 | 全系统入侵 | 密钥从 Vault 注入,定期轮换 |
| TOTP 备份码泄露 | MFA 失效 | 备份码加密 + 一次性使用 |
| Refresh token 盗用 | 长期入侵 | Refresh token hash + 短期(7天)+ IP 绑定 |
| RBAC 装饰器失效 | 越权 | 全局 Guard,白名单仅 `/auth/*` / `/api/docs` |
| Prisma Decimal 精度丢失 | 黄金数据不准 | `@db.Decimal(10,6)` 强约束 |
| TimescaleDB 镜像不支持 | 部署失败 | `timescale/timescaledb:latest-pg16` 镜像 |
| 审计日志膨胀 | 性能下降 | TimescaleDB hypertable + 冷热分层 |

## 5. 下阶段交付

Phase 1 完成后,进入 [Phase 2:垂直切片 MVP](./PHASE-2-mvp-slice.md)(最关键的 3 周)
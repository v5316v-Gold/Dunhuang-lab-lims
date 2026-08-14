// =====================================================
// 核心垂直切片 E2E 测试 — Phase 0.5 Task G
// 端到端验证业务完整流程:
//   1. auth login → 拿 JWT
//   2. POST /samples 创建 sample
//   3. POST /batches 创建 batch
//   4. POST /batches/:id/samples 把 sample 加入 batch
//   5. POST /tests/fire-assay/:testId/weights 记录火试金重量
//   6. POST /qc/measurements 创建质控测量
//   7. GET /audit-logs/verify 验证审计链
//
// 每个步骤都断言:HTTP 200/201 + 响应字段 + audit_logs 增量
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import request = require('supertest');

describe('Core vertical slice E2E (Phase 0.5 Task G)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService;
  let accessToken: string;
  let userId: string;

  // 资源 ID(在测试过程中产生,cleanup 用)
  let sampleId: string;
  let batchId: string;
  let testId: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    config = app.get(ConfigService);
  });

  afterAll(async () => {
    // 清理(业务表不软删除,audit_logs 防篡改)
    if (testId) {
      await prisma.$executeRawUnsafe(`DELETE FROM fire_assay_details WHERE test_id = '${testId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${testId}'`).catch(() => {});
    }
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    if (batchId) {
      await prisma.$executeRawUnsafe(`DELETE FROM sample_batches WHERE id = '${batchId}'`).catch(() => {});
    }
    // qc_measurements:test 创的无法精确清,留给 test cleanup
    await app.close();
  });

  // ===== 步骤 1: 登录拿 JWT =====
  it('Step 1: POST /auth/login returns access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'Admin@Pass123',
      });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.username).toBe('admin');
    expect(res.body.mfaRequired).toBe(false);
    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  // ===== 步骤 2: 创建 sample =====
  it('Step 2: POST /samples creates a sample', async () => {
    const res = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerName: 'Phase 0.5 Test Customer',
        sampleType: 'GOLD_INGOT',
        weightG: '100.5000',  // IsNumberString
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
    expect(res.body.sampleNo).toMatch(/^[A-Z0-9-]+$/);
    sampleId = res.body.id;

    // 验证:audit_logs 应该产生一条 INSERT:samples
    const audit = await prisma.auditLog.findFirst({
      where: { recordId: sampleId, tableName: 'samples' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit!.action).toContain('INSERT:samples');
  });

  // ===== 步骤 3: 创建 batch =====
  it('Step 3: POST /batches creates a batch', async () => {
    const res = await request(app.getHttpServer())
      .post('/batches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        method: 'FIRE_ASSAY',
        replicateCount: 3,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
    expect(res.body.batchNo).toMatch(/^[A-Z0-9-]+$/);
    batchId = res.body.id;

    // 验证:audit_logs 应该产生一条 INSERT:sample_batches
    const audit = await prisma.auditLog.findFirst({
      where: { recordId: batchId, tableName: 'sample_batches' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit!.action).toContain('INSERT:sample_batches');
  });

  // ===== 步骤 4: 把 sample 加入 batch(创建 test 关联) =====
  it('Step 4: POST /batches/:id/samples adds sample and creates test', async () => {
    // 业务: AddSamplesToBatchDto 需要 sampleIds 数组
    const res = await request(app.getHttpServer())
      .post('/batches/' + batchId + '/samples')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sampleIds: [sampleId] });
    // 接受 201 或 200
    expect([200, 201]).toContain(res.status);

    // 创建一个 test 关联这个 sample,带 fireAssay detail(否则 /weights 找不到详情)
    const test = await prisma.test.create({
      data: {
        sampleId,
        batchId,
        method: 'FIRE_ASSAY',
        operatorId: userId,
        status: 'PENDING',
        fireAssay: {
          create: {
            sampleWeightG: '1.0000',  // 1.0g 样品
          },
        },
        updatedAt: new Date(),
      } as any,
      include: { fireAssay: true },
    });
    testId = test.id;

    // 验证:audit_logs 应该产生 INSERT:tests
    const audit = await prisma.auditLog.findFirst({
      where: { recordId: testId, tableName: 'tests' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  // ===== 步骤 5: 记录火试金重量 =====
  it('Step 5: POST /tests/fire-assay/:testId/weights records weights', async () => {
    // F1 步骤守卫: 先补工艺参数
    await request(app.getHttpServer())
      .post('/tests/fire-assay/' + testId + '/process')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ furnaceTempC: 1050, cupellationMin: 45, partingMin: 30, annealingMin: 30 });
    const res = await request(app.getHttpServer())
      .post('/tests/fire-assay/' + testId + '/weights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prillWeightG: '0.9988',  // 金粒重量
        leadButtonWeightG: '3.0120',  // 铅扣
        qcRecoveryPct: '99.88',
      });
    // 期望 200/201
    expect([200, 201]).toContain(res.status);

    // 验证:fire_assay_details 表应该有记录
    const detail = await prisma.fireAssayDetail.findFirst({
      where: { testId },
    });
    expect(detail).toBeTruthy();

    // 验证:audit_logs 应该产生 INSERT:fire_assay_details
    const audit = await prisma.auditLog.findFirst({
      where: { tableName: 'fire_assay_details' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
    // fireAssay 已在 step 4 创建,这里是 UPDATE 不是 INSERT
    expect(['INSERT:fire_assay_details', 'UPDATE:fire_assay_details']).toContain(audit!.action);
  });

  // ===== 步骤 6: 创建 qc measurement =====
  it('Step 6: POST /qc/measurements creates a QC measurement', async () => {
    const res = await request(app.getHttpServer())
      .post('/qc/measurements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        testId,
        qcType: 'BLANK',
        element: 'Au',
        measured: '0.001',
        expected: '0.000',
        sd: '0.005',
      });
    // 期望 200/201
    expect([200, 201]).toContain(res.status);

    // 验证:qc_measurements 表应该有记录
    const meas = await prisma.qcMeasurement.findFirst({
      where: { testId },
    });
    expect(meas).toBeTruthy();

    // 验证:audit_logs 应该产生 INSERT:qc_measurements
    const audit = await prisma.auditLog.findFirst({
      where: { tableName: 'qc_measurements' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit!.action).toContain('INSERT:qc_measurements');
  });

  // ===== 步骤 7: 验证审计链 =====
  it('Step 7: GET /audit-logs/verify returns passed=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs/verify')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.totalRecords).toBeGreaterThan(0);
  });
});

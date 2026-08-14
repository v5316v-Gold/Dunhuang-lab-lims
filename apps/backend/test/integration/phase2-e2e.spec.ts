// =====================================================
// Phase 2 完整业务闭环 E2E — 样品→批次→火试金→QC→报告
// 这是 Phase 2 的核心验收(CODE-EXECUTION-PLAN Gate: E2E 可演示全流程)
//
// 流程:
//   1. 创建样品(RECEIVED)
//   2. 创建批次 + 样品状态推进 BATCHED
//   3. 创建火试金检测 + 记录重量(纯度计算 + QC 回收率)
//   4. 创建 QC 测量 + 样品状态推进 TESTED
//   5. 创建报告(三级审核 → 签发)+ 样品状态 ARCHIVED
//   6. 审计链 verify 仍 PASS
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('Phase 2 full business loop E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  let sampleId: string;
  let batchId: string;
  let testId: string;
  let reportId: string;

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
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    if (reportId) {
      await prisma.$executeRawUnsafe(`DELETE FROM report_stages WHERE report_id = '${reportId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM report_signatures WHERE report_id = '${reportId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = '${reportId}'`).catch(() => {});
    }
    if (testId) {
      await prisma.$executeRawUnsafe(`DELETE FROM fire_assay_details WHERE test_id = '${testId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM qc_measurements WHERE test_id = '${testId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${testId}'`).catch(() => {});
    }
    if (batchId) {
      await prisma.$executeRawUnsafe(`DELETE FROM sample_batches WHERE id = '${batchId}'`).catch(() => {});
    }
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    await app.close();
  });

  it('FULL LOOP: sample → batch → fire-assay → QC → report → archived', async () => {
    // ===== 1. 样品 =====
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'Phase2 E2E 客户', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    expect([200, 201]).toContain(s.status);
    sampleId = s.body.id;
    expect(s.body.sampleNo).toMatch(/^\d{6}-\d{4}$/); // 编号格式
    expect(s.body.status).toBe('RECEIVED');

    // ===== 2. 批次 + 加入样品 =====
    const b = await request(app.getHttpServer())
      .post('/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ method: 'FIRE_ASSAY', replicateCount: 3 });
    expect([200, 201]).toContain(b.status);
    batchId = b.body.id;

    const add = await request(app.getHttpServer())
      .post(`/batches/${batchId}/samples`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleIds: [sampleId] });
    expect([200, 201]).toContain(add.status);

    // 样品加入批次时 batch.service 已自动置 BATCHED(验证状态)
    const afterBatch = await prisma.sample.findUnique({ where: { id: sampleId } });
    expect(afterBatch!.status).toBe('BATCHED');

    // ===== 3. 火试金检测 =====
    const test = await prisma.test.create({
      data: {
        sampleId,
        batchId,
        method: 'FIRE_ASSAY',
        operatorId: '00000000-0000-0000-0000-000000000001',
        status: 'IN_PROGRESS',
        fireAssay: { create: { sampleWeightG: '1.0000' } },
      } as any,
    });
    testId = test.id;

    // F1 步骤守卫: 先记录工艺参数
    await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ furnaceTempC: 1050, cupellationMin: 45, partingMin: 30, annealingMin: 30 });
    // 记录重量(纯度计算 + QC 回收率)
    const w = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/weights`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0120', qcRecoveryPct: '100.0' });
    expect([200, 201]).toContain(w.status);
    const testAfter = await prisma.test.findUnique({ where: { id: testId } });
    expect(parseFloat(testAfter!.purityPct!.toString())).toBeCloseTo(99.88, 4);

    // ===== 4. QC 测量 + 样品 TESTED =====
    const qc = await request(app.getHttpServer())
      .post('/qc/measurements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ testId, qcType: 'PARALLEL', element: 'Au', measured: '99.88', expected: '100.0', sd: '0.05' });
    expect([200, 201]).toContain(qc.status);

    // 记录重量时 fire-assay.service 已自动更新样品状态(qcPassed → TESTED)
    const afterWeights = await prisma.sample.findUnique({ where: { id: sampleId } });
    expect(afterWeights!.status).toBe('TESTED');

    // ===== 5. 报告: 创建 → 三级审核 → 签发 =====
    const r = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    expect([200, 201]).toContain(r.status);
    reportId = r.body.id;
    expect(r.body.summary).toContain('纯度结果'); // 内容快照含检测数据

    for (const action of ['SUBMIT', 'REVIEW_PASS', 'APPROVE', 'ISSUE']) {
      const tr = await request(app.getHttpServer())
        .post(`/reports/${reportId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action });
      expect([200, 201]).toContain(tr.status);
    }

    // 报告流程自动驱动样品状态(report.service 同步:
    //   create→REPORT_DRAFT / SUBMIT→REPORT_REVIEW / APPROVE→REPORT_APPROVED / ISSUE→ARCHIVED)

    // ===== 6. 最终状态验证 =====
    const finalSample = await prisma.sample.findUnique({ where: { id: sampleId } });
    expect(finalSample!.status).toBe('ARCHIVED'); // 报告签发后样品自动归档
    const finalReport = await prisma.report.findUnique({ where: { id: reportId } });
    expect(finalReport!.status).toBe('ISSUED');
    expect(finalReport!.issuedAt).not.toBeNull();

    // 审计链完整
    const verify = await request(app.getHttpServer())
      .get('/audit-logs/verify')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(verify.status).toBe(200);
    expect(verify.body.passed).toBe(true);
  });
});

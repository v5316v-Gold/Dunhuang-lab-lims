// =====================================================
// 报告三级审核流程测试 — Phase 2 Task 2.5
// 验证:
//   1. 创建报告(含 summary 快照)
//   2. 三级审核: DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
//   3. 驳回: FINAL_REVIEW 驳回 → 回 DRAFT
//   4. 电子签名记录
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('Report review flow (Phase 2 Task 2.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let sampleId: string;
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
      await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${testId}'`).catch(() => {});
    }
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    await app.close();
  });

  it('full report review flow: create → submit → pass → approve → issue', async () => {
    // 1. 创建样品 + 火试金检测(带结果)
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'Report Test', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    expect([200, 201]).toContain(s.status);
    sampleId = s.body.id;

    // 2. 创建测试 + fireAssay detail + 记录重量(产生纯度)
    const t = await prisma.test.create({
      data: {
        sampleId,
        method: 'FIRE_ASSAY',
        operatorId: '00000000-0000-0000-0000-000000000001',
        status: 'IN_PROGRESS',
        fireAssay: { create: { sampleWeightG: '1.0000' } },
      } as any,
    });
    testId = t.id;
    // F1 步骤守卫: 先记录工艺参数(熔融/灰吹/分金/退火)
    await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ furnaceTempC: 1050, cupellationMin: 45, partingMin: 30, annealingMin: 30, partingAcid: '1:2' });
    const w = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/weights`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0', qcRecoveryPct: '100.0' });
    expect([200, 201]).toContain(w.status);

    // 3. 创建报告(应含 summary 快照)
    const r = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    expect([200, 201]).toContain(r.status);
    reportId = r.body.id;
    expect(r.body.summary).toContain('样品编号');
    expect(r.body.summary).toContain('纯度');

    // 4. 三级审核推进
    // DRAFT → INTERNAL_REVIEW (SUBMIT)
    const st1 = await request(app.getHttpServer())
      .post(`/reports/${reportId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'SUBMIT' });
    expect([200, 201]).toContain(st1.status);

    // INTERNAL_REVIEW → FINAL_REVIEW (REVIEW_PASS)
    const st2 = await request(app.getHttpServer())
      .post(`/reports/${reportId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REVIEW_PASS' });
    expect([200, 201]).toContain(st2.status);

    // FINAL_REVIEW → APPROVED (APPROVE)
    const st3 = await request(app.getHttpServer())
      .post(`/reports/${reportId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });
    expect([200, 201]).toContain(st3.status);

    // APPROVED → ISSUED (ISSUE)
    const st4 = await request(app.getHttpServer())
      .post(`/reports/${reportId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'ISSUE' });
    expect([200, 201]).toContain(st4.status);

    // 5. 电子签名
    const sign = await request(app.getHttpServer())
      .post(`/reports/${reportId}/sign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        signatureData: 'test-signature-001',
        certificateSerial: 'CERT-TEST-001',
      });
    expect([200, 201]).toContain(sign.status);

    // 6. 验证最终状态
    const final = await prisma.report.findUnique({ where: { id: reportId } });
    expect(final!.status).toBe('ISSUED');
    expect(final!.issuedAt).not.toBeNull();
    // Phase 2 填充(F2): 签发自动生成 PDF 并绑定 SHA256
    expect(final!.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    const stages = await prisma.reportStage.count({ where: { reportId } });
    expect(stages).toBeGreaterThanOrEqual(5); // 创建 + 4 次推进
    const signatures = await prisma.reportSignature.count({ where: { reportId } });
    expect(signatures).toBe(1);
  });

  it('reject flow: FINAL_REVIEW reject returns to DRAFT', async () => {
    // 新报告走驳回路径
    const r = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    expect([200, 201]).toContain(r.status);
    const rejId = r.body.id;

    await request(app.getHttpServer())
      .post(`/reports/${rejId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'SUBMIT' });
    await request(app.getHttpServer())
      .post(`/reports/${rejId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REVIEW_PASS' });
    // FINAL_REVIEW 驳回
    const rej = await request(app.getHttpServer())
      .post(`/reports/${rejId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REVIEW_REJECT' });
    expect([200, 201]).toContain(rej.status);

    const after = await prisma.report.findUnique({ where: { id: rejId } });
    expect(after!.status).toBe('DRAFT');

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM report_stages WHERE report_id = '${rejId}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = '${rejId}'`).catch(() => {});
  });
});

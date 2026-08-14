// =====================================================
// ICP 流程集成测试 — Phase 2 Task 2.3
// 验证: 创建 ICP 检测 → 添加元素结果 → 完成 → 纯度落库 + 审计
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('ICP flow (Phase 2 Task 2.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let sampleId: string;
  let icpTestId: string;

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
    if (icpTestId) {
      await prisma.$executeRawUnsafe(`DELETE FROM element_results WHERE test_id = '${icpTestId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${icpTestId}'`).catch(() => {});
    }
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    await app.close();
  });

  it('full ICP flow: create test → add results → complete', async () => {
    // 创建样品
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'ICP Test', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    expect([200, 201]).toContain(s.status);
    sampleId = s.body.id;

    // 创建 ICP 检测
    const t = await request(app.getHttpServer())
      .post('/tests/icp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    expect([200, 201]).toContain(t.status);
    icpTestId = t.body.id;
    expect(t.body.method).toBe('ICP_OES');

    // 添加元素结果(Au 主元素 + Ag 杂质)
    const r = await request(app.getHttpServer())
      .post(`/tests/icp/${icpTestId}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [
          { element: 'Au', concentration: '99.95', unit: 'PERCENTAGE' },
          { element: 'Ag', concentration: '12.5', unit: 'ppm' },
        ],
      });
    expect([200, 201]).toContain(r.status);

    // 完成
    const c = await request(app.getHttpServer())
      .post(`/tests/icp/${icpTestId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(c.status);

    // 验证: test 状态 + 纯度
    const test = await prisma.test.findUnique({
      where: { id: icpTestId },
      include: { elementResults: true },
    });
    expect(test!.status).toBe('COMPLETED');
    expect(parseFloat(test!.purityPct!.toString())).toBeCloseTo(99.95, 2);
    expect(test!.elementResults.length).toBe(2);

    // 验证: element_results 审计链
    const audit = await prisma.auditLog.findFirst({
      where: { tableName: 'element_results' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
  });
});

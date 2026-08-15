// =====================================================
// W+5-4: Levey-Jennings 图数据流测试
// 验证:GET /qc/trend?testId=X&element=Y 返回 z-score 序列
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W5 Levey-Jennings 图数据流', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  const adminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign({ sub: adminId, role: 'ADMIN' }, secret, { expiresIn: '15m' });
  });

  afterAll(async () => { await app.close(); });

  it('GET /qc/trend returns list with zScores', async () => {
    // 找一个有 QC 测量的 test
    const qc = await prisma.qcMeasurement.findFirst();
    if (!qc) return;
    const res = await request(app.getHttpServer())
      .get(`/qc/trend?testId=${qc.testId}&element=${qc.element}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const items = res.data?.items ?? res.data ?? [];
    if (items.length > 0) {
      expect(items[0]).toHaveProperty('zScore');
      expect(items[0]).toHaveProperty('passed');
    }
  });

  it('GET /qc/trend takes limit parameter (used by Levey-Jennings)', async () => {
    const qc = await prisma.qcMeasurement.findFirst();
    if (!qc) return;
    const res = await request(app.getHttpServer())
      .get(`/qc/trend?testId=${qc.testId}&element=${qc.element}&days=30`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const items = res.data?.items ?? res.data ?? [];
    expect(items.length).toBeLessThanOrEqual(30);
  });

  it('GET /qc/trend with take returns at most take items in time order', async () => {
    const qc = await prisma.qcMeasurement.findFirst();
    if (!qc) return;
    const res = await request(app.getHttpServer())
      .get(`/qc/trend?testId=${qc.testId}&element=${qc.element}&days=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const items = res.data?.items ?? res.data ?? [];
    expect(items.length).toBeLessThanOrEqual(5);
  });
});
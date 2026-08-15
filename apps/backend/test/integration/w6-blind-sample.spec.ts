// =====================================================
// W+6-3: 盲样考核端到端测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W6 盲样考核', () => {
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

  it('GET /compliance/blind-sample returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items).toBeDefined();
  });

  it('POST /compliance/blind-sample creates with trueValue', async () => {
    const assigned = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!assigned) return;
    const res = await request(app.getHttpServer())
      .post('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sampleCode: `BL-TEST-${Date.now()}`,
        trueValue: '99.99',
        assignedToId: assigned.id,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.blindNo).toMatch(/^BL-\d{8}-\d{4}$/);
  });

  it('Blind sample assess: deviation < 5% passes', async () => {
    const assigned = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!assigned) return;
    // 创建盲样 + 立刻录入
    const created = await request(app.getHttpServer())
      .post('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sampleCode: `BL-DEV-${Date.now()}`,
        trueValue: '99.99',
        assignedToId: assigned.id,
      });
    const res = await request(app.getHttpServer())
      .post(`/compliance/blind-sample/${created.body.id}/assess`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ measuredValue: '99.95' });  // 偏差 0.04%
    expect([200, 201]).toContain(res.status);
    expect(res.body.passed).toBe(true);
    expect(parseFloat(res.body.deviationPct)).toBeCloseTo(0.04, 2);
  });

  it('Blind sample assess: deviation > 5% fails', async () => {
    const assigned = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!assigned) return;
    const created = await request(app.getHttpServer())
      .post('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sampleCode: `BL-FAIL-${Date.now()}`,
        trueValue: '99.99',
        assignedToId: assigned.id,
      });
    const res = await request(app.getHttpServer())
      .post(`/compliance/blind-sample/${created.body.id}/assess`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ measuredValue: '90.00' });  // 偏差 10%
    expect([200, 201]).toContain(res.status);
    expect(res.body.passed).toBe(false);
  });
});
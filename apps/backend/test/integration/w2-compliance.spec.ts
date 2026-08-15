// =====================================================
// W+2 CMA 审批管理集成测试(内审/管评/监督/盲样/PT)
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W2 CMA compliance management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  const adminId = '00000000-0000-0000-0000-000000000001';
  // 真实存在的用户(来自 seed / 数据库)
  let user2Id = 'c843c495-bd9b-4952-ae52-a54674fb5273';  // zhang.san

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    // 动态取一个真实用户(避免硬编码失效)
    const u = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (u) user2Id = u.id;
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign({ sub: adminId, username: 'admin', role: 'ADMIN' }, secret, { expiresIn: '15m' });
  });

  afterAll(async () => { await app.close(); });

  it('POST /compliance/internal-audit creates IA-YYYYMMDD-NNNN', async () => {
    const res = await request(app.getHttpServer())
      .post('/compliance/internal-audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '2026 年度第一次内审', scope: '全部条款', auditDate: '2026-09-01' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.auditNo).toMatch(/^IA-\d{8}-\d{4}$/);
    expect(res.body.status).toBe('PLANNED');
  });

  it('GET /compliance/internal-audit lists audits', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/internal-audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /compliance/internal-audit/:id/close closes with findings', async () => {
    const list = await request(app.getHttpServer())
      .get('/compliance/internal-audit').set('Authorization', `Bearer ${adminToken}`);
    const id = list.body.items[0].id;
    const res = await request(app.getHttpServer())
      .post(`/compliance/internal-audit/${id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ findings: '未发现不符合', ncCount: 0 });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('CLOSED');
  });

  it('POST /compliance/management-review creates MR + close', async () => {
    const res = await request(app.getHttpServer())
      .post('/compliance/management-review')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '2026 年 9 月管评', periodFrom: '2026-08-01', periodTo: '2026-08-31' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.reviewNo).toMatch(/^MR-\d{8}-\d{4}$/);
    const close = await request(app.getHttpServer())
      .post(`/compliance/management-review/${res.body.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outputs: '决议通过', decisions: '持续改进' });
    expect(close.body.status).toBe('CLOSED');
  });

  it('POST /compliance/supervision creates SUP record', async () => {
    const res = await request(app.getHttpServer())
      .post('/compliance/supervision')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supervisorId: adminId, superviseeId: user2Id, content: '日常监督 ICP 操作' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.supNo).toMatch(/^SUP-\d{8}-\d{4}$/);
    expect(res.body.result).toBe('PASS');
  });

  it('POST /compliance/blind-sample + assess with deviation calc', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleCode: 'BL-AU-001', assignedToId: user2Id, trueValue: '99.99' });
    expect([200, 201]).toContain(created.status);
    expect(created.body.blindNo).toMatch(/^BL-\d{8}-\d{4}$/);

    // 测得 99.95(偏差 0.04% < 5% → pass)
    const assessed = await request(app.getHttpServer())
      .post(`/compliance/blind-sample/${created.body.id}/assess`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ measuredValue: '99.95' });
    expect([200, 201]).toContain(assessed.status);
    expect(assessed.body.passed).toBe(true);
    expect(parseFloat(assessed.body.deviationPct)).toBeCloseTo(0.04, 2);
  });

  it('blind sample deviation > 5% fails', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/blind-sample')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleCode: 'BL-AU-002', assignedToId: user2Id, trueValue: '99.99' });
    const assessed = await request(app.getHttpServer())
      .post(`/compliance/blind-sample/${created.body.id}/assess`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ measuredValue: '93.00' });  // 偏差 7% > 5% → fail
    expect(assessed.body.passed).toBe(false);
  });

  it('POST /compliance/proficiency-test + result with zScore judgment', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizer: 'CNAS PT 计划', item: 'Au 纯度', method: 'FIRE_ASSAY', startDate: '2026-09-15' });
    expect([200, 201]).toContain(created.status);
    expect(created.body.ptNo).toMatch(/^PT-\d{8}-\d{4}$/);

    // z=1.5 → SATISFACTORY
    const r1 = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '1.5' });
    expect(r1.body.result).toBe('SATISFACTORY');

    // z=2.5 → QUESTIONABLE
    const r2 = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '2.5' });
    expect(r2.body.result).toBe('QUESTIONABLE');

    // z=3.5 → UNSATISFACTORY
    const r3 = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '3.5' });
    expect(r3.body.result).toBe('UNSATISFACTORY');
  });

  it('GET /compliance/summary returns CMA overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('internalAudits');
    expect(res.body).toHaveProperty('managementReviews');
    expect(res.body).toHaveProperty('supervisions');
    expect(res.body).toHaveProperty('blindSamples');
    expect(res.body).toHaveProperty('proficiencyTests');
    expect(res.body).toHaveProperty('checkedAt');
  });
});
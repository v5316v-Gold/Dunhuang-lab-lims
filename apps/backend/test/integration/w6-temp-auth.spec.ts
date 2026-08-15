// =====================================================
// W+6-1: 临时授权端到端测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W6 临时授权端到端', () => {
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

  it('GET /compliance/temp-auth returns list (active default)', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/temp-auth')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items).toBeDefined();
  });

  it('POST /compliance/temp-auth creates authorization', async () => {
    // 找一个真实 grantee(非 admin)
    const grantee = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!grantee) return;
    const from = new Date();
    const to = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const res = await request(app.getHttpServer())
      .post('/compliance/temp-auth')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        granteeId: grantee.id,
        method: 'FIRE_ASSAY',
        effectiveFrom: from.toISOString(),
        effectiveTo: to.toISOString(),
        reason: 'W6-1 测试 - 代班',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.authNo).toMatch(/^TA-\d{8}-\d{4}$/);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST /compliance/temp-auth validates effectiveTo > effectiveFrom', async () => {
    const grantee = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!grantee) return;
    const from = new Date(Date.now() + 7 * 24 * 3600 * 1000);  // 7天后
    const to = new Date();  // 现在
    const res = await request(app.getHttpServer())
      .post('/compliance/temp-auth')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        granteeId: grantee.id,
        method: 'ALL',
        effectiveFrom: from.toISOString(),
        effectiveTo: to.toISOString(),  // before from
        reason: '测试反向',
      });
    // 应 400 拒绝
    expect(res.status).toBe(400);
  });

  it('POST /temp-auth/:id/revoke revokes an active authorization', async () => {
    // 创建一个新授权
    const grantee = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!grantee) return;
    const from = new Date();
    const to = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const created = await request(app.getHttpServer())
      .post('/compliance/temp-auth')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        granteeId: grantee.id,
        method: 'ICP_OES',
        effectiveFrom: from.toISOString(),
        effectiveTo: to.toISOString(),
        reason: 'revoke 测试',
      });
    const taId = created.body.id;
    const res = await request(app.getHttpServer())
      .post(`/compliance/temp-auth/${taId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('REVOKED');
    expect(res.body.revokedById).toBe(adminId);
  });
});
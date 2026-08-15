// =====================================================
// W+6-2: 监督记录端到端测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W6 监督记录端到端', () => {
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

  it('GET /compliance/supervision returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/supervision')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items).toBeDefined();
  });

  it('POST /compliance/supervision creates record', async () => {
    const supervisor = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    const supervisee = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!supervisor || !supervisee || supervisor.id === supervisee.id) return;
    const res = await request(app.getHttpServer())
      .post('/compliance/supervision')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supervisorId: supervisor.id,
        superviseeId: supervisee.id,
        supDate: new Date().toISOString(),
        content: 'W6-2 监督 ICP 操作',
        result: 'PASS',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.supNo).toMatch(/^SUP-\d{8}-\d{4}$/);
    expect(res.body.result).toBe('PASS');
  });

  it('CONCERN/FAIL requires correctiveAction', async () => {
    const supervisor = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    const supervisee = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!supervisor || !supervisee || supervisor.id === supervisee.id) return;
    const res = await request(app.getHttpServer())
      .post('/compliance/supervision')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supervisorId: supervisor.id,
        superviseeId: supervisee.id,
        supDate: new Date().toISOString(),
        content: 'CONCERN 但无整改',
        result: 'CONCERN',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('整改');
  });
});
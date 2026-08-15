// =====================================================
// W+7-1: PT 能力验证端到端测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W7 PT 能力验证', () => {
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

  it('GET /compliance/proficiency-test returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items).toBeDefined();
  });

  it('POST /compliance/proficiency-test creates', async () => {
    const res = await request(app.getHttpServer())
      .post('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizer: 'CNAS PT 计划-W7-1',
        item: 'Au 纯度',
        method: 'FIRE_ASSAY GB/T 9288',
        startDate: new Date().toISOString(),
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.ptNo).toMatch(/^PT-\d{8}-\d{4}$/);
  });

  it('PT result zScore <= 2 → SATISFACTORY', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizer: 'W7-1 z=0.8',
        item: 'Au 纯度',
        method: 'FIRE_ASSAY',
        startDate: new Date().toISOString(),
      });
    const res = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '0.8' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.result).toBe('SATISFACTORY');
  });

  it('PT result zScore in (2, 3) → QUESTIONABLE', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizer: 'W7-1 z=2.5',
        item: 'Au 纯度',
        method: 'ICP_OES',
        startDate: new Date().toISOString(),
      });
    const res = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '2.5' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.result).toBe('QUESTIONABLE');
  });

  it('PT result zScore >= 3 → UNSATISFACTORY', async () => {
    const created = await request(app.getHttpServer())
      .post('/compliance/proficiency-test')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizer: 'W7-1 z=3.5',
        item: 'Au 纯度',
        method: 'ICP_OES',
        startDate: new Date().toISOString(),
      });
    const res = await request(app.getHttpServer())
      .post(`/compliance/proficiency-test/${created.body.id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ zScore: '3.5' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.result).toBe('UNSATISFACTORY');
  });
});
// =====================================================
// W4-C 原始记录单删除专项 spec: DRAFT 可删 / LOCKED 红线
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W4-C raw record sheet delete (DRAFT only, LOCKED/SIGNED red line)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret, { expiresIn: '15m' },
    );
  });

  afterAll(async () => { await app.close(); });

  it('DELETE /raw-records/:id removes DRAFT sheet', async () => {
    // 创建一个 DRAFT 原始记录单
    const test = await prisma.test.findFirst({ where: { status: { not: 'COMPLETED' } } });
    if (!test) return;
    const sample = await prisma.sample.findUnique({ where: { id: test.sampleId } });
    if (!sample) return;
    const sheet = await prisma.rawRecordSheet.create({
      data: {
        sheetNo: `RS-W4C-DEL-${Date.now()}`,
        testId: test.id,
        sampleId: sample.id,
        method: test.method,
        status: 'DRAFT',
        dataJson: {},
      },
    });

    const r = await request(app.getHttpServer())
      .delete(`/raw-records/${sheet.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(r.status);
    const after = await prisma.rawRecordSheet.findUnique({ where: { id: sheet.id } });
    expect(after).toBeNull();
  });

  it('DELETE /raw-records/:id rejects LOCKED sheet (red line)', async () => {
    const sheet = await prisma.rawRecordSheet.findFirst({ where: { status: 'LOCKED' } });
    if (!sheet) return;
    const r = await request(app.getHttpServer())
      .delete(`/raw-records/${sheet.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(400);
    const after = await prisma.rawRecordSheet.findUnique({ where: { id: sheet.id } });
    expect(after).not.toBeNull();
  });

  it('DELETE /raw-records/:id rejects SIGNED sheet (red line)', async () => {
    const sheet = await prisma.rawRecordSheet.findFirst({ where: { status: 'SIGNED' } });
    if (!sheet) return;
    const r = await request(app.getHttpServer())
      .delete(`/raw-records/${sheet.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(400);
  });
});

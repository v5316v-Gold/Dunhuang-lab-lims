// =====================================================
// W4-C QC 测量作废专项 spec: voidedAt 标记 + ALCOA+ 留痕
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W4-C QC measurement void (ALCOA+: data kept, voidedAt marked)', () => {
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

  it('POST /qc/measurements/:id/void rejects empty reason', async () => {
    const m = await prisma.qcMeasurement.findFirst({ where: { voidedAt: null } });
    if (!m) return;
    const r = await request(app.getHttpServer())
      .post(`/qc/measurements/${m.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(r.status).toBe(400);
  });

  it('POST /qc/measurements/:id/void marks voidedAt, keeps data', async () => {
    // 找一个未作废的 QC 测量,创建或复用
    let m = await prisma.qcMeasurement.findFirst({ where: { voidedAt: null } });
    if (!m) {
      m = await prisma.qcMeasurement.create({
        data: {
          qcType: 'BLANK',
          element: 'Au',
          measured: '0.001',
          passed: true,
        },
      });
    }
    const r = await request(app.getHttpServer())
      .post(`/qc/measurements/${m.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'W4-C spec void test' });
    expect(r.status).toBeLessThan(300);
    const after = await prisma.qcMeasurement.findUnique({ where: { id: m.id } });
    expect(after?.voidedAt).toBeTruthy();
    expect(after?.voidReason).toBe('W4-C spec void test');
    // 数据保留(ALCOA+):Prisma Decimal 序列化为字符串,直接 toString 比较
    expect(String(after?.measured)).toBe(String(m.measured));
  });

  it('POST /qc/measurements/:id/void rejects already-voided measurement', async () => {
    const m = await prisma.qcMeasurement.findFirst({ where: { voidedAt: { not: null } } });
    if (!m) return;
    const r = await request(app.getHttpServer())
      .post(`/qc/measurements/${m.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'duplicate' });
    expect(r.status).toBe(400);
  });
});

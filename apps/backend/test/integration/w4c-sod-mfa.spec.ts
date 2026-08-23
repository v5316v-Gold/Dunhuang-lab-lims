// =====================================================
// W4-C SoD/留样期 PATCH 需 MFA 强制专项 spec
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W4-C SoD/Retention PATCH requires MFA (S1 compliance fix)', () => {
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

  it('PATCH /sod-policies/:id without MFA token → 403', async () => {
    const policy = await prisma.sodPolicy.findFirst();
    if (!policy) return;
    const r = await request(app.getHttpServer())
      .patch(`/sod-policies/${policy.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'RELAXED' });
    // @MfaProtected(MFA_SCENES.SOD_POLICY_CHANGE) 应返回 403
    expect(r.status).toBe(403);
  });

  it('PATCH /sod-policies/:id with bogus MFA token → 401', async () => {
    const policy = await prisma.sodPolicy.findFirst();
    if (!policy) return;
    const r = await request(app.getHttpServer())
      .patch(`/sod-policies/${policy.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-mfa-token', 'totally.bogus.token')
      .send({ mode: 'RELAXED' });
    expect([401, 403]).toContain(r.status);
  });

  it('PATCH /retention-policies/:entityType without MFA token → 403', async () => {
    const r = await request(app.getHttpServer())
      .patch(`/retention-policies/sample`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ retentionMonths: 12, archiveAfterMonths: 6 });
    expect(r.status).toBe(403);
  });

  it('POST /pt 删除 (未录结果) without MFA token → 403', async () => {
    // 先创建一个未录结果的 PT(createdBy 必填)
    const pt = await prisma.proficiencyTest.create({
      data: {
        ptNo: `PT-W4C-MFA-${Date.now()}`,
        organizer: 'spec',
        item: 'Au',
        method: 'FIRE_ASSAY',
        startDate: new Date(),
        createdById: '00000000-0000-0000-0000-000000000001',
      },
    });
    const r = await request(app.getHttpServer())
      .delete(`/proficiency-tests/${pt.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(403);
    // cleanup
    await prisma.proficiencyTest.delete({ where: { id: pt.id } });
  });
});

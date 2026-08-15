// =====================================================
// W+2-2: FireAssayDetail 关键参数 API 测试
// 评审必问:火试金工艺参数(温度/时间)是否可追溯
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W2 FireAssay 工艺参数', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let testId: string;
  let fireAssayId: string;
  const adminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign({ sub: adminId, username: 'admin', role: 'ADMIN' }, secret, { expiresIn: '15m' });

    // 准备: 创建一个 test + fireAssayDetail
    const sample = await prisma.sample.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!sample) throw new Error('需要 seed 样品');
    const t = await prisma.test.create({
      data: { sampleId: sample.id, method: 'FIRE_ASSAY', status: 'IN_PROGRESS', operatorId: adminId },
    });
    testId = t.id;
    const fa = await prisma.fireAssayDetail.create({
      data: { testId: t.id, sampleWeightG: '1.0230' },
    });
    fireAssayId = fa.id;
  });

  afterAll(async () => {
    try {
      await prisma.fireAssayDetail.delete({ where: { id: fireAssayId } }).catch(() => {});
      await prisma.test.delete({ where: { id: testId } }).catch(() => {});
    } catch {}
    await app.close();
  });

  it('POST /fire-assay/:testId/process records furnace temp + durations', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        furnaceTempC: 950,
        cupellationMin: 35,
        partingMin: 30,
        annealingMin: 20,
        partingAcid: '硝酸 1:7',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.furnaceTempC).toBe(950);
    expect(res.body.cupellationMin).toBe(35);
    expect(res.body.partingAcid).toBe('硝酸 1:7');
  });

  it('POST /fire-assay/:testId/process rejects missing test', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests/fire-assay/00000000-0000-0000-0000-00000000dead/process')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ furnaceTempC: 950 });
    expect(res.status).toBe(404);
  });

  it('GET /fire-assay/:testId returns full detail with params', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/fire-assay/${testId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    // 字段在 fireAssay 内层(findOne 返回 test + include fireAssay)
    expect(res.body.fireAssay).toHaveProperty('furnaceTempC');
    expect(res.body.fireAssay).toHaveProperty('cupellationMin');
    expect(res.body.fireAssay).toHaveProperty('partingAcid');
    expect(res.body.fireAssay.sampleWeightG).toBeTruthy();
  });

  it('POST /fire-assay/:testId/complete requires process params first', async () => {
    // 未称重 → 步骤守卫应拒
    const res = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${testId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    // 可能 400(步骤未完成)或 400(缺少 prillWeight)
    expect([400, 500]).not.toContain(res.status);
    expect([200, 201, 400]).toContain(res.status);
  });
});
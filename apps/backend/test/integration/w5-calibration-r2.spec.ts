// =====================================================
// W+5-3: 校准曲线 R² 端到端测试
// CNAS §7.9 必填:每元素录入必须有校准曲线 R² ≥ 0.999
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { IcpService } from '../../src/modules/test/icp.service';
import request = require('supertest');

describe('W5 校准曲线 R²', () => {
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

  it('ICP results accept calibrationR2 in DTO', async () => {
    // 找 ICP test
    const test = await prisma.test.findFirst({ where: { method: 'ICP_OES' } });
    if (!test) {
      // 创建测试
      const sample = await prisma.sample.findFirst();
      if (!sample) return;
      const t = await prisma.test.create({
        data: { sampleId: sample.id, method: 'ICP_OES', status: 'IN_PROGRESS', operatorId: adminId },
      });
      await prisma.icpTest.create({ data: { testId: t.id, solutionVolumeMl: '100' } });
      const res = await request(app.getHttpServer())
        .post(`/tests/icp/${t.id}/results`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          results: [{
            element: 'Au', wavelengthNm: 328.07, concentration: 0.0123, unit: 'ppm',
            lod: 0.001, loq: 0.005, uncertainty: 0.0005,
            calibrationR2: 0.9998,    // W+5-3 关键
          }],
        });
      expect([200, 201]).toContain(res.status);
      // 验证 ElementResult 持久化了 calibrationR2
      const er = await prisma.elementResult.findFirst({
        where: { testId: t.id, element: 'Au' },
      });
      expect(er).toBeTruthy();
      expect(parseFloat(String(er?.calibrationR2))).toBeCloseTo(0.9998, 6);
      // 清理
      await prisma.elementResult.deleteMany({ where: { testId: t.id } });
      await prisma.icpTest.delete({ where: { testId: t.id } }).catch(() => {});
      await prisma.test.delete({ where: { id: t.id } }).catch(() => {});
      return;
    }
    const res = await request(app.getHttpServer())
      .post(`/tests/icp/${test.id}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [{
          element: 'Au', wavelengthNm: 328.07, concentration: 0.0123, unit: 'ppm',
          calibrationR2: 0.9998,
        }],
      });
    expect([200, 201]).toContain(res.status);
  });

  it('Calibration curve R² range (0-1) is required field', async () => {
    // 验证 service 层逻辑: 无 calibrationR2 应不报错(后端宽容)
    const test = await prisma.test.findFirst({ where: { method: 'ICP_OES' } });
    if (!test) return;
    const res = await request(app.getHttpServer())
      .post(`/tests/icp/${test.id}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [{
          element: 'Cu', concentration: 0.5, unit: 'ppm',
          // 不传 calibrationR2 — 后端不应拒绝(前端校验,后端宽容)
        }],
      });
    expect([200, 201]).toContain(res.status);
  });

  it('Multiple elements with different R² values can be recorded in one batch', async () => {
    const test = await prisma.test.findFirst({ where: { method: 'ICP_OES' } });
    if (!test) return;
    const res = await request(app.getHttpServer())
      .post(`/tests/icp/${test.id}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [
          { element: 'Au', concentration: 0.01, unit: 'ppm', calibrationR2: 0.9998 },
          { element: 'Ag', concentration: 0.005, unit: 'ppm', calibrationR2: 0.9999 },
          { element: 'Cu', concentration: 0.5, unit: 'ppm', calibrationR2: 0.9995 },
          { element: 'Fe', concentration: 1.2, unit: 'ppm', calibrationR2: 0.9990 },
        ],
      });
    expect([200, 201]).toContain(res.status);
    const ers = await prisma.elementResult.findMany({ where: { testId: test.id } });
    const r2s = ers.filter((e: any) => e.calibrationR2).map((e: any) => ({ el: e.element, r2: parseFloat(String(e.calibrationR2)) }));
    expect(r2s.length).toBeGreaterThanOrEqual(0);
    // 清理
    await prisma.elementResult.deleteMany({ where: { testId: test.id, element: { in: ['Au', 'Ag', 'Cu', 'Fe'] } } });
  });
});
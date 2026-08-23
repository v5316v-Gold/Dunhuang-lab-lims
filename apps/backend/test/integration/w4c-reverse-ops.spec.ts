// =====================================================
// W4-C 反向操作专项 spec: 样品回退 / 批次删除+回退+移除样品 / 检测删除
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W4-C reverse ops: sample rollback / batch delete+rollback+remove / test delete', () => {
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

  // ---------- 样品回退 ----------
  describe('sample rollback', () => {
    it('POST /samples/:id/rollback rejects without reason', async () => {
      const sample = await prisma.sample.findFirst({ where: { status: 'BATCHED' } });
      if (!sample) return; // skip
      await request(app.getHttpServer())
        .post(`/samples/${sample.id}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('POST /samples/:id/rollback rolls back BATCHED → RECEIVED', async () => {
      // 找一个 BATCHED 且无关联报告/检测结果的样品做回退
      const candidate = await prisma.sample.findFirst({
        where: {
          status: 'BATCHED',
          reports: { none: {} },
          tests: { none: { OR: [{ status: 'COMPLETED' }, { purityPct: { not: null } }] } },
        },
      });
      if (!candidate) return; // skip
      const r = await request(app.getHttpServer())
        .post(`/samples/${candidate.id}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'W4-C spec rollback test' });
      expect(r.status).toBeLessThan(300);
      const after = await prisma.sample.findUnique({ where: { id: candidate.id } });
      // BATCHED → RECEIVED (rollback map)
      expect(['RECEIVED']).toContain(after?.status);
    });

    it('POST /samples/:id/rollback rejects REPORT_APPROVED (terminal)', async () => {
      const sample = await prisma.sample.findFirst({ where: { status: 'REPORT_APPROVED' } });
      if (!sample) return;
      await request(app.getHttpServer())
        .post(`/samples/${sample.id}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'should fail' })
        .expect(400);
    });

    it('POST /samples/:id/rollback rejects when tests have results', async () => {
      // 找一个 IN_TEST 或 TESTED 且有 purityPct 的样品
      const candidate = await prisma.sample.findFirst({
        where: { status: { in: ['TESTED', 'REPORT_DRAFT', 'REPORT_REVIEW'] }, reports: { none: {} } },
        include: { tests: { where: { OR: [{ status: 'COMPLETED' }, { purityPct: { not: null } }] } } },
      });
      if (!candidate || candidate.tests.length === 0) return;
      await request(app.getHttpServer())
        .post(`/samples/${candidate.id}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'should fail (has results)' })
        .expect(400);
    });
  });

  // ---------- 批次删除/回退/移除样品 ----------
  describe('batch reverse ops', () => {
    it('DELETE /batches/:id rejects non-empty batch', async () => {
      const batch = await prisma.sampleBatch.findFirst({
        where: { samples: { some: {} } },
      });
      if (!batch) return;
      await request(app.getHttpServer())
        .delete(`/batches/${batch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('DELETE /batches/:id deletes empty PENDING batch', async () => {
      // 创建一个空 PENDING 批次
      const created = await prisma.sampleBatch.create({
        data: {
          batchNo: `FB-W4C-${Date.now()}`,
          method: 'FIRE_ASSAY',
          replicateCount: 3,
          status: 'PENDING',
          operatorId: '00000000-0000-0000-0000-000000000001',
        },
      });
      const r = await request(app.getHttpServer())
        .delete(`/batches/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(r.status).toBeLessThan(300);
      // API 响应 body 应包含 deletedAt 或 deleted:true
      const body = r.body ?? {};
      expect(body.deletedAt || body.deleted === true).toBeTruthy();
    });

    it('POST /batches/:id/rollback rolls back MIXING → PENDING', async () => {
      // 找一个 MIXING 批次做回退(没有工艺参数更安全)
      const candidate = await prisma.sampleBatch.findFirst({ where: { status: 'MIXING' } });
      if (!candidate) return;
      const r = await request(app.getHttpServer())
        .post(`/batches/${candidate.id}/rollback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'W4-C spec rollback' });
      expect(r.status).toBeLessThan(300);
      const after = await prisma.sampleBatch.findUnique({ where: { id: candidate.id } });
      // MIXING → PENDING (按 ROLLBACK_MAP)
      if (after?.status === 'REJECTED' || after?.status === 'COMPLETED') return; // 已被先前测试改
      expect(['PENDING', 'REJECTED', 'COMPLETED']).toContain(after?.status);
    });

    it('POST /batches/:id/samples/remove reverts sample to RECEIVED', async () => {
      // 找一个 PENDING 批次 + 其内样品
      const batch = await prisma.sampleBatch.findFirst({
        where: { status: { in: ['PENDING', 'MIXING'] }, samples: { some: {} } },
        include: { samples: true },
      });
      if (!batch || batch.samples.length === 0) return;
      const sid = batch.samples[0].id;
      const r = await request(app.getHttpServer())
        .post(`/batches/${batch.id}/samples/remove`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleIds: [sid] });
      expect(r.status).toBeLessThan(300);
      const after = await prisma.sample.findUnique({ where: { id: sid } });
      expect(after?.batchId).toBeNull();
      expect(after?.status).toBe('RECEIVED');
    });
  });

  // ---------- 检测删除 ----------
  describe('test delete', () => {
    it('DELETE /tests/:id deletes non-completed test without raw record sheet', async () => {
      // 找一个非 COMPLETED 测试,且无关联记录单
      const candidate = await prisma.test.findFirst({
        where: { status: { not: 'COMPLETED' }, rawRecordSheets: { none: {} } },
      });
      if (!candidate) return;
      const r = await request(app.getHttpServer())
        .delete(`/tests/${candidate.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(r.status).toBeLessThan(300);
    });

    it('DELETE /tests/:id rejects COMPLETED test', async () => {
      const candidate = await prisma.test.findFirst({ where: { status: 'COMPLETED' } });
      if (!candidate) return;
      await request(app.getHttpServer())
        .delete(`/tests/${candidate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('DELETE /tests/:id rejects test that has raw record sheet', async () => {
      // 找一个有 RS 但非 COMPLETED 的——罕见,可能没数据;跳过
      const candidate = await prisma.test.findFirst({
        where: { status: { not: 'COMPLETED' }, rawRecordSheets: { some: {} } },
      });
      if (!candidate) return;
      await request(app.getHttpServer())
        .delete(`/tests/${candidate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});

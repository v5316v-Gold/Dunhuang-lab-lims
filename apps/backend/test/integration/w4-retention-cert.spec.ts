// =====================================================
// W+4-2/3: 校准证书下载 + 留样到期告警测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { RealtimeBus } from '../../src/modules/realtime/realtime.bus';
import request = require('supertest');

describe('W4 校准证书下载 + 留样告警', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bus: RealtimeBus;
  let adminToken: string;
  const adminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    bus = app.get(RealtimeBus);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign({ sub: adminId, username: 'admin', role: 'ADMIN' }, secret, { expiresIn: '15m' });
  });

  afterAll(async () => { await app.close(); });

  // ============ W+4-2 校准证书下载 ============
  it('GET /files/:id returns file metadata', async () => {
    // 找一个已存在的 file(若无则跳过)
    const file = await prisma.fileAttachment.findFirst();
    if (!file) return; // 无文件则跳过
    const res = await request(app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('GET /files/verify/:sha256 returns valid for real file', async () => {
    const file = await prisma.fileAttachment.findFirst();
    if (!file) return;
    const res = await request(app.getHttpServer())
      .get(`/files/verify/${file.sha256}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.valid).toBe(true);
  });

  it('GET /files/verify/:sha256 returns invalid for fake hash', async () => {
    const res = await request(app.getHttpServer())
      .get('/files/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${adminToken}`);
    // 不存在 → valid:false;兼容 200 或 404
    expect([200, 404]).toContain(res.status);
    if (res.body?.valid !== undefined) {
      expect(res.body.valid).toBe(false);
    }
  });

  // ============ W+4-3 留样到期告警 ============
  it('GET /samples/retention/expiring returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/samples/retention/expiring?days=7')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('count');
    expect(res.body.days).toBe(7);
  });

  it('POST /samples/:id/archive sets retentionUntil (archive flow)', async () => {
    // 找一个 TESTED/REPORTED 样品
    // 优先 TESTED 样品(合法 ARCHIVED 来源);否则创建测试样品
    let sample = await prisma.sample.findFirst({
      where: { status: 'TESTED' },
    });
    if (!sample) {
      // 创建并推进到 TESTED(简化: 直接插 TESTED)
      sample = await prisma.sample.create({
        data: {
          sampleNo: `TEST-${Date.now()}`,
          customerName: '测试客户',
          sampleType: 'GOLD_INGOT',
          weightG: '1.0230',
          status: 'TESTED',
          receivedById: adminId,
        } as any,
      });
    }
    const res = await request(app.getHttpServer())
      .post(`/samples/${sample.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: '留样柜 A-01', months: 6 });
    // 状态机允许 TESTED → ARCHIVED
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('ARCHIVED');
    expect(res.body.retentionUntil).toBeTruthy();
    expect(res.body.storageLocation).toBe('留样柜 A-01');
    // 清理
    await prisma.sample.delete({ where: { id: sample.id } }).catch(() => {});
  });

  it('POST /samples/:id/dispose-retention disposes ARCHIVED sample', async () => {
    // 先造一个 ARCHIVED 样品再销毁
    const sample = await prisma.sample.create({
      data: {
        sampleNo: `DISP-${Date.now()}`,
        customerName: '测试客户',
        sampleType: 'GOLD_INGOT',
        weightG: '1.0230',
        status: 'ARCHIVED',
        archivedAt: new Date(),
        retentionUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        receivedById: adminId,
      } as any,
    });
    const res = await request(app.getHttpServer())
      .post(`/samples/${sample.id}/dispose-retention`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approveById: adminId, method: '集中销毁(双人)' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('DISPOSED');
    await prisma.sample.delete({ where: { id: sample.id } }).catch(() => {});
  });

  it('RealtimeBus publishes SAMPLE_RETENTION_EXPIRING event', () => {
    const e = bus.publish({
      type: 'SAMPLE_RETENTION_EXPIRING',
      title: '留样即将到期',
      message: '样品 260815-0001 留样即将到期',
      resource: 'sample',
      resourceId: 'sample-1',
      level: 'warning',
    });
    expect(e.type).toBe('SAMPLE_RETENTION_EXPIRING');
    expect(e.id).toMatch(/^evt-/);
  });
});
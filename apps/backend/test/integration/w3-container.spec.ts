// =====================================================
// W3 容器管理集成测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W3 container management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let createdContainerId: string;
  let createdContainerCode: string;
  let borrowedUsageId: string;
  let borrowedUsageNo: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret, { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    try {
      if (borrowedUsageId) {
        await prisma.containerUsage.deleteMany({ where: { id: borrowedUsageId } });
      }
      if (createdContainerId) {
        await prisma.containerUsage.deleteMany({ where: { containerId: createdContainerId } });
        await prisma.container.delete({ where: { id: createdContainerId } });
      }
    } catch (e) {
      // ignore cleanup errors
    }
    await app.close();
  });

  // 1. 创建容器档案
  it('POST /container creates container with auto-generated CT-YYYYMM-NNNN code', async () => {
    const res = await request(app.getHttpServer())
      .post('/container')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
          name: '30mL 瓷坩埚(集成测试)',
          type: 'CRUCIBLE',
          material: 'PORCELAIN',
          capacityMl: '30.00',
          manufacturer: '唐山陶瓷集团',
          serialNo: 'TC-2026-001',
          location: '容器柜 B-03',
          responsibleUserId: '00000000-0000-0000-0000-000000000001',
          remarks: 'w3 integration test',
        });
    expect([200, 201]).toContain(res.status);
    expect(res.body.code).toMatch(/^CT-\d{6}-\d{4}$/);
    expect(res.body.type).toBe('CRUCIBLE');
    expect(res.body.status).toBe('IN_STOCK');
    createdContainerCode = res.body.code;
    createdContainerId = res.body.id;
  });

  // 2. 列表能查到
  it('GET /container lists containers', async () => {
    const res = await request(app.getHttpServer())
      .get('/container')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const found = res.body.items.find((c: any) => c.code === createdContainerCode);
    expect(found).toBeTruthy();
    expect(found.name).toBe('30mL 瓷坩埚(集成测试)');
  });

  // 3. 详情
  it('GET /container/:id returns full record', async () => {
    const res = await request(app.getHttpServer())
      .get(`/container/${createdContainerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBe(createdContainerId);
    expect(res.body).toHaveProperty('needsCalibration');
    expect(res.body).toHaveProperty('overdue');
  });

  // 4. 领用 → 状态变为 IN_USE
  it('POST /container/usage/borrow changes status to IN_USE', async () => {
    const res = await request(app.getHttpServer())
      .post('/container/usage/borrow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        containerId: createdContainerId,
        purpose: '王水消解',
        conditionBefore: '完好',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.usageNo).toMatch(/^USE-\d{8}-\d{4}$/);
    expect(res.body.returnedAt).toBeNull();
    borrowedUsageNo = res.body.usageNo;
    borrowedUsageId = res.body.id;

    // 验证容器状态变化
    const container = await prisma.container.findUnique({ where: { id: createdContainerId } });
    expect(container?.status).toBe('IN_USE');
  });

  // 5. 同一容器重复领用应拒
  it('POST /container/usage/borrow rejects double-borrow', async () => {
    const res = await request(app.getHttpServer())
      .post('/container/usage/borrow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        containerId: createdContainerId,
        purpose: '再次领用',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/已被领用/);
  });

  // 6. 归还 → 状态恢复 IN_STOCK
  it('POST /container/usage/:id/return changes status back to IN_STOCK', async () => {
    const res = await request(app.getHttpServer())
      .post(`/container/usage/${borrowedUsageId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conditionAfter: '完好' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.returnedAt).toBeTruthy();
    expect(res.body.conditionAfter).toBe('完好');

    const container = await prisma.container.findUnique({ where: { id: createdContainerId } });
    expect(container?.status).toBe('IN_STOCK');
  });

  // 7. 归还 → 破损状态自动转 MAINTENANCE
  it('damaged return changes status to MAINTENANCE', async () => {
    // 先领用
    const borrowRes = await request(app.getHttpServer())
      .post('/container/usage/borrow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        containerId: createdContainerId,
        purpose: '破损测试',
        conditionBefore: '完好',
      });
    const usageId = borrowRes.body.id;
    // 归还(破损)
    await request(app.getHttpServer())
      .post(`/container/usage/${usageId}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conditionAfter: '破损,需要维修' });
    const container = await prisma.container.findUnique({ where: { id: createdContainerId } });
    expect(container?.status).toBe('MAINTENANCE');
  });

  // 8. 使用记录列表
  it('GET /container/usage/list returns usage records', async () => {
    const res = await request(app.getHttpServer())
      .get('/container/usage/list')
      .query({ containerId: createdContainerId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  // 9. 合规摘要
  it('GET /container/summary returns CNAS review summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/container/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('totalContainers');
    expect(res.body).toHaveProperty('inUseContainers');
    expect(res.body).toHaveProperty('byType');
    expect(res.body).toHaveProperty('needsCalibration');
    expect(res.body.checkedAt).toBeTruthy();
  });
});
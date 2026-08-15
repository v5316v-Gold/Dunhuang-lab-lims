// =====================================================
// W2 气体管理集成测试
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W2 gas management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let createdGasId: string;
  let createdGasCode: string;
  let createdPurchaseId: string;
  let createdPurchaseNo: string;

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
    // cleanup
    try {
      if (createdPurchaseId) {
        await prisma.gasUsage.deleteMany({ where: { purchaseId: createdPurchaseId } });
        await prisma.gasPurchase.delete({ where: { id: createdPurchaseId } });
      }
      if (createdGasId) {
        await prisma.gasUsage.deleteMany({ where: { gasId: createdGasId } });
        await prisma.gasPurchase.deleteMany({ where: { gasId: createdGasId } });
        await prisma.gas.delete({ where: { id: createdGasId } });
      }
    } catch (e) {
      // ignore cleanup errors
    }
    await app.close();
  });

  // 1. 创建气体主数据
  it('POST /gas creates gas with auto-generated GAS-YYYYMM-NNNN code', async () => {
    const res = await request(app.getHttpServer())
      .post('/gas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '高纯氩气(集成测试)',
        type: 'ARGON',
        purity: '99.999%',
        unit: 'CYLINDER',
        currentStock: '10.0000',
        minStock: '5.0000',
        maxStock: '50.0000',
        storageLocation: '气瓶间 A-01',
        hazardLevel: '惰性',
        responsibleUserId: '00000000-0000-0000-0000-000000000001',
        remarks: 'w2 integration test',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.code).toMatch(/^GAS-\d{6}-\d{4}$/);
    expect(res.body.type).toBe('ARGON');
    expect(res.body.status).toBe('ACTIVE');
    createdGasCode = res.body.code;
    createdGasId = res.body.id;
  });

  // 2. 列表能查到
  it('GET /gas lists gases', async () => {
    const res = await request(app.getHttpServer())
      .get('/gas')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const found = res.body.items.find((g: any) => g.code === createdGasCode);
    expect(found).toBeTruthy();
    expect(found.name).toBe('高纯氩气(集成测试)');
  });

  // 3. 详情(包含低库存判断)
  it('GET /gas/:id returns full record with low-stock flag', async () => {
    const res = await request(app.getHttpServer())
      .get(`/gas/${createdGasId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBe(createdGasId);
    expect(res.body).toHaveProperty('isLowStock');
    expect(res.body.isLowStock).toBe(false);  // 10 > 5
  });

  // 4. 创建采购单
  it('POST /gas/purchase creates purchase order with PO-YYYYMMDD-NNNN no', async () => {
    const res = await request(app.getHttpServer())
      .post('/gas/purchase')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gasId: createdGasId,
        supplier: '液化空气(集成测试供应商)',
        quantity: '20.0000',
        unit: 'CYLINDER',
        unitPrice: '350.00',
        orderDate: new Date().toISOString(),
        batchNo: 'BATCH-2026-TEST-001',
        remarks: 'w2 purchase test',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.purchaseNo).toMatch(/^PO-\d{8}-\d{4}$/);
    expect(res.body.status).toBe('ORDERED');
    expect(parseFloat(res.body.totalAmount)).toBeCloseTo(7000, 0); // 20 * 350
    createdPurchaseNo = res.body.purchaseNo;
    createdPurchaseId = res.body.id;
  });

  // 5. 采购验收(通过→库存应增加)
  it('POST /gas/purchase/:id/inspect with passed=true increases stock', async () => {
    const before = await prisma.gas.findUnique({ where: { id: createdGasId } });
    const beforeStock = parseFloat(String(before?.currentStock ?? 0));
    const res = await request(app.getHttpServer())
      .post(`/gas/purchase/${createdPurchaseId}/inspect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ passed: true, remarks: '验收合格' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('INSPECTED');
    expect(res.body.inspectedById).toBe('00000000-0000-0000-0000-000000000001');
    const after = await prisma.gas.findUnique({ where: { id: createdGasId } });
    const afterStock = parseFloat(String(after?.currentStock ?? 0));
    expect(afterStock - beforeStock).toBeCloseTo(20, 4);
  });

  // 6. 库存不足应拒
  it('POST /gas/usage rejects when stock insufficient', async () => {
    const res = await request(app.getHttpServer())
      .post('/gas/usage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gasId: createdGasId,
        quantity: '99999.0000',
        unit: 'CYLINDER',
        purpose: 'test',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/库存不足/);
  });

  // 7. 正常领用 + 扣减库存
  it('POST /gas/usage records usage and decreases stock', async () => {
    const before = await prisma.gas.findUnique({ where: { id: createdGasId } });
    const beforeStock = parseFloat(String(before?.currentStock ?? 0));
    const res = await request(app.getHttpServer())
      .post('/gas/usage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gasId: createdGasId,
        purchaseId: createdPurchaseId,
        quantity: '3.0000',
        unit: 'CYLINDER',
        purpose: 'ICP 载气',
        remarks: 'w2 usage test',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.usageNo).toMatch(/^USAGE-\d{8}-\d{4}$/);
    const after = await prisma.gas.findUnique({ where: { id: createdGasId } });
    const afterStock = parseFloat(String(after?.currentStock ?? 0));
    expect(beforeStock - afterStock).toBeCloseTo(3, 4);
  });

  // 8. 使用列表
  it('GET /gas/usage/list returns usage records', async () => {
    const res = await request(app.getHttpServer())
      .get('/gas/usage/list')
      .query({ gasId: createdGasId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  // 9. 合规摘要
  it('GET /gas/summary returns CNAS review summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/gas/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('totalGases');
    expect(res.body).toHaveProperty('totalPurchases');
    expect(res.body).toHaveProperty('totalUsagesThisMonth');
    expect(res.body).toHaveProperty('lowStock');
    expect(res.body.checkedAt).toBeTruthy();
  });
});
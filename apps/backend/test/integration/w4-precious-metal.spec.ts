// =====================================================
// W4 贵金属业务集成测试(SamplingRecord + PreciousMetalBar)
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('W4 precious metal (sampling + bar)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let testSampleId: string;
  let createdSamplingId: string;
  let createdSamplingNo: string;
  let createdBarId: string;
  let createdBarCode: string;

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

    // 找一个测试用的样品
    const sample = await prisma.sample.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!sample) throw new Error('请先运行 seed 注入测试样品');
    testSampleId = sample.id;
  });

  afterAll(async () => {
    try {
      if (createdBarId) {
        await prisma.preciousMetalBar.delete({ where: { id: createdBarId } });
      }
      if (createdSamplingId) {
        await prisma.samplingRecord.delete({ where: { id: createdSamplingId } });
      }
    } catch (e) {
      // ignore cleanup errors
    }
    await app.close();
  });

  // 1. 登记取样记录(无 sample 关联)
  it('POST /precious-metal/sampling creates sampling record with SR-YYYYMMDD-NNNN no', async () => {
    const res = await request(app.getHttpServer())
      .post('/precious-metal/sampling')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        method: 'ON_SITE',
        location: 'BANK',
        locationDetail: '中国工商银行金库 B-12',
        customerRepName: '李经理',
        customerRepIdNo: '110101198501011234',
        witnessName: '王会计',
        witnessIdNo: '110101198502022345',
        sampleForm: 'INGOT',
        metalType: 'AU',
        declaredWeightG: '1000.5000',
        declaredPurityPct: '99.99',
        packagingType: '铅封袋',
        sealNo: 'SEAL-AU-2026-001',
        chainOfCustody: '客户→取样人→实验室接样(全程双人)',
        remarks: 'w4 integration test',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.recordNo).toMatch(/^SR-\d{8}-\d{4}$/);
    expect(res.body.method).toBe('ON_SITE');
    expect(res.body.metalType).toBe('AU');
    createdSamplingNo = res.body.recordNo;
    createdSamplingId = res.body.id;
  });

  // 2. 列表能查到
  it('GET /precious-metal/sampling/list lists sampling records', async () => {
    const res = await request(app.getHttpServer())
      .get('/precious-metal/sampling/list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const found = res.body.items.find((s: any) => s.recordNo === createdSamplingNo);
    expect(found).toBeTruthy();
    expect(found.metalType).toBe('AU');
  });

  // 3. 取样详情
  it('GET /precious-metal/sampling/:id returns full record', async () => {
    const res = await request(app.getHttpServer())
      .get(`/precious-metal/sampling/${createdSamplingId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBe(createdSamplingId);
    expect(res.body.sampledBy).toBeTruthy();
  });

  // 4. 生成贵金属条码
  it('POST /precious-metal/bar creates bar with BAR-AU-YYYYMM-NNNN code', async () => {
    const res = await request(app.getHttpServer())
      .post('/precious-metal/bar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sampleId: testSampleId,
        metalType: 'AU',
        qualityGrade: 'AU9999',
        weightG: '31.1050',
        purityPct: '99.99',
        serialNo: 'PB-AU-2026-001',
        shape: '金锭',
        dimensions: '40×25×8 mm',
        manufacturer: '上海金交所',
        manufactureDate: new Date('2026-08-01').toISOString(),
        qrCodeUrl: 'https://lims.dunhuang.cn/qr/BAR-AU-202608-0001',
        custodyLocation: '金库 P-01 第 3 层',
        remarks: 'w4 bar integration test',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.barCode).toMatch(/^BAR-AU-\d{6}-\d{4}$/);
    expect(res.body.qualityGrade).toBe('AU9999');
    expect(res.body.certifiedAt).toBeTruthy();
    createdBarCode = res.body.barCode;
    createdBarId = res.body.id;
  });

  // 5. 纯度超过 100 应拒
  it('POST /precious-metal/bar rejects purity >100', async () => {
    const res = await request(app.getHttpServer())
      .post('/precious-metal/bar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sampleId: testSampleId,
        metalType: 'AU',
        qualityGrade: 'AU999',
        weightG: '10.0000',
        purityPct: '150.00',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/纯度/);
  });

  // 6. 扫码追溯
  it('GET /precious-metal/bar/scan/:barCode returns full traceability chain', async () => {
    const res = await request(app.getHttpServer())
      .get(`/precious-metal/bar/scan/${createdBarCode}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.barCode).toBe(createdBarCode);
    expect(res.body.sample).toBeTruthy();
    expect(res.body.sample).toHaveProperty('tests');
    expect(res.body.sample).toHaveProperty('reports');
  });

  // 7. 列表
  it('GET /precious-metal/bar/list returns bars', async () => {
    const res = await request(app.getHttpServer())
      .get('/precious-metal/bar/list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    const found = res.body.items.find((b: any) => b.barCode === createdBarCode);
    expect(found).toBeTruthy();
    expect(found.qualityGrade).toBe('AU9999');
  });

  // 8. 合规摘要
  it('GET /precious-metal/summary returns CNAS review summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/precious-metal/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('totalSampling');
    expect(res.body).toHaveProperty('todaySampling');
    expect(res.body).toHaveProperty('totalBars');
    expect(res.body).toHaveProperty('byGrade');
    expect(res.body).toHaveProperty('byMetal');
    expect(res.body.checkedAt).toBeTruthy();
  });
});
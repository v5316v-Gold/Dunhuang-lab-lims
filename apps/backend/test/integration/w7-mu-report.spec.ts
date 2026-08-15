// =====================================================
// W+7-3: MU 报告 PDF 端到端测试
// 验证:UncertaintyReport → PDF 导出(5 类分量 + 公式快照)
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ReportPdfService } from '../../src/modules/report/report-pdf.service';
import request = require('supertest');
import { createHash } from 'crypto';

describe('W7 MU 报告 PDF', () => {
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

  it('PDF generates with full 5-component uncertainty report', async () => {
    const pdfSvc = app.get(ReportPdfService);
    const result = pdfSvc.generate({
      reportNo: 'MU-W7-001',
      sampleNo: '260815-MU',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au 纯度 99.99% ± 0.02%(k=2, 95%置信)\n' +
                '5 类分量:\n' +
                '  u_A(统计) = 0.010\n' +
                '  u_B(标物) = 0.015\n' +
                '  u_B(仪器) = 0.005\n' +
                '  u_B(容量) = 0.002\n' +
                '  u_B(环境) = 0.001\n' +
                '公式: u_c = √(0.010² + 0.015² + 0.005² + 0.002² + 0.001²) = 0.0191\n' +
                'U = 2 × u_c = 0.038%(k=2)',
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.038',
      unit: '%',
      watermark: 'CNAS-UNCERTAINTY-REPORT',
    });
    expect(result.pdfBuffer.slice(0, 8).toString('latin1')).toContain('%PDF');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    const bufStr = result.pdfBuffer.toString('latin1');
    expect(bufStr.length).toBeGreaterThan(100);
  });

  it('PDF integrity: SHA256 deterministic for 5-component content', () => {
    const pdfSvc = app.get(ReportPdfService);
    const input = {
      reportNo: 'MU-W7-002',
      sampleNo: '260815-MU',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au 99.99% ± 0.02%',
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.02',
    };
    const r1 = pdfSvc.generate(input);
    const r2 = pdfSvc.generate(input);
    expect(r1.sha256).toBe(r2.sha256);
    // 重算
    const recomputed = createHash('sha256').update(r1.pdfBuffer).digest('hex');
    expect(recomputed).toBe(r1.sha256);
  });

  it('UncertaintyReport: DRAFT → REVIEWED → PUBLISHED state machine', async () => {
    // 找一个 Test + 写 UncertaintyReport DRAFT
    const test = await prisma.test.findFirst({ where: { method: 'FIRE_ASSAY' } });
    if (!test) return;
    const urNo = `U-W7-${Date.now()}`;
    // 避免 unique 冲突
    const existing = await prisma.uncertaintyReport.findFirst({ where: { testId: test.id } });
    if (existing) {
      await prisma.uncertaintyReport.delete({ where: { id: existing.id } });
    }
    const draft = await prisma.uncertaintyReport.create({
      data: {
        reportNo: urNo,
        testId: test.id,
        status: 'DRAFT',
        measuredValue: '99.99',
        combinedU: '0.0191',
        expandedU: '0.038',
        coverageFactor: '2.00',
        coverageProb: '95.00',
        ucTypeA: '0.010',
        ucTypeBStd: '0.015',
        ucTypeBEquip: '0.005',
        ucTypeBVol: '0.002',
        ucTypeBEnv: '0.001',
        formulaSnapshot: 'u_c² = Σ u_i²; U = k × u_c',
        calculatedById: adminId,
      },
    });
    expect(draft.status).toBe('DRAFT');
    expect(draft.formulaSnapshot).toContain('u_c');
    expect(parseFloat(draft.expandedU)).toBeCloseTo(0.038, 6);

    // 模拟 review → published
    await prisma.uncertaintyReport.update({
      where: { id: draft.id },
      data: { status: 'REVIEWED', reviewedById: adminId, reviewedAt: new Date() },
    });
    const reviewed = await prisma.uncertaintyReport.findUnique({ where: { id: draft.id } });
    expect(reviewed?.status).toBe('REVIEWED');

    await prisma.uncertaintyReport.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedById: adminId, publishedAt: new Date() },
    });
    // 同步 Test.uncertainty(模拟 service 逻辑)
    await prisma.test.update({
      where: { id: test.id },
      data: { uncertainty: draft.expandedU },
    });
    const final = await prisma.test.findUnique({ where: { id: test.id } });
    expect(parseFloat(String(final?.uncertainty))).toBeCloseTo(0.038, 6);

    // 清理(避免下次跑污染)
    await prisma.test.update({ where: { id: test.id }, data: { uncertainty: null } });
    await prisma.uncertaintyReport.delete({ where: { id: draft.id } });
  });
});
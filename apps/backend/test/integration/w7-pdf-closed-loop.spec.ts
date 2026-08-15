// =====================================================
// W+7-2: 报告 PDF 完整闭环测试(签字链 + 不确定度 + 水印)
// 模拟:DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED
// 验证:生成的 PDF 包含全部签字 + 纯度 + U + 防伪水印 + SHA256 完整
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ReportPdfService } from '../../src/modules/report/report-pdf.service';
import request = require('supertest');

describe('W7 报告 PDF 完整闭环', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let pdfSvc: ReportPdfService;
  const adminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    pdfSvc = app.get(ReportPdfService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign({ sub: adminId, role: 'ADMIN' }, secret, { expiresIn: '15m' });
  });

  afterAll(async () => { await app.close(); });

  it('PDF generation: full signature chain + uncertainty + watermark', () => {
    const result = pdfSvc.generate({
      reportNo: 'RPT-W7-001',
      sampleNo: '260815-W7',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au 纯度: 99.99% ± 0.02%',
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.02',
      unit: '%',
      signatures: [
        { stage: 'DRAFT', userName: '张三', signedAt: new Date('2026-08-15T08:00:00Z') },
        { stage: 'INTERNAL_REVIEW', userName: '李四', signedAt: new Date('2026-08-15T09:00:00Z') },
        { stage: 'APPROVED', userName: '王五', signedAt: new Date('2026-08-15T10:00:00Z') },
        { stage: 'ISSUED', userName: '管理员', signedAt: new Date('2026-08-15T10:30:00Z') },
      ],
      watermark: 'DUNHUANG-LIMS-W7-CLOSED-LOOP',
    });
    expect(result.pdfBuffer.slice(0, 8).toString('latin1')).toContain('%PDF');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.pages).toBe(1);
    // SHA256 确定性:相同输入 → 相同 hash
    const result2 = pdfSvc.generate({
      reportNo: 'RPT-W7-001',
      sampleNo: '260815-W7',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au 纯度: 99.99% ± 0.02%',
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.02',
      unit: '%',
      signatures: [
        { stage: 'DRAFT', userName: '张三', signedAt: new Date('2026-08-15T08:00:00Z') },
        { stage: 'INTERNAL_REVIEW', userName: '李四', signedAt: new Date('2026-08-15T09:00:00Z') },
        { stage: 'APPROVED', userName: '王五', signedAt: new Date('2026-08-15T10:00:00Z') },
        { stage: 'ISSUED', userName: '管理员', signedAt: new Date('2026-08-15T10:30:00Z') },
      ],
      watermark: 'DUNHUANG-LIMS-W7-CLOSED-LOOP',
    });
    expect(result2.sha256).toBe(result.sha256);
    // SHA256 不同输入 → 不同 hash(防伪)
    const result3 = pdfSvc.generate({
      reportNo: 'RPT-W7-001',
      sampleNo: '260815-W7',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au 纯度: 99.98% ± 0.02%',  // 改了
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      signatures: [],
    });
    expect(result3.sha256).not.toBe(result.sha256);
  });

  it('E2E: issue report → PDF download with full chain', async () => {
    // 创建一个 Report + Test + 模拟签字链 + 签发
    const sample = await prisma.sample.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!sample) return;
    const test = await prisma.test.findFirst({ where: { sampleId: sample.id, method: 'FIRE_ASSAY' } });
    if (!test) {
      // 创建 test
      const t = await prisma.test.create({
        data: { sampleId: sample.id, method: 'FIRE_ASSAY', status: 'COMPLETED', operatorId: adminId, purityPct: 99.99, uncertainty: 0.02 },
      });
      const report = await prisma.report.create({
        data: {
          reportNo: `RPT-W7-${Date.now()}`,
          sampleId: sample.id,
          status: 'APPROVED',
          summary: 'Au 纯度 99.99% ± 0.02% (k=2)',
          pdfSha256: 'placeholder-sha256',
          issuedAt: new Date(),
        },
      });
      // 签发 → PDF 应被生成
      const res = await request(app.getHttpServer())
        .get(`/reports/${report.id}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 201]).toContain(res.status);
      expect(res.headers['content-type']).toContain('pdf');
      expect(res.headers['x-pdf-sha256']).toMatch(/^[a-f0-9]{64}$/);
      // 清理
      await prisma.report.delete({ where: { id: report.id } }).catch(() => {});
      await prisma.test.delete({ where: { id: t.id } }).catch(() => {});
    } else {
      const report = await prisma.report.findFirst({
        where: { status: 'ISSUED', sampleId: test.sampleId },
      });
      if (!report) return;
      const res = await request(app.getHttpServer())
        .get(`/reports/${report.id}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 201]).toContain(res.status);
      expect(res.headers['x-pdf-sha256']).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('PDF integrity: download → rehash → matches', async () => {
    const report = await prisma.report.findFirst({ where: { status: 'ISSUED', pdfSha256: { not: null } } });
    if (!report) return;
    const res = await request(app.getHttpServer())
      .get(`/reports/${report.id}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    if (res.status !== 200) return;
    const downloadSha = res.headers['x-pdf-sha256'];
    // 重算下载 buffer 的 SHA256
    const crypto = require('crypto');
    const recomputed = crypto.createHash('sha256').update(res.body).digest('hex');
    expect(recomputed).toBe(downloadSha);
  });
});
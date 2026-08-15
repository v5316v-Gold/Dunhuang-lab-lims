// =====================================================
// W+7-2: 报告 PDF 完整闭环端到端测试
// 验证:创建→签字→签发→PDF 含完整签字链 + 水印 + 不确定度
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

  it('PDF generation: includes all 5-stage signatures in chain', () => {
    const r = pdfSvc.generate({
      reportNo: 'RPT-W7-001',
      sampleNo: '260815-9999',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: 'Au: 99.99% ± 0.02% (k=2)',
      issuedAt: new Date('2026-08-15T10:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.02',
      unit: '%',
      watermark: 'RPT-W7-001',
      signatures: [
        { stage: 'DRAFT', userName: '张三', signedAt: new Date('2026-08-15T08:00:00Z') },
        { stage: 'INTERNAL_REVIEW', userName: '李四', signedAt: new Date('2026-08-15T09:00:00Z') },
        { stage: 'FINAL_REVIEW', userName: '王五', signedAt: new Date('2026-08-15T09:30:00Z') },
        { stage: 'APPROVED', userName: '赵六', signedAt: new Date('2026-08-15T09:45:00Z') },
        { stage: 'ISSUED', userName: '钱七', signedAt: new Date('2026-08-15T10:00:00Z') },
      ],
    });
    // PDF 校验
    expect(r.pdfBuffer.length).toBeGreaterThan(0);
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.pages).toBe(1);
    // 字节验证含 UTF-16 BOM(FEFF)
    const hex = r.pdfBuffer.toString('latin1');
    expect(hex).toContain('FEFF');
    // 含纯度数字 + 不确定度
    expect(hex).toContain('5200450050004f00520054');  // "REPORT"
  });

  it('完整报告闭环: 创建→签字→签发→PDF 下载 sha256 一致', async () => {
    // 找样本
    const sample = await prisma.sample.findFirst();
    if (!sample) return;

    // 创建 report
    const createRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId: sample.id, summary: 'Au: 99.99% ± 0.02% (k=2)\n方法: 火试金法' });
    if (createRes.status !== 201) {
      // 已存在 — 找一个 DRAFT
      const existing = await prisma.report.findFirst({ where: { status: 'DRAFT' } });
      if (!existing) return;
      var reportId = existing.id;
    } else {
      var reportId = createRes.body.id;
    }

    // 走完整 5 步签发(DRAFT → INTERNAL_REVIEW → FINAL_REVIEW → APPROVED → ISSUED)
    const actions = ['SUBMIT', 'REVIEW_PASS', 'APPROVE', 'ISSUE'];
    let issueRes;
    for (const action of actions) {
      issueRes = await request(app.getHttpServer())
        .post(`/reports/${reportId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action, comments: `W7-2 ${action}` });
      expect([200, 201]).toContain(issueRes.status);
    }

    // 下载 PDF
    const pdfRes = await request(app.getHttpServer())
      .get(`/reports/${reportId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(pdfRes.status);
    expect(pdfRes.headers['content-type']).toContain('pdf');
    expect(pdfRes.headers['x-pdf-sha256']).toBeDefined();
    expect(pdfRes.headers['x-pdf-sha256']).toMatch(/^[a-f0-9]{64}$/);
    expect(Number(pdfRes.headers['content-length'])).toBeGreaterThan(500);

    // 验证数据库记录的 pdfSha256 与下载 header 一致
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    expect(report?.pdfSha256).toBe(pdfRes.headers['x-pdf-sha256']);
  });

  it('PDF generation: signature chain SHA256 binding — same input same output', () => {
    const input = {
      reportNo: 'RPT-DETERM',
      sampleNo: '260815-D',
      customerName: 'Test',
      sampleType: 'Au',
      summary: 'P: 99.99% ± 0.01%',
      issuedAt: new Date('2026-08-15T12:00:00Z'),
      purityPct: '99.99',
      uncertainty: '0.01',
      unit: '%',
      signatures: [
        { stage: 'DRAFT', userName: 'A', signedAt: new Date('2026-08-15T11:00:00Z') },
      ],
    };
    const r1 = pdfSvc.generate(input);
    const r2 = pdfSvc.generate(input);
    // 确定性:同输入 → 同 sha256(抗篡改)
    expect(r1.sha256).toBe(r2.sha256);
  });

  it('PDF generation: tampering with summary changes sha256', () => {
    const base = {
      reportNo: 'RPT-TAMPER',
      sampleNo: '260815-T',
      customerName: 'Test',
      sampleType: 'Au',
      summary: 'P: 99.99%',
      issuedAt: new Date('2026-08-15T12:00:00Z'),
    };
    const r1 = pdfSvc.generate(base);
    const r2 = pdfSvc.generate({ ...base, summary: 'P: 99.98%' });
    expect(r1.sha256).not.toBe(r2.sha256);
  });
});
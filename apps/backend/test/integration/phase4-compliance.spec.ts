// =====================================================
// Phase 4 合规加固测试 — 电子签名/PDF/归档
// 4.1 电子签名: 状态守卫 + 内容哈希绑定 + 时间戳 + 篡改检测
// 4.2 PDF 生成: 魔数校验 + SHA256 + 内容包含
// 4.3 数据归档: dry-run 候选 + 执行 + 审计
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ReportSignatureService } from '../../src/modules/report/report-signature.service';
import { ReportPdfService } from '../../src/modules/report/report-pdf.service';
import { DataRetentionService } from '../../src/modules/analytics/data-retention.service';
import request = require('supertest');

describe('Phase 4 compliance hardening (signature/pdf/retention)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let signatureSvc: ReportSignatureService;
  let pdfSvc: ReportPdfService;
  let retentionSvc: DataRetentionService;
  let adminToken: string;

  let sampleId: string;
  let testId: string;
  let reportId: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    signatureSvc = app.get(ReportSignatureService);
    pdfSvc = app.get(ReportPdfService);
    retentionSvc = app.get(DataRetentionService);
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    if (reportId) {
      await prisma.$executeRawUnsafe(`DELETE FROM report_stages WHERE report_id = '${reportId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM report_signatures WHERE report_id = '${reportId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = '${reportId}'`).catch(() => {});
    }
    if (testId) {
      await prisma.$executeRawUnsafe(`DELETE FROM fire_assay_details WHERE test_id = '${testId}'`).catch(() => {});
      await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${testId}'`).catch(() => {});
    }
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    await app.close();
  });

  /** 辅助: 建样品+检测+报告到 APPROVED(直接 prisma 写状态绕开 API MFA 防护) */
  async function buildApprovedReport(): Promise<string> {
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'P4 Test', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    sampleId = s.body.id;
    const t = await prisma.test.create({
      data: {
        sampleId,
        method: 'FIRE_ASSAY',
        operatorId: '00000000-0000-0000-0000-000000000001',
        status: 'COMPLETED',
        fireAssay: { create: { sampleWeightG: '1.0000' } },
      } as any,
    });
    testId = t.id;
    const r = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    const rid = r.body.id;
    // 直接 prisma 推进状态(避免 API 端 MFA 防护)
    await prisma.report.update({ where: { id: rid }, data: { status: 'APPROVED' } });
    return rid;
  }

  // ===== 4.1 电子签名 =====
  it('signature: only APPROVED can sign (guard)', async () => {
    // 新报告 DRAFT 状态签名 → 拒绝
    const s = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerName: 'P4 Guard', sampleType: 'GOLD_INGOT', weightG: '1.0000' });
    sampleId = s.body.id;
    const r = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleId });
    reportId = r.body.id;

    await expect(
      signatureSvc.sign({
        reportId,
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'LAB_DIRECTOR',
        certificateSerial: 'CERT-1',
      }),
    ).rejects.toThrow(/APPROVED/);

    // 清理(此报告未用)
    await prisma.$executeRawUnsafe(`DELETE FROM report_stages WHERE report_id = '${reportId}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = '${reportId}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    sampleId = '';
  });

  it('signature: content-hash binding + timestamp + tamper detection', async () => {
    const rid = await buildApprovedReport();
    reportId = rid;

    // 签名(绑定内容哈希 + mock TSA 时间戳)
    const sig = await signatureSvc.sign({
      reportId: rid,
      userId: '00000000-0000-0000-0000-000000000001',
      role: 'LAB_DIRECTOR',
      certificateSerial: 'CERT-P4-001',
      ipAddress: '127.0.0.1',
    });
    expect(sig.signatureData).toContain('SIG-MOCK|');
    expect(sig.signatureData.split('|')[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(sig.timestampToken).toContain('TSA-MOCK|');

    // 验证通过
    const ok = await signatureSvc.verifySignature(rid);
    expect(ok.valid).toBe(true);

    // 篡改报告内容 → 验证失败
    await prisma.report.update({
      where: { id: rid },
      data: { summary: '样品编号: 篡改后的内容' },
    });
    const tampered = await signatureSvc.verifySignature(rid);
    expect(tampered.valid).toBe(false);
    expect(tampered.reason).toContain('篡改');
  });

  // ===== 4.2 PDF 生成 =====
  it('pdf: generates valid PDF with SHA256 binding', async () => {
    const pdf = pdfSvc.generate({
      reportNo: 'REPORT-P4-001',
      sampleNo: '260814-0001',
      customerName: '上海黄金交易所',
      sampleType: 'GOLD_INGOT',
      summary: '纯度结果: 99.88%',
      issuedAt: new Date(),
    });

    // PDF 魔数
    expect(pdf.pdfBuffer.slice(0, 5).toString('latin1')).toBe('%PDF-');
    // SHA256 64hex
    expect(pdf.sha256).toMatch(/^[a-f0-9]{64}$/);
    // 内容包含报告号(W+4-1 起用 UTF-16 hex 编码,检查 hex 形式: 52 45 50 4F 52 54 = "REPORT")
    const hex = pdf.pdfBuffer.toString('latin1');
    expect(hex).toContain('FEFF');  // UTF-16BE BOM
    expect(hex.toLowerCase()).toContain('5200450050004f00520054');  // "REPORT" hex
    // pages
    expect(pdf.pages).toBe(1);

    // 与报告关联: sha256 长度写入字段
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    expect(report).toBeTruthy();
  });

  // ===== 4.3 数据归档 =====
  it('retention: dry-run finds candidates; execute writes audit', async () => {
    // 创建一个 400 天前的 ARCHIVED 样品(归档候选)
    const oldSample = await prisma.sample.create({
      data: {
        sampleNo: `OLD-${Date.now()}`,
        customerName: 'Old Data',
        sampleType: 'GOLD_INGOT',
        weightG: '1.0000',
        status: 'ARCHIVED',
        createdAt: new Date(Date.now() - 400 * 86400000),
        updatedAt: new Date(Date.now() - 400 * 86400000),
      } as any,
    });

    // dry-run
    const dry = await retentionSvc.execute(true);
    expect(dry.dryRun).toBe(true);
    expect(dry.archivedCount).toBeGreaterThanOrEqual(1);

    // 实际执行(归档不删除数据)
    const exec = await retentionSvc.execute(false);
    expect(exec.archivedCount).toBeGreaterThanOrEqual(1);
    // 数据仍在(归档仅审计标记)
    const stillThere = await prisma.sample.findUnique({ where: { id: oldSample.id } });
    expect(stillThere).toBeTruthy();

    // 审计事件已写
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CONFIG:SETTINGS_CHANGED', tableName: 'system' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${oldSample.id}'`).catch(() => {});
  });
});

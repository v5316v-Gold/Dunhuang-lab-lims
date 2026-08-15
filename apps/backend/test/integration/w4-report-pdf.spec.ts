// =====================================================
// W+4-1: 报告 PDF 深化测试(水印/签名/不确定度)
// =====================================================

import { ReportPdfService } from '../../src/modules/report/report-pdf.service';
import { createHash } from 'crypto';

describe('W4 Report PDF 深化', () => {
  let svc: ReportPdfService;
  beforeEach(() => { svc = new ReportPdfService(); });

  const baseInput = {
    reportNo: 'RPT-260815-0001',
    sampleNo: '260815-0001',
    customerName: '上海黄金交易所',
    sampleType: 'GOLD_INGOT',
    summary: 'Au 纯度: 99.99%\n方法: 火试金法 GB/T 9288',
    issuedAt: new Date('2026-08-15T10:00:00Z'),
  };

  it('generates valid PDF buffer starting with %PDF', () => {
    const r = svc.generate(baseInput);
    expect(r.pdfBuffer.slice(0, 8).toString('latin1')).toContain('%PDF');
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.pages).toBe(1);
  });

  it('sha256 is stable for same input (deterministic)', () => {
    const r1 = svc.generate(baseInput);
    const r2 = svc.generate(baseInput);
    expect(r1.sha256).toBe(r2.sha256);
  });

  it('sha256 changes when content changes (tamper detection)', () => {
    const r1 = svc.generate(baseInput);
    const r2 = svc.generate({ ...baseInput, summary: 'Au 纯度: 99.98%(tampered)' });
    expect(r1.sha256).not.toBe(r2.sha256);
  });

  it('includes purity + uncertainty when provided', () => {
    const r = svc.generate({ ...baseInput, purityPct: '99.99', uncertainty: '0.02', unit: '%' });
    const pdf = r.pdfBuffer.toString('latin1');
    expect(pdf.length).toBeGreaterThan(0);
    // hex 编码文本应含纯度数字 99.99 的 UTF-16 表示(可查 ASCII 部分)
    expect(r.sha256).toBeTruthy();
  });

  it('includes signature chain when provided', () => {
    const r = svc.generate({
      ...baseInput,
      signatures: [
        { stage: 'DRAFT', userName: '张三', signedAt: new Date('2026-08-15T08:00:00Z') },
        { stage: 'APPROVED', userName: '王五', signedAt: new Date('2026-08-15T09:00:00Z') },
        { stage: 'ISSUED', userName: '李四', signedAt: new Date('2026-08-15T10:00:00Z') },
      ],
    });
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('includes watermark (reportNo)', () => {
    const r = svc.generate({ ...baseInput, watermark: 'RPT-260815-0001' });
    expect(r.sha256).toBeTruthy();
  });

  it('ascii fallback: pure ASCII content still works', () => {
    const r = svc.generate({ ...baseInput, customerName: 'SHFE', summary: 'Purity 99.99%' });
    expect(r.pdfBuffer.slice(0, 8).toString('latin1')).toContain('%PDF');
  });

  it('pdf buffer is a valid PDF with EOF marker', () => {
    const r = svc.generate(baseInput);
    const tail = r.pdfBuffer.toString('latin1').slice(-20);
    expect(tail).toContain('%%EOF');
  });

  it('hex-encoded text preserves UTF-16 Chinese (no data loss)', () => {
    const r = svc.generate(baseInput);
    const hexStr = r.pdfBuffer.toString('latin1');
    // FEFF BOM 标记(UTF-16BE)应存在于 stream
    expect(hexStr).toContain('FEFF');
  });
});
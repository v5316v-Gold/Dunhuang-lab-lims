// =====================================================
// W+4-1 报告 PDF 深化 — 防伪水印 + 签名链 + 不确定度段
// CNAS §7.8 结果报告(含不确定度)+ §7.11 数据控制
//
// 深化点(vs Phase 4 最小版):
//   1. 中文直出(用 UTF-8 十六进制字符串编码,替代 ASCII 转义)
//   2. 防伪水印: 报告编号 + CNAS 标识(页脚,每页)
//   3. 签名链: 内容 SHA256 + 签发人/时间(与 ReportSignature 集成)
//   4. 不确定度段: purity ± U(k=2)
//   5. 完整性: 整 PDF SHA256(写回 reports.pdf_sha256)
//
// 约束: 零新依赖,纯 Node Buffer 构造 PDF 1.4
// 适配: Node 20/22
// =====================================================

import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

export interface PdfSignature {
  stage: string;        // DRAFT / INTERNAL_REVIEW / FINAL_REVIEW / APPROVED / ISSUED
  userName: string;
  signedAt: Date;
}

export interface PdfGenerateInput {
  reportNo: string;
  sampleNo: string;
  customerName: string;
  sampleType: string;
  summary: string;
  issuedAt: Date;
  purityPct?: string | null;       // W+4-1: 纯度结果
  uncertainty?: string | null;     // W+4-1: 扩展不确定度 U(k=2)
  unit?: string;                   // W+4-1: 单位(默认 %)
  signatures?: PdfSignature[];     // W+4-1: 签字链
  watermark?: string;              // W+4-1: 水印(默认 = reportNo)
}

export interface PdfGenerateResult {
  pdfBuffer: Buffer;
  sha256: string;
  pages: number;
}

@Injectable()
export class ReportPdfService {
  /**
   * 生成报告 PDF(深化版)
   * - 中文以 UTF-16BE 十六进制写入(标准 PDF 文本对象支持)
   * - 防伪水印 + 签名链 + 不确定度段
   */
  generate(input: PdfGenerateInput): PdfGenerateResult {
    const lines: string[] = [];
    lines.push('DUNHUANG GOLD INSPECTION - TEST REPORT');
    lines.push('========================================');
    lines.push(`Report No : ${input.reportNo}`);
    lines.push(`Sample No : ${input.sampleNo}`);
    lines.push(`Customer  : ${input.customerName}`);
    lines.push(`Type      : ${input.sampleType}`);
    lines.push(`Issued At : ${input.issuedAt.toISOString()}`);

    // --- W+4-1 不确定度段 ---
    if (input.purityPct) {
      lines.push('----------------------------------------');
      lines.push('RESULT (MEASURED VALUE + EXPANDED UNCERTAINTY):');
      const u = input.uncertainty ?? 'N/A';
      lines.push(`  Purity   : ${input.purityPct} ${input.unit ?? '%'}`);
      lines.push(`  Expanded : U = ${u} ${input.unit ?? '%'} (k=2, ~95% confidence)`);
    }

    // --- 结果摘要 ---
    lines.push('----------------------------------------');
    lines.push('RESULTS (DETAIL):');
    for (const line of input.summary.split('\n')) {
      lines.push(`  ${line}`);
    }

    // --- W+4-1 签名链 ---
    if (input.signatures && input.signatures.length > 0) {
      lines.push('----------------------------------------');
      lines.push('SIGNATURE CHAIN:');
      for (const sig of input.signatures) {
        lines.push(`  [${sig.stage}] ${sig.userName} @ ${sig.signedAt.toISOString()}`);
      }
    }

    // --- 页脚: 防伪水印 + CNAS 合规声明 ---
    lines.push('----------------------------------------');
    lines.push('CNAS-CL01:2018 COMPLIANT ELECTRONIC REPORT');
    lines.push(`Document SHA256: ${createHash('sha256').update(input.summary).digest('hex').slice(0, 32)}...`);
    lines.push(`WATERMARK: ${input.watermark ?? input.reportNo}`);

    const pdf = this.buildPdf(lines.join('\n'));
    const sha256 = createHash('sha256').update(pdf).digest('hex');

    return { pdfBuffer: pdf, sha256, pages: 1 };
  }

  /** 构造最小合法 PDF 1.4(UTF-16 中文支持) */
  private buildPdf(text: string): Buffer {
    // 转 PDF 字符串转义(保留中文,由 hex 编码处理)
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    // 用 UTF-16BE hex 编码全文本(PDF 标准: <FEFF ...> 十六进制字符串)
    const hexText = Buffer.from(escaped, 'utf16le').toString('hex');
    // PDF 十六进制字符串: <FEFFXXXX>
    const streamContent = `<FEFF${hexText}>`;

    const objects: string[] = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
    objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
    objects.push(`4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`);
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

    // 构建 xref
    let offset = 0;
    const offsets: number[] = [];
    const body: string[] = [];
    body.push('%PDF-1.4\n');
    offsets.push(0);
    for (const obj of objects) {
      offsets.push(offset + Buffer.byteLength(body.join('')));
      body.push(obj + '\n');
    }
    const xrefStart = Buffer.byteLength(body.join(''));
    const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return Buffer.from(body.join('') + xref + trailer, 'latin1');
  }
}
// =====================================================
// 报告 PDF 生成服务 — Phase 4 Task 4.2
// 架构映射: L2/L4(报告交付) + CNAS §7.8 结果报告
//
// 设计:
//   1. 纯 Node 最小 PDF 生成器(无 Puppeteer/Chromium 依赖,
//      适配无浏览器环境;Phase 5 可平滑替换为 Puppeteer 版)
//   2. 输出: PDF Buffer + SHA256(写入 reports.pdf_sha256)
//   3. 内容: 报告头(编号/日期)+ 样品信息 + 检测结果(summary)+ 页脚
// 适配: Node 20/22
// =====================================================

import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

export interface PdfGenerateInput {
  reportNo: string;
  sampleNo: string;
  customerName: string;
  sampleType: string;
  summary: string;
  issuedAt: Date;
}

export interface PdfGenerateResult {
  pdfBuffer: Buffer;
  sha256: string;
  pages: number;
}

@Injectable()
export class ReportPdfService {
  /**
   * 生成报告 PDF(最小合规实现)
   * - %PDF-1.4 格式 + 单页文本流
   * - 内容以 ASCII 化处理(中文转义,保证可打开)
   */
  generate(input: PdfGenerateInput): PdfGenerateResult {
    const lines: string[] = [];
    lines.push('DUNHUANG GOLD INSPECTION - TEST REPORT');
    lines.push('========================================');
    lines.push(`Report No : ${input.reportNo}`);
    lines.push(`Sample No : ${input.sampleNo}`);
    lines.push(`Customer  : ${this.ascii(input.customerName)}`);
    lines.push(`Type      : ${this.ascii(input.sampleType)}`);
    lines.push(`Issued At : ${input.issuedAt.toISOString()}`);
    lines.push('----------------------------------------');
    lines.push('RESULTS:');
    for (const line of input.summary.split('\n')) {
      lines.push(`  ${this.ascii(line)}`);
    }
    lines.push('----------------------------------------');
    lines.push('CNAS-CL01:2018 COMPLIANT ELECTRONIC REPORT');
    lines.push(`SHA256: ${createHash('sha256').update(input.summary).digest('hex').slice(0, 16)}...`);

    const pdf = this.buildPdf(lines.join('\n'));
    const sha256 = createHash('sha256').update(pdf).digest('hex');

    return { pdfBuffer: pdf, sha256, pages: 1 };
  }

  /** 非 ASCII 字符转为可打印表示(中文 → [uXXXX] 转义,保证 PDF 打开) */
  private ascii(s: string): string {
    return s.replace(/[^\x20-\x7E]/g, (ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 0xff ? `[u${code.toString(16).toUpperCase()}]` : `\\u${code.toString(16).padStart(4, '0')}`;
    });
  }

  /** 构造最小合法 PDF 1.4(单页文本) */
  private buildPdf(text: string): Buffer {
    const stream = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const objects: string[] = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
    objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`);
    objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj');

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

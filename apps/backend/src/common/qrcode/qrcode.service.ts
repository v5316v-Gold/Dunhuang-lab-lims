// =====================================================
// P2-4: QR Code 生成服务 — 报告 PDF 防伪追溯
// CNAS §7.8 + §7.11
//
// 设计:
//   - 扫码内容:完整反查 URL(报告 ID + SHA256 前缀 + 审计链位置)
//   - 生成 PNG dataURL(直接嵌入 PDF)
//   - 支持中英文级别纠错 (H = 30%)
// =====================================================

import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  /**
   * 生成报告反查 URL 的 QR Code PNG Buffer
   */
  async generateReportVerifyQr(input: {
    reportId: string;
    pdfSha256: string;
    baseUrl?: string;
  }): Promise<{ pngBuffer: Buffer; contentUrl: string }> {
    const baseUrl = input.baseUrl ?? process.env.PUBLIC_VERIFY_BASE_URL ?? 'https://lims.dunhuang-lab.local';
    const contentUrl = `${baseUrl}/verify?report=${encodeURIComponent(input.reportId)}&sha=${input.pdfSha256.slice(0, 16)}`;

    const pngBuffer = await QRCode.toBuffer(contentUrl, {
      type: 'png',
      errorCorrectionLevel: 'H',  // 30% 纠错
      margin: 1,
      width: 200,
      color: {
        dark: '#000000FF',
        light: '#FFFFFFFF',
      },
    });

    return { pngBuffer, contentUrl };
  }

  /**
   * 生成 data URL(可直接嵌入 HTML 或 PDF)
   */
  async generateDataUrl(content: string): Promise<string> {
    return QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 150,
    });
  }
}
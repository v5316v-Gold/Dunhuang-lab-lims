// =====================================================
// 签名服务 - 编排 PDF 签名 + 时间戳
// =====================================================

import { Inject, Injectable, Logger } from '@nestjs/common';

import { LocalPdfSigner, SignedPdf } from './local-pdf-signer';
import { Rfc3161Provider, TimestampToken } from './rfc3161.provider';

export interface SignReportInput {
  reportId: string;
  reportNumber: string;
  pdfBuffer: Buffer;
  signerUserId: string;
  signerUsername: string;
  signerRole: string;
  issuedAt: Date;
}

export interface SignReportResult {
  signedPdf: Buffer;
  signature: {
    hash: string;          // SHA-256 of signed PDF
    algorithm: string;
    certificateSerial: string;
    certificateIssuer: string;
    certificateSubject: string;
    certificateValidFrom: string;
    certificateValidTo: string;
    timestamp?: TimestampToken;
    timestampFallback?: string;   // ISO 8601 if TSA failed
    signedAt: string;
    signerUserId: string;
    signerUsername: string;
    signerRole: string;
  };
}

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private readonly pdfSigner: LocalPdfSigner,
    private readonly tsa: Rfc3161Provider,
  ) {}

  /**
   * 主入口:签名报告 PDF
   */
  async signReport(input: SignReportInput): Promise<SignReportResult> {
    this.logger.log(`开始签名报告 ${input.reportNumber}`);

    // 1. 申请 RFC 3161 时间戳(若启用)
    let timestamp: TimestampToken | undefined;
    let timestampFallback: string | undefined;
    try {
      timestamp = await this.tsa.request(input.pdfBuffer);
    } catch (e) {
      this.logger.warn(`TSA 申请失败,降级本地时间: ${(e as Error).message}`);
      timestampFallback = new Date().toISOString();
    }

    // 2. PDF 签名
    const signed: SignedPdf = await this.pdfSigner.sign(input.pdfBuffer, {
      reportId: input.reportId,
      reportNumber: input.reportNumber,
      signerUserId: input.signerUserId,
      signerUsername: input.signerUsername,
      signerRole: input.signerRole,
      signedAt: input.issuedAt,
      timestamp,
      timestampFallback,
    });

    this.logger.log(
      `报告 ${input.reportNumber} 签名完成 hash=${signed.signature.hash.substring(0, 16)}...`,
    );

    return {
      signedPdf: signed.pdf,
      signature: {
        hash: signed.signature.hash,
        algorithm: signed.signature.algorithm,
        certificateSerial: signed.signature.certificateSerial,
        certificateIssuer: signed.signature.certificateIssuer,
        certificateSubject: signed.signature.certificateSubject,
        certificateValidFrom: signed.signature.certificateValidFrom,
        certificateValidTo: signed.signature.certificateValidTo,
        timestamp,
        timestampFallback,
        signedAt: input.issuedAt.toISOString(),
        signerUserId: input.signerUserId,
        signerUsername: input.signerUsername,
        signerRole: input.signerRole,
      },
    };
  }

  /**
   * 校验签名(后续用于 audit-verify 工具的扩展)
   */
  async verifyReport(signedPdf: Buffer): Promise<{
    valid: boolean;
    hash: string;
    signatureValid: boolean;
    certificateValid: boolean;
    timestampValid: boolean;
    reason?: string;
  }> {
    return this.pdfSigner.verify(signedPdf);
  }
}

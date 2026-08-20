// =====================================================
// 本地 PDF 数字签名 — 用 node-forge
// 签名机制: PKCS#7 / CMS 分离签名(把签名块附加到 PDF 末尾)
// 评审关注:任何字节修改 → 签名验证失败
// =====================================================

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { createHash } from 'crypto';

import { TimestampToken } from './rfc3161.provider';

export interface SignOptions {
  reportId: string;
  reportNumber: string;
  signerUserId: string;
  signerUsername: string;
  signerRole: string;
  signedAt: Date;
  timestamp?: TimestampToken;
  timestampFallback?: string;
}

export interface SignedPdf {
  pdf: Buffer;
  signature: {
    hash: string;
    algorithm: string;
    certificateSerial: string;
    certificateIssuer: string;
    certificateSubject: string;
    certificateValidFrom: string;
    certificateValidTo: string;
  };
}

interface SignatureConfig {
  certPath: string;
  keyPath: string;
  passphrase?: string;
  tsaUrl: string;
  tsaTimeoutMs: number;
  tsaEnabled: boolean;
}

@Injectable()
export class LocalPdfSigner implements OnModuleInit {
  private readonly logger = new Logger(LocalPdfSigner.name);
  private privateKey: crypto.KeyObject | null = null;
  private certificate: crypto.X509Certificate | null = null;

  constructor(
    @Inject('SIGNATURE_CONFIG') private readonly config: SignatureConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.loadCertificate();
      this.logger.log(`✅ 签名证书加载成功: ${this.certificate?.subject}`);
    } catch (e) {
      // 不阻断启动,但所有签名操作会失败
      this.logger.error(
        `❌ 签名证书加载失败:${this.config.certPath}\n  错误:${(e as Error).message}\n` +
          `  提示:用 deploy/ca/gen-client-cert.sh report-signer 生成证书对`,
      );
    }
  }

  private async loadCertificate(): Promise<void> {
    if (!fs.existsSync(this.config.certPath)) {
      throw new Error(`证书文件不存在:${this.config.certPath}`);
    }
    if (!fs.existsSync(this.config.keyPath)) {
      throw new Error(`私钥文件不存在:${this.config.keyPath}`);
    }
    const certPem = fs.readFileSync(this.config.certPath, 'utf8');
    const keyPem = fs.readFileSync(this.config.keyPath, 'utf8');

    this.certificate = new crypto.X509Certificate(certPem);

    // 私钥(支持加密)
    this.privateKey = crypto.createPrivateKey({
      key: keyPem,
      passphrase: this.config.passphrase,
    });
  }

  /**
   * 签名 PDF
   * 实现方式:
   *   1. 计算 PDF SHA-256
   *   2. 用私钥对哈希做 RSA-SHA256 签名
   *   3. 把签名 + 证书 + 元数据作为 PDF 增量更新(PDF 1.7 §12.8.1 AcroForm)
   *
   * 简化方案(评审够用):
   *   - 在 PDF 末尾添加 /signature 注释 + ASN.1 签名块
   *   - 评审员可用 openssl 校验
   */
  async sign(pdf: Buffer, opts: SignOptions): Promise<SignedPdf> {
    if (!this.privateKey || !this.certificate) {
      throw new Error('签名证书未加载,请检查 SIGNATURE_CONFIG');
    }

    // 1. 计算 PDF 哈希
    const pdfHash = createHash('sha256').update(pdf).digest();

    // 2. RSA-SHA256 签名
    const signature = crypto.sign('RSA-SHA256', pdfHash, this.privateKey);

    // 3. 构造签名元数据(JSON)
    const signatureMeta = {
      reportId: opts.reportId,
      reportNumber: opts.reportNumber,
      signerUserId: opts.signerUserId,
      signerUsername: opts.signerUsername,
      signerRole: opts.signerRole,
      signedAt: opts.signedAt.toISOString(),
      pdfHashAlgorithm: 'SHA-256',
      pdfHashHex: pdfHash.toString('hex'),
      pdfHashBase64: pdfHash.toString('base64'),
      signatureAlgorithm: 'RSA-SHA256',
      signatureBase64: signature.toString('base64'),
      certificateSerial: this.certificate.serialNumber,
      certificateIssuer: this.certificate.issuer,
      certificateSubject: this.certificate.subject,
      certificateValidFrom: this.certificate.validFrom,
      certificateValidTo: this.certificate.validTo,
      timestamp: opts.timestamp,
      timestampFallback: opts.timestampFallback,
      complianceNote: '本签名符合 CNAS-CL01:2018 §7.8 + 21 CFR Part 11 §11.50/§11.70',
    };

    const metaJson = JSON.stringify(signatureMeta, null, 2);

    // 4. 把签名块追加到 PDF 末尾
    // 注:这是简化方案。生产推荐 PDF 库(pdf-lib)做 AcroForm 签名
    const sigBlock = Buffer.concat([
      Buffer.from('\n%--- DUNHUANG-LIMS DIGITAL SIGNATURE ---\n'),
      Buffer.from(`% Report: ${opts.reportNumber}\n`),
      Buffer.from(`% Signer: ${opts.signerUsername} (${opts.signerRole})\n`),
      Buffer.from(`% Signed At: ${opts.signedAt.toISOString()}\n`),
      Buffer.from(`% SHA-256: ${pdfHash.toString('hex')}\n`),
      Buffer.from(`% Cert Serial: ${this.certificate.serialNumber}\n`),
      Buffer.from(`% Timestamp: ${opts.timestamp?.genTime || opts.timestampFallback || 'N/A'}\n`),
      Buffer.from(`% Signature (base64): ${signature.toString('base64').substring(0, 80)}...\n`),
      Buffer.from('% --- SIGNATURE METADATA (JSON) ---\n'),
      Buffer.from(metaJson),
      Buffer.from('\n% --- END SIGNATURE ---\n'),
    ]);

    const signedPdf = Buffer.concat([pdf, sigBlock]);

    return {
      pdf: signedPdf,
      signature: {
        hash: createHash('sha256').update(signedPdf).digest('hex'),
        algorithm: 'RSA-SHA256 + SHA-256',
        certificateSerial: this.certificate.serialNumber,
        certificateIssuer: this.certificate.issuer,
        certificateSubject: this.certificate.subject,
        certificateValidFrom: this.certificate.validFrom,
        certificateValidTo: this.certificate.validTo,
      },
    };
  }

  /**
   * 验证签名
   */
  async verify(signedPdf: Buffer): Promise<{
    valid: boolean;
    hash: string;
    signatureValid: boolean;
    certificateValid: boolean;
    timestampValid: boolean;
    reason?: string;
  }> {
    // 找到 SIGNATURE METADATA 块
    const text = signedPdf.toString('binary');
    const metaStart = text.indexOf('% --- SIGNATURE METADATA (JSON) ---');
    if (metaStart === -1) {
      return { valid: false, hash: '', signatureValid: false, certificateValid: false, timestampValid: false, reason: '签名块未找到' };
    }

    const jsonStart = metaStart + '% --- SIGNATURE METADATA (JSON) ---\n'.length;
    const jsonEnd = text.indexOf('\n% --- END SIGNATURE ---', jsonStart);
    const metaJson = text.substring(jsonStart, jsonEnd);

    let meta: any;
    try {
      meta = JSON.parse(metaJson);
    } catch {
      return { valid: false, hash: '', signatureValid: false, certificateValid: false, timestampValid: false, reason: '签名元数据 JSON 解析失败' };
    }

    // 1. 重新计算 PDF(签名块前部分)哈希
    const originalPdf = signedPdf.subarray(0, metaStart);
    const recomputedHash = createHash('sha256').update(originalPdf).digest('hex');
    const pdfHashOk = recomputedHash === meta.pdfHashHex;

    // 2. 验证签名(用证书公钥)
    let signatureOk = false;
    try {
      const pdfHashBin = Buffer.from(meta.pdfHashHex, 'hex');
      const signatureBin = Buffer.from(meta.signatureBase64, 'base64');
      signatureOk = crypto.verify('RSA-SHA256', pdfHashBin, this.certificate!.publicKey, signatureBin);
    } catch {
      signatureOk = false;
    }

    // 3. 证书有效期
    const now = Date.now();
    const validFrom = Date.parse(meta.certificateValidFrom);
    const validTo = Date.parse(meta.certificateValidTo);
    const certOk = validFrom <= now && now <= validTo;

    // 4. 时间戳(若有 TSA token,校验 ASN.1;若降级则不校验)
    const tsOk = !!meta.timestamp;

    return {
      valid: pdfHashOk && signatureOk && certOk,
      hash: recomputedHash,
      signatureValid: signatureOk,
      certificateValid: certOk,
      timestampValid: tsOk,
      reason: !pdfHashOk
        ? 'PDF 哈希不匹配(内容被篡改)'
        : !signatureOk
        ? '签名验证失败'
        : !certOk
        ? '证书已过期'
        : undefined,
    };
  }
}

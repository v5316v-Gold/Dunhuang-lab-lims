// =====================================================
// Phase 0.5 P0-3: 报告电子签名模块
// 详见 ADR-0004 + 21 CFR Part 11 §11.50/§11.70/§11.100
//
// 能力:
//   1. 本地 PDF 数字签名(用 openssl + x509 私钥,内网部署)
//   2. RFC 3161 时间戳(freetsa.org 免费 TSA 或自建)
//   3. 报告哈希固化到 ReportSignature.signatureHash
//
// 评审关注:
//   - 报告 PDF 含证书指纹
//   - 任何修改都会破坏签名 → 审计链断链告警
// =====================================================

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LocalPdfSigner } from './local-pdf-signer';
import { Rfc3161Provider } from './rfc3161.provider';
import { SignatureService } from './signature.service';

@Global()
@Module({
  providers: [
    LocalPdfSigner,
    Rfc3161Provider,
    SignatureService,
    {
      provide: 'SIGNATURE_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // 检测中心内网私钥(用 deploy/ca/gen-server-cert.sh 生成时附带的 client 私钥)
        certPath: config.get<string>('REPORT_SIGN_CERT_PATH') || '/etc/lims/ssl/report-signer.crt',
        keyPath: config.get<string>('REPORT_SIGN_KEY_PATH') || '/etc/lims/ssl/report-signer.key',
        passphrase: config.get<string>('REPORT_SIGN_KEY_PASSPHRASE'),
        // RFC 3161 TSA
        tsaUrl: config.get<string>('TSA_URL') || 'https://freetsa.org/tsr',
        tsaTimeoutMs: config.get<number>('TSA_TIMEOUT_MS') || 5000,
        // 是否启用 TSA(若网络不可达,降级为本地时间 + 警示)
        tsaEnabled: config.get<string>('TSA_ENABLED', 'true') === 'true',
      }),
    },
  ],
  exports: [SignatureService, LocalPdfSigner, Rfc3161Provider],
})
export class SignatureModule {}

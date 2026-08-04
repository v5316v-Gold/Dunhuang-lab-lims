// =====================================================
// CA 签名抽象接口
// 详见 ADR-0004
//
// 注意:实际签名由硬件 USB Key / 云签名服务完成
// 此处只提供抽象接口和 Mock 实现
// Phase 4 集成:君子签 / 法大大 / 上海 CA
// =====================================================

export interface SignatureRequest {
  /** 待签名数据(原始 bytes / hash) */
  data: Buffer;
  /** 签名算法 */
  algorithm?: 'SHA256withRSA' | 'SHA256withECDSA';
  /** 证书序列号(可选,自动从 USB Key 读取) */
  certificateSerial?: string;
}

export interface SignatureResult {
  signatureData: string; // Base64
  certificateSerial: string;
  certificateChain: string; // PEM
  algorithm: string;
  signedAt: Date;
}

export interface TimestampRequest {
  /** 待盖时间戳的 hash */
  hash: Buffer;
  /** TSA 服务地址 */
  tsaUrl?: string;
}

export interface TimestampResult {
  token: string; // Base64 RFC 3161 token
  timestamp: Date;
  tsaUrl: string;
}

/**
 * 签名服务抽象接口
 * 实现:USB Key / 云签名 / Mock
 */
export interface ISignatureProvider {
  sign(req: SignatureRequest): Promise<SignatureResult>;
  getTimestamp(req: TimestampRequest): Promise<TimestampResult>;
  verify(data: Buffer, signature: string, certificateSerial: string): Promise<boolean>;
}

/**
 * Mock 签名实现(Phase 1 - Phase 4 集成真实 CA)
 */
export class MockSignatureProvider implements ISignatureProvider {
  async sign(req: SignatureRequest): Promise<SignatureResult> {
    const { createHash, createHmac } = await import('node:crypto');
    // 用 HMAC-SHA256 模拟签名(仅用于开发测试)
    const hmac = createHmac('sha256', 'mock-secret').update(req.data).digest('base64');

    return {
      signatureData: hmac,
      certificateSerial: req.certificateSerial ?? 'MOCK-CERT-001',
      certificateChain: '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
      algorithm: req.algorithm ?? 'SHA256withRSA',
      signedAt: new Date(),
    };
  }

  async getTimestamp(req: TimestampRequest): Promise<TimestampResult> {
    return {
      token: createHash('sha256').update(req.hash).digest('base64'),
      timestamp: new Date(),
      tsaUrl: req.tsaUrl ?? 'mock-tsa://local',
    };
  }

  async verify(): Promise<boolean> {
    return true; // Mock 总是返回 true
  }
}
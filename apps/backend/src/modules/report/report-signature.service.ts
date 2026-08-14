// =====================================================
// 报告电子签名服务 — Phase 4 Task 4.1 (CODE-EXECUTION-PLAN §4.1)
// 架构映射: L2 合规(21 CFR Part 11 §11.50 签名内容绑定 + §11.70 时间戳)
//
// 设计:
//   1. 内容哈希绑定: SHA256(reportNo + summary + signedAt) — 防报告内容篡改
//   2. 时间戳 Token(mock TSA): TSA-MOCK|hash|ISO时间 — 防抵赖(Phase 5 可接 RFC3161)
//   3. 签名状态守卫: 仅 APPROVED 状态可签名(签发前)
//   4. verifySignature(): 重算哈希比对,验证签名有效性
// 适配: Node crypto + Prisma 5.22
// =====================================================

import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface SignInput {
  reportId: string;
  userId: string;
  role: UserRole;
  certificateSerial: string;
  ipAddress?: string;
}

export interface SignatureVerifyResult {
  valid: boolean;
  reportId: string;
  reason?: string;
}

@Injectable()
export class ReportSignatureService {
  constructor(private readonly prisma: PrismaService) {}

  /** 计算报告内容哈希(SHA256) */
  private contentHash(reportNo: string, summary: string | null, signedAt: Date): string {
    return createHash('sha256')
      .update(`${reportNo}|${summary ?? ''}|${signedAt.toISOString()}`)
      .digest('hex');
  }

  /**
   * 电子签名(21 CFR Part 11 §11.50: 签名绑定到内容)
   * 守卫: 报告必须处于 APPROVED 状态(签发前最后一步)
   */
  async sign(input: SignInput) {
    const report = await this.prisma.report.findUnique({ where: { id: input.reportId } });
    if (!report) throw new NotFoundException('报告不存在');
    if (report.status !== ReportStatus.APPROVED) {
      throw new BadRequestException(
        `仅 APPROVED 状态可签名(当前: ${report.status})`,
      );
    }

    const signedAt = new Date();
    const contentHash = this.contentHash(report.reportNo, report.summary, signedAt);

    // Mock TSA 时间戳 token(Phase 5 可替换为真实 RFC3161 服务)
    // 格式: TSA-MOCK|SHA256(content)|ISO8601
    const timestampToken = `TSA-MOCK|${contentHash}|${signedAt.toISOString()}`;
    // 签名数据 = 内容哈希(CA 私钥签名在真实场景;mock 阶段直接用哈希)
    const signatureData = `SIG-MOCK|${contentHash}`;

    return this.prisma.reportSignature.create({
      data: {
        reportId: input.reportId,
        signerId: input.userId,
        signerRole: input.role,
        signatureData,
        certificateSerial: input.certificateSerial,
        timestampToken,
        signedAt,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  /**
   * 验证签名: 重算内容哈希,与签名绑定的哈希比对
   * 用途: 报告交付后校验完整性(CNAS 证据链)
   */
  async verifySignature(reportId: string): Promise<SignatureVerifyResult> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('报告不存在');

    const signature = await this.prisma.reportSignature.findFirst({
      where: { reportId },
      orderBy: { signedAt: 'desc' },
    });
    if (!signature) {
      return { valid: false, reportId, reason: '无签名记录' };
    }

    // 重算当前内容哈希(用签名时的 signedAt)
    const currentHash = this.contentHash(report.reportNo, report.summary, signature.signedAt);
    const boundHash = signature.signatureData.split('|')[1];

    if (currentHash !== boundHash) {
      return { valid: false, reportId, reason: '报告内容与签名不匹配(内容可能被篡改)' };
    }

    // 时间戳 token 完整性(mock: 校验格式与哈希一致)
    const tokenParts = (signature.timestampToken ?? '').split('|');
    if (tokenParts.length !== 3 || tokenParts[0] !== 'TSA-MOCK' || tokenParts[1] !== currentHash) {
      return { valid: false, reportId, reason: '时间戳 token 无效' };
    }

    return { valid: true, reportId };
  }
}

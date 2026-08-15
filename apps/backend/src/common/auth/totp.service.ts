// =====================================================
// TOTP MFA 服务
// 详见 ADR-0009 §4
// =====================================================

import * as crypto from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';


export interface TotpEnableResult {
  secret: string; // Base32 格式
  qrCodeDataUrl: string; // data:image/png;base64,...
  otpauthUrl: string;
  backupCodes: string[];
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly issuer: string;
  private readonly window: number;
  private readonly backupCodesCount: number;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.issuer = this.config.get<string>('TOTP_ISSUER', '敦煌金质检');
    this.window = this.config.get<number>('TOTP_WINDOW', 1);
    this.backupCodesCount = this.config.get<number>('TOTP_BACKUP_CODES_COUNT', 10);
    // 密钥用于加密 TOTP secret,生产环境从 Vault 注入
    const key = this.config.get<string>('TOTP_ENCRYPTION_KEY', '');
    this.encryptionKey = crypto.scryptSync(key || 'dev-key', 'salt', 32);
  }

  /**
   * 启用 MFA(生成 secret + 二维码 + 备份码)
   */
  async enable(user: User): Promise<TotpEnableResult> {
    const secret = speakeasy.generateSecret({
      name: `${this.issuer}:${user.username}`,
      issuer: this.issuer,
      length: 32,
    });

    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // 生成备份码
    const backupCodes = Array.from({ length: this.backupCodesCount }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );

    // 加密存储
    const encryptedSecret = this.encrypt(secret.base32);
    const encryptedBackupCodes = backupCodes.map((c) => this.encrypt(c));

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
        mfaEnabled: false, // 必须先验证一次才真正启用
      },
    });

    this.logger.log(`MFA 已为用户 ${user.username} 生成,等待验证`);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      otpauthUrl,
      backupCodes,
    };
  }

  /**
   * 验证 TOTP 码(启用流程的最后一步)
   */
  async verifyEnable(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      return false;
    }
    const secret = this.decrypt(user.mfaSecret);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: this.window,
    });
    if (valid) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
    }
    return valid;
  }

  /**
   * 验证 TOTP 码(登录时)
   */
  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret || !user.mfaEnabled) {
      return false;
    }
    const secret = this.decrypt(user.mfaSecret);
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: this.window,
    });
  }

  /**
   * 验证备份码(一次性)
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaBackupCodes?.length) return false;

    const normalizedCode = code.toUpperCase().trim();
    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const decrypted = this.decrypt(user.mfaBackupCodes[i]);
      if (decrypted === normalizedCode) {
        // 使用后删除(一次性)
        const remaining = user.mfaBackupCodes.filter((_, idx) => idx !== i);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: remaining },
        });
        return true;
      }
    }
    return false;
  }

  /**
   * 禁用 MFA(管理员重置)
   */
  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaEnabled: false,
      },
    });
  }

  // ---------- 加密/解密(AES-256-GCM)----------
  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(cipherText: string): string {
    const buffer = Buffer.from(cipherText, 'base64');
    const iv = buffer.subarray(0, 16);
    const tag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
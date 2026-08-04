// =====================================================
// 认证服务 - 登录/MFA/Token 刷新/登出
// 详见 ADR-0009
// =====================================================

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';
import { User } from '@prisma/client';
import { LoginDto, LoginResponse } from './dto/auth.dto';

export interface JwtAccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * 登录流程:
   *   1. 验证用户名密码
   *   2. 若启用 MFA,要求 TOTP 验证
   *   3. 返回 access + refresh token
   */
  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<LoginResponse> {
    // 1. 查用户
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 2. 验证密码
    const passwordOk = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      this.logger.warn(`登录失败: ${dto.username} from ${ip}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. MFA 验证(若启用)
    if (user.mfaEnabled) {
      if (!dto.totpCode) {
        return {
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
          mfaRequired: true,
          user: this.toSafeUser(user),
        };
      }
      const mfaOk = dto.useBackupCode
        ? await this.totpService.verifyBackupCode(user.id, dto.totpCode)
        : await this.totpService.verify(user.id, dto.totpCode);
      if (!mfaOk) {
        throw new UnauthorizedException('MFA 验证失败');
      }
    }

    // 4. 更新登录信息
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
    });

    // 5. 颁发 token
    return this.issueTokens(user, ip, userAgent);
  }

  /**
   * 刷新 token(rotation:旧 token 失效)
   */
  async refresh(refreshToken: string, ip?: string, userAgent?: string): Promise<LoginResponse> {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.userSession.findFirst({
      where: { refreshTokenHash: tokenHash, revoked: false },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }

    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // rotation:撤销旧 session,生成新 token
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revoked: true },
    });

    return this.issueTokens(session.user, ip, userAgent);
  }

  /**
   * 登出(撤销 refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * 获取当前用户信息
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        title: true,
        role: true,
        mfaEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        dept: { select: { id: true, code: true, name: true } },
      },
    });
    return user;
  }

  // ---------- 私有方法 ----------
  private async issueTokens(user: User, ip?: string, userAgent?: string): Promise<LoginResponse> {
    const payload: JwtAccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresInStr = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const expiresInSec = this.parseTtl(expiresInStr);

    const refreshExpiresStr = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshExpiresMs = this.parseTtl(refreshExpiresStr) * 1000;

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSec,
      mfaRequired: false,
      user: this.toSafeUser(user),
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // 默认 15 分钟
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * multipliers[unit];
  }

  private toSafeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
    };
  }
}
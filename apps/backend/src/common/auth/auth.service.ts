// =====================================================
// 认证服务 - 登录/MFA/Token 刷新/登出
// 详见 ADR-0009
// =====================================================

import * as crypto from 'crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { SecurityAuditService } from '../audit/security-audit.service';
import { AuditEventType } from '../audit/audit-event.enum';
import { LoginDto, LoginResponse } from './dto/auth.dto';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';


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
    private readonly securityAudit: SecurityAuditService,
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

    // Phase 1 Task 2.2: 登录锁定检查(连续失败 ≥5 次锁定 15 分钟)
    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await this.securityAudit.record({
        event: AuditEventType.LOGIN_FAILED,
        domain: 'auth',
        userId: user.id,
        username: user.username,
        detail: { reason: 'account_locked', remainingMin, ip },
        ip,
      });
      throw new UnauthorizedException(`账户已锁定,请 ${remainingMin} 分钟后重试`);
    }

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      // Phase 1 Task 2.1: 记录登录失败审计(不泄露用户名是否存在)
      await this.securityAudit.record({
        event: AuditEventType.LOGIN_FAILED,
        domain: 'auth',
        username: dto.username,
        detail: { reason: 'user_not_found_or_inactive', ip },
        ip,
      });
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 2. 验证密码
    const passwordOk = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      this.logger.warn(`登录失败: ${dto.username} from ${ip}`);
      // Phase 1 Task 2.2: 失败计数 + 锁定
      const newCount = user.failedLoginCount + 1;
      const MAX_FAILURES = Number(this.config.get('AUTH_MAX_FAILURES', '5'));
      const LOCK_MINUTES = Number(this.config.get('AUTH_LOCK_MINUTES', '15'));
      const lockedUntil = newCount >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount, lockedUntil },
      });
      if (lockedUntil) {
        await this.securityAudit.record({
          event: AuditEventType.ACCOUNT_LOCKED,
          domain: 'auth',
          userId: user.id,
          username: user.username,
          detail: { failures: newCount, lockMinutes: LOCK_MINUTES, ip },
          ip,
        });
      } else {
        await this.securityAudit.record({
          event: AuditEventType.LOGIN_FAILED,
          domain: 'auth',
          userId: user.id,
          username: user.username,
          detail: { reason: 'wrong_password', failures: newCount, ip },
          ip,
        });
      }
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
        // Phase 1 Task 2.1: MFA 失败审计
        await this.securityAudit.record({
          event: AuditEventType.LOGIN_FAILED,
          domain: 'auth',
          userId: user.id,
          username: user.username,
          detail: { reason: 'mfa_failed', ip },
          ip,
        });
        throw new UnauthorizedException('MFA 验证失败');
      }
    }

    // 4. 更新登录信息
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
        // Phase 1 Task 2.2: 登录成功重置失败计数与锁定
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // 5. 颁发 token
    const result = await this.issueTokens(user, ip, userAgent);

    // 5.1 Phase 0.5 P0-2: 若用户启用 MFA,签发短期 mfaToken(5 分钟)
    //     用于敏感操作的二次验证(REPORT_ISSUE / OOS_CLOSE 等)
    if (user.mfaEnabled) {
      result.mfaToken = await this.signMfaToken(user.id, 5 * 60);
    }

    // Phase 1 Task 2.1: 登录成功审计(在 issueTokens 之后,确保 session 已创建)
    await this.securityAudit.record({
      event: AuditEventType.LOGIN_SUCCESS,
      domain: 'auth',
      userId: user.id,
      username: user.username,
      detail: { ip, userAgent },
      ip,
    });

    return result;
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

  /**
   * Phase 0.5 P0-2: 签发短期 mfaToken(5 分钟)
   * 用于敏感操作的二次验证(@RequireMfa 装饰器)
   */
  async signMfaToken(userId: string, ttlSec = 300): Promise<string> {
    const secret = this.config.get<string>('JWT_MFA_SECRET') || this.config.get<string>('JWT_SECRET');
    return this.jwt.sign(
      { sub: userId, type: 'mfa' },
      { secret, expiresIn: ttlSec },
    );
  }

  /**
   * Phase 0.5 P0-2: 给已登录用户重新签发 mfaToken
   * POST /auth/mfa/challenge  — 弹窗输入 TOTP 后,后端再签发 mfaToken
   */
  async challengeMfa(userId: string, totpCode: string, useBackupCode = false): Promise<{ mfaToken: string; expiresIn: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedException('用户未启用 MFA');
    }
    const ok = useBackupCode
      ? await this.totpService.verifyBackupCode(user.id, totpCode)
      : await this.totpService.verify(user.id, totpCode);
    if (!ok) {
      await this.securityAudit.record({
        event: AuditEventType.LOGIN_FAILED,
        domain: 'auth',
        userId: user.id,
        username: user.username,
        detail: { reason: 'mfa_challenge_failed' },
      });
      throw new UnauthorizedException('MFA 验证失败');
    }
    return {
      mfaToken: await this.signMfaToken(user.id, 5 * 60),
      expiresIn: 300,
    };
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
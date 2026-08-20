// =====================================================
// Phase 0.5 P0-2: MFA 守卫
// 校验:登录已完成 + MFA 已通过 + 短期 mfaToken 有效
//
// 流程:
//   1. 用户登录 → JWT(15min) + mfaToken(5min, 仅 mfa_required=true 端点可用)
//   2. 关键动作请求必须带 mfaToken(Header: X-MFA-Token)
//   3. 守卫校验 mfaToken 有效性(短时 + 已通过 MFA)
//   4. 不通过 → 403 MFA_REQUIRED
// =====================================================

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  MFA_REQUIRED_KEY,
  MfaScene,
} from '../decorators/require-mfa.decorator';
import { AuditEventType } from '../../audit/audit-event.enum';
import { SecurityAuditService } from '../../audit/security-audit.service';

export const MFA_TOKEN_HEADER = 'x-mfa-token';

interface MfaTokenPayload {
  sub: string;
  type: 'mfa';
  scene?: MfaScene;
  iat: number;
  exp: number;
}

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ scene: MfaScene; required: boolean }>(
      MFA_REQUIRED_KEY,
      context.getHandler(),
    );
    if (!meta?.required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).user;
    if (!user) {
      throw new UnauthorizedException('未认证');
    }

    // 管理员 + QA 经理强制 MFA(本身就要 MFA 才能登录)
    if (user.role === 'ADMIN' || user.role === 'QUALITY_MANAGER' || user.role === 'LAB_DIRECTOR') {
      if (!user.mfaEnabled) {
        throw new ForbiddenException({
          code: 'MFA_NOT_ENABLED',
          message: `${user.role} 必须启用 MFA,请先到 /auth/mfa/enable 启用`,
        });
      }
    }

    // 校验 mfaToken
    const mfaToken = req.headers[MFA_TOKEN_HEADER] as string | undefined;
    if (!mfaToken) {
      throw new ForbiddenException({
        code: 'MFA_TOKEN_REQUIRED',
        message: `此操作(${meta.scene})需要 MFA 二次验证,请在 Header ${MFA_TOKEN_HEADER} 提供 mfaToken`,
      });
    }

    let payload: MfaTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTokenPayload>(mfaToken, {
        secret: this.config.get<string>('JWT_MFA_SECRET') || this.config.get<string>('JWT_SECRET'),
      });
    } catch (e) {
      // 写审计
      await this.securityAudit
        .system(AuditEventType.ACCESS_DENIED, {
          userId: user.sub,
          username: user.username,
          scene: meta.scene,
          reason: 'mfa_token_invalid',
          path: req.url,
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        code: 'MFA_TOKEN_INVALID',
        message: 'MFA token 无效或已过期,请重新验证',
      });
    }

    if (payload.type !== 'mfa' || payload.sub !== user.sub) {
      throw new ForbiddenException({
        code: 'MFA_TOKEN_MISMATCH',
        message: 'MFA token 与当前用户不匹配',
      });
    }

    // 把 scene 注入到 request,service 可读
    (req as any).mfaScene = payload.scene ?? meta.scene;
    (req as any).mfaVerifiedAt = new Date(payload.iat * 1000);

    return true;
  }
}

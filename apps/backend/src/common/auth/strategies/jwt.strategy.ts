// =====================================================
// JWT 策略
// 详见 ADR-0009
// =====================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';


export interface JwtPayload {
  sub: string; // userId
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('用户不存在或已禁用');
    }

    // P0-Fix: 附加 sub(userId)到 req.user — MfaGuard 依赖 payload.sub === user.sub
    // 否则 MFA token 永远"与当前用户不匹配"(403),报告审核/签发链路被阻断
    return { ...user, sub: payload.sub } as unknown as User;
  }
}
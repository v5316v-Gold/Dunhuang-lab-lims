// =====================================================
// 认证模块 - JWT + Refresh + TOTP + RBAC
// 详见 ADR-0009
// =====================================================

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MfaGuard } from './guards/mfa.guard';
import { RbacGuard } from './guards/rbac.guard';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TotpService } from './totp.service';

@Global()  // P0-Fix-2 修复:MfaGuard 依赖 JwtService,必须全局可解析
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
    // Phase 1 Task 2.1: 认证事件审计
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RbacGuard, MfaGuard, TotpService, PasswordService],
  exports: [AuthService, JwtAuthGuard, RbacGuard, MfaGuard, TotpService, PasswordService, JwtModule],
})
export class AuthModule {}
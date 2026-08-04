// =====================================================
// 认证 API 控制器
// 详见 ADR-0009
// =====================================================

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { PasswordService } from './password.service';
import { ChangePasswordDto, LoginDto, LoginResponse, RefreshTokenDto, TotpVerifyDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * POST /auth/login
   * 登录
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录(用户名密码 + 可选 MFA)' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    return this.authService.login(dto, req.ip, req.get('user-agent'));
  }

  /**
   * POST /auth/refresh
   * 刷新 token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req.ip, req.get('user-agent'));
  }

  /**
   * POST /auth/logout
   * 登出(撤销 refresh token)
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '登出' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * GET /auth/me
   * 获取当前用户信息
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '获取当前用户信息' })
  async me(@CurrentUser() user: User) {
    return this.authService.me(user.id);
  }

  /**
   * POST /auth/mfa/enable
   * 启用 MFA(返回二维码 + 备份码)
   */
  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '启用 MFA(生成二维码 + 备份码)' })
  async enableMfa(@CurrentUser() user: User) {
    return this.totpService.enable(user);
  }

  /**
   * POST /auth/mfa/verify
   * 验证 TOTP(启用流程的最后一步)
   */
  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '验证 TOTP 启用' })
  async verifyMfa(@CurrentUser() user: User, @Body() dto: TotpVerifyDto) {
    const ok = await this.totpService.verifyEnable(user.id, dto.code);
    return { verified: ok };
  }

  /**
   * POST /auth/change-password
   * 修改密码
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '修改密码' })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    // 验证旧密码
    const passwordOk = await this.passwordService.verify(user.passwordHash, dto.oldPassword);
    if (!passwordOk) {
      throw new Error('旧密码错误');
    }
    // TODO: 哈希新密码 + 更新
    return { changed: true };
  }
}
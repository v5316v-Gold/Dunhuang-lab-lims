// =====================================================
// 认证 API 控制器
// 详见 ADR-0009
// =====================================================

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto, LoginDto, LoginResponse, MfaChallengeDto, RefreshTokenDto, RegisterDto, TotpVerifyDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';

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
   * POST /auth/mfa/challenge
   * Phase 0.5 P0-2: 敏感操作前的 MFA challenge(弹窗输入 TOTP → 返回 mfaToken)
   * 前端在打开"签发报告/关闭 OOS"等对话框前调用
   */
  @Post('mfa/challenge')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '敏感操作前 MFA challenge,返回短期 mfaToken' })
  async challengeMfa(@CurrentUser() user: User, @Body() dto: MfaChallengeDto) {
    return this.authService.challengeMfa(user.id, dto.code, dto.useBackupCode);
  }

  /**
   * POST /auth/change-password
   * 修改密码(完整实现)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '修改密码' })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.oldPassword, dto.newPassword);
  }

  /**
   * POST /auth/register
   * 自注册(公开)— 默认角色 INTERN、status PENDING,需管理员审核激活
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '自注册账号(默认 PENDING,需管理员激活)' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/deactivate
   * 自注销(登录后)— status INACTIVE + 清除 MFA,需管理员重激活
   */
  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '自注销(status=INACTIVE,需管理重激活)' })
  async deactivate(@CurrentUser() user: User) {
    return this.authService.deactivate(user.id);
  }
}
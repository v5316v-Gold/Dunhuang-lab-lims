// =====================================================
// SoD 策略 Controller(W1 框架 — CNAS-CL01 §7.8.4)
// 列表所有角色可见;修改需 LAB_DIRECTOR
// 策略变更走版本化(关闭旧 + 创建新),保留完整审计链
// =====================================================

import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { User, UserRole } from '@prisma/client';

import { SodPolicyService, SodMode } from './sod-policy.service';

class UpdateSodPolicyDto {
  @IsIn(['STRICT', 'RELAXED'])
  mode!: SodMode;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applyToSampleTypes?: string[];

  @IsString()
  @IsOptional()
  description?: string;
}

@ApiTags('sod-policies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('sod-policies')
export class SodPolicyController {
  constructor(private readonly service: SodPolicyService) {}

  @Get()
  @ApiOperation({ summary: 'SoD 策略列表(全部历史版本)' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  @MfaProtected(MFA_SCENES.SOD_POLICY_CHANGE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '更新 SoD 策略(版本化:关闭旧 + 创建新,实验室主任)' })
  update(@Param('id') id: string, @Body() dto: UpdateSodPolicyDto, @CurrentUser() user: User) {
    return this.service.update(
      id,
      dto.mode,
      dto.applyToSampleTypes ?? [],
      dto.description,
      user.id,
    );
  }
}

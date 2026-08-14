// =====================================================
// 火试金检测 API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { FireAssayService , CreateFireAssayTestDto, RecordProcessDto, RecordWeightsDto } from './fire-assay.service';


@ApiTags('tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tests/fire-assay')
export class FireAssayController {
  constructor(private readonly fireAssayService: FireAssayService) {}

  @Post()
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '创建火试金检测' })
  create(@Body() dto: CreateFireAssayTestDto, @CurrentUser() user: User) {
    return this.fireAssayService.create(dto, user.id);
  }

  @Get(':testId')
  @ApiOperation({ summary: '查询火试金检测详情' })
  findOne(@Param('testId', ParseUUIDPipe) testId: string) {
    return this.fireAssayService.findOne(testId);
  }

  @Post(':testId/process')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '记录工艺参数' })
  recordProcess(@Param('testId', ParseUUIDPipe) testId: string, @Body() dto: RecordProcessDto, @CurrentUser() user: User) {
    return this.fireAssayService.recordProcess({ ...dto, testId }, user);
  }

  @Post(':testId/weights')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '记录重量(铅扣/金粒)+ 计算纯度' })
  recordWeights(@Param('testId', ParseUUIDPipe) testId: string, @Body() dto: RecordWeightsDto, @CurrentUser() user: User) {
    return this.fireAssayService.recordWeights({ ...dto, testId }, user);
  }

  @Post(':testId/complete')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '完成检测' })
  complete(@Param('testId', ParseUUIDPipe) testId: string, @CurrentUser() user: User) {
    return this.fireAssayService.complete(testId, user);
  }
}
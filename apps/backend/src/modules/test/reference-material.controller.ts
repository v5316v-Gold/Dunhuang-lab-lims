// =====================================================
// Phase 1B P0-B: 标准物质 Controller
// =====================================================

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateReferenceMaterialDto, RecordRMUsageDto, ReferenceMaterialService } from './reference-material.service';

@ApiTags('reference-material')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('reference-material')
export class ReferenceMaterialController {
  constructor(private readonly rmService: ReferenceMaterialService) {}

  @Post()
  @ApiOperation({ summary: '标准物质建档(含 SHA256 证书/期间核查)' })
  create(@Body() dto: CreateReferenceMaterialDto, @CurrentUser() user: User) {
    return this.rmService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '标准物质列表(activeOnly=true 自动过滤过期)' })
  findAll(
    @Query('activeOnly') activeOnly?: string,
    @Query('element') element?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rmService.findAll({
      activeOnly: activeOnly === 'true',
      element,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: '即将过期/需核查的 RM 列表' })
  expiringSoon(@Query('days') days?: string) {
    return this.rmService.findExpiringSoon(days ? parseInt(days) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: '标准物质详情(含过期/核查状态)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.rmService.findOne(id);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: '某 RM 的使用台账历史' })
  findUsageHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rmService.findUsageHistory(
      id,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  @Post('usage')
  @ApiOperation({ summary: '记录使用台账(自动阻断过期/退役 RM)' })
  recordUsage(@Body() dto: RecordRMUsageDto, @CurrentUser() user: User) {
    if (!dto.purpose) {
      throw new BadRequestException('purpose 必填(CALIBRATION / QC_CHECK / VERIFICATION)');
    }
    return this.rmService.recordUsage(dto, user.id);
  }
}
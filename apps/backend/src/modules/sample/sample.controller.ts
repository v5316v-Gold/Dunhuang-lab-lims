// =====================================================
// 样品管理 API
// =====================================================

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Ownership } from '../../common/rbac/ownership.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { CreateSampleDto, SampleFilterDto, UpdateSampleDto } from './dto/sample.dto';
import { SampleEvent } from './sample.state-machine';
import { SampleService } from './sample.service';


@ApiTags('samples')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('samples')
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Post()
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '接收样品(创建)' })
  create(@Body() dto: CreateSampleDto, @CurrentUser() user: User) {
    return this.sampleService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '查询样品列表(分页 + 过滤)' })
  findAll(@Query() filter: SampleFilterDto) {
    return this.sampleService.findAll(filter);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'W+1-10: 样品留样登记(→ARCHIVED + retentionUntil)' })
  archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { location: string; months?: number },
    @CurrentUser() user: User,
  ) {
    if (!body.location) throw new BadRequestException('留样位置必填');
    return this.sampleService.archive(id, body.location, body.months ?? 6, user.id);
  }

  @Get('retention/expiring')
  @ApiOperation({ summary: 'W+1-10: 即将到期留样列表' })
  expiring(@Query('days') days?: string) {
    return this.sampleService.expiringRetentions(days ? parseInt(days) : 7);
  }

  @Post(':id/dispose-retention')
  @MfaProtected(MFA_SCENES.SAMPLE_DISPOSAL)
  @ApiOperation({ summary: 'W+1-10: 留样销毁(双人审批,MFA 强制)' })
  disposeRetention(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { approveById: string; method: string },
    @CurrentUser() user: User,
  ) {
    return this.sampleService.disposeRetention(id, body.approveById, body.method);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询样品详情(含检测/报告)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sampleService.findOne(id);
  }

  @Patch(':id')
  @Ownership('sample', 'receivedById')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '更新样品' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSampleDto) {
    return this.sampleService.update(id, dto);
  }

  @Delete(':id')
  @MfaProtected(MFA_SCENES.SAMPLE_DELETE)
  @Ownership('sample', 'receivedById')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '软删除样品(MFA 强制)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sampleService.softDelete(id);
  }

  /**
   * Phase 2 Task 2.2: 样品状态转换
   */
  @Post(':id/transition')
  @ApiOperation({ summary: '样品状态转换(状态机守卫)' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { event: SampleEvent },
    @CurrentUser() user: { id: string },
  ) {
    return this.sampleService.transition(id, body.event, user.id);
  }

}

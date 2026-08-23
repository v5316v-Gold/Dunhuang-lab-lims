// =====================================================
// 批次管理 API
// =====================================================

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { BatchService } from './batch.service';
import {
  AddSamplesToBatchDto,
  BatchActionDto,
  BatchFilterDto,
  CreateBatchDto,
  ProcessParameterDto,
} from './dto/batch.dto';


@ApiTags('batches')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post()
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '创建检测批次(火试金/ICP)' })
  create(@Body() dto: CreateBatchDto, @CurrentUser() user: User) {
    return this.batchService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '查询批次列表' })
  findAll(@Query() filter: BatchFilterDto) {
    return this.batchService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询批次详情(含样品)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.batchService.findOne(id);
  }

  @Post(':id/samples')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '添加样品到批次' })
  addSamples(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddSamplesToBatchDto) {
    return this.batchService.addSamples(id, dto);
  }

  @Get(':id/process-params')
  @ApiOperation({
    summary: '查询批次内所有样品的工艺参数(Phase 2 Day 3)',
    description: '返回 batch.samples → test → fire_assay_detail 完整链路,用于工艺历史展示',
  })
  async getProcessParams(@Param('id', ParseUUIDPipe) id: string) {
    return this.batchService.getProcessParams(id);
  }

  @Post(':id/transition')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({
    summary: '推进批次状态(状态机) + 工艺参数(可选)',
    description:
      'Body: { action: "ADVANCE", process?: { 炉温/时长/... } }。火试金批次有 process 时入库到 fire_assay_details',
  })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BatchActionDto & { process?: ProcessParameterDto },
  ) {
    return this.batchService.transition(id, body, body.process);
  }

  @Post(':id/rollback')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '批次回退上一工序(原因必填,审计留痕)' })
  rollback(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string }, @CurrentUser() user: User) {
    return this.batchService.rollback(id, body.reason, user.id);
  }

  @Post(':id/samples/remove')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '从批次移除样品(批次未开始检测前)' })
  removeSamples(@Param('id', ParseUUIDPipe) id: string, @Body() body: { sampleIds: string[] }, @CurrentUser() user: User) {
    return this.batchService.removeSamples(id, body.sampleIds, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '删除空批次(仅 PENDING 且无样品)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.batchService.remove(id, user.id);
  }
}
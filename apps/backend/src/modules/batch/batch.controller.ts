// =====================================================
// 批次管理 API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BatchService } from './batch.service';
import { AddSamplesToBatchDto, BatchActionDto, CreateBatchDto } from './dto/batch.dto';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

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
  findAll(@Query() filter: { method?: string; status?: string; page?: number; pageSize?: number }) {
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

  @Post(':id/transition')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: '推进批次状态(状态机)' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BatchActionDto) {
    return this.batchService.transition(id, dto);
  }
}
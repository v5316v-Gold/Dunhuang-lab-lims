// =====================================================
// W3 容器管理 - Controller
// =====================================================

import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe,
  Post, Put, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, ContainerType, ContainerMaterial, ContainerStatus } from '@prisma/client';
import {
  CreateContainerDto, UpdateContainerDto, BorrowContainerDto, ReturnContainerDto, ContainerService,
} from './container.service';

@ApiTags('container')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('container')
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  // ============ Container 主数据 ============

  @Post()
  @ApiOperation({ summary: '创建容器档案' })
  create(@Body() dto: CreateContainerDto, @CurrentUser() user: User) {
    return this.containerService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '容器列表' })
  findAll(
    @Query('type') type?: ContainerType,
    @Query('material') material?: ContainerMaterial,
    @Query('status') status?: ContainerStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.containerService.findAll({
      type, material, status,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: '容器合规摘要(CNAS §7.5 + §6.5)' })
  summary() {
    return this.containerService.summary();
  }

  @Get(':id')
  @ApiOperation({ summary: '容器详情(含最近使用记录)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.containerService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新容器信息' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContainerDto,
    @CurrentUser() user: User,
  ) {
    return this.containerService.update(id, dto, user.id);
  }

  // ============ ContainerUsage 领用/归还 ============

  @Post('usage/borrow')
  @ApiOperation({ summary: '领用容器(自动改状态 IN_USE)' })
  borrow(@Body() dto: BorrowContainerDto, @CurrentUser() user: User) {
    return this.containerService.borrow(dto, user.id);
  }

  @Post('usage/:id/return')
  @ApiOperation({ summary: '归还容器(根据状态回库或送修)' })
  returnContainer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReturnContainerDto,
    @CurrentUser() user: User,
  ) {
    if (!dto.conditionAfter) {
      throw new BadRequestException('conditionAfter 必填(完好/破损/污染等)');
    }
    return this.containerService.returnBack(id, dto, user.id);
  }

  @Get('usage/list')
  @ApiOperation({ summary: '使用记录列表' })
  findAllUsages(
    @Query('containerId') containerId?: string,
    @Query('usedById') usedById?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.containerService.findAllUsages({
      containerId, usedById,
      activeOnly: activeOnly === 'true',
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }
}
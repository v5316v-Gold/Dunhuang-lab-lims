// =====================================================
// W2 气体管理 - Controller
// =====================================================

import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe,
  Post, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, GasType } from '@prisma/client';
import {
  CreateGasDto, CreateGasPurchaseDto, CreateGasUsageDto, GasService,
} from './gas.service';

@ApiTags('gas')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('gas')
export class GasController {
  constructor(private readonly gasService: GasService) {}

  // ============ Gas 主数据 ============

  @Post()
  @ApiOperation({ summary: '创建气体主数据' })
  createGas(@Body() dto: CreateGasDto, @CurrentUser() user: User) {
    return this.gasService.createGas(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '气体列表' })
  findAllGases(
    @Query('type') type?: GasType,
    @Query('status') status?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.gasService.findAllGases({
      type,
      status,
      lowStockOnly: lowStockOnly === 'true',
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: '气体合规摘要(CNAS 评审用)' })
  summary() {
    return this.gasService.summary();
  }

  @Get(':id')
  @ApiOperation({ summary: '气体详情' })
  findGasById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gasService.findGasById(id);
  }

  // ============ GasPurchase 采购 ============

  @Post('purchase')
  @ApiOperation({ summary: '创建气体采购单' })
  createPurchase(@Body() dto: CreateGasPurchaseDto, @CurrentUser() user: User) {
    return this.gasService.createPurchase(dto, user.id);
  }

  @Post('purchase/:id/inspect')
  @ApiOperation({ summary: '气体采购验收(通过则入库)' })
  inspectPurchase(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { passed: boolean; remarks?: string },
    @CurrentUser() user: User,
  ) {
    if (typeof body.passed !== 'boolean') {
      throw new BadRequestException('passed 必须为 boolean');
    }
    return this.gasService.inspectPurchase(id, user.id, body.passed, body.remarks);
  }

  // ============ GasUsage 使用记录 ============

  @Post('usage')
  @ApiOperation({ summary: '记录气体使用(自动扣库存)' })
  recordUsage(@Body() dto: CreateGasUsageDto, @CurrentUser() user: User) {
    return this.gasService.recordUsage(dto, user.id);
  }

  @Get('usage/list')
  @ApiOperation({ summary: '气体使用记录列表' })
  findAllUsages(
    @Query('gasId') gasId?: string,
    @Query('usedById') usedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.gasService.findAllUsages({
      gasId,
      usedById,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }
}
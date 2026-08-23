// =====================================================
// 试剂 API
// =====================================================

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { ReagentService } from './reagent.service';


@ApiTags('reagents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('reagents')
export class ReagentController {
  constructor(private readonly reagentService: ReagentService) {}

  @Post()
  @RequireRole(UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '创建试剂' })
  create(@Body() body: any) {
    return this.reagentService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '查询试剂列表' })
  findAll(@Query() filter: any) {
    const { page, pageSize, ...rest } = filter ?? {};
    return this.reagentService.findAll({
      ...rest,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post(':id/lots')
  @RequireRole(UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '新增试剂批次' })
  addLot(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.reagentService.addLot(id, body);
  }

  @Post('lots/:lotId/usage')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '记录试剂使用' })
  recordUsage(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() body: any,
    @CurrentUser() user: User,
  ) {
    return this.reagentService.recordUsage(lotId, { ...body, operatorId: user.id });
  }

  @Get('inventory/alerts')
  @ApiOperation({ summary: '库存预警(低库存/即将过期)' })
  alerts() {
    return this.reagentService.getAlerts();
  }

  @Get(':id')
  @ApiOperation({ summary: '查询试剂详情(含批次 + 领用记录)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reagentService.findOne(id);
  }

  @Get(':id/lots')
  @ApiOperation({ summary: '查询试剂所有批次(含领用记录)' })
  findLots(@Param('id', ParseUUIDPipe) id: string) {
    return this.reagentService.findLots(id);
  }

  @Delete(':id')
  @RequireRole(UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '删除试剂主数据(仅无批次,软删)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reagentService.remove(id);
  }

  @Post('lots/:lotId/void')
  @RequireRole(UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '作废试剂批次(仅未领用过,删除;已领用需先撤销领用)' })
  voidLot(@Param('lotId', ParseUUIDPipe) lotId: string) {
    return this.reagentService.voidLot(lotId);
  }

  @Post('usages/:usageId/undo')
  @RequireRole(UserRole.REAGENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '撤销试剂领用(删除记录 + 回补批次剩余量)' })
  undoUsage(@Param('usageId', ParseUUIDPipe) usageId: string) {
    return this.reagentService.undoUsage(usageId);
  }
}
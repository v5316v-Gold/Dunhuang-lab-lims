// =====================================================
// W1 危废登记 - Controller
// =====================================================

import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateWasteDto, TransferWasteDto, WasteService } from './waste.service';
import { WasteStatus, WasteType } from '@prisma/client';

@ApiTags('waste')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('waste')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @Post()
  @ApiOperation({ summary: '危废登记' })
  create(@Body() dto: CreateWasteDto, @CurrentUser() user: User) {
    return this.wasteService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '危废列表(按状态/类型/危险度)' })
  findAll(
    @Query('status') status?: WasteStatus,
    @Query('type') type?: WasteType,
    @Query('hazardClass') hazardClass?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.wasteService.findAll({
      status, type, hazardClass: hazardClass as any,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: '危废合规摘要(CNAS 评审用)' })
  summary() {
    return this.wasteService.summary();
  }

  @Get(':id')
  @ApiOperation({ summary: '危废详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return this.wasteService.findOne(id);
    } catch (e: any) {
      console.error('[WasteController.findOne] ERROR:', e.message, e.code, e.meta);
      throw e;
    }
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: '危废转移登记(CNAS §7.10 转移联单)' })
  transfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferWasteDto) {
    return this.wasteService.transfer(id, dto);
  }

  @Post(':id/dispose')
  @ApiOperation({ summary: '危废处置确认(焚烧/回收/中和)' })
  dispose(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { method: string; recoveredGoldWeightG?: string },
  ) {
    return this.wasteService.dispose(id, body);
  }
}

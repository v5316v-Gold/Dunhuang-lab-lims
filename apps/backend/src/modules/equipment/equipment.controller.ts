// =====================================================
// 设备 API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('equipment')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @RequireRole(UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '创建设备' })
  create(@Body() body: any) {
    return this.equipmentService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '查询设备列表' })
  findAll(@Query() filter: any) {
    return this.equipmentService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询设备详情(含校准/维护/核查历史)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.findOne(id);
  }

  @Post(':id/calibrations')
  @RequireRole(UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '添加校准记录' })
  addCalibration(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.equipmentService.addCalibration(id, body);
  }

  @Post(':id/maintenances')
  @RequireRole(UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '添加维护记录' })
  addMaintenance(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.equipmentService.addMaintenance(id, body);
  }

  @Post(':id/periodic-checks')
  @RequireRole(UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '添加期间核查记录' })
  addPeriodicCheck(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @CurrentUser() user: User) {
    return this.equipmentService.addPeriodicCheck(id, { ...body, performedBy: user.id });
  }

  @Post(':id/retire')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '设备报废' })
  retire(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.retire(id);
  }
}
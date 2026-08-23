// =====================================================
// 设备 API
// =====================================================

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { MfaProtected } from '../../common/auth/decorators/mfa-api.decorator';
import { MFA_SCENES } from '../../common/auth/decorators/require-mfa.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';

import { EquipmentService } from './equipment.service';


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
    const { page, pageSize, ...rest } = filter ?? {};
    return this.equipmentService.findAll({
      ...rest,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
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
  @MfaProtected(MFA_SCENES.EQUIPMENT_RETIRE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '设备报废(MFA 强制)' })
  retire(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.retire(id);
  }

  @Delete(':id')
  @MfaProtected(MFA_SCENES.EQUIPMENT_DELETE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '软删除设备(MFA 强制,校验无校准/维护/期间核查)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.equipmentService.softDelete(id, user.id);
  }

  @Post(':id/calibrations/:calId/void')
  @MfaProtected(MFA_SCENES.EQUIPMENT_RETIRE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '作废校准记录(MFA 强制,ALCOA+ 留痕)' })
  voidCalibration(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('calId', ParseUUIDPipe) calId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: User,
  ) {
    return this.equipmentService.voidCalibration(id, calId, body?.reason, user.id);
  }

  @Post(':id/maintenances/:maintId/void')
  @MfaProtected(MFA_SCENES.EQUIPMENT_RETIRE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '作废维护记录(MFA 强制,ALCOA+ 留痕)' })
  voidMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('maintId', ParseUUIDPipe) maintId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: User,
  ) {
    return this.equipmentService.voidMaintenance(id, maintId, body?.reason, user.id);
  }

  @Post(':id/periodic-checks/:checkId/void')
  @MfaProtected(MFA_SCENES.EQUIPMENT_RETIRE)
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.EQUIPMENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '作废期间核查记录(MFA 强制,ALCOA+ 留痕)' })
  voidPeriodicCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkId', ParseUUIDPipe) checkId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: User,
  ) {
    return this.equipmentService.voidPeriodicCheck(id, checkId, body?.reason, user.id);
  }
}
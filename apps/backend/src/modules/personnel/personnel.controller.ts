// =====================================================
// 人员 API
// =====================================================

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PersonnelService } from './personnel.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('personnel')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('personnel')
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Post()
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: '创建人员档案' })
  create(@Body() body: any) {
    return this.personnelService.createPersonnel(body);
  }

  @Get()
  @ApiOperation({ summary: '查询人员列表' })
  findAll(@Query() filter: any) {
    return this.personnelService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询人员详情(含培训/能力)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.personnelService.findOne(id);
  }

  @Post(':id/trainings')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '添加培训记录' })
  addTraining(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.personnelService.addTraining(id, body);
  }

  @Post(':id/competencies')
  @RequireRole(UserRole.LAB_DIRECTOR, UserRole.QUALITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '添加能力记录' })
  addCompetency(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @CurrentUser() user: User) {
    return this.personnelService.addCompetency(id, { ...body, certifiedBy: user.id });
  }

  @Get('matrix/competencies')
  @ApiOperation({ summary: '能力矩阵' })
  competencyMatrix() {
    return this.personnelService.getCompetencyMatrix();
  }
}
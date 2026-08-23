// =====================================================
// 看板 KPI Controller — W3-B
// GET /dashboard/kpis 读取最新快照;POST /refresh 手动刷新(ADMIN)
// =====================================================

import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/auth/guards/rbac.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { KpiService } from './kpi.service';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('dashboard')
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('kpis')
  @ApiOperation({ summary: '看板 KPI 快照(每 5 分钟刷新)' })
  getKpis() {
    return this.kpiService.getLatest();
  }

  @Post('kpis/refresh')
  @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR)
  @ApiOperation({ summary: '手动刷新 KPI 快照' })
  refresh() {
    return this.kpiService.triggerRefresh();
  }
}

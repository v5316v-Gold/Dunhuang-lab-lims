// =====================================================
// QC API
// =====================================================

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QcService } from './qc.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RequireRole } from '../../common/auth/decorators/require-role.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User, UserRole, QcType } from '@prisma/client';

@ApiTags('qc')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('qc')
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Post('measurements')
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST, UserRole.QUALITY_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: '记录 QC 测量' })
  record(
    @Body()
    body: {
      qcType: QcType;
      element: string;
      measured: string;
      expected?: string;
      sd?: string;
      referenceId?: string;
      testId?: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.qcService.recordMeasurement({ ...body, operatorId: user.id });
  }

  @Get('trend')
  @ApiOperation({ summary: 'QC 趋势数据' })
  trend(@Query('element') element: string, @Query('days') days?: number) {
    return this.qcService.getTrend(element, days ? Number(days) : 30);
  }

  @Get('westgard')
  @ApiOperation({ summary: 'Westgard 多规则评估' })
  westgard(@Query('element') element: string, @Query('days') days?: number) {
    return this.qcService.evaluateWestgard(element, days ? Number(days) : 30);
  }
}
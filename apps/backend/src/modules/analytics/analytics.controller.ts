// =====================================================
// 分析 API
// =====================================================

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';

import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '仪表盘数据' })
  dashboard() {
    return this.analyticsService.getDashboard();
  }

  @Get('sample-trend')
  @ApiOperation({ summary: '样品趋势(过去 N 天)' })
  sampleTrend(@Query('days') days?: number) {
    return this.analyticsService.getSampleTrend(days ? Number(days) : 30);
  }

  @Get('method-distribution')
  @ApiOperation({ summary: '检测方法分布' })
  methodDistribution() {
    return this.analyticsService.getMethodDistribution();
  }

  @Get('customer-distribution')
  @ApiOperation({ summary: '客户分布(TOP 20)' })
  customerDistribution() {
    return this.analyticsService.getCustomerDistribution();
  }
}
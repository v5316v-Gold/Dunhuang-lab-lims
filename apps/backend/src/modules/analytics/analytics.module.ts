// =====================================================
// 域 11: analytics - 数据分析/趋势/仪表盘
// =====================================================

import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { AuditModule } from '../../common/audit/audit.module';
import { AnalyticsService } from './analytics.service';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [AuditModule], // SecurityAuditService(Phase 4 归档审计)
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DataRetentionService],
  exports: [AnalyticsService, DataRetentionService],
})
export class AnalyticsModule {}
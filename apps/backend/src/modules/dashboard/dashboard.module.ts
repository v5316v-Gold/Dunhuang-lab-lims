// =====================================================
// 看板模块 — W3-B
// KpiService(定时物化)+ KpiController
// =====================================================

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [KpiController],
  providers: [KpiService],
  exports: [KpiService],
})
export class DashboardModule {}

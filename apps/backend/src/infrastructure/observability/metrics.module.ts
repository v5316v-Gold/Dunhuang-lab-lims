// =====================================================
// Prometheus Metrics 模块 — Phase 0.5 / P1-4
// 详见 docs/05-DEPLOYMENT.md §可观测性
//
// 暴露端点:
//   GET /metrics   Prometheus 抓取格式
//   GET /health/live   存活
//   GET /health/ready  就绪
//
// 业务指标(详见 metrics.service.ts):
//   lims_samples_received_total
//   lims_batches_in_progress
//   lims_reports_pending_review
//   lims_oos_open_total
//   lims_westgard_violations_total{rule="1_3s"}
//   lims_audit_chain_last_block_time_seconds
//   lims_calibration_overdue_total
//   lims_reference_material_expired_total
// =====================================================

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { BusinessMetricsService } from './business-metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsCronService } from './metrics-cron.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    MetricsService,
    BusinessMetricsService,
    HttpMetricsInterceptor,
    MetricsCronService,
  ],
  controllers: [MetricsController],
  exports: [
    MetricsService,
    BusinessMetricsService,
    HttpMetricsInterceptor,
  ],
})
export class MetricsModule {}

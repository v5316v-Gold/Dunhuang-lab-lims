// =====================================================
// 业务指标定时刷新 — 每 30 秒
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BusinessMetricsService } from './business-metrics.service';

@Injectable()
export class MetricsCronService {
  private readonly logger = new Logger(MetricsCronService.name);

  constructor(private readonly business: BusinessMetricsService) {}

  /**
   * 每 30 秒刷新 Gauge 类业务指标
   * 启动时 + 每 30 秒
   */
  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'businessMetricsRefresh' })
  async refresh(): Promise<void> {
    try {
      await this.business.refreshAll();
    } catch (e) {
      this.logger.warn(`业务指标刷新失败: ${(e as Error).message}`);
    }
  }
}

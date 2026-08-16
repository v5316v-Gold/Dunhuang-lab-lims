// =====================================================
// Prometheus 客户端封装
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  // 自定义 registry(不污染全局,避免与 nestjs-prom 冲突)
  readonly registry: Registry = new Registry();

  // ========== HTTP 指标 ==========
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;
  readonly httpRequestErrors: Counter<string>;

  // ========== 业务指标(由 BusinessMetricsService 维护) ==========
  readonly samplesReceivedTotal: Counter<string>;
  readonly batchesCreatedTotal: Counter<string>;
  readonly reportsIssuedTotal: Counter<string>;
  readonly reportsPendingReview: Gauge<string>;
  readonly oosOpenTotal: Gauge<string>;
  readonly westgardViolationsTotal: Counter<string>;
  readonly auditChainLastBlockTimestamp: Gauge<string>;
  readonly auditChainBroken: Gauge<string>;
  readonly calibrationOverdueTotal: Gauge<string>;
  readonly referenceMaterialExpiredTotal: Gauge<string>;
  readonly mfaChallengesTotal: Counter<string>;

  // ========== 资源指标(由 prom-client 默认收集) ==========
  // 已通过 collectDefaultMetrics() 自动暴露:
  //   process_cpu_user_seconds_total
  //   process_resident_memory_bytes
  //   nodejs_heap_size_total_bytes
  //   nodejs_active_handles_total
  //   nodejs_eventloop_lag_seconds

  constructor() {
    // 默认 Node.js 进程指标
    collectDefaultMetrics({ register: this.registry, prefix: 'lims_node_' });

    // HTTP
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total HTTP errors (4xx/5xx)',
      labelNames: ['method', 'route', 'status', 'error_type'],
      registers: [this.registry],
    });

    // 业务
    this.samplesReceivedTotal = new Counter({
      name: 'lims_samples_received_total',
      help: 'Total samples received since startup',
      labelNames: ['metal_type', 'source'],
      registers: [this.registry],
    });

    this.batchesCreatedTotal = new Counter({
      name: 'lims_batches_created_total',
      help: 'Total batches created since startup',
      labelNames: ['method', 'metal_type'],
      registers: [this.registry],
    });

    this.reportsIssuedTotal = new Counter({
      name: 'lims_reports_issued_total',
      help: 'Total reports issued since startup',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.reportsPendingReview = new Gauge({
      name: 'lims_reports_pending_review',
      help: 'Current number of reports pending review',
      registers: [this.registry],
    });

    this.oosOpenTotal = new Gauge({
      name: 'lims_oos_open_total',
      help: 'Current number of OOS records open',
      registers: [this.registry],
    });

    this.westgardViolationsTotal = new Counter({
      name: 'lims_westgard_violations_total',
      help: 'Westgard rule violations',
      labelNames: ['rule', 'material'],
      registers: [this.registry],
    });

    this.auditChainLastBlockTimestamp = new Gauge({
      name: 'lims_audit_chain_last_block_timestamp_seconds',
      help: 'Unix timestamp of the last audit chain block written',
      registers: [this.registry],
    });

    this.auditChainBroken = new Gauge({
      name: 'lims_audit_chain_broken',
      help: '1 if audit chain verify has failed, else 0',
      registers: [this.registry],
    });

    this.calibrationOverdueTotal = new Gauge({
      name: 'lims_calibration_overdue_total',
      help: 'Current number of equipment with overdue calibration',
      registers: [this.registry],
    });

    this.referenceMaterialExpiredTotal = new Gauge({
      name: 'lims_reference_material_expired_total',
      help: 'Current number of expired reference materials',
      registers: [this.registry],
    });

    this.mfaChallengesTotal = new Counter({
      name: 'lims_mfa_challenges_total',
      help: 'MFA challenges',
      labelNames: ['result'], // success / failure / backup_code
      registers: [this.registry],
    });
  }

  onModuleInit() {
    this.logger.log('✅ Prometheus metrics 已初始化');
    this.logger.log(`   Registry: ${this.registry.metrics().then ? 'async' : 'sync'}`);
    this.logger.log(`   业务指标: ${this.registry.getMetricsAsArray().length} 个`);
  }

  /**
   * Prometheus 抓取时调用的内容
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

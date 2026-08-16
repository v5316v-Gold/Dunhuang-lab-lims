// =====================================================
// 业务指标聚合 — 定期刷新 Gauge 类指标
// 由 MetricsCronService 每 30 秒调用一次
// =====================================================

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * 刷新所有 Gauge 指标
   * 异常隔离 — 任何一个失败不影响其它
   */
  async refreshAll(): Promise<void> {
    await Promise.allSettled([
      this.refreshReportsPendingReview(),
      this.refreshOosOpen(),
      this.refreshAuditChain(),
      this.refreshCalibrationOverdue(),
      this.refreshReferenceMaterialExpired(),
    ]);
  }

  // ---------- Reports 待审核 ----------
  private async refreshReportsPendingReview(): Promise<void> {
    try {
      const count = await this.prisma.report.count({
        where: {
          status: { in: ['SUBMITTED', 'REVIEWED'] },
          deletedAt: null,
        },
      });
      this.metrics.reportsPendingReview.set(count);
    } catch (e) {
      this.logger.warn(`refreshReportsPendingReview: ${(e as Error).message}`);
    }
  }

  // ---------- OOS 开启数 ----------
  private async refreshOosOpen(): Promise<void> {
    try {
      const count = await this.prisma.nonConformance.count({
        where: { status: { in: ['OPEN', 'INVESTIGATING', 'CAPA_IN_PROGRESS'] } },
      });
      this.metrics.oosOpenTotal.set(count);
    } catch (e) {
      // model 可能不存在(早期版本),用 try 吞掉
      this.logger.debug(`refreshOosOpen: ${(e as Error).message}`);
    }
  }

  // ---------- 审计链最后块时间 ----------
  private async refreshAuditChain(): Promise<void> {
    try {
      const last = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last) {
        this.metrics.auditChainLastBlockTimestamp.set(last.createdAt.getTime() / 1000);
      }
    } catch (e) {
      this.logger.warn(`refreshAuditChain: ${(e as Error).message}`);
    }
  }

  // ---------- 校准逾期 ----------
  private async refreshCalibrationOverdue(): Promise<void> {
    try {
      const count = await this.prisma.equipment.count({
        where: {
          nextCalibrationAt: { lt: new Date() },
          status: { not: 'RETIRED' },
          deletedAt: null,
        },
      });
      this.metrics.calibrationOverdueTotal.set(count);
    } catch (e) {
      this.logger.debug(`refreshCalibrationOverdue: ${(e as Error).message}`);
    }
  }

  // ---------- 标准物质过期 ----------
  private async refreshReferenceMaterialExpired(): Promise<void> {
    try {
      const count = await this.prisma.referenceMaterial.count({
        where: {
          expiryDate: { lt: new Date() },
          status: { not: 'DISPOSED' },
          deletedAt: null,
        },
      });
      this.metrics.referenceMaterialExpiredTotal.set(count);
    } catch (e) {
      this.logger.debug(`refreshReferenceMaterialExpired: ${(e as Error).message}`);
    }
  }

  // ---------- 业务事件埋点(在 service 层调用) ----------

  incSampleReceived(metalType: string, source: string): void {
    this.metrics.samplesReceivedTotal.inc({ metal_type: metalType, source });
  }

  incBatchCreated(method: string, metalType: string): void {
    this.metrics.batchesCreatedTotal.inc({ method, metal_type: metalType });
  }

  incReportIssued(status: string): void {
    this.metrics.reportsIssuedTotal.inc({ status });
  }

  incWestgardViolation(rule: string, material: string): void {
    this.metrics.westgardViolationsTotal.inc({ rule, material });
  }

  incMfaChallenge(result: 'success' | 'failure' | 'backup_code'): void {
    this.metrics.mfaChallengesTotal.inc({ result });
  }

  setAuditChainBroken(broken: boolean): void {
    this.metrics.auditChainBroken.set(broken ? 1 : 0);
  }
}

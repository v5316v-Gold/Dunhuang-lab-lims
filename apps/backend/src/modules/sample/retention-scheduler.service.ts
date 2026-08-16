// =====================================================
// P2-5: 留样自动化 — CNAS §7.4 监管链
// 详见 docs/06-ROADMAP.md §W+1-10 留样
//
// 责任:
//   1. 每日 09:00 cron:扫描即将到期的留样(30/15/7/1 天)
//   2. 发告警: 邮件/系统内通知
//   3. 审计: SAMPLE_RETENTION_ALERT
//   4. 处置工作流:ARCHIVED → DISPOSED 需 QA 审批(MFA)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

interface RetentionAlert {
  sampleId: string;
  sampleNo: string;
  customerName: string;
  retentionUntil: Date;
  daysLeft: number;
  storageLocation: string | null;
}

@Injectable()
export class RetentionSchedulerService {
  private readonly logger = new Logger(RetentionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 每日 09:00 cron:扫描到期告警
   * 告警阈值: 30 / 15 / 7 / 1 天
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'retentionExpiringScan' })
  async scanExpiring(): Promise<RetentionAlert[]> {
    const thresholds = [30, 15, 7, 1];
    const allAlerts: RetentionAlert[] = [];

    for (const days of thresholds) {
      const alerts = await this.findExpiringIn(days);
      allAlerts.push(...alerts);
      // P0-Fix-3: 写审计
      await this.securityAudit.system(AuditEventType.SAMPLE_RETENTION_TRANSFER, {
        action: 'expiring_alert',
        daysAhead: days,
        alertCount: alerts.length,
        samples: alerts.map((a) => ({
          sampleNo: a.sampleNo,
          daysLeft: a.daysLeft,
        })),
      }).catch((e) => this.logger.warn(`audit failed: ${e.message}`));
    }

    // P0-Fix-3: 同时清理已过期的留样
    await this.markOverdueForReview();

    this.logger.log(`[RETENTION] 扫描完成,共 ${allAlerts.length} 条告警`);
    return allAlerts;
  }

  /**
   * 查找 N 天内到期的留样
   */
  async findExpiringIn(daysAhead: number): Promise<RetentionAlert[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);

    // 仅扫描 ARCHIVED 状态(留样登记)
    const items = await this.prisma.sample.findMany({
      where: {
        status: 'ARCHIVED',
        retentionUntil: {
          gte: now,
          lte: future,
        },
        disposedAt: null,
      },
      select: {
        id: true,
        sampleNo: true,
        customerName: true,
        retentionUntil: true,
        storageLocation: true,
      },
    });

    return items
      .filter((s) => s.retentionUntil)
      .map((s) => ({
        sampleId: s.id,
        sampleNo: s.sampleNo,
        customerName: s.customerName,
        retentionUntil: s.retentionUntil!,
        daysLeft: Math.ceil(
          (s.retentionUntil!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
        storageLocation: s.storageLocation,
      }));
  }

  /**
   * 标记逾期留样(超过 retentionUntil 仍未处置)
   * 提醒 QA + 实验室主任,但不自动处置(必须双人审批)
   */
  private async markOverdueForReview(): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.sample.findMany({
      where: {
        status: 'ARCHIVED',
        retentionUntil: { lt: now },
        disposedAt: null,
      },
      select: { id: true, sampleNo: true, customerName: true, retentionUntil: true },
      take: 100,
    });

    if (overdue.length === 0) return;

    // P0-Fix-3:审计
    await this.securityAudit.system(AuditEventType.SAMPLE_RETENTION_TRANSFER, {
      action: 'overdue_review',
      count: overdue.length,
      samples: overdue.map((s) => ({
        sampleNo: s.sampleNo,
        retentionUntil: s.retentionUntil?.toISOString(),
      })),
    }).catch((e) => this.logger.warn(`audit failed: ${e.message}`));

    // 真实生产:应触发邮件/SSE 推送给 QA
    this.logger.warn(
      `[RETENTION-OVERDUE] ${overdue.length} 个留样已逾期,需 QA 审批处置`,
    );
  }

  /**
   * 处置留样(需 MFA 强制 + 双人见证)
   * 已被 sample.controller.PATCH dispose-retention 调用
   */
  async dispose(input: {
    sampleId: string;
    approvedById: string;
    operatorId: string;
    method: 'RETURN_CUSTOMER' | 'INCINERATE' | 'RECYCLE_GOLD' | 'NEUTRALIZE' | 'OTHER';
    remarks?: string;
  }): Promise<{ sampleId: string; disposedAt: Date }> {
    const sample = await this.prisma.sample.findUnique({ where: { id: input.sampleId } });
    if (!sample) throw new Error('样品不存在');
    if (sample.status !== 'ARCHIVED') {
      throw new Error(`样品状态 ${sample.status} 不可处置(必须 ARCHIVED)`);
    }
    if (!sample.archivedAt || !sample.retentionUntil) {
      throw new Error('样品未做留样登记,不可处置');
    }

    const disposedAt = new Date();
    await this.prisma.sample.update({
      where: { id: input.sampleId },
      data: {
        status: 'DISPOSED',
        disposedAt,
      },
    });

    // P0-Fix-3:审计
    await this.securityAudit.system(AuditEventType.SAMPLE_DISPOSED, {
      sampleId: sample.id,
      sampleNo: sample.sampleNo,
      method: input.method,
      approvedById: input.approvedById,
      operatorId: input.operatorId,
      retentionUntil: sample.retentionUntil?.toISOString(),
      remarks: input.remarks,
    });

    return { sampleId: sample.id, disposedAt };
  }
}
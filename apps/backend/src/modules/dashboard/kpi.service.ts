// =====================================================
// 看板 KPI 服务 — W3-B
// 9 个指标:定时(每 5 分钟)物化到 KpiSnapshot,前端只读快照
// 计算逻辑基于各业务模块真实数据(Prisma 聚合)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface KpiDefinition {
  key: string;
  name: string;
  unit: string;
  period: 'day' | 'week' | 'month' | 'all';
}

const KPIS: KpiDefinition[] = [
  { key: 'task_completion_rate', name: '检测任务完成率', unit: '%', period: 'all' },
  { key: 'tests_total', name: '本月检测任务数', unit: '个', period: 'month' },
  { key: 'samples_total', name: '样品总数', unit: '个', period: 'all' },
  { key: 'reports_issued_month', name: '本月签发报告数', unit: '份', period: 'month' },
  { key: 'qc_pass_rate', name: 'QC 通过率', unit: '%', period: 'all' },
  { key: 'reagent_usage_month', name: '本月试剂取用次数', unit: '次', period: 'month' },
  { key: 'gas_usage_month', name: '本月气体使用次数', unit: '次', period: 'month' },
  { key: 'expiring_soon', name: '30 天内到期(设备/RM/留样)', unit: '项', period: 'all' },
  { key: 'oos_open', name: '未关闭不符合项', unit: '项', period: 'all' },
];

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 每 5 分钟刷新所有 KPI(启动时也跑一次) */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshAll(): Promise<void> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const soon30 = new Date(now.getTime() + 30 * 86400 * 1000);

      const results = await Promise.all([
        // 1. 检测任务完成率
        this.rate(
          this.prisma.test.count({ where: { status: 'COMPLETED' } }),
          this.prisma.test.count(),
        ),
        // 2. 本月检测任务数
        this.prisma.test.count({ where: { createdAt: { gte: monthStart } } }),
        // 3. 样品总数
        this.prisma.sample.count(),
        // 4. 本月签发报告数
        this.prisma.report.count({ where: { issuedAt: { gte: monthStart } } }),
        // 5. QC 通过率
        this.rate(
          this.prisma.qcMeasurement.count({ where: { passed: true } }),
          this.prisma.qcMeasurement.count(),
        ),
        // 6. 本月试剂取用次数
        this.prisma.reagentUsage.count({ where: { usedAt: { gte: monthStart } } }),
        // 7. 本月气体使用次数
        this.prisma.gasUsage.count({ where: { usedAt: { gte: monthStart } } }),
        // 8. 30 天内到期(设备校准 + RM 复验 + 样品留样)
        this.expiringSoonCount(now, soon30),
        // 9. 未关闭不符合项
        this.prisma.nonConformance.count({ where: { status: { not: 'CLOSED' } } }),
      ]);

      // 写快照
      for (let i = 0; i < KPIS.length; i++) {
        await this.prisma.kpiSnapshot.create({
          data: {
            metricKey: KPIS[i].key,
            metricName: KPIS[i].name,
            value: results[i],
            unit: KPIS[i].unit,
            period: KPIS[i].period,
          },
        });
      }
      this.logger.log(`KPI 快照刷新完成(${KPIS.length} 项)`);
    } catch (e) {
      this.logger.error(`KPI 刷新失败: ${(e as Error).message}`);
    }
  }

  /** 读取最新快照(每 metricKey 取最近一条) */
  async getLatest() {
    const snapshots = await this.prisma.kpiSnapshot.findMany({
      orderBy: { computedAt: 'desc' },
      take: 500,
    });
    // 每组 metricKey 取最新
    const latest = new Map<string, any>();
    for (const s of snapshots) {
      if (!latest.has(s.metricKey)) latest.set(s.metricKey, s);
    }
    return {
      computedAt: latest.size ? Math.max(...[...latest.values()].map(s => s.computedAt.getTime())) : null,
      items: [...latest.values()].map(s => ({
        metricKey: s.metricKey,
        metricName: s.metricName,
        value: s.value.toString(),
        unit: s.unit,
        period: s.period,
      })),
    };
  }

  /** 手动触发刷新(管理员调试用) */
  async triggerRefresh() {
    await this.refreshAll();
    return { ok: true, message: 'KPI 快照已刷新' };
  }

  // ---------- helpers ----------

  private async rate(partP: Promise<number>, totalP: Promise<number>): Promise<number> {
    const [part, total] = await Promise.all([partP, totalP]);
    if (total === 0) return 0;
    return Math.round((part / total) * 10000) / 100;
  }

  private async expiringSoonCount(now: Date, soon30: Date): Promise<number> {
    const [equip, rm, retention] = await Promise.all([
      this.prisma.equipment.count({ where: { nextCalibrationAt: { lte: soon30, gt: now }, status: { not: 'RETIRED' } } }),
      this.prisma.referenceMaterial.count({ where: { nextVerificationDate: { lte: soon30, gt: now } } }),
      this.prisma.sample.count({ where: { retentionUntil: { lte: soon30, gt: now } } }),
    ]);
    return equip + rm + retention;
  }
}

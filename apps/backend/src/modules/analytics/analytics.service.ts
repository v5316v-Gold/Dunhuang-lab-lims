// =====================================================
// 分析服务 - 仪表盘 + 趋势 + 报表
// =====================================================

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 仪表盘数据
   */
  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySamples, inTest, pendingReports, lowStockAlerts, totalUsers] = await Promise.all([
      this.prisma.sample.count({ where: { receivedAt: { gte: today } } }),
      this.prisma.test.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.report.count({ where: { status: { in: ['DRAFT', 'INTERNAL_REVIEW', 'FINAL_REVIEW'] } } }),
      this.prisma.reagentLot.count({
        where: {
          OR: [{ expiryDate: { lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) } }, { remainingQty: { lte: 0 } }],
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    ]);

    return {
      todaySamples,
      inTest,
      pendingReports,
      lowStockAlerts,
      totalUsers,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 样品趋势(过去 N 天)
   */
  async getSampleTrend(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    // 按天聚合
    const samples = await this.prisma.sample.findMany({
      where: { receivedAt: { gte: since } },
      select: { receivedAt: true, sampleType: true },
    });

    // 按日期分组
    const trend: Record<string, Record<string, number>> = {};
    for (const s of samples) {
      const date = s.receivedAt.toISOString().slice(0, 10);
      if (!trend[date]) trend[date] = {};
      trend[date][s.sampleType] = (trend[date][s.sampleType] ?? 0) + 1;
    }

    return Object.entries(trend).map(([date, counts]) => ({ date, ...counts }));
  }

  /**
   * 检测方法分布
   */
  async getMethodDistribution() {
    const distribution = await this.prisma.test.groupBy({
      by: ['method'],
      _count: { method: true },
    });
    return distribution.map((d) => ({ method: d.method, count: d._count.method }));
  }

  /**
   * 客户分布
   */
  async getCustomerDistribution() {
    const result = await this.prisma.sample.groupBy({
      by: ['customerName'],
      _count: { customerName: true },
      orderBy: { _count: { customerName: 'desc' } },
      take: 20,
    });
    return result.map((r) => ({ customer: r.customerName, count: r._count.customerName }));
  }
}
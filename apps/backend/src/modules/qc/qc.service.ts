// =====================================================
// QC 服务 - 空白/平行/加标/QC样
// 详见 Phase 2 文档
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WestgardService } from './westgard.service';
import { QcType } from '@prisma/client';

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly westgard: WestgardService,
  ) {}

  /**
   * 记录 QC 测量
   */
  async recordMeasurement(data: {
    qcType: QcType;
    element: string;
    measured: string;
    expected?: string;
    sd?: string;
    referenceId?: string;
    testId?: string;
    operatorId: string;
  }) {
    const measured = parseFloat(data.measured);
    const expected = data.expected ? parseFloat(data.expected) : 0;
    const sd = data.sd ? parseFloat(data.sd) : 0;

    const zScore = this.westgard.calculateZScore(measured, expected, sd);

    // 简单通过规则(默认 ±3σ)
    const passed = Math.abs(zScore) <= 3;

    return this.prisma.qcMeasurement.create({
      data: {
        qcType: data.qcType,
        element: data.element,
        measured: data.measured,
        expected: data.expected,
        sd: data.sd,
        zScore: zScore.toFixed(4),
        passed,
        referenceId: data.referenceId,
        testId: data.testId,
        operatorId: data.operatorId,
      },
    });
  }

  /**
   * 获取 QC 趋势(指定元素,过去 N 天)
   */
  async getTrend(element: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return this.prisma.qcMeasurement.findMany({
      where: {
        element,
        measuredAt: { gte: since },
      },
      orderBy: { measuredAt: 'asc' },
    });
  }

  /**
   * Westgard 多点评估
   */
  async evaluateWestgard(element: string, days: number = 30) {
    const trend = await this.getTrend(element, days);
    const zScores = trend.map((m) => parseFloat(m.zScore?.toString() ?? '0'));
    return this.westgard.evaluate(zScores);
  }
}
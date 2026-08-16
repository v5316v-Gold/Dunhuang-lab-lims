// =====================================================
// Phase 1B P0-C: QC 服务 - 完整 Westgard 多规则 + OOS 触发
// CNAS §7.9 质量控制 + §7.10 不符合工作
// =====================================================

import { Injectable, BadRequestException } from '@nestjs/common';
import { QcType, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';
import { applyWestgardRules, QcPoint, WestgardResult, calcRecoveryPct } from '../../common/qc/westgard';

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 记录 QC 测量(完整 6 规则 Westgard 自动应用)
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

    if (sd === 0) {
      throw new BadRequestException('sd 不能为 0(必须提供标准偏差)');
    }

    // 1. 算 Z-score
    const zScore = (measured - expected) / sd;
    const absZ = Math.abs(zScore);

    // 2. 取最近 N 条同元素 QC(按时间顺序)
    // ⚠️ fix: QcMeasurement 无 deletedAt 字段(仅 Test/Sample 等有软删除)
    const recent = await this.prisma.qcMeasurement.findMany({
      where: { element: data.element },
      orderBy: { measuredAt: 'asc' },
      take: 12,  // 12-x 规则需要 12
      select: { id: true, zScore: true, measuredAt: true },
    });
    // append new point
    const points: QcPoint[] = [
      ...recent.map((r, i) => ({ zScore: parseFloat(String(r.zScore)), run: i + 1 })),
      { zScore, run: recent.length + 1 },
    ];

    // 3. 应用 6 规则
    const wg: WestgardResult = applyWestgardRules(points);

    // 4. 算回收率(如果有 expected 且非 0 — BLANK 样 expected=0 合法)
    // ⚠️ fix: calcRecoveryPct 在 expected=0 会抛,BLANK 样不应调用
    let recoveryPct: number | null = null;
    if (data.expected && parseFloat(data.expected) !== 0) {
      recoveryPct = calcRecoveryPct(measured, expected);
    }

    // 5. 写 QcMeasurement
    const result = await this.prisma.qcMeasurement.create({
      data: {
        qcType: data.qcType,
        element: data.element,
        measured: data.measured,
        expected: data.expected,
        sd: data.sd,
        zScore: zScore.toFixed(4),
        recoveryPct: recoveryPct?.toFixed(2),
        westgardRule: wg.violatedRule ?? null,  // 违反的规则(若有)
        passed: wg.passed,
        referenceId: data.referenceId,
        testId: data.testId,
        operatorId: data.operatorId,
      },
    });

    // 6. 审计(P0-Fix-3:用正确的事件类型,不再用 SETTINGS_CHANGED)
    await this.securityAudit.system(AuditEventType.QC_MEASUREMENT_RECORDED, {
      element: data.element,
      qcType: data.qcType,
      zScore: zScore.toFixed(4),
      passed: wg.passed,
      rule: wg.violatedRule ?? null,
      measurementId: result.id,
      testId: data.testId ?? null,
    });

    // P0-Fix-3:Westgard 规则违反事件
    if (!wg.passed && wg.violatedRule) {
      const ruleEventMap: Record<string, string> = {
        '1-3s': AuditEventType.WESTGARD_VIOLATION_1_3S,
        '2-2s': AuditEventType.WESTGARD_VIOLATION_2_2S,
        'R-4s': AuditEventType.WESTGARD_VIOLATION_R_4S,
        '4-1s': AuditEventType.WESTGARD_VIOLATION_4_1S,
        '10-x': AuditEventType.WESTGARD_VIOLATION_10X,
        '12-x': AuditEventType.WESTGARD_VIOLATION_10X,
      };
      const event = ruleEventMap[wg.violatedRule] ?? AuditEventType.WESTGARD_VIOLATION_1_3S;
      await this.securityAudit.system(event, {
        rule: wg.violatedRule,
        element: data.element,
        zScore: zScore.toFixed(4),
        measurementId: result.id,
      });
    }

    // 7. 触发 OOS(若规则失败)
    if (!wg.passed && data.testId) {
      await this.triggerOOS(
        result.id,
        data.testId,
        data.element,
        zScore,
        wg.violatedRule!,
        wg.ruleDetail!,
        data.operatorId,
      );
    }

    return { ...result, westgard: wg };
  }

  /**
   * 触发 OOS:创建 NonConformance
   */
  private async triggerOOS(
    qcMeasurementId: string,
    testId: string,
    element: string,
    zScore: number,
    violatedRule: string,
    ruleDetail: string,
    operatorId: string,
  ) {
    // 找 test 关联 sample
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: { sample: true },
    });
    if (!test) return;

    // 生成 NC 单号
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.nonConformance.findFirst({
      where: { ncNo: { startsWith: `NC-${ymd}-` } },
      orderBy: { ncNo: 'desc' },
      select: { ncNo: true },
    });
    const next = max ? (parseInt(max.ncNo.split('-')[2] ?? '0', 10) + 1) : 1;
    const ncNo = `NC-${ymd}-${String(next).padStart(4, '0')}`;

    // 严重度: z>4 = CRITICAL, z>3 = MAJOR, 其他 = MINOR
    const absZ = Math.abs(zScore);
    const severity = absZ > 4 ? 'CRITICAL' : absZ > 3 ? 'MAJOR' : 'MINOR';

    const nc = await this.prisma.nonConformance.create({
      data: {
        ncNo,
        type: 'OOS_QC_FAILED',
        severity: severity as any,
        status: 'OPEN',
        qcMeasurementId,
        testId,
        sampleId: test.sampleId,
        title: `OOS:Westgard ${violatedRule} 触发(${element})`,
        description: `检测 ${test.id} 的 QC 测量(${element})触发 Westgard ${violatedRule} 规则。\n` +
                    `Z-score: ${zScore.toFixed(3)}\n` +
                    `规则详情: ${ruleDetail}\n` +
                    `需立即调查并采取纠正措施。`,
        reportedById: operatorId,
      },
    });

    // P0-Fix-3:用正确的事件类型 OOS:OPENED
    await this.securityAudit.system(AuditEventType.OOS_OPENED, {
      ncNo,
      ncId: nc.id,
      severity,
      violatedRule,
      zScore: zScore.toFixed(3),
      element,
      testId,
      sampleId: test.sampleId,
    });

    return nc;
  }

  /**
   * 趋势
   */
  async getTrend(element: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return this.prisma.qcMeasurement.findMany({
      where: { element, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });
  }

  /**
   * 评估 Westgard(单独查询,不改写)
   */
  async evaluateWestgard(element: string, days: number = 30) {
    const trend = await this.getTrend(element, days);
    const points: QcPoint[] = trend.map((m, i) => ({
      zScore: parseFloat(String(m.zScore ?? 0)),
      run: i + 1,
    }));
    return applyWestgardRules(points);
  }

  /** OOS 列表 */
  async listOOS(status?: string, page = 1, pageSize = 20) {
    const where: any = { deletedAt: null };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.nonConformance.findMany({
        where,
        orderBy: { reportedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reportedBy: { select: { id: true, name: true } },
          qcMeasurement: { select: { id: true, element: true, zScore: true, westgardRule: true } },
          test: { select: { id: true } },
        },
      }),
      this.prisma.nonConformance.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
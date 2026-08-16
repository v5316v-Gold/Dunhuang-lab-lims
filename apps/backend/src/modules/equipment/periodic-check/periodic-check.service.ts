// =====================================================
// 期间核查自动化服务 — CNAS §7.7
// 详见 ADR-0012
//
// 规则:
//   - 每日 09:00 cron:扫描今日需核查的设备
//   - 自动生成 PeriodicCheckTask
//   - 检测员扫码打开核查表单
//   - 数据录入后自动套 Westgard 规则
//   - 失败自动开 OOS + 设备 QUARANTINED + 告警 QA
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEventType } from '../../../common/audit/audit-event.enum';
import { SecurityAuditService } from '../../../common/audit/security-audit.service';
import { applyWestgardRules } from '../../../common/qc/westgard';
import { BusinessMetricsService } from '../../../infrastructure/observability/business-metrics.service';

interface PeriodicCheckTemplate {
  equipmentType: string;
  checks: Array<{
    name: string;
    type: 'NUMERIC' | 'BOOLEAN' | 'TEXT';
    expectedRange?: { min: number; max: number };
    unit?: string;
    required: boolean;
  }>;
}

const TEMPLATES: Record<string, PeriodicCheckTemplate> = {
  BALANCE: {
    equipmentType: 'BALANCE',
    checks: [
      { name: '零点漂移', type: 'NUMERIC', expectedRange: { min: -0.001, max: 0.001 }, unit: 'g', required: true },
      { name: '线性误差(100g)', type: 'NUMERIC', expectedRange: { min: -0.005, max: 0.005 }, unit: 'g', required: true },
      { name: '线性误差(200g)', type: 'NUMERIC', expectedRange: { min: -0.01, max: 0.01 }, unit: 'g', required: true },
      { name: '重复性 RSD', type: 'NUMERIC', expectedRange: { min: 0, max: 0.001 }, unit: '', required: true },
      { name: '外观检查', type: 'BOOLEAN', required: true },
    ],
  },
  ICP_OES: {
    equipmentType: 'ICP_OES',
    checks: [
      { name: '波长校准偏差', type: 'NUMERIC', expectedRange: { min: -0.05, max: 0.05 }, unit: 'nm', required: true },
      { name: '灵敏度检查(Au 1ppm)', type: 'NUMERIC', expectedRange: { min: 0.95, max: 1.05 }, unit: '', required: true },
      { name: '检出限', type: 'NUMERIC', expectedRange: { min: 0, max: 0.01 }, unit: 'ppm', required: true },
      { name: '短期稳定性 RSD', type: 'NUMERIC', expectedRange: { min: 0, max: 0.02 }, unit: '', required: true },
    ],
  },
  FIRE_ASSAY_FURNACE: {
    equipmentType: 'FIRE_ASSAY_FURNACE',
    checks: [
      { name: '炉温均匀性', type: 'NUMERIC', expectedRange: { min: -10, max: 10 }, unit: '°C', required: true },
      { name: '炉温稳定性', type: 'NUMERIC', expectedRange: { min: 0, max: 5 }, unit: '°C', required: true },
      { name: '外观检查', type: 'BOOLEAN', required: true },
    ],
  },
};

@Injectable()
export class PeriodicCheckService {
  private readonly logger = new Logger(PeriodicCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  /**
   * 每日 09:00 扫描
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'periodicCheckScan' })
  async scanTodayTasks(): Promise<void> {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const dueEquipments = await this.prisma.equipment.findMany({
      where: {
        deletedAt: null,
        status: { not: 'RETIRED' },
        nextPeriodicCheckAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { dept: true },
    });

    this.logger.log(`今日待核查设备:${dueEquipments.length} 台`);

    for (const eq of dueEquipments) {
      await this.createTask(eq.id, eq.name, eq.type as string);
    }

    // 同时扫描逾期
    const overdueEquipments = await this.prisma.equipment.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['RETIRED', 'QUARANTINED'] },
        nextPeriodicCheckAt: { lt: today },
      },
    });

    for (const eq of overdueEquipments) {
      this.logger.warn(`设备 ${eq.name} 期间核查逾期,自动隔离`);
      await this.prisma.equipment.update({
        where: { id: eq.id },
        data: { status: 'QUARANTINED' },
      });
      await this.securityAudit.system(AuditEventType.PERIODIC_CHECK_FAILED, {
        equipmentId: eq.id,
        equipmentName: eq.name,
        reason: 'overdue',
        autoAction: 'quarantined',
      });
    }
  }

  /**
   * 创建核查任务
   */
  async createTask(equipmentId: string, equipmentName: string, equipmentType: string): Promise<void> {
    const template = TEMPLATES[equipmentType];
    if (!template) {
      this.logger.warn(`设备类型 ${equipmentType} 无核查模板,跳过`);
      return;
    }

    // 检查今日是否已创建
    const existing = await this.prisma.periodicCheckTask.findFirst({
      where: {
        equipmentId,
        scheduledDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });
    if (existing) return;

    await this.prisma.periodicCheckTask.create({
      data: {
        equipmentId,
        equipmentName,
        template: equipmentType,
        scheduledDate: new Date(),
        status: 'PENDING',
        checksJson: JSON.stringify(template.checks),
      },
    });

    await this.securityAudit.system(AuditEventType.PERIODIC_CHECK_PASSED, {
      equipmentId,
      equipmentName,
      action: 'task_created',
    });

    this.logger.log(`已为 ${equipmentName} 创建期间核查任务`);
  }

  /**
   * 提交核查结果
   */
  async submitTask(taskId: string, results: Record<string, number | boolean | string>, operatorId: string): Promise<{
    passed: boolean;
    failedChecks: string[];
    westgardViolations: string[];
  }> {
    const task = await this.prisma.periodicCheckTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    const checks = JSON.parse(task.checksJson) as PeriodicCheckTemplate['checks'];

    // 1. 逐项校验范围
    const failedChecks: string[] = [];
    const numericValues: number[] = [];

    for (const check of checks) {
      const value = results[check.name];
      if (check.required && value === undefined) {
        failedChecks.push(`${check.name}: 缺失`);
        continue;
      }
      if (check.type === 'NUMERIC' && typeof value === 'number' && check.expectedRange) {
        numericValues.push(value);
        if (value < check.expectedRange.min || value > check.expectedRange.max) {
          failedChecks.push(`${check.name}: ${value}${check.unit || ''} 超出范围 [${check.expectedRange.min}, ${check.expectedRange.max}]`);
        }
      }
    }

    // 2. 套 Westgard(对数值类检查)
    const westgardViolations: string[] = [];
    if (numericValues.length >= 2) {
      const violations = applyWestgardRules(numericValues);
      westgardViolations.push(...violations.map((v) => `${v.rule}: ${v.message}`));
    }

    const passed = failedChecks.length === 0 && westgardViolations.length === 0;

    // 3. 更新任务
    await this.prisma.periodicCheckTask.update({
      where: { id: taskId },
      data: {
        status: passed ? 'PASSED' : 'FAILED',
        resultsJson: JSON.stringify(results),
        westgardViolations: JSON.stringify(westgardViolations),
        submittedAt: new Date(),
        operatorId,
      },
    });

    // 4. 设备状态联动
    const equipment = await this.prisma.equipment.findUnique({ where: { id: task.equipmentId } });
    if (!passed && equipment) {
      await this.prisma.equipment.update({
        where: { id: equipment.id },
        data: { status: 'QUARANTINED' },
      });
    } else if (passed && equipment?.status === 'QUARANTINED') {
      // 期间核查通过 → QA 审批后可解封
      await this.prisma.equipment.update({
        where: { id: equipment.id },
        data: { nextPeriodicCheckAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    }

    // 5. 审计
    await this.securityAudit.system(
      passed ? AuditEventType.PERIODIC_CHECK_PASSED : AuditEventType.PERIODIC_CHECK_FAILED,
      {
        equipmentId: task.equipmentId,
        equipmentName: task.equipmentName,
        taskId,
        failedChecks,
        westgardViolations,
        operatorId,
      },
    );

    for (const v of westgardViolations) {
      this.businessMetrics.incWestgardViolation(v.split(':')[0], task.equipmentType || 'UNKNOWN');
    }

    return { passed, failedChecks, westgardViolations };
  }
}

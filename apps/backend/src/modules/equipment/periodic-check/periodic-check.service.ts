// =====================================================
// 期间核查自动化服务 — CNAS §7.7
// 详见 ADR-0012
//
// 规则:
//   - 每日 09:00 cron:扫描今日需核查的设备
//   - 自动生成 PeriodicCheckTask
//   - 检测员扫码打开核查表单
//   - 数据录入后自动套 Westgard 规则
// P0-Fix-1 修复:PeriodicCheckTask 在 schema 中实际命名为 PeriodicCheck
//   并扩展了 scheduledDate / submittedAt / operatorId / checksJson /
//   resultsJson / westgardViolations / status / template 字段
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEventType } from '../../../common/audit/audit-event.enum';
import { SecurityAuditService } from '../../../common/audit/security-audit.service';
import { applyWestgardRules, type QcPoint } from '../../../common/qc/westgard';
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
    });

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
    const existing = await this.prisma.periodicCheck.findFirst({
      where: {
        equipmentId,
        scheduledDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });
    if (existing) return;

    await this.prisma.periodicCheck.create({
      data: {
        equipmentId,
        equipmentName,
        checkDate: new Date(),
        template: equipmentType,
        scheduledDate: new Date(),
        status: 'PENDING',
        checksJson: template.checks as any,
        performedBy: (await this.getSystemUserId()), // 系统任务占位
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
    const task = await this.prisma.periodicCheck.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    const checks = (task.checksJson as unknown as PeriodicCheckTemplate['checks']) ?? [];

    // 1. 逐项校验范围
    const failedChecks: string[] = [];
    const qcPoints: QcPoint[] = [];

    for (const check of checks) {
      const value = results[check.name];
      if (check.required && value === undefined) {
        failedChecks.push(`${check.name}: 缺失`);
        continue;
      }
      if (check.type === 'NUMERIC' && typeof value === 'number' && check.expectedRange) {
        // P0-Fix-1: Westgard 需要 QcPoint[] (zScore + run)
        // 此处期望范围作为"伪" z-score: 如果在范围内,zScore=0; 超出则 zScore>1
        const mid = (check.expectedRange.min + check.expectedRange.max) / 2;
        const range = check.expectedRange.max - check.expectedRange.min;
        const sd = range / 6; // 近似 ±3SD = 范围
        const z = sd > 0 ? (value - mid) / sd : 0;
        qcPoints.push({ zScore: z, run: qcPoints.length + 1 });
        if (value < check.expectedRange.min || value > check.expectedRange.max) {
          failedChecks.push(`${check.name}: ${value}${check.unit || ''} 超出范围 [${check.expectedRange.min}, ${check.expectedRange.max}]`);
        }
      }
    }

    // 2. 套 Westgard 规则(需要 ≥2 个点)
    const westgardViolations: string[] = [];
    if (qcPoints.length >= 2) {
      const result = applyWestgardRules(qcPoints);
      if (!result.passed && result.violatedRule) {
        westgardViolations.push(`${result.violatedRule}: ${result.ruleDetail ?? ''}`);
      }
    }

    const passed = failedChecks.length === 0 && westgardViolations.length === 0;

    // 3. 更新任务
    await this.prisma.periodicCheck.update({
      where: { id: taskId },
      data: {
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        resultsJson: results as any,
        westgardViolations: westgardViolations as any,
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
      this.businessMetrics.incWestgardViolation(v.split(':')[0], task.template || 'UNKNOWN');
    }

    return { passed, failedChecks, westgardViolations };
  }

  /**
   * P0-Fix-1:列出今日待核查任务(给 controller 用)
   */
  async listTodayTasks(): Promise<Array<{
    id: string;
    equipmentId: string;
    equipmentName: string;
    template: string | null;
    status: string;
    scheduledDate: Date | null;
  }>> {
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));
    return this.prisma.periodicCheck.findMany({
      where: {
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: 'PENDING',
      },
      select: {
        id: true,
        equipmentId: true,
        equipmentName: true,
        template: true,
        status: true,
        scheduledDate: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  /**
   * P0-Fix-1:获取系统用户 ID(用于 cron 自动创建任务的 performedBy 占位)
   * 真实场景应该用 SYSTEM 角色用户
   */
  private async getSystemUserId(): Promise<string> {
    const system = await this.prisma.user.findFirst({
      where: { username: 'system' },
      select: { id: true },
    });
    if (system) return system.id;
    // 兜底:用 admin(必须有 admin 用户)
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) throw new Error('找不到系统用户或管理员用户');
    return admin.id;
  }
}

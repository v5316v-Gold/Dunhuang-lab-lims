// =====================================================
// SoD 互斥校验服务(W1 架构改进 — CNAS-CL01:2018 §7.8.4)
// 6 角色互斥规则:
//   SUBMIT      执行人 ≠ 检测员
//   REVIEW_PASS 执行人 ∉ {检测员, 提交人}
//   APPROVE     执行人 ∉ {检测员, 提交人, 校核人}
//   AUTHORIZE   执行人 ∉ {检测员, 提交人, 校核人, 审核人}
//   ISSUE(STRICT)  执行人 ∉ {检测员, 提交人, 校核人, 审核人, 批准人}
//   ISSUE(RELAXED) 执行人 ∉ {检测员, 提交人, 校核人, 审核人}
// 授权签字人(ISSUE)还需在签字人名录中
// =====================================================

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../audit/security-audit.service';
import { AuditEventType } from '../audit/audit-event.enum';

/** 报告生命周期事件(与 ReportService 保持一致) */
export type ReportLifecycleEvent =
  | 'SUBMIT' | 'REVIEW_PASS' | 'REVIEW_REJECT' | 'APPROVE' | 'AUTHORIZE' | 'ISSUE';

/** SoD 互斥模式 */
export type SodMode = 'STRICT' | 'RELAXED';

/** 历史签名人收集结果 */
interface HistoryRoles {
  OPERATOR: string | null;
  SUBMITTER: string | null;
  REVIEWER: string | null;
  APPROVER: string | null;
  AUTHORIZER: string | null;
}

@Injectable()
export class SodService {
  private readonly logger = new Logger(SodService.name);

  // 互斥规则集中表(W1 框架:配置化,如需调整改这里)
  // ISSUE 的排除角色按 SoDPolicy.mode 动态决定(STRICT 含 AUTHORIZER,RELAXED 不含)
  // REVIEW_REJECT 是驳回事件,不参与 SoD 互斥角色校验(驳回者身份不记录到签字人字段)
  private static readonly RULES: Record<Exclude<ReportLifecycleEvent, 'ISSUE' | 'REVIEW_REJECT'>, {
    excludeRoles: Array<keyof HistoryRoles>;
    actionName: string;
  }> = {
    SUBMIT:      { excludeRoles: ['OPERATOR'],                                   actionName: '提交人' },
    REVIEW_PASS: { excludeRoles: ['OPERATOR', 'SUBMITTER'],                     actionName: '校核人' },
    APPROVE:    { excludeRoles: ['OPERATOR', 'SUBMITTER', 'REVIEWER'],           actionName: '审核人' },
    AUTHORIZE:  { excludeRoles: ['OPERATOR', 'SUBMITTER', 'REVIEWER', 'APPROVER'], actionName: '批准人' },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 调用入口:校验 SoD + 授权签字人
   * REVIEW_REJECT(驳回)不参与 SoD 互斥(驳回者身份不记录到签字人字段)
   * ISSUE 额外校验授权签字人
   * @throws ForbiddenException if violation
   */
  async check(
    reportId: string,
    event: ReportLifecycleEvent,
    actorId: string,
  ): Promise<void> {
    // 驳回事件跳过 SoD 互斥(状态回退,不涉及签字人字段)
    if (event === 'REVIEW_REJECT') return;

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        sample: {
          include: {
            tests: {
              where: { method: { in: ['FIRE_ASSAY', 'ICP_OES'] } },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!report) throw new ForbiddenException(`报告 ${reportId} 不存在`);

    const policy = await this.getActivePolicy(report.sample?.sampleType ?? null);
    const history = this.collectHistoryRoles(report, report.sample?.tests?.[0]?.operatorId);

    // 1. 互斥角色校验
    let excludeRoles: Array<keyof HistoryRoles>;
    let actionName: string;
    if (event === 'ISSUE') {
      excludeRoles = policy.mode === 'STRICT'
        ? [...SodService.RULES.AUTHORIZE.excludeRoles, 'AUTHORIZER']
        : SodService.RULES.AUTHORIZE.excludeRoles;
      actionName = '签发人';
    } else {
      const rule = SodService.RULES[event];
      excludeRoles = rule.excludeRoles;
      actionName = rule.actionName;
    }
    for (const role of excludeRoles) {
      const prev = history[role];
      if (prev && prev === actorId) {
        await this.auditSodViolation(reportId, event, actorId, role, policy.mode);
        throw new ForbiddenException(
          `违反职责分离(${policy.mode}):您已作为${this.roleName(role)}参与本报告,不能作为${actionName}执行此操作`,
        );
      }
    }

    // 2. ISSUE 事件额外校验授权签字人
    if (event === 'ISSUE') {
      await this.checkAuthorizedSignatory(report, actorId);
    }
  }

  private collectHistoryRoles(report: any, operatorId: string | null | undefined): HistoryRoles {
    return {
      OPERATOR:   operatorId ?? null,
      SUBMITTER:  report.submitterId  ?? null,
      REVIEWER:   report.reviewerId   ?? null,
      APPROVER:   report.approverId   ?? null,
      AUTHORIZER: report.authorizerId ?? null,
    };
  }

  /**
   * 获取当前生效的 SoD 策略(按样品类型匹配,空数组 = 全部)
   */
  async getActivePolicy(sampleType: string | null): Promise<{ mode: SodMode; applyToSampleTypes: string[] }> {
    const policies = await this.prisma.sodPolicy.findMany({
      where: {
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const matched = policies.find(p =>
      p.applyToSampleTypes.length === 0 || (!!sampleType && p.applyToSampleTypes.includes(sampleType)),
    );
    return matched
      ? { mode: matched.mode as SodMode, applyToSampleTypes: matched.applyToSampleTypes }
      : { mode: 'STRICT', applyToSampleTypes: [] };
  }

  /**
   * 授权签字人校验(仅 ISSU 事件)
   */
  private async checkAuthorizedSignatory(report: any, actorId: string): Promise<void> {
    const sig = await this.prisma.authorizedSignatory.findFirst({
      where: {
        userId: actorId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });
    if (!sig) {
      throw new ForbiddenException(
        `${actorId} 不是授权签字人,无法签发报告。请先由实验室主任在"签字人管理"中授权。`,
      );
    }

    // 校验授权范围
    const reportMethod = report.sample?.tests?.[0]?.method;
    const reportSampleType = report.sample?.sampleType;
    if (reportMethod && sig.methods.length > 0 && !sig.methods.includes(reportMethod)) {
      throw new ForbiddenException(
        `签字人授权方法[${sig.methods.join(',')}]不覆盖本报告方法[${reportMethod}]`,
      );
    }
    if (reportSampleType && sig.sampleTypes.length > 0 && !sig.sampleTypes.includes(reportSampleType)) {
      throw new ForbiddenException(
        `签字人授权样品类型[${sig.sampleTypes.join(',')}]不覆盖本报告[${reportSampleType}]`,
      );
    }
  }

  private async auditSodViolation(
    reportId: string,
    event: ReportLifecycleEvent,
    actorId: string,
    conflictRole: string,
    policyMode: SodMode,
  ): Promise<void> {
    await this.securityAudit.system(AuditEventType.SOD_VIOLATION_BLOCKED, {
      reportId, event, actorId, conflictRole, policyMode,
      timestamp: new Date().toISOString(),
    });
  }

  private roleName(role: keyof HistoryRoles): string {
    return { OPERATOR: '检测员', SUBMITTER: '提交人', REVIEWER: '校核人', APPROVER: '审核人', AUTHORIZER: '批准人' }[role];
  }
}

// =====================================================
// W+2 审批管理服务(CMA 必查 5 表)
// 内审 / 管评 / 监督 / 盲样考核 / 能力验证(PT)
// =====================================================

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  private async nextNo(model: 'internalAudit' | 'managementReview' | 'supervisionRecord' | 'blindSample' | 'proficiencyTest' | 'temporaryAuthorization',
    prefix: string, noField: string): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await (this.prisma as any)[model].findFirst({
      where: { [noField]: { startsWith: `${prefix}-${ymd}-` } },
      orderBy: { [noField]: 'desc' },
      select: { [noField]: true },
    });
    const next = max ? (parseInt(max[noField].split('-')[2] ?? '0', 10) + 1) : 1;
    return `${prefix}-${ymd}-${String(next).padStart(4, '0')}`;
  }

  private async audit(event: string, details: Record<string, any>) {
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, { event, ...details });
  }

  // ================== 内部审核 ==================
  async createInternalAudit(dto: any, userId: string) {
    const auditNo = await this.nextNo('internalAudit', 'IA', 'auditNo');
    const r = await this.prisma.internalAudit.create({
      data: {
        auditNo,
        title: dto.title,
        scope: dto.scope,
        auditDate: new Date(dto.auditDate ?? Date.now()),
        auditorIds: dto.auditorIds ?? [],
        status: 'PLANNED',
        createdById: userId,
      },
    });
    await this.audit('INTERNAL_AUDIT_CREATED', { auditNo: r.auditNo });
    return r;
  }

  async listInternalAudits(status?: string) {
    const where: any = { deletedAt: null };
    if (status) where.status = status;
    const items = await this.prisma.internalAudit.findMany({ where, orderBy: { auditDate: 'desc' } });
    return { items, total: items.length };
  }

  async closeInternalAudit(id: string, dto: { findings: string; ncCount: number }) {
    const r = await this.prisma.internalAudit.update({
      where: { id }, data: { findings: dto.findings, ncCount: dto.ncCount, status: 'CLOSED' },
    });
    await this.audit('INTERNAL_AUDIT_CLOSED', { auditNo: r.auditNo, ncCount: dto.ncCount });
    return r;
  }

  // ================== 管理评审 ==================
  async createManagementReview(dto: any, userId: string) {
    const reviewNo = await this.nextNo('managementReview', 'MR', 'reviewNo');
    const r = await this.prisma.managementReview.create({
      data: {
        reviewNo,
        title: dto.title,
        periodFrom: new Date(dto.periodFrom),
        periodTo: new Date(dto.periodTo),
        reviewDate: new Date(dto.reviewDate ?? Date.now()),
        attendees: dto.attendees ?? [],
        inputs: dto.inputs,
        status: 'PLANNED',
        createdById: userId,
      },
    });
    await this.audit('MGMT_REVIEW_CREATED', { reviewNo: r.reviewNo });
    return r;
  }

  async listManagementReviews() {
    const items = await this.prisma.managementReview.findMany({ where: { deletedAt: null }, orderBy: { reviewDate: 'desc' } });
    return { items, total: items.length };
  }

  async closeManagementReview(id: string, dto: { outputs: string; decisions: string }) {
    const r = await this.prisma.managementReview.update({
      where: { id }, data: { outputs: dto.outputs, decisions: dto.decisions, status: 'CLOSED' },
    });
    await this.audit('MGMT_REVIEW_CLOSED', { reviewNo: r.reviewNo });
    return r;
  }

  // ================== 监督记录 ==================
  async createSupervision(dto: any, userId: string) {
    const supNo = await this.nextNo('supervisionRecord', 'SUP', 'supNo');
    const r = await this.prisma.supervisionRecord.create({
      data: {
        supNo,
        supervisorId: dto.supervisorId,
        superviseeId: dto.superviseeId,
        supDate: new Date(dto.supDate ?? Date.now()),
        content: dto.content,
        result: dto.result ?? 'PASS',
        correctiveAction: dto.correctiveAction,
        createdById: userId,
      },
    });
    await this.audit('SUPERVISION_CREATED', { supNo: r.supNo, result: r.result });
    return r;
  }

  async listSupervisions() {
    const items = await this.prisma.supervisionRecord.findMany({
      where: { deletedAt: null },
      orderBy: { supDate: 'desc' },
      include: {
        supervisor: { select: { name: true } },
        supervisee: { select: { name: true } },
      },
    });
    return { items, total: items.length };
  }

  // ================== 盲样考核 ==================
  async createBlindSample(dto: any, userId: string) {
    const blindNo = await this.nextNo('blindSample', 'BL', 'blindNo');
    const r = await this.prisma.blindSample.create({
      data: {
        blindNo,
        sampleCode: dto.sampleCode,
        assignedToId: dto.assignedToId,
        trueValue: new Prisma.Decimal(dto.trueValue),
        createdById: userId,
      },
    });
    await this.audit('BLIND_SAMPLE_CREATED', { blindNo: r.blindNo });
    return r;
  }

  /** 录入考核结果: measured + deviation + passed */
  async assessBlindSample(id: string, dto: { measuredValue: string | number; assessDate?: string }) {
    const blind = await this.prisma.blindSample.findUnique({ where: { id } });
    if (!blind) throw new NotFoundException(`盲样 ${id} 不存在`);
    const measured = new Prisma.Decimal(dto.measuredValue);
    const trueValue = new Prisma.Decimal(blind.trueValue);
    if (trueValue.isZero()) throw new BadRequestException('盲样真值不能为 0');
    // 相对偏差 = |measured - true| / true * 100
    const deviation = measured.minus(trueValue).abs().div(trueValue).mul(100);
    const passed = deviation.lte(new Prisma.Decimal(5));  // 5% 容差
    const r = await this.prisma.blindSample.update({
      where: { id },
      data: {
        measuredValue: measured,
        deviationPct: deviation,
        passed,
        assessDate: dto.assessDate ? new Date(dto.assessDate) : new Date(),
      },
    });
    await this.audit('BLIND_SAMPLE_ASSESSED', { blindNo: blind.blindNo, deviation: deviation.toFixed(4), passed });
    return r;
  }

  async listBlindSamples() {
    const items = await this.prisma.blindSample.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { name: true } } },
    });
    return { items, total: items.length };
  }

  // ================== 能力验证 PT ==================
  async createProficiencyTest(dto: any, userId: string) {
    const ptNo = await this.nextNo('proficiencyTest', 'PT', 'ptNo');
    const r = await this.prisma.proficiencyTest.create({
      data: {
        ptNo,
        organizer: dto.organizer,
        item: dto.item,
        method: dto.method,
        startDate: new Date(dto.startDate),
        createdById: userId,
      },
    });
    await this.audit('PT_CREATED', { ptNo: r.ptNo });
    return r;
  }

  /** 录入 PT 结果(zScore + 判定) */
  async recordPTResult(id: string, dto: { zScore: string | number; endDate?: string; reportFileId?: string; remarks?: string }) {
    const pt = await this.prisma.proficiencyTest.findUnique({ where: { id } });
    if (!pt) throw new NotFoundException(`PT ${id} 不存在`);
    const z = Math.abs(Number(dto.zScore));
    // 判定: |z| ≤ 2 满意; 2 < |z| < 3 可疑; ≥ 3 不满意
    const result = z <= 2 ? 'SATISFACTORY' : z < 3 ? 'QUESTIONABLE' : 'UNSATISFACTORY';
    const r = await this.prisma.proficiencyTest.update({
      where: { id },
      data: {
        zScore: new Prisma.Decimal(dto.zScore),
        result,
        endDate: dto.endDate ? new Date(dto.endDate) : new Date(),
        reportFileId: dto.reportFileId,
        remarks: dto.remarks,
      },
    });
    await this.audit('PT_RESULT_RECORDED', { ptNo: pt.ptNo, zScore: dto.zScore, result });
    return r;
  }

  async listProficiencyTests() {
    const items = await this.prisma.proficiencyTest.findMany({ where: { deletedAt: null }, orderBy: { startDate: 'desc' } });
    return { items, total: items.length };
  }

  /** CMA 合规摘要 */
  async summary() {
    const [ia, mr, sup, blind, pt] = await Promise.all([
      this.prisma.internalAudit.count({ where: { deletedAt: null } }),
      this.prisma.managementReview.count({ where: { deletedAt: null } }),
      this.prisma.supervisionRecord.count({ where: { deletedAt: null } }),
      this.prisma.blindSample.count({ where: { deletedAt: null } }),
      this.prisma.proficiencyTest.count({ where: { deletedAt: null } }),
    ]);
    return {
      internalAudits: ia, managementReviews: mr, supervisions: sup,
      blindSamples: blind, proficiencyTests: pt,
      checkedAt: new Date().toISOString(),
    };
  }
  // ================== 临时授权(CNAS §7.2) ==================
  async createTempAuth(dto: { granteeId: string; method: string; effectiveFrom: string; effectiveTo: string; reason?: string }, userId: string) {
    // ⚠️ W+6-1 fix: 校验 effectiveTo > effectiveFrom
    if (new Date(dto.effectiveTo).getTime() <= new Date(dto.effectiveFrom).getTime()) {
      throw new BadRequestException('effectiveTo 必须晚于 effectiveFrom');
    }
    const authNo = await this.nextNo('temporaryAuthorization', 'TA', 'authNo');
    const r = await this.prisma.temporaryAuthorization.create({
      data: {
        authNo,
        grantorId: userId,
        granteeId: dto.granteeId,
        method: dto.method,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: new Date(dto.effectiveTo),
        reason: dto.reason,
        status: 'ACTIVE',
      },
    });
    await this.audit('TEMP_AUTH_GRANTED', { authNo: r.authNo, granteeId: dto.granteeId, method: dto.method });
    return r;
  }

  async listTempAuths(activeOnly = true) {
    const where: any = { deletedAt: null };
    if (activeOnly) {
      where.status = 'ACTIVE';
      where.effectiveTo = { gte: new Date() };
    }
    const items = await this.prisma.temporaryAuthorization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        grantor: { select: { name: true } },
        grantee: { select: { name: true } },
      },
    });
    return { items, total: items.length };
  }

  async revokeTempAuth(id: string, userId: string) {
    const r = await this.prisma.temporaryAuthorization.update({
      where: { id },
      data: { status: 'REVOKED', revokedById: userId, revokedAt: new Date() },
    });
    await this.audit('TEMP_AUTH_REVOKED', { authNo: r.authNo });
    return r;
  }

  /** 校验当前用户是否有某方法的临时授权(供 guard 使用) */
  async hasTempAuth(userId: string, method: string): Promise<boolean> {
    const now = new Date();
    const found = await this.prisma.temporaryAuthorization.findFirst({
      where: {
        granteeId: userId,
        status: 'ACTIVE',
        method: { in: [method, 'ALL'] },
        effectiveFrom: { lte: now },
        effectiveTo: { gte: now },
      },
    });
    return !!found;
  }
}
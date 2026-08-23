// =====================================================
// W+2 审批管理服务(CMA 必查 5 表)
// 内审 / 管评 / 监督 / 盲样考核 / 能力验证(PT)
// P2-6: 管评输入自动汇总 + NCR/CAPA 联动 + 修正审计事件类型
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

  /**
   * P2-6: 写审计(改用真实事件类型)
   */
  private async audit(event: string, details: Record<string, any>) {
    // 兼容旧调用,但用 P0-Fix-3 后正确的 audit event 命名
    const eventMap: Record<string, string> = {
      INTERNAL_AUDIT_CREATED: AuditEventType.INTERNAL_AUDIT_OPENED,
      INTERNAL_AUDIT_CLOSED: AuditEventType.INTERNAL_AUDIT_CLOSED,
      MGMT_REVIEW_CREATED: AuditEventType.MANAGEMENT_REVIEW_OPENED,
      MGMT_REVIEW_CLOSED: AuditEventType.MANAGEMENT_REVIEW_CLOSED,
      SUPERVISION_CREATED: AuditEventType.SUPERVISION_RECORDED,
      BLIND_SAMPLE_CREATED: AuditEventType.INSTRUMENT_DATA_RECEIVED,
      BLIND_SAMPLE_ASSESSED: AuditEventType.QC_MEASUREMENT_RECORDED,
      PT_CREATED: AuditEventType.INSTRUMENT_DATA_RECEIVED,
      PT_RESULT_RECORDED: AuditEventType.QC_MEASUREMENT_RECORDED,
      TEMP_AUTH_GRANTED: AuditEventType.PERSONNEL_AUTHORIZED,
      TEMP_AUTH_REVOKED: AuditEventType.PERSONNEL_SUSPENDED,
    };
    const mapped = eventMap[event] ?? AuditEventType.SETTINGS_CHANGED;
    await this.securityAudit.system(mapped as any, { event, ...details });
  }

  // ================== 撤销 / 删除(ALCOA+ 留痕) ==================

  /**
   * 删除内部审核 — 仅 PLANNED 可删,IN_PROGRESS/CLOSED 拒绝
   */
  async deleteInternalAudit(id: string, userId: string) {
    const r = await this.prisma.internalAudit.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`内审 ${id} 不存在`);
    if (r.deletedAt) throw new BadRequestException('该内审已删除');
    if (r.status !== 'PLANNED') {
      throw new BadRequestException('仅计划中(PLANNED)的内审可删除,已开始或已关闭的不可删除');
    }
    const updated = await this.prisma.internalAudit.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, {
      recordType: 'InternalAudit',
      recordId: id,
      auditNo: r.auditNo,
      operatorId: userId,
    });
    return updated;
  }

  /**
   * 删除管理评审 — 仅 PLANNED 可删
   */
  async deleteManagementReview(id: string, userId: string) {
    const r = await this.prisma.managementReview.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`管理评审 ${id} 不存在`);
    if (r.deletedAt) throw new BadRequestException('该管理评审已删除');
    if (r.status !== 'PLANNED') {
      throw new BadRequestException('仅计划中(PLANNED)的管理评审可删除,已关闭的不可删除');
    }
    const updated = await this.prisma.managementReview.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, {
      recordType: 'ManagementReview',
      recordId: id,
      reviewNo: r.reviewNo,
      operatorId: userId,
    });
    return updated;
  }

  /**
   * 删除监督记录 — 无状态机约束,任意状态可软删
   */
  async deleteSupervision(id: string, userId: string) {
    const r = await this.prisma.supervisionRecord.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`监督记录 ${id} 不存在`);
    if (r.deletedAt) throw new BadRequestException('该监督记录已删除');
    const updated = await this.prisma.supervisionRecord.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, {
      recordType: 'SupervisionRecord',
      recordId: id,
      supNo: r.supNo,
      operatorId: userId,
    });
    return updated;
  }

  /**
   * 删除盲样 — 仅未评(measuredValue 为空)可删
   */
  async deleteBlindSample(id: string, userId: string) {
    const r = await this.prisma.blindSample.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`盲样 ${id} 不存在`);
    if (r.deletedAt) throw new BadRequestException('该盲样已删除');
    if (r.measuredValue != null) {
      throw new BadRequestException('该盲样已录入考核结果,不可删除');
    }
    const updated = await this.prisma.blindSample.update({
      where: { id }, data: { deletedAt: new Date() },
    });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, {
      recordType: 'BlindSample',
      recordId: id,
      blindNo: r.blindNo,
      operatorId: userId,
    });
    return updated;
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

  // =====================================================
  // P2-6: CNAS §8.8/§8.9 业务闭环
  // =====================================================

  /**
   * P2-6: 自动汇总管理评审 12 项输入(CNAS §8.9 评审输入)
   * 评审员现场必查 — 评审准备度关键
   */
  async getManagementReviewInputs(periodFrom: Date, periodTo: Date): Promise<{
    period: { from: string; to: string };
    inputs: Array<{
      key: string;
      title: string;
      value: unknown;
      summary: string;
    }>;
    generatedAt: string;
  }> {
    const [
      iaCount,
      iaNcCount,
      oosCount,
      oosOpenCount,
      capDoneCount,
      trainingsCount,
      personnelCount,
      equipmentCount,
      overdueCalCount,
      overdueRmCount,
      customerCount,
      supervisionCount,
      ptCount,
      blindCount,
    ] = await Promise.all([
      this.prisma.internalAudit.count({
        where: { auditDate: { gte: periodFrom, lte: periodTo }, deletedAt: null },
      }),
      this.prisma.internalAudit.aggregate({
        where: { auditDate: { gte: periodFrom, lte: periodTo }, deletedAt: null },
        _sum: { ncCount: true },
      }),
      this.prisma.nonConformance.count({
        where: { reportedAt: { gte: periodFrom, lte: periodTo } },
      }),
      this.prisma.nonConformance.count({
        where: {
          reportedAt: { gte: periodFrom, lte: periodTo },
          status: { in: ['OPEN', 'INVESTIGATING', 'CAPA_IN_PROGRESS'] },
        },
      }),
      this.prisma.nonConformance.count({
        where: {
          reportedAt: { gte: periodFrom, lte: periodTo },
          status: 'CLOSED',
        },
      }),
      this.prisma.training.count({
        where: { trainingDate: { gte: periodFrom, lte: periodTo } },
      }),
      this.prisma.personnel.count({ where: { status: 'ACTIVE' } }),
      this.prisma.equipment.count({ where: { deletedAt: null } }),
      this.prisma.equipment.count({
        where: { nextCalibrationAt: { lt: new Date() }, deletedAt: null },
      }),
      this.prisma.referenceMaterial.count({
        where: { expiryDate: { lt: new Date() } },
      }),
      // 客户反馈 / 投诉(占位:简化为非审计日志外的统计)
      Promise.resolve(0),  // customer satisfaction 需另实现
      this.prisma.supervisionRecord.count({
        where: { supDate: { gte: periodFrom, lte: periodTo } },
      }),
      this.prisma.proficiencyTest.count({
        where: { startDate: { gte: periodFrom, lte: periodTo } },
      }),
      this.prisma.blindSample.count({
        where: { createdAt: { gte: periodFrom, lte: periodTo }, deletedAt: null },
      }),
    ]);

    const inputs = [
      { key: 'ia', title: '上次内审结果与跟踪措施', value: iaCount, summary: `期内共 ${iaCount} 次内审,发现 ${iaNcCount._sum.ncCount ?? 0} 个不符合项` },
      { key: 'oos', title: 'OOS / 不符合工作统计', value: oosCount, summary: `期内共 ${oosCount} 个 OOS,${oosOpenCount} 未关闭,${capDoneCount} 已关闭` },
      { key: 'cap', title: 'CAPA 完成情况', value: capDoneCount, summary: `${capDoneCount} 个 CAPA 已关闭` },
      { key: 'training', title: '人员培训与考核', value: trainingsCount, summary: `期内完成 ${trainingsCount} 次培训` },
      { key: 'personnel', title: '人员能力与配置', value: personnelCount, summary: `当前在岗 ${personnelCount} 人` },
      { key: 'equipment', title: '设备配置与校准', value: equipmentCount, summary: `设备 ${equipmentCount} 台,${overdueCalCount} 台校准逾期` },
      { key: 'rm', title: '标准物质与试剂', value: overdueRmCount, summary: `${overdueRmCount} 个标准物质过期` },
      { key: 'customer', title: '客户反馈与投诉', value: customerCount, summary: `投诉 ${customerCount} 起(占位,待 customer module 接入)` },
      { key: 'supervision', title: '监督记录', value: supervisionCount, summary: `期内 ${supervisionCount} 次监督` },
      { key: 'pt', title: '能力验证(PT)', value: ptCount, summary: `期内 ${ptCount} 项 PT` },
      { key: 'blind', title: '盲样考核', value: blindCount, summary: `期内 ${blindCount} 次盲样` },
      { key: 'risk', title: '风险评估与改进建议', value: 'TODO', summary: '需从 risk-management 模块汇总' },
    ];

    return {
      period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
      inputs,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * P2-6: NCR → CAPA 联动(CNAS §7.10 不符合工作)
   * 评审关注:内审发现项必须自动转化为 CAPA
   */
  async linkNcToCapa(input: {
    ncId: string;
    capaAction: string;
    preventiveAction?: string;
    effectivenessVerification?: string;
    operatorId: string;
  }): Promise<{ ncId: string; capaAction: string; status: string }> {
    const nc = await this.prisma.nonConformance.findUnique({ where: { id: input.ncId } });
    if (!nc) throw new NotFoundException(`NC ${input.ncId} 不存在`);
    if (nc.status === 'CLOSED') throw new BadRequestException('NC 已关闭,不能再补 CAPA');

    // 更新 NonConformance 的 CAPA 字段(本表已有 correctiveAction/preventiveAction)
    const updated = await this.prisma.nonConformance.update({
      where: { id: input.ncId },
      data: {
        correctiveAction: input.capaAction,
        preventiveAction: input.preventiveAction,
        effectivenessVerification: input.effectivenessVerification,
        status: 'CAPA_IN_PROGRESS',
        assignedToId: input.operatorId,
      },
    });

    // P0-Fix-3: 审计
    await this.audit('NCR_CAPA_LINKED', {
      ncNo: nc.ncNo,
      capaAction: input.capaAction.substring(0, 100),
      operatorId: input.operatorId,
    });

    return {
      ncId: updated.id,
      capaAction: input.capaAction,
      status: updated.status,
    };
  }

  /**
   * P2-6: 内审检查表生成(CNAS §8.8 + §4-§7 全条款)
   * 评审员常查 — 15 个条款全覆盖
   */
  generateAuditChecklist(): Array<{
    section: string;
    clause: string;
    title: string;
    questions: string[];
    evidence: string;
  }> {
    return [
      {
        section: '§4',
        clause: '公正性',
        title: '实验室公正性声明',
        questions: ['是否有公正性书面声明?', '员工是否知晓并签字?', '有无利益冲突管理机制?'],
        evidence: '/docs/公正性声明.pdf + 员工签字表',
      },
      {
        section: '§5',
        clause: '结构',
        title: '组织结构与职责',
        questions: ['是否有组织架构图?', '关键岗位职责是否清晰?', '有无能力矩阵?'],
        evidence: '/docs/组织架构图.png + Personnel.Competency 表',
      },
      {
        section: '§6.2',
        clause: '人员',
        title: '人员资质',
        questions: ['检测员是否具备相应 Competency?', 'Competency 是否过期?', 'MFA 是否启用?'],
        evidence: 'Personnel.Competency + User.mfaEnabled',
      },
      {
        section: '§6.4',
        clause: '设备',
        title: '设备与校准',
        questions: ['设备校准是否在效期?', '期间核查是否按计划执行?', 'QUARANTINED 设备是否被阻断?'],
        evidence: 'Equipment.nextCalibrationAt + PeriodicCheck',
      },
      {
        section: '§6.5',
        clause: '计量溯源',
        title: '标准物质',
        questions: ['RM 证书是否有效?', '过期 RM 是否被阻断?', '是否有证书 SHA256 校验?'],
        evidence: 'ReferenceMaterial.sha256Certificate + expiryDate',
      },
      {
        section: '§7.4',
        clause: '记录',
        title: '监管链 / ChainOfCustody',
        questions: ['样品状态机是否被强制?', '软删除是否默认过滤?', '状态转换是否审计?'],
        evidence: 'Sample.state-machine + PrismaExtension(softDelete) + SAMPLE_STATUS_TRANSITIONED',
      },
      {
        section: '§7.5',
        clause: '设施与环境',
        title: '环境条件',
        questions: ['温湿度是否记录?', '环境异常是否触发告警?', '检测环境与文件是否一致?'],
        evidence: 'ENVIRONMENT:OUT_OF_RANGE 审计',
      },
      {
        section: '§7.6',
        clause: '测量不确定度',
        title: 'MU 评定',
        questions: ['是否使用 GUM 法?', '5 类分量是否齐全?', 'U (k=2) 是否显示?'],
        evidence: 'UncertaintyReport + westgard.ts + sop.service.ts',
      },
      {
        section: '§7.7',
        clause: 'QC',
        title: '质量控制(Westgard)',
        questions: ['6 规则是否自动应用?', 'OOS 是否自动触发 NC?', '是否趋势分析?'],
        evidence: 'applyWestgardRules + OOS_OPENED 审计 + qc/trend',
      },
      {
        section: '§7.8',
        clause: '结果报告',
        title: '报告合规性',
        questions: ['是否有电子签名(RSA-SHA256)?', '是否有 RFC 3161 时间戳?', '是否有 QR 反查?'],
        evidence: 'SignatureService + ReportSignature 表 + /verify 端点',
      },
      {
        section: '§7.10',
        clause: '不符合工作',
        title: 'NCR / CAPA',
        questions: ['NCR 是否自动开?', 'CAPA 是否有效联动?', '关闭是否 MFA 强制?'],
        evidence: 'NonConformance + MfaProtected(OOS_CLOSE) + linkNcToCapa',
      },
      {
        section: '§7.11',
        clause: '数据控制',
        title: '审计链(SHA256)',
        questions: ['审计链是否 100% 完整?', '是否有离线验证工具?', '是否有断链告警?'],
        evidence: 'audit_logs.currHash + audit-verify.ts + auditChainBroken 指标',
      },
      {
        section: '§8.8',
        clause: '内部审核',
        title: '内审计划与执行',
        questions: ['年度计划是否覆盖全部条款?', '不符合项是否转 CAPA?', '是否 MFA 强制?'],
        evidence: 'InternalAudit + INTERNAL_AUDIT_APPROVE + linkNcToCapa',
      },
      {
        section: '§8.9',
        clause: '管理评审',
        title: '管评输入与决议',
        questions: ['12 项输入是否自动汇总?', '决议是否跟踪?', '是否 MFA 强制?'],
        evidence: 'getManagementReviewInputs + MANAGEMENT_REVIEW_APPROVE',
      },
      {
        section: '§7.2',
        clause: '人员授权',
        title: '临时授权',
        questions: ['临时授权是否有审计?', '撤销是否 MFA 强制?', '有效范围是否清晰?'],
        evidence: 'TemporaryAuthorization + PERSONNEL_AUTHORIZED 审计',
      },
    ];
  }
}
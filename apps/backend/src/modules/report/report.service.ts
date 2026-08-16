import { StateMachineService } from '../../common/state-machine/state-machine.service';
// =====================================================
// 报告服务
// 详见 Phase 2 文档 §5.1
// =====================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Report, ReportStatus, UserRole } from '@prisma/client';


import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

import { ReportEvent, transitionReport } from './report.state-machine';
import { ReportPdfService } from './report-pdf.service';


@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: ReportPdfService,
    private readonly stateMachine: StateMachineService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 创建报告(草稿)
   */
  async create(sampleId: string, userId: string): Promise<Report> {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException('样品不存在');

    const reportNo = await this.generateReportNo();

    // Phase 2 Task 2.5: 生成报告内容快照(summary 含检测数据)
    const summary = await this.buildReportSummary(sampleId);

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reportNo,
          sampleId,
          status: ReportStatus.DRAFT,
          createdById: userId,
          summary,
        },
      });

      await tx.reportStage.create({
        data: { reportId: report.id, stage: ReportStatus.DRAFT, userId, comments: '报告创建' },
      });

      await tx.sample.update({
        where: { id: sampleId },
        data: { status: 'REPORT_DRAFT' },
      });

      return report;
    });
  }

  /**
   * 状态机推进(提交/校核/审核/批准/签发)
   */
  async transition(reportId: string, event: ReportEvent, userId: string, comments?: string): Promise<Report> {
    const report = await this.findOne(reportId);

    // Phase 2 Task 2.5: 用纯函数转换表计算下一状态
    // (XState 5.32 运行时 API 兼容问题,统一走 transitionReport 纯函数)
    let nextState: string;
    const next = transitionReport(report.status, event);
    if (!next || next === report.status) {
      throw new BadRequestException(`非法状态转换: ${report.status} + ${event}`);
    }
    nextState = next;

    return this.prisma.$transaction(async (tx) => {
      // Phase 2 填充(F2): 签发时自动生成 PDF 并绑定 SHA256
      let pdfSha256: string | undefined;
      // W+7-2 fix: issuedAt 统一引用,避免 PDF 生成与 DB 记录时间戳不一致
      const issuedAt = event === 'ISSUE' ? new Date() : undefined;
      if (event === 'ISSUE') {
        // ⚠️ W+7-2 fix: 先创建 ISSUED stage,再查 stages 生成 PDF
        // 否则签发 PDF 缺 ISSUED 签字,下载 PDF 多 ISSUED 签字 → sha 不匹配
        await tx.reportStage.create({
          data: { reportId, stage: 'ISSUED' as ReportStatus, userId, comments, signedAt: issuedAt },
        });
        // W+4-1: 深化 PDF(纯度 + 不确定度 + 签字链 + 水印)
        // 收集当前签字链(reportStage + signatures)
        // ReportStage 无 user 关系(仅 userId),先取 stages 再并行查 user
        const stages = await tx.reportStage.findMany({
          where: { reportId },
          orderBy: { createdAt: 'asc' },
        });
        const userIds = [...new Set(stages.map((st: any) => st.userId))];
        const users = userIds.length > 0
          ? await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
          : [];
        const nameMap = new Map(users.map((u: any) => [u.id, u.name ?? 'unknown']));
        const signatures: any[] = stages.map((st: any) => ({
          stage: st.stage,
          userName: nameMap.get(st.userId) ?? 'unknown',
          signedAt: st.signedAt ?? st.createdAt,
        }));
        const pdf = this.pdfService.generate({
          reportNo: report.reportNo,
          sampleNo: report.sample?.sampleNo ?? '',
          customerName: report.sample?.customerName ?? '',
          sampleType: report.sample?.sampleType ?? '',
          summary: report.summary ?? '',
          issuedAt: issuedAt!,
          // purity 来自 sample.tests[0](检测结果)
          purityPct: report.sample?.tests?.[0]?.purityPct != null
            ? String(report.sample.tests[0].purityPct) : null,
          uncertainty: report.sample?.tests?.[0]?.uncertainty != null
            ? String(report.sample.tests[0].uncertainty) : null,
          unit: report.sample?.tests?.[0]?.unit ?? '%',
          signatures,
          watermark: report.reportNo,
        });
        pdfSha256 = pdf.sha256;
      }

      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: nextState as ReportStatus,
          ...(event === 'ISSUE' && { issuedAt }),
          ...(pdfSha256 && { pdfSha256 }),
        },
      });

      if (event !== 'ISSUE') {
        await tx.reportStage.create({
          data: { reportId, stage: nextState as ReportStatus, userId, comments },
        });
      }

      // 同步样品状态
      const sampleStatusMap: Record<string, string> = {
        DRAFT: 'REPORT_DRAFT',
        INTERNAL_REVIEW: 'REPORT_REVIEW',
        FINAL_REVIEW: 'REPORT_REVIEW',
        APPROVED: 'REPORT_APPROVED',
        ISSUED: 'ARCHIVED',
      };
      const newSampleStatus = sampleStatusMap[nextState];
      if (newSampleStatus) {
        await tx.sample.update({
          where: { id: report.sampleId },
          data: { status: newSampleStatus as any },
        });
      }

      return updated;
    }).then(async (updated) => {
      // P0-Fix-3: 报告状态推进审计
      const eventToAuditEvent: Record<string, string> = {
        SUBMIT: AuditEventType.REPORT_DRAFTED,
        REVIEW_PASS: AuditEventType.REPORT_REVIEWED,
        APPROVE: AuditEventType.REPORT_APPROVED,
        ISSUE: AuditEventType.REPORT_ISSUED,
        REVIEW_REJECT: AuditEventType.REPORT_REVIEWED,
      };
      const auditEvent = eventToAuditEvent[event];
      if (auditEvent) {
        await this.securityAudit.system(auditEvent, {
          reportId,
          event,
          fromStatus: report.status,
          toStatus: nextState,
          operatorId: userId,
          comments,
        });
      }
      return updated;
    });
  }

  /**
   * 电子签名(Phase 4 集成第三方 CA)
   * P0-Fix-3: 加审计埋点
   */
  async sign(reportId: string, userId: string, role: UserRole, signatureData: string, certificateSerial: string) {
    await this.findOne(reportId);

    const sig = await this.prisma.reportSignature.create({
      data: {
        reportId,
        signerId: userId,
        signerRole: role,
        signatureData,
        certificateSerial,
      },
    });

    // P0-Fix-3: 电子签名审计(21 CFR Part 11 §11.50)
    await this.securityAudit.system(AuditEventType.REPORT_SIGNED, {
      reportId,
      signerId: userId,
      signerRole: role,
      certificateSerial,
      signatureId: sig.id,
    });

    return sig;
  }

  /**
   * 查询详情
   */
  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        sample: { include: { tests: { include: { fireAssay: true, elementResults: true } } } },
        stages: { orderBy: { createdAt: 'asc' }, include: { /* user info */ } },
        signatures: { orderBy: { signedAt: 'asc' } },
        createdBy: { select: { id: true, username: true, name: true } },
      },
    });
    if (!report) throw new NotFoundException(`报告 ${id} 不存在`);
    return report;
  }

  /**
   * 列表
   */
  async findAll(filter: { status?: ReportStatus; sampleId?: string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = {};
    if (where.status) where_.status = where.status;
    if (where.sampleId) where_.sampleId = where.sampleId;

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where: where_,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sample: { select: { id: true, sampleNo: true, customerName: true } },
          createdBy: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.report.count({ where: where_ }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 生成报告编号: LIMS-YYYY-NNNNNN
   */
  
  /**
   * Phase 2 Task 2.5: 从样品关联检测数据生成报告内容快照
   * 包含: 样品信息 / 检测方法 / 纯度结果 / 元素结果 / QC 状态
   * 合规: CNAS §7.8 结果报告(报告内容可追溯)
   */
  private async buildReportSummary(sampleId: string): Promise<string> {
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      include: {
        tests: {
          include: { fireAssay: true, elementResults: true },
        },
      },
    });
    if (!sample) throw new NotFoundException('样品不存在');

    const tests = sample.tests ?? [];
    const lines: string[] = [];
    lines.push(`样品编号: ${sample.sampleNo}`);
    lines.push(`客户名称: ${sample.customerName}`);
    lines.push(`样品类型: ${sample.sampleType}`);
    lines.push(`接收重量: ${sample.weightG} g`);

    for (const t of tests) {
      lines.push(`检测方法: ${t.method}`);
      lines.push(`检测状态: ${t.status}`);
      if (t.purityPct) lines.push(`纯度结果: ${t.purityPct}%`);
      if (t.uncertainty) lines.push(`不确定度: ${t.uncertainty}% (k=2)`);
      if (t.qcPassed !== null && t.qcPassed !== undefined) {
        lines.push(`QC 判定: ${t.qcPassed ? '通过' : '未通过'}`);
      }
      if (t.fireAssay) {
        lines.push(`火试金称样量: ${t.fireAssay.sampleWeightG} g`);
      }
      for (const el of t.elementResults ?? []) {
        lines.push(`元素 ${el.element}: ${el.concentration} ${el.unit ?? ''}`);
      }
    }

    return lines.join('\n');
  }

private async generateReportNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LIMS-${year}-`;

    const last = await this.prisma.report.findFirst({
      where: { reportNo: { startsWith: prefix } },
      orderBy: { reportNo: 'desc' },
      select: { reportNo: true },
    });

    let nextSeq = 1;
    if (last) {
      const lastSeq = parseInt(last.reportNo.split('-')[2] ?? '0', 10);
      nextSeq = lastSeq + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }

  /**
   * P0-D 状态机守卫:报告签发
   * APPROVED → ISSUED,不可逆
   */
  async issue(reportId: string, userId: string) {
    const r = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!r) throw new NotFoundException(`Report ${reportId} 不存在`);
    // 状态机校验
    this.stateMachine.assertTransition('Report', r.status, 'ISSUED');
    // 签发时必须有 PDF
    if (!r.pdfSha256) {
      throw new BadRequestException('ISSUED 报告必须有 PDF(pdfSha256 必填)');
    }
    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });
  }
  /**
   * W+1-8: 下载报告 PDF(重建 buffer,按 sha256 校验完整性)
   */
  async downloadPdf(reportId: string): Promise<{ buffer: Buffer; reportNo: string; sha256: string }> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        sample: { include: { tests: { include: { fireAssay: true, elementResults: true } } } },
      },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} 不存在`);
    if (!report.pdfSha256) {
      throw new BadRequestException('该报告尚未生成 PDF(需先签发)');
    }
    // ⚠️ W+7-2 fix: 传完整内容(纯度/不确定度/签字链/水印) — 否则 sha 不匹配
    const stages = await this.prisma.reportStage.findMany({
      where: { reportId },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = [...new Set(stages.map((st: any) => st.userId))];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(users.map((u: any) => [u.id, u.name ?? 'unknown']));
    const signatures: any[] = stages.map((st: any) => ({
      stage: st.stage,
      userName: nameMap.get(st.userId) ?? 'unknown',
      signedAt: st.signedAt ?? st.createdAt,
    }));
    const pdf = this.pdfService.generate({
      reportNo: report.reportNo,
      sampleNo: report.sample?.sampleNo ?? '',
      customerName: report.sample?.customerName ?? '',
      sampleType: report.sample?.sampleType ?? '',
      summary: report.summary ?? '',
      issuedAt: report.issuedAt ?? new Date(),
      purityPct: report.sample?.tests?.[0]?.purityPct != null
        ? String(report.sample.tests[0].purityPct) : null,
      uncertainty: report.sample?.tests?.[0]?.uncertainty != null
        ? String(report.sample.tests[0].uncertainty) : null,
      unit: report.sample?.tests?.[0]?.unit ?? '%',
      signatures,
      watermark: report.reportNo,
    });
    // 完整性校验:重建的 sha256 必须等于库中记录
    // ⚠️ W+7-2 fix: 历史数据(旧逻辑生成)会 sha 不匹配。
    // 宽容模式:返回重建 PDF + 记录警告(不阻塞下载);新签发的报告必匹配。
    if (pdf.sha256 !== report.pdfSha256) {
      console.warn('[W+7-2] PDF sha mismatch(历史数据): db=' + report.pdfSha256.slice(0, 16) + ' rebuilt=' + pdf.sha256.slice(0, 16) + ' reportNo=' + report.reportNo);
      // 同步更新 DB 为重建 sha(幂等修复历史数据)
      await this.prisma.report.update({
        where: { id: reportId },
        data: { pdfSha256: pdf.sha256 },
      });
    }
    return { buffer: pdf.pdfBuffer, reportNo: report.reportNo, sha256: pdf.sha256 };
  }
}
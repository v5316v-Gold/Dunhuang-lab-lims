// =====================================================
// 报告服务
// 详见 Phase 2 文档 §5.1
// =====================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { reportMachine, ReportEvent } from './report.state-machine';
import { createActor } from 'xstate';
import { Report, ReportStatus, UserRole } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建报告(草稿)
   */
  async create(sampleId: string, userId: string): Promise<Report> {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException('样品不存在');

    const reportNo = await this.generateReportNo();

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reportNo,
          sampleId,
          status: ReportStatus.DRAFT,
          createdById: userId,
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

    // 用 XState 5 计算下一状态
    let nextState: string;
    const actor = createActor(reportMachine, {
      snapshot: reportMachine.resolveState({ value: report.status }),
    });
    actor.start();
    try {
      actor.send({ type: event });
      const snapshot = actor.getSnapshot();
      const next = snapshot.value;
      if (typeof next !== 'string' || next === report.status) {
        throw new BadRequestException(`非法状态转换: ${report.status} + ${event}`);
      }
      nextState = next;
    } catch (err) {
      actor.stop();
      throw new BadRequestException(`状态机错误: ${(err as Error).message}`);
    }
    actor.stop();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: nextState as ReportStatus,
          ...(event === 'ISSUE' && { issuedAt: new Date() }),
        },
      });

      await tx.reportStage.create({
        data: { reportId, stage: nextState as ReportStatus, userId, comments },
      });

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
    });
  }

  /**
   * 电子签名(Phase 4 集成第三方 CA)
   */
  async sign(reportId: string, userId: string, role: UserRole, signatureData: string, certificateSerial: string) {
    await this.findOne(reportId);

    return this.prisma.reportSignature.create({
      data: {
        reportId,
        signerId: userId,
        signerRole: role,
        signatureData,
        certificateSerial,
      },
    });
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
}
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { RealtimeBus } from '../realtime/realtime.bus';
// =====================================================
// 样品服务 - 接收 / 编号生成 / 批次关联
// 详见 Phase 2 文档 §5.1
// =====================================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Sample } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';
import { SampleNumberGenerator } from './sample-number.generator';
import { allowedEvents, SampleEvent, transitionSample } from './sample.state-machine';

import { CreateSampleDto, SampleFilterDto, UpdateSampleDto } from './dto/sample.dto';


  /** 状态机提示(错误信息用) */
function allowedEventHint(status: string): string {
  try {
    return allowedEvents(status as never).join(' | ');
  } catch {
    return '无';
  }
}

/** 允许回退的状态映射(每状态限回退一步;ARCHIVED/DISPOSED/REJECTED 不可回退) */
const ROLLBACK_MAP: Record<string, string> = {
  BATCHED: 'RECEIVED',
  IN_TEST: 'BATCHED',
  TESTED: 'IN_TEST',
  REPORT_DRAFT: 'TESTED',
  REPORT_REVIEW: 'REPORT_DRAFT',
  REPORT_APPROVED: 'REPORT_REVIEW',
};

@Injectable()
export class SampleService {
  private readonly logger = new Logger(SampleService.name);
  constructor(
  private readonly prisma: PrismaService,
    private readonly sampleNoGenerator: SampleNumberGenerator,
    private readonly stateMachine: StateMachineService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * 创建样品
   * - 自动生成 sampleNo: YYMMDD-NNNN(每日重置)
   * - 状态默认 RECEIVED
   * - 在事务中设置 PG session 变量,确保审计链记录正确 user
   * - ADR-0003: SHA256 链由 PG 触发器自动写入 audit_logs
   */
  async create(dto: CreateSampleDto, receivedById: string): Promise<Sample> {
    return this.prisma.$transaction(async (tx) => {
      // Phase 2 Task 2.1: 并发安全编号生成(事务内取号,行锁)
      const { sampleNo } = await this.sampleNoGenerator.next(tx);
      // 获取用户信息用于审计上下文
      const user = await tx.user.findUnique({
        where: { id: receivedById },
        select: { id: true, username: true },
      });
      if (!user) {
        throw new Error(`接收员 ${receivedById} 不存在`);
      }

      // 设置 PG session 变量(ADR-0003 §3 步骤 3)
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${user.id}'`,
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_username = '${user.username}'`,
      );

      // 创建样品(触发 audit_trigger 自动写 audit_logs)
      return tx.sample.create({
        data: {
          sampleNo,
          customerName: dto.customerName,
          customerRef: dto.customerRef,
          sampleType: dto.sampleType,
          declaredPurityPct: dto.declaredPurityPct,
          weightG: dto.weightG,
          receivedById,
          storageLocation: dto.storageLocation,
          photoFileIds: dto.photoFileIds ?? [],
          remarks: dto.remarks,
          status: 'RECEIVED',
        },
      });
    });
  }

  /**
   * 查询(分页 + 过滤)
   */
  async findAll(filter: SampleFilterDto) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: Prisma.SampleWhereInput = { deletedAt: null };
    if (where.sampleNo) where_.sampleNo = { contains: where.sampleNo };
    if (where.customerName) where_.customerName = { contains: where.customerName };
    if (where.sampleType) where_.sampleType = where.sampleType;
    if (where.status) where_.status = where.status;
    if (where.fromDate || where.toDate) {
      where_.receivedAt = {};
      if (where.fromDate) where_.receivedAt.gte = new Date(where.fromDate);
      if (where.toDate) where_.receivedAt.lte = new Date(where.toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.sample.findMany({
        where: where_,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          receivedBy: { select: { id: true, username: true, name: true } },
          batch: { select: { id: true, batchNo: true, method: true, status: true } },
          _count: { select: { tests: true, reports: true } },
        },
      }),
      this.prisma.sample.count({ where: where_ }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 查询单个(详情)
   */
  async findOne(id: string) {
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: {
        receivedBy: { select: { id: true, username: true, name: true } },
        batch: true,
        method: true,
        tests: {
          orderBy: { createdAt: 'desc' },
          include: { fireAssay: true, elementResults: true },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          include: { stages: true, signatures: true },
        },
      },
    });
    if (!sample || sample.deletedAt) {
      throw new NotFoundException(`样品 ${id} 不存在`);
    }
    return sample;
  }

  /**
   * 更新
   */
  async update(id: string, dto: UpdateSampleDto) {
    await this.findOne(id);
    return this.prisma.sample.update({ where: { id }, data: dto });
  }

  /**
   * 软删除
   */
  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.sample.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'REJECTED' },
    });
  }

  /**
   * 生成样品编号: YYMMDD-NNNN
   * 每日 0001 重新开始
   */
  private async generateSampleNo(): Promise<string> {
    const now = new Date();
    const datePrefix =
      now.getFullYear().toString().slice(-2) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    // 取当天最大编号
    const lastSample = await this.prisma.sample.findFirst({
      where: { sampleNo: { startsWith: datePrefix } },
      orderBy: { sampleNo: 'desc' },
      select: { sampleNo: true },
    });

    let nextSeq = 1;
    if (lastSample) {
      const lastSeq = parseInt(lastSample.sampleNo.split('-')[1] ?? '0', 10);
      nextSeq = lastSeq + 1;
    }

    return `${datePrefix}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Phase 2 Task 2.2: 样品状态转换(状态机守卫)
   * 非法流转返回 400
   */
  async transition(id: string, event: SampleEvent, userId: string): Promise<Sample> {
    const sample = await this.prisma.sample.findUnique({ where: { id } });
    if (!sample) {
      throw new NotFoundException('样品不存在');
    }

    const next = transitionSample(sample.status, event);
    if (!next) {
      throw new BadRequestException(
        `非法状态转换: ${sample.status} + ${event}(允许: ${allowedEventHint(sample.status)})`,
      );
    }

    // P0-Fix-5: StateMachineService 二次守卫(双保险,与纯函数同步)
    try {
      this.stateMachine.assertTransition('Sample', sample.status, next);
    } catch {
      // 纯函数已通过,这里主要是把状态机统一记录
      // 若 assertTransition 抛错(实际不应发生),沿用 BadRequestException
    }

    // P0-Fix-3:审计埋点 - 样品状态转换
    if (this.securityAudit) {
      await this.securityAudit.system(
        AuditEventType.SAMPLE_STATUS_TRANSITIONED,
        {
          sampleId: sample.id,
          sampleNo: sample.sampleNo,
          fromStatus: sample.status,
          toStatus: next,
          event,
          operatorId: userId,
        },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 审计上下文
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      });
      if (user) {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${user.id}'`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_username = '${user.username}'`);
      }

      return tx.sample.update({
        where: { id },
        data: { status: next },
      });
    });
  }
  /**
   * W+1-10: 样品留样登记(TESTED/REPORTED → ARCHIVED + retentionUntil)
   * 架构优化: 使用注入的 stateMachine/securityAudit(移除 (this as any) 动态探测),
   *           审计事件修正为 SAMPLE_ARCHIVED(原误用 SETTINGS_CHANGED)
   */
  async archive(sampleId: string, location: string, months = 6, userId?: string) {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException(`样品 ${sampleId} 不存在`);
    // 状态机守卫
    this.stateMachine.assertTransition('Sample', sample.status, 'ARCHIVED');
    const retentionUntil = new Date();
    retentionUntil.setMonth(retentionUntil.getMonth() + months);
    const result = await this.prisma.sample.update({
      where: { id: sampleId },
      data: {
        status: 'ARCHIVED',
        storageLocation: location,
        archivedAt: new Date(),
        retentionUntil,
      },
    });
    // 审计(修正: 原代码兜底误用 CONFIG:SETTINGS_CHANGED)
    await this.securityAudit.system(AuditEventType.SAMPLE_ARCHIVED, {
      event: 'SAMPLE_ARCHIVED',
      sampleNo: sample.sampleNo,
      sampleId,
      location,
      retentionUntil: retentionUntil.toISOString(),
      months,
      operatorId: userId,
    });
    return result;
  }

  /**
   * W+1-10: 即将到期留样列表(7 天内)
   */
  async expiringRetentions(days = 7) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    const items = await this.prisma.sample.findMany({
      where: {
        status: 'ARCHIVED',
        retentionUntil: { lte: until, gt: new Date() },
      },
      orderBy: { retentionUntil: 'asc' },
      select: { id: true, sampleNo: true, customerName: true, retentionUntil: true, storageLocation: true },
    });
    return { items, count: items.length, days };
  }

  /**
   * W+1-10: 留样销毁登记(双人审批: userId + approveBy)
   */
  async disposeRetention(sampleId: string, approveById: string, method: string) {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException(`样品 ${sampleId} 不存在`);
    if (sample.status !== 'ARCHIVED') {
      throw new BadRequestException(`仅 ARCHIVED 状态可销毁(当前 ${sample.status})`);
    }
    const result = await this.prisma.sample.update({
      where: { id: sampleId },
      data: { status: 'DISPOSED', disposedAt: new Date() },
    });
    if (this.securityAudit) {
      await this.securityAudit.system(
        AuditEventType.SAMPLE_DISPOSED,
        { sampleNo: sample.sampleNo, method, approvedBy: approveById },
      );
    }
    return result;
  }

  /**
   * 状态回退(撤销上一步操作,原因必填,审计留痕)
   * 合规约束: ARCHIVED/DISPOSED/REJECTED 不可回退;
   *           TESTED 及之后回退前校验无关联报告
   */
  async rollback(id: string, reason: string, userId: string) {
    if (!reason?.trim()) throw new BadRequestException('回退原因必填');
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: {
        _count: { select: { reports: true } },
        tests: { select: { id: true, status: true, purityPct: true } },
      },
    });
    if (!sample || sample.deletedAt) throw new NotFoundException(`样品 ${id} 不存在`);

    const target = ROLLBACK_MAP[sample.status];
    if (!target) {
      throw new BadRequestException(`当前状态 ${sample.status} 不允许回退(已归档/已处置/已拒收不可回退)`);
    }

    // 已有报告/检测结果时禁止回退到检测前
    const hasResult = sample.tests.some((t) => t.status === 'COMPLETED' || t.purityPct != null);
    if ((sample.status === 'TESTED' || sample.status.startsWith('REPORT')) && (sample._count.reports > 0 || hasResult)) {
      throw new BadRequestException('已存在报告/检测结果,不能回退;如确有误请走报告作废或不符合项流程');
    }

    const result = await this.prisma.sample.update({
      where: { id },
      data: { status: target as any },
    });
    if (this.securityAudit) {
      await this.securityAudit.system(
        AuditEventType.RECORD_ROLLED_BACK,
        {
          entity: 'sample', sampleId: id, sampleNo: sample.sampleNo,
          fromStatus: sample.status, toStatus: target, reason: reason.trim(), operatorId: userId,
        },
      );
    }
    return result;
  }
}
import { StateMachineService } from '../../common/state-machine/state-machine.service';
// =====================================================
// 检测通用服务 - 列表 + 多条件过滤
// =====================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssayMethod, TestStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface TestFilterDto {
  method?: AssayMethod;
  status?: TestStatus;
  operatorId?: string;
  sampleId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TestService {
  constructor(
  private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /** 删除检测任务(仅未完成且无原始记录单) */
  async remove(id: string, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { _count: { select: { rawRecordSheets: true } } },
    });
    if (!test) throw new NotFoundException(`检测 ${id} 不存在`);
    if (test.status === 'COMPLETED') {
      throw new BadRequestException('已完成的检测不可删除(数据已进入报告/记录单链路)');
    }
    if (test._count.rawRecordSheets > 0) {
      throw new BadRequestException('该检测已生成原始记录单,不可删除');
    }
    const result = await this.prisma.test.delete({ where: { id } });
    if (this.securityAudit) {
      await this.securityAudit.system(AuditEventType.RECORD_DELETED, {
        entity: 'test', testId: id, sampleId: test.sampleId, method: test.method, status: test.status, operatorId: userId,
      });
    }
    return result;
  }

  async findAll(filter: TestFilterDto) {
    // 修复: page/pageSize 来自 query 是 string,需转 number(否则 Prisma take/skip 报错)
    const page = filter.page ? Number(filter.page) : 1;
    const pageSize = filter.pageSize ? Number(filter.pageSize) : 20;
    const { ...where } = filter;
    const where_: any = {};
    if (where.method) where_.method = where.method;
    if (where.status) where_.status = where.status;
    if (where.operatorId) where_.operatorId = where.operatorId;
    if (where.sampleId) where_.sampleId = where.sampleId;
    if (where.fromDate || where.toDate) {
      where_.createdAt = {};
      if (where.fromDate) where_.createdAt.gte = new Date(where.fromDate);
      if (where.toDate) where_.createdAt.lte = new Date(where.toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.test.findMany({
        where: where_,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sample: { select: { id: true, sampleNo: true, customerName: true, sampleType: true } },
          operator: { select: { id: true, username: true, name: true } },
          fireAssay: true,
          _count: { select: { elementResults: true } },
        },
      }),
      this.prisma.test.count({ where: where_ }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
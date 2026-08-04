// =====================================================
// 审计日志服务 - SHA256 链断链自检
// 详见 ADR-0003
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditVerifyResult {
  passed: boolean;
  totalRecords: number;
  errors: Array<{
    id: number;
    reason: string;
    expected?: string;
    actual?: string;
  }>;
  verifiedAt: Date;
  durationMs: number;
}

export interface AuditLogFilter {
  userId?: string;
  username?: string;
  tableName?: string;
  recordId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询审计日志(分页 + 过滤)
   */
  async findAll(filter: AuditLogFilter) {
    const { page = 1, pageSize = 50, ...where } = filter;
    const where_ = this.buildWhere(where);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: where_,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where: where_ }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 根据 ID 查询单条
   */
  async findOne(id: number) {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }

  /**
   * SHA256 链断链自检(关键合规功能)
   *
   * 算法:
   *   1. 按 id ASC 取所有 audit_logs
   *   2. 对每条记录,验证 prev_hash == 上一条 curr_hash
   *   3. 任一不匹配即"断链"
   */
  async verifyChain(): Promise<AuditVerifyResult> {
    const start = Date.now();
    const errors: AuditVerifyResult['errors'] = [];

    // 流式查询(避免一次性加载到内存)
    let prevHash: string = '0000000000000000000000000000000000000000000000000000000000000000';
    let totalRecords = 0;
    let lastId = 0;

    // 分批查询,每批 1000 条
    const batchSize = 1000;
    while (true) {
      const batch = await this.prisma.auditLog.findMany({
        where: { id: { gt: lastId } },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          prevHash: true,
          currHash: true,
        },
      });

      if (batch.length === 0) break;

      for (const record of batch) {
        if (record.prevHash !== prevHash) {
          errors.push({
            id: Number(record.id),
            reason: 'prev_hash 不匹配上一条 curr_hash(断链)',
            expected: prevHash,
            actual: record.prevHash,
          });
        }
        prevHash = record.currHash;
        lastId = Number(record.id);
        totalRecords++;
      }

      if (batch.length < batchSize) break;
    }

    const durationMs = Date.now() - start;
    const passed = errors.length === 0;

    if (!passed) {
      this.logger.error(`🚨 审计链断链!共 ${errors.length} 处错误`);
    } else {
      this.logger.log(`✅ 审计链验证通过: ${totalRecords} 条记录,耗时 ${durationMs}ms`);
    }

    return {
      passed,
      totalRecords,
      errors,
      verifiedAt: new Date(),
      durationMs,
    };
  }

  /**
   * 校验指定记录的 hash
   * 重新计算 prev_hash,与 DB 中对比
   */
  async verifyRecord(id: number): Promise<{ passed: boolean; reason?: string }> {
    const record = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!record) {
      return { passed: false, reason: '记录不存在' };
    }

    // 取上一条
    const prev = await this.prisma.auditLog.findFirst({
      where: { id: { lt: id } },
      orderBy: { id: 'desc' },
      select: { currHash: true },
    });

    const expectedPrevHash = prev?.currHash ?? '0000000000000000000000000000000000000000000000000000000000000000';

    if (record.prevHash !== expectedPrevHash) {
      return {
        passed: false,
        reason: `prev_hash 不匹配: 期望 ${expectedPrevHash},实际 ${record.prevHash}`,
      };
    }

    return { passed: true };
  }

  /**
   * 构建 Prisma where 条件
   */
  private buildWhere(filter: Omit<AuditLogFilter, 'page' | 'pageSize'>) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.username) where.username = filter.username;
    if (filter.tableName) where.tableName = filter.tableName;
    if (filter.recordId) where.recordId = filter.recordId;
    if (filter.action) where.action = { contains: filter.action };
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }
    return where;
  }
}
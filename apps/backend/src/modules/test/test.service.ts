// =====================================================
// 检测通用服务 - 列表 + 多条件过滤
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AssayMethod, TestStatus } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: TestFilterDto) {
    const { page = 1, pageSize = 20, ...where } = filter;
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
// =====================================================
// 样品服务 - 接收 / 编号生成 / 批次关联
// 详见 Phase 2 文档 §5.1
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateSampleDto, SampleFilterDto, UpdateSampleDto } from './dto/sample.dto';
import { Prisma, Sample } from '@prisma/client';

@Injectable()
export class SampleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建样品
   * - 自动生成 sampleNo: YYMMDD-NNNN(每日重置)
   * - 状态默认 RECEIVED
   */
  async create(dto: CreateSampleDto, receivedById: string): Promise<Sample> {
    const sampleNo = await this.generateSampleNo();

    return this.prisma.sample.create({
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
}
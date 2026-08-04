// =====================================================
// 试剂服务 - 试剂/批次/库存/预警
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import Decimal from 'decimal.js';
import { Reagent, ReagentType } from '@prisma/client';

@Injectable()
export class ReagentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    code: string;
    name: string;
    type: ReagentType;
    casNo?: string;
    purity?: string;
    manufacturer?: string;
    unit: string;
    packageSize?: string;
    storageCondition?: string;
    hazardClass?: string;
    safetyStock?: string;
  }): Promise<Reagent> {
    return this.prisma.reagent.create({ data });
  }

  async findAll(filter: { type?: ReagentType; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = { deletedAt: null };
    if (where.type) where_.type = where.type;

    const [data, total] = await Promise.all([
      this.prisma.reagent.findMany({
        where: where_,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reagent.count({ where: where_ }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async addLot(reagentId: string, data: {
    lotNo: string;
    receivedDate: Date;
    expiryDate: Date;
    quantity: string;
    unitPrice?: string;
    supplier?: string;
    certificateFileId?: string;
  }) {
    await this.prisma.reagent.findUnique({ where: { id: reagentId } });
    return this.prisma.reagentLot.create({
      data: { reagentId, remainingQty: data.quantity, ...data },
    });
  }

  async recordUsage(reagentLotId: string, data: { quantity: string; testId?: string; operatorId: string; remarks?: string }) {
    const lot = await this.prisma.reagentLot.findUnique({ where: { id: reagentLotId } });
    if (!lot) throw new NotFoundException('批次不存在');

    const usage = new Decimal(data.quantity);
    const remaining = new Decimal(lot.remainingQty);
    if (usage.gt(remaining)) {
      throw new Error(`使用量超过剩余库存(${remaining.toString()})`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.reagentLot.update({
        where: { id: reagentLotId },
        data: { remainingQty: remaining.minus(usage).toString() },
      });
      return tx.reagentUsage.create({ data: { reagentLotId, ...data } });
    });
  }

  /**
   * 库存预警:余量 < 安全库存 OR 即将过期(30 天内)
   */
  async getAlerts() {
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const lots = await this.prisma.reagentLot.findMany({
      where: {
        OR: [{ expiryDate: { lte: inThirtyDays } }, { remainingQty: { lte: 0 } }],
      },
      include: { reagent: true },
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      reagentCode: lot.reagent.code,
      reagentName: lot.reagent.name,
      lotNo: lot.lotNo,
      remainingQty: lot.remainingQty,
      expiryDate: lot.expiryDate,
      alertType: lot.expiryDate <= inThirtyDays ? 'EXPIRING' : 'LOW_STOCK',
    }));
  }
}
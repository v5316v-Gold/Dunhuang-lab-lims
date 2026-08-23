// =====================================================
// 试剂服务 - 试剂/批次/库存/预警
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { Reagent, ReagentType } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';


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

  /** 试剂详情(含批次) */
  async findOne(id: string) {
    const reagent = await this.prisma.reagent.findUnique({
      where: { id },
      include: {
        lots: {
          orderBy: { receivedDate: 'desc' },
        },
      },
    });
    if (!reagent || reagent.deletedAt) throw new NotFoundException(`试剂 ${id} 不存在`);
    return reagent;
  }

  /** 试剂所有批次(扁平,用于批次/领用弹窗选择) */
  async findLots(reagentId: string) {
    return this.prisma.reagentLot.findMany({
      where: { reagentId },
      orderBy: { receivedDate: 'desc' },
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
   * Phase 3 填充(F5): 低库存预警(remainingQty <= safetyStock)
   */
  async getLowStockAlerts() {
    const reagents = await this.prisma.reagent.findMany({
      where: { deletedAt: null },
      include: { lots: { orderBy: { remainingQty: 'desc' } } },
    });
    return reagents
      .map((r) => {
        const totalRemaining = r.lots.reduce(
          (sum, l) => sum + parseFloat(l.remainingQty.toString()),
          0,
        );
        const safety = r.safetyStock ? parseFloat(r.safetyStock.toString()) : 0;
        return {
          reagentId: r.id,
          code: r.code,
          name: r.name,
          unit: r.unit,
          totalRemaining,
          safetyStock: safety,
          low: safety > 0 && totalRemaining <= safety,
        };
      })
      .filter((r) => r.low);
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
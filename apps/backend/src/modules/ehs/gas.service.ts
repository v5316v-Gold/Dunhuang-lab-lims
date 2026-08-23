// =====================================================
// W2 气体管理 - Service
// 架构映射: L2 气体合规(CNAS §7.5 设备与设施 + §6.4 外部提供的产品与服务)
// L3 数据生命周期(采购→入库→领用→消耗→库存预警)
// L1 业务闭环(气体采购申请→合规验收→检测领用→库存预警)
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, GasType, GasUnit, GasPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';
import { RealtimeBus } from '../realtime/realtime.bus';

export interface CreateGasDto {
  code?: string;
  name: string;
  type: GasType;
  purity?: string;
  unit?: GasUnit;
  currentStock?: string | number;
  minStock?: string | number;
  maxStock?: string | number;
  storageLocation?: string;
  hazardLevel?: string;
  msdsFileId?: string;
  inspectionCertFileId?: string;
  responsibleUserId?: string;
  remarks?: string;
}

export interface CreateGasPurchaseDto {
  gasId: string;
  supplier: string;
  quantity: string | number;
  unit: GasUnit;
  unitPrice?: string | number;
  totalAmount?: string | number;
  orderDate?: string;
  expectedDate?: string;
  batchNo?: string;
  certificateFileId?: string;
  remarks?: string;
}

export interface CreateGasUsageDto {
  gasId: string;
  purchaseId?: string;
  testId?: string;
  quantity: string | number;
  unit: GasUnit;
  usedAt?: string;
  purpose?: string;
  sampleId?: string;
  remarks?: string;
}

@Injectable()
export class GasService {
  private readonly logger = new Logger(GasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
    private readonly realtime: RealtimeBus,
  ) {}

  /** 生成唯一气体编号(GAS-YYYYMM-NNNN) */
  private async nextGasCode(): Promise<string> {
    const today = new Date();
    const ym = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0');
    const max = await this.prisma.gas.findFirst({
      where: { code: { startsWith: `GAS-${ym}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const next = max ? (parseInt(max.code.split('-')[2] ?? '0', 10) + 1) : 1;
    return `GAS-${ym}-${String(next).padStart(4, '0')}`;
  }

  /** 生成唯一采购单号(PO-YYYYMMDD-NNNN) */
  private async nextPurchaseNo(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.gasPurchase.findFirst({
      where: { purchaseNo: { startsWith: `PO-${ymd}-` } },
      orderBy: { purchaseNo: 'desc' },
      select: { purchaseNo: true },
    });
    const next = max ? (parseInt(max.purchaseNo.split('-')[2] ?? '0', 10) + 1) : 1;
    return `PO-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** 生成唯一使用记录号(USAGE-YYYYMMDD-NNNN) */
  private async nextUsageNo(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.gasUsage.findFirst({
      where: { usageNo: { startsWith: `USAGE-${ymd}-` } },
      orderBy: { usageNo: 'desc' },
      select: { usageNo: true },
    });
    const next = max ? (parseInt(max.usageNo.split('-')[2] ?? '0', 10) + 1) : 1;
    return `USAGE-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** ============ Gas 主数据 ============ */

  async createGas(dto: CreateGasDto, userId: string) {
    const code = dto.code ?? (await this.nextGasCode());
    const result = await this.prisma.gas.create({
      data: {
        code,
        name: dto.name,
        type: dto.type,
        purity: dto.purity,
        unit: dto.unit ?? GasUnit.CYLINDER,
        currentStock: dto.currentStock != null ? new Prisma.Decimal(dto.currentStock) : new Prisma.Decimal(0),
        minStock: dto.minStock != null ? new Prisma.Decimal(dto.minStock) : new Prisma.Decimal(0),
        maxStock: dto.maxStock != null ? new Prisma.Decimal(dto.maxStock) : null,
        storageLocation: dto.storageLocation,
        hazardLevel: dto.hazardLevel,
        msdsFileId: dto.msdsFileId,
        inspectionCertFileId: dto.inspectionCertFileId,
        responsibleUserId: dto.responsibleUserId ?? userId,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'GAS_CREATED',
      code: result.code,
      name: result.name,
      type: result.type,
    });

    return result;
  }

  async findAllGases(params: {
    type?: GasType;
    status?: string;
    lowStockOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { type, status, lowStockOnly, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (type) where.type = type;
    if (status) where.status = status;
    if (lowStockOnly) {
      // Prisma 不支持字段比较的 where,只能先全量再过滤
    }
    const [items, total] = await Promise.all([
      this.prisma.gas.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { responsible: { select: { id: true, username: true, name: true } } },
      }),
      this.prisma.gas.count({ where }),
    ]);
    const filtered = lowStockOnly
      ? items.filter((g: any) => new Prisma.Decimal(g.currentStock).lte(g.minStock))
      : items;
    return { items: filtered, total, page, pageSize };
  }

  async findGasById(id: string) {
    const gas = await this.prisma.gas.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, username: true, name: true } },
        purchases: { orderBy: { orderDate: 'desc' }, take: 10 },
        usages: { orderBy: { usedAt: 'desc' }, take: 10 },
      },
    });
    if (!gas) throw new NotFoundException(`气体 ${id} 不存在`);
    const isLow = new Prisma.Decimal(gas.currentStock).lte(gas.minStock);
    return { ...gas, isLowStock: isLow };
  }

  /** ============ GasPurchase 采购 ============ */

  async findAllPurchases(params: {
    gasId?: string;
    status?: GasPurchaseStatus;
    page?: number;
    pageSize?: number;
  }) {
    const { gasId, status, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (gasId) where.gasId = gasId;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.gasPurchase.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          gas: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      this.prisma.gasPurchase.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

    async createPurchase(dto: CreateGasPurchaseDto, userId: string) {
    const purchaseNo = await this.nextPurchaseNo();
    const result = await this.prisma.gasPurchase.create({
      data: {
        purchaseNo,
        gasId: dto.gasId,
        supplier: dto.supplier,
        quantity: new Prisma.Decimal(dto.quantity),
        unit: dto.unit,
        unitPrice: dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null,
        totalAmount: dto.totalAmount != null
          ? new Prisma.Decimal(dto.totalAmount)
          : (dto.unitPrice != null
            ? new Prisma.Decimal(dto.quantity).mul(new Prisma.Decimal(dto.unitPrice))
            : null),
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        batchNo: dto.batchNo,
        certificateFileId: dto.certificateFileId,
        status: GasPurchaseStatus.ORDERED,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'GAS_PURCHASE_CREATED',
      purchaseNo,
      gasId: dto.gasId,
      supplier: dto.supplier,
      quantity: String(dto.quantity),
    });

    return result;
  }

  /** 验收:更新状态 + 增加库存 */
  async inspectPurchase(id: string, userId: string, passed: boolean, remarks?: string) {
    const purchase = await this.prisma.gasPurchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException(`采购单 ${id} 不存在`);
    if (purchase.status === GasPurchaseStatus.INSPECTED) {
      throw new BadRequestException('该采购单已验收,不能重复验收');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.gasPurchase.update({
        where: { id },
        data: {
          status: passed ? GasPurchaseStatus.INSPECTED : GasPurchaseStatus.REJECTED,
          inspectedById: userId,
          receivedDate: new Date(),
          remarks: remarks ?? purchase.remarks,
        },
      });
      if (passed) {
        // 增加库存
        const gas = await tx.gas.findUnique({ where: { id: purchase.gasId } });
        if (gas) {
          const newStock = new Prisma.Decimal(gas.currentStock).plus(purchase.quantity);
          await tx.gas.update({
            where: { id: gas.id },
            data: { currentStock: newStock },
          });
        }
      }
      return updated;
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'GAS_PURCHASE_INSPECTED',
      passed,
      quantity: purchase.quantity.toString(),
    });

    return result;
  }

  /** 退货:已验收 → RETURNED,回扣库存 */
  async returnPurchase(id: string, reason?: string) {
    const purchase = await this.prisma.gasPurchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException(`采购单 ${id} 不存在`);
    if (purchase.status !== GasPurchaseStatus.INSPECTED) {
      throw new BadRequestException(`仅已验收(INSPECTED)采购单可退货(当前 ${purchase.status})`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gasPurchase.update({
        where: { id },
        data: { status: GasPurchaseStatus.RETURNED, remarks: reason ? `${purchase.remarks ?? ''}\n退货:${reason}` : purchase.remarks },
      });
      const gas = await tx.gas.findUnique({ where: { id: purchase.gasId } });
      if (gas) {
        const newStock = new Prisma.Decimal(gas.currentStock).minus(purchase.quantity);
        await tx.gas.update({
          where: { id: gas.id },
          data: { currentStock: newStock.isNegative() ? new Prisma.Decimal(0) : newStock },
        });
      }
      await this.securityAudit.system(AuditEventType.RECORD_UNDONE, {
        entity: 'gas_purchase', purchaseId: id, quantity: purchase.quantity.toString(), reason: reason ?? '',
      });
      return updated;
    });
  }

  /** 删除气体主数据(仅无采购/领用,软删) */
  async removeGas(id: string) {
    const gas = await this.prisma.gas.findUnique({ where: { id } });
    if (!gas || gas.deletedAt) throw new NotFoundException(`气体 ${id} 不存在`);
    const [purchaseCount, usageCount] = await Promise.all([
      this.prisma.gasPurchase.count({ where: { gasId: id } }),
      this.prisma.gasUsage.count({ where: { gasId: id } }),
    ]);
    if (purchaseCount > 0 || usageCount > 0) {
      throw new BadRequestException('该气体存在采购/领用记录,不可删除;不再使用请标记 INACTIVE');
    }
    const result = await this.prisma.gas.update({ where: { id }, data: { deletedAt: new Date(), status: 'RETIRED' } });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, { entity: 'gas', gasId: id, code: gas.code });
    return result;
  }

  /** ============ GasUsage 使用记录 ============ */

  async recordUsage(dto: CreateGasUsageDto, userId: string) {
    // 校验库存
    const gas = await this.prisma.gas.findUnique({ where: { id: dto.gasId } });
    if (!gas) throw new NotFoundException(`气体 ${dto.gasId} 不存在`);
    const requested = new Prisma.Decimal(dto.quantity);
    if (requested.lte(0)) throw new BadRequestException('使用量必须大于 0');
    if (requested.gt(new Prisma.Decimal(gas.currentStock))) {
      throw new BadRequestException(`库存不足:当前 ${gas.currentStock},申请 ${dto.quantity}`);
    }

    const usageNo = await this.nextUsageNo();
    const result = await this.prisma.$transaction(async (tx) => {
      // 扣减库存
      const newStock = new Prisma.Decimal(gas.currentStock).minus(requested);
      await tx.gas.update({
        where: { id: gas.id },
        data: { currentStock: newStock },
      });
      // 创建使用记录
      const usage = await tx.gasUsage.create({
        data: {
          usageNo,
          gasId: dto.gasId,
          purchaseId: dto.purchaseId,
          testId: dto.testId,
          usedById: userId,
          quantity: requested,
          unit: dto.unit,
          usedAt: dto.usedAt ? new Date(dto.usedAt) : new Date(),
          purpose: dto.purpose,
          sampleId: dto.sampleId,
          remarks: dto.remarks,
        },
      });
      return usage;
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
          event: 'GAS_USAGE_RECORDED',
          usageNo,
          gasId: dto.gasId,
          quantity: String(dto.quantity),
          purpose: dto.purpose,
        });

        // 低库存告警(<=10% 最大库存)
        const afterGas = await this.prisma.gas.findUnique({ where: { id: dto.gasId } });
        if (afterGas && afterGas.maxStock
            && new Prisma.Decimal(afterGas.currentStock).lte(new Prisma.Decimal(afterGas.maxStock).mul(0.1))) {
          this.realtime.publish({
            type: 'GAS_LOW_STOCK',
            title: '气体库存预警',
            message: `${afterGas.code} ${afterGas.name} 库存仅剩 ${afterGas.currentStock} ${afterGas.unit}`,
            resource: 'gas',
            resourceId: afterGas.id,
            level: 'warning',
            meta: { code: afterGas.code, name: afterGas.name, currentStock: String(afterGas.currentStock), minStock: String(afterGas.minStock) },
          });
        }

        return result;
      }

  async findAllUsages(params: {
    gasId?: string;
    usedById?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { gasId, usedById, startDate, endDate, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (gasId) where.gasId = gasId;
    if (usedById) where.usedById = usedById;
    if (startDate || endDate) {
      where.usedAt = {};
      if (startDate) where.usedAt.gte = new Date(startDate);
      if (endDate) where.usedAt.lte = new Date(endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.gasUsage.findMany({
        where,
        orderBy: { usedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          gas: { select: { id: true, code: true, name: true, type: true } },
          usedBy: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.gasUsage.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 合规摘要(CNAS 评审用) */
  async summary() {
    const [totalGases, activeGases, lowStock, totalPurchases, pendingInspect, totalUsagesThisMonth] = await Promise.all([
      this.prisma.gas.count({ where: { deletedAt: null } }),
      this.prisma.gas.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.gas.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, currentStock: true, minStock: true, type: true },
      }).then((all: any[]) => all.filter((g) => new Prisma.Decimal(g.currentStock).lte(g.minStock))),
      this.prisma.gasPurchase.count({ where: { deletedAt: null } }),
      this.prisma.gasPurchase.count({
        where: { status: { in: [GasPurchaseStatus.ORDERED, GasPurchaseStatus.SHIPPED, GasPurchaseStatus.RECEIVED] } },
      }),
      this.prisma.gasUsage.count({
        where: {
          usedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          deletedAt: null,
        },
      }),
    ]);

    return {
      totalGases,
      activeGases,
      lowStockCount: lowStock.length,
      lowStock,
      totalPurchases,
      pendingInspections: pendingInspect,
      totalUsagesThisMonth,
      checkedAt: new Date().toISOString(),
    };
  }
}
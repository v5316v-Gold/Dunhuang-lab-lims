// =====================================================
// W3 容器管理 - Service
// 架构映射: L2 容器合规(CNAS §7.5 设备与设施 + §6.5 设备)
// L3 数据生命周期(入库→领用→归还→维护→退役)
// L1 业务闭环(容器建档→领用登记→状态变更→校准提醒→合规摘要)
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, ContainerType, ContainerMaterial, ContainerStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface CreateContainerDto {
  name: string;
  type: ContainerType;
  material: ContainerMaterial;
  capacityMl?: string | number;
  toleranceMl?: string | number;
  toleranceClass?: string;
  serialNo?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: string | number;
  location?: string;
  responsibleUserId?: string;
  calibrationDate?: string;
  nextCalDate?: string;
  remarks?: string;
}

export interface UpdateContainerDto {
  name?: string;
  location?: string;
  status?: ContainerStatus;
  responsibleUserId?: string;
  calibrationDate?: string;
  nextCalDate?: string;
  remarks?: string;
}

export interface BorrowContainerDto {
  containerId: string;
  testId?: string;
  sampleId?: string;
  purpose?: string;
  conditionBefore?: string;
  remarks?: string;
}

export interface ReturnContainerDto {
  conditionAfter: string;
  remarks?: string;
}

@Injectable()
export class ContainerService {
  private readonly logger = new Logger(ContainerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /** 生成唯一容器编号(CT-YYYYMM-NNNN) */
  private async nextContainerCode(): Promise<string> {
    const today = new Date();
    const ym = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0');
    const max = await this.prisma.container.findFirst({
      where: { code: { startsWith: `CT-${ym}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const next = max ? (parseInt(max.code.split('-')[2] ?? '0', 10) + 1) : 1;
    return `CT-${ym}-${String(next).padStart(4, '0')}`;
  }

  /** 生成唯一使用记录号(USE-YYYYMMDD-NNNN) */
  private async nextUsageNo(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.containerUsage.findFirst({
      where: { usageNo: { startsWith: `USE-${ymd}-` } },
      orderBy: { usageNo: 'desc' },
      select: { usageNo: true },
    });
    const next = max ? (parseInt(max.usageNo.split('-')[2] ?? '0', 10) + 1) : 1;
    return `USE-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** ============ Container 主数据 ============ */

  async create(dto: CreateContainerDto, userId: string) {
    const code = await this.nextContainerCode();
    const result = await this.prisma.container.create({
      data: {
        code,
        name: dto.name,
        type: dto.type,
        material: dto.material,
        capacityMl: dto.capacityMl != null ? new Prisma.Decimal(dto.capacityMl) : null,
        toleranceMl: dto.toleranceMl != null ? new Prisma.Decimal(dto.toleranceMl) : null,
        toleranceClass: dto.toleranceClass,
        serialNo: dto.serialNo,
        manufacturer: dto.manufacturer,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchasePrice: dto.purchasePrice != null ? new Prisma.Decimal(dto.purchasePrice) : null,
        location: dto.location,
        status: ContainerStatus.IN_STOCK,
        responsibleUserId: dto.responsibleUserId ?? userId,
        calibrationDate: dto.calibrationDate ? new Date(dto.calibrationDate) : null,
        nextCalDate: dto.nextCalDate ? new Date(dto.nextCalDate) : null,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'CONTAINER_CREATED',
      code: result.code,
      name: result.name,
      type: result.type,
      material: result.material,
    });

    return result;
  }

  async findAll(params: {
    type?: ContainerType;
    material?: ContainerMaterial;
    status?: ContainerStatus;
    page?: number;
    pageSize?: number;
  }) {
    const { type, material, status, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (type) where.type = type;
    if (material) where.material = material;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.container.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { responsible: { select: { id: true, username: true, name: true } } },
      }),
      this.prisma.container.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const container = await this.prisma.container.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, username: true, name: true } },
        usages: {
          orderBy: { borrowedAt: 'desc' },
          take: 10,
          include: {
            usedBy: { select: { id: true, username: true, name: true } },
          },
        },
      },
    });
    if (!container) throw new NotFoundException(`容器 ${id} 不存在`);
    // 是否逾期未还
    const overdue = container.usages.find((u: any) => u.returnedAt === null) ?? null;
    // 是否需要校准
    const needsCalibration = container.nextCalDate
      ? new Date(container.nextCalDate).getTime() < Date.now()
      : false;
    return { ...container, overdue, needsCalibration };
  }

  async update(id: string, dto: UpdateContainerDto, userId: string) {
    const existing = await this.prisma.container.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`容器 ${id} 不存在`);

    const result = await this.prisma.container.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        location: dto.location ?? existing.location,
        status: dto.status ?? existing.status,
        responsibleUserId: dto.responsibleUserId ?? existing.responsibleUserId,
        calibrationDate: dto.calibrationDate ? new Date(dto.calibrationDate) : existing.calibrationDate,
        nextCalDate: dto.nextCalDate ? new Date(dto.nextCalDate) : existing.nextCalDate,
        remarks: dto.remarks ?? existing.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'CONTAINER_UPDATED',
      code: result.code,
      changes: Object.keys(dto).filter((k) => dto[k as keyof UpdateContainerDto] !== undefined),
    });

    return result;
  }

  /** ============ ContainerUsage 领用/归还 ============ */

  async borrow(dto: BorrowContainerDto, userId: string) {
    const container = await this.prisma.container.findUnique({ where: { id: dto.containerId } });
    if (!container) throw new NotFoundException(`容器 ${dto.containerId} 不存在`);
    if (container.status === ContainerStatus.RETIRED) {
      throw new BadRequestException('已退役容器不可领用');
    }
    // 检查是否有未归还记录
    const activeUsage = await this.prisma.containerUsage.findFirst({
      where: { containerId: dto.containerId, returnedAt: null, deletedAt: null },
    });
    if (activeUsage) {
      throw new BadRequestException(`容器已被领用(${activeUsage.usageNo}),请先归还`);
    }

    const usageNo = await this.nextUsageNo();
    const result = await this.prisma.$transaction(async (tx) => {
      const usage = await tx.containerUsage.create({
        data: {
          usageNo,
          containerId: dto.containerId,
          usedById: userId,
          testId: dto.testId,
          sampleId: dto.sampleId,
          purpose: dto.purpose,
          borrowedAt: new Date(),
          conditionBefore: dto.conditionBefore,
          remarks: dto.remarks,
        },
      });
      await tx.container.update({
        where: { id: dto.containerId },
        data: { status: ContainerStatus.IN_USE },
      });
      return usage;
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'CONTAINER_BORROWED',
      usageNo,
      containerId: dto.containerId,
      purpose: dto.purpose,
    });

    return result;
  }

  async returnBack(usageId: string, dto: ReturnContainerDto, userId: string) {
    const usage = await this.prisma.containerUsage.findUnique({ where: { id: usageId } });
    if (!usage) throw new NotFoundException(`使用记录 ${usageId} 不存在`);
    if (usage.returnedAt) throw new BadRequestException('该使用记录已归还');

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.containerUsage.update({
        where: { id: usageId },
        data: {
          returnedAt: new Date(),
          conditionAfter: dto.conditionAfter,
          remarks: dto.remarks ?? usage.remarks,
        },
      });
      // 根据归还状态决定容器状态
      const newStatus = dto.conditionAfter?.includes('破损') || dto.conditionAfter?.includes('损坏')
        ? ContainerStatus.MAINTENANCE
        : ContainerStatus.IN_STOCK;
      await tx.container.update({
        where: { id: usage.containerId },
        data: { status: newStatus },
      });
      return updated;
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'CONTAINER_RETURNED',
      usageNo: usage.usageNo,
      containerId: usage.containerId,
      conditionAfter: dto.conditionAfter,
    });

    return result;
  }

  /** ============ 列表与摘要 ============ */

  async findAllUsages(params: {
    containerId?: string;
    usedById?: string;
    activeOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { containerId, usedById, activeOnly, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (containerId) where.containerId = containerId;
    if (usedById) where.usedById = usedById;
    if (activeOnly) where.returnedAt = null;
    const [items, total] = await Promise.all([
      this.prisma.containerUsage.findMany({
        where,
        orderBy: { borrowedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          container: { select: { id: true, code: true, name: true, type: true } },
          usedBy: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.containerUsage.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async summary() {
    const [
      totalContainers, inUseContainers, retiredContainers,
      byType, activeUsages, needsCalibration,
    ] = await Promise.all([
      this.prisma.container.count({ where: { deletedAt: null } }),
      this.prisma.container.count({ where: { status: ContainerStatus.IN_USE, deletedAt: null } }),
      this.prisma.container.count({ where: { status: ContainerStatus.RETIRED, deletedAt: null } }),
      this.prisma.container.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.containerUsage.count({ where: { returnedAt: null, deletedAt: null } }),
      this.prisma.container.findMany({
        where: {
          deletedAt: null,
          nextCalDate: { lt: new Date() },
        },
        select: { id: true, code: true, name: true, nextCalDate: true, type: true },
        take: 20,
      }),
    ]);

    return {
      totalContainers,
      inUseContainers,
      retiredContainers,
      activeUsages,
      needsCalibrationCount: needsCalibration.length,
      needsCalibration,
      byType: byType.map((b: any) => ({ type: b.type, count: b._count.id })),
      checkedAt: new Date().toISOString(),
    };
  }
}
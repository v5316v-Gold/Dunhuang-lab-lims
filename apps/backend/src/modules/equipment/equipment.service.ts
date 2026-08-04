// =====================================================
// 设备服务 - 设备/校准/维护/期间核查
// 详见 ADR-0011 §4 / Phase 3 文档
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Equipment, EquipmentType, EquipmentStatus } from '@prisma/client';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    equipmentNo: string;
    name: string;
    type: EquipmentType;
    model?: string;
    serialNo?: string;
    manufacturer?: string;
    purchaseDate?: Date;
    warrantyExpiresAt?: Date;
    location?: string;
    accuracy?: string;
    range?: string;
  }): Promise<Equipment> {
    return this.prisma.equipment.create({ data });
  }

  async findAll(filter: { type?: EquipmentType; status?: EquipmentStatus; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = { deletedAt: null };
    if (where.type) where_.type = where.type;
    if (where.status) where_.status = where.status;

    const [data, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where: where_,
        orderBy: { equipmentNo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { calibrations: true, maintenances: true, periodicChecks: true } },
        },
      }),
      this.prisma.equipment.count({ where: where_ }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const eq = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        calibrations: { orderBy: { calibrationDate: 'desc' }, take: 5 },
        maintenances: { orderBy: { maintenanceDate: 'desc' }, take: 5 },
        periodicChecks: { orderBy: { checkDate: 'desc' }, take: 5 },
      },
    });
    if (!eq || eq.deletedAt) throw new NotFoundException(`设备 ${id} 不存在`);
    return eq;
  }

  async addCalibration(equipmentId: string, data: {
    calibrationDate: Date;
    calibrationOrg: string;
    certificateNo: string;
    certificateFileId?: string;
    result?: string;
    nextDueDate: Date;
  }) {
    await this.findOne(equipmentId);
    return this.prisma.calibration.create({ data: { equipmentId, ...data } });
  }

  async addMaintenance(equipmentId: string, data: {
    maintenanceType: string;
    maintenanceDate: Date;
    performedBy: string;
    content?: string;
    nextDueDate?: Date;
  }) {
    await this.findOne(equipmentId);
    return this.prisma.maintenance.create({ data: { equipmentId, ...data } });
  }

  async addPeriodicCheck(equipmentId: string, data: {
    checkDate: Date;
    performedBy: string;
    result?: string;
    zScore?: string;
    passed: boolean;
    remarks?: string;
  }) {
    await this.findOne(equipmentId);
    return this.prisma.periodicCheck.create({ data: { equipmentId, ...data } });
  }

  async retire(id: string) {
    await this.findOne(id);
    return this.prisma.equipment.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
  }
}
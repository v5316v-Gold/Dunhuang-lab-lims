// =====================================================
// 设备服务 - 设备/校准/维护/期间核查
// 详见 ADR-0011 §4 / Phase 3 文档
// P0-Fix-3:接入 SecurityAuditService,所有变更写审计
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { Equipment, EquipmentType, EquipmentStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

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
    const eq = await this.prisma.equipment.create({ data });
    // P0-Fix-3: 审计埋点
    await this.securityAudit.system(AuditEventType.EQUIPMENT_REGISTERED, {
      equipmentId: eq.id,
      equipmentNo: eq.equipmentNo,
      name: eq.name,
      type: eq.type,
    });
    return eq;
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
    const eq = await this.findOne(equipmentId);
    const cal = await this.prisma.calibration.create({ data: { equipmentId, ...data } });
    // P0-Fix-3: 校准结果审计
    const passed = !data.result || /pass|合格|√|通过/i.test(data.result);
    await this.securityAudit.system(
      passed ? AuditEventType.CALIBRATION_PASSED : AuditEventType.CALIBRATION_FAILED,
      {
        equipmentId,
        equipmentName: eq.name,
        certificateNo: data.certificateNo,
        calibrationOrg: data.calibrationOrg,
        result: data.result,
      },
    );
    return cal;
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
    const eq = await this.findOne(equipmentId);
    // P0-Fix-1: schema 加了 equipmentName 必填字段
    const check = await this.prisma.periodicCheck.create({
      data: {
        equipmentId,
        equipmentName: eq.name,
        ...data,
      },
    });
    // P0-Fix-3: 期间核查结果审计
    await this.securityAudit.system(
      data.passed ? AuditEventType.PERIODIC_CHECK_PASSED : AuditEventType.PERIODIC_CHECK_FAILED,
      {
        equipmentId,
        equipmentName: eq.name,
        zScore: data.zScore,
        remarks: data.remarks,
      },
    );
    return check;
  }

  async retire(id: string) {
    const eq = await this.findOne(id);
    const retired = await this.prisma.equipment.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
    // P0-Fix-3: 设备报废审计
    await this.securityAudit.system(AuditEventType.EQUIPMENT_RETIRED, {
      equipmentId: id,
      equipmentNo: eq.equipmentNo,
      name: eq.name,
    });
    return retired;
  }

  /**
   * Phase 3 Task 3.1: 设备校准状态(CNAS §6.4 计量溯源性)
   * 返回: CALIBRATED(有效) / EXPIRING_SOON(30 天内到期) / EXPIRED(过期)
   * 规则: 校准过期设备不得用于检测(检测模块调用拦截)
   */
  async getCalibrationStatus(equipmentId: string): Promise<{
    status: 'CALIBRATED' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_CALIBRATION';
    lastCalibration?: { calibrationDate: Date; nextDueDate: Date; certificateNo: string };
    daysRemaining?: number;
  }> {
    const calibration = await this.prisma.calibration.findFirst({
      where: { equipmentId },
      orderBy: { nextDueDate: 'desc' },
    });

    if (!calibration) {
      return { status: 'NO_CALIBRATION' };
    }

    const now = new Date();
    const due = new Date(calibration.nextDueDate);
    const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    let status: 'CALIBRATED' | 'EXPIRING_SOON' | 'EXPIRED';
    if (daysRemaining < 0) {
      status = 'EXPIRED';
    } else if (daysRemaining <= 30) {
      status = 'EXPIRING_SOON';
    } else {
      status = 'CALIBRATED';
    }

    return {
      status,
      lastCalibration: {
        calibrationDate: calibration.calibrationDate,
        nextDueDate: calibration.nextDueDate,
        certificateNo: calibration.certificateNo,
      },
      daysRemaining,
    };
  }

  /**
   * Phase 3 Task 3.1: 设备是否可用于检测(校准有效 + 状态 ACTIVE)
   * 检测模块在开始检测前调用,过期设备拦截
   */
  async isUsableForTesting(equipmentId: string): Promise<{ usable: boolean; reason?: string }> {
    const equipment = await this.prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment) return { usable: false, reason: '设备不存在' };
    if (equipment.status !== 'ACTIVE') {
      return { usable: false, reason: `设备状态 ${equipment.status} 不可用` };
    }
    const cal = await this.getCalibrationStatus(equipmentId);
    if (cal.status === 'EXPIRED') {
      return { usable: false, reason: '校准已过期,禁止用于检测(CNAS §6.4)' };
    }
    if (cal.status === 'NO_CALIBRATION') {
      return { usable: false, reason: '无校准记录,禁止用于检测(CNAS §6.4)' };
    }
    return { usable: true };
  }


  /**
   * Phase 3 填充(F3): 设备综合健康状态(校准/维护/期间核查)
   * 返回每项的最新记录与状态
   */
  async getEquipmentHealthStatus(equipmentId: string) {
    const [calibration, maintenance, periodicCheck] = await Promise.all([
      this.prisma.calibration.findFirst({
        where: { equipmentId },
        orderBy: { nextDueDate: 'desc' },
      }),
      this.prisma.maintenance.findFirst({
        where: { equipmentId },
        orderBy: { maintenanceDate: 'desc' },
      }),
      this.prisma.periodicCheck.findFirst({
        where: { equipmentId },
        orderBy: { checkDate: 'desc' },
      }),
    ]);

    const now = new Date();
    const calStatus = !calibration
      ? 'NO_CALIBRATION'
      : new Date(calibration.nextDueDate) < now
        ? 'EXPIRED'
        : 'OK';
    const maintStatus = !maintenance
      ? 'NO_MAINTENANCE'
      : maintenance.nextDueDate && new Date(maintenance.nextDueDate) < now
        ? 'DUE'
        : 'OK';
    const checkStatus = !periodicCheck
      ? 'NO_PERIODIC_CHECK'
      : periodicCheck.passed
        ? 'OK'
        : 'FAILED';

    return {
      calibration: { status: calStatus, nextDueDate: calibration?.nextDueDate ?? null },
      maintenance: { status: maintStatus, nextDueDate: maintenance?.nextDueDate ?? null },
      periodicCheck: { status: checkStatus, lastCheckDate: periodicCheck?.checkDate ?? null },
      // 综合: 任一不 OK 则设备状态异常
      overall: calStatus === 'OK' && maintStatus === 'OK' && checkStatus === 'OK' ? 'HEALTHY' : 'ATTENTION',
    };
  }

}
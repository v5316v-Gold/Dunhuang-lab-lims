// =====================================================
// 设备管理 3 个 + 废料 1 个 handler — W3-A
// EQUIPMENT / EQUIPMENT_CALIBRATION / EQUIPMENT_MAINTENANCE / WASTE_RECORD
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { ImportHandler, PrismaTx, ValidationError, findOrCreateUser, isBlank } from '../handler.interface';
import { toDate, toNumber, parseMultiString } from '../value-normalizer';

// ---------- EQUIPMENT 设备信息 ----------
export class EquipmentHandler implements ImportHandler {
  readonly entityType = ImportEntityType.EQUIPMENT;

  defaultMappings: Record<string, string> = {
    '设备编号': 'equipmentNo', '设备名称': 'name', '设备型号': 'model', '生产厂': 'manufacturer',
    '放置地点': 'location', '管理人': 'managerName', '设备重要等级': 'importanceLevel',
    '设备配件清单': 'accessoryList', '设备及配件图片': 'imageFileNames', '父记录': 'parentRecordNo',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      imageFileNames: parseMultiString(row.imageFileNames),
      accessoryList: parseMultiString(row.accessoryList),
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.equipmentNo)) errors.push({ field: 'equipmentNo', message: '设备编号必填' });
    if (isBlank(row.name)) errors.push({ field: 'name', message: '设备名称必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const managerId = await findOrCreateUser(tx, { name: row.managerName });

    // 设备编号(equipmentNo)唯一 → upsert
    const existing = await tx.equipment.findUnique({ where: { equipmentNo: row.equipmentNo } });
    const data = {
      equipmentNo: row.equipmentNo,
      code: row.equipmentNo,
      name: row.name,
      model: row.model ?? null,
      manufacturer: row.manufacturer ?? null,
      location: row.location ?? null,
      status: 'ACTIVE' as any,
      remarks: [
        row.managerName ? `管理人:${row.managerName}` : null,
        row.importanceLevel ? `重要等级:${row.importanceLevel}` : null,
        row.accessoryList.length ? `配件:${row.accessoryList.join(', ')}` : null,
      ].filter(Boolean).join('; ') || null,
    };
    let equipmentId: string;
    if (existing) {
      await tx.equipment.update({ where: { id: existing.id }, data });
      equipmentId = existing.id;
    } else {
      const created = await tx.equipment.create({ data: { ...data, type: 'OTHER' as any } });
      equipmentId = created.id;
    }

    // 图片关联
    for (const fname of row.imageFileNames ?? []) {
      const file = await tx.fileAttachment.findFirst({ where: { originalName: { contains: fname.replace(/\.\w+$/, '') } } });
      if (file) {
        await tx.entityAttachment.create({
          data: { entityType: 'EQUIPMENT', entityId: equipmentId, fileId: file.id, role: 'accessory', uploadedById: file.uploadedById },
        });
      }
    }
    return equipmentId;
  }
}

// ---------- EQUIPMENT_CALIBRATION 检定记录 ----------
export class EquipmentCalibrationHandler implements ImportHandler {
  readonly entityType = ImportEntityType.EQUIPMENT_CALIBRATION;

  defaultMappings: Record<string, string> = {
    '设备编号': 'equipmentNo', '设备名称': 'equipmentName', '设备型号': 'equipmentModel',
    '放置地点': 'equipmentLocation', '设备状态': 'equipmentStatus', '检定类型': 'calibrationType',
    '检定周期': 'calibrationCycle', '检定单位': 'calibrationOrg', '检定日期': 'calibratedAt',
    '是否超期': 'isOverdue', '备注': 'remarks', '月份检索': 'periodTag', '父记录': 'parentRecordNo',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return { ...row, calibratedAt: toDate(row.calibratedAt)?.toISOString() ?? new Date().toISOString() };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.equipmentNo)) errors.push({ field: 'equipmentNo', message: '设备编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    // 找设备(不存在则建最小记录)
    const equipment = await tx.equipment.findUnique({ where: { equipmentNo: row.equipmentNo } })
      ?? await tx.equipment.create({
        data: {
          equipmentNo: row.equipmentNo,
          code: row.equipmentNo,
          name: row.equipmentName ?? row.equipmentNo,
          type: 'OTHER' as any,
          status: 'ACTIVE' as any,
          model: row.equipmentModel ?? null,
          location: row.equipmentLocation ?? null,
        },
      });

    const calibration = await tx.calibration.create({
      data: {
        equipmentId: equipment.id,
        calibrationDate: row.calibratedAt ? new Date(row.calibratedAt) : new Date(),
        calibrationOrg: row.calibrationOrg ?? '未知机构',
        certificateNo: `CERT-${Date.now()}`,
        result: row.equipmentStatus ?? 'PASS',
        nextDueDate: row.calibratedAt ? new Date(new Date(row.calibratedAt).getTime() + 365 * 86400 * 1000) : new Date(Date.now() + 365 * 86400 * 1000),
      },
    });
    // 更新设备到期时间
    await tx.equipment.update({
      where: { id: equipment.id },
      data: { nextCalibrationAt: calibration.nextDueDate },
    });
    return calibration.id;
  }
}

// ---------- EQUIPMENT_MAINTENANCE 维保记录 ----------
export class EquipmentMaintenanceHandler implements ImportHandler {
  readonly entityType = ImportEntityType.EQUIPMENT_MAINTENANCE;

  defaultMappings: Record<string, string> = {
    '设备编号': 'equipmentNo', '设备名称': 'equipmentName', '设备型号': 'equipmentModel',
    '放置地点': 'equipmentLocation', '维保日期': 'maintainedAt', '维保人': 'maintainerName',
    '维护内容': 'content', '是否完成保养': 'isCompleted', '异常记录': 'abnormalRecord',
    '备注': 'remarks', '父记录': 'parentRecordNo', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return { ...row, maintainedAt: toDate(row.maintainedAt)?.toISOString() ?? new Date().toISOString() };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.equipmentNo)) errors.push({ field: 'equipmentNo', message: '设备编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const maintainerId = await findOrCreateUser(tx, { name: row.maintainerName });
    const equipment = await tx.equipment.findUnique({ where: { equipmentNo: row.equipmentNo } })
      ?? await tx.equipment.create({
        data: {
          equipmentNo: row.equipmentNo,
          code: row.equipmentNo,
          name: row.equipmentName ?? row.equipmentNo,
          type: 'OTHER' as any,
          status: 'ACTIVE' as any,
          model: row.equipmentModel ?? null,
          location: row.equipmentLocation ?? null,
        },
      });

    const maintenance = await tx.maintenance.create({
      data: {
        equipmentId: equipment.id,
        maintenanceType: 'ROUTINE',
        maintenanceDate: row.maintainedAt ? new Date(row.maintainedAt) : new Date(),
        performedBy: maintainerId ?? equipment.id,  // performedBy 是 String(UUID),回退用 equipment.id
        content: [
          row.content,
          row.abnormalRecord ? `异常:${row.abnormalRecord}` : null,
          row.isCompleted ? `完成:${row.isCompleted}` : null,
        ].filter(Boolean).join('; ') || null,
      },
    });
    return maintenance.id;
  }
}

// ---------- WASTE_RECORD 废液废样登记 ----------
export class WasteRecordHandler implements ImportHandler {
  readonly entityType = ImportEntityType.WASTE_RECORD;

  defaultMappings: Record<string, string> = {
    '样品编号': 'sampleNo', '废样属性': 'attribute', '废样来源': 'source', '样品状态': 'status',
    '重量/g': 'weightG', '登记人员': 'registrarName', '登记日期': 'registeredAt',
    '存放地点': 'location', '回收率/%': 'recoveryPct', '图片信息': 'imageFileNames',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      registeredAt: toDate(row.registeredAt)?.toISOString() ?? new Date().toISOString(),
      weightG: toNumber(row.weightG) ?? 0,
      recoveryPct: toNumber(row.recoveryPct) ?? null,
      imageFileNames: parseMultiString(row.imageFileNames),
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '样品编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const registrarId = await findOrCreateUser(tx, { name: row.registrarName });
    const waste = await tx.wasteRecord.create({
      data: {
        code: row.sampleNo,
        type: 'CONTAMINATED_SAMPLE' as any,
        hazardClass: 'OTHER' as any,
        hazardDesc: row.attribute ?? null,
        sourceType: row.source ?? '检测废液',
        weightKg: (row.weightG ?? 0) / 1000,
        storageLocation: row.location ?? '暂存区',
        hazardManagerId: registrarId,
        status: 'STORED' as any,
        generatedAt: row.registeredAt ? new Date(row.registeredAt) : new Date(),
      },
    });

    // 图片关联
    for (const fname of row.imageFileNames ?? []) {
      const file = await tx.fileAttachment.findFirst({ where: { originalName: { contains: fname.replace(/\.\w+$/, '') } } });
      if (file) {
        await tx.entityAttachment.create({
          data: { entityType: 'WASTE', entityId: waste.id, fileId: file.id, role: 'photo', uploadedById: file.uploadedById },
        });
      }
    }
    return waste.id;
  }
}

// =====================================================
// 耗材管理 8 个 handler — W3-A
// CONTAINER / GAS_PURCHASE / GAS_USAGE / GAS_INVENTORY
// REAGENT_INBOUND / REAGENT_OUTBOUND / REAGENT_INVENTORY / REAGENT_USAGE
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { ImportHandler, PrismaTx, ValidationError, findOrCreateUser, isBlank } from '../handler.interface';
import { toDate, toNumber, parseQuantity, parseMultiString } from '../value-normalizer';

// ---------- CONTAINER 器皿管理 ----------
export class ContainerHandler implements ImportHandler {
  readonly entityType = ImportEntityType.CONTAINER;

  defaultMappings: Record<string, string> = {
    '序号': 'seq', '器材名称': 'name', '型号规格': 'spec', '入库日期': 'inboundAt',
    '入库数量': 'inboundQuantity', '在用': 'inUse', '损耗': 'loss', '库存': 'stock',
    '备注': 'remarks', '图片信息': 'imageFileNames', '父记录': 'parentRecordNo',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.inboundQuantity);
    return {
      ...row,
      inboundAt: toDate(row.inboundAt)?.toISOString() ?? null,
      inboundQtyValue: qty?.value ?? null,
      inboundQtyUnit: qty?.unit ?? null,
      imageFileNames: parseMultiString(row.imageFileNames),
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.name)) errors.push({ field: 'name', message: '器材名称必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const container = await tx.container.create({
      data: {
        code: `CT-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: [row.name, row.spec].filter(Boolean).join(' '),
        type: 'OTHER' as any,
        material: 'GLASS' as any,
        capacityMl: row.spec ? toNumber(row.spec) : null,
        purchaseDate: row.inboundAt ? new Date(row.inboundAt) : null,
        location: row.remarks ?? null,
        remarks: row.inboundQuantity ? `入库:${row.inboundQuantity} 在用:${row.inUse ?? ''} 损耗:${row.loss ?? ''} 库存:${row.stock ?? ''}` : null,
      },
    });

    // 图片关联
    for (const fname of row.imageFileNames ?? []) {
      const file = await tx.fileAttachment.findFirst({ where: { originalName: { contains: fname.replace(/\.\w+$/, '') } } });
      if (file) {
        await tx.entityAttachment.create({
          data: { entityType: 'CONTAINER', entityId: container.id, fileId: file.id, role: 'photo', uploadedById: file.uploadedById },
        });
      }
    }
    return container.id;
  }
}

// ---------- GAS_PURCHASE 气体采购 ----------
export class GasPurchaseHandler implements ImportHandler {
  readonly entityType = ImportEntityType.GAS_PURCHASE;

  defaultMappings: Record<string, string> = {
    '采购日期': 'purchasedAt', '气体编号': 'gasCode', '气体种类': 'gasType', '规格': 'spec',
    '生产厂家': 'manufacturer', '采购数量/瓶': 'quantity', '采购人员': 'purchaserName', '采购单据': 'docFileNames',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.quantity);
    return { ...row, purchasedAt: toDate(row.purchasedAt)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0 };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.gasType)) errors.push({ field: 'gasType', message: '气体种类必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const purchaserId = await findOrCreateUser(tx, { name: row.purchaserName });
    // 找/建气体主记录
    const gas = await tx.gas.findFirst({ where: { code: row.gasCode ?? row.gasType } })
      ?? await tx.gas.create({
        data: {
          code: row.gasCode ?? `GAS-${Date.now()}`,
          name: row.gasType,
          type: 'INERT' as any,
          unit: 'CYLINDER' as any,
          currentStock: 0,
          responsibleUserId: purchaserId,
        },
      });

    const purchase = await tx.gasPurchase.create({
      data: {
        purchaseNo: `PO-IMP-${Date.now()}`,
        gasId: gas.id,
        supplier: row.manufacturer ?? '未知供应商',
        quantity: row.qtyValue ?? 0,
        unit: 'CYLINDER' as any,
        orderDate: row.purchasedAt ? new Date(row.purchasedAt) : new Date(),
        receivedDate: row.purchasedAt ? new Date(row.purchasedAt) : new Date(),
        inspectedById: purchaserId,
        status: 'RECEIVED' as any,
      },
    });
    return purchase.id;
  }
}

// ---------- GAS_USAGE 气体使用 ----------
export class GasUsageHandler implements ImportHandler {
  readonly entityType = ImportEntityType.GAS_USAGE;

  defaultMappings: Record<string, string> = {
    '使用日期': 'usedAt', '气体编号': 'gasCode', '气体种类': 'gasType', '使用数量/瓶': 'quantity',
    '负责人员': 'operatorName', '备注': 'remarks', '父记录': 'parentRecordNo',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.quantity);
    return { ...row, usedAt: toDate(row.usedAt)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0 };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.gasType) && isBlank(row.gasCode)) errors.push({ field: 'gasType', message: '气体必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    const gas = await tx.gas.findFirst({ where: { code: row.gasCode ?? row.gasType } });
    if (!gas) throw new Error(`气体不存在:${row.gasType}(${row.gasCode ?? ''})`);
    const usage = await tx.gasUsage.create({
      data: {
        usageNo: `U-IMP-${Date.now()}`,
        gasId: gas.id,
        usedById: operatorId!,
        quantity: row.qtyValue ?? 0,
        unit: 'CYLINDER' as any,
        usedAt: row.usedAt ? new Date(row.usedAt) : new Date(),
        purpose: '检测使用',
        remarks: row.remarks ?? null,
      },
    });
    return usage.id;
  }
}

// ---------- GAS_INVENTORY 气体库存 ----------
export class GasInventoryHandler implements ImportHandler {
  readonly entityType = ImportEntityType.GAS_INVENTORY;

  defaultMappings: Record<string, string> = {
    '库存日期': 'inventoryDate', '气体编号': 'gasCode', '气体种类': 'gasType', '生产厂家': 'manufacturer',
    '规格': 'spec', '库存数量/瓶': 'stockQuantity', '负责人员': 'managerName', '附件': 'attachmentFileNames',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.stockQuantity);
    return { ...row, inventoryDate: toDate(row.inventoryDate)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0 };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.gasType) && isBlank(row.gasCode)) errors.push({ field: 'gasType', message: '气体必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const managerId = await findOrCreateUser(tx, { name: row.managerName });
    const gas = await tx.gas.findFirst({ where: { code: row.gasCode ?? row.gasType } })
      ?? await tx.gas.create({
        data: {
          code: row.gasCode ?? `GAS-${Date.now()}`,
          name: row.gasType,
          type: 'INERT' as any,
          unit: 'CYLINDER' as any,
          currentStock: row.qtyValue ?? 0,
          responsibleUserId: managerId,
        },
      });
    // 更新库存
    await tx.gas.update({ where: { id: gas.id }, data: { currentStock: row.qtyValue ?? 0 } });
    return gas.id;
  }
}

// ---------- REAGENT_INBOUND 试剂入库 ----------
export class ReagentInboundHandler implements ImportHandler {
  readonly entityType = ImportEntityType.REAGENT_INBOUND;

  defaultMappings: Record<string, string> = {
    '化学试剂名称': 'name', '批号': 'lotNo', '规格': 'spec', '生产厂家': 'manufacturer',
    '入库日期': 'inboundAt', '入库数量': 'quantity', '经手人': 'operatorName', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.quantity);
    return { ...row, inboundAt: toDate(row.inboundAt)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0, qtyUnit: qty?.unit ?? null };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.name)) errors.push({ field: 'name', message: '试剂名称必填' });
    if (isBlank(row.lotNo)) errors.push({ field: 'lotNo', message: '批号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    // 找/建 Reagent 主记录(用 name 复用)
    const reagent = await tx.reagent.findFirst({ where: { name: row.name } })
      ?? await tx.reagent.create({
        data: {
          code: `RE-IMP-${Date.now()}`,
          name: row.name,
          type: 'CHEMICAL' as any,
          manufacturer: row.manufacturer ?? null,
          unit: row.qtyUnit ?? '瓶',
        },
      });
    const lot = await tx.reagentLot.create({
      data: {
        reagentId: reagent.id,
        lotNo: row.lotNo,
        quantity: row.qtyValue ?? 0,
        remainingQty: row.qtyValue ?? 0,
        receivedDate: row.inboundAt ? new Date(row.inboundAt) : new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400 * 1000), // 默认 1 年
        supplier: row.manufacturer ?? null,
      },
    });
    return lot.id;
  }
}

// ---------- REAGENT_OUTBOUND 试剂出库 ----------
export class ReagentOutboundHandler implements ImportHandler {
  readonly entityType = ImportEntityType.REAGENT_OUTBOUND;

  defaultMappings: Record<string, string> = {
    '化学试剂名称': 'name', '批号': 'lotNo', '规格': 'spec', '生产厂家': 'manufacturer',
    '出库日期': 'outboundAt', '出库数量': 'quantity', '经手人': 'operatorName', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.quantity);
    return { ...row, outboundAt: toDate(row.outboundAt)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0, qtyUnit: qty?.unit ?? null };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.name)) errors.push({ field: 'name', message: '试剂名称必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    // 找 reagent + lot
    const reagent = await tx.reagent.findFirst({ where: { name: row.name } });
    if (!reagent) throw new Error(`试剂不存在:${row.name}`);
    const lot = await tx.reagentLot.findFirst({ where: { reagentId: reagent.id, lotNo: row.lotNo } });
    if (!lot) throw new Error(`试剂批次不存在:${row.name}/${row.lotNo}`);

    const usage = await tx.reagentUsage.create({
      data: {
        reagentLotId: lot.id,
        quantity: row.qtyValue ?? 0,
        operatorId: operatorId!,
        usedAt: row.outboundAt ? new Date(row.outboundAt) : new Date(),
        remarks: '出库',
      },
    });
    // 扣减库存
    await tx.reagentLot.update({
      where: { id: lot.id },
      data: { remainingQty: { decrement: row.qtyValue ?? 0 } },
    });
    return usage.id;
  }
}

// ---------- REAGENT_INVENTORY 试剂库存 ----------
export class ReagentInventoryHandler implements ImportHandler {
  readonly entityType = ImportEntityType.REAGENT_INVENTORY;

  defaultMappings: Record<string, string> = {
    '化学试剂名称': 'name', '批号': 'lotNo', '规格': 'spec', '生产厂家': 'manufacturer',
    '库存数量': 'stockQuantity', '物品图片': 'imageFileNames',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.stockQuantity);
    return { ...row, qtyValue: qty?.value ?? 0, qtyUnit: qty?.unit ?? null, imageFileNames: parseMultiString(row.imageFileNames) };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.name)) errors.push({ field: 'name', message: '试剂名称必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const reagent = await tx.reagent.findFirst({ where: { name: row.name } })
      ?? await tx.reagent.create({
        data: {
          code: `RE-IMP-${Date.now()}`,
          name: row.name,
          type: 'CHEMICAL' as any,
          manufacturer: row.manufacturer ?? null,
          unit: row.qtyUnit ?? '瓶',
        },
      });
    const lot = await tx.reagentLot.create({
      data: {
        reagentId: reagent.id,
        lotNo: row.lotNo ?? `STOCK-${Date.now()}`,
        quantity: row.qtyValue ?? 0,
        remainingQty: row.qtyValue ?? 0,
        receivedDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400 * 1000),
        supplier: row.manufacturer ?? null,
      },
    });
    return lot.id;
  }
}

// ---------- REAGENT_USAGE 试剂取用 ----------
export class ReagentUsageHandler implements ImportHandler {
  readonly entityType = ImportEntityType.REAGENT_USAGE;

  defaultMappings: Record<string, string> = {
    '化学试剂名称': 'name', '批号': 'lotNo', '规格': 'spec', '生产厂家': 'manufacturer',
    '使用日期': 'usedAt', '使用数量': 'quantity', '使用去向': 'purpose', '经手人': 'operatorName', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    const qty = parseQuantity(row.quantity);
    return { ...row, usedAt: toDate(row.usedAt)?.toISOString() ?? new Date().toISOString(), qtyValue: qty?.value ?? 0, qtyUnit: qty?.unit ?? null };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.name)) errors.push({ field: 'name', message: '试剂名称必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    const reagent = await tx.reagent.findFirst({ where: { name: row.name } });
    if (!reagent) throw new Error(`试剂不存在:${row.name}`);
    const lot = await tx.reagentLot.findFirst({ where: { reagentId: reagent.id, lotNo: row.lotNo } });
    if (!lot) throw new Error(`试剂批次不存在:${row.name}/${row.lotNo}`);
    const usage = await tx.reagentUsage.create({
      data: {
        reagentLotId: lot.id,
        quantity: row.qtyValue ?? 0,
        operatorId: operatorId!,
        usedAt: row.usedAt ? new Date(row.usedAt) : new Date(),
        remarks: row.purpose ?? null,
      },
    });
    return usage.id;
  }
}

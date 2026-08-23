// =====================================================
// 样品收发台账 5 个 handler — W3-A
// SAMPLE_WORKSHOP / SAMPLE_OVERSEAS / SAMPLE_INBOUND / SAMPLE_OUTBOUND / SAMPLE_INVENTORY
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { ImportHandler, PrismaTx, ValidationError, findOrCreateUser, isBlank } from '../handler.interface';
import { toDate, toNumber, toSampleType } from '../value-normalizer';

// ---------- 公共工具 ----------

/** upsert sample:sampleNo 唯一 → 已存在更新,不存在创建 */
async function upsertSample(tx: PrismaTx, data: any): Promise<string> {
  const sampleNo = data.sampleNo;
  if (!sampleNo) throw new Error('样品编号(sampleNo)必填');

  const existing = await tx.sample.findUnique({ where: { sampleNo } });
  if (existing) {
    await tx.sample.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await tx.sample.create({ data });
  return created.id;
}

/** 创建库存事务 */
async function createInvTx(tx: PrismaTx, data: {
  sampleId: string; type: string; quantity: number; destination?: string | null;
  reason?: string | null; refType?: string | null; operatorId?: string | null;
  reviewerId?: string | null; occurredAt: Date;
}): Promise<void> {
  await tx.inventoryTransaction.create({ data });
}

// ---------- SAMPLE_WORKSHOP 【车间】送样返样 ----------
export class SampleWorkshopHandler implements ImportHandler {
  readonly entityType: ImportEntityType = ImportEntityType.SAMPLE_WORKSHOP;

  defaultMappings: Record<string, string> = {
    '送样日期': 'receivedAt', '送样编号': 'sampleNo', '来样重量/g': 'weightG',
    '送样人': 'senderName', '送样收样人': 'receiverName',
    '送样备注': 'remarks', '返样日期': 'returnedAt',
    '1返样重量/g': 'returnWeightG1', '2返样重量/g': 'returnWeightG2',
    '废液缸含量/g': 'wasteJarContentG', '返样人': 'returnerName', '返样收样人': 'returnReceiverName',
    '返样备注': 'returnRemarks', '返样状态': 'returnStatus', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      receivedAt: toDate(row.receivedAt)?.toISOString() ?? new Date().toISOString(),
      weightG: toNumber(row.weightG) ?? 0,
      returnedAt: toDate(row.returnedAt)?.toISOString() ?? null,
      returnWeightG1: toNumber(row.returnWeightG1) ?? null,
      returnWeightG2: toNumber(row.returnWeightG2) ?? null,
      wasteJarContentG: toNumber(row.wasteJarContentG) ?? null,
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '送样编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const senderId = await findOrCreateUser(tx, { name: row.senderName });
    const receiverId = await findOrCreateUser(tx, { name: row.receiverName });
    const returnerId = await findOrCreateUser(tx, { name: row.returnerName });
    const returnReceiverId = await findOrCreateUser(tx, { name: row.returnReceiverName });

    return upsertSample(tx, {
      sampleNo: row.sampleNo,
      customerName: '车间送样',
      sampleType: (toSampleType(row.sampleType) ?? 'GOLD_INGOT') as any,
      weightG: row.weightG ?? 0,
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : new Date(),
      receivedById: senderId,
      remarks: [
        row.remarks,
        row.returnedAt ? `返样:${row.returnedAt}` : null,
        row.returnStatus ? `返样状态:${row.returnStatus}` : null,
        row.returnWeightG1 != null ? `1返样:${row.returnWeightG1}g` : null,
        row.returnWeightG2 != null ? `2返样:${row.returnWeightG2}g` : null,
        row.wasteJarContentG != null ? `废液缸:${row.wasteJarContentG}g` : null,
      ].filter(Boolean).join('; ') || null,
    });
  }
}

// ---------- SAMPLE_OVERSEAS 【国外】送样返样 ----------
export class SampleOverseasHandler extends SampleWorkshopHandler {
  readonly entityType = ImportEntityType.SAMPLE_OVERSEAS;
  defaultMappings: Record<string, string> = {
    '送样日期': 'receivedAt', '送样编号': 'sampleNo', '来样重量/g': 'weightG',
    '送样人': 'senderName', '收样人': 'receiverName',
    '送样备注': 'remarks', '返样日期': 'returnedAt',
    '1返样重量/g': 'returnWeightG1', '2返样重量/g': 'returnWeightG2',
    '废液缸含量/g': 'wasteJarContentG', '返样人': 'returnerName', '返样收样人': 'returnReceiverName',
    '返样备注': 'returnRemarks', '返样状态': 'returnStatus', '月份检索': 'periodTag',
  };

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const senderId = await findOrCreateUser(tx, { name: row.senderName });
    const receiverId = await findOrCreateUser(tx, { name: row.receiverName });
    const returnerId = await findOrCreateUser(tx, { name: row.returnerName });
    const returnReceiverId = await findOrCreateUser(tx, { name: row.returnReceiverName });

    return upsertSample(tx, {
      sampleNo: row.sampleNo,
      customerName: '国外送样',
      sampleType: (toSampleType(row.sampleType) ?? 'GOLD_INGOT') as any,
      weightG: row.weightG ?? 0,
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : new Date(),
      receivedById: senderId,
      remarks: [
        row.remarks,
        row.returnedAt ? `返样:${row.returnedAt}` : null,
        row.returnStatus ? `返样状态:${row.returnStatus}` : null,
        row.returnWeightG1 != null ? `1返样:${row.returnWeightG1}g` : null,
        row.returnWeightG2 != null ? `2返样:${row.returnWeightG2}g` : null,
        row.wasteJarContentG != null ? `废液缸:${row.wasteJarContentG}g` : null,
      ].filter(Boolean).join('; ') || null,
    });
  }
}

// ---------- SAMPLE_INBOUND 【贵金属】入库 ----------
export class SampleInboundHandler implements ImportHandler {
  readonly entityType = ImportEntityType.SAMPLE_INBOUND;

  defaultMappings: Record<string, string> = {
    '日期': 'inboundAt', '样品编号': 'sampleNo', '入库品类': 'sampleName',
    '入库类型': 'inboundType', '入库重量/g': 'weightG', '入库去向': 'destination',
    '入库人': 'operatorName', '复核人': 'reviewerName', '备注': 'remarks', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      inboundAt: toDate(row.inboundAt)?.toISOString() ?? new Date().toISOString(),
      weightG: toNumber(row.weightG) ?? 0,
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '样品编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    const reviewerId = await findOrCreateUser(tx, { name: row.reviewerName });

    const sampleId = await upsertSample(tx, {
      sampleNo: row.sampleNo,
      customerName: row.sampleName ?? '贵金属入库',
      sampleType: (toSampleType(row.sampleName) ?? 'GOLD_INGOT') as any,
      weightG: row.weightG ?? 0,
      storageLocation: row.destination ?? '保险柜',
      receivedAt: row.inboundAt ? new Date(row.inboundAt) : new Date(),
      receivedById: operatorId,
      remarks: row.remarks ? `${row.sampleName ?? ''} 入库类型:${row.inboundType ?? ''} ${row.remarks}`.trim() : null,
    });

    await createInvTx(tx, {
      sampleId, type: 'INBOUND', quantity: row.weightG ?? 0,
      destination: row.destination, reason: row.inboundType, refType: 'SAMPLE_INBOUND',
      operatorId, reviewerId, occurredAt: row.inboundAt ? new Date(row.inboundAt) : new Date(),
    });
    return sampleId;
  }
}

// ---------- SAMPLE_OUTBOUND 【贵金属】出库 ----------
export class SampleOutboundHandler implements ImportHandler {
  readonly entityType = ImportEntityType.SAMPLE_OUTBOUND;

  defaultMappings: Record<string, string> = {
    '日期': 'outboundAt', '样品编号': 'sampleNo', '出库品类': 'sampleName',
    '出库类型': 'outboundType', '出库重量/g': 'weightG', '出库去向': 'destination',
    '出库人': 'operatorName', '复核人': 'reviewerName', '备注': 'remarks', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      outboundAt: toDate(row.outboundAt)?.toISOString() ?? new Date().toISOString(),
      weightG: toNumber(row.weightG) ?? 0,
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '样品编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    const reviewerId = await findOrCreateUser(tx, { name: row.reviewerName });

    const sampleId = await upsertSample(tx, {
      sampleNo: row.sampleNo,
      customerName: row.sampleName ?? '贵金属出库',
      sampleType: (toSampleType(row.sampleName) ?? 'GOLD_INGOT') as any,
      weightG: row.weightG ?? 0,
      storageLocation: row.destination ?? null,
      receivedAt: row.outboundAt ? new Date(row.outboundAt) : new Date(),
      receivedById: operatorId,
      remarks: row.remarks ? `${row.sampleName ?? ''} 出库类型:${row.outboundType ?? ''} ${row.remarks}`.trim() : null,
    });

    await createInvTx(tx, {
      sampleId, type: 'OUTBOUND', quantity: row.weightG ?? 0,
      destination: row.destination, reason: row.outboundType, refType: 'SAMPLE_OUTBOUND',
      operatorId, reviewerId, occurredAt: row.outboundAt ? new Date(row.outboundAt) : new Date(),
    });
    return sampleId;
  }
}

// ---------- SAMPLE_INVENTORY 【贵金属】库存 ----------
export class SampleInventoryHandler implements ImportHandler {
  readonly entityType = ImportEntityType.SAMPLE_INVENTORY;

  defaultMappings: Record<string, string> = {
    '日期': 'inventoryDate', '样品编号': 'sampleNo', '库存品类': 'sampleName',
    '库存重量/g': 'weightG', '复核人': 'reviewerName', '备注': 'remarks', '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      inventoryDate: toDate(row.inventoryDate)?.toISOString() ?? new Date().toISOString(),
      weightG: toNumber(row.weightG) ?? 0,
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '样品编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const reviewerId = await findOrCreateUser(tx, { name: row.reviewerName });

    const sampleId = await upsertSample(tx, {
      sampleNo: row.sampleNo,
      customerName: row.sampleName ?? '贵金属库存',
      sampleType: (toSampleType(row.sampleName) ?? 'GOLD_INGOT') as any,
      weightG: row.weightG ?? 0,
      status: 'ARCHIVED' as any,
      archivedAt: row.inventoryDate ? new Date(row.inventoryDate) : new Date(),
      remarks: row.remarks,
    });

    await createInvTx(tx, {
      sampleId, type: 'INVENTORY', quantity: row.weightG ?? 0,
      reason: '盘点', refType: 'SAMPLE_INVENTORY',
      reviewerId, occurredAt: row.inventoryDate ? new Date(row.inventoryDate) : new Date(),
    });
    return sampleId;
  }
}

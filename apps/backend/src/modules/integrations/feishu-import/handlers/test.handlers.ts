// =====================================================
// 检测领样 + 检测记录 4 个 handler — W3-A
// TEST_RECEIPT_DOMESTIC / TEST_RECEIPT_OVERSEAS / TEST_RECORD_DOMESTIC / TEST_RECORD_OVERSEAS
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { ImportHandler, PrismaTx, ValidationError, findOrCreateUser, isBlank } from '../handler.interface';
import { toDate, toNumber, toAssayMethod, parseMultiString, emptyToNull } from '../value-normalizer';

// ---------- TEST_RECEIPT_DOMESTIC 检测领样(国内) ----------
export class TestReceiptDomesticHandler implements ImportHandler {
  readonly entityType: ImportEntityType = ImportEntityType.TEST_RECEIPT_DOMESTIC;

  defaultMappings: Record<string, string> = {
    '领样日期': 'receivedAt', '检测编号': 'sampleNo', '检测类型': 'testType',
    '领样品类': 'sampleType', '检测方法': 'method',
    '领取/g': 'takenG', '剩余/g': 'remainG', '使用': 'usedG',
    '使用去向': 'usedDestination', '剩余去向': 'remainDestination',
    '领样人': 'operatorName', '复核人': 'reviewerName', '退样重量/g': 'returnedG',
    '月份检索': 'periodTag',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      receivedAt: toDate(row.receivedAt)?.toISOString() ?? new Date().toISOString(),
      takenG: toNumber(row.takenG) ?? null,
      remainG: toNumber(row.remainG) ?? null,
      usedG: toNumber(row.usedG) ?? null,
      returnedG: toNumber(row.returnedG) ?? null,
      method: toAssayMethod(row.method),
      sampleType: emptyToNull(row.sampleType),
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.sampleNo)) errors.push({ field: 'sampleNo', message: '检测编号必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    const operatorId = await findOrCreateUser(tx, { name: row.operatorName });
    const reviewerId = await findOrCreateUser(tx, { name: row.reviewerName });

    // 检测领样 = 样品进入检测阶段
    const existing = await tx.sample.findUnique({ where: { sampleNo: row.sampleNo } });
    if (existing) {
      await tx.sample.update({
        where: { id: existing.id },
        data: {
          status: 'IN_TEST' as any,
          remarks: [
            existing.remarks,
            `领样:${row.receivedAt ?? ''} 领取${row.takenG ?? ''}g 方法:${row.method ?? ''} 使用去向:${row.usedDestination ?? ''} ${row.remainDestination ?? ''}`,
          ].filter(Boolean).join('; '),
        },
      });
      return existing.id;
    }
    // 样品不存在则创建(检测编号即样品编号)
    const sample = await tx.sample.create({
      data: {
        sampleNo: row.sampleNo,
        customerName: row.sampleType ?? '检测领样',
        sampleType: 'GOLD_INGOT' as any,
        weightG: row.takenG ?? 0,
        receivedAt: row.receivedAt ? new Date(row.receivedAt) : new Date(),
        receivedById: operatorId,
        status: 'IN_TEST' as any,
        remarks: `检测领样 领取${row.takenG ?? ''}g 方法:${row.method ?? ''}`,
      },
    });
    return sample.id;
  }
}

// ---------- TEST_RECEIPT_OVERSEAS 检测领样(国外) ----------
export class TestReceiptOverseasHandler extends TestReceiptDomesticHandler {
  readonly entityType = ImportEntityType.TEST_RECEIPT_OVERSEAS;
  defaultMappings: Record<string, string> = {
    '领样日期': 'receivedAt', '检测编号': 'sampleNo', '检测类型': 'testType',
    '领样品类': 'sampleType', '检测方法': 'method',
    '领取/g': 'takenG', '剩余/g': 'remainG', '使用': 'usedG',
    '使用去向': 'usedDestination', '剩余去向': 'remainDestination',
    '称样人': 'operatorName', '退样重量/g': 'returnedG', '月份检索': 'periodTag',
  };
}

// ---------- TEST_RECORD_DOMESTIC 检测记录(国内) ----------
export class TestRecordDomesticHandler implements ImportHandler {
  readonly entityType: ImportEntityType = ImportEntityType.TEST_RECORD_DOMESTIC;

  defaultMappings: Record<string, string> = {
    '检测时期': 'testedAt', '编号': 'testNo', '检测方法': 'method', '检测类型': 'testType',
    '参与检测人员': 'participantNames', '检测设备': 'equipmentName', '检测地点': 'location',
    '执行标准': 'standardNo', '实验数据与报告': 'reportFileName', '月份检索': 'periodTag',
    '父记录': 'parentRecordNo',
  };

  preprocess(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      testedAt: toDate(row.testedAt)?.toISOString() ?? new Date().toISOString(),
      method: toAssayMethod(row.method),
      participantNames: parseMultiString(row.participantNames),
    };
  }

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.testNo) && isBlank(row.testedAt)) errors.push({ field: 'testNo', message: '检测编号或日期必填' });
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    // 1. 找/建样品(检测编号可能是报告号或样品号,查不到用编号建样品)
    let sampleId: string | null = null;
    if (row.testNo) {
      const sample = await tx.sample.findUnique({ where: { sampleNo: row.testNo } });
      if (sample) sampleId = sample.id;
    }
    if (!sampleId) {
      const created = await tx.sample.create({
        data: {
          sampleNo: row.testNo ?? `T${Date.now()}`,
          customerName: '检测记录导入',
          sampleType: 'GOLD_INGOT' as any,
          weightG: 0,
          status: 'TESTED' as any,
          remarks: `检测记录:${row.standardNo ?? ''} ${row.location ?? ''}`,
        },
      });
      sampleId = created.id;
    }

    // 2. 创建 Test
    const test = await tx.test.create({
      data: {
        sampleId,
        method: (row.method ?? 'ICP_OES') as any,
        status: 'COMPLETED' as any,
        completedAt: row.testedAt ? new Date(row.testedAt) : new Date(),
        remarks: [
          row.testType ? `检测类型:${row.testType}` : null,
          row.equipmentName ? `设备:${row.equipmentName}` : null,
          row.location ? `地点:${row.location}` : null,
          row.standardNo ? `标准:${row.standardNo}` : null,
        ].filter(Boolean).join('; ') || null,
      },
    });

    // 3. 参与人员多对多
    for (const name of row.participantNames ?? []) {
      const userId = await findOrCreateUser(tx, { name });
      if (userId) {
        await tx.testParticipant.create({ data: { testId: test.id, userId, role: 'PARTICIPANT' } });
      }
    }

    // 4. 实验数据与报告 → 找 FileAttachment(按 originalName),关联 EntityAttachment
    if (row.reportFileName) {
      const file = await tx.fileAttachment.findFirst({
        where: { originalName: { contains: String(row.reportFileName).replace(/\.pdf$/i, '') } },
      });
      if (file) {
        await tx.entityAttachment.create({
          data: { entityType: 'TEST', entityId: test.id, fileId: file.id, role: 'report', uploadedById: file.uploadedById },
        });
      }
    }

    return test.id;
  }
}

// ---------- TEST_RECORD_OVERSEAS 检测记录(国外) ----------
export class TestRecordOverseasHandler extends TestRecordDomesticHandler {
  readonly entityType = ImportEntityType.TEST_RECORD_OVERSEAS;
}

// =====================================================
// 飞书表格导入核心服务 — W3-A
// uploadAndPreview / confirmImport / 历史 / 列映射 CRUD
// =====================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ImportEntityType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../../common/audit/security-audit.service';
import { AuditEventType } from '../../../common/audit/audit-event.enum';

import { parseExcel, isValidExcelFile, generateTemplateExcel, ParsedRow } from './excel-parser';
import { ImportHandlerRegistry } from './handlers/registry';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 实体模板列(用于模板下载)
const ENTITY_TEMPLATES: Record<ImportEntityType, { name: string; columns: string[] }> = {
  STAFF: { name: '人员信息', columns: ['序号', '姓名1', '检测组', '工号', '联系电话'] },
  SAMPLE_WORKSHOP: { name: '车间送样返样', columns: ['送样日期', '送样编号', '来样重量/g', '送样人', '送样收样人', '送样备注', '返样日期', '1返样重量/g', '2返样重量/g', '废液缸含量/g', '返样人', '返样收样人', '返样备注', '返样状态', '月份检索'] },
  SAMPLE_OVERSEAS: { name: '国外送样返样', columns: ['送样日期', '送样编号', '来样重量/g', '送样人', '收样人', '送样备注', '返样日期', '1返样重量/g', '2返样重量/g', '废液缸含量/g', '返样人', '返样收样人', '返样备注', '返样状态', '月份检索'] },
  SAMPLE_INBOUND: { name: '贵金属入库', columns: ['日期', '样品编号', '入库品类', '入库类型', '入库重量/g', '入库去向', '入库人', '复核人', '备注', '月份检索'] },
  SAMPLE_OUTBOUND: { name: '贵金属出库', columns: ['日期', '样品编号', '出库品类', '出库类型', '出库重量/g', '出库去向', '出库人', '复核人', '备注', '月份检索'] },
  SAMPLE_INVENTORY: { name: '贵金属库存', columns: ['日期', '样品编号', '库存品类', '库存重量/g', '复核人', '备注', '月份检索'] },
  TEST_RECEIPT_DOMESTIC: { name: '检测领样', columns: ['领样日期', '检测编号', '检测类型', '领样品类', '检测方法', '领取/g', '剩余/g', '使用', '使用去向', '剩余去向', '领样人', '复核人', '退样重量/g', '月份检索'] },
  TEST_RECEIPT_OVERSEAS: { name: '国外检测领样', columns: ['领样日期', '检测编号', '检测类型', '领样品类', '检测方法', '领取/g', '剩余/g', '使用', '使用去向', '剩余去向', '称样人', '退样重量/g', '月份检索'] },
  TEST_RECORD_DOMESTIC: { name: '检测记录', columns: ['检测时期', '编号', '检测方法', '检测类型', '参与检测人员', '检测设备', '检测地点', '执行标准', '实验数据与报告', '月份检索', '父记录'] },
  TEST_RECORD_OVERSEAS: { name: '国外检测记录', columns: ['检测时期', '编号', '检测方法', '检测类型', '参与检测人员', '检测设备', '检测地点', '执行标准', '实验数据与报告', '月份检索', '父记录'] },
  CONTAINER: { name: '器皿管理', columns: ['序号', '器材名称', '型号规格', '入库日期', '入库数量', '在用', '损耗', '库存', '备注', '图片信息', '父记录'] },
  GAS_PURCHASE: { name: '气体采购记录', columns: ['采购日期', '气体编号', '气体种类', '规格', '生产厂家', '采购数量/瓶', '采购人员', '采购单据'] },
  GAS_USAGE: { name: '气体使用记录', columns: ['使用日期', '气体编号', '气体种类', '使用数量/瓶', '负责人员', '备注', '父记录'] },
  GAS_INVENTORY: { name: '气体库存记录', columns: ['库存日期', '气体编号', '气体种类', '生产厂家', '规格', '库存数量/瓶', '负责人员', '附件'] },
  REAGENT_INBOUND: { name: '试剂入库', columns: ['化学试剂名称', '批号', '规格', '生产厂家', '入库日期', '入库数量', '经手人', '月份检索'] },
  REAGENT_OUTBOUND: { name: '试剂出库', columns: ['化学试剂名称', '批号', '规格', '生产厂家', '出库日期', '出库数量', '经手人', '月份检索'] },
  REAGENT_INVENTORY: { name: '试剂库存', columns: ['化学试剂名称', '批号', '规格', '生产厂家', '库存数量', '物品图片'] },
  REAGENT_USAGE: { name: '试剂取用', columns: ['化学试剂名称', '批号', '规格', '生产厂家', '使用日期', '使用数量', '使用去向', '经手人', '月份检索'] },
  EQUIPMENT: { name: '设备信息', columns: ['设备编号', '设备名称', '设备型号', '生产厂', '放置地点', '管理人', '设备重要等级', '设备配件清单', '设备及配件图片', '父记录'] },
  EQUIPMENT_CALIBRATION: { name: '检定记录', columns: ['设备编号', '设备名称', '设备型号', '放置地点', '设备状态', '检定类型', '检定周期', '检定单位', '检定日期', '是否超期', '备注', '月份检索', '父记录'] },
  EQUIPMENT_MAINTENANCE: { name: '维保记录', columns: ['设备编号', '设备名称', '设备型号', '放置地点', '维保日期', '维保人', '维护内容', '是否完成保养', '异常记录', '备注', '父记录', '月份检索'] },
  WASTE_RECORD: { name: '废液废样登记', columns: ['样品编号', '废样属性', '废样来源', '样品状态', '重量/g', '登记人员', '登记日期', '存放地点', '回收率/%', '图片信息'] },
};

@Injectable()
export class FeishuImportService {
  private readonly logger = new Logger(FeishuImportService.name);
  private readonly registry: ImportHandlerRegistry;

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.registry = ImportHandlerRegistry.getInstance(prisma);
  }

  /** 上传 Excel → 解析 + 预览(不写业务表,存 ImportBatch 草稿) */
  async uploadAndPreview(file: any, entityType: ImportEntityType, userId: string) {
    if (!file) throw new BadRequestException('file 字段必填');
    if (!isValidExcelFile(file.originalname)) throw new BadRequestException('请上传 .xlsx / .xls / .csv 文件');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('文件超过 10MB 上限');

    const handler = this.registry.get(entityType);
    const rows: ParsedRow[] = parseExcel(file.buffer);

    if (rows.length === 0) throw new BadRequestException('Excel 无数据行');

    // 列名 → LIMS 字段映射
    const mapped = rows.map(r => this.applyMapping(r, handler.defaultMappings));

    // 预览:逐行校验
    const preview = [];
    let validCount = 0;
    for (let i = 0; i < mapped.length; i++) {
      const processed = handler.preprocess ? handler.preprocess(mapped[i]) : mapped[i];
      const errors = await handler.validate(processed);
      const valid = errors.length === 0;
      if (valid) validCount++;
      preview.push({
        rowNumber: rows[i].rowNumber,
        parsed: processed,
        valid,
        errors,
      });
    }

    // 存 ImportBatch 草稿
    const batch = await this.prisma.importBatch.create({
      data: {
        entityType,
        originalName: file.originalname,
        totalRows: rows.length,
        status: 'PENDING',
        uploadedById: userId,
      },
    });
    await this.prisma.importBatchDetail.createMany({
      data: preview.map(p => ({
        batchId: batch.id,
        rowNumber: p.rowNumber,
        parsedJson: p.parsed as any,
        status: p.valid ? 'OK' : 'ERROR',
        errorJson: p.errors.length ? JSON.parse(JSON.stringify(p.errors)) : undefined,
      })),
    });

    return {
      batchId: batch.id,
      originalName: file.originalname,
      totalRows: rows.length,
      headers: rows.length ? Object.keys(rows[0].values) : [],
      preview: preview.slice(0, 100),  // 前端预览最多 100 行
      stats: { valid: validCount, invalid: rows.length - validCount },
    };
  }

  /** 确认导入:逐行独立事务写入 */
  async confirmImport(batchId: string, userId: string, dryRun = false) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { details: true },
    });
    if (!batch) throw new BadRequestException(`导入批次 ${batchId} 不存在`);
    if (batch.status === 'CONFIRMED') throw new BadRequestException('该批次已确认导入');

    const handler = this.registry.get(batch.entityType);

    let success = 0, failed = 0;
    const errors: any[] = [];
    const createdIds: string[] = [];

    for (const detail of batch.details) {
      if (detail.status === 'ERROR') {
        failed++;
        continue;
      }
      try {
        if (!dryRun) {
          const id = await this.prisma.$transaction(async (tx) => {
            return handler.create(detail.parsedJson as any, tx);
          });
          await this.prisma.importBatchDetail.update({
            where: { id: detail.id },
            data: { status: 'OK', createdId: id },
          });
          createdIds.push(id);
        }
        success++;
      } catch (err) {
        failed++;
        const msg = (err as Error).message;
        errors.push({ rowNumber: detail.rowNumber, message: msg });
        await this.prisma.importBatchDetail.update({
          where: { id: detail.id },
          data: { status: 'ERROR', errorJson: [{ message: msg }] },
        });
      }
    }

    if (!dryRun) {
      await this.prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'CONFIRMED',
          successRows: success,
          failedRows: failed,
          confirmedAt: new Date(),
        },
      });
    }

    // 审计(导入执行记录)
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED as any, {
      event: 'IMPORT_EXECUTED',
      batchId,
      entityType: batch.entityType,
      totalRows: batch.totalRows,
      successRows: success,
      failedRows: failed,
      operatorId: userId,
      dryRun,
    });

    return {
      batchId,
      status: dryRun ? 'PENDING' : 'CONFIRMED',
      stats: { total: batch.totalRows, success, failed },
      errors: errors.slice(0, 50),
      createdIds: createdIds.slice(0, 100),
    };
  }

  /** 导入历史 */
  async findAll(params: { page?: number; pageSize?: number }) {
    const page = params.page ? Number(params.page) : 1;
    const pageSize = params.pageSize ? Number(params.pageSize) : 20;
    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { uploadedBy: { select: { id: true, username: true, name: true } } },
      }),
      this.prisma.importBatch.count(),
    ]);
    return { items, total, page, pageSize };
  }

  /** 批次详情(含每行明细) */
  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, username: true, name: true } },
        details: { orderBy: { rowNumber: 'asc' } },
      },
    });
    if (!batch) throw new BadRequestException(`导入批次 ${id} 不存在`);
    return batch;
  }

  /** 下载实体模板 */
  downloadTemplate(entityType: ImportEntityType): Buffer {
    const tpl = ENTITY_TEMPLATES[entityType];
    if (!tpl) throw new BadRequestException(`未知实体类型: ${entityType}`);
    return generateTemplateExcel(tpl.name, tpl.columns);
  }

  /** 保存自定义列映射模板 */
  async saveColumnMapping(entityType: ImportEntityType, name: string, mappings: Record<string, string>, userId: string) {
    if (!name?.trim()) throw new BadRequestException('映射模板名称必填');
    return this.prisma.importColumnMapping.upsert({
      where: { entityType_name: { entityType, name } },
      create: { entityType, name, mappings, createdById: userId },
      update: { mappings },
    });
  }

  /** 列映射模板列表 */
  async listColumnMappings(entityType?: ImportEntityType) {
    return this.prisma.importColumnMapping.findMany({
      where: entityType ? { entityType } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 实体类型列表(前端下拉) */
  listEntityTypes() {
    return this.registry.list().map(t => ({ entityType: t, label: ENTITY_TEMPLATES[t]?.name ?? t }));
  }

  /** 实体默认映射(前端列映射 UI) */
  getDefaultMappings(entityType: ImportEntityType) {
    const handler = this.registry.get(entityType);
    return { entityType, defaultMappings: handler.defaultMappings };
  }

  // ---------- 内部工具 ----------

  /** 按列名映射(trim + 精确匹配 + 别名) */
  private applyMapping(row: ParsedRow, mappings: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [colName, field] of Object.entries(mappings)) {
      const key = Object.keys(row.values).find(k => k.trim().toLowerCase() === colName.trim().toLowerCase());
      if (key !== undefined) {
        result[field] = row.values[key];
      }
    }
    return result;
  }
}

// =====================================================
// W1 废料管理 - Service
// 架构映射: L2 危废合规(CNAS §7.10 不符合工作)
// L3 数据生命周期(产生→暂存→转移→处置→回收)
// L1 业务闭环(检测产生→危废登记→合规转移→处置确认)
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, WasteType, WasteHazardClass, WasteStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface CreateWasteDto {
  type: WasteType;
  hazardClass: WasteHazardClass;
  hazardDesc?: string;
  sourceType: string;
  sourceTestId?: string;
  sourceSampleId?: string;
  weightKg: string | number;
  volumeL?: string | number;
  containerCount?: number;
  containerType?: string;
  storageLocation: string;
  hazardManagerId?: string;
  remarks?: string;
}

export interface TransferWasteDto {
  receiverName: string;
  receiverLicenceNo: string;
  transferManifestNo: string;
  transferManifestFileId?: string;
}

@Injectable()
export class WasteService {
  private readonly logger = new Logger(WasteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /** 生成唯一编号(WT-YYYYMMDD-NNNN) */
  private async nextCode(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    // 查当日最大序号
    const max = await this.prisma.wasteRecord.findFirst({
      where: { code: { startsWith: `WT-${ymd}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const next = max ? (parseInt(max.code.split('-')[2] ?? '0', 10) + 1) : 1;
    return `WT-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** 创建危废登记 */
  async create(dto: CreateWasteDto, userId: string) {
    if (new Prisma.Decimal(dto.weightKg).lte(0)) {
      throw new BadRequestException('重量必须大于 0');
    }
    const code = await this.nextCode();
    const result = await this.prisma.wasteRecord.create({
      data: {
        code,
        type: dto.type,
        hazardClass: dto.hazardClass,
        hazardDesc: dto.hazardDesc,
        sourceType: dto.sourceType,
        sourceTestId: dto.sourceTestId,
        sourceSampleId: dto.sourceSampleId,
        weightKg: new Prisma.Decimal(dto.weightKg),
        volumeL: dto.volumeL != null ? new Prisma.Decimal(dto.volumeL) : null,
        containerCount: dto.containerCount ?? 1,
        containerType: dto.containerType,
        storageLocation: dto.storageLocation,
        hazardManagerId: dto.hazardManagerId ?? userId,
        remarks: dto.remarks,
      },
    });
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'WASTE_REGISTERED',
      code,
      type: dto.type,
      weightKg: String(dto.weightKg),
    });
    return result;
  }

  /** 查询列表(支持按状态/类型/危险度筛选) */
  async findAll(filter: { status?: WasteStatus; type?: WasteType; hazardClass?: WasteHazardClass; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...w } = filter;
    const where: Prisma.WasteRecordWhereInput = {};
    if (w.status) where.status = w.status;
    if (w.type) where.type = w.type;
    if (w.hazardClass) where.hazardClass = w.hazardClass;
    console.log('[findAll] where=', JSON.stringify(where));
    try {
      const [data, total] = await Promise.all([
        (this.prisma as any).wasteRecord.findMany({
          where, orderBy: { generatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        }),
        (this.prisma as any).wasteRecord.count({ where }),
      ]);
      return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    } catch (e) {
      this.logger.error('findAll failed: ' + e.message);
      throw e;
    }
  }

  /** 详情 */
  async findOne(id: string) {
    try {
      const r = await (this.prisma as any).wasteRecord.findUnique({
        where: { id },
      });
      if (!r) throw new NotFoundException(`危废记录不存在: ${id}`);
      return r;
    } catch (e) {
      this.logger.error('findOne failed for ' + id + ': ' + e.message);
      throw e;
    }
  }

  /** 危废转移登记(双字段校验 CNAS §7.10) */
  async transfer(id: string, dto: TransferWasteDto) {
    const r = await this.findOne(id);
    if (r.status !== 'STORED') {
      throw new BadRequestException(`仅 STORED 状态可转移(当前 ${r.status})`);
    }
    if (!dto.receiverLicenceNo) {
      throw new BadRequestException('危废接收企业资质证号必填(CNAS §7.10)');
    }
    const result = await this.prisma.wasteRecord.update({
      where: { id },
      data: {
        status: 'TRANSFERRED',
        transferredAt: new Date(),
        receiverName: dto.receiverName,
        receiverLicenceNo: dto.receiverLicenceNo,
        transferManifestNo: dto.transferManifestNo,
        transferManifestFileId: dto.transferManifestFileId,
      } as any,
    } as any);
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'WASTE_TRANSFERRED',
      code: r.code, receiver: dto.receiverName, weightKg: String(r.weightKg),
    });
    return result;
  }

  /** 危废处置确认(按类型分支:焚烧/海绵金回收/中和/填埋) */
  async dispose(id: string, params: { method: string; recoveredGoldWeightG?: string | number }) {
    const r = await this.findOne(id);
    if (r.status !== 'TRANSFERRED') {
      throw new BadRequestException(`仅 TRANSFERRED 状态可处置(当前 ${r.status})`);
    }
    let newStatus: WasteStatus = 'DISPOSED';
    if (params.method.includes('回收') || params.method.includes('海绵金')) newStatus = 'RECYCLED_GOLD';
    else if (params.method.includes('中和')) newStatus = 'NEUTRALIZED';
    else if (params.method.includes('焚烧')) newStatus = 'INCINERATED';
    const result = await this.prisma.wasteRecord.update({
      where: { id },
      data: {
        status: newStatus,
        disposalAt: new Date(),
        disposalMethod: params.method,
        recoveredGoldWeightG: params.recoveredGoldWeightG != null
          ? new Prisma.Decimal(params.recoveredGoldWeightG) : null,
      } as any,
    } as any);
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'WASTE_DISPOSED', code: r.code, status: newStatus, recoveredG: String(params.recoveredGoldWeightG ?? ''),
    });
    return result;
  }

  /** 危废合规摘要(CNAS 评审用) */
  async summary() {
    const all = await (this.prisma as any).wasteRecord.findMany({ select: { status: true, type: true, weightKg: true, hazardClass: true } });
    const byStatus: Record<string, number> = {};
    const byClass: Record<string, number> = {};
    let totalKg = 0;
    let storedKg = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byClass[r.hazardClass] = (byClass[r.hazardClass] ?? 0) + 1;
      const w = parseFloat(String(r.weightKg));
      totalKg += w;
      if (r.status === 'STORED') storedKg += w;
    }
    return {
      total: all.length,
      totalKg: totalKg.toFixed(3),
      storedKg: storedKg.toFixed(3),
      transferredKg: (totalKg - storedKg).toFixed(3),
      byStatus,
      byClass,
      alert: storedKg > 50 ? '危废暂存超过 50kg,请尽快转移' : null,
    };
  }
}

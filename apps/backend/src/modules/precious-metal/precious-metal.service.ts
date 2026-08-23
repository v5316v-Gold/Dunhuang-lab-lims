// =====================================================
// W4 贵金属业务 - Service
// 架构映射: L2 取样合规 + 贵金属条码追溯(CNAS §7.5 + §7.8)
// L3 数据生命周期(取样登记 → 样品接转 → 检测 → 出证 → 条码生成 → 监管链)
// L1 业务闭环(客户→取样→送检→检测→报告→条码→客户取回/留存)
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, SamplingMethod, SamplingLocation, SampleForm, MetalType, BarQualityGrade } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';
import { RealtimeBus } from '../realtime/realtime.bus';

export interface CreateSamplingRecordDto {
  sampleId?: string;
  method: SamplingMethod;
  location: SamplingLocation;
  locationDetail?: string;
  sampledAt?: string;
  customerRepName?: string;
  customerRepIdNo?: string;
  witnessName?: string;
  witnessIdNo?: string;
  sampleForm: SampleForm;
  metalType: MetalType;
  declaredWeightG?: string | number;
  declaredPurityPct?: string | number;
  packagingType?: string;
  sealNo?: string;
  chainOfCustody?: string;
  remarks?: string;
}

export interface CreatePreciousMetalBarDto {
  sampleId: string;
  reportId?: string;
  metalType: MetalType;
  qualityGrade: BarQualityGrade;
  weightG: string | number;
  purityPct: string | number;
  serialNo?: string;
  shape?: string;
  dimensions?: string;
  manufacturer?: string;
  manufactureDate?: string;
  qrCodeUrl?: string;
  custodyLocation?: string;
  remarks?: string;
}

@Injectable()
export class PreciousMetalService {
  private readonly logger = new Logger(PreciousMetalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
    private readonly realtime: RealtimeBus,
  ) {}

  /** 生成唯一取样单号(SR-YYYYMMDD-NNNN) */
  private async nextSamplingNo(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.samplingRecord.findFirst({
      where: { recordNo: { startsWith: `SR-${ymd}-` } },
      orderBy: { recordNo: 'desc' },
      select: { recordNo: true },
    });
    const next = max ? (parseInt(max.recordNo.split('-')[2] ?? '0', 10) + 1) : 1;
    return `SR-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** 生成唯一条码(BAR-{METAL}-YYYYMM-NNNN) */
  private async nextBarCode(metalType: MetalType): Promise<string> {
    const today = new Date();
    const ym = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0');
    const metalPrefix = metalType; // AU / AG / PT / ...
    const max = await this.prisma.preciousMetalBar.findFirst({
      where: { barCode: { startsWith: `BAR-${metalPrefix}-${ym}-` } },
      orderBy: { barCode: 'desc' },
      select: { barCode: true },
    });
    const next = max ? (parseInt(max.barCode.split('-')[3] ?? '0', 10) + 1) : 1;
    return `BAR-${metalPrefix}-${ym}-${String(next).padStart(4, '0')}`;
  }

  /** ============ SamplingRecord 取样记录 ============ */

  async createSampling(dto: CreateSamplingRecordDto, userId: string) {
    const newNo = await this.nextSamplingNo();
    // 如果关联样品,确认存在
    if (dto.sampleId) {
      const sample = await this.prisma.sample.findUnique({ where: { id: dto.sampleId } });
      if (!sample) throw new NotFoundException(`样品 ${dto.sampleId} 不存在`);
    }

    const result = await this.prisma.samplingRecord.create({
      data: {
        recordNo: newNo,
        sampleId: dto.sampleId ?? null,
        method: dto.method,
        location: dto.location,
        locationDetail: dto.locationDetail,
        sampledAt: dto.sampledAt ? new Date(dto.sampledAt) : new Date(),
        sampledById: userId,
        customerRepName: dto.customerRepName,
        customerRepIdNo: dto.customerRepIdNo,
        witnessName: dto.witnessName,
        witnessIdNo: dto.witnessIdNo,
        sampleForm: dto.sampleForm,
        metalType: dto.metalType,
        declaredWeightG: dto.declaredWeightG != null ? new Prisma.Decimal(dto.declaredWeightG) : null,
        declaredPurityPct: dto.declaredPurityPct != null ? new Prisma.Decimal(dto.declaredPurityPct) : null,
        packagingType: dto.packagingType,
        sealNo: dto.sealNo,
        chainOfCustody: dto.chainOfCustody,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'SAMPLING_RECORD_CREATED',
      recordNo: result.recordNo,
      method: result.method,
      location: result.location,
      sampleId: result.sampleId,
    });

    return result;
  }

  async findAllSamplings(params: {
    method?: SamplingMethod;
    metalType?: MetalType;
    sampledById?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { method, metalType, sampledById, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (method) where.method = method;
    if (metalType) where.metalType = metalType;
    if (sampledById) where.sampledById = sampledById;
    const [items, total] = await Promise.all([
      this.prisma.samplingRecord.findMany({
        where,
        orderBy: { sampledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sample: { select: { id: true, sampleNo: true, status: true } },
          sampledBy: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.samplingRecord.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findSamplingById(id: string) {
    const sr = await this.prisma.samplingRecord.findUnique({
      where: { id },
      include: {
        sample: { select: { id: true, sampleNo: true, status: true, weightG: true } },
        sampledBy: { select: { id: true, username: true, name: true } },
      },
    });
    if (!sr) throw new NotFoundException(`取样记录 ${id} 不存在`);
    return sr;
  }

  /** ============ PreciousMetalBar 贵金属条码 ============ */

  async createBar(dto: CreatePreciousMetalBarDto, userId: string) {
    // 验证样品存在
    const sample = await this.prisma.sample.findUnique({ where: { id: dto.sampleId } });
    if (!sample) throw new NotFoundException(`样品 ${dto.sampleId} 不存在`);

    const purity = new Prisma.Decimal(dto.purityPct);
    if (purity.lte(0) || purity.gt(100)) {
      throw new BadRequestException('纯度必须 >0 且 ≤100');
    }
    const weight = new Prisma.Decimal(dto.weightG);
    if (weight.lte(0)) {
      throw new BadRequestException('重量必须 >0');
    }

    const barCode = await this.nextBarCode(dto.metalType);
    const result = await this.prisma.preciousMetalBar.create({
      data: {
        barCode,
        sampleId: dto.sampleId,
        reportId: dto.reportId ?? null,
        metalType: dto.metalType,
        qualityGrade: dto.qualityGrade,
        weightG: weight,
        purityPct: purity,
        serialNo: dto.serialNo,
        shape: dto.shape,
        dimensions: dto.dimensions,
        manufacturer: dto.manufacturer,
        manufactureDate: dto.manufactureDate ? new Date(dto.manufactureDate) : null,
        inspectedById: userId,
        inspectedAt: new Date(),
        certifiedAt: dto.qrCodeUrl ? new Date() : null,  // 出证时点
        qrCodeUrl: dto.qrCodeUrl,
        custodyLocation: dto.custodyLocation,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
          event: 'PRECIOUS_METAL_BAR_CREATED',
          barCode: result.barCode,
          metalType: result.metalType,
          qualityGrade: result.qualityGrade,
          weightG: weight.toString(),
          purityPct: purity.toString(),
        });

        this.realtime.publish({
          type: 'BAR_CERTIFIED',
          title: '贵金属条码出证',
          message: `${result.barCode} 出证成功(${result.qualityGrade} ${weight.toFixed(4)}g ${purity.toFixed(2)}%)`,
          resource: 'precious_metal_bar',
          resourceId: result.id,
          level: 'success',
          meta: { barCode: result.barCode, qualityGrade: result.qualityGrade, weightG: weight.toString(), purityPct: purity.toString() },
        });

        return result;
      }

  /** 通过条码查询(扫码追溯场景) */
  async findBarByCode(barCode: string) {
    const bar = await this.prisma.preciousMetalBar.findUnique({
      where: { barCode },
      include: {
        sample: {
          select: {
            id: true, sampleNo: true, customerName: true, status: true,
            weightG: true, receivedAt: true,
            tests: {
              select: {
                id: true, method: true, status: true, purityPct: true,
                uncertainty: true, completedAt: true, qcPassed: true,
              },
            },
            reports: {
              select: {
                id: true, reportNo: true, status: true, issuedAt: true, pdfSha256: true,
              },
            },
          },
        },
        inspectedBy: { select: { id: true, username: true, name: true } },
      },
    });
    if (!bar) throw new NotFoundException(`条码 ${barCode} 不存在`);
    return bar;
  }

  /** 作废条码(仅 ACTIVE,原因必填) */
  async voidBar(id: string, reason?: string) {
    if (!reason?.trim()) throw new BadRequestException('作废原因必填');
    const bar = await this.prisma.preciousMetalBar.findUnique({ where: { id } });
    if (!bar || bar.deletedAt) throw new NotFoundException(`条码 ${id} 不存在`);
    if (bar.status !== 'ACTIVE') throw new BadRequestException(`仅 ACTIVE 条码可作废(当前 ${bar.status})`);
    const result = await this.prisma.preciousMetalBar.update({
      where: { id },
      data: { status: 'VOIDED', remarks: bar.remarks ? `${bar.remarks};作废:${reason.trim()}` : `作废:${reason.trim()}` },
    });
    await this.securityAudit.system(AuditEventType.RECORD_VOIDED, {
      entity: 'precious_metal_bar', barId: id, barCode: bar.barCode, reason: reason.trim(),
    });
    return result;
  }

  /** 删除取样记录(仅未关联条码,软删) */
  async removeSampling(id: string) {
    const s = await this.prisma.samplingRecord.findUnique({ where: { id } });
    if (!s || s.deletedAt) throw new NotFoundException(`取样记录 ${id} 不存在`);
    const barCount = await this.prisma.preciousMetalBar.count({ where: { sampleId: s.sampleId ?? undefined } });
    if (barCount > 0) throw new BadRequestException('该取样已生成条码,不可删除;如条码有误请走作废流程');
    const result = await this.prisma.samplingRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.securityAudit.system(AuditEventType.RECORD_DELETED, { entity: 'sampling', samplingId: id });
    return result;
  }

  async findAllBars(params: {
    metalType?: MetalType;
    qualityGrade?: BarQualityGrade;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { metalType, qualityGrade, status, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (metalType) where.metalType = metalType;
    if (qualityGrade) where.qualityGrade = qualityGrade;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.preciousMetalBar.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sample: { select: { id: true, sampleNo: true, customerName: true } },
          inspectedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.preciousMetalBar.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** ============ 合规摘要 ============ */

  async summary() {
    const [
      totalSampling, todaySampling,
      totalBars, byGrade, byMetal,
      activeBars, voidedBars,
    ] = await Promise.all([
      this.prisma.samplingRecord.count({ where: { deletedAt: null } }),
      this.prisma.samplingRecord.count({
        where: {
          deletedAt: null,
          sampledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.preciousMetalBar.count({ where: { deletedAt: null } }),
      this.prisma.preciousMetalBar.groupBy({
        by: ['qualityGrade'],
        where: { deletedAt: null },
        _count: { id: true },
        _sum: { weightG: true },
      }),
      this.prisma.preciousMetalBar.groupBy({
        by: ['metalType'],
        where: { deletedAt: null },
        _count: { id: true },
        _sum: { weightG: true },
      }),
      this.prisma.preciousMetalBar.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.preciousMetalBar.count({ where: { deletedAt: null, status: 'VOIDED' } }),
    ]);

    return {
      totalSampling,
      todaySampling,
      totalBars,
      activeBars,
      voidedBars,
      byGrade: byGrade.map((g: any) => ({
        grade: g.qualityGrade,
        count: g._count.id,
        totalWeightG: g._sum.weightG?.toString() ?? '0',
      })),
      byMetal: byMetal.map((m: any) => ({
        metal: m.metalType,
        count: m._count.id,
        totalWeightG: m._sum.weightG?.toString() ?? '0',
      })),
      checkedAt: new Date().toISOString(),
    };
  }
}
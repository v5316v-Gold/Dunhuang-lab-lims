// =====================================================
// Phase 1B P0-A:测量不确定度(MU)评定服务
// 严格按 GUM JCGM 100:2008
// u_c = sqrt(Σ u_i^2), U = k × u_c
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, UncertaintyReportStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface CreateUncertaintyDto {
  testId: string;
  measuredValue: string | number;
  ucTypeA?: string | number;        // Type A 统计
  ucTypeBStd?: string | number;     // Type B 标准物质
  ucTypeBEquip?: string | number;   // Type B 仪器
  ucTypeBVol?: string | number;     // Type B 容量
  ucTypeBEnv?: string | number;     // Type B 环境
  ucTypeBOther?: string | number;   // Type B 其他
  parallelRuns?: Array<{ run: number; value: number }>;
  referenceMaterialId?: string;
  equipmentIds?: string[];
  calibrationIds?: string[];
  calculationFileId?: string;
  method?: string;
  methodDescription?: string;
  remarks?: string;
}

export interface ReviewUncertaintyDto {
  reviewComment?: string;
}

export interface PublishUncertaintyDto {
  // 留空 - 复用 system 调 userId
}

@Injectable()
export class UncertaintyService {
  private readonly logger = new Logger(UncertaintyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * GUM u_c 计算: sqrt(Σ u_i^2)
   * 5 类 B 分量任一为 null 视为 0(可不填)
   */
  computeCombinedU(input: {
    ucTypeA?: number | null;
    ucTypeBStd?: number | null;
    ucTypeBEquip?: number | null;
    ucTypeBVol?: number | null;
    ucTypeBEnv?: number | null;
    ucTypeBOther?: number | null;
  }): number {
    const components = [
      input.ucTypeA,
      input.ucTypeBStd,
      input.ucTypeBEquip,
      input.ucTypeBVol,
      input.ucTypeBEnv,
      input.ucTypeBOther,
    ].map((v) => (v == null ? 0 : Math.abs(Number(v))));
    const sumSquares = components.reduce((s, v) => s + v * v, 0);
    return Math.sqrt(sumSquares);
  }

  /** U = k × u_c */
  computeExpandedU(combinedU: number, k = 2.0): number {
    return k * combinedU;
  }

  /** 生成不确定度报告编号(U-YYYYMMDD-NNNN) */
  private async nextReportNo(): Promise<string> {
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.uncertaintyReport.findFirst({
      where: { reportNo: { startsWith: `U-${ymd}-` } },
      orderBy: { reportNo: 'desc' },
      select: { reportNo: true },
    });
    const next = max ? (parseInt(max.reportNo.split('-')[2] ?? '0', 10) + 1) : 1;
    return `U-${ymd}-${String(next).padStart(4, '0')}`;
  }

  /** 公式快照(冻结时存) */
  private buildFormulaSnapshot(dto: CreateUncertaintyDto, combinedU: number, expandedU: number, k: number): string {
    const terms: string[] = [];
    if (dto.ucTypeA != null) terms.push(`u_A²=${dto.ucTypeA}²`);
    if (dto.ucTypeBStd != null) terms.push(`u_B(标物)²=${dto.ucTypeBStd}²`);
    if (dto.ucTypeBEquip != null) terms.push(`u_B(仪器)²=${dto.ucTypeBEquip}²`);
    if (dto.ucTypeBVol != null) terms.push(`u_B(容量)²=${dto.ucTypeBVol}²`);
    if (dto.ucTypeBEnv != null) terms.push(`u_B(环境)²=${dto.ucTypeBEnv}²`);
    if (dto.ucTypeBOther != null) terms.push(`u_B(其他)²=${dto.ucTypeBOther}²`);

    return [
      'GUM JCGM 100:2008 评定',
      `u_c² = ${terms.join(' + ') || '0'}`,
      `u_c = ${combinedU.toExponential(6)}`,
      `U = k × u_c = ${k} × ${combinedU.toExponential(6)} = ${expandedU.toExponential(6)}`,
    ].join('\n');
  }

  /** 创建 DRAFT */
  async create(dto: CreateUncertaintyDto, userId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: dto.testId } });
    if (!test) throw new NotFoundException(`Test ${dto.testId} 不存在`);
    // 校验:不允许同 test 重复报告
    const existing = await this.prisma.uncertaintyReport.findUnique({ where: { testId: dto.testId } });
    if (existing) {
      throw new BadRequestException(`Test ${dto.testId} 已有不确定度报告 ${existing.reportNo}`);
    }

    const inputNum = {
      ucTypeA: dto.ucTypeA != null ? Number(dto.ucTypeA) : null,
      ucTypeBStd: dto.ucTypeBStd != null ? Number(dto.ucTypeBStd) : null,
      ucTypeBEquip: dto.ucTypeBEquip != null ? Number(dto.ucTypeBEquip) : null,
      ucTypeBVol: dto.ucTypeBVol != null ? Number(dto.ucTypeBVol) : null,
      ucTypeBEnv: dto.ucTypeBEnv != null ? Number(dto.ucTypeBEnv) : null,
      ucTypeBOther: dto.ucTypeBOther != null ? Number(dto.ucTypeBOther) : null,
    };
    const combinedU = this.computeCombinedU(inputNum);
    const k = 2.0;
    const expandedU = this.computeExpandedU(combinedU, k);
    const reportNo = await this.nextReportNo();
    const formulaSnapshot = this.buildFormulaSnapshot(dto, combinedU, expandedU, k);

    const result = await this.prisma.uncertaintyReport.create({
      data: {
        reportNo,
        testId: dto.testId,
        status: UncertaintyReportStatus.DRAFT,
        measuredValue: new Prisma.Decimal(dto.measuredValue),
        combinedU: new Prisma.Decimal(combinedU.toFixed(9)),
        expandedU: new Prisma.Decimal(expandedU.toFixed(9)),
        coverageFactor: new Prisma.Decimal(k),
        coverageProb: new Prisma.Decimal(95.0),
        ucTypeA: dto.ucTypeA != null ? new Prisma.Decimal(dto.ucTypeA) : null,
        ucTypeBStd: dto.ucTypeBStd != null ? new Prisma.Decimal(dto.ucTypeBStd) : null,
        ucTypeBEquip: dto.ucTypeBEquip != null ? new Prisma.Decimal(dto.ucTypeBEquip) : null,
        ucTypeBVol: dto.ucTypeBVol != null ? new Prisma.Decimal(dto.ucTypeBVol) : null,
        ucTypeBEnv: dto.ucTypeBEnv != null ? new Prisma.Decimal(dto.ucTypeBEnv) : null,
        ucTypeBOther: dto.ucTypeBOther != null ? new Prisma.Decimal(dto.ucTypeBOther) : null,
        parallelRuns: dto.parallelRuns as any ?? Prisma.JsonNull,
        method: dto.method ?? 'GUM_JCGM_100',
        methodDescription: dto.methodDescription,
        referenceMaterialId: dto.referenceMaterialId,
        equipmentIds: dto.equipmentIds ?? [],
        calibrationIds: dto.calibrationIds ?? [],
        calculationFileId: dto.calculationFileId,
        calculatedById: userId,
        formulaSnapshot,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'UNCERTAINTY_DRAFTED',
      reportNo,
      testId: dto.testId,
      combinedU: combinedU.toExponential(6),
      expandedU: expandedU.toExponential(6),
    });

    return result;
  }

  /** 详情 */
  async findOne(id: string) {
    const u = await this.prisma.uncertaintyReport.findUnique({
      where: { id },
      include: {
        test: { select: { id: true, method: true, purityPct: true, sampleId: true } },
        referenceMaterial: { select: { id: true, code: true, certifiedPct: true, uncertainty: true } },
        calculatedBy: { select: { id: true, username: true, name: true } },
        reviewedBy: { select: { id: true, username: true, name: true } },
        publishedBy: { select: { id: true, username: true, name: true } },
        calculationFile: { select: { id: true, fileName: true, sha256: true } },
      },
    });
    if (!u) throw new NotFoundException(`不确定度报告 ${id} 不存在`);
    return u;
  }

  /** 列表(按 testId) */
  async findAllByTest(testId: string) {
    return this.prisma.uncertaintyReport.findMany({
      where: { testId, deletedAt: null },
      orderBy: { calculatedAt: 'desc' },
      include: {
        calculatedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        publishedBy: { select: { id: true, name: true } },
      },
    });
  }

  /** 校核:DRAFT → REVIEWED */
  async review(id: string, userId: string, dto: ReviewUncertaintyDto) {
    const u = await this.prisma.uncertaintyReport.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`不确定度报告 ${id} 不存在`);
    if (u.status !== UncertaintyReportStatus.DRAFT) {
      throw new BadRequestException(`仅 DRAFT 可校核(当前 ${u.status})`);
    }
    const result = await this.prisma.uncertaintyReport.update({
      where: { id },
      data: {
        status: UncertaintyReportStatus.REVIEWED,
        reviewedById: userId,
        reviewedAt: new Date(),
        remarks: dto.reviewComment ? `${u.remarks ?? ''}\n[Review] ${dto.reviewComment}`.trim() : u.remarks,
      },
    });
    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'UNCERTAINTY_REVIEWED',
      reportNo: result.reportNo,
      reviewedBy: userId,
    });
    return result;
  }

  /** 发布:REVIEWED → PUBLISHED + 同步 Test.uncertainty */
  async publish(id: string, userId: string) {
    const u = await this.prisma.uncertaintyReport.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`不确定度报告 ${id} 不存在`);
    if (u.status !== UncertaintyReportStatus.REVIEWED) {
      throw new BadRequestException(`仅 REVIEWED 可发布(当前 ${u.status})`);
    }
    if (!u.formulaSnapshot) {
      throw new BadRequestException('formulaSnapshot 缺失,无法发布');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const published = await tx.uncertaintyReport.update({
        where: { id },
        data: {
          status: UncertaintyReportStatus.PUBLISHED,
          publishedById: userId,
          publishedAt: new Date(),
        },
      });
      // 同步到 Test.uncertainty(k=2 的 U 值)
      await tx.test.update({
        where: { id: u.testId },
        data: { uncertainty: published.expandedU },
      });
      return published;
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'UNCERTAINTY_PUBLISHED',
      reportNo: result.reportNo,
      testId: u.testId,
      expandedU: String(result.expandedU),
      publishedBy: userId,
    });

    return result;
  }

  /** 合规摘要 */
  async summary() {
    const [total, draft, reviewed, published, voided] = await Promise.all([
      this.prisma.uncertaintyReport.count({ where: { deletedAt: null } }),
      this.prisma.uncertaintyReport.count({ where: { status: 'DRAFT', deletedAt: null } }),
      this.prisma.uncertaintyReport.count({ where: { status: 'REVIEWED', deletedAt: null } }),
      this.prisma.uncertaintyReport.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      this.prisma.uncertaintyReport.count({ where: { status: 'VOIDED', deletedAt: null } }),
    ]);
    return {
      total, draft, reviewed, published, voided,
      coverageRate: total > 0 ? Math.round(published / total * 100) : 0,
      checkedAt: new Date().toISOString(),
    };
  }
}
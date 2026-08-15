// =====================================================
// Phase 1B P0-B: 标准物质全链路服务
// 过期阻断 + 使用台账 + 期间核查校验
// =====================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, ReferenceMaterialStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface CreateReferenceMaterialDto {
  code: string;
  name: string;
  element: string;
  certifiedPct: string | number;
  uncertainty: string | number;        // 证书 U(k=2)
  isCrm?: boolean;
  manufacturer?: string;
  certificateFileId?: string;
  receivedDate?: string;
  expiryDate?: string;
  nextVerificationDate?: string;
  verificationMethod?: string;
  storageLocation?: string;
  storageTemp?: string;
  standardUncertainty?: string | number;
  sha256Certificate?: string;
  remarks?: string;
}

export interface RecordRMUsageDto {
  referenceMaterialId: string;
  lotNo: string;
  testId?: string;
  qcMeasurementId?: string;
  elementResultId?: string;
  uncertaintyReportId?: string;
  purpose: string;            // CALIBRATION / QC_CHECK / VERIFICATION
  usedAmount: string | number;
  remainingAmount: string | number;
  recoveryPct?: string | number;
  certificateFileId?: string;
  remarks?: string;
}

@Injectable()
export class ReferenceMaterialService {
  private readonly logger = new Logger(ReferenceMaterialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /** 检查 RM 是否可用(未过期 + 未退役) */
  private async assertUsable(referenceMaterialId: string) {
    const rm = await this.prisma.referenceMaterial.findUnique({ where: { id: referenceMaterialId } });
    if (!rm) throw new NotFoundException(`标准物质 ${referenceMaterialId} 不存在`);
    if (rm.status === 'RETIRED') {
      throw new BadRequestException(`标准物质 ${rm.code} 已退役,不可使用`);
    }
    if (rm.expiryDate && rm.expiryDate.getTime() < Date.now()) {
      throw new BadRequestException(
        `标准物质 ${rm.code} 已过期(到期日 ${rm.expiryDate.toISOString().substring(0, 10)}),不可使用`,
      );
    }
    if (rm.nextVerificationDate && rm.nextVerificationDate.getTime() < Date.now()) {
      throw new BadRequestException(
        `标准物质 ${rm.code} 已超过期间核查日期(${rm.nextVerificationDate.toISOString().substring(0, 10)}),需先核查`,
      );
    }
    return rm;
  }

  /** 创建 RM */
  async create(dto: CreateReferenceMaterialDto, userId: string) {
    const result = await this.prisma.referenceMaterial.create({
      data: {
        code: dto.code,
        name: dto.name,
        element: dto.element,
        certifiedPct: new Prisma.Decimal(dto.certifiedPct),
        uncertainty: new Prisma.Decimal(dto.uncertainty),
        isCrm: dto.isCrm ?? false,
        manufacturer: dto.manufacturer,
        certificateFileId: dto.certificateFileId,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        nextVerificationDate: dto.nextVerificationDate ? new Date(dto.nextVerificationDate) : null,
        verificationMethod: dto.verificationMethod,
        storageLocation: dto.storageLocation,
        storageTemp: dto.storageTemp,
        standardUncertainty: dto.standardUncertainty != null ? new Prisma.Decimal(dto.standardUncertainty) : null,
        sha256Certificate: dto.sha256Certificate,
        remarks: dto.remarks,
      },
    });

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'REFERENCE_MATERIAL_REGISTERED',
      code: dto.code,
      element: dto.element,
      isCrm: dto.isCrm,
    });

    return result;
  }

  /** 列表(可选过期过滤) */
  async findAll(params: { activeOnly?: boolean; element?: string; page?: number; pageSize?: number }) {
    const { activeOnly, element, page = 1, pageSize = 20 } = params;
    const where: any = { deletedAt: null };
    if (activeOnly) {
      where.status = 'ACTIVE';
      where.OR = [
        { expiryDate: null },
        { expiryDate: { gt: new Date() } },
      ];
    }
    if (element) where.element = element;
    const [items, total] = await Promise.all([
      this.prisma.referenceMaterial.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.referenceMaterial.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 详情 */
  async findOne(id: string) {
    const rm = await this.prisma.referenceMaterial.findUnique({
      where: { id },
      include: { certificateFile: true },
    });
    if (!rm) throw new NotFoundException(`标准物质 ${id} 不存在`);
    // 是否需要期间核查?
    const needsVerification = rm.nextVerificationDate
      ? rm.nextVerificationDate.getTime() < Date.now()
      : false;
    const isExpired = rm.expiryDate
      ? rm.expiryDate.getTime() < Date.now()
      : false;
    return { ...rm, isExpired, needsVerification };
  }

  /** 记录使用台账(每次使用 RM 都登记) */
  async recordUsage(dto: RecordRMUsageDto, userId: string) {
    // 关键: 系统级阻断过期/已退役 RM
    const rm = await this.assertUsable(dto.referenceMaterialId);

    // 校验:用剩余量是否足够
    const usedAmount = Number(dto.usedAmount);
    const remaining = Number(dto.remainingAmount);
    if (usedAmount <= 0) throw new BadRequestException('usedAmount 必须 > 0');
    if (remaining < 0) throw new BadRequestException('remainingAmount 不能为负');

    // 生成台账号
    const today = new Date();
    const ymd = today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
    const max = await this.prisma.referenceMaterialUsage.findFirst({
      where: { usageNo: { startsWith: `RMU-${ymd}-` } },
      orderBy: { usageNo: 'desc' },
      select: { usageNo: true },
    });
    const next = max ? (parseInt(max.usageNo.split('-')[2] ?? '0', 10) + 1) : 1;
    const usageNo = `RMU-${ymd}-${String(next).padStart(4, '0')}`;

    const result = await this.prisma.referenceMaterialUsage.create({
      data: {
        usageNo,
        referenceMaterialId: dto.referenceMaterialId,
        lotNo: dto.lotNo,
        testId: dto.testId,
        qcMeasurementId: dto.qcMeasurementId,
        elementResultId: dto.elementResultId,
        uncertaintyReportId: dto.uncertaintyReportId,
        purpose: dto.purpose,
        usedAmount: new Prisma.Decimal(usedAmount),
        remainingAmount: new Prisma.Decimal(remaining),
        usedById: userId,
        recoveryPct: dto.recoveryPct != null ? new Prisma.Decimal(dto.recoveryPct) : null,
        certificateFileId: dto.certificateFileId,
        remarks: dto.remarks,
      },
    });

    // 自动同步证书 SHA256(从 RM 继承)
    if (!dto.certificateFileId && rm.sha256Certificate) {
      await this.prisma.referenceMaterialUsage.update({
        where: { id: result.id },
        data: { certificateFileId: rm.certificateFileId } as any,
      });
    }

    await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
      event: 'RM_USAGE_RECORDED',
      usageNo,
      rmCode: rm.code,
      purpose: dto.purpose,
      usedAmount: String(usedAmount),
      recoveryPct: dto.recoveryPct != null ? String(dto.recoveryPct) : null,
    });

    return result;
  }

  /** 查询某 RM 的使用历史 */
  async findUsageHistory(rmId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.referenceMaterialUsage.findMany({
        where: { referenceMaterialId: rmId, deletedAt: null },
        orderBy: { usedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { usedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.referenceMaterialUsage.count({ where: { referenceMaterialId: rmId, deletedAt: null } }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 即将过期 / 需核查告警 */
  async findExpiringSoon(daysAhead = 30) {
    const future = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
    const items = await this.prisma.referenceMaterial.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { expiryDate: { lte: future, gt: new Date() } },
          { nextVerificationDate: { lte: future, gt: new Date() } },
        ],
      },
      orderBy: { expiryDate: 'asc' },
    });
    return { items, count: items.length, daysAhead };
  }
}
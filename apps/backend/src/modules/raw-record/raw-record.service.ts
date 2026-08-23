// =====================================================
// 原始记录单服务 — W4-B (CNAS-CL01:2018 §7.5 记录控制)
// 检测完成 → 自动生成原始记录单(数据快照冻结)
// 三签:操作员 → 校核 → 审核(与报告 SoD 独立)
// =====================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class RawRecordSheetService {
  private readonly logger = new Logger(RawRecordSheetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 检测完成时自动生成原始记录单(领域事件订阅或手动触发) */
  async generateForTest(testId: string, operatorId?: string | null): Promise<any> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        sample: true,
        fireAssay: true,
        elementResults: true,
      },
    });
    if (!test) throw new BadRequestException(`检测 ${testId} 不存在`);

    // 已有记录单则跳过(幂等)
    const existing = await this.prisma.rawRecordSheet.findFirst({ where: { testId } });
    if (existing) return existing;

    // 数据快照(冻结原始数据)
    const dataJson: any = {
      method: test.method,
      sampleNo: test.sample?.sampleNo,
      sampleType: test.sample?.sampleType,
      weightG: test.sample?.weightG?.toString(),
      purityPct: test.purityPct?.toString() ?? null,
      uncertainty: test.uncertainty?.toString() ?? null,
      qcPassed: test.qcPassed,
      completedAt: test.completedAt?.toISOString() ?? null,
      fireAssay: test.fireAssay
        ? {
            sampleWeightG: test.fireAssay.sampleWeightG?.toString(),
            mixingTempC: test.fireAssay.mixingTempC?.toString(),
            mixingDurationMin: test.fireAssay.mixingDurationMin?.toString(),
            fusingTempC: test.fireAssay.fusingTempC?.toString(),
            fusingDurationMin: test.fireAssay.fusingDurationMin?.toString(),
            cupellationTempC: test.fireAssay.cupellationTempC?.toString(),
            cupellationDurationMin: test.fireAssay.cupellationDurationMin?.toString(),
            partingAcid: test.fireAssay.partingAcid,
            partingDurationMin: test.fireAssay.partingDurationMin?.toString(),
            annealingTempC: test.fireAssay.annealingTempC?.toString(),
            prillWeightG: test.fireAssay.prillWeightG?.toString(),
            qcRecoveryPct: test.fireAssay.qcRecoveryPct?.toString(),
          }
        : null,
      elementResults: test.elementResults?.map(r => ({
        element: r.element,
        concentration: r.concentration?.toString(),
        unit: r.unit,
      })) ?? [],
    };

    const sheet = await this.prisma.rawRecordSheet.create({
      data: {
        sheetNo: `RS-${new Date().getFullYear()}-${String(await this.nextSeq()).padStart(4, '0')}`,
        testId: test.id,
        sampleId: test.sampleId,
        method: test.method,
        dataJson,
        operatorId: operatorId ?? test.operatorId,
        status: 'DRAFT',
      },
    });
    this.logger.log(`已生成原始记录单 ${sheet.sheetNo}(test ${testId})`);
    return sheet;
  }

  /** 锁定(数据冻结,不可再改) */
  async lock(id: string, userId: string): Promise<any> {
    const sheet = await this.findOne(id);
    if (sheet.status !== 'DRAFT') throw new BadRequestException(`记录单已 ${sheet.status}`);
    return this.prisma.rawRecordSheet.update({
      where: { id },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
  }

  /** 三签:操作员/校核/审核(SoD:三签互斥) */
  async sign(id: string, role: 'OPERATOR' | 'REVIEWER' | 'APPROVER', userId: string): Promise<any> {
    const sheet = await this.findOne(id);
    if (sheet.status === 'SIGNED') throw new BadRequestException('记录单已全部签署');

    // SoD:三签互斥
    const ids = [sheet.operatorId, sheet.reviewerId, sheet.approverId].filter(Boolean);
    if (ids.includes(userId)) throw new BadRequestException('同一人不能签署多个角色(SoD)');

    const data: any = {};
    if (role === 'OPERATOR') data.operatorId = userId;
    if (role === 'REVIEWER') data.reviewerId = userId;
    if (role === 'APPROVER') data.approverId = userId;

    const updated = await this.prisma.rawRecordSheet.update({ where: { id }, data });

    // 全部签完 → SIGNED + 生成 PDF
    if (updated.operatorId && updated.reviewerId && updated.approverId) {
      const pdf = this.generatePdfText(updated);
      const pdfSha256 = createHash('sha256').update(pdf).digest('hex');
      await this.prisma.rawRecordSheet.update({
        where: { id },
        data: { status: 'SIGNED', pdfSha256 },
      });
    }
    return this.findOne(id);
  }

  /** PDF 纯文本生成(简化,评审出示用) */
  private generatePdfText(sheet: any): string {
    const d = sheet.dataJson || {};
    return [
      '=================== 原始记录单 ===================',
      `记录单号: ${sheet.sheetNo}`,
      `方法: ${sheet.method}`,
      `样品编号: ${d.sampleNo ?? ''}`,
      `样品类型: ${d.sampleType ?? ''}`,
      `样品重量: ${d.weightG ?? ''} g`,
      `检测完成时间: ${d.completedAt ?? ''}`,
      `纯度: ${d.purityPct ?? '-'}%`,
      `不确定度: ${d.uncertainty ?? '-'}%`,
      `QC 判定: ${d.qcPassed === true ? '通过' : d.qcPassed === false ? '失败' : '-'}`,
      '',
      '--- 火试金工艺 ---',
      `称样量: ${d.fireAssay?.sampleWeightG ?? '-'} g`,
      `混料: ${d.fireAssay?.mixingTempC ?? '-'}°C ${d.fireAssay?.mixingDurationMin ?? '-'}min`,
      `熔融: ${d.fireAssay?.fusingTempC ?? '-'}°C ${d.fireAssay?.fusingDurationMin ?? '-'}min`,
      `灰吹: ${d.fireAssay?.cupellationTempC ?? '-'}°C ${d.fireAssay?.cupellationDurationMin ?? '-'}min`,
      `分金: ${d.fireAssay?.partingAcid ?? '-'} ${d.fireAssay?.partingDurationMin ?? '-'}min`,
      `退火: ${d.fireAssay?.annealingTempC ?? '-'}°C`,
      `灰吹后金粒重: ${d.fireAssay?.prillWeightG ?? '-'} g`,
      `QC 回收率: ${d.fireAssay?.qcRecoveryPct ?? '-'}%`,
      '',
      '--- ICP 元素结果 ---',
      ...(d.elementResults ?? []).map((r: any) => `  ${r.element}: ${r.concentration} ${r.unit ?? ''}`),
      '',
      `操作员签名: ${sheet.operatorId ?? ''}`,
      `校核人签名: ${sheet.reviewerId ?? ''}`,
      `审核人签名: ${sheet.approverId ?? ''}`,
      `SHA256: ${createHash('sha256').update(JSON.stringify(d)).digest('hex')}`,
    ].join('\n');
  }

  async findOne(id: string) {
    const sheet = await this.prisma.rawRecordSheet.findUnique({
      where: { id },
      include: {
        sample: { select: { id: true, sampleNo: true } },
        test: { select: { id: true, status: true } },
        operator: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    if (!sheet) throw new BadRequestException(`原始记录单 ${id} 不存在`);
    return sheet;
  }

  /** 列表(按样品/检测/状态) */
  async findAll(filter: { sampleId?: string; status?: string; page?: number; pageSize?: number }) {
    const page = filter.page ? Number(filter.page) : 1;
    const pageSize = filter.pageSize ? Number(filter.pageSize) : 20;
    const where: any = {};
    if (filter.sampleId) where.sampleId = filter.sampleId;
    if (filter.status) where.status = filter.status;
    const [items, total] = await Promise.all([
      this.prisma.rawRecordSheet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sample: { select: { sampleNo: true } },
          operator: { select: { name: true } },
          reviewer: { select: { name: true } },
          approver: { select: { name: true } },
        },
      }),
      this.prisma.rawRecordSheet.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  private async nextSeq(): Promise<number> {
    const year = new Date().getFullYear();
    const prefix = `RS-${year}-`;
    const last = await this.prisma.rawRecordSheet.findFirst({
      where: { sheetNo: { startsWith: prefix } },
      orderBy: { sheetNo: 'desc' },
    });
    if (!last) return 1;
    const num = parseInt(last.sheetNo.replace(prefix, ''), 10);
    return isNaN(num) ? 1 : num + 1;
  }
}

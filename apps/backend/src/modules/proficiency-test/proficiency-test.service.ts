// =====================================================
// 能力验证 PT 服务 — W4-A (CNAS-CL01:2018 §7.7)
// 基于现有 ProficiencyTest 模型:
//   PT 年度计划 → 实施 → 结果录入 → z 值评价 → 报告归档
// 评价: |z| ≤ 2 满意,2 < |z| < 3 可疑,|z| ≥ 3 不满意
// =====================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProficiencyTestService {
  private readonly logger = new Logger(ProficiencyTestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 创建 PT 计划 */
  async create(dto: {
    ptNo: string; organizer: string; item: string; method: string;
    startDate: string; endDate?: string; remarks?: string; createdById: string;
  }) {
    const existing = await this.prisma.proficiencyTest.findUnique({ where: { ptNo: dto.ptNo } });
    if (existing) throw new BadRequestException(`PT 编号已存在: ${dto.ptNo}`);
    return this.prisma.proficiencyTest.create({
      data: {
        ptNo: dto.ptNo,
        organizer: dto.organizer,
        item: dto.item,
        method: dto.method,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        remarks: dto.remarks,
        createdById: dto.createdById,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  /** 列表(年度过滤/分页) */
  async findAll(filter: { year?: number; page?: number; pageSize?: number }) {
    const page = filter.page ? Number(filter.page) : 1;
    const pageSize = filter.pageSize ? Number(filter.pageSize) : 20;
    const where: any = filter.year ? {
      startDate: { gte: new Date(filter.year, 0, 1), lt: new Date(filter.year + 1, 0, 1) },
    } : {};
    const [items, total] = await Promise.all([
      this.prisma.proficiencyTest.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      this.prisma.proficiencyTest.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 详情 */
  async findOne(id: string) {
    const pt = await this.prisma.proficiencyTest.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!pt) throw new BadRequestException(`PT ${id} 不存在`);
    return pt;
  }

  /**
   * 录入结果 + z 值评价
   * z = (measured - assigned) / sd;assigned 期望值,sd 能力评定标准差
   */
  async recordResult(id: string, dto: {
    zScore: number; result: 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY';
    remarks?: string;
  }) {
    const pt = await this.findOne(id);
    return this.prisma.proficiencyTest.update({
      where: { id },
      data: {
        zScore: dto.zScore,
        result: dto.result,
        remarks: dto.remarks ?? pt.remarks,
        endDate: new Date(),
      },
    });
  }

  /** 按 z 值自动判定 */
  static judgeByZ(z: number): 'SATISFACTORY' | 'QUESTIONABLE' | 'UNSATISFACTORY' {
    const abs = Math.abs(z);
    if (abs <= 2) return 'SATISFACTORY';
    if (abs < 3) return 'QUESTIONABLE';
    return 'UNSATISFACTORY';
  }

  /** 年度 PT 汇总(评审展示:每年 ≥1 次 PT,覆盖在用方法) */
  async annualSummary() {
    const pts = await this.prisma.proficiencyTest.findMany({
      orderBy: { startDate: 'desc' },
    });
    const byYear = new Map<number, any[]>();
    for (const pt of pts) {
      const year = pt.startDate.getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(pt);
    }
    return {
      years: [...byYear.keys()].sort((a, b) => b - a),
      byYear: Object.fromEntries(byYear),
      total: pts.length,
      satisfactory: pts.filter(p => p.result === 'SATISFACTORY').length,
      questionable: pts.filter(p => p.result === 'QUESTIONABLE').length,
      unsatisfactory: pts.filter(p => p.result === 'UNSATISFACTORY').length,
    };
  }
}

// =====================================================
// EHS 服务 - 隐患/应急
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { Hazard, HazardSeverity, HazardStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class EhsService {
  constructor(private readonly prisma: PrismaService) {}

  async createHazard(data: {
    source: string;
    description: string;
    severity: HazardSeverity;
    location?: string;
    reportedById: string;
  }): Promise<Hazard> {
    return this.prisma.hazard.create({ data: { ...data, status: 'REPORTED' } });
  }

  async findHazards(filter: { severity?: HazardSeverity; status?: HazardStatus; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = {};
    if (where.severity) where_.severity = where.severity;
    if (where.status) where_.status = where.status;

    const [data, total] = await Promise.all([
      this.prisma.hazard.findMany({
        where: where_,
        orderBy: { reportedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.hazard.count({ where: where_ }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async resolveHazard(id: string, resolvedById: string, resolution: string) {
    const h = await this.prisma.hazard.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('隐患不存在');
    return this.prisma.hazard.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById, resolution },
    });
  }

  async createEmergencyPlan(data: { planType: string; title: string; content: string; approvedBy?: string; fileId?: string }) {
    return this.prisma.emergencyPlan.create({ data: { ...data, approvedAt: data.approvedBy ? new Date() : undefined } });
  }

  async findEmergencyPlans() {
    return this.prisma.emergencyPlan.findMany({ orderBy: { planType: 'asc' } });
  }
}
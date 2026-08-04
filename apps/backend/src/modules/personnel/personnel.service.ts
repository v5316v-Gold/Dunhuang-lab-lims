// =====================================================
// 人员服务 - 人员档案 + 培训 + 能力矩阵
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  async createPersonnel(data: {
    userId: string;
    employeeNo: string;
    name: string;
    gender?: string;
    birthDate?: Date;
    idCard?: string;
    phone?: string;
    email?: string;
    education?: string;
    title?: string;
    certNo?: string;
    hiredate?: Date;
  }) {
    return this.prisma.personnel.create({ data });
  }

  async findAll(filter: { employeeNo?: string; name?: string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: any = { deletedAt: null };
    if (where.employeeNo) where_.employeeNo = { contains: where.employeeNo };
    if (where.name) where_.name = { contains: where.name };

    const [data, total] = await Promise.all([
      this.prisma.personnel.findMany({
        where: where_,
        orderBy: { employeeNo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, username: true, role: true } } },
      }),
      this.prisma.personnel.count({ where: where_ }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const p = await this.prisma.personnel.findUnique({
      where: { id },
      include: {
        user: true,
        trainings: { orderBy: { trainingDate: 'desc' } },
        competencies: { orderBy: { expiresAt: 'asc' } },
      },
    });
    if (!p || p.deletedAt) throw new NotFoundException(`人员 ${id} 不存在`);
    return p;
  }

  async addTraining(personnelId: string, data: any) {
    await this.findOne(personnelId);
    return this.prisma.training.create({ data: { personnelId, ...data } });
  }

  async addCompetency(personnelId: string, data: {
    method: string;
    level: string;
    certifiedAt: Date;
    expiresAt: Date;
    certifiedBy?: string;
    remarks?: string;
  }) {
    await this.findOne(personnelId);
    return this.prisma.competency.create({ data: { personnelId, ...data } });
  }

  /**
   * 能力矩阵(全员 × 方法)
   */
  async getCompetencyMatrix() {
    const personnel = await this.prisma.personnel.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, employeeNo: true, name: true },
    });
    const competencies = await this.prisma.competency.findMany({
      where: { expiresAt: { gte: new Date() } },
    });

    // 构建矩阵:人员 → {方法 → 等级}
    const matrix: Record<string, Record<string, string>> = {};
    for (const p of personnel) {
      matrix[p.id] = { employeeNo: p.employeeNo, name: p.name };
    }
    for (const c of competencies) {
      if (matrix[c.personnelId]) {
        matrix[c.personnelId][c.method] = c.level;
      }
    }
    return matrix;
  }
}
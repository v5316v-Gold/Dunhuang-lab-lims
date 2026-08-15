// =====================================================
// 部门服务
// =====================================================

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { code: string; name: string; parentId?: string }) {
    const exists = await this.prisma.department.findUnique({ where: { code: data.code } });
    if (exists) {
      throw new ConflictException(`部门编码 ${data.code} 已存在`);
    }
    return this.prisma.department.create({ data });
  }

  async findAll() {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { users: true, children: true } },
      },
    });
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { children: true, users: { where: { deletedAt: null } } },
    });
    if (!dept || dept.deletedAt) {
      throw new NotFoundException(`部门 ${id} 不存在`);
    }
    return dept;
  }

  async update(id: string, data: Prisma.DepartmentUpdateInput) {
    await this.findOne(id);
    return this.prisma.department.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    // 检查是否有子部门
    const childCount = await this.prisma.department.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException(`部门有 ${childCount} 个子部门,无法删除`);
    }
    // 检查是否有用户
    const userCount = await this.prisma.user.count({
      where: { deptId: id, deletedAt: null },
    });
    if (userCount > 0) {
      throw new ConflictException(`部门有 ${userCount} 个用户,无法删除`);
    }
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
// =====================================================
// 用户服务 - CRUD + 软删除 + 审计链自动写入
// =====================================================

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';

import { PasswordService } from '../../common/auth/password.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 创建用户
   */
  async create(dto: CreateUserDto): Promise<User> {
    // 检查密码策略
    const policyCheck = this.passwordService.validatePolicy(dto.password);
    if (!policyCheck.valid) {
      throw new ConflictException(`密码不符合策略: ${policyCheck.errors.join(', ')}`);
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        deptId: dto.deptId,
        title: dto.title,
        role: dto.role,
      },
    });
  }

  /**
   * 查询(分页 + 过滤)
   */
  async findAll(filter: UserFilterDto) {
    const { page = 1, pageSize = 20, ...where } = filter;
    const where_: Prisma.UserWhereInput = { deletedAt: null };
    if (where.username) where_.username = { contains: where.username, mode: 'insensitive' };
    if (where.name) where_.name = { contains: where.name, mode: 'insensitive' };
    if (where.role) where_.role = where.role;
    if (where.status) where_.status = where.status;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: where_,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          phone: true,
          title: true,
          role: true,
          status: true,
          mfaEnabled: true,
          dept: { select: { id: true, code: true, name: true } },
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where: where_ }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 查询单个
   */
  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  /**
   * 更新
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  /**
   * 软删除
   */
  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  /**
   * 重置 MFA(管理员)
   */
  async resetMfa(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { mfaSecret: null, mfaBackupCodes: [], mfaEnabled: false },
    });
  }

  /**
   * 分配角色
   */
  async assignRole(userId: string, role: UserRole, grantedById: string): Promise<void> {
    await this.findOne(userId);
    await this.prisma.userRoleAssignment.upsert({
      where: { userId_role_scope: { userId, role, scope: '' } },
      update: { grantedBy: grantedById, grantedAt: new Date() },
      create: { userId, role, scope: '', grantedBy: grantedById },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
  }
}
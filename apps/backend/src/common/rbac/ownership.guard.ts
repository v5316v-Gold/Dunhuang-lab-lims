// =====================================================
// Phase 1B P0-F: 资源级 RBAC 守卫
// CNAS §7.2 人员 + 数据所有权
// 解决问题:分析员只能改自己执行的检测
// =====================================================

import { Injectable, ForbiddenException, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const OWNERSHIP_KEY = 'ownership';

/**
 * 装饰器:标记需要资源所有权的端点
 * @param resource 资源名('test' | 'sample' | 'report' | 'qc' | 'container')
 * @param ownerField 资源中的所有者字段(如 'operatorId', 'receivedById', 'createdById')
 *
 * 用法:
 * @Post(':id/transfer')
 * @Ownership('test', 'operatorId')
 * async transfer() { ... }
 */
import { SetMetadata } from '@nestjs/common';
export const Ownership = (resource: string, ownerField: string) =>
  SetMetadata(OWNERSHIP_KEY, { resource, ownerField });

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get(OWNERSHIP_KEY, context.getHandler());
    if (!meta) return true;  // 未装饰 = 无要求

    const req = context.switchToHttp().getRequest();
    const user = req.user;  // 由 JwtAuthGuard 注入
    if (!user) throw new ForbiddenException('未认证');

    // 管理员可访问所有资源
    // ⚠️ bug fix: 原写 'user.role === "ADMIN" || "QUALITY_MANAGER"' 实际是字符串字面量 ||
    //   任何 user 都会 bypass!必须用显式比较
    if (user.role === 'ADMIN' || user.role === 'QUALITY_MANAGER' || user.role === 'LAB_DIRECTOR') {
      return true;
    }

    // 找 URL 中的资源 ID(假设 :id)
    const resourceId = req.params.id;
    if (!resourceId) {
      throw new ForbiddenException('资源 ID 缺失,无法校验所有权');
    }

    // 查询资源的所有者
    const ownerField = meta.ownerField;
    let ownerId: string | null = null;
    try {
      const record = await (this.prisma as any)[meta.resource].findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });
      ownerId = record?.[ownerField] ?? null;
    } catch (e) {
      throw new ForbiddenException(`资源 ${meta.resource} 不存在或不可访问`);
    }

    if (!ownerId) {
      throw new ForbiddenException(`资源所有者未设置,无法校验`);
    }
    if (ownerId !== user.sub) {
      throw new ForbiddenException(`无权限操作此资源(所有权不匹配)`);
    }
    return true;
  }
}
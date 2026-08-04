// =====================================================
// 角色装饰器
// 用法: @RequireRole(UserRole.ADMIN, UserRole.LAB_DIRECTOR)
// =====================================================

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
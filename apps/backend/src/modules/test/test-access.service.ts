// =====================================================
// 检测任务行级权限校验(统一入口,供火试金/ICP 共用)
// 规则: ANALYST/INTERN 只能操作自己负责的检测任务;
//       SENIOR_ANALYST/QUALITY_MANAGER/LAB_DIRECTOR/ADMIN 可操作全部
// 架构优化: 消除 fire-assay/icp 各自实现导致的权限不一致
// =====================================================

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class TestAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanOperate(testId: string, user: User): Promise<void> {
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.LAB_DIRECTOR ||
      user.role === UserRole.QUALITY_MANAGER ||
      user.role === UserRole.SENIOR_ANALYST
    ) {
      return;
    }
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { operatorId: true },
    });
    if (!test) {
      throw new NotFoundException(`检测 ${testId} 不存在`);
    }
    if (test.operatorId !== user.id) {
      throw new ForbiddenException('只能操作自己负责的检测任务');
    }
  }
}

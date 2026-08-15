// =====================================================
// Phase 1B+ W+1-3: 资源级 RBAC OwnershipGuard 专项测试
// 评审必问:"分析员 A 改分析员 B 的数据怎么办?"
// =====================================================

import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from '../../src/common/rbac/ownership.guard';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

// Mock PrismaService
const mockPrisma = {
  test: { findUnique: jest.fn() },
  sample: { findUnique: jest.fn() },
  report: { findUnique: jest.fn() },
  qc: { findUnique: jest.fn() },
  container: { findUnique: jest.fn() },
};

describe('P1B OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reflector: Reflector;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OwnershipGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    guard = module.get(OwnershipGuard);
    reflector = module.get(Reflector);

    // 默认 ctx:普通 ANALYST 用户
    // 共享 req 对象(否则 switchToHttp 每次返回新对象,beforeEach 修改无效)
    const req: any = {
      user: { sub: 'user-1', role: 'ANALYST' },
      params: { id: 'resource-1' },
    };
    ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;

    // Reflector.get 默认返回 undefined (没装饰)
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
  });

  // 1. 未装饰:直接通过
  describe('未装饰端点', () => {
    it('passes when no @Ownership metadata', async () => {
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // 2. ADMIN 自动 bypass
  describe('ADMIN bypass', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      ctx.switchToHttp().getRequest().user = { sub: 'admin-1', role: 'ADMIN' };
    });

    it('ADMIN can access any resource (no DB query)', async () => {
      mockPrisma.test.findUnique.mockClear();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockPrisma.test.findUnique).not.toHaveBeenCalled();
    });

    it('ADMIN can access even if resource does not exist', async () => {
      mockPrisma.test.findUnique.mockResolvedValue(null);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // 3. QUALITY_MANAGER bypass
  describe('QUALITY_MANAGER bypass', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      ctx.switchToHttp().getRequest().user = { sub: 'qa-1', role: 'QUALITY_MANAGER' };
    });

    it('QA can access any resource', async () => {
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // 4. ANALYST 拥有资源:通过
  describe('ANALYST owns resource', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      mockPrisma.test.findUnique.mockResolvedValue({ operatorId: 'user-1' });
    });

    it('passes when operatorId = user.sub', async () => {
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockPrisma.test.findUnique).toHaveBeenCalledWith({
        where: { id: 'resource-1' },
        select: { operatorId: true },
      });
    });
  });

  // 5. ANALYST 越权:拒绝
  describe('ANALYST does NOT own resource', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      mockPrisma.test.findUnique.mockResolvedValue({ operatorId: 'user-2' });
    });

    it('throws ForbiddenException when operatorId != user.sub', async () => {
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('error message contains ownership info', async () => {
      try {
        await guard.canActivate(ctx);
        fail('should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('所有权');
      }
    });
  });

  // 6. 资源不存在
  describe('resource not exists', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      mockPrisma.test.findUnique.mockResolvedValue(null);
    });

    it('throws ForbiddenException when resource not found', async () => {
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // 7. 资源 owner 未设置(null)
  describe('owner is null', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      mockPrisma.test.findUnique.mockResolvedValue({ operatorId: null });
    });

    it('throws ForbiddenException when ownerId is null', async () => {
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // 8. 多种资源类型
  describe('multiple resource types', () => {
    it('Test: query test table with operatorId', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      mockPrisma.test.findUnique.mockResolvedValue({ operatorId: 'user-1' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('Sample: query sample table with receivedById', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'sample', ownerField: 'receivedById' });
      mockPrisma.sample.findUnique.mockResolvedValue({ receivedById: 'user-1' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockPrisma.sample.findUnique).toHaveBeenCalled();
    });

    it('Report: query report table with createdById', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'report', ownerField: 'createdById' });
      mockPrisma.report.findUnique.mockResolvedValue({ createdById: 'user-1' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // 9. 边界:无 user
  describe('unauthenticated', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      ctx.switchToHttp().getRequest().user = undefined;
    });

    it('throws ForbiddenException when no user', async () => {
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // 10. 边界:无 resource ID
  describe('no resource id', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue({ resource: 'test', ownerField: 'operatorId' });
      ctx.switchToHttp().getRequest().params = {};
    });

    it('throws when params.id is missing', async () => {
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
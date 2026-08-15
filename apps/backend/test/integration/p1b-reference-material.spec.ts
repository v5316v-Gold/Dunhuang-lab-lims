// =====================================================
// Phase 1B+ W+1-5: 标准物质全链路 过期阻断 专项测试
// 评审必问:"RM 过期了怎么办?用了哪个 RM?"
// 覆盖:过期阻断 / 期间核查 / 退役阻断 / 使用台账
// =====================================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferenceMaterialService } from '../../src/modules/test/reference-material.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../src/common/audit/security-audit.service';

const mockPrisma = {
  referenceMaterial: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  referenceMaterialUsage: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  test: { findUnique: jest.fn() },
};

const mockAudit = { system: jest.fn().mockResolvedValue(undefined) };

describe('P1B ReferenceMaterial 过期阻断', () => {
  let svc: ReferenceMaterialService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReferenceMaterialService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecurityAuditService, useValue: mockAudit },
      ],
    }).compile();
    svc = module.get(ReferenceMaterialService);
    jest.clearAllMocks();
  });

  // ============== create() ==============
  describe('create()', () => {
    it('creates RM with auto-generated RMU-YYYYMMDD-NNNN when usage recorded', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({ id: 'rm-1', code: 'GBW02757', status: 'ACTIVE' });
      mockPrisma.referenceMaterialUsage.findFirst.mockResolvedValue(null);
      mockPrisma.referenceMaterialUsage.create.mockImplementation((args) =>
        Promise.resolve({ id: 'rmu-1', usageNo: 'RMU-20260815-0001', ...args.data }));
      const r = await svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'GBW-2024-A',
        testId: 'test-1',
        usedAmount: '0.5',
        remainingAmount: '9.5',
        purpose: 'CALIBRATION',
      }, 'user-1');
      expect(r.id).toBe('rmu-1');
      const callArg = mockPrisma.referenceMaterialUsage.create.mock.calls[0][0];
      expect(callArg.data.usageNo).toMatch(/^RMU-\d{8}-\d{4}$/);
    });

    it('records audit event on usage', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({ id: 'rm-1', code: 'GBW02757', status: 'ACTIVE' });
      mockPrisma.referenceMaterialUsage.findFirst.mockResolvedValue(null);
      mockPrisma.referenceMaterialUsage.create.mockImplementation((args) =>
        Promise.resolve({ id: 'rmu-1', usageNo: 'RMU-...', ...args.data }));
      await svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'GBW-2024-A',
        usedAmount: '0.5',
        remainingAmount: '9.5',
        purpose: 'CALIBRATION',
      }, 'user-1');
      expect(mockAudit.system).toHaveBeenCalledWith(
        'CONFIG:SETTINGS_CHANGED',
        expect.objectContaining({
          event: 'RM_USAGE_RECORDED',
          rmCode: 'GBW02757',
        }),
      );
    });
  });

  // ============== recordUsage() 阻断 ==============
  describe('recordUsage() 过期阻断 (CRITICAL)', () => {
    it('throws NotFoundException when RM does not exist', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue(null);
      await expect(svc.recordUsage({
        referenceMaterialId: 'invalid-rm',
        lotNo: 'X',
        usedAmount: '1',
        remainingAmount: '0',
        purpose: 'QC_CHECK',
      }, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when RM is RETIRED', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'OLD-001', status: 'RETIRED',
      });
      await expect(svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'X',
        usedAmount: '1',
        remainingAmount: '0',
        purpose: 'QC_CHECK',
      }, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when RM expired (expiryDate < now)', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1); // 1 年前
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'EXPIRED-001', status: 'ACTIVE',
        expiryDate: pastDate,
      });
      await expect(svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'X',
        usedAmount: '1',
        remainingAmount: '0',
        purpose: 'QC_CHECK',
      }, 'user-1')).rejects.toThrow(/已过期/);
    });

    it('throws BadRequestException when verification overdue', async () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 30); // 30 天前
      const futureExpiry = new Date();
      futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'NEED-VERIFY', status: 'ACTIVE',
        expiryDate: futureExpiry,
        nextVerificationDate: overdueDate,
      });
      await expect(svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'X',
        usedAmount: '1',
        remainingAmount: '0',
        purpose: 'QC_CHECK',
      }, 'user-1')).rejects.toThrow(/期间核查/);
    });

    it('allows usage when RM is ACTIVE and not expired and verified', async () => {
      const futureExpiry = new Date();
      futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
      const futureVerify = new Date();
      futureVerify.setMonth(futureVerify.getMonth() + 1);
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'GBW02757', status: 'ACTIVE',
        expiryDate: futureExpiry,
        nextVerificationDate: futureVerify,
      });
      mockPrisma.referenceMaterialUsage.findFirst.mockResolvedValue(null);
      mockPrisma.referenceMaterialUsage.create.mockImplementation((args) =>
        Promise.resolve({ id: 'rmu-1', usageNo: 'RMU-...', ...args.data }));
      const r = await svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'GBW-2024-A',
        usedAmount: '0.5',
        remainingAmount: '9.5',
        purpose: 'CALIBRATION',
      }, 'user-1');
      expect(r.id).toBe('rmu-1');
    });

    it('allows usage when expiryDate is null (no expiry set)', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'INFINITE-001', status: 'ACTIVE',
        expiryDate: null,
        nextVerificationDate: null,
      });
      mockPrisma.referenceMaterialUsage.findFirst.mockResolvedValue(null);
      mockPrisma.referenceMaterialUsage.create.mockImplementation((args) =>
        Promise.resolve({ id: 'rmu-1', usageNo: 'RMU-...', ...args.data }));
      const r = await svc.recordUsage({
        referenceMaterialId: 'rm-1',
        lotNo: 'X',
        usedAmount: '1',
        remainingAmount: '0',
        purpose: 'CALIBRATION',
      }, 'user-1');
      expect(r.id).toBe('rmu-1');
    });
  });

  // ============== findExpiringSoon() 告警 ==============
  describe('findExpiringSoon() 告警', () => {
    it('returns RM with expiryDate in next 30 days', async () => {
      const in15Days = new Date();
      in15Days.setDate(in15Days.getDate() + 15);
      mockPrisma.referenceMaterial.findMany.mockResolvedValue([
        { id: 'rm-1', code: 'EXPIRING-SOON', expiryDate: in15Days },
      ]);
      const r = await svc.findExpiringSoon(30);
      expect(r.items.length).toBe(1);
      expect(r.count).toBe(1);
      expect(r.daysAhead).toBe(30);
    });

    it('returns RM with verificationDate in next 30 days', async () => {
      const in10Days = new Date();
      in10Days.setDate(in10Days.getDate() + 10);
      mockPrisma.referenceMaterial.findMany.mockResolvedValue([
        { id: 'rm-1', code: 'VERIFY-SOON', nextVerificationDate: in10Days },
      ]);
      const r = await svc.findExpiringSoon(30);
      expect(r.items.length).toBe(1);
    });

    it('default daysAhead = 30 when not specified', async () => {
      mockPrisma.referenceMaterial.findMany.mockResolvedValue([]);
      const r = await svc.findExpiringSoon();
      expect(r.daysAhead).toBe(30);
    });

    it('filters out RETIRED RM', async () => {
      // findMany mock 中实际过滤由 Prisma where 决定,这里只测调用参数
      mockPrisma.referenceMaterial.findMany.mockImplementation((args: any) => {
        // 验证调用时 where 含 status = ACTIVE + deletedAt = null
        expect(args.where.status).toBe('ACTIVE');
        expect(args.where.deletedAt).toBeNull();
        return Promise.resolve([]);
      });
      await svc.findExpiringSoon(30);
    });
  });

  // ============== findOne() ==============
  describe('findOne()', () => {
    it('throws NotFoundException when RM not found', async () => {
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue(null);
      await expect(svc.findOne('invalid-rm')).rejects.toThrow(NotFoundException);
    });

    it('returns RM with isExpired and needsVerification flags', async () => {
      const futureExpiry = new Date();
      futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'GBW02757', expiryDate: futureExpiry,
        nextVerificationDate: null,
      });
      mockPrisma.referenceMaterial.findUnique.mockImplementationOnce(async () => ({
        id: 'rm-1', code: 'GBW02757', expiryDate: futureExpiry,
        nextVerificationDate: null,
      }));
      const r = await svc.findOne('rm-1');
      expect(r.isExpired).toBe(false);
      expect(r.needsVerification).toBe(false);
    });

    it('detects expired RM', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'EXPIRED', expiryDate: pastDate,
      });
      const r = await svc.findOne('rm-1');
      expect(r.isExpired).toBe(true);
    });

    it('detects overdue verification', async () => {
      const overdue = new Date();
      overdue.setDate(overdue.getDate() - 30);
      mockPrisma.referenceMaterial.findUnique.mockResolvedValue({
        id: 'rm-1', code: 'NEED-VERIFY',
        expiryDate: null,
        nextVerificationDate: overdue,
      });
      const r = await svc.findOne('rm-1');
      expect(r.needsVerification).toBe(true);
    });
  });

  // ============== findAll() 过滤 ==============
  describe('findAll() 过滤', () => {
    it('passes activeOnly=true to Prisma', async () => {
      mockPrisma.referenceMaterial.findMany.mockImplementation((args: any) => {
        // 验证 where 含 status = ACTIVE + expiryDate > now
        expect(args.where.status).toBe('ACTIVE');
        expect(args.where.OR).toBeDefined();
        return Promise.resolve({ items: [], total: 0 });
      });
      await svc.findAll({ activeOnly: true });
    });

    it('filters by element when provided', async () => {
      mockPrisma.referenceMaterial.findMany.mockImplementation((args: any) => {
        expect(args.where.element).toBe('Au');
        return Promise.resolve({ items: [], total: 0 });
      });
      await svc.findAll({ element: 'Au' });
    });
  });
});
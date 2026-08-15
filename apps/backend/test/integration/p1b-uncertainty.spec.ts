// =====================================================
// Phase 1B+ W+1-4: 不确定度 5 类分量 GUM 计算专项测试
// 评审必问:"你这 0.02% 怎么算的?"
// 覆盖:GUM u_c 合成 / U 扩展 / 公式快照 / 状态机
// =====================================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UncertaintyService } from '../../src/modules/test/uncertainty.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../src/common/audit/security-audit.service';

const mockPrisma = {
  test: { findUnique: jest.fn(), update: jest.fn() },
  uncertaintyReport: {
    findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(),
  },
  referenceMaterial: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockAudit = { system: jest.fn().mockResolvedValue(undefined) };

describe('P1B UncertaintyService GUM 5 components', () => {
  let svc: UncertaintyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UncertaintyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecurityAuditService, useValue: mockAudit },
      ],
    }).compile();
    svc = module.get(UncertaintyService);
    jest.clearAllMocks();
  });

  // ================== 1. computeCombinedU GUM 算法 ==================
  describe('computeCombinedU (GUM 公式 u_c = sqrt(Σ u_i²))', () => {
    it('returns 0 when all components are 0', () => {
      expect(svc.computeCombinedU({})).toBe(0);
    });

    it('returns 0 when all components are null', () => {
      expect(svc.computeCombinedU({
        ucTypeA: null, ucTypeBStd: null, ucTypeBEquip: null,
        ucTypeBVol: null, ucTypeBEnv: null, ucTypeBOther: null,
      })).toBe(0);
    });

    it('returns single u value when only one component is non-zero', () => {
      // u_c = sqrt(0.02²) = 0.02
      expect(svc.computeCombinedU({ ucTypeA: 0.02 })).toBeCloseTo(0.02, 10);
    });

    it('sums squared for 2 components (Pythagorean)', () => {
      // u_c = sqrt(3² + 4²) = 5
      expect(svc.computeCombinedU({ ucTypeA: 3, ucTypeBStd: 4 })).toBeCloseTo(5, 10);
    });

    it('sums all 5 components correctly', () => {
      // u_c = sqrt(1² + 2² + 2² + 1² + 1²) = sqrt(11) ≈ 3.317
      const r = svc.computeCombinedU({
        ucTypeA: 1, ucTypeBStd: 2, ucTypeBEquip: 2, ucTypeBVol: 1, ucTypeBEnv: 1,
      });
      expect(r).toBeCloseTo(Math.sqrt(11), 6);
    });

    it('absolute value of negative inputs (numerical safety)', () => {
      // 输入 -3 应等价 +3(取绝对值)
      const r1 = svc.computeCombinedU({ ucTypeA: 3 });
      const r2 = svc.computeCombinedU({ ucTypeA: -3 });
      expect(r1).toBeCloseTo(r2, 10);
    });

    it('ignores null components in sum', () => {
      // u_c = sqrt(0.01² + 0.02²) = sqrt(0.0005) ≈ 0.02236
      const r = svc.computeCombinedU({ ucTypeA: 0.01, ucTypeBStd: 0.02, ucTypeBEquip: null });
      expect(r).toBeCloseTo(Math.sqrt(0.0005), 6);
    });

    it('classic example: 4 components from CNAS GUM guide', () => {
      // 假设: u_A=0.005, u_B(标物)=0.003, u_B(仪器)=0.002, u_B(容量)=0.001
      // u_c = sqrt(0.005² + 0.003² + 0.002² + 0.001²) = sqrt(0.000039) ≈ 0.006245
      const r = svc.computeCombinedU({
        ucTypeA: 0.005, ucTypeBStd: 0.003, ucTypeBEquip: 0.002, ucTypeBVol: 0.001,
      });
      expect(r).toBeCloseTo(0.006245, 6);
    });
  });

  // ================== 2. computeExpandedU (k=2 扩展) ==================
  describe('computeExpandedU (U = k × u_c)', () => {
    it('returns 0 when u_c is 0', () => {
      expect(svc.computeExpandedU(0)).toBe(0);
    });

    it('U = 2 × u_c (k=2 default)', () => {
      expect(svc.computeExpandedU(0.01)).toBe(0.02);
    });

    it('U = k × u_c (custom k)', () => {
      expect(svc.computeExpandedU(0.01, 3)).toBe(0.03);
    });

    it('classic example: u_c=0.006 → U=0.012 (k=2)', () => {
      // 即报告说 Au 99.99% ± 0.012%(k=2)
      expect(svc.computeExpandedU(0.006, 2)).toBe(0.012);
    });
  });

  // ================== 3. create() 状态校验 ==================
  describe('create() state validation', () => {
    it('throws NotFoundException when test does not exist', async () => {
      mockPrisma.test.findUnique.mockResolvedValue(null);
      await expect(svc.create({ testId: 'invalid-test', measuredValue: '99.99' }, 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when test already has uncertainty report', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({ id: 'ur-1', reportNo: 'U-2026-0001' });
      await expect(svc.create({ testId: 'test-1', measuredValue: '99.99' }, 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('creates DRAFT report with auto-generated reportNo', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.findFirst.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.create.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', ...args.data }));
      const r = await svc.create({ testId: 'test-1', measuredValue: '99.99' }, 'user-1');
      expect(r.id).toBe('ur-1');
      expect(r.status).toBe('DRAFT');
      // 验证 reportNo 格式 U-YYYYMMDD-NNNN
      const callArg = mockPrisma.uncertaintyReport.create.mock.calls[0][0];
      expect(callArg.data.reportNo).toMatch(/^U-\d{8}-\d{4}$/);
    });

    it('computes and stores combined U correctly', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.findFirst.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.create.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', ...args.data }));
      await svc.create({
        testId: 'test-1',
        measuredValue: '99.99',
        ucTypeA: '0.01', ucTypeBStd: '0.02',
      }, 'user-1');
      const arg = mockPrisma.uncertaintyReport.create.mock.calls[0][0];
      // u_c = sqrt(0.01² + 0.02²) = sqrt(0.0005) ≈ 0.02236
      expect(parseFloat(arg.data.combinedU)).toBeCloseTo(Math.sqrt(0.0005), 6);
      // U = 2 × u_c ≈ 0.04472
      expect(parseFloat(arg.data.expandedU)).toBeCloseTo(2 * Math.sqrt(0.0005), 6);
    });

    it('stores formula snapshot (audit evidence)', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.findFirst.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.create.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', ...args.data }));
      await svc.create({
        testId: 'test-1',
        measuredValue: '99.99',
        ucTypeA: '0.01',
      }, 'user-1');
      const arg = mockPrisma.uncertaintyReport.create.mock.calls[0][0];
      expect(arg.data.formulaSnapshot).toContain('GUM JCGM 100:2008');
      expect(arg.data.formulaSnapshot).toContain('u_c = ');
      expect(arg.data.formulaSnapshot).toContain('U = k × u_c');
    });

    it('null components default to 0 in DB but do not change reportNo format', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.findFirst.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.create.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', ...args.data }));
      await svc.create({ testId: 'test-1', measuredValue: '99.99' }, 'user-1');
      const arg = mockPrisma.uncertaintyReport.create.mock.calls[0][0];
      // 所有 u 分量为 null,combinedU 应该是 0
      expect(parseFloat(arg.data.combinedU)).toBe(0);
    });

    it('audit event written on create', async () => {
      mockPrisma.test.findUnique.mockResolvedValue({ id: 'test-1' });
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.findFirst.mockResolvedValue(null);
      mockPrisma.uncertaintyReport.create.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', reportNo: 'U-2026-0001', ...args.data }));
      await svc.create({ testId: 'test-1', measuredValue: '99.99' }, 'user-1');
      // 实际 enum 值是 'CONFIG:SETTINGS_CHANGED'
      expect(mockAudit.system).toHaveBeenCalledWith(
        'CONFIG:SETTINGS_CHANGED',
        expect.objectContaining({ event: 'UNCERTAINTY_DRAFTED' }),
      );
    });
  });

  // ================== 4. review() 状态机 ==================
  describe('review() state machine', () => {
    it('throws NotFoundException when report not found', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      await expect(svc.review('ur-1', 'user-1', {}))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when status != DRAFT', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({ id: 'ur-1', status: 'REVIEWED' });
      await expect(svc.review('ur-1', 'user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when status = PUBLISHED', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({ id: 'ur-1', status: 'PUBLISHED' });
      await expect(svc.review('ur-1', 'user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('DRAFT → REVIEWED allowed', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({ id: 'ur-1', status: 'DRAFT' });
      mockPrisma.uncertaintyReport.update.mockImplementation((args) =>
        Promise.resolve({ id: 'ur-1', ...args.data }));
      const r = await svc.review('ur-1', 'user-1', {});
      expect(r.status).toBe('REVIEWED');
      expect(mockPrisma.uncertaintyReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ur-1' },
          data: expect.objectContaining({ status: 'REVIEWED', reviewedById: 'user-1' }),
        }),
      );
    });
  });

  // ================== 5. publish() 状态机 + Test.uncertainty 同步 ==================
  describe('publish() state machine + sync to Test', () => {
    it('throws when report not found', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue(null);
      await expect(svc.publish('ur-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when status != REVIEWED', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({ id: 'ur-1', status: 'DRAFT' });
      await expect(svc.publish('ur-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws when formulaSnapshot is missing', async () => {
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({
        id: 'ur-1', status: 'REVIEWED', testId: 'test-1', formulaSnapshot: null, expandedU: 0.02,
      });
      await expect(svc.publish('ur-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('REVIEWED → PUBLISHED allowed and syncs to Test.uncertainty', async () => {
      const expandedU = 0.015;
      mockPrisma.uncertaintyReport.findUnique.mockResolvedValue({
        id: 'ur-1', status: 'REVIEWED', testId: 'test-1', formulaSnapshot: '...',
        expandedU,  // service 会用这个值
      });
      // update mock: 模拟 service 行为,返回 update 后的对象(包含原 expandedU)
      mockPrisma.uncertaintyReport.update.mockImplementation((args) =>
        Promise.resolve({
          id: 'ur-1',
          status: args.data.status,  // 来自 update 的 data
          testId: 'test-1',
          formulaSnapshot: '...',
          expandedU,  // 保持原值(模拟 service 不修改 expandedU)
        }));
      mockPrisma.test.update.mockImplementation((args) =>
        Promise.resolve({ id: args.where.id, ...args.data }));
      // 模拟 $transaction: 直接调用 fn, 提供事务客户端
      (mockPrisma as any).$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          uncertaintyReport: { update: mockPrisma.uncertaintyReport.update },
          test: { update: mockPrisma.test.update },
        };
        return fn(tx);
      });
      const r = await svc.publish('ur-1', 'user-1');
      expect(r.status).toBe('PUBLISHED');
      // 验证 Test.uncertainty 同步(k=2 的 U 值)
      expect(mockPrisma.test.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: { uncertainty: expandedU },
      });
    });
  });
});
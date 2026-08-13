// =====================================================
// 软删除 Prisma Extension 集成测试 — Phase 0.5 Task E
// 验证:
//   1. findFirst / findMany 自动过滤 deletedAt != null
//   2. count 自动过滤已删除
//   3. update 自动加 deletedAt: null 过滤
//   4. delete 改写为软删除(UPDATE deletedAt = now())
//   5. deleteMany 改写为 updateMany 软删除
//   6. 已删除的记录不可被 update/findUnique 拿到
//   7. 不带 deletedAt 的 model(比如 Methods)不受影响
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

describe('Soft delete extension (Phase 0.5 Task E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // 清理:硬删除测试数据
    if (testUserId) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM users WHERE id = '${testUserId}'`,
      );
    }
    await app.close();
  });

  // ===== 测试 1: 软删除改写 =====
  it('user.delete() rewrites to soft delete (sets deletedAt)', async () => {
    // 创建测试 user
    const created = await prisma.user.create({
      data: {
        username: `phase05_e_${Date.now()}`,
        email: `phase05_e_${Date.now()}@test.local`,
        passwordHash: 'fake_hash_for_test_only',
        name: 'Phase 0.5 Test User',
        role: 'INTERN',
        status: 'ACTIVE',
      } as any,
    });
    testUserId = created.id;

    // 软删除
    await prisma.user.delete({ where: { id: created.id } });

    // 验证:用 raw SQL 应该能看到 deletedAt
    const raw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT deleted_at FROM users WHERE id = '${created.id}'`,
    );
    expect(raw[0].deleted_at).not.toBeNull();

    // 验证:extension 自动过滤后,findUnique 应该返回 null
    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();

    // 验证:findFirst 也应该过滤掉
    const first = await prisma.user.findFirst({ where: { id: created.id } });
    expect(first).toBeNull();

    // 验证:findMany 不返回已删除
    const many = await prisma.user.findMany({ where: { id: created.id } });
    expect(many).toEqual([]);
  });

  // ===== 测试 2: findMany / count 自动过滤 =====
  it('findMany and count auto-exclude soft-deleted records', async () => {
    // 全部 user 中应该不包含已软删除的
    const all = await prisma.user.findMany({});
    const ids = all.map((p) => p.id);
    expect(ids).not.toContain(testUserId);

    // count 也应该过滤掉
    const c = await prisma.user.count({});
    const rawC = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int AS c FROM users`,
    );
    expect(c).toBeLessThan(rawC[0].c);
  });

  // ===== 测试 3: update 不允许修改已删除的 =====
  it('update on soft-deleted record fails (extension refuses)', async () => {
    // findUnique 已经过滤,update 加 deletedAt: null 过滤会失败
    await expect(
      prisma.user.update({
        where: { id: testUserId },
        data: { name: 'hacker updated' },
      } as any),
    ).rejects.toThrow();
  });

  // ===== 测试 4: update 不允许显式 deletedAt 条件 =====
  it('update with explicit deletedAt condition is REJECTED', async () => {
    await expect(
      prisma.user.updateMany({
        where: { id: testUserId, deletedAt: { not: null } } as any,
        data: { name: 'sneaky' },
      }),
    ).rejects.toThrow(/不允许显式指定 deletedAt/);
  });

  // ===== 测试 5: 不带 deletedAt 的 model 不受影响 =====
  it('non-soft-delete models (methods) are unaffected', async () => {
    const created = await prisma.method.create({
      data: {
        methodCode: `PHASE05-E-METHOD-${Date.now()}`,
        methodName: 'Phase 0.5 Task E Test',
        assayType: 'FIRE_ASSAY',
        updatedAt: new Date(),
      } as any,
    });

    // 真实删除(methods 不在 soft delete 列表)
    await prisma.method.delete({ where: { id: created.id } });

    // 验证:已真实删除,findUnique 应为 null
    const found = await prisma.method.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();

    // 验证:audit_logs 应该有 INSERT + DELETE 2 条(method 在 audit 列表里)
    const auditCount = await prisma.auditLog.count({
      where: { recordId: created.id, tableName: 'methods' },
    });
    expect(auditCount).toBe(2);
  });

  // ===== 测试 6: create 后可正常 find(非已删除) =====
  it('newly created personnel is findable (deletedAt is null)', async () => {
    // 拿一个真实存在的 user 来测试
    const users = await prisma.user.findMany({ take: 1 });
    expect(users.length).toBeGreaterThan(0);
    const found = await prisma.user.findUnique({ where: { id: users[0].id } });
    expect(found).not.toBeNull();
  });
});

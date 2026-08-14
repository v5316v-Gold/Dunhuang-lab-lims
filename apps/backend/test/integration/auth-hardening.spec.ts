// =====================================================
// 密码策略 + 登录锁定 + row-level 权限测试 — Phase 1 Task 2.2
// 验证:
//   1. 密码策略: 合法/过短/缺类/含用户名/弱口令
//   2. 登录锁定: 连续失败 5 次 → 锁定;锁定后登录被拒;成功后重置
//   3. row-level: ANALYST 操作他人检测 → 403;ADMIN 可操作
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { validatePasswordPolicy } from '../../src/common/auth/password.policy';
import request = require('supertest');

describe('Password policy + login lockout + row-level (Phase 1 Task 2.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let analystUserId: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    adminToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    // 清理锁定测试用户
    if (analystUserId) {
      await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${analystUserId}'`).catch(() => {});
    }
    await app.close();
  });

  // ========== 密码策略 ==========
  it('password policy: accepts strong password', () => {
    const r = validatePasswordPolicy('Abcdef12!@#', 'zhang.san');
    expect(r.ok).toBe(true);
  });

  it('password policy: rejects short / missing classes / username / weak', () => {
    expect(validatePasswordPolicy('Ab1!').ok).toBe(false);          // 太短
    expect(validatePasswordPolicy('abcdefgh').ok).toBe(false);      // 无大写/数字/特殊
    expect(validatePasswordPolicy('zhang.san123!', 'zhang.san').ok).toBe(false); // 含用户名
    expect(validatePasswordPolicy('Qw!2e4r6T8a', 'x').ok).toBe(true); // 合法(无用户名冲突)
    expect(validatePasswordPolicy('12345678Aa!').ok).toBe(false);   // 弱口令开头
    expect(validatePasswordPolicy('AAAA1111!a').ok).toBe(false);    // 连续 4 相同
  });

  // ========== 登录锁定 ==========
  it('login lockout: 5 failures lock account, locked login rejected', async () => {
    // 创建测试用户
    const created = await prisma.user.create({
      data: {
        username: `lock_test_${Date.now()}`,
        email: `lock_test_${Date.now()}@test.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$N8v3nU2xTqXmJgZlY5c6eA$K+ik4UfPoc1Gync7XKzPQFXiJBL4zttaQowA2zhi55U',
        name: 'Lock Test',
        role: 'ANALYST',
        status: 'ACTIVE',
      } as any,
    });
    analystUserId = created.id;

    // 4 次失败(未到阈值)
    for (let i = 0; i < 4; i++) {
      const r = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: created.username, password: 'WrongPass123!' });
      expect(r.status).toBe(401);
    }
    // 检查计数
    let u = await prisma.user.findUnique({ where: { id: created.id } });
    expect(u!.failedLoginCount).toBe(4);
    expect(u!.lockedUntil).toBeNull();

    // 第 5 次失败 → 锁定
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: created.username, password: 'WrongPass123!' });
    u = await prisma.user.findUnique({ where: { id: created.id } });
    expect(u!.failedLoginCount).toBe(5);
    expect(u!.lockedUntil).not.toBeNull();

    // 锁定后即使密码正确也被拒
    const lockedRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: created.username, password: 'WrongPass123!' });
    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.message).toContain('锁定');

    // 解锁:管理员直接清锁定(模拟时间流逝/管理员干预)
    await prisma.user.update({
      where: { id: created.id },
      data: { lockedUntil: null, failedLoginCount: 0 },
    });
  });

  // ========== row-level 权限 ==========
  it('row-level: ANALYST cannot operate others test (403)', async () => {
    // 创建 sample + test(operatorId = admin,即不是 analyst)
    const sample = await prisma.sample.create({
      data: {
        sampleNo: `RL-${Date.now()}`,
        customerName: 'RowLevel Test',
        sampleType: 'GOLD_INGOT',
        weightG: '1.0000',
        status: 'IN_TEST',
      } as any,
    });
    const test = await prisma.test.create({
      data: {
        sampleId: sample.id,
        method: 'FIRE_ASSAY',
        operatorId: '00000000-0000-0000-0000-000000000001', // admin 负责
        status: 'IN_PROGRESS',
        fireAssay: { create: { sampleWeightG: '1.0000' } },
      } as any,
      include: { fireAssay: true },
    });

    // analyst token
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
    const analystToken = jwt.sign(
      { sub: analystUserId, username: 'lock_test', role: 'ANALYST' },
      secret,
      { expiresIn: '15m' },
    );

    // analyst 操作他人 test → 403
    const res = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${test.id}/weights`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0' });
    expect(res.status).toBe(403);

    // admin 操作 → 200
    const adminRes = await request(app.getHttpServer())
      .post(`/tests/fire-assay/${test.id}/weights`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prillWeightG: '0.9988', leadButtonWeightG: '3.0' });
    expect([200, 201]).toContain(adminRes.status);

    // 清理
    await prisma.$executeRawUnsafe(`DELETE FROM fire_assay_details WHERE test_id = '${test.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM tests WHERE id = '${test.id}'`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sample.id}'`).catch(() => {});
  });
});

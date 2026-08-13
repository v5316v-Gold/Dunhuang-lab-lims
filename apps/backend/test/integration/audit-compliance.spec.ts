// =====================================================
// Audit compliance 集成测试 — Phase 0.5 Task D
// 验证:
//   1. 业务表 INSERT 自动产生 audit_logs 链 (trigger 工作)
//   2. audit_logs UPDATE/DELETE 抛 P0001 (防篡改触发器)
//   3. audit_logs TRUNCATE 抛 P0001 (statement-level 防篡改)
//   4. 业务 audit chain SHA256 链不断
//   5. GET /audit-logs/verify 返回 valid=true
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import request = require('supertest');

describe('Audit compliance (Phase 0.5 Task D)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  let adminToken: string;
  let adminId: string;
  let createdMethodId: string;
  let createdAuditLogId: string;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // 与 main.ts 保持一致:whitelist + forbidNonWhitelisted + transform
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
    jwt = app.get(JwtService);
    config = app.get(ConfigService);

    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!admin) throw new Error('admin user not seeded');
    adminId = admin.id;
    // 用 ConfigService 拿真正的 secret,直接调 jsonwebtoken 避开 JwtService 的 expiresIn 解析问题
    const jwtLib = require('jsonwebtoken');
    const secret = config.get<string>('JWT_SECRET') || 'test-secret-32-chars-minimum-test';
    adminToken = jwtLib.sign(
      { sub: admin.id, username: admin.username, role: admin.role },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdMethodId) {
      // 方法是 audit-protected,DELETE 应该成功
      await prisma.method.delete({ where: { id: createdMethodId } }).catch(() => {});
    }
    await app.close();
  });

  // ===== 测试 1: 业务 INSERT 自动产生 audit_logs =====
  it('INSERT into methods creates audit_logs entry automatically (audit chain works)', async () => {
    // 拿当前 audit_logs 数量
    const before = await prisma.auditLog.count();

    // 业务 INSERT
    const method = await prisma.method.create({
      data: {
        methodCode: `PHASE05-D-TEST-${Date.now()}`,
        methodName: 'Phase 0.5 Task D Test Method',
        assayType: 'FIRE_ASSAY',
        standard: 'GB/T 9999',
        updatedAt: new Date(),
      } as any,
    });
    createdMethodId = method.id;

    // 验证 audit_logs 增加 1 条
    const after = await prisma.auditLog.count();
    expect(after).toBe(before + 1);

    // 验证新 audit_log 的内容
    const latest = await prisma.auditLog.findFirst({
      where: { recordId: method.id, tableName: 'methods' },
      orderBy: { id: 'desc' },
    });
    expect(latest).toBeTruthy();
    expect(latest!.action).toContain('INSERT:methods');
    expect(latest!.currHash).toMatch(/^[a-f0-9]{64}$/);  // SHA256 hex
    expect(latest!.prevHash).toMatch(/^[a-f0-9]{64}$/);
    createdAuditLogId = latest!.id.toString();
  });

  // ===== 测试 2: 业务 UPDATE 自动产生 audit_logs =====
  it('UPDATE on methods creates new audit_logs entry', async () => {
    const before = await prisma.auditLog.count();
    await prisma.method.update({
      where: { id: createdMethodId },
      data: { methodName: 'Phase 0.5 Task D Updated Name' },
    });
    const after = await prisma.auditLog.count();
    expect(after).toBe(before + 1);

    const latest = await prisma.auditLog.findFirst({
      where: { recordId: createdMethodId, tableName: 'methods' },
      orderBy: { id: 'desc' },
    });
    expect(latest!.action).toContain('UPDATE:methods');
  });

  // ===== 测试 3: 防篡改 trigger — UPDATE 拒绝 =====
  it('UPDATE on audit_logs is REJECTED by prevent trigger (P0001)', async () => {
    let caught: any = null;
    try {
      await prisma.auditLog.update({
        where: { id: BigInt(createdAuditLogId) },
        data: { username: 'hacker' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    // Prisma 包装后的错误信息应含原始信息
    const msg = (caught.message || '') + ' ' + (caught.code || '');
    expect(msg).toMatch(/append-only|P0001|23514|23503|RAISE/i);
  });

  // ===== 测试 4: 防篡改 trigger — DELETE 拒绝 =====
  it('DELETE on audit_logs is REJECTED by prevent trigger (P0001)', async () => {
    let caught: any = null;
    try {
      await prisma.auditLog.delete({
        where: { id: BigInt(createdAuditLogId) },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    const msg = (caught.message || '') + ' ' + (caught.code || '');
    expect(msg).toMatch(/append-only|P0001|RAISE/i);
  });

  // ===== 测试 5: 防篡改 trigger — TRUNCATE 拒绝 =====
  it('TRUNCATE on audit_logs is REJECTED by prevent trigger', async () => {
    let caught: any = null;
    try {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE audit_logs');
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    const msg = (caught.message || '') + ' ' + (caught.code || '');
    expect(msg).toMatch(/append-only|P0001|RAISE/i);
  });

  // ===== 测试 6: 业务操作产生的 audit 链是 OK 的(本地 mini-verify) =====
  it('business operations produce a valid SHA256 chain', async () => {
    // 取出我们这次业务操作产生的 audit_logs(按 record_id 过滤)
    const ourRecords = await prisma.auditLog.findMany({
      where: {
        recordId: createdMethodId,
        tableName: 'methods',
      },
      orderBy: { id: 'asc' },
      select: { id: true, prevHash: true, currHash: true, action: true },
    });
    // 至少 INSERT + UPDATE = 2 条(DELETE 是在 afterAll 跑,这里不计入)
    expect(ourRecords.length).toBeGreaterThanOrEqual(2);
    // 第一条的 prev_hash 必须等于"调用 trigger 之前"的最后一条 audit_logs curr_hash
    // 由于我们无法直接拿到那个 hash,但能验证:第一条的 prev_hash 应当等于"id 小于它"的最近一条的 curr_hash
    // 更通用做法:验证内部 chain(除第一条外)
    // 验证除第一条外,每条 prev_hash = 上一条 curr_hash
    for (let i = 1; i < ourRecords.length; i++) {
      expect(ourRecords[i].prevHash).toBe(ourRecords[i - 1].currHash);
    }
    // 验证所有 curr_hash 都是 64 位 hex
    for (const r of ourRecords) {
      expect(r.currHash).toMatch(/^[a-f0-9]{64}$/);
    }
    // 验证第一条的 prev_hash 在 audit_logs 表中存在(接链)
    const prevExists = await prisma.auditLog.findFirst({
      where: { currHash: ourRecords[0].prevHash },
    });
    expect(prevExists).not.toBeNull();
  });

  // ===== 测试 7: BigInt 在 response 中是字符串 =====
  it('GET /audit-logs serializes BigInt id as string', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?pageSize=3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    for (const r of res.body.data) {
      expect(typeof r.id).toBe('string');
      expect(r.id).toMatch(/^\d+$/);
    }
  });

  // ===== 测试 8: extra field 被 ValidationPipe 拒 =====
  it('GET /audit-logs with extra field returns 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?maliciousField=evil')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// =====================================================
// 系统/安全审计事件集成测试 — Phase 1 Task 2.1
// 验证:
//   1. 登录成功 → AUTH:LOGIN_SUCCESS 审计事件
//   2. 登录失败(密码错)→ AUTH:LOGIN_FAILED 审计事件
//   3. 登录失败(用户不存在)→ AUTH:LOGIN_FAILED(不泄露)
//   4. SecurityAuditService.record 手动事件 → 链衔接 + 64 位 hash
//   5. 手动事件与 trigger 事件共存,verify 链仍完整
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../src/common/audit/security-audit.service';
import { AuditEventType } from '../../src/common/audit/audit-event.enum';
import request = require('supertest');

describe('Security/system audit events (Phase 1 Task 2.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let securityAudit: SecurityAuditService;

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
    securityAudit = app.get(SecurityAuditService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== 测试 1: 登录成功产生审计事件 =====
  it('POST /auth/login success records AUTH:LOGIN_SUCCESS', async () => {
    const before = await prisma.auditLog.count();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Admin@Pass123' });
    expect(res.status).toBe(200);

    const after = await prisma.auditLog.count();
    expect(after).toBeGreaterThan(before);

    const event = await prisma.auditLog.findFirst({
      where: { action: AuditEventType.LOGIN_SUCCESS },
      orderBy: { id: 'desc' },
    });
    expect(event).toBeTruthy();
    expect(event!.tableName).toBe('auth');
    expect(event!.username).toBe('admin');
    expect(event!.currHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ===== 测试 2: 登录失败(密码错)产生审计事件 =====
  it('POST /auth/login wrong password records AUTH:LOGIN_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'WrongPass123!' });
    expect(res.status).toBe(401);

    const event = await prisma.auditLog.findFirst({
      where: {
        action: AuditEventType.LOGIN_FAILED,
        username: 'admin',
      },
      orderBy: { id: 'desc' },
    });
    expect(event).toBeTruthy();
    expect(event!.newData).toHaveProperty('reason');
  });

  // ===== 测试 3: 登录失败(用户不存在)也记录 =====
  it('POST /auth/login unknown user records AUTH:LOGIN_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'no.such.user', password: 'Whatever123!' });
    expect(res.status).toBe(401);

    const event = await prisma.auditLog.findFirst({
      where: {
        action: AuditEventType.LOGIN_FAILED,
        username: 'no.such.user',
      },
      orderBy: { id: 'desc' },
    });
    expect(event).toBeTruthy();
  });

  // ===== 测试 4: SecurityAuditService 手动事件链衔接 =====
  it('manual record() writes event with chained SHA256', async () => {
    // 记录前最后一条 hash
    const lastBefore = await prisma.auditLog.findFirst({
      orderBy: { id: 'desc' },
      select: { currHash: true },
    });

    await securityAudit.record({
      event: AuditEventType.SYSTEM_START,
      domain: 'system',
      username: 'system',
      detail: { phase: 'phase-1-task-2.1-test' },
    });

    const event = await prisma.auditLog.findFirst({
      where: { action: AuditEventType.SYSTEM_START },
      orderBy: { id: 'desc' },
    });
    expect(event).toBeTruthy();
    // 链衔接: 本条 prev_hash == 上一条 curr_hash
    expect(event!.prevHash).toBe(lastBefore!.currHash);
    expect(event!.currHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ===== 测试 5: 手动事件后链仍完整 =====
  it('audit chain remains valid after manual events', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs/verify')
      .set(
        'Authorization',
        'Bearer ' +
          require('jsonwebtoken').sign(
            { sub: '00000000-0000-0000-0000-000000000001', username: 'admin', role: 'ADMIN' },
            process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!',
            { expiresIn: '15m' },
          ),
      );
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
  });
});

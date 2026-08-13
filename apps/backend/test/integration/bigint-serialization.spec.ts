// =====================================================
// Common BigInt JSON serialization regression test
// Phase 0.5 Task A — Task D 集成测试共用
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import request = require('supertest');

describe('BigInt JSON serialization (Phase 0.5 Task A)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminToken: string;

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

    // 拿 admin 用户 id
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!admin) throw new Error('admin user not seeded');
    // 用 jsonwebtoken 直接签,绕开 JwtService 的 expiresIn 解析问题
    const jwtLib = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'test-secret-32-chars-minimum-test';
    adminToken = jwtLib.sign(
      { sub: admin.id, username: admin.username, role: admin.role },
      secret,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON.stringify serializes BigInt correctly', () => {
    const payload = { id: 1n, nested: { value: 9007199254740993n } };
    const out = JSON.stringify(payload);
    expect(out).toContain('"id":"1"');
    expect(out).toContain('"value":"9007199254740993"');
  });

  it('GET /audit-logs returns 200 with BigInt serialized as string', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?pageSize=3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    // BigInt id 字段必须是字符串,不能 throw
    for (const r of res.body.data) {
      expect(typeof r.id).toBe('string');
      expect(r.id).toMatch(/^\d+$/);
    }
  });

  it('GET /audit-logs with invalid filter (extra field) returns 400', async () => {
    // forbidNonWhitelisted: true + DTO 没有 maliciousField,应被 ValidationPipe 拒
    const res = await request(app.getHttpServer())
      .get('/audit-logs?maliciousField=evil')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('GET /audit-logs/verify stays 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs/verify')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // verify 返回 { passed, totalRecords, errors, ... }
    expect(res.body.passed).toBe(true);
  });
});

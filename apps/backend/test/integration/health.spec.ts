// =====================================================
// 健康检查端点测试 — Phase 1 Task 2.6
// 验证:
//   1. GET /health/live → 200 ok
//   2. GET /health/ready → 200 (PG/Redis 检查)
//   3. GET /health/deep → 200,组件明细含 postgres 版本/审计链状态
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import request = require('supertest');

describe('Health endpoints (Phase 1 Task 2.6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('GET /health/ready returns 200 with PG/Redis status', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.postgres.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
  });

  it('GET /health/deep returns component details', async () => {
    const res = await request(app.getHttpServer()).get('/health/deep');
    expect(res.status).toBe(200);
    // 开发环境 MinIO 未部署,允许 degraded;关键组件(postgres/audit)必须 up
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.components.postgres.status).toBe('up');
    expect(res.body.components.postgres.version).toMatch(/PostgreSQL/i);
    expect(res.body.components.audit.status).toBe('up');
    expect(typeof res.body.components.audit.totalRecords).toBe('number');
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
  });
});

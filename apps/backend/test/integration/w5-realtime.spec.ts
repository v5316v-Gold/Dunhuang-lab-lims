// =====================================================
// W5 Realtime Bus + SSE 集成测试(简化版)
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { RealtimeBus } from '../../src/modules/realtime/realtime.bus';
import request = require('supertest');

describe('W5 realtime bus + publish', () => {
  let app: INestApplication;
  let bus: RealtimeBus;

  beforeAll(async () => {
    installBigIntReplacer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    bus = app.get(RealtimeBus);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('RealtimeBus.publish emits event with id and timestamp', () => {
    const e = bus.publish({
      type: 'WASTE_TRANSFERRED',
      title: 'Test Transfer',
      message: 'WT-TEST-001 transferred',
      level: 'info',
    });
    expect(e.id).toMatch(/^evt-\d+/);
    expect(e.timestamp).toBeTruthy();
    expect(e.title).toBe('Test Transfer');
  });

  it('POST /realtime/publish accepts and echoes event', async () => {
    const res = await request(app.getHttpServer())
      .post('/realtime/publish')
      .send({
        type: 'GAS_LOW_STOCK',
        title: 'Test Low Stock',
        message: 'GAS-TEST low',
        level: 'warning',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.type).toBe('GAS_LOW_STOCK');
    expect(res.body.id).toMatch(/^evt-/);
  });

  it('POST /realtime/publish with all level types', async () => {
    const levels = ['info', 'success', 'warning', 'error'];
    for (const level of levels) {
      const res = await request(app.getHttpServer())
        .post('/realtime/publish')
        .send({
          type: 'TEST_EVENT',
          title: `Test ${level}`,
          message: `Test ${level} event`,
          level,
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.level).toBe(level);
    }
  });

  it('RealtimeBus.subscribe returns Observable', () => {
    const obs = bus.subscribe();
    expect(obs).toBeTruthy();
    expect(typeof obs.subscribe).toBe('function');
  });
});
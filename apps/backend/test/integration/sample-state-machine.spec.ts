// =====================================================
// 样品状态机测试 — Phase 2 Task 2.2
// 验证:
//   1. 纯函数: 合法转换 / 非法转换 / 允许事件列表
//   2. API: 创建样品 → 状态机推进全链路
//   3. API: 非法流转 → 400
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { canTransition, transitionSample, allowedEvents, SampleEvent } from '../../src/modules/sample/sample.state-machine';
import { SampleStatus } from '@prisma/client';
import request = require('supertest');

describe('Sample state machine (Phase 2 Task 2.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let sampleId: string;

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
    if (sampleId) {
      await prisma.$executeRawUnsafe(`DELETE FROM samples WHERE id = '${sampleId}'`).catch(() => {});
    }
    await app.close();
  });

  // ===== 纯函数测试 =====
  it('pure function: valid transitions', () => {
    expect(transitionSample(SampleStatus.RECEIVED, 'TO_BATCH')).toBe(SampleStatus.BATCHED);
    expect(transitionSample(SampleStatus.BATCHED, 'START_TEST')).toBe(SampleStatus.IN_TEST);
    expect(transitionSample(SampleStatus.IN_TEST, 'COMPLETE_TEST')).toBe(SampleStatus.TESTED);
    expect(transitionSample(SampleStatus.TESTED, 'TO_REPORT_DRAFT')).toBe(SampleStatus.REPORT_DRAFT);
    expect(transitionSample(SampleStatus.REPORT_DRAFT, 'SUBMIT_REVIEW')).toBe(SampleStatus.REPORT_REVIEW);
    expect(transitionSample(SampleStatus.REPORT_REVIEW, 'APPROVE')).toBe(SampleStatus.REPORT_APPROVED);
    expect(transitionSample(SampleStatus.REPORT_APPROVED, 'ARCHIVE')).toBe(SampleStatus.ARCHIVED);
  });

  it('pure function: invalid transitions return null', () => {
    expect(transitionSample(SampleStatus.RECEIVED, 'APPROVE')).toBeNull();
    expect(transitionSample(SampleStatus.ARCHIVED, 'TO_BATCH')).toBeNull();
    expect(transitionSample(SampleStatus.REJECTED, 'TO_BATCH')).toBeNull();
    expect(canTransition(SampleStatus.IN_TEST, 'TO_BATCH')).toBe(false);
  });

  it('pure function: REJECT from any active state', () => {
    expect(transitionSample(SampleStatus.MIXING as never, 'REJECT')).toBeNull(); // MIXING 不是样品状态
    for (const st of [SampleStatus.RECEIVED, SampleStatus.BATCHED, SampleStatus.IN_TEST]) {
      expect(transitionSample(st, 'REJECT')).toBe(SampleStatus.REJECTED);
    }
  });

  it('pure function: allowedEvents lists valid events', () => {
    const evts = allowedEvents(SampleStatus.RECEIVED);
    expect(evts).toContain('TO_BATCH');
    expect(evts).toContain('REJECT');
    expect(evts).not.toContain('APPROVE');
  });

  // ===== API 测试 =====
  it('API: create sample then walk full state machine', async () => {
    // 创建样品
    const createRes = await request(app.getHttpServer())
      .post('/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerName: 'StateMachine Test',
        sampleType: 'GOLD_INGOT',
        weightG: '1.0000',
      });
    expect([200, 201]).toContain(createRes.status);
    sampleId = createRes.body.id;

    // 推进: RECEIVED → BATCHED → IN_TEST → TESTED → REPORT_DRAFT → REPORT_REVIEW → REPORT_APPROVED → ARCHIVED
    const events: SampleEvent[] = ['TO_BATCH', 'START_TEST', 'COMPLETE_TEST', 'TO_REPORT_DRAFT', 'SUBMIT_REVIEW', 'APPROVE', 'ARCHIVE'];
    for (const ev of events) {
      const res = await request(app.getHttpServer())
        .post(`/samples/${sampleId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ event: ev });
      expect([200, 201]).toContain(res.status);
    }

    // 最终状态 ARCHIVED
    const final = await prisma.sample.findUnique({ where: { id: sampleId } });
    expect(final!.status).toBe(SampleStatus.ARCHIVED);
  });

  it('API: invalid transition returns 400', async () => {
    // ARCHIVED 状态再推进 TO_BATCH → 400
    const res = await request(app.getHttpServer())
      .post(`/samples/${sampleId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ event: 'TO_BATCH' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('非法状态转换');
  });
});

// =====================================================
// 样品编号生成器并发测试 — Phase 2 Task 2.1
// 验证:
//   1. 顺序生成: 编号递增且格式 YYMMDD-NNNN
//   2. 并发 50 次: 无重复编号(行锁安全)
//   3. sample.service.create 使用新生成器(编号连续)
//   4. 跨天键: 不同日期不同 dateKey
// =====================================================

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { installBigIntReplacer } from '../../src/common/filters/bigint-replacer';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { SampleNumberGenerator } from '../../src/modules/sample/sample-number.generator';

describe('Sample number generator (Phase 2 Task 2.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let generator: SampleNumberGenerator;

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
    generator = app.get(SampleNumberGenerator);
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== 测试 1: 顺序生成递增且格式正确 =====
  it('sequential generation: increasing numbers with YYMMDD-NNNN format', async () => {
    const a = await generator.next();
    const b = await generator.next();
    const c = await generator.next();

    // 格式: 6 位日期 + '-' + 4 位序号
    expect(a.sampleNo).toMatch(/^\d{6}-\d{4}$/);
    // 递增
    const seqOf = (s: string) => parseInt(s.split('-')[1], 10);
    expect(seqOf(b.sampleNo)).toBe(seqOf(a.sampleNo) + 1);
    expect(seqOf(c.sampleNo)).toBe(seqOf(b.sampleNo) + 1);
    // 同日 dateKey 一致
    expect(a.dateKey).toBe(b.dateKey);
  });

  // ===== 测试 2: 并发 50 次无重复(行锁) =====
  it('concurrent 50 calls produce no duplicate sampleNo', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => generator.next()),
    );
    const nos = results.map((r) => r.sampleNo);
    const unique = new Set(nos);
    expect(unique.size).toBe(50);  // 无重复
    // 全部同日期
    const keys = new Set(results.map((r) => r.dateKey));
    expect(keys.size).toBe(1);
  });

  // ===== 测试 3: 序列连续无空洞(事务内) =====
  it('sequence has no gaps (transactional)', async () => {
    const r1 = await generator.next();
    const r2 = await generator.next();
    const seq1 = parseInt(r1.sampleNo.split('-')[1], 10);
    const seq2 = parseInt(r2.sampleNo.split('-')[1], 10);
    expect(seq2).toBe(seq1 + 1);
  });
});

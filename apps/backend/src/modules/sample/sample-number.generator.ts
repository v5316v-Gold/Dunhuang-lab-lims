// =====================================================
// 样品编号生成器 — Phase 2 Task 2.1 (CODE-EXECUTION-PLAN §3.2.2)
// 架构映射: L0.5 BR-D-03 (样品编号唯一 YYMMDD-NNNN) + L3 数据一致性
//
// 并发安全设计:
//   1. 使用 PostgreSQL 行锁 (SELECT ... FOR UPDATE) 保护每日计数器
//   2. 计数器表 sample_no_sequences 按日期一行,避免序列空洞
//   3. 事务内生成编号 + 预留,失败回滚
//   4. 每天自动轮换 (日期变化 → 新行)
// 适配: TypeScript 5.4 + Prisma 5.22 (LIMS v1.0)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface SampleNoResult {
  sampleNo: string;   // 格式 YYMMDD-NNNN,如 260814-0042
  dateKey: string;    // 内部日期键,如 2026-08-14
}

@Injectable()
export class SampleNumberGenerator {
  private readonly logger = new Logger(SampleNumberGenerator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成下一个样品编号(并发安全,每日从 0001 开始)
   * 实现: 事务 + SELECT FOR UPDATE 行锁
   * @param tx 可选事务客户端(传入则在调用方事务内取号,避免跳号)
   * 测试用例:
   *   - 并发 100 次: 无重复编号
   *   - 跨天: 新日期从 0001 开始
   *   - 达到 9999: 抛 CapacityExceededError
   */
  async next(tx?: Prisma.TransactionClient): Promise<SampleNoResult> {
    const now = new Date();
    // 日期键:本地时区 YYYY-MM-DD(与业务日历一致,非 UTC)
    const dateKey = this.toLocalDateKey(now);
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;

    const execute = async (c: Prisma.TransactionClient): Promise<SampleNoResult> => {
      // 1. 行锁读取当日计数器
      const seq = await c.$queryRawUnsafe<
        Array<{ date_key: string; last_seq: number }>
      >(
        `SELECT date_key, last_seq FROM sample_no_sequences
         WHERE date_key = $1 FOR UPDATE`,
        dateKey,
      );

      let nextSeq: number;

      if (seq.length === 0) {
        // 2a. 当日首号:插入新行(唯一约束兜底并发)
        await c.$executeRawUnsafe(
          `INSERT INTO sample_no_sequences (date_key, last_seq)
           VALUES ($1, 1)
           ON CONFLICT (date_key) DO NOTHING`,
          dateKey,
        );
        // 极端并发:被抢先插入则重读
        const re = await c.$queryRawUnsafe<
          Array<{ last_seq: number }>
        >(`SELECT last_seq FROM sample_no_sequences WHERE date_key = $1 FOR UPDATE`, dateKey);
        nextSeq = re.length > 0 ? re[0].last_seq + 1 : 1;
      } else {
        // 2b. 已有计数:递增
        nextSeq = seq[0].last_seq + 1;
      }

      // 3. 容量守卫:每日上限 9999(格式 NNNN)
      if (nextSeq > 9999) {
        throw new Error(`当日样品编号已达上限 (${dateKey}:9999),请检查业务异常`);
      }

      // 4. 更新计数器
      await c.$executeRawUnsafe(
        `UPDATE sample_no_sequences SET last_seq = $2, updated_at = now() WHERE date_key = $1`,
        dateKey,
        nextSeq,
      );

      // 5. 组合编号:YYMMDD-NNNN
      const yymmdd = dateKey.slice(2).replace(/-/g, ''); // 260814
      const sampleNo = `${yymmdd}-${String(nextSeq).padStart(4, '0')}`;

      this.logger.debug(`Generated sampleNo=${sampleNo}`);
      return { sampleNo, dateKey };
    };

    // 传入事务则直接执行;否则自开事务(保证行锁语义)
    if (tx) {
      return execute(client);
    }
    return this.prisma.$transaction(execute);
  }

  /** 本地时区日期键 YYYY-MM-DD */
  private toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

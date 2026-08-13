// =====================================================
// 统一 BigInt JSON 序列化(Phase 0.5 Task A)
//
// 背景:Prisma 默认对 BigInt 字段 (audit_logs.id 等) 不做 JSON 序列化
// 解决方案:在 bootstrap() 注入全局 JSON.stringify replacer,
// 替代每个 controller 散写 Number(bigint)。
//
// 规则:BigInt 输出为字符串(字符串语义不损失精度)
//      Date 保持 ISO 字符串(默认 JSON 行为)
//      普通 number / string / boolean / null 保持原样
// =====================================================

import { Logger } from '@nestjs/common';

const logger = new Logger('BigIntReplacer');

/**
 * JSON.stringify replacer — 把 BigInt 序列化为字符串
 * 兼容标准 JSON.parse 行为(数字字符串可被前段 parseInt/parseBigInt)
 */
export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * NestJS 启动时全局替换 JSON.stringify
 * 一次性 patch,不在 controller / service 散写
 *
 * @example
 *   installBigIntReplacer();
 *   JSON.stringify({ id: 1n }); // → '{"id":"1"}'
 */
export function installBigIntReplacer(): void {
  const original = JSON.stringify;
  if ((original as unknown as { __bigintPatched?: boolean }).__bigintPatched) {
    return; // idempotent
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (JSON as any).stringify = function patched(
    value: unknown,
    replacer?: ((this: unknown, key: string, value: unknown) => unknown) | (string | number)[],
    space?: string | number,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = (this: unknown, k: string, v: unknown): unknown => {
      const after = bigintReplacer(k, v);
      if (typeof replacer === 'function') {
        return (replacer as (this: unknown, k: string, v: unknown) => unknown).call(this, k, after);
      }
      return after;
    };
    return original.call(this, value, wrapped as never, space);
  };
  (JSON.stringify as unknown as { __bigintPatched?: boolean }).__bigintPatched = true;
  logger.log('✅ BigInt JSON.stringify replacer 已安装');
}

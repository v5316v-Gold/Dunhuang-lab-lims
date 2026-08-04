// =====================================================
// SHA256 审计链 - 客户端工具
// 详见 ADR-0003
//
// 注意:服务端真实审计由 PG 触发器完成(详见 audit_chain.sql)
// 此包提供客户端工具,用于:
//   1. 离线场景下生成 prev_hash(后续同步时校验)
//   2. 测试场景验证算法
// =====================================================

import { createHash } from 'node:crypto';

/** 64 字符零字符串(初始化 prev_hash) */
export const ZERO_HASH = '0'.repeat(64);

/**
 * 计算审计链 SHA256 哈希
 *
 * @param prevHash 上一节点的 curr_hash(初始为 ZERO_HASH)
 * @param userId 操作者 ID
 * @param username 操作者用户名
 * @param action 操作(如 'INSERT:samples')
 * @param tableName 表名
 * @param recordId 记录 ID
 * @param newData 新数据(JSON)
 * @param timestamp 时间戳
 * @returns 64 字符 SHA256 hex
 */
export function computeAuditHash(input: {
  prevHash: string;
  userId?: string;
  username: string;
  action: string;
  tableName?: string;
  recordId?: string;
  newData: unknown;
  timestamp: Date;
}): string {
  const concat = [
    input.prevHash || ZERO_HASH,
    input.userId ?? 'null',
    input.username,
    input.action,
    input.tableName ?? '',
    input.recordId ?? '',
    JSON.stringify(input.newData ?? null),
    input.timestamp.toISOString(),
  ].join('|');

  return createHash('sha256').update(concat, 'utf8').digest('hex');
}

/**
 * 验证单条记录的哈希
 */
export function verifyAuditHash(record: {
  prevHash: string;
  userId?: string;
  username: string;
  action: string;
  tableName?: string;
  recordId?: string;
  newData: unknown;
  createdAt: Date;
  currHash: string;
}): { passed: boolean; expected: string } {
  const expected = computeAuditHash({
    prevHash: record.prevHash,
    userId: record.userId,
    username: record.username,
    action: record.action,
    tableName: record.tableName,
    recordId: record.recordId,
    newData: record.newData,
    timestamp: record.createdAt,
  });

  return {
    passed: expected === record.currHash,
    expected,
  };
}

/**
 * 验证整条审计链
 */
export function verifyAuditChain(
  records: Array<{
    id: number;
    prevHash: string;
    currHash: string;
  }>,
): { passed: boolean; brokenAt?: number } {
  let prevHash = ZERO_HASH;
  for (const r of records) {
    if (r.prevHash !== prevHash) {
      return { passed: false, brokenAt: r.id };
    }
    prevHash = r.currHash;
  }
  return { passed: true };
}
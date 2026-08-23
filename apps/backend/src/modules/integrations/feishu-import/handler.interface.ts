// =====================================================
// 导入 Handler 抽象接口 + 人员匹配工具 — W3-A
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export type PrismaTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ImportHandler {
  entityType: ImportEntityType;
  /** 中文/英文列名 → LIMS 字段名 */
  defaultMappings: Record<string, string>;
  /** 可选预处理(日期/数量/枚举转换) */
  preprocess?(row: Record<string, any>): Record<string, any>;
  /** 单行校验(返回错误数组,空 = 通过) */
  validate(row: Record<string, any>): Promise<ValidationError[]>;
  /** 写入单行(返回创建的资源 ID) */
  create(row: Record<string, any>, tx: PrismaTx): Promise<string>;
}

/**
 * 人员匹配工具:按工号(username)或姓名查找用户,不存在则创建
 * 用户答复:人员名字不重要,主要得有人员管理功能
 * → 用 username 精确匹配(飞书"工号"字段),查不到时按 ANALYST + 默认密码创建
 */
export async function findOrCreateUser(
  tx: PrismaTx,
  input: { username?: string | null; name?: string | null; phone?: string | null; role?: string },
): Promise<string | null> {
  const username = input.username?.trim() || input.name?.trim();
  if (!username) return null;

  // 1. 先按 username 查
  let user = await tx.user.findUnique({ where: { username } });
  if (user) return user.id;

  // 2. 按姓名查(若提供了姓名且和 username 不同)
  if (input.name && input.name !== username) {
    const byName = await tx.user.findFirst({ where: { name: input.name } });
    if (byName) return byName.id;
  }

  // 3. 创建(默认 ANALYST + Analyst@Pass123,与 PasswordService 同用 argon2id)
  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash('Analyst@Pass123', { type: argon2.argon2id });
  const created = await tx.user.create({
    data: {
      username,
      name: input.name ?? username,
      email: `${username}@dunhuang.local`,
      phone: input.phone ?? null,
      role: (input.role as any) ?? 'ANALYST',
      passwordHash,
    },
  });
  return created.id;
}

/** 判断字段是否为空 */
export function isBlank(v: any): boolean {
  return v == null || String(v).trim() === '';
}

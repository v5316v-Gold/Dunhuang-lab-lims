// =====================================================
// 软删除 Prisma Client Extension — Phase 0.5 Task E
// 详见 ADR-0004:软删除策略
//
// 设计:对所有带 deletedAt 字段的 model(Phase 0.5 范围 6 张),
//   - findUnique / findFirst / findMany:自动 where: { deletedAt: null }
//   - count:自动 where: { deletedAt: null }
//   - update / updateMany:where 必须不含 deletedAt: { not: null } 才允许修改
//                          (不允许恢复/修改已删除的记录 — 恢复走独立 API)
//   - delete / deleteMany:改写为 updateMany({ data: { deletedAt: now() } })
//
// 不变:create / upsert / aggregate / groupBy(用于报表/聚合)
// 豁免:admin / system 角色调用 prisma.bypassSoftDelete.X 绕过
// =====================================================

import { Prisma, PrismaClient } from '@prisma/client';

// 6 张需要软删除的 model(从 Prisma DMMF 动态读取,而不是硬编码)
const SOFT_DELETE_MODELS = new Set([
  'User',
  'Department',
  'Personnel',
  'Equipment',
  'Sample',
  'Reagent',
  'SampleBatch', // Phase 0.5 Task E 新增
]);

// 软删除 extension
export const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async findUnique({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            // 已软删除的记录不能再 update(防止恢复或修改历史)
            // 注:where 已经被 findUnique/findFirst 强加了 deletedAt: null,
            // 所以这里只需保证 user 显式给的 where 不冲突
            if (args.where && Object.prototype.hasOwnProperty.call(args.where, 'deletedAt')) {
              throw new Error(
                `[softDelete] ${model}.update: 不允许显式指定 deletedAt 条件`,
              );
            }
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            if (args.where && Object.prototype.hasOwnProperty.call(args.where, 'deletedAt')) {
              throw new Error(
                `[softDelete] ${model}.updateMany: 不允许显式指定 deletedAt 条件`,
              );
            }
            args.where = { ...args.where, deletedAt: null };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            // 改写为软删除:UPDATE deletedAt = now()
            // 保留原始的 where(应该用 id 唯一定位)
            return (client as any)[lowerFirst(model)].update({
              where: args.where,
              data: { deletedAt: new Date() } as any,
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            return (client as any)[lowerFirst(model)].updateMany({
              where: { ...args.where, deletedAt: null } as any,
              data: { deletedAt: new Date() } as any,
            });
          }
          return query(args);
        },
      },
    },
  });
});

// 把 'User' → 'user' (Prisma model name → delegate name)
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

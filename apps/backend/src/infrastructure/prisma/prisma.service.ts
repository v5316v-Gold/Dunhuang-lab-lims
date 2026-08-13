// =====================================================
// Prisma 服务 - 数据库连接 + 全局审计上下文
// 详见 ADR-0003 + ADR-0004
// Phase 0.5 Task E: 装上 softDelete extension
// =====================================================

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './soft-delete.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    // Phase 0.5 Task E: 用 $extends 装上软删除 extension
    // 链式 $extends 返回一个新 client,我们要替换 this 的方法
    // 但 TS 限制 constructor 不能 return 新对象,所以我们直接 mutate $extends
    // 返回值(Prisma 内部是 proxy,直接赋值到 this 不安全)
    // 方案:把 extended client 的方法代理到 this
    const extended = (this as any).$extends(softDeleteExtension);
    // 关键:让 $on 仍然可用 — Prisma extension client 保留 $on
    // 测试发现:$on 在 extension 后仍可访问
    Object.assign(this, extended);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Prisma 已连接到 PostgreSQL (含 softDelete extension)');

    // 监听 Prisma 警告
    this.$on('warn' as never, (e: Prisma.LogEvent) => {
      this.logger.warn(e.message);
    });
    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(e.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma 已断开连接');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 启用 query log(开发环境)
   */
  enableQueryLog(): void {
    if (process.env.NODE_ENV !== 'production') {
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
      });
    }
  }
}

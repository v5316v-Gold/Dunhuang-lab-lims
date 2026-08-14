// =====================================================
// 健康检查(给 K8s liveness/readiness 用)
// 详见 ADR-0008(本地 K8s)
// =====================================================

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { MinioService } from '../minio/minio.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly minio: MinioService,
  ) {}

  /**
   * GET /health/live
   * 存活检查(进程是否存活)
   */
  @Get('live')
  @ApiOperation({ summary: '存活检查' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/ready
   * 就绪检查(所有依赖是否就绪)
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: '就绪检查(PG/Redis/MinIO)' })
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        const ok = await this.prisma.healthCheck();
        return { postgres: { status: ok ? 'up' : 'down' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const ok = await this.redis.healthCheck();
        return { redis: { status: ok ? 'up' : 'down' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const ok = await this.minio.healthCheck();
        return { minio: { status: ok ? 'up' : 'down' } };
      },
    ]);
  }

  /**
   * GET /health/deep
   * 深度检查(Phase 1 Task 2.6): 各组件明细 + 审计链自检状态
   * 返回详细指标,供运维监控(Prometheus 抓取/人工排障)
   */
  @Get('deep')
  @ApiOperation({ summary: '深度检查(组件明细+审计链)' })
  async deep() {
    const started = Date.now();

    // 1. PostgreSQL 明细
    let postgres: Record<string, unknown> = { status: 'down' };
    try {
      const version = await this.prisma.$queryRawUnsafe<Array<{ version: string }>>('SELECT version() AS version');
      const dbName = await this.prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT current_database() AS db');
      postgres = {
        status: 'up',
        version: version[0]?.version?.split(' on ')[0] ?? 'unknown',
        database: dbName[0]?.db ?? 'unknown',
      };
    } catch (e) {
      postgres = { status: 'down', error: (e as Error).message };
    }

    // 2. Redis 明细
    let redis: Record<string, unknown> = { status: 'down' };
    try {
      const ping = await this.redis.healthCheck();
      redis = { status: ping ? 'up' : 'down' };
    } catch (e) {
      redis = { status: 'down', error: (e as Error).message };
    }

    // 3. MinIO 明细
    let minio: Record<string, unknown> = { status: 'down' };
    try {
      const ok = await this.minio.healthCheck();
      minio = { status: ok ? 'up' : 'down' };
    } catch (e) {
      minio = { status: 'down', error: (e as Error).message };
    }

    // 4. 审计链自检(轻量: 只查最后一条与计数)
    let audit: Record<string, unknown> = { status: 'unknown' };
    try {
      const count = await this.prisma.auditLog.count();
      const last = await this.prisma.auditLog.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, action: true, createdAt: true },
      });
      audit = { status: 'up', totalRecords: count, lastAction: last?.action ?? null, lastAt: last?.createdAt ?? null };
    } catch (e) {
      audit = { status: 'down', error: (e as Error).message };
    }

    const allUp = postgres.status === 'up' && redis.status === 'up' && minio.status === 'up' && audit.status === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - started,
      components: { postgres, redis, minio, audit },
    };
  }
}
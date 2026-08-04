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
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MinioService } from '../minio/minio.service';

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
}
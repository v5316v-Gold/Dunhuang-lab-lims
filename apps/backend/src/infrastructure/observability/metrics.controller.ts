// =====================================================
// /metrics / health/live / health/ready 端点
// =====================================================

import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Prometheus 抓取端点
   * 注意:内容类型必须是 text/plain; version=0.0.4
   */
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.getContentType());
    const body = await this.metrics.getMetrics();
    res.send(body);
  }

  /**
   * 存活探针(只要进程在跑就 200,用于 K8s livenessProbe)
   */
  @Get('health/live')
  @HttpCode(HttpStatus.OK)
  live(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 就绪探针(检查依赖: PG + Redis)
   */
  @Get('health/ready')
  async ready(@Res() res: Response): Promise<void> {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    let overallOk = true;

    // PG
    const pgStart = Date.now();
    try {
      const ok = await this.prisma.healthCheck();
      checks.postgres = { status: ok ? 'up' : 'down', latencyMs: Date.now() - pgStart };
      if (!ok) overallOk = false;
    } catch (e) {
      checks.postgres = { status: 'down', error: (e as Error).message };
      overallOk = false;
    }

    // Redis
    const redisStart = Date.now();
    try {
      const pong = await this.redis.ping();
      checks.redis = {
        status: pong === 'PONG' ? 'up' : 'down',
        latencyMs: Date.now() - redisStart,
      };
      if (pong !== 'PONG') overallOk = false;
    } catch (e) {
      checks.redis = { status: 'down', error: (e as Error).message };
      overallOk = false;
    }

    res.status(overallOk ? 200 : 503).json({
      status: overallOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}

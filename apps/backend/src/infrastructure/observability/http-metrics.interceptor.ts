// =====================================================
// HTTP 指标拦截器 — 自动记录每次请求
// =====================================================

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 只统计 HTTP
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // 排除 /metrics 自身(否则每次抓取都会自增)
    if (req.url === '/metrics' || req.url === '/health/live' || req.url === '/health/ready') {
      return next.handle();
    }

    // route 优先用路由模板,否则用原始 URL(避免基数爆炸)
    const route = (req.route?.path as string | undefined) ?? req.path;

    const method = req.method;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, route, res.statusCode, start),
        error: (err: { status?: number; statusCode?: number; name?: string }) => {
          const status = err?.status ?? err?.statusCode ?? 500;
          this.record(method, route, status, start, err?.name ?? 'Error');
        },
      }),
    );
  }

  private record(
    method: string,
    route: string,
    status: number,
    start: number,
    errorType?: string,
  ): void {
    const duration = (Date.now() - start) / 1000;
    const labels = { method, route, status: String(status) };

    this.metrics.httpRequestsTotal.inc(labels);
    this.metrics.httpRequestDurationSeconds.observe(labels, duration);

    if (status >= 400 && errorType) {
      this.metrics.httpRequestErrors.inc({
        method,
        route,
        status: String(status),
        error_type: errorType,
      });
    }
  }
}

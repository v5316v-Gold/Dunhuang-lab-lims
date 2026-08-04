// =====================================================
// 全局日志拦截器
// 记录所有 HTTP 请求 + 响应时间
// =====================================================

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const start = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') ?? '';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = response.statusCode;
          const contentLength = response.getHeader('content-length') ?? 0;

          // 5xx / 4xx 升级日志级别
          const logMsg = `${method} ${url} ${statusCode} ${duration}ms ${contentLength}b - ${ip} "${userAgent}"`;

          if (statusCode >= 500) {
            this.logger.error(logMsg);
          } else if (statusCode >= 400) {
            this.logger.warn(logMsg);
          } else {
            this.logger.log(logMsg);
          }
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.error(`${method} ${url} FAILED ${duration}ms - ${err.message}`);
        },
      }),
    );
  }
}
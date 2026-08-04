// =====================================================
// 全局 HTTP 异常过滤器
// 统一错误响应格式
// =====================================================

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';
    let details: unknown;

    // HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const r = exResponse as Record<string, unknown>;
        message = (r.message as string | string[]) ?? exception.message;
        error = (r.error as string) ?? exception.name;
        details = r.details;
      }
    }
    // Prisma 错误
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      error = `Prisma.${exception.code}`;
      message = this.handlePrismaError(exception);
      details = { meta: exception.meta };
    }
    // Prisma 验证错误
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'PrismaValidationError';
      message = '数据验证失败';
    }
    // 其他 Error
    else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
      // 生产环境不暴露堆栈
      if (process.env.NODE_ENV !== 'production') {
        details = { stack: exception.stack };
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      error,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 记录日志(5xx 才记 error 级别)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} ${error}`);
    }

    response.status(status).json(errorResponse);
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): string {
    switch (exception.code) {
      case 'P2002':
        return `唯一约束冲突: ${JSON.stringify(exception.meta?.target)}`;
      case 'P2025':
        return '记录不存在';
      case 'P2003':
        return `外键约束违反: ${exception.meta?.field_name}`;
      case 'P2011':
        return '必填字段为空';
      default:
        return `数据库错误: ${exception.code}`;
    }
  }
}
// =====================================================
// 审计上下文拦截器 - 关键合规设计
// 详见 ADR-0003:审计链 = PG 触发器
//
// 职责:
//   1. 从 JWT 解析 user
//   2. 通过 SET LOCAL 把 user_id / username 写入 PG session
//   3. 这样 PG 触发器 audit_trigger() 才能获取当前用户,自动写 audit_logs
// =====================================================

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // 若有用户,设置 PG session 变量
    if (user?.id && user?.username) {
      // 使用 $transaction 包住整个请求,确保 SET LOCAL 在同一事务
      // 但 NestJS 拦截器在 Controller 执行前后,这里需要在请求开始前注入
      // 改用 nestjs-cls 存储用户信息,在 service 层通过 $transaction 自动 SET LOCAL
      this.cls.set('userId', user.id);
      this.cls.set('username', user.username);
      this.cls.set('ip', request.ip);
    }

    return next.handle().pipe(
      catchError((err) => {
        // 异常也要记录(由 PG 触发器自动处理)
        return throwError(() => err);
      }),
    );
  }
}

/**
 * Prisma Extension: 自动注入审计上下文
 * 在 service 层调用 prisma 任何方法时,自动 SET LOCAL
 *
 * 用法:在 PrismaService 中应用此 extension
 */
export function createAuditPrismaExtension(prisma: PrismaService, cls: ClsService) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const userId = cls.get('userId');
          const username = cls.get('username');

          if (userId && username) {
            // 用 $transaction 包住,SET LOCAL 跟随事务
            return await prisma.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}';`);
              await tx.$executeRawUnsafe(`SET LOCAL app.current_username = '${username}';`);
              return query(args);
            });
          }

          return query(args);
        },
      },
    },
  });
}
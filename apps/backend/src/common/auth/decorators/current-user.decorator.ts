// =====================================================
// 当前用户装饰器
// 用法: @CurrentUser() user: User
// =====================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

export const CurrentUser = createParamDecorator((data: keyof User | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as User;
  if (data) {
    return user?.[data];
  }
  return user;
});
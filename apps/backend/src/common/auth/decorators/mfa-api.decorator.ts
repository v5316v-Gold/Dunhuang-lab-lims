// =====================================================
// P0-Fix-2: MFA 组合装饰器
// 简化 @RequireMfa + @UseGuards(MfaGuard) 同时声明
//
// 用法:
//   @MfaProtected(MFA_SCENES.REPORT_ISSUE)
//   @Post(':id/issue')
//   async issue() { ... }
//
// 或者纯装饰器风格:
//   @MfaProtected('REPORT_ISSUE')
//   @Post(':id/issue')
//
// 必须先经过 JwtAuthGuard(从全局 APP_GUARD 顺序保证)
// =====================================================

import { applyDecorators, UseGuards } from '@nestjs/common';

import { MfaGuard } from '../guards/mfa.guard';
import { RequireMfa, MfaScene } from './require-mfa.decorator';

export function MfaProtected(scene: MfaScene) {
  return applyDecorators(
    RequireMfa(scene),
    UseGuards(MfaGuard),
  );
}

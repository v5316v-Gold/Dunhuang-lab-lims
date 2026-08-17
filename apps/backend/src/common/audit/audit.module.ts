// =====================================================
// 审计模块 - SHA256 链查询/断链自检 + 系统/安全审计事件
// 详见 ADR-0003
// Phase 1 Task 2.1: 新增 SecurityAuditService
// =====================================================

import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { SecurityAuditService } from './security-audit.service';

@Global()  // P0-Fix-2 修复:SecurityAuditService 需全局可注入(MfaGuard/业务服务依赖)
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    SecurityAuditService,
    AuditContextInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
  exports: [AuditService, SecurityAuditService, AuditContextInterceptor],
})
export class AuditModule {}
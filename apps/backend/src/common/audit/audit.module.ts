// =====================================================
// 审计模块 - SHA256 链查询/断链自检
// 详见 ADR-0003
// =====================================================

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditContextInterceptor } from './audit-context.interceptor';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditContextInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
  exports: [AuditService, AuditContextInterceptor],
})
export class AuditModule {}
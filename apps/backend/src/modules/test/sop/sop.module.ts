// =====================================================
// P0-Fix-1: SOP 模块(之前漏注册)
// =====================================================

import { Module } from '@nestjs/common';

import { AuditModule } from '../../../common/audit/audit.module';
import { SopService } from './sop.service';
import { SopController } from './sop.controller';

@Module({
  imports: [AuditModule],   // P0-Fix-2 修复:SopService 依赖 SecurityAuditService
  controllers: [SopController],
  providers: [SopService],
  exports: [SopService],
})
export class SopModule {}

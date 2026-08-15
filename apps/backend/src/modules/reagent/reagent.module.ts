// =====================================================
// 域 9: reagent - 试剂/耗材/库存
// 详见 ADR-0011 / Phase 3 文档
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';

import { ReagentController } from './reagent.controller';
import { ReagentService } from './reagent.service';

@Module({
  imports: [AuditModule],
  controllers: [ReagentController],
  providers: [ReagentService],
  exports: [ReagentService],
})
export class ReagentModule {}
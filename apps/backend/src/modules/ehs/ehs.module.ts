// =====================================================
// 域 10: ehs - 隐患/应急
// =====================================================

import { Module } from '@nestjs/common';

import { EhsController } from './ehs.controller';
import { EhsService } from './ehs.service';
import { AuditModule } from '../../common/audit/audit.module';
import { WasteController } from './waste.controller';
import { WasteService } from './waste.service';

@Module({
  imports: [AuditModule],
  controllers: [EhsController, WasteController],
  providers: [EhsService, WasteService],
  exports: [EhsService, WasteService],
})
export class EhsModule {}
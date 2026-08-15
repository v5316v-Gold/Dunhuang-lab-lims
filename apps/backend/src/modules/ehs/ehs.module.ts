// =====================================================
// 域 10: ehs - 隐患/应急
// =====================================================

import { Module } from '@nestjs/common';

import { EhsController } from './ehs.controller';
import { EhsService } from './ehs.service';
import { AuditModule } from '../../common/audit/audit.module';
import { WasteController } from './waste.controller';
import { WasteService } from './waste.service';
import { GasController } from './gas.controller';
import { GasService } from './gas.service';

@Module({
  imports: [AuditModule],
  controllers: [EhsController, WasteController, GasController],
  providers: [EhsService, WasteService, GasService],
  exports: [EhsService, WasteService, GasService],
})
export class EhsModule {}
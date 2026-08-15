// =====================================================
// W4 贵金属业务 - Module
// =====================================================

import { Module } from '@nestjs/common';
import { PreciousMetalController } from './precious-metal.controller';
import { PreciousMetalService } from './precious-metal.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PreciousMetalController],
  providers: [PreciousMetalService],
  exports: [PreciousMetalService],
})
export class PreciousMetalModule {}
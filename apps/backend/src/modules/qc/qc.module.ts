// =====================================================
// 域 7: qc - 质量控制(Westgard + 6σ)
// 详见 Phase 2 文档 §5.1
// =====================================================

import { Module } from '@nestjs/common';
import { QcController } from './qc.controller';
import { QcService } from './qc.service';
import { WestgardService } from './westgard.service';

@Module({
  controllers: [QcController],
  providers: [QcService, WestgardService],
  exports: [QcService, WestgardService],
})
export class QcModule {}
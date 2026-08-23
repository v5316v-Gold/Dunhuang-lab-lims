// =====================================================
// 原始记录单模块 — W4-B (CNAS §7.5 记录控制)
// =====================================================

import { Module } from '@nestjs/common';
import { RawRecordController } from './raw-record.controller';
import { RawRecordSheetService } from './raw-record.service';

@Module({
  controllers: [RawRecordController],
  providers: [RawRecordSheetService],
  exports: [RawRecordSheetService],
})
export class RawRecordModule {}

// =====================================================
// 域 10: ehs - 隐患/应急
// =====================================================

import { Module } from '@nestjs/common';
import { EhsController } from './ehs.controller';
import { EhsService } from './ehs.service';

@Module({
  controllers: [EhsController],
  providers: [EhsService],
  exports: [EhsService],
})
export class EhsModule {}
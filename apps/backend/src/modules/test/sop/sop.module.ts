// =====================================================
// P0-Fix-1: SOP 模块(之前漏注册)
// =====================================================

import { Module } from '@nestjs/common';

import { SopService } from './sop.service';
import { SopController } from './sop.controller';

@Module({
  controllers: [SopController],
  providers: [SopService],
  exports: [SopService],
})
export class SopModule {}

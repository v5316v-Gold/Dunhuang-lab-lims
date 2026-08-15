// =====================================================
// 域 5.b: batch - 检测批次(火试金/ICP)
// 详见 Phase 2 文档 §5.1 / ADR-0005(状态机)
// =====================================================

import { Module } from '@nestjs/common';

import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

@Module({
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
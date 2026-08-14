// =====================================================
// 域 5: sample - 样品管理
// 详见 ADR-0011 / Phase 2 文档
// =====================================================

import { Module } from '@nestjs/common';

import { BatchModule } from '../batch/batch.module';

import { SampleController } from './sample.controller';
import { SampleNumberGenerator } from './sample-number.generator';
import { SampleService } from './sample.service';

@Module({
  imports: [BatchModule],
  controllers: [SampleController],
  providers: [SampleService, SampleNumberGenerator],
  exports: [SampleService, SampleNumberGenerator],
})
export class SampleModule {}
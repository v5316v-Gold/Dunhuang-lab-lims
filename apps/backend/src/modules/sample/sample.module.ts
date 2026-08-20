// =====================================================
// 域 5: sample - 样品管理
// 详见 ADR-0011 / Phase 2 文档
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { StateMachineModule } from '../../common/state-machine/state-machine.module';
import { RetentionSchedulerService } from './retention-scheduler.service';

import { BatchModule } from '../batch/batch.module';

import { SampleController } from './sample.controller';
import { SampleNumberGenerator } from './sample-number.generator';
import { SampleService } from './sample.service';

@Module({
  imports: [BatchModule, AuditModule, StateMachineModule],
  controllers: [SampleController],
  providers: [SampleService, SampleNumberGenerator, RetentionSchedulerService],
  exports: [SampleService, SampleNumberGenerator, RetentionSchedulerService],
})
export class SampleModule {}
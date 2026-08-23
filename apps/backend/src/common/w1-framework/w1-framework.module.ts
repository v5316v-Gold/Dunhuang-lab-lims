// =====================================================
// W1 架构改进模块(@Global — 各业务模块可注入)
// 承载:SodService / ProcessedEventService / RetentionPolicyService / SodPolicyService
// 未来:AuthorizedSignatory / SodPolicy / 环境预警 等也可纳入
// =====================================================

import { Global, Module } from '@nestjs/common';

import { ProcessedEventService } from './processed-event.service';
import { SodService } from './sod.service';
import { SodPolicyController } from './sod-policy.controller';
import { SodPolicyService } from './sod-policy.service';
import { RetentionPolicyController } from './retention-policy.controller';
import { RetentionPolicyService } from './retention-policy.service';

@Global()
@Module({
  controllers: [RetentionPolicyController, SodPolicyController],
  providers: [
    SodService,
    ProcessedEventService,
    RetentionPolicyService,
    SodPolicyService,
  ],
  exports: [
    SodService,
    ProcessedEventService,
    RetentionPolicyService,
    SodPolicyService,
  ],
})
export class W1FrameworkModule {}

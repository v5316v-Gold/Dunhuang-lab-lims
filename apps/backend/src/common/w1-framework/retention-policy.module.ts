// =====================================================
// 留样期模块(W1 架构 — CNAS-CL01 §7.5.2)
// 提供 RetentionPolicyService + Controller
// =====================================================

import { Module } from '@nestjs/common';
import { RetentionPolicyController } from './retention-policy.controller';
import { RetentionPolicyService } from './retention-policy.service';

@Module({
  controllers: [RetentionPolicyController],
  providers: [RetentionPolicyService],
  exports: [RetentionPolicyService],
})
export class RetentionPolicyModule {}

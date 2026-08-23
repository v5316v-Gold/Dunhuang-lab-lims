// =====================================================
// 授权签字人模块(W1 架构 — CNAS-CL01:2018 §7.5.3)
// 签字人名录维护 + 校验(报告签发时)
// =====================================================

import { Module } from '@nestjs/common';
import { AuthorizedSignatoryController } from './authorized-signatory.controller';
import { AuthorizedSignatoryService } from './authorized-signatory.service';

@Module({
  controllers: [AuthorizedSignatoryController],
  providers: [AuthorizedSignatoryService],
  exports: [AuthorizedSignatoryService],
})
export class AuthorizedSignatoryModule {}

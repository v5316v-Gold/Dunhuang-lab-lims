// =====================================================
// 域 6: test - 检测任务(火试金 / ICP)
// 详见 ADR-0011 / Phase 2 文档
// =====================================================

import { Module } from '@nestjs/common';

import { FireAssayController } from './fire-assay.controller';
import { FireAssayService } from './fire-assay.service';
import { IcpController } from './icp.controller';
import { IcpService } from './icp.service';
import { TestController } from './test.controller';
import { TestService } from './test.service';

@Module({
  controllers: [TestController, FireAssayController, IcpController],
  providers: [TestService, FireAssayService, IcpService],
  exports: [TestService, FireAssayService, IcpService],
})
export class TestModule {}
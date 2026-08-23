// =====================================================
// 域 6: test - 检测任务(火试金 / ICP)
// 详见 ADR-0011 / Phase 2 文档
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';

import { FireAssayController } from './fire-assay.controller';
import { FireAssayService } from './fire-assay.service';
import { IcpController } from './icp.controller';
import { IcpService } from './icp.service';
import { TestAccessService } from './test-access.service';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { UncertaintyController } from './uncertainty.controller';
import { UncertaintyService } from './uncertainty.service';
import { ReferenceMaterialController } from './reference-material.controller';
import { ReferenceMaterialService } from './reference-material.service';

@Module({
  imports: [AuditModule],
  controllers: [TestController, FireAssayController, IcpController, UncertaintyController, ReferenceMaterialController],
  providers: [TestService, FireAssayService, IcpService, TestAccessService, UncertaintyService, ReferenceMaterialService],
  exports: [TestService, FireAssayService, IcpService, TestAccessService, UncertaintyService, ReferenceMaterialService],
})
export class TestModule {}
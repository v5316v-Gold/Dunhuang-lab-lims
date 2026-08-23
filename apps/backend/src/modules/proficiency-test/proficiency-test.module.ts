// =====================================================
// 能力验证 PT 模块 — W4-A (CNAS §7.7)
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { ProficiencyTestController } from './proficiency-test.controller';
import { ProficiencyTestService } from './proficiency-test.service';

@Module({
  imports: [AuditModule],
  controllers: [ProficiencyTestController],
  providers: [ProficiencyTestService],
  exports: [ProficiencyTestService],
})
export class ProficiencyTestModule {}

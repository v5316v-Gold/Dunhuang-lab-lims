// =====================================================
// 能力验证 PT 模块 — W4-A (CNAS §7.7)
// =====================================================

import { Module } from '@nestjs/common';
import { ProficiencyTestController } from './proficiency-test.controller';
import { ProficiencyTestService } from './proficiency-test.service';

@Module({
  controllers: [ProficiencyTestController],
  providers: [ProficiencyTestService],
  exports: [ProficiencyTestService],
})
export class ProficiencyTestModule {}

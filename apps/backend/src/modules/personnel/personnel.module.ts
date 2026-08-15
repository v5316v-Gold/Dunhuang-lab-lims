// =====================================================
// 域 2: personnel - 人员/培训/能力矩阵
// =====================================================

import { Module } from '@nestjs/common';

import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';

@Module({
  controllers: [PersonnelController],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
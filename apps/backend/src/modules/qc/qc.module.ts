// =====================================================
// 域 7: qc - 质量控制(Westgard + 6σ)
// 详见 Phase 2 文档 §5.1
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';

import { QcController } from './qc.controller';
import { QcService } from './qc.service';
// Phase 1B P0-C: Westgard 逻辑已抽到 common/qc/westgard.ts
// WestgardService 仍保留(兼容)但 QcService 不再依赖

@Module({
  imports: [AuditModule],
  controllers: [QcController],
  providers: [QcService],
  exports: [QcService],
})
export class QcModule {}
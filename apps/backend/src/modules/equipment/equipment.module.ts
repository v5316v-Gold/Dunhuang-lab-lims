// =====================================================
// 域 3: equipment - 设备/校准/维护
// =====================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { FileController } from './file.controller';
import { FileUploadService } from './file-upload.service';
// P0-Fix-1: 期间核查子模块(ScheduleModule 已在 MetricsModule 中 @Global 注册,这里不用重复)
import { PeriodicCheckController } from './periodic-check/periodic-check.controller';
import { PeriodicCheckService } from './periodic-check/periodic-check.service';

@Module({
  imports: [AuditModule, MinioModule],
  controllers: [EquipmentController, FileController, PeriodicCheckController],
  providers: [EquipmentService, FileUploadService, PeriodicCheckService],
  exports: [EquipmentService, FileUploadService, PeriodicCheckService],
})
export class EquipmentModule {}
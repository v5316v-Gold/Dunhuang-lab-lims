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

@Module({
  imports: [AuditModule, MinioModule],
  controllers: [EquipmentController, FileController],
  providers: [EquipmentService, FileUploadService],
  exports: [EquipmentService, FileUploadService],
})
export class EquipmentModule {}
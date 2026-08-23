// =====================================================
// 飞书表格导入模块 — W3-A
// 22 个实体 handler + 通用上传/预览/确认框架
// =====================================================

import { Module } from '@nestjs/common';
import { FeishuImportController } from './feishu-import.controller';
import { FeishuImportService } from './feishu-import.service';

@Module({
  controllers: [FeishuImportController],
  providers: [FeishuImportService],
  exports: [FeishuImportService],
})
export class FeishuImportModule {}

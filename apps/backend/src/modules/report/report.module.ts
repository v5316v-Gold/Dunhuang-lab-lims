// =====================================================
// 域 8: report - 检测报告 + 多级审核 + 电子签名
// 详见 ADR-0005 / ADR-0006 / Phase 2 文档
// =====================================================

import { Module } from '@nestjs/common';

import { ReportController } from './report.controller';
import { ReportPdfService } from './report-pdf.service';
import { ReportService } from './report.service';
import { ReportSignatureService } from './report-signature.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, ReportSignatureService, ReportPdfService],
  exports: [ReportService, ReportSignatureService, ReportPdfService],
})
export class ReportModule {}
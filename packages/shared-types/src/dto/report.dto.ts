// =====================================================
// 报告 DTO(共享)
// =====================================================

import { ReportStatus } from '../enums';

export interface ReportDto {
  id: string;
  reportNo: string;
  sampleId: string;
  status: ReportStatus;
  pdfSha256?: string;
  issuedAt?: string;
  createdAt: string;
}
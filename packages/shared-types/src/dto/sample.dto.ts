// =====================================================
// 样品 DTO(共享)
// =====================================================

import { SampleStatus, SampleType } from '../enums';

export interface SampleDto {
  id: string;
  sampleNo: string;
  customerName: string;
  customerRef?: string;
  sampleType: SampleType;
  declaredPurityPct?: string;
  weightG: string;
  status: SampleStatus;
  receivedAt: string;
  receivedBy?: { id: string; username: string; name: string };
  batch?: { id: string; batchNo: string; method: string; status: string };
}

export interface CreateSampleRequest {
  customerName: string;
  customerRef?: string;
  sampleType: SampleType;
  declaredPurityPct?: string;
  weightG: string;
  storageLocation?: string;
  remarks?: string;
}
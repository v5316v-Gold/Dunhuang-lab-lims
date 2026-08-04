// =====================================================
// 检测 DTO(共享)
// =====================================================

import { AssayMethod, TestStatus } from '../enums';

export interface TestDto {
  id: string;
  sampleId: string;
  method: AssayMethod;
  status: TestStatus;
  purityPct?: string;
  uncertainty?: string;
  qcPassed?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface FireAssayDetailDto {
  sampleWeightG: string;
  leadButtonWeightG?: string;
  prillWeightG?: string;
  furnaceTempC?: number;
  cupellationMin?: number;
  partingMin?: number;
  annealingMin?: number;
  qcRecoveryPct?: string;
}

export interface ElementResultDto {
  id: string;
  testId: string;
  element: string;
  concentration: string;
  unit: string;
  lod?: string;
  loq?: string;
  uncertainty?: string;
}
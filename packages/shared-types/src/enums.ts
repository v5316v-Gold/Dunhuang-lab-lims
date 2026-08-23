// =====================================================
// 业务枚举(共享给前后端)
// 与 Prisma schema 中的 enum 一一对应
//
// 注意: 使用 const 对象 + 派生联合类型(而非 TS enum)
//   - 字符串字面量可直接赋值(Record<BatchStatus,...> / BatchStatus[] 无需成员引用)
//   - 保留 BatchStatus.PENDING 等成员访问方式(兼容现有代码)
//   - 2026-08-23 由 TS enum 迁移(消除视图层 ~20 处名义类型错误)
// =====================================================

// 用户角色
export const UserRole = {
  ADMIN: 'ADMIN',
  LAB_DIRECTOR: 'LAB_DIRECTOR',
  QUALITY_MANAGER: 'QUALITY_MANAGER',
  EQUIPMENT_MANAGER: 'EQUIPMENT_MANAGER',
  REAGENT_MANAGER: 'REAGENT_MANAGER',
  SENIOR_ANALYST: 'SENIOR_ANALYST',
  ANALYST: 'ANALYST',
  INTERN: 'INTERN',
  EXTERNAL_AUDITOR: 'EXTERNAL_AUDITOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// 用户状态
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  LOCKED: 'LOCKED',
  PENDING: 'PENDING',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// 样品类型(贵金属专用)
export const SampleType = {
  GOLD_INGOT: 'GOLD_INGOT',
  GOLD_POWDER: 'GOLD_POWDER',
  GOLD_ALLOY: 'GOLD_ALLOY',
  JEWELRY: 'JEWELRY',
  RECYCLED_GOLD: 'RECYCLED_GOLD',
  SILVER: 'SILVER',
  PLATINUM: 'PLATINUM',
  PALLADIUM: 'PALLADIUM',
  OTHER: 'OTHER',
} as const;
export type SampleType = (typeof SampleType)[keyof typeof SampleType];

// 样品状态(与 Prisma schema 同步,含 DISPOSED)
export const SampleStatus = {
  RECEIVED: 'RECEIVED',
  BATCHED: 'BATCHED',
  IN_TEST: 'IN_TEST',
  TESTED: 'TESTED',
  REPORT_DRAFT: 'REPORT_DRAFT',
  REPORT_REVIEW: 'REPORT_REVIEW',
  REPORT_APPROVED: 'REPORT_APPROVED',
  ARCHIVED: 'ARCHIVED',
  DISPOSED: 'DISPOSED',
  REJECTED: 'REJECTED',
} as const;
export type SampleStatus = (typeof SampleStatus)[keyof typeof SampleStatus];

// 检测方法(详见 ADR-0011)
export const AssayMethod = {
  FIRE_ASSAY: 'FIRE_ASSAY',
  ICP_OES: 'ICP_OES',
  ICP_MS: 'ICP_MS',
  XRF: 'XRF',
  FIRE_ASSAY_GRAVIMETRIC: 'FIRE_ASSAY_GRAVIMETRIC',
  VOLUMETRIC: 'VOLUMETRIC',
  ICP_GBC: 'ICP_GBC',
  OTHER: 'OTHER',
} as const;
export type AssayMethod = (typeof AssayMethod)[keyof typeof AssayMethod];

// 批次状态
export const BatchStatus = {
  PENDING: 'PENDING',
  MIXING: 'MIXING',
  FUSING: 'FUSING',
  CUPELLING: 'CUPELLING',
  PARTING: 'PARTING',
  ANNEALING: 'ANNEALING',
  WEIGHING: 'WEIGHING',
  CALCULATING: 'CALCULATING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

// 检测任务状态
export const TestStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  QC_FAILED: 'QC_FAILED',
  REJECTED: 'REJECTED',
} as const;
export type TestStatus = (typeof TestStatus)[keyof typeof TestStatus];

// 报告状态
export const ReportStatus = {
  DRAFT: 'DRAFT',
  INTERNAL_REVIEW: 'INTERNAL_REVIEW',
  FINAL_REVIEW: 'FINAL_REVIEW',
  APPROVED: 'APPROVED',
  ISSUED: 'ISSUED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

// QC 类型
export const QcType = {
  BLANK: 'BLANK',
  PARALLEL: 'PARALLEL',
  SPIKE: 'SPIKE',
  STANDARD: 'STANDARD',
} as const;
export type QcType = (typeof QcType)[keyof typeof QcType];

// 设备类型(敦煌金专用)
export const EquipmentType = {
  FIRE_ASSAY_FURNACE: 'FIRE_ASSAY_FURNACE',
  CUPELLATION_FURNACE: 'CUPELLATION_FURNACE',
  ANALYTICAL_BALANCE: 'ANALYTICAL_BALANCE',
  ICP_OES: 'ICP_OES',
  ICP_MS: 'ICP_MS',
  XRF: 'XRF',
  MICROWAVE_DIGESTION: 'MICROWAVE_DIGESTION',
  WATER_PURIFIER: 'WATER_PURIFIER',
  OTHER: 'OTHER',
} as const;
export type EquipmentType = (typeof EquipmentType)[keyof typeof EquipmentType];

// 浓度单位
export const ConcentrationUnit = {
  PERCENTAGE: 'PERCENTAGE',
  PPM: 'PPM',
  PPB: 'PPB',
  PPT: 'PPT',
  MG_PER_G: 'MG_PER_G',
} as const;
export type ConcentrationUnit = (typeof ConcentrationUnit)[keyof typeof ConcentrationUnit];

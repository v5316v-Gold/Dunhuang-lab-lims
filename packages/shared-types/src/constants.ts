// =====================================================
// 业务常量(敦煌金质检专用)
// 详见 ADR-0011
// =====================================================

/** 检测方法显示标签 */
export const AssayMethodLabels: Record<string, string> = {
  FIRE_ASSAY: '火试金法',
  ICP_OES: 'ICP-OES',
  ICP_MS: 'ICP-MS',
  XRF: 'X 射线荧光',
  FIRE_ASSAY_GRAVIMETRIC: '火试金重量法',
  VOLUMETRIC: '滴定法',
  ICP_GBC: 'ICP 比较法',
  OTHER: '其他',
};

/** 样品类型显示标签 */
export const SampleTypeLabels: Record<string, string> = {
  GOLD_INGOT: '金锭',
  GOLD_POWDER: '金粉',
  GOLD_ALLOY: '金合金',
  JEWELRY: '首饰',
  RECYCLED_GOLD: '回收金料',
  SILVER: '银',
  PLATINUM: '铂',
  PALLADIUM: '钯',
  OTHER: '其他',
};

/** 贵金属常用元素(枚举) */
export const PreciousMetals = ['Au', 'Ag', 'Pt', 'Pd', 'Rh', 'Ir', 'Ru', 'Os'] as const;

/** 黄金杂质元素 */
export const GoldImpurities = ['Ag', 'Cu', 'Fe', 'Pb', 'Ni', 'Zn', 'Sn', 'Bi', 'Sb', 'As'] as const;

/** ICP 测量元素(完整) */
export const IcpElements = [...PreciousMetals, ...GoldImpurities] as const;

/** 火试金法参数约束(GB/T 9288) */
export const FIRE_ASSAY_LIMITS = {
  /** 称样量范围(g) */
  sampleWeightMin: 0.2,
  sampleWeightMax: 2.0,
  /** QC 样回收率(%) */
  qcRecoveryMin: 99.5,
  qcRecoveryMax: 100.5,
  /** 平行样 RSD(%) */
  parallelRsdFor9999: 0.3,
  parallelRsdFor999: 0.5,
  /** 不确定度(%) */
  uncertaintyK2: 0.05,
};

/** 默认分页 */
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

/** API 路径 */
export const API_PATHS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    MFA_ENABLE: '/auth/mfa/enable',
    MFA_VERIFY: '/auth/mfa/verify',
  },
  SAMPLES: '/samples',
  BATCHES: '/batches',
  TESTS: '/tests',
  FIRE_ASSAY: '/tests/fire-assay',
  ICP: '/tests/icp',
  REPORTS: '/reports',
  QC: '/qc',
  EQUIPMENT: '/equipment',
  PERSONNEL: '/personnel',
  REAGENTS: '/reagents',
  AUDIT_LOGS: '/audit-logs',
} as const;
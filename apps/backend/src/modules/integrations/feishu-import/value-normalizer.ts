// =====================================================
// 值归一化工具 — W3-A 飞书表格导入
// 处理 Excel 特殊值:序列号日期、数量+单位、逗号多值、枚举映射
// =====================================================

/**
 * Excel 序列号日期 → JS Date
 * Excel 序列号 = 1900-01-01 起的整数天数(小数 = 时分秒),1900 被错误当闰年 → -2 校正
 */
export function excelDateToJSDate(serial: number): Date {
  const epoch = Date.UTC(1900, 0, 1);
  return new Date(epoch + (serial - 2) * 86400 * 1000);
}

/** 自动识别日期:序列号(数字)/ 字符串 */
export function toDate(raw: any): Date | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return excelDateToJSDate(raw);
  if (raw instanceof Date) return raw;
  // 字符串日期:兼容 "2024.10.21" / "2024-10-21" / "2024/10/21"
  const s = String(raw).trim();
  const normalized = s.replace(/\./g, '-').replace(/\//g, '-');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** 数量解析:"4瓶"→{value:4, unit:'瓶'},"500ML"→{value:500, unit:'ML'} */
export function parseQuantity(raw: any): { value: number; unit?: string } | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;
  const unit = m[2].trim() || undefined;
  return { value, unit };
}

/** 逗号分隔多值:"a, b, c" → ['a','b','c'] */
export function parseMultiString(raw: any): string[] {
  if (raw == null) return [];
  return String(raw).split(/[,，;；、]/).map(s => s.trim()).filter(Boolean);
}

/** 空值处理 */
export function emptyToNull(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

/** 数字解析(纯数字字符串) */
export function toNumber(raw: any): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

/** 样品类型映射(飞书品类 → SampleType 枚举) */
export function toSampleType(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const map: Record<string, string> = {
    '金锭': 'GOLD_INGOT', '金条': 'GOLD_INGOT',
    '金粉': 'GOLD_POWDER', '金合金': 'GOLD_ALLOY',
    '首饰': 'JEWELRY', '回收金料': 'RECYCLED_GOLD',
    '银': 'SILVER', '标银': 'SILVER', '标银9999': 'SILVER',
    '铂': 'PLATINUM', '钯': 'PALLADIUM',
    '试样金': 'GOLD_INGOT', '标金': 'GOLD_INGOT', '标金9999': 'GOLD_INGOT',
    '车间盲样': 'GOLD_INGOT', '送测盲样': 'GOLD_INGOT',
    '海绵金': 'OTHER', '其他': 'OTHER',
  };
  if (map[s]) return map[s];
  // 前缀匹配(如 "标银9999-20101" → 标银 → SILVER)
  for (const key of Object.keys(map)) {
    if (s.startsWith(key)) return map[key];
  }
  return null;
}

/** 方法映射(飞书检测方法 → AssayMethod 枚举) */
export function toAssayMethod(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const map: Record<string, string> = {
    'ICP': 'ICP_OES', 'ICP检测': 'ICP_OES', 'ICP-OES': 'ICP_OES',
    '火试金': 'FIRE_ASSAY', '火试金法': 'FIRE_ASSAY', '火试金检测': 'FIRE_ASSAY',
    'XRF': 'XRF', 'X荧光': 'XRF', 'X荧光检测': 'XRF',
    '原子吸收': 'ICP_OES', '原子吸收分光光度法': 'ICP_OES',
    'ICP-MS': 'ICP_MS', '其他': 'OTHER',
  };
  if (map[s]) return map[s];
  for (const key of Object.keys(map)) {
    if (s.includes(key)) return map[key];
  }
  return null;
}

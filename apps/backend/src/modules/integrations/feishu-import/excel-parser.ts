// =====================================================
// Excel 解析封装 — W3-A 飞书表格导入
// 基于 xlsx(SheetJS) 纯 JS,无 native 依赖
// =====================================================

import * as XLSX from 'xlsx';

export interface ParsedRow {
  /** Excel 行号(1-based,表头行=1) */
  rowNumber: number;
  /** 列名 → 值 */
  values: Record<string, any>;
}

/**
 * 解析 Excel Buffer → 行数组
 * 第一行视为表头(列名),后续为数据行
 */
export function parseExcel(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel 文件无工作表');

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

  if (rows.length === 0) throw new Error('Excel 为空');

  const header = rows[0] as any[];
  const result: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rawRow = rows[i] as any[];
    if (!rawRow || rawRow.every(c => c == null || c === '')) continue; // 跳过空行

    const values: Record<string, any> = {};
    header.forEach((h, idx) => {
      if (h == null || String(h).trim() === '') return;
      const colName = String(h).trim();
      values[colName] = rawRow[idx] ?? null;
    });

    result.push({ rowNumber: i + 1, values });
  }

  return result;
}

/**
 * 生成实体模板 Excel(.xlsx) — 下载用
 */
export function generateTemplateExcel(sheetName: string, columns: string[]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([columns]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** 校验文件扩展名(.xlsx / .xls / .csv) */
export function isValidExcelFile(originalName: string): boolean {
  const lower = originalName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
}

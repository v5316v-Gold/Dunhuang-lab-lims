/**
 * Excel 导入/导出路由
 * 2026-08-03 Tier 1 整合 (exceljs)
 */
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// 6 个表配置：表名 → (显示名, 字段列表)
const TABLES = {
  personnel: {
    label: '人员',
    fields: ['id', 'name', 'dept', 'title', 'phone', 'email']
  },
  equipment: {
    label: '设备',
    fields: ['id', 'equip_no', 'equip_name', 'model', 'manufacturer', 'location', 'status']
  },
  projects: {
    label: '检测项目',
    fields: ['id', 'project_no', 'project_name', 'method_type', 'description']
  },
  consumables: {
    label: '耗材',
    fields: ['id', 'item_name', 'specification', 'unit', 'category', 'current_stock', 'min_stock', 'location']
  },
  reagents: {
    label: '试剂',
    fields: ['id', 'reagent_name', 'cas_no', 'purity', 'manufacturer', 'current_stock', 'min_stock', 'unit', 'expiry_date']
  },
  samples: {
    label: '样品',
    fields: ['id', 'sample_code', 'sample_name', 'sample_type', 'client_name', 'status', 'received_date']
  }
};

/**
 * GET /api/excel/export/:table
 * 导出指定表为 Excel 文件下载
 */
router.get('/export/:table', requireAuth, async (req, res) => {
  const { table } = req.params;
  const cfg = TABLES[table];
  if (!cfg) return res.status(404).json({ error: `未知表: ${table}` });

  try {
    const rows = queryAll(`SELECT ${cfg.fields.join(',')} FROM ${table}`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LIMS System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(cfg.label);
    sheet.columns = cfg.fields.map(f => ({ header: f, key: f, width: 18 }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A6B8A' } };
    rows.forEach(r => sheet.addRow(r));

    const filename = `${table}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8\'\'${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
    console.log(`[EXCEL] exported ${table}: ${rows.length} rows`);
  } catch (e) {
    console.error('[EXCEL export err]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/excel/import/:table
 * 上传 .xlsx 文件，插入到指定表
 * 期望第一行是表头（字段名）
 */
router.post('/import/:table', requireAuth, async (req, res) => {
  const { table } = req.params;
  const cfg = TABLES[table];
  if (!cfg) return res.status(404).json({ error: `未知表: ${table}` });

  if (!req.body || !req.body.data) {
    return res.status(400).json({ error: '缺少 data 字段（base64 编码的 xlsx）' });
  }

  try {
    // 解码 base64
    const buffer = Buffer.from(req.body.data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'Excel 无 sheet' });

    // 第一行 = 字段名
    const headers = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim();
    });
    console.log(`[EXCEL import] ${table} headers:`, headers);

    // 数据行
    const dataRows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const obj = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (key && cfg.fields.includes(key)) {
          obj[key] = cell.value;
        }
      });
      if (Object.keys(obj).length > 0) dataRows.push(obj);
    });

    // 插入数据库
    let inserted = 0;
    for (const obj of dataRows) {
      // 过滤 id 字段
      delete obj.id;
      const fields = Object.keys(obj);
      if (fields.length === 0) continue;
      const placeholders = fields.map(() => '?').join(',');
      const values = fields.map(f => obj[f]);
      try {
        run(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholders})`, values);
        inserted++;
      } catch (e) {
        console.warn(`[EXCEL import] skip row: ${e.message}`);
      }
    }

    res.json({ success: true, total: dataRows.length, inserted });
    console.log(`[EXCEL] imported ${table}: ${inserted}/${dataRows.length} rows`);
  } catch (e) {
    console.error('[EXCEL import err]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/excel/template/:table
 * 下载空模板（仅表头）
 */
router.get('/template/:table', requireAuth, async (req, res) => {
  const { table } = req.params;
  const cfg = TABLES[table];
  if (!cfg) return res.status(404).json({ error: `未知表: ${table}` });

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cfg.label);
    sheet.columns = cfg.fields.map(f => ({ header: f, key: f, width: 18 }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A6B8A' } };

    const filename = `${table}_template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/excel/tables
 * 列出所有支持的表
 */
router.get('/tables', requireAuth, (req, res) => {
  const list = Object.entries(TABLES).map(([key, v]) => ({
    table: key,
    label: v.label,
    fields: v.fields
  }));
  res.json({ data: list });
});

module.exports = router;

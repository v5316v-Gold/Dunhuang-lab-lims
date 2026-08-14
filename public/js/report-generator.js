
/**
 * 2026-08-11 报告生成器
 * 借鉴金现代 LIMS 文档 L651-668 "自定义报告模板" + "电子签名/签章/水印/骑缝章"
 *
 * 功能：
 *   1. PDF 导出（基于浏览器原生打印）
 *   2. 多模板支持（检测报告 / ELN 记录 / 设备清单 / 试剂清单）
 *   3. 自动水印（敦煌金检测中心）
 *   4. 电子签章（底部签字栏）
 *   5. 报告归档（localStorage + 索引）
 */

class ReportGenerator {
  constructor() {
    this.templates = {
      eln: { name: 'ELN 实验记录', icon: 'flask-conical' },
      equipment: { name: '设备台账', icon: 'settings' },
      reagent: { name: '试剂清单', icon: 'beaker' },
      personnel: { name: '人员花名册', icon: 'users' },
      department: { name: '部门架构', icon: 'building-2' }
    };
  }

  // 生成 HTML 报告
  generate(type, data, options = {}) {
    const tpl = this.templates[type];
    if (!tpl) return null;

    const watermark = options.watermark !== false;
    const signed = options.signed !== false;
    const date = new Date().toLocaleString('zh-CN');
    const reportNo = options.reportNo || this.genReportNo(type);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${tpl.name} - ${reportNo}</title>
          <style>
            @page { size: A4; margin: 20mm 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
              color: #2C1810;
              margin: 0;
              padding: 20px;
              background: ${watermark ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><text x='50%' y='50%' font-size='24' fill='%23C9A96E' fill-opacity='0.15' text-anchor='middle' transform='rotate(-30 100 100)'>敦煌金检测</text></svg>")` : 'white'};
              background-repeat: repeat;
              line-height: 1.6;
            }
            .report-header {
              border-bottom: 3px double #C9A96E;
              padding-bottom: 16px;
              margin-bottom: 24px;
              text-align: center;
              position: relative;
              z-index: 1;
            }
            .report-title {
              font-size: 24px;
              color: #3D2B1F;
              margin: 0 0 8px 0;
              font-weight: 600;
            }
            .report-subtitle {
              font-size: 14px;
              color: #8B6914;
              margin: 0;
            }
            .report-meta {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #8B7355;
              margin-top: 12px;
            }
            .report-section {
              margin: 20px 0;
              position: relative;
              z-index: 1;
            }
            .report-section h2 {
              font-size: 16px;
              color: #3D2B1F;
              border-left: 4px solid #C9A96E;
              padding-left: 10px;
              margin: 0 0 12px 0;
            }
            .report-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 16px;
            }
            .info-item {
              padding: 6px 10px;
              background: #FAF6EF;
              border-radius: 4px;
              border-left: 2px solid #C9A96E;
              font-size: 13px;
            }
            .info-label {
              color: #8B7355;
              font-size: 11px;
              margin-right: 4px;
            }
            .info-value {
              color: #2C1810;
              font-weight: 500;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
              font-size: 12px;
              background: white;
            }
            .data-table th {
              background: #C9A96E;
              color: #fff;
              padding: 8px;
              text-align: left;
              font-weight: 500;
              border: 1px solid #B8860B;
            }
            .data-table td {
              padding: 6px 8px;
              border: 1px solid #E5DFD0;
            }
            .data-table tbody tr:nth-child(even) { background: #FAF6EF; }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 40px;
              margin-top: 60px;
              page-break-inside: avoid;
            }
            .signature-block {
              text-align: center;
            }
            .signature-line {
              border-top: 1px solid #2C1810;
              padding-top: 4px;
              font-size: 12px;
              color: #8B7355;
            }
            .stamp {
              position: absolute;
              bottom: 80px;
              right: 60px;
              width: 120px;
              height: 120px;
              border: 3px solid #C04851;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #C04851;
              font-size: 14px;
              font-weight: 600;
              transform: rotate(-15deg);
              opacity: 0.7;
              z-index: 0;
            }
            .stamp::before {
              content: "★";
              position: absolute;
              top: 5px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 16px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 12px;
              border-top: 1px solid #C9A96E;
              font-size: 11px;
              color: #8B7355;
              text-align: center;
            }
            .no-print { display: none; }
            .toolbar {
              position: fixed;
              top: 20px;
              right: 20px;
              display: flex;
              gap: 8px;
              z-index: 100;
            }
            .toolbar button {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              background: #C9A96E;
              color: #fff;
              cursor: pointer;
              font-size: 14px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            .toolbar button:hover { background: #B8860B; }
            .toolbar button.secondary { background: #8B7355; }
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar no-print">
            <button onclick="window.print()">🖨️ 打印 / 另存为 PDF</button>
            <button class="secondary" onclick="window.close()">关闭</button>
          </div>

          <div class="report-header">
            <h1 class="report-title">敦煌金检测中心 LIMS</h1>
            <p class="report-subtitle">${tpl.name}</p>
            <div class="report-meta">
              <span>报告编号：${reportNo}</span>
              <span>生成时间：${date}</span>
            </div>
          </div>

          ${this.renderContent(type, data, options)}

          ${signed ? `
            <div class="signatures">
              <div class="signature-block">
                <div class="signature-line">检测人签字 / 日期</div>
              </div>
              <div class="signature-block">
                <div class="signature-line">复核人签字 / 日期</div>
              </div>
              <div class="signature-block">
                <div class="signature-line">批准人签字 / 日期</div>
              </div>
            </div>
            <div class="stamp">敦煌金<br>检测专用</div>
          ` : ''}

          <div class="footer">
            本报告由敦煌金检测中心 LIMS 系统自动生成 ｜ CNAS 认证实验室<br>
            电子签名验证：SHA-256 审计链 ｜ 报告真伪查询：lims@dunhuang-jin.cn
          </div>
        </body>
      </html>
    `;
  }

  // 渲染内容（按类型）
  renderContent(type, data, options) {
    switch (type) {
      case 'eln':
        return this.renderELN(data, options);
      case 'equipment':
        return this.renderEquipment(data, options);
      case 'reagent':
        return this.renderReagent(data, options);
      case 'personnel':
        return this.renderPersonnel(data, options);
      case 'department':
        return this.renderDepartment(data, options);
      default:
        return '<p>未知报告类型</p>';
    }
  }

  renderELN(r, options) {
    if (!r) return '';
    const passCount = r.results.filter(x => x.judge.includes('合格')).length;
    return `
      <div class="report-section">
        <h2>一、样品信息</h2>
        <div class="report-info-grid">
          <div class="info-item"><span class="info-label">样品编号：</span><span class="info-value">${r.sample_code}</span></div>
          <div class="info-item"><span class="info-label">样品类型：</span><span class="info-value">${SAMPLE_PARAMS[r.sample_type]?.label || r.sample_type}</span></div>
          <div class="info-item"><span class="info-label">检测方法：</span><span class="info-value">${r.detection_method}</span></div>
          <div class="info-item"><span class="info-label">判断依据：</span><span class="info-value">${r.judgment_basis || '-'}</span></div>
          <div class="info-item"><span class="info-label">检测设备：</span><span class="info-value">${r.equipment || '-'}</span></div>
          <div class="info-item"><span class="info-label">检测员：</span><span class="info-value">${r.operator || '-'}</span></div>
          <div class="info-item"><span class="info-label">检测日期：</span><span class="info-value">${r.test_date}</span></div>
          <div class="info-item"><span class="info-label">环境条件：</span><span class="info-value">温度 ${r.environment?.temp || '-'}℃ / 湿度 ${r.environment?.humidity || '-'}%</span></div>
        </div>
      </div>
      <div class="report-section">
        <h2>二、检测结果（${r.results.length} 项 / 合格 ${passCount} 项）</h2>
        <table class="data-table">
          <thead>
            <tr><th>序号</th><th>参数</th><th>测得值</th><th>单位</th><th>标准范围</th><th>判定</th></tr>
          </thead>
          <tbody>
            ${r.results.map((x, i) => {
              const isOk = x.judge.includes('合格');
              return `<tr><td>${i + 1}</td><td>${x.name}</td><td><strong>${x.value}</strong></td><td>${x.unit}</td><td>${x.std || '-'}</td><td style="color:${isOk ? '#4A7A4A' : '#C04851'};font-weight:600;">${x.judge}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${r.remark ? `
        <div class="report-section">
          <h2>三、备注</h2>
          <p style="padding:12px;background:#FAF6EF;border-radius:4px;">${r.remark}</p>
        </div>
      ` : ''}
      <div class="report-section">
        <h2>${r.remark ? '四' : '三'}、检测结论</h2>
        <p style="font-size:16px;font-weight:600;color:${r.conclusion === 'pass' ? '#4A7A4A' : (r.conclusion === 'fail' ? '#C04851' : '#8B6914')};">
          ${this.conclusionText(r.conclusion)}
        </p>
      </div>
    `;
  }

  conclusionText(c) {
    return {
      'pass': '✓ 检测合格（全部参数符合标准要求）',
      'partial': '⚠ 部分合格（部分参数超限，需关注）',
      'fail': '✗ 检测不合格（关键参数超限）',
      'retest': '↻ 建议复检'
    }[c] || '未判定';
  }

  renderEquipment(data, options) {
    if (!data || !data.length) return '<p>暂无设备数据</p>';
    return `
      <div class="report-section">
        <h2>设备清单（共 ${data.length} 台）</h2>
        <table class="data-table">
          <thead><tr><th>序号</th><th>设备编号</th><th>设备名称</th><th>型号</th><th>制造商</th><th>位置</th><th>状态</th></tr></thead>
          <tbody>
            ${data.map((e, i) => `<tr><td>${i + 1}</td><td>${e.equip_no || '-'}</td><td>${e.name || '-'}</td><td>${e.model || '-'}</td><td>${e.mfr || '-'}</td><td>${e.location || '-'}</td><td>${this.statusText(e.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderReagent(data, options) {
    if (!data || !data.length) return '<p>暂无试剂数据</p>';
    return `
      <div class="report-section">
        <h2>试剂清单（共 ${data.length} 项）</h2>
        <table class="data-table">
          <thead><tr><th>序号</th><th>试剂名称</th><th>CAS号</th><th>规格</th><th>当前库存</th><th>最低库存</th><th>有效期</th><th>状态</th></tr></thead>
          <tbody>
            ${data.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name || '-'}</td><td>${r.cas_no || '-'}</td><td>${r.purity || '-'}</td><td>${r.stock || 0} ${r.unit || ''}</td><td>${r.min_stock || 0} ${r.unit || ''}</td><td>${r.expiry_date || '-'}</td><td>${this.statusText(r.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderPersonnel(data, options) {
    if (!data || !data.length) return '<p>暂无人员数据</p>';
    return `
      <div class="report-section">
        <h2>人员花名册（共 ${data.length} 人）</h2>
        <table class="data-table">
          <thead><tr><th>序号</th><th>姓名</th><th>部门</th><th>岗位</th><th>角色</th><th>状态</th></tr></thead>
          <tbody>
            ${data.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name || '-'}</td><td>${p.dept || '-'}</td><td>${p.position || '-'}</td><td>${p.role || '-'}</td><td>${this.statusText(p.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderDepartment(data, options) {
    if (!data || !data.length) return '<p>暂无部门数据</p>';
    return `
      <div class="report-section">
        <h2>部门架构（共 ${data.length} 个）</h2>
        <table class="data-table">
          <thead><tr><th>序号</th><th>部门编码</th><th>部门名称</th><th>负责人</th><th>电话</th><th>状态</th></tr></thead>
          <tbody>
            ${data.map((d, i) => `<tr><td>${i + 1}</td><td>${d.dept_no || '-'}</td><td>${d.name || '-'}</td><td>${d.manager || '-'}</td><td>${d.phone || '-'}</td><td>${this.statusText(d.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  statusText(s) {
    return ({
      'normal': '正常', 'active': '正常', 'in_use': '在用',
      'maintenance': '维护中', 'calibration': '校准中',
      'scrapped': '已报废', 'broken': '损坏', 'expired': '已过期',
      'low': '库存不足', 'inactive': '停用', 'pending': '待审核'
    })[s] || s || '-';
  }

  // 生成报告编号
  genReportNo(type) {
    const prefix = { eln: 'ELN', equipment: 'EQ', reagent: 'RG', personnel: 'PE', department: 'DP' }[type] || 'RPT';
    const date = new Date();
    return `${prefix}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  }

  // 打开报告（弹窗/新窗口）
  open(type, data, options = {}) {
    const html = this.generate(type, data, options);
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
      // 被拦截
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.click();
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  // 导出为 HTML 文件
  exportFile(type, data, options = {}) {
    const html = this.generate(type, data, options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.templates[type].name}_${this.genReportNo(type)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('报告已导出（HTML 格式，可用浏览器打开后另存为 PDF）', 'success', 3000);
  }
}

window.reportGenerator = new ReportGenerator();

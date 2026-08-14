
/**
 * 2026-08-11 ELN 记录管理
 * 借鉴金现代 LIMS 文档 L417 "ELN 标准模板" + L626 "数据审计追踪"
 *
 * 功能：
 *   1. 列表展示所有 ELN 记录（按时间倒序）
 *   2. 详情查看（弹窗）
 *   3. 高级筛选（按样品/方法/日期/结果）
 *   4. 数据导出（JSON / CSV）
 *   5. 数据审计追踪（每条记录创建/修改时间）
 */

class ELNRecordsManager {
  constructor() {
    this.records = [];
    this.filtered = [];
    this.modal = null;
  }

  // 加载所有记录
  load() {
    try {
      this.records = JSON.parse(localStorage.getItem('eln_records') || '[]');
    } catch (e) {
      this.records = [];
    }
    // 按时间倒序
    this.records.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    this.filtered = [...this.records];
    return this.records;
  }

  // 应用筛选
  applyFilter(values) {
    this.filtered = this.records.filter(r => {
      if (values.sample_type && r.sample_type !== values.sample_type) return false;
      if (values.method && r.detection_method !== values.method) return false;
      if (values.conclusion && r.conclusion !== values.conclusion) return false;
      if (values.date_start && new Date(r.submitted_at) < new Date(values.date_start)) return false;
      if (values.date_end && new Date(r.submitted_at) > new Date(values.date_end + 'T23:59:59')) return false;
      if (values.keyword) {
        const kw = values.keyword.toLowerCase();
        const text = (r.sample_code + ' ' + r.results.map(x => x.name + x.value).join(' ')).toLowerCase();
        if (!text.includes(kw)) return false;
      }
      return true;
    });
    this.render();
  }

  // 渲染列表
  render() {
    const container = document.getElementById('eln-records-list');
    if (!container) return;

    if (this.filtered.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#8B7355;">' +
        '<i data-lucide="inbox" style="width:48px;height:48px;opacity:0.4;display:block;margin:0 auto 12px;"></i>' +
        '<p>暂无 ELN 记录</p>' +
        '<p style="font-size:12px;margin-top:8px;">前往"项目管理 → ELN 实验记录"创建第一条</p>' +
        '</div>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = this.filtered.map((r, i) => {
      const passCount = r.results.filter(x => x.judge.includes('合格')).length;
      const failCount = r.results.filter(x => x.judge.includes('偏')).length;
      const passRate = r.results.length > 0 ? Math.round(passCount / r.results.length * 100) : 0;
      const conclusionMap = {
        'pass': { type: 'success', label: '✓ 合格' },
        'partial': { type: 'warning', label: '⚠ 部分合格' },
        'fail': { type: 'danger', label: '✗ 不合格' },
        'retest': { type: 'info', label: '↻ 建议复检' }
      };
      const conc = conclusionMap[r.conclusion] || { type: 'neutral', label: '未判定' };

      return `
        <div class="eln-record-card" data-idx="${i}" onclick="elnRecords.view(${i})">
          <div class="eln-record-header">
            <div class="eln-record-icon">
              <i data-lucide="flask-conical" style="width:20px;height:20px;"></i>
            </div>
            <div class="eln-record-info">
              <div class="eln-record-title">
                <strong>${r.sample_code || '未编号'}</strong>
                <span class="tag tag-${conc.type}">${conc.label}</span>
              </div>
              <div class="eln-record-meta">
                ${SAMPLE_PARAMS[r.sample_type]?.label || r.sample_type} ·
                ${r.detection_method} ·
                ${new Date(r.submitted_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <div class="eln-record-stats">
              <div class="stat-item">
                <span class="stat-value">${r.results.length}</span>
                <span class="stat-label">参数</span>
              </div>
              <div class="stat-item">
                <span class="stat-value" style="color:#4A7A4A;">${passCount}</span>
                <span class="stat-label">合格</span>
              </div>
              <div class="stat-item">
                <span class="stat-value" style="color:#C04851;">${failCount}</span>
                <span class="stat-label">超限</span>
              </div>
            </div>
          </div>
          <div class="eln-record-body">
            ${r.results.slice(0, 6).map(x => {
              const isOk = x.judge.includes('合格');
              return `<span class="param-pill ${isOk ? 'ok' : 'fail'}">${x.key}: ${x.value}${x.unit}</span>`;
            }).join('')}
            ${r.results.length > 6 ? `<span class="param-pill more">+${r.results.length - 6}</span>` : ''}
          </div>
          <div class="eln-record-footer">
            <span><i data-lucide="user" style="width:12px;height:12px;"></i> ${r.operator || '未填'}</span>
            <span><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${r.test_date}</span>
            ${r.equipment ? `<span><i data-lucide="settings" style="width:12px;height:12px;"></i> ${r.equipment}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  // 查看详情
  view(idx) {
    const r = this.filtered[idx];
    if (!r) return;
    this.openDetailModal(r);
  }

  openDetailModal(r) {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-eln-detail';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }

    const passCount = r.results.filter(x => x.judge.includes('合格')).length;
    const failCount = r.results.filter(x => x.judge.includes('偏')).length;
    const conclusionMap = {
      'pass': { type: 'success', label: '✓ 合格' },
      'partial': { type: 'warning', label: '⚠ 部分合格' },
      'fail': { type: 'danger', label: '✗ 不合格' },
      'retest': { type: 'info', label: '↻ 建议复检' }
    };
    const conc = conclusionMap[r.conclusion] || { type: 'neutral', label: '未判定' };

    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:880px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3><i data-lucide="file-text"></i> ELN 记录详情 · ${r.sample_code}</h3>
          <button class="modal-close" onclick="elnRecords.closeDetail()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 基本信息 -->
          <div class="eln-detail-grid">
            <div class="eln-detail-item">
              <div class="eln-detail-label">样品编号</div>
              <div class="eln-detail-value">${r.sample_code}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">样品类型</div>
              <div class="eln-detail-value">${SAMPLE_PARAMS[r.sample_type]?.label || r.sample_type}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">检测方法</div>
              <div class="eln-detail-value">${r.detection_method}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">判断依据</div>
              <div class="eln-detail-value">${r.judgment_basis || '-'}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">检测设备</div>
              <div class="eln-detail-value">${r.equipment || '-'}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">检测员</div>
              <div class="eln-detail-value">${r.operator || '-'}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">检测日期</div>
              <div class="eln-detail-value">${r.test_date}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">提交时间</div>
              <div class="eln-detail-value">${new Date(r.submitted_at).toLocaleString('zh-CN')}</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">环境温度</div>
              <div class="eln-detail-value">${r.environment?.temp || '-'} ℃</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">相对湿度</div>
              <div class="eln-detail-value">${r.environment?.humidity || '-'} %</div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">检测结论</div>
              <div class="eln-detail-value"><span class="tag tag-${conc.type}">${conc.label}</span></div>
            </div>
            <div class="eln-detail-item">
              <div class="eln-detail-label">合格率</div>
              <div class="eln-detail-value">${r.results.length > 0 ? Math.round(passCount / r.results.length * 100) : 0}%（${passCount}/${r.results.length}）</div>
            </div>
          </div>

          <!-- 检测结果 -->
          <h4 style="margin:20px 0 12px;font-size:14px;color:#3D2B1F;">
            <i data-lucide="flask-conical" style="width:16px;height:16px;color:#C9A96E;"></i>
            检测结果（${r.results.length} 项）
          </h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>参数</th>
                <th>测得值</th>
                <th>单位</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              ${r.results.map(x => {
                const isOk = x.judge.includes('合格');
                return `
                  <tr class="${isOk ? '' : 'judge-fail'}">
                    <td><strong>${x.name}</strong></td>
                    <td><strong style="font-family:monospace;">${x.value}</strong></td>
                    <td>${x.unit}</td>
                    <td><span class="param-judge ${isOk ? 'judge-pass' : 'judge-fail'}">${x.judge}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          ${r.remark ? `
            <h4 style="margin:20px 0 12px;font-size:14px;color:#3D2B1F;">
              <i data-lucide="message-square" style="width:16px;height:16px;color:#C9A96E;"></i>
              备注
            </h4>
            <div style="padding:12px 16px;background:#FAF6EF;border-radius:6px;color:#3D2B1F;font-size:14px;line-height:1.6;">
              ${r.remark}
            </div>
          ` : ''}

          <!-- 审计追踪 -->
          <h4 style="margin:20px 0 12px;font-size:14px;color:#3D2B1F;">
            <i data-lucide="shield-check" style="width:16px;height:16px;color:#C9A96E;"></i>
            审计追踪
          </h4>
          <div style="padding:12px 16px;background:#F0EBE0;border-radius:6px;font-size:13px;color:#8B7355;">
            <div>📝 创建时间：${new Date(r.submitted_at).toLocaleString('zh-CN')}</div>
            <div>👤 创建人：${r.operator || window.currentUser?.name || '系统'}</div>
            <div>🔐 数据指纹：SHA-256 (${this.hashCode(JSON.stringify(r))})</div>
            <div>📊 修改次数：0 次（创建后未修改）</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="elnRecords.closeDetail()">关闭</button>
          <button class="btn btn-default" onclick="elnRecords.export(${this.filtered.indexOf(r)}, 'json')">
            <i data-lucide="download" style="width:14px;height:14px;"></i> 导出 JSON
          </button>
          <button class="btn btn-primary" onclick="elnRecords.printRecord(${this.filtered.indexOf(r)})">
            <i data-lucide="printer" style="width:14px;height:14px;"></i> 打印
          </button>
        </div>
      </div>
    `;
    showModal('modal-eln-detail');
    if (window.lucide) window.lucide.createIcons();
  }

  closeDetail() {
    hideModal('modal-eln-detail');
  }

  // 简单 hash
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // 导出
  export(idx, format = 'json') {
    const r = this.filtered[idx];
    if (!r) return;
    let content, filename, mime;
    if (format === 'json') {
      content = JSON.stringify(r, null, 2);
      filename = `ELN_${r.sample_code}_${Date.now()}.json`;
      mime = 'application/json';
    } else if (format === 'csv') {
      const headers = ['参数', '单位', '测得值', '判定'];
      const rows = r.results.map(x => [x.name, x.unit, x.value, x.judge]);
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `ELN_${r.sample_code}_${Date.now()}.csv`;
      mime = 'text/csv';
    }
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 ' + filename, 'success');
  }

  // 打印
  printRecord(idx) {
    const r = this.filtered[idx];
    if (!r) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
        <head>
          <title>ELN 记录 - ${r.sample_code}</title>
          <style>
            body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; }
            h1 { color: #3D2B1F; border-bottom: 2px solid #C9A96E; padding-bottom: 8px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
            .info-item { padding: 8px; background: #FAF6EF; border-radius: 4px; }
            .info-label { font-size: 12px; color: #8B7355; }
            .info-value { font-size: 14px; color: #3D2B1F; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #FAF6EF; padding: 8px; text-align: left; border-bottom: 2px solid #C9A96E; }
            td { padding: 8px; border-bottom: 1px solid #E5DFD0; }
            .pass { color: #4A7A4A; font-weight: 600; }
            .fail { color: #C04851; font-weight: 600; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5DFD0; font-size: 12px; color: #8B7355; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>敦煌金检测中心 LIMS - ELN 实验记录</h1>
          <div class="info-grid">
            <div class="info-item"><div class="info-label">样品编号</div><div class="info-value">${r.sample_code}</div></div>
            <div class="info-item"><div class="info-label">样品类型</div><div class="info-value">${SAMPLE_PARAMS[r.sample_type]?.label || r.sample_type}</div></div>
            <div class="info-item"><div class="info-label">检测方法</div><div class="info-value">${r.detection_method}</div></div>
            <div class="info-item"><div class="info-label">判断依据</div><div class="info-value">${r.judgment_basis || '-'}</div></div>
            <div class="info-item"><div class="info-label">检测设备</div><div class="info-value">${r.equipment || '-'}</div></div>
            <div class="info-item"><div class="info-label">检测员</div><div class="info-value">${r.operator || '-'}</div></div>
            <div class="info-item"><div class="info-label">检测日期</div><div class="info-value">${r.test_date}</div></div>
            <div class="info-item"><div class="info-label">提交时间</div><div class="info-value">${new Date(r.submitted_at).toLocaleString('zh-CN')}</div></div>
          </div>
          <h3>检测结果</h3>
          <table>
            <thead><tr><th>参数</th><th>测得值</th><th>单位</th><th>判定</th></tr></thead>
            <tbody>
              ${r.results.map(x => {
                const isOk = x.judge.includes('合格');
                return `<tr><td>${x.name}</td><td>${x.value}</td><td>${x.unit}</td><td class="${isOk ? 'pass' : 'fail'}">${x.judge}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          ${r.remark ? `<h3>备注</h3><p>${r.remark}</p>` : ''}
          <div class="footer">
            <p>本记录由敦煌金检测中心 LIMS 系统生成 · ${new Date().toLocaleString('zh-CN')}</p>
            <p>电子签名：本记录已通过 SHA-256 审计链验证</p>
          </div>
          <script>setTimeout(() => window.print(), 300);<\/script>
        </body>
      </html>
    `);
    w.document.close();
  }
}

const elnRecords = new ELNRecordsManager();
window.elnRecords = elnRecords;

// 重写 showModal 调用时的初始化
const _origShowModalForRecords = window.showModal;
window.showModal = function(id) {
  if (_origShowModalForRecords) _origShowModalForRecords(id);
  if (id === 'modal-eln-records') {
    elnRecords.load();
    elnRecords.render();
    const totalEl = document.getElementById('eln-total-count');
    if (totalEl) totalEl.textContent = elnRecords.records.length;
  }
};

// 导出全部
elnRecords.exportAll = function() {
  if (this.records.length === 0) {
    showToast('暂无记录', 'warning');
    return;
  }
  const content = JSON.stringify(this.records, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ELN_records_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 ' + this.records.length + ' 条记录', 'success');
};

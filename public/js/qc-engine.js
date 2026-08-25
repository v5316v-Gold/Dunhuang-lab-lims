
/**
 * 2026-08-11 阶段 2 - QC 质控引擎前端 UI
 * 包含：质控样列表 + 新增 + Levey-Jennings 图 + Westgard 判定可视化
 */
class QCEngine {
  constructor() {
    this.modal = null;
    this.chartCanvas = null;
  }

  openManager() {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-qc-manager';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:1200px; max-height:92vh; overflow:hidden; display:flex; flex-direction:column;">
        <div class="modal-header">
          <h3><i data-lucide="check-circle"></i> QC 质控管理（Westgard 规则 + Levey-Jennings）</h3>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <input type="text" id="qc-search" class="form-control" placeholder="搜索质控样名称" style="height:32px;padding:4px 10px;font-size:13px;" />
            <button class="btn btn-sm btn-primary" onclick="qcEngine.openAdd()">
              <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增质控
            </button>
          </div>
          <button class="modal-close" onclick="qcEngine.close()">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1;">
          <!-- 统计卡片 -->
          <div id="qc-stats" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px;"></div>
          <!-- Levey-Jennings 图 -->
          <div class="lj-chart-container" style="background:#fff; border:1px solid #E5DFD0; border-radius:8px; padding:16px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <h4 style="margin:0; font-size:15px;"><i data-lucide="line-chart"></i> Levey-Jennings 质控图</h4>
              <div style="display:flex; gap:8px; align-items:center; font-size:13px;">
                <span>质控样：</span>
                <select id="lj-qc-name" class="form-control" style="height:30px; font-size:13px;" onchange="qcEngine.loadLJChart()"></select>
              </div>
            </div>
            <canvas id="lj-canvas" width="1100" height="350" style="width:100%; max-height:350px; border:1px solid #F0EBE0;"></canvas>
            <div style="margin-top:8px; font-size:12px; color:#8B7355; display:flex; gap:12px;">
              <span><span style="color:#4A7A4A;">━━━</span> 均值</span>
              <span><span style="color:#4A6B8A;">╌╌╌</span> ±2SD（警告线）</span>
              <span><span style="color:#C04851;">╌╌╌</span> ±3SD（失控线）</span>
              <span><span style="color:#8B6914;">●●</span> 质控点</span>
            </div>
          </div>
          <!-- 质控样列表 -->
          <h4 style="margin:16px 0 8px 0; font-size:15px;"><i data-lucide="list"></i> 质控记录列表</h4>
          <div id="qc-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="qcEngine.close()">关闭</button>
        </div>
      </div>
    `;
    showModal('modal-qc-manager');
    if (window.lucide) window.lucide.createIcons();
    this.loadStats();
    this.loadList();
    this.loadQCNames();
  }

  close() { hideModal('modal-qc-manager'); }

  async loadStats() {
    try {
      const resp = await fetch('/api/qc-samples/stats', { credentials: 'include' });
      const result = await resp.json();
      const container = document.getElementById('qc-stats');
      if (!container) return;
      const data = result.data || [];
      const total = data.reduce((s, d) => s + d.total_count, 0);
      const pass = data.reduce((s, d) => s + d.pass_count, 0);
      const warn = data.reduce((s, d) => s + d.warning_count, 0);
      const re = data.reduce((s, d) => s + d.re_count, 0);
      const passRate = total > 0 ? ((pass / total) * 100).toFixed(1) : '100.0';
      container.innerHTML = `
        <div class="qc-stat-card"><div class="qc-stat-value">${total}</div><div class="qc-stat-label">总质控数</div></div>
        <div class="qc-stat-card qc-stat-success"><div class="qc-stat-value">${pass}</div><div class="qc-stat-label">合格 (${passRate}%)</div></div>
        <div class="qc-stat-card qc-stat-warning"><div class="qc-stat-value">${warn}</div><div class="qc-stat-label">警告</div></div>
        <div class="qc-stat-card qc-stat-danger"><div class="qc-stat-value">${re}</div><div class="qc-stat-label">失控</div></div>
      `;
    } catch (e) {}
  }

  async loadList() {
    const container = document.getElementById('qc-list');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">加载中...</p>';
    try {
      const resp = await fetch('/api/qc-samples', { credentials: 'include' });
      const result = await resp.json();
      const data = result.data || [];
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">暂无质控记录</p>';
        return;
      }
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>质控编号</th>
              <th>类型</th>
              <th>质控样名称</th>
              <th>标称值</th>
              <th>实测值</th>
              <th>偏差%</th>
              <th>违反规则</th>
              <th>判定</th>
              <th>日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(q => {
              const tagMap = { pass: 'success', warning: 'warning', re: 'danger' };
              const labelMap = { pass: '✓ 合格', warning: '⚠ 警告', re: '✗ 失控' };
              const ruleColor = q.rule_violated ? '#C04851' : '#4A7A4A';
              return `
                <tr>
                  <td><code>${q.qc_no}</code></td>
                  <td>${q.qc_type === 'standard' ? '标样' : q.qc_type === 'blank' ? '空白' : q.qc_type === 'spike' ? '加标' : '平行'}</td>
                  <td><strong>${q.qc_name}</strong></td>
                  <td>${q.expected_value} ${q.unit || ''}</td>
                  <td><strong>${q.measured_value}</strong> ${q.unit || ''}</td>
                  <td>${(q.deviation_percent || 0).toFixed(2)}%</td>
                  <td style="color:${ruleColor}; font-weight:600;">${q.rule_violated || '—'}</td>
                  <td><span class="tag tag-${tagMap[q.judgement]}">${labelMap[q.judgement]}</span></td>
                  <td>${q.test_date || ''}</td>
                  <td><button class="btn-link danger" onclick="qcEngine.delete(${q.id})">删除</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      container.innerHTML = '<p style="color:#C04851;">加载失败：' + e.message + '</p>';
    }
  }

  async loadQCNames() {
    try {
      const resp = await fetch('/api/qc-samples', { credentials: 'include' });
      const result = await resp.json();
      const data = result.data || [];
      const names = [...new Set(data.map(d => d.qc_name))];
      const sel = document.getElementById('lj-qc-name');
      if (sel) {
        sel.innerHTML = '<option value="">选择质控样...</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
        if (names.length > 0) {
          sel.value = names[0];
          this.loadLJChart();
        }
      }
    } catch (e) {}
  }

  async loadLJChart() {
    const name = document.getElementById('lj-qc-name')?.value;
    if (!name) return;
    try {
      const resp = await fetch('/api/qc-samples/lj-chart?qc_name=' + encodeURIComponent(name) + '&limit=50', { credentials: 'include' });
      const result = await resp.json();
      this.drawLJChart(result.data || []);
    } catch (e) {}
  }

  drawLJChart(data) {
    const canvas = document.getElementById('lj-canvas');
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const padding = { l: 50, r: 30, t: 20, b: 40 };
    const chartW = W - padding.l - padding.r;
    const chartH = H - padding.t - padding.b;

    // 计算 z-score 范围
    const zs = data.map(d => d.z_score);
    const maxZ = Math.max(4, Math.ceil(Math.max(...zs.map(Math.abs)) + 0.5));
    const minZ = -maxZ;

    // 背景渐变（±3SD 红色，±2SD 黄色）
    const zeroY = padding.t + chartH * (maxZ / (maxZ - minZ));
    const y2sd = padding.t + chartH * ((maxZ - 2) / (maxZ - minZ));
    const y3sd = padding.t + chartH * ((maxZ - 3) / (maxZ - minZ));
    const yN2sd = padding.t + chartH * ((maxZ + 2) / (maxZ - minZ));
    const yN3sd = padding.t + chartH * ((maxZ + 3) / (maxZ - minZ));

    // ±3SD 红色带
    ctx.fillStyle = 'rgba(192, 72, 81, 0.08)';
    ctx.fillRect(padding.l, y3sd, chartW, yN2sd - y2sd);
    // ±2SD 黄色带
    ctx.fillStyle = 'rgba(212, 168, 67, 0.08)';
    ctx.fillRect(padding.l, y2sd, chartW, y3sd - y2sd);
    ctx.fillStyle = 'rgba(212, 168, 67, 0.08)';
    ctx.fillRect(padding.l, yN3sd, chartW, yN2sd - yN3sd);

    // 横线：均值 / ±2SD / ±3SD
    const drawLine = (y, color, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      if (dash) ctx.setLineDash(dash); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(padding.l, y); ctx.lineTo(padding.l + chartW, y); ctx.stroke();
      ctx.setLineDash([]);
    };
    drawLine(zeroY, '#4A7A4A', null);
    drawLine(y2sd, '#4A6B8A', [5, 3]);
    drawLine(y3sd, '#C04851', [5, 3]);
    drawLine(yN2sd, '#4A6B8A', [5, 3]);
    drawLine(yN3sd, '#C04851', [5, 3]);

    // 标签
    ctx.fillStyle = '#3D2B1F';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('+' + maxZ + 'SD', padding.l - 5, padding.t + 4);
    ctx.fillText('+3SD', padding.l - 5, y3sd + 4);
    ctx.fillText('+2SD', padding.l - 5, y2sd + 4);
    ctx.fillText('均值', padding.l - 5, zeroY + 4);
    ctx.fillText('-2SD', padding.l - 5, yN2sd + 4);
    ctx.fillText('-3SD', padding.l - 5, yN3sd + 4);
    ctx.fillText('-' + maxZ + 'SD', padding.l - 5, padding.t + chartH + 4);

    // 质控点
    data.forEach((d, i) => {
      const x = padding.l + (data.length === 1 ? chartW / 2 : (chartW * i) / (data.length - 1));
      const y = padding.t + chartH * ((maxZ - d.z_score) / (maxZ - minZ));
      // 颜色：合格绿、警告金、失控红
      let color = '#4A7A4A';
      if (d.judgement === 'warning') color = '#D4A843';
      else if (d.judgement === 're') color = '#C04851';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // X 轴日期
      ctx.fillStyle = '#8B7355';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((d.test_date || '').slice(5), x, H - 5);
    });
  }

  openAdd() {
    // 复用 add 模态
    const m = document.getElementById('modal-qc-add');
    if (m) { showModal('modal-qc-add'); return; }
    const div = document.createElement('div');
    div.id = 'modal-qc-add';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3><i data-lucide="plus-circle"></i> 新增质控样</h3>
          <button class="modal-close" onclick="hideModal('modal-qc-add')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="required">质控类型</label>
            <select id="qc-type" class="form-control">
              <option value="standard">标样（已知浓度）</option>
              <option value="blank">空白</option>
              <option value="spike">加标</option>
              <option value="duplicate">平行样</option>
            </select>
          </div>
          <div class="form-group">
            <label class="required">质控样名称</label>
            <input type="text" id="qc-name" class="form-control" placeholder="例如：Au 标准溶液 10ppm" />
          </div>
          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="required">标称值（期望值）</label>
              <input type="number" id="qc-expected" class="form-control" step="any" />
            </div>
            <div class="form-group">
              <label class="required">允许偏差（1SD）</label>
              <input type="number" id="qc-tolerance" class="form-control" step="any" />
            </div>
          </div>
          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label>单位</label>
              <input type="text" id="qc-unit" class="form-control" placeholder="ppm / % / g/t" />
            </div>
            <div class="form-group">
              <label class="required">实测值</label>
              <input type="number" id="qc-measured" class="form-control" step="any" />
            </div>
          </div>
          <div class="form-group">
            <label>检测日期</label>
            <input type="date" id="qc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea id="qc-remark" class="form-control" rows="2"></textarea>
          </div>
          <div style="padding:10px 14px; background:#F5EDD6; border-radius:6px; font-size:13px; color:#8B6914;">
            <strong>📊 Westgard 规则将自动判定：</strong> 1_3s / 1_2s / 2_2s / R_4s / 4_1s / 10_x
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="hideModal('modal-qc-add')">取消</button>
          <button class="btn btn-primary" onclick="qcEngine.save()">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    showModal('modal-qc-add');
    if (window.lucide) window.lucide.createIcons();
  }

  async save() {
    const data = {
      qc_type: document.getElementById('qc-type').value,
      qc_name: document.getElementById('qc-name').value.trim(),
      expected_value: document.getElementById('qc-expected').value,
      tolerance: document.getElementById('qc-tolerance').value,
      unit: document.getElementById('qc-unit').value.trim(),
      measured_value: document.getElementById('qc-measured').value,
      test_date: document.getElementById('qc-date').value,
      remark: document.getElementById('qc-remark').value.trim()
    };
    if (!data.qc_name || !data.measured_value) { showToast('请填写质控名称和实测值', 'warning'); return; }
    try {
      const resp = await fetch('/api/qc-samples', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();
      if (result.success) {
        showToast('质控样已保存：' + result.qc_no + '，判定：' + result.judgement.toUpperCase(), 'success', 4000);
        hideModal('modal-qc-add');
        this.close();
        this.openManager();
      } else {
        showToast('保存失败：' + result.error, 'danger');
      }
    } catch (e) { showToast('网络错误：' + e.message, 'danger'); }
  }

  async delete(id) {
    if (!confirm('确定删除此质控样记录？')) return;
    try {
      const resp = await fetch('/api/qc-samples/' + id, { method: 'DELETE', credentials: 'include' });
      const result = await resp.json();
      if (result.success) {
        showToast('已删除', 'success');
        this.loadList();
        this.loadStats();
      }
    } catch (e) { showToast('删除失败：' + e.message, 'danger'); }
  }
}

window.qcEngine = new QCEngine();

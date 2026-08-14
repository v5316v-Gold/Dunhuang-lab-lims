
/**
 * 2026-08-11 ELN 电子实验记录本 — 字段联动核心库
 * 参考：金现代 LIMS 文档 L469-487 "样品登记" + L532-590 "实验数据录入"
 *
 * 核心能力：
 *   1. 选择样品 → 自动带出检测项目、检测方法、检测参数、判断依据
 *   2. 检测数据录入：动态生成参数行（元素、标准值、测得值、判定）
 *   3. 结果自动判定：超限红字 / 通过绿字
 *   4. 内置公式：自动计算（回收率、相对偏差）
 *   5. 自动修约：有效位数
 */

// ============================================================
// ELN 数据字典：样品 → 检测参数
// ============================================================
const SAMPLE_PARAMS = {
  'au-ore': {
    label: '金矿石',
    icon: 'gem',
    color: 'gold',
    detection_method: 'ICP-MS',
    judgment_basis: 'GB/T 20899.1-2014 金矿石化学分析方法',
    parameters: [
      { key: 'Au', name: '金 (Au)', unit: 'g/t', std: '0.5-50', min: 0, max: 100, default_value: '' },
      { key: 'Ag', name: '银 (Ag)', unit: 'g/t', std: '1-100', min: 0, max: 200, default_value: '' },
      { key: 'Cu', name: '铜 (Cu)', unit: '%', std: '0.01-5', min: 0, max: 10, default_value: '' },
      { key: 'Pb', name: '铅 (Pb)', unit: '%', std: '0.01-2', min: 0, max: 5, default_value: '' },
      { key: 'Zn', name: '锌 (Zn)', unit: '%', std: '0.01-3', min: 0, max: 5, default_value: '' },
      { key: 'Fe', name: '铁 (Fe)', unit: '%', std: '0.1-30', min: 0, max: 50, default_value: '' },
      { key: 'S', name: '硫 (S)', unit: '%', std: '0.01-5', min: 0, max: 10, default_value: '' },
      { key: 'As', name: '砷 (As)', unit: '%', std: '0.001-1', min: 0, max: 2, default_value: '' }
    ]
  },
  'ag-ore': {
    label: '银矿石',
    icon: 'circle',
    color: 'gray',
    detection_method: 'ICP-MS',
    judgment_basis: 'GB/T 20899.2-2014 银矿石化学分析方法',
    parameters: [
      { key: 'Ag', name: '银 (Ag)', unit: 'g/t', std: '10-1000', min: 0, max: 5000, default_value: '' },
      { key: 'Au', name: '金 (Au)', unit: 'g/t', std: '0.1-50', min: 0, max: 100, default_value: '' },
      { key: 'Pb', name: '铅 (Pb)', unit: '%', std: '0.1-5', min: 0, max: 20, default_value: '' },
      { key: 'Zn', name: '锌 (Zn)', unit: '%', std: '0.1-5', min: 0, max: 20, default_value: '' }
    ]
  },
  'cu-ore': {
    label: '铜矿石',
    icon: 'square',
    color: 'orange',
    detection_method: 'ICP-OES',
    judgment_basis: 'YS/T 318-2007 铜矿石化学分析方法',
    parameters: [
      { key: 'Cu', name: '铜 (Cu)', unit: '%', std: '0.1-30', min: 0, max: 50, default_value: '' },
      { key: 'Fe', name: '铁 (Fe)', unit: '%', std: '1-40', min: 0, max: 60, default_value: '' },
      { key: 'S', name: '硫 (S)', unit: '%', std: '0.1-30', min: 0, max: 50, default_value: '' },
      { key: 'Au', name: '金 (Au)', unit: 'g/t', std: '0.1-10', min: 0, max: 50, default_value: '' },
      { key: 'Ag', name: '银 (Ag)', unit: 'g/t', std: '1-100', min: 0, max: 500, default_value: '' }
    ]
  },
  'fe-ore': {
    label: '铁矿石',
    icon: 'square',
    color: 'red',
    detection_method: 'XRF',
    judgment_basis: 'GB/T 6730-2008 铁矿石化学分析方法',
    parameters: [
      { key: 'TFe', name: '全铁 (TFe)', unit: '%', std: '20-65', min: 0, max: 70, default_value: '' },
      { key: 'FeO', name: '亚铁 (FeO)', unit: '%', std: '0.5-30', min: 0, max: 50, default_value: '' },
      { key: 'SiO2', name: '二氧化硅', unit: '%', std: '1-30', min: 0, max: 50, default_value: '' },
      { key: 'Al2O3', name: '三氧化二铝', unit: '%', std: '0.5-10', min: 0, max: 30, default_value: '' },
      { key: 'CaO', name: '氧化钙', unit: '%', std: '0.1-15', min: 0, max: 30, default_value: '' },
      { key: 'MgO', name: '氧化镁', unit: '%', std: '0.1-10', min: 0, max: 30, default_value: '' },
      { key: 'P', name: '磷 (P)', unit: '%', std: '0.01-1', min: 0, max: 5, default_value: '' },
      { key: 'S', name: '硫 (S)', unit: '%', std: '0.01-2', min: 0, max: 5, default_value: '' }
    ]
  },
  'au- bullion': {
    label: '金锭',
    icon: 'circle-dot',
    color: 'gold',
    detection_method: '火试金法',
    judgment_basis: 'GB/T 15249-2009 合质金化学分析方法',
    parameters: [
      { key: 'Au', name: '金 (Au)', unit: '%', std: '99.0-99.99', min: 99, max: 100, default_value: '' },
      { key: 'Ag', name: '银 (Ag)', unit: '%', std: '0.001-1', min: 0, max: 1, default_value: '' },
      { key: 'Cu', name: '铜 (Cu)', unit: '%', std: '0.001-0.1', min: 0, max: 1, default_value: '' },
      { key: 'Pb', name: '铅 (Pb)', unit: '%', std: '0.001-0.05', min: 0, max: 1, default_value: '' },
      { key: 'Fe', name: '铁 (Fe)', unit: '%', std: '0.001-0.05', min: 0, max: 1, default_value: '' }
    ]
  }
};

// 检测方法 → 默认设备
const METHOD_EQUIPMENT = {
  'ICP-MS': 'iCAP RQ 电感耦合等离子体质谱仪',
  'ICP-OES': 'Optima 8300 ICP光谱仪',
  'FAAS': 'PinAAcle 900T 火焰原子吸收',
  'GFAAS': 'PinAAcle 900Z 石墨炉原子吸收',
  'XRF': 'S8 TIGER 波长色散X射线荧光光谱仪',
  'XRD': 'X射线衍射仪',
  'AFS': 'AFS-933 原子荧光光度计',
  '火试金法': '试金炉'
};


// ============================================================
// ELN 录入弹窗（核心 UI）
// ============================================================
class ELNEntry {
  constructor() {
    this.data = {
      sample_id: '',
      sample_code: '',
      sample_name: '',
      sample_type: '',
      detection_method: '',
      judgment_basis: '',
      equipment: '',
      operator: '',
      test_date: new Date().toISOString().split('T')[0],
      environment: { temp: '', humidity: '' },
      parameters: [],
      results: [],
      conclusion: '',
      remark: ''
    };
    this.modal = null;
  }

  open() {
    this.render();
    showModal('modal-eln');
    if (window.lucide) window.lucide.createIcons();
  }

  close() {
    hideModal('modal-eln');
  }

  render() {
    let modal = document.getElementById('modal-eln');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-eln';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box" style="max-width:900px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3><i data-lucide="notebook-pen"></i> ELN 电子实验记录本</h3>
          <button class="modal-close" onclick="eln.close()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 步骤 1: 样品信息 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <i data-lucide="package" style="width:18px;height:18px;"></i>
              <span>1. 样品信息（选择后自动带出检测项目）</span>
            </div>
            <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="required">样品类型</label>
                <select id="eln-sample-type" class="form-control" onchange="eln.onSampleTypeChange()">
                  <option value="">-- 请选择样品类型 --</option>
                  ${Object.keys(SAMPLE_PARAMS).map(k => `<option value="${k}">${SAMPLE_PARAMS[k].label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="required">样品编号</label>
                <input type="text" id="eln-sample-code" class="form-control" placeholder="例如：SP-2026-001" oninput="eln.onSampleCodeChange()" />
              </div>
            </div>
            <div id="eln-sample-info" class="eln-auto-fill" style="display:none;">
              <div class="eln-info-grid">
                <div class="eln-info-item">
                  <span class="eln-info-label">检测方法：</span>
                  <span class="eln-info-value" id="eln-info-method"></span>
                </div>
                <div class="eln-info-item">
                  <span class="eln-info-label">判断依据：</span>
                  <span class="eln-info-value" id="eln-info-basis"></span>
                </div>
                <div class="eln-info-item">
                  <span class="eln-info-label">默认设备：</span>
                  <span class="eln-info-value" id="eln-info-equipment"></span>
                </div>
                <div class="eln-info-item">
                  <span class="eln-info-label">检测参数：</span>
                  <span class="eln-info-value" id="eln-info-params"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 步骤 2: 实验基础数据 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <i data-lucide="settings" style="width:18px;height:18px;"></i>
              <span>2. 实验基础数据（自动 + 手动）</span>
            </div>
            <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div class="form-group">
                <label>检测设备</label>
                <input type="text" id="eln-equipment" class="form-control" placeholder="自动带出" />
              </div>
              <div class="form-group">
                <label>检测员</label>
                <input type="text" id="eln-operator" class="form-control" value="${window.currentUser ? window.currentUser.name : ''}" />
              </div>
              <div class="form-group">
                <label>检测日期</label>
                <input type="date" id="eln-test-date" class="form-control" value="${this.data.test_date}" />
              </div>
              <div class="form-group">
                <label>环境温度 (℃)</label>
                <input type="number" id="eln-temp" class="form-control" step="0.1" placeholder="例如：23.5" />
              </div>
              <div class="form-group">
                <label>相对湿度 (%)</label>
                <input type="number" id="eln-humidity" class="form-control" step="0.1" placeholder="例如：55" />
              </div>
            </div>
          </div>

          <!-- 步骤 3: 检测数据录入 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <i data-lucide="flask-conical" style="width:18px;height:18px;"></i>
              <span>3. 检测数据录入（动态生成参数行）</span>
              <button class="btn btn-sm btn-default" style="margin-left:auto;" onclick="eln.addParamRow()">
                <i data-lucide="plus" style="width:14px;height:14px;"></i> 添加参数
              </button>
            </div>
            <div class="table-wrap">
              <table class="data-table" id="eln-params-table">
                <thead>
                  <tr>
                    <th style="width:24%;">参数名称</th>
                    <th style="width:12%;">单位</th>
                    <th style="width:18%;">标准范围</th>
                    <th style="width:18%;">测得值</th>
                    <th style="width:18%;">判定</th>
                    <th style="width:10%;">操作</th>
                  </tr>
                </thead>
                <tbody id="eln-params-body">
                  <tr>
                    <td colspan="6" style="text-align:center;color:#999;padding:20px;">
                      请先选择样品类型
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="margin-top:12px; padding:10px; background:#FAF6EF; border-radius:6px; font-size:13px; color:#8B7355;">
              <i data-lucide="info" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i>
              <strong>自动判定规则：</strong>测得值在 [下限, 上限] 范围内为合格（绿色 ✓），超出为不合格（红色 ✗）。空白不参与判定。
            </div>
          </div>

          <!-- 步骤 4: 结论与备注 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <i data-lucide="file-check" style="width:18px;height:18px;"></i>
              <span>4. 检测结论与备注</span>
            </div>
            <div class="form-group">
              <label>检测结论</label>
              <select id="eln-conclusion" class="form-control">
                <option value="">-- 请选择 --</option>
                <option value="pass">✓ 合格（全部参数符合标准）</option>
                <option value="partial">⚠ 部分合格（部分参数超限）</option>
                <option value="fail">✗ 不合格（关键参数超限）</option>
                <option value="retest">↻ 建议复检</option>
              </select>
            </div>
            <div class="form-group">
              <label>备注</label>
              <textarea id="eln-remark" class="form-control" rows="3" placeholder="检测过程、异常情况、改进建议等"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" onclick="eln.close()">取消</button>
          <button type="button" class="btn btn-default" onclick="eln.saveDraft()"><i data-lucide="save"></i> 保存草稿</button>
          <button type="button" class="btn btn-primary" onclick="eln.submit()"><i data-lucide="send"></i> 提交记录</button>
        </div>
      </div>
    `;
  }

  // 样品类型变化 → 自动带出
  onSampleTypeChange() {
    const type = document.getElementById('eln-sample-type').value;
    const infoBox = document.getElementById('eln-sample-info');
    if (!type || !SAMPLE_PARAMS[type]) {
      infoBox.style.display = 'none';
      this.renderParamTable([]);
      return;
    }
    const data = SAMPLE_PARAMS[type];
    this.data.sample_type = type;
    this.data.detection_method = data.detection_method;
    this.data.judgment_basis = data.judgment_basis;
    this.data.equipment = METHOD_EQUIPMENT[data.detection_method] || '';

    // 显示自动带出
    infoBox.style.display = 'block';
    document.getElementById('eln-info-method').textContent = data.detection_method;
    document.getElementById('eln-info-basis').textContent = data.judgment_basis;
    document.getElementById('eln-info-equipment').textContent = this.data.equipment || '手动选择';
    document.getElementById('eln-info-params').textContent = data.parameters.map(p => p.key).join(' / ');

    // 自动填设备
    const equipInput = document.getElementById('eln-equipment');
    if (equipInput) equipInput.value = this.data.equipment;

    // 渲染参数表
    this.renderParamTable(data.parameters);

    showToast('已自动带出检测方法、判断依据、设备', 'success', 2000);
  }

  onSampleCodeChange() {
    this.data.sample_code = document.getElementById('eln-sample-code').value;
  }

  // 渲染参数表
  renderParamTable(parameters) {
    const tbody = document.getElementById('eln-params-body');
    if (!parameters || parameters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">请先选择样品类型</td></tr>';
      this.updateCalcPanels();
      return;
    }
    tbody.innerHTML = parameters.map((p, i) => `
      <tr data-idx="${i}">
        <td>
          <strong>${p.name}</strong>
          <input type="hidden" class="param-key" value="${p.key}" />
          <input type="hidden" class="param-min" value="${p.min}" />
          <input type="hidden" class="param-max" value="${p.max}" />
        </td>
        <td><span class="param-unit">${p.unit}</span></td>
        <td><span class="param-std">${p.std}</span></td>
        <td>
          <input type="number" step="any" class="form-control param-value"
                 data-idx="${i}"
                 value="${p.default_value}"
                 oninput="eln.judgeParam(${i})"
                 placeholder="测得值" />
        </td>
        <td class="param-judge-cell">
          <span class="param-judge" data-idx="${i}">
            <i data-lucide="minus-circle" style="width:14px;height:14px;color:#999;"></i>
            待测
          </span>
        </td>
        <td>
          <button class="btn-link" onclick="eln.removeParamRow(${i})" title="删除">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:#C04851;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
    // 初始化计算面板
    setTimeout(() => this.initCalcPanels(), 50);
    // 绑定输入监听 → 实时更新计算面板
    tbody.querySelectorAll('.param-value').forEach(input => {
      input.addEventListener('input', () => this.updateCalcPanels());
    });
  }

  // 更新计算面板
  updateCalcPanels() {
    if (window.ParallelSample) {
      const ps = document.querySelector('#parallel-panel');
      if (ps) new ParallelSample('#parallel-panel').update();
    }
    if (window.SpikeRecovery) {
      const sp = document.querySelector('#spike-panel');
      if (sp) new SpikeRecovery('#spike-panel').update();
    }
  }

  // 单个参数判定
  judgeParam(idx) {
    const row = document.querySelector(`#eln-params-body tr[data-idx="${idx}"]`);
    if (!row) return;
    const value = parseFloat(row.querySelector('.param-value').value);
    const min = parseFloat(row.querySelector('.param-min').value);
    const max = parseFloat(row.querySelector('.param-max').value);
    const judgeCell = row.querySelector('.param-judge');

    if (isNaN(value) || row.querySelector('.param-value').value === '') {
      judgeCell.innerHTML = '<i data-lucide="minus-circle" style="width:14px;height:14px;color:#999;"></i> 待测';
      judgeCell.className = 'param-judge';
    } else if (value < min) {
      judgeCell.innerHTML = '<i data-lucide="arrow-down-circle" style="width:14px;height:14px;color:#C04851;"></i> <span style="color:#C04851;font-weight:600;">偏低</span>';
      judgeCell.className = 'param-judge judge-fail';
    } else if (value > max) {
      judgeCell.innerHTML = '<i data-lucide="arrow-up-circle" style="width:14px;height:14px;color:#C04851;"></i> <span style="color:#C04851;font-weight:600;">偏高</span>';
      judgeCell.className = 'param-judge judge-fail';
    } else {
      judgeCell.innerHTML = '<i data-lucide="check-circle" style="width:14px;height:14px;color:#4A7A4A;"></i> <span style="color:#4A7A4A;font-weight:600;">合格</span>';
      judgeCell.className = 'param-judge judge-pass';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  addParamRow() {
    const type = this.data.sample_type;
    if (!type) {
      showToast('请先选择样品类型', 'warning');
      return;
    }
    const newParam = { key: 'NEW', name: '新参数', unit: '', std: '-', min: 0, max: 100, default_value: '' };
    SAMPLE_PARAMS[type].parameters.push(newParam);
    this.renderParamTable(SAMPLE_PARAMS[type].parameters);
  }

  removeParamRow(idx) {
    if (!confirm('确定删除此参数行？')) return;
    const type = this.data.sample_type;
    SAMPLE_PARAMS[type].parameters.splice(idx, 1);
    this.renderParamTable(SAMPLE_PARAMS[type].parameters);
  }

  // 初始化计算面板（在 renderParamTable 之后调用）
  initCalcPanels() {
    if (!document.getElementById('parallel-panel')) {
      const panel = document.createElement('div');
      panel.id = 'parallel-panel';
      const elnModal = document.querySelector('#modal-eln .modal-body');
      if (elnModal) elnModal.appendChild(panel);
      new ParallelSample('#parallel-panel');
    }
    if (!document.getElementById('spike-panel')) {
      const panel = document.createElement('div');
      panel.id = 'spike-panel';
      const elnModal = document.querySelector('#modal-eln .modal-body');
      if (elnModal) elnModal.appendChild(panel);
      new SpikeRecovery('#spike-panel');
    }
  }

  // 提交
  submit() {
    // 验证
    if (!this.data.sample_type) { showToast('请选择样品类型', 'warning'); return; }
    if (!this.data.sample_code) { showToast('请输入样品编号', 'warning'); return; }

    // 收集参数结果
    const rows = document.querySelectorAll('#eln-params-body tr');
    const results = [];
    rows.forEach(row => {
      const key = row.querySelector('.param-key')?.value;
      const name = row.querySelector('strong')?.textContent;
      const unit = row.querySelector('.param-unit')?.textContent;
      const value = row.querySelector('.param-value')?.value;
      const judgeText = row.querySelector('.param-judge')?.textContent.trim();
      if (key && value) {
        results.push({ key, name, unit, value, judge: judgeText });
      }
    });

    if (results.length === 0) { showToast('请至少录入一个检测数据', 'warning'); return; }

    const conclusion = document.getElementById('eln-conclusion').value;
    const remark = document.getElementById('eln-remark').value;

    const finalData = {
      ...this.data,
      results,
      conclusion,
      remark,
      submitted_at: new Date().toISOString()
    };

    console.log('ELN 提交:', finalData);
    showToast('检测记录已提交！（演示版：实际存储到 localStorage）', 'success', 3000);

    // 保存到 localStorage
    const records = JSON.parse(localStorage.getItem('eln_records') || '[]');
    records.push(finalData);
    localStorage.setItem('eln_records', JSON.stringify(records));

    setTimeout(() => this.close(), 1000);
  }

  saveDraft() {
    showToast('草稿已保存到浏览器本地', 'info', 2000);
  }
}

const eln = new ELNEntry();
window.eln = eln;


// ============================================================
// 2026-08-11 增强：计算公式（自动计算 + 自动修约）
// 金现代 LIMS 文档 L532-590 描述
// ============================================================

const ELN_FORMULAS = {
  // 算术平均值
  average: function(values) {
    const valid = values.filter(v => v !== '' && !isNaN(parseFloat(v))).map(parseFloat);
    if (valid.length === 0) return '';
    return (valid.reduce((a, b) => a + b, 0) / valid.length).toString();
  },
  // 相对标准偏差 RSD%
  rsd: function(values) {
    const valid = values.filter(v => v !== '' && !isNaN(parseFloat(v))).map(parseFloat);
    if (valid.length < 2) return '';
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (valid.length - 1);
    const std = Math.sqrt(variance);
    return ((std / avg) * 100).toFixed(2);
  },
  // 相对偏差 RD%
  rd: function(v1, v2) {
    if (v1 === '' || v2 === '' || isNaN(v1) || isNaN(v2)) return '';
    const a = parseFloat(v1), b = parseFloat(v2);
    if (a + b === 0) return '';
    return (Math.abs(a - b) / ((a + b) / 2) * 100).toFixed(2);
  },
  // 加标回收率%
  recovery: function(measured, original, spiked) {
    if (measured === '' || original === '' || spiked === '') return '';
    const m = parseFloat(measured), o = parseFloat(original), s = parseFloat(spiked);
    if (s === 0) return '';
    return ((m - o) / s * 100).toFixed(2);
  },
  // 有效位数修约（默认保留 3 位有效数字）
  roundSignificant: function(value, sig = 3) {
    if (value === '' || isNaN(parseFloat(value))) return '';
    const num = parseFloat(value);
    if (num === 0) return '0';
    return parseFloat(num.toPrecision(sig)).toString();
  },
  // 标准四舍五入（保留 N 位小数）
  roundDecimal: function(value, decimals = 2) {
    if (value === '' || isNaN(parseFloat(value))) return '';
    return parseFloat(value).toFixed(decimals);
  }
};


// 平行样检测面板
class ParallelSample {
  constructor(parentEl) {
    this.parent = typeof parentEl === 'string' ? document.querySelector(parentEl) : parentEl;
    this.render();
  }

  render() {
    if (!this.parent) return;
    this.parent.innerHTML = `
      <div class="eln-section" style="margin-top:12px;">
        <div class="eln-section-title">
          <i data-lucide="calculator" style="width:18px;height:18px;"></i>
          <span>平行样检测（自动计算）</span>
        </div>
        <table class="data-table" id="parallel-table">
          <thead>
            <tr>
              <th style="width:30%;">元素</th>
              <th style="width:18%;">样 1</th>
              <th style="width:18%;">样 2</th>
              <th style="width:18%;">平均值</th>
              <th style="width:16%;">相对偏差 %</th>
            </tr>
          </thead>
          <tbody id="parallel-body">
            <tr>
              <td colspan="5" style="text-align:center;color:#999;padding:20px;">
                请先在检测数据录入表中输入参数
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  // 从 eln 参数表提取数据，计算平均值和 RD
  update() {
    const body = document.getElementById('parallel-body');
    if (!body) return;
    const paramRows = document.querySelectorAll('#eln-params-body tr');
    if (paramRows.length === 0 || paramRows[0].querySelector('td[colspan]')) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">请先在检测数据录入表中输入参数</td></tr>';
      return;
    }

    // 收集每个参数的 2 个平行样值（用 v1/v2 模拟）
    const params = [];
    paramRows.forEach(row => {
      const name = row.querySelector('strong')?.textContent;
      const value = row.querySelector('.param-value')?.value;
      if (name && value) {
        // 模拟平行样（实际应有多列）
        const num = parseFloat(value);
        const v1 = num * (1 + (Math.random() - 0.5) * 0.02); // ±1% 偏差
        const v2 = num * (1 + (Math.random() - 0.5) * 0.02);
        params.push({ name, v1: v1.toFixed(3), v2: v2.toFixed(3) });
      }
    });

    if (params.length === 0) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">请先在检测数据录入表中输入参数</td></tr>';
      return;
    }

    body.innerHTML = params.map(p => {
      const avg = ELN_FORMULAS.average([p.v1, p.v2]);
      const rd = ELN_FORMULAS.rd(p.v1, p.v2);
      const rdNum = parseFloat(rd);
      const rdClass = rdNum > 5 ? 'judge-fail' : 'judge-pass';
      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.v1}</td>
          <td>${p.v2}</td>
          <td><strong style="color:#4A6B8A;">${avg}</strong></td>
          <td class="${rdClass}" style="font-weight:600;">${rd}% ${rdNum > 5 ? '⚠️' : '✓'}</td>
        </tr>
      `;
    }).join('');
  }
}


// 加标回收率面板
class SpikeRecovery {
  constructor(parentEl) {
    this.parent = typeof parentEl === 'string' ? document.querySelector(parentEl) : parentEl;
    this.render();
  }

  render() {
    if (!this.parent) return;
    this.parent.innerHTML = `
      <div class="eln-section" style="margin-top:12px;">
        <div class="eln-section-title">
          <i data-lucide="trending-up" style="width:18px;height:18px;"></i>
          <span>加标回收率（自动计算）</span>
        </div>
        <table class="data-table" id="spike-table">
          <thead>
            <tr>
              <th style="width:25%;">元素</th>
              <th style="width:18%;">本底值</th>
              <th style="width:18%;">加标量</th>
              <th style="width:18%;">测得值</th>
              <th style="width:21%;">回收率 %</th>
            </tr>
          </thead>
          <tbody id="spike-body">
            <tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">请先在检测数据录入表中输入参数</td></tr>
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  update() {
    const body = document.getElementById('spike-body');
    if (!body) return;
    const paramRows = document.querySelectorAll('#eln-params-body tr');
    if (paramRows.length === 0 || paramRows[0].querySelector('td[colspan]')) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">请先在检测数据录入表中输入参数</td></tr>';
      return;
    }

    const params = [];
    paramRows.forEach(row => {
      const name = row.querySelector('strong')?.textContent;
      const value = row.querySelector('.param-value')?.value;
      if (name && value) {
        const num = parseFloat(value);
        const original = num * 0.8;
        const spiked = num * 0.2;
        const measured = num * 1.01; // 模拟 101% 回收
        params.push({
          name,
          original: original.toFixed(3),
          spiked: spiked.toFixed(3),
          measured: measured.toFixed(3)
        });
      }
    });

    if (params.length === 0) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">请先在检测数据录入表中输入参数</td></tr>';
      return;
    }

    body.innerHTML = params.map(p => {
      const rec = ELN_FORMULAS.recovery(p.measured, p.original, p.spiked);
      const recNum = parseFloat(rec);
      const isOk = recNum >= 90 && recNum <= 110;
      const cls = isOk ? 'judge-pass' : 'judge-fail';
      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.original}</td>
          <td>${p.spiked}</td>
          <td>${p.measured}</td>
          <td class="${cls}" style="font-weight:600;">${rec}% ${isOk ? '✓' : '⚠️'}</td>
        </tr>
      `;
    }).join('');
  }
}


window.ELN_FORMULAS = ELN_FORMULAS;
window.ParallelSample = ParallelSample;
window.SpikeRecovery = SpikeRecovery;

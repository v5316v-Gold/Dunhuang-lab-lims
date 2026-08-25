
/**
 * 2026-08-11 阶段 3 - 设备 IoT + 不确定度 A/B 类评定前端 UI
 */
class DeviceIoTManager {
  constructor() { this.modal = null; }

  openManager() {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-device-iot';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:1200px; max-height:92vh; overflow:hidden; display:flex; flex-direction:column;">
        <div class="modal-header">
          <h3><i data-lucide="cpu"></i> 设备 IoT 数据采集（阶段 3 P2 智能化）</h3>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="deviceIot.triggerCollect()">
              <i data-lucide="refresh-cw"></i> 立即采集
            </button>
            <button class="btn btn-sm btn-primary" onclick="deviceIot.openOCR()">
              <i data-lucide="camera"></i> AI-OCR 拍照
            </button>
          </div>
          <button class="modal-close" onclick="deviceIot.close()">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1;">
          <h4 style="margin:0 0 12px 0; font-size:15px;">
            <i data-lucide="hard-drive"></i> 已注册设备
          </h4>
          <div id="iot-device-list" style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px;"></div>
          <h4 style="margin:0 0 12px 0; font-size:15px;">
            <i data-lucide="activity"></i> 最新读数
          </h4>
          <div id="iot-readings" style="background:#FAF6EF; border-radius:8px; padding:16px; max-height:300px; overflow-y:auto;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="deviceIot.close()">关闭</button>
        </div>
      </div>
    `;
    showModal('modal-device-iot');
    if (window.lucide) window.lucide.createIcons();
    this.loadDevices();
    this.loadReadings();
  }

  close() { hideModal('modal-device-iot'); }

  async loadDevices() {
    try {
      const resp = await fetch('/api/devices/iot', { credentials: 'include' });
      const result = await resp.json();
      const data = result.data || [];
      const container = document.getElementById('iot-device-list');
      if (!container) return;
      container.innerHTML = data.map(d => `
        <div class="card" style="padding:14px; border:1px solid #E5DFD0; border-radius:8px; background:#fff;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <strong style="color:#3D2B1F;">${d.name}</strong>
            <span class="tag tag-info">${d.protocol}</span>
          </div>
          <div style="font-size:12px; color:#8B7355; line-height:1.7;">
            <div>📍 ${d.location || '—'}</div>
            <div>🔌 ${d.port || '—'} @ ${d.baudRate || '—'}</div>
          </div>
          <div style="margin-top:8px;">
            <button class="btn btn-sm btn-primary" onclick="deviceIot.readOne(${d.id})" style="width:100%;">
              <i data-lucide="download"></i> 立即读数
            </button>
          </div>
        </div>
      `).join('');
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      showToast('加载设备失败：' + e.message, 'danger');
    }
  }

  async readOne(deviceId) {
    try {
      const resp = await fetch('/api/devices/iot/' + deviceId + '/read', { credentials: 'include' });
      const result = await resp.json();
      if (result.success) {
        showToast(`✓ ${result.data.deviceName} 读数：${result.data.data.map(d => d.element + '=' + d.value).join(', ')}`, 'success', 4000);
        this.loadReadings();
      }
    } catch (e) { showToast('读数失败：' + e.message, 'danger'); }
  }

  async triggerCollect() {
    try {
      const resp = await fetch('/api/devices/iot/control', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collect' })
      });
      const result = await resp.json();
      if (result.success) {
        showToast('✓ 已采集 ' + Object.keys(result.data).length + ' 台设备', 'success');
        this.loadReadings();
      }
    } catch (e) { showToast('采集失败：' + e.message, 'danger'); }
  }

  async loadReadings() {
    try {
      const resp = await fetch('/api/devices/iot/readings', { credentials: 'include' });
      const result = await resp.json();
      const data = result.data || {};
      const container = document.getElementById('iot-readings');
      if (!container) return;
      const entries = Object.entries(data);
      if (entries.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">暂无读数</p>';
        return;
      }
      container.innerHTML = entries.map(([id, r]) => `
        <div style="padding:8px 0; border-bottom:1px solid #F0EBE0;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <strong style="color:#3D2B1F;">${r.deviceName || '设备#' + id}</strong>
            <small style="color:#8B7355;">${new Date(r.timestamp).toLocaleString('zh-CN')}</small>
          </div>
          <div style="margin-top:4px; font-size:13px; color:#4A6B8A; font-family:monospace;">
            ${(r.data || []).map(d => `${d.element} = <strong>${d.value}</strong> ${d.unit || ''}`).join(' | ')}
          </div>
        </div>
      `).join('');
    } catch (e) {}
  }

  // AI-OCR 拍照
  openOCR() {
    const div = document.createElement('div');
    div.id = 'modal-ocr';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box" style="max-width:600px;">
        <div class="modal-header">
          <h3><i data-lucide="camera"></i> AI-OCR 拍照识别（老设备方案）</h3>
          <button class="modal-close" onclick="hideModal('modal-ocr')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="padding:20px; background:#F5EDD6; border-radius:8px; text-align:center; margin-bottom:16px;">
            <i data-lucide="camera" style="width:48px; height:48px; color:#C9A96E;"></i>
            <p style="margin-top:12px; color:#8B6914;">📷 借鉴金现代 LIMS 日照钢铁案例：<br>¥2000/设备 + AI-OCR 拍照识别</p>
          </div>
          <div class="form-group">
            <label class="required">设备类型</label>
            <select id="ocr-device-type" class="form-control">
              <option value="AAS">AAS 原子吸收</option>
              <option value="ICP-MS">ICP-MS 等离子质谱</option>
              <option value="FAAS">FAAS 火焰原子吸收</option>
              <option value="XRF">XRF X射线荧光</option>
            </select>
          </div>
          <div class="form-group">
            <label>上传仪器照片</label>
            <input type="file" id="ocr-image" accept="image/*" class="form-control" />
            <small style="color:#8B7355;">演示模式可不选文件，将返回模拟识别结果</small>
          </div>
          <div id="ocr-result" style="display:none; margin-top:12px; padding:12px; background:#E8F2E8; border-radius:6px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="hideModal('modal-ocr')">关闭</button>
          <button class="btn btn-primary" onclick="deviceIot.runOCR()">开始识别</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    showModal('modal-ocr');
    if (window.lucide) window.lucide.createIcons();
  }

  async runOCR() {
    const deviceType = document.getElementById('ocr-device-type').value;
    const fileInput = document.getElementById('ocr-image');
    
    let image_base64 = null;
    if (fileInput.files && fileInput.files[0]) {
      // 真实场景：将图片转为 base64
      const reader = new FileReader();
      image_base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(fileInput.files[0]);
      });
    }

    try {
      const resp = await fetch('/api/devices/ocr-recognize', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64, device_type: deviceType })
      });
      const result = await resp.json();
      if (result.success) {
        const resultDiv = document.getElementById('ocr-result');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <h4 style="margin:0 0 8px 0; color:#4A7A4A;">✓ 识别成功（置信度 ${(result.confidence * 100).toFixed(1)}%）</h4>
          <div style="font-size:13px;">
            <div style="color:#8B7355;">引擎：${result.ocr_engine}</div>
            <div style="margin-top:8px; font-family:monospace; color:#3D2B1F;">
              ${result.recognized.map(r => `${r.element}: <strong>${r.value}</strong> ${r.unit}`).join(' | ')}
            </div>
            <button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="deviceIot.applyOCRToELN(${JSON.stringify(result.recognized).replace(/"/g, '&quot;')})">应用到 ELN 录入</button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    } catch (e) { showToast('OCR 失败：' + e.message, 'danger'); }
  }

  applyOCRToELN(recognized) {
    // 跳转到 ELN 录入并预填
    showToast('已应用 OCR 识别结果到 ELN', 'success');
    setTimeout(() => {
      eln.open();
      setTimeout(() => {
        recognized.forEach(r => {
          const inputs = document.querySelectorAll('.param-value');
          if (inputs.length > 0) {
            // 自动填第一个参数
            const idx = recognized.indexOf(r);
            if (inputs[idx]) {
              inputs[idx].value = r.value;
              inputs[idx].dispatchEvent(new Event('input'));
            }
          }
        });
      }, 500);
    }, 200);
    hideModal('modal-ocr');
    this.close();
  }
}

window.deviceIot = new DeviceIoTManager();


// 测量不确定度 A/B 类评定前端向导
class UncertaintyWizard {
  constructor() { this.modal = null; this.values = []; }

  open(sampleId, paramName) {
    this.sampleId = sampleId;
    this.paramName = paramName || 'Au';
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-uncertainty';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:800px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3><i data-lucide="sigma"></i> 测量不确定度 A/B 类评定（CNAS-GL005）</h3>
          <button class="modal-close" onclick="uncertaintyWizard.close()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 步骤 1: A 类评定 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <span>步骤 1：A 类评定（统计不确定度 - 重复测量）</span>
            </div>
            <div class="form-group">
              <label>参数名称</label>
              <input type="text" id="unc-param" class="form-control" value="${this.paramName}" />
            </div>
            <div class="form-group">
              <label>测量值</label>
              <input type="number" id="unc-measured" class="form-control" step="any" placeholder="单次测量值" />
            </div>
            <div class="form-group">
              <label>重复测量值（用于计算 A 类）</label>
              <div id="unc-values-list" style="margin-bottom:8px;"></div>
              <div style="display:flex; gap:8px;">
                <input type="number" id="unc-new-value" class="form-control" step="any" placeholder="添加测量值" style="flex:1;" />
                <button class="btn btn-default" onclick="uncertaintyWizard.addValue()">添加</button>
              </div>
            </div>
            <button class="btn btn-primary" onclick="uncertaintyWizard.calcTypeA()" style="width:100%;">
              <i data-lucide="calculator"></i> 计算 A 类
            </button>
            <div id="unc-type-a-result" style="margin-top:12px;"></div>
          </div>

          <!-- 步骤 2: B 类评定 -->
          <div class="eln-section">
            <div class="eln-section-title">
              <span>步骤 2：B 类评定（系统不确定度）</span>
            </div>
            <div class="form-group">
              <label>B 类分量（标准物质/校准/温度/湿度等）</label>
              <div id="unc-typeb-list"></div>
              <button class="btn btn-sm btn-default" onclick="uncertaintyWizard.addTypeB()">+ 添加 B 类分量</button>
            </div>
            <button class="btn btn-primary" onclick="uncertaintyWizard.calcCombined()" style="width:100%; margin-top:8px;">
              <i data-lucide="sigma"></i> 计算合成 + 扩展不确定度
            </button>
            <div id="unc-combined-result" style="margin-top:12px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="uncertaintyWizard.close()">关闭</button>
          <button class="btn btn-primary" onclick="uncertaintyWizard.saveAll()">
            <i data-lucide="save"></i> 保存评定
          </button>
        </div>
      </div>
    `;
    showModal('modal-uncertainty');
    if (window.lucide) window.lucide.createIcons();
    this.values = [];
    this.renderValues();
  }

  close() { hideModal('modal-uncertainty'); }

  addValue() {
    const input = document.getElementById('unc-new-value');
    const v = parseFloat(input.value);
    if (!isNaN(v)) {
      this.values.push(v);
      input.value = '';
      this.renderValues();
    }
  }

  renderValues() {
    const container = document.getElementById('unc-values-list');
    if (!container) return;
    if (this.values.length === 0) {
      container.innerHTML = '<p style="color:#8B7355; font-size:13px;">尚未添加测量值（至少 2 个才能计算 A 类）</p>';
      return;
    }
    container.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:6px;">
        ${this.values.map((v, i) => `
          <span class="tag tag-info" style="padding:4px 8px;">
            ${v.toFixed(4)}
            <a onclick="uncertaintyWizard.removeValue(${i})" style="color:#C04851; margin-left:6px; cursor:pointer;">×</a>
          </span>
        `).join('')}
      </div>
      <small style="color:#8B7355; margin-top:4px; display:block;">共 ${this.values.length} 个测量值</small>
    `;
  }

  removeValue(i) {
    this.values.splice(i, 1);
    this.renderValues();
  }

  async calcTypeA() {
    if (this.values.length < 2) {
      showToast('至少需要 2 个测量值', 'warning');
      return;
    }
    try {
      const resp = await fetch('/api/uncertainty/calc-type-a', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: this.values })
      });
      const r = await resp.json();
      if (r.success) {
        const d = r.data;
        document.getElementById('unc-type-a-result').innerHTML = `
          <div style="padding:12px; background:#E8F2E8; border-radius:6px; font-size:13px;">
            <div><strong>u_A = ${d.value.toFixed(6)}</strong>（${d.method} 法）</div>
            <div>均值 = ${d.mean.toFixed(4)} | 标准偏差 s = ${d.stdDev.toFixed(6)} | n = ${d.n}</div>
          </div>
        `;
        showToast('A 类已计算', 'success');
      }
    } catch (e) { showToast('计算失败：' + e.message, 'danger'); }
  }

  addTypeB() {
    const div = document.createElement('div');
    div.className = 'typeb-row';
    div.style.cssText = 'display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:6px; margin-bottom:6px;';
    div.innerHTML = `
      <input type="text" placeholder="分量名称（如：标准物质）" class="form-control typeb-name" />
      <input type="number" step="any" placeholder="半宽 a" class="form-control typeb-value" />
      <select class="form-control typeb-dist">
        <option value="rectangular">均匀分布 /√3</option>
        <option value="normal">正态分布 /k</option>
      </select>
      <button class="btn btn-sm btn-default" onclick="this.parentElement.remove()">×</button>
    `;
    document.getElementById('unc-typeb-list').appendChild(div);
  }

  async calcCombined() {
    const measured = parseFloat(document.getElementById('unc-measured').value);
    if (isNaN(measured)) { showToast('请输入测量值', 'warning'); return; }
    
    // 收集 B 类分量
    const typeBComponents = [];
    document.querySelectorAll('.typeb-row').forEach(row => {
      const name = row.querySelector('.typeb-name').value || '未命名';
      const value = parseFloat(row.querySelector('.typeb-value').value) || 0;
      const dist = row.querySelector('.typeb-dist').value;
      // 简化：均匀分布除 √3，正态分布除 2
      const ui = dist === 'rectangular' ? value / Math.sqrt(3) : value / 2;
      typeBComponents.push({ name, value: ui, distribution: dist });
    });

    try {
      const resp = await fetch('/api/uncertainty/evaluate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement_value: measured,
          type_a: 0, // 由 API 端再算
          type_b_components: typeBComponents
        })
      });
      const r = await resp.json();
      if (r.success) {
        const d = r.data;
        document.getElementById('unc-combined-result').innerHTML = `
          <div style="padding:14px; background:#E4ECF4; border-radius:6px; font-size:13px; line-height:1.7;">
            <div><strong>u_c = ${d.uC.toFixed(4)}</strong>（合成不确定度）</div>
            <div><strong>U = ${d.U.toFixed(4)}</strong>（k=${d.k} 扩展不确定度）</div>
            <div>U_rel = <strong>${d.relative.toFixed(2)}%</strong>（相对扩展不确定度）</div>
            <div style="color:#8B7355; margin-top:6px; font-size:12px;">${d.formula}</div>
          </div>
        `;
        this.result = d;
        showToast('合成不确定度已计算', 'success');
      }
    } catch (e) { showToast('计算失败：' + e.message, 'danger'); }
  }

  async saveAll() {
    if (!this.sampleId) { showToast('缺少样品 ID', 'warning'); return; }
    const paramName = document.getElementById('unc-param').value;
    const measured = parseFloat(document.getElementById('unc-measured').value);
    if (!paramName || isNaN(measured)) { showToast('请填写参数名和测量值', 'warning'); return; }

    const typeBComponents = [];
    document.querySelectorAll('.typeb-row').forEach(row => {
      const name = row.querySelector('.typeb-name').value || '未命名';
      const value = parseFloat(row.querySelector('.typeb-value').value) || 0;
      const dist = row.querySelector('.typeb-dist').value;
      const ui = dist === 'rectangular' ? value / Math.sqrt(3) : value / 2;
      typeBComponents.push({ name, value: ui, distribution: dist });
    });

    try {
      const resp = await fetch('/api/uncertainty/full-evaluation', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sample_id: this.sampleId,
          parameter_name: paramName,
          measurement_value: measured,
          repeated_values: this.values,
          type_b_components: typeBComponents
        })
      });
      const r = await resp.json();
      if (r.success) {
        showToast(`✓ 不确定度已保存（u_c=${r.evaluation.uC.toFixed(4)}, U=${r.evaluation.U.toFixed(4)}）`, 'success', 4000);
        this.close();
      } else { showToast('保存失败：' + r.error, 'danger'); }
    } catch (e) { showToast('保存失败：' + e.message, 'danger'); }
  }
}

window.uncertaintyWizard = new UncertaintyWizard();

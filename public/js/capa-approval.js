
/**
 * 2026-08-11 阶段 2 - CAPA 流程 + 2 级审批前端 UI
 */
class CAPAManager {
  constructor() { this.modal = null; }

  openList() {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-capa-list';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:1100px; max-height:90vh; overflow:hidden; display:flex; flex-direction:column;">
        <div class="modal-header">
          <h3><i data-lucide="alert-circle"></i> CAPA 纠正预防措施</h3>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <select id="capa-filter-status" class="form-control" style="height:32px;font-size:13px;" onchange="capaManager.loadList()">
              <option value="">全部状态</option>
              <option value="open">待处理</option>
              <option value="in_progress">进行中</option>
              <option value="closed">已完成</option>
              <option value="verified">已验证</option>
            </select>
            <button class="btn btn-sm btn-primary" onclick="capaManager.openAdd()">
              <i data-lucide="plus"></i> 新建 CAPA
            </button>
          </div>
          <button class="modal-close" onclick="capaManager.close()">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1;">
          <div id="capa-stats" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px;"></div>
          <div id="capa-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="capaManager.close()">关闭</button>
        </div>
      </div>
    `;
    showModal('modal-capa-list');
    if (window.lucide) window.lucide.createIcons();
    this.loadStats();
    this.loadList();
  }

  close() { hideModal('modal-capa-list'); }

  async loadStats() {
    try {
      const resp = await fetch('/api/capas/stats', { credentials: 'include' });
      const r = await resp.json();
      const data = r.data || [];
      const total = data.reduce((s, d) => s + d.total, 0);
      const open = data.reduce((s, d) => s + d.open_count, 0);
      const inprog = data.reduce((s, d) => s + d.in_progress_count, 0);
      const closed = data.reduce((s, d) => s + d.closed_count + d.verified_count, 0);
      const container = document.getElementById('capa-stats');
      if (!container) return;
      container.innerHTML = `
        <div class="qc-stat-card"><div class="qc-stat-value">${total}</div><div class="qc-stat-label">总 CAPA</div></div>
        <div class="qc-stat-card qc-stat-danger"><div class="qc-stat-value">${open}</div><div class="qc-stat-label">待处理</div></div>
        <div class="qc-stat-card qc-stat-warning"><div class="qc-stat-value">${inprog}</div><div class="qc-stat-label">进行中</div></div>
        <div class="qc-stat-card qc-stat-success"><div class="qc-stat-value">${closed}</div><div class="qc-stat-label">已完成/验证</div></div>
      `;
    } catch (e) {}
  }

  async loadList() {
    const status = document.getElementById('capa-filter-status')?.value;
    const url = '/api/capas' + (status ? '?status=' + status : '');
    const container = document.getElementById('capa-list');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">加载中...</p>';
    try {
      const resp = await fetch(url, { credentials: 'include' });
      const r = await resp.json();
      const data = r.data || [];
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">暂无 CAPA 记录</p>';
        return;
      }
      const typeMap = { qc_fail: 'QC 失控', customer_complaint: '客户投诉', equipment_abnormal: '设备异常', other: '其他' };
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>CAPA 编号</th>
              <th>类型</th>
              <th>问题描述</th>
              <th>责任人</th>
              <th>截止日期</th>
              <th>状态</th>
              <th>创建</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(c => `
              <tr>
                <td><code>${c.capa_no}</code></td>
                <td>${typeMap[c.problem_type] || c.problem_type}</td>
                <td><strong>${(c.problem_description || '').slice(0, 30)}${(c.problem_description || '').length > 30 ? '...' : ''}</strong></td>
                <td>${c.responsible_name || '—'}</td>
                <td>${c.deadline || '—'}</td>
                <td><span class="capa-status-pill capa-status-${c.status}">${this.statusLabel(c.status)}</span></td>
                <td>${(c.created_at || '').slice(0, 10)}</td>
                <td>
                  <button class="btn-link" onclick="capaManager.openDetail(${c.id})">详情</button>
                  <button class="btn-link danger" onclick="capaManager.delete(${c.id})">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      container.innerHTML = '<p style="color:#C04851;">加载失败：' + e.message + '</p>';
    }
  }

  statusLabel(s) {
    return { open: '待处理', in_progress: '进行中', closed: '已完成', verified: '已验证' }[s] || s;
  }

  openAdd() {
    const m = document.getElementById('modal-capa-add');
    if (m) { showModal('modal-capa-add'); return; }
    const div = document.createElement('div');
    div.id = 'modal-capa-add';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3><i data-lucide="alert-triangle"></i> 新建 CAPA</h3>
          <button class="modal-close" onclick="hideModal('modal-capa-add')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="required">问题类型</label>
            <select id="capa-type" class="form-control">
              <option value="qc_fail">QC 失控</option>
              <option value="customer_complaint">客户投诉</option>
              <option value="equipment_abnormal">设备异常</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label class="required">问题描述</label>
            <textarea id="capa-desc" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>根本原因</label>
            <textarea id="capa-root" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>纠正措施</label>
            <textarea id="capa-correct" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>预防措施</label>
            <textarea id="capa-prevent" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label>责任人</label>
              <input type="text" id="capa-owner" class="form-control" placeholder="如：张文博" />
            </div>
            <div class="form-group">
              <label>截止日期</label>
              <input type="date" id="capa-deadline" class="form-control" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="hideModal('modal-capa-add')">取消</button>
          <button class="btn btn-primary" onclick="capaManager.save()">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    showModal('modal-capa-add');
    if (window.lucide) window.lucide.createIcons();
  }

  async save() {
    const data = {
      problem_type: document.getElementById('capa-type').value,
      problem_description: document.getElementById('capa-desc').value.trim(),
      root_cause: document.getElementById('capa-root').value.trim(),
      corrective_action: document.getElementById('capa-correct').value.trim(),
      preventive_action: document.getElementById('capa-prevent').value.trim(),
      deadline: document.getElementById('capa-deadline').value,
      responsible_id: null
    };
    if (!data.problem_description) { showToast('请填写问题描述', 'warning'); return; }
    try {
      const resp = await fetch('/api/capas', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const r = await resp.json();
      if (r.success) {
        showToast('CAPA 创建成功：' + r.capa_no, 'success');
        hideModal('modal-capa-add');
        this.close();
        this.openList();
      }
    } catch (e) { showToast('错误：' + e.message, 'danger'); }
  }

  async openDetail(id) {
    try {
      const resp = await fetch('/api/capas', { credentials: 'include' });
      const r = await resp.json();
      const c = (r.data || []).find(x => x.id === id);
      if (!c) return;
      const div = document.createElement('div');
      div.id = 'modal-capa-detail';
      div.className = 'modal-overlay';
      div.innerHTML = `
        <div class="modal-box" style="max-width:700px;">
          <div class="modal-header">
            <h3><i data-lucide="alert-triangle"></i> ${c.capa_no}</h3>
            <button class="modal-close" onclick="hideModal('modal-capa-detail')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>状态</label>
              <div><span class="capa-status-pill capa-status-${c.status}">${this.statusLabel(c.status)}</span></div>
            </div>
            <div class="form-group">
              <label>问题描述</label>
              <div style="padding:8px; background:#FAF6EF; border-radius:4px;">${c.problem_description || '—'}</div>
            </div>
            <div class="form-group">
              <label>根本原因</label>
              <div style="padding:8px; background:#FAF6EF; border-radius:4px;">${c.root_cause || '—'}</div>
            </div>
            <div class="form-group">
              <label>纠正措施</label>
              <div style="padding:8px; background:#FAF6EF; border-radius:4px;">${c.corrective_action || '—'}</div>
            </div>
            <div class="form-group">
              <label>预防措施</label>
              <div style="padding:8px; background:#FAF6EF; border-radius:4px;">${c.preventive_action || '—'}</div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>责任人</label>
                <div>${c.responsible_name || '—'}</div>
              </div>
              <div class="form-group">
                <label>截止日期</label>
                <div>${c.deadline || '—'}</div>
              </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>创建</label>
                <div>${c.created_by_name || '—'}<br><small>${c.created_at}</small></div>
              </div>
              <div class="form-group">
                <label>完成时间</label>
                <div>${c.completed_at || '—'}</div>
              </div>
              <div class="form-group">
                <label>验证人</label>
                <div>${c.verified_by_name || '—'}</div>
              </div>
            </div>
            <div class="form-group">
              <label>更新状态</label>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-default" onclick="capaManager.changeStatus(${c.id}, 'in_progress')">→ 进行中</button>
                <button class="btn btn-sm btn-primary" onclick="capaManager.changeStatus(${c.id}, 'closed')">→ 已完成</button>
                <button class="btn btn-sm btn-primary" onclick="capaManager.changeStatus(${c.id}, 'verified')">→ 已验证</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" onclick="hideModal('modal-capa-detail')">关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      showModal('modal-capa-detail');
      if (window.lucide) window.lucide.createIcons();
    } catch (e) { showToast('详情加载失败', 'danger'); }
  }

  async changeStatus(id, status) {
    try {
      const resp = await fetch('/api/capas/' + id, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const r = await resp.json();
      if (r.success) {
        showToast('状态已更新：' + this.statusLabel(status), 'success');
        hideModal('modal-capa-detail');
        this.close();
        this.openList();
      }
    } catch (e) { showToast('更新失败', 'danger'); }
  }

  async delete(id) {
    if (!confirm('确定删除此 CAPA？')) return;
    try {
      const resp = await fetch('/api/capas/' + id, { method: 'DELETE', credentials: 'include' });
      const r = await resp.json();
      if (r.success) {
        showToast('已删除', 'success');
        this.loadList();
        this.loadStats();
      }
    } catch (e) { showToast('删除失败', 'danger'); }
  }
}

window.capaManager = new CAPAManager();


// 2 级审批 UI
class ApprovalManager {
  constructor() { this.modal = null; }

  openList() {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-approval-list';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:1200px; max-height:90vh; overflow:hidden; display:flex; flex-direction:column;">
        <div class="modal-header">
          <h3><i data-lucide="check-square"></i> 2 级审批工作台</h3>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="approvalManager.loadList(1)">1 级核验</button>
            <button class="btn btn-sm btn-primary" onclick="approvalManager.loadList(2)">2 级审核</button>
          </div>
          <button class="modal-close" onclick="approvalManager.close()">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1;">
          <h4 id="approval-title" style="margin:0 0 12px 0;">1 级核验待审</h4>
          <div id="approval-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="approvalManager.close()">关闭</button>
        </div>
      </div>
    `;
    showModal('modal-approval-list');
    if (window.lucide) window.lucide.createIcons();
    this.loadList(1);
  }

  close() { hideModal('modal-approval-list'); }

  async loadList(level) {
    document.getElementById('approval-title').textContent = (level === 1 ? '1 级核验' : '2 级审核') + '待审';
    const container = document.getElementById('approval-list');
    container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">加载中...</p>';
    try {
      const resp = await fetch('/api/pending/' + level, { credentials: 'include' });
      const r = await resp.json();
      const data = r.data || [];
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">暂无待审样品</p>';
        return;
      }
      // 渲染流程图 + 列表
      container.innerHTML = data.map(s => {
        // 算流程进度
        const steps = ['commission', 'acceptance', 'preparation', 'testing', 'review-l1', 'report'];
        const stepNames = ['委托', '收样', '制备', '检测', level === 1 ? '一级核验' : '二级审核', '出报告'];
        const currentIdx = steps.indexOf(s.current_stage);
        return `
          <div class="card" style="margin-bottom:12px; padding:14px 18px; border:1px solid #E5DFD0; border-radius:8px; background:#fff;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <div>
                <strong style="font-size:15px;">${s.sample_code}</strong>
                <span style="color:#8B7355; margin-left:8px;">${s.sample_name || '—'}</span>
              </div>
              <div>
                <button class="btn btn-sm btn-primary" onclick="approvalManager.openVerify(${s.id}, ${level})">
                  <i data-lucide="check"></i> ${level === 1 ? '核验' : '审核'}
                </button>
              </div>
            </div>
            <div class="approval-flow">
              ${steps.map((step, i) => `
                <div class="approval-step ${i < currentIdx ? 'approved' : (i === currentIdx ? 'current' : '')}">
                  <div class="step-num">${i + 1}</div>
                  <div class="step-label">${stepNames[i]}</div>
                </div>
                ${i < steps.length - 1 ? '<span class="approval-arrow">→</span>' : ''}
              `).join('')}
            </div>
            <div style="font-size:12px; color:#8B7355; margin-top:8px;">
              客户：${s.client_name_full || s.client_name || '—'} |
              收样日期：${s.received_date || '—'} |
              检测员：${s.analyst_name || '—'}
            </div>
          </div>
        `;
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      container.innerHTML = '<p style="color:#C04851;">加载失败：' + e.message + '</p>';
    }
  }

  async openVerify(sampleId, level) {
    const div = document.createElement('div');
    div.id = 'modal-approval-action';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3><i data-lucide="check-circle"></i> ${level === 1 ? '一级核验' : '二级审核'}：样品 #${sampleId}</h3>
          <button class="modal-close" onclick="hideModal('modal-approval-action')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>${level === 1 ? '核验' : '审核'}意见（必填）</label>
            <textarea id="approval-comment" class="form-control" rows="4" placeholder="详细说明核验/审核意见..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="hideModal('modal-approval-action')">取消</button>
          <button class="btn btn-danger" onclick="approvalManager.submit(${sampleId}, ${level}, 'rejected')">
            <i data-lucide="x"></i> 驳回
          </button>
          <button class="btn btn-primary" onclick="approvalManager.submit(${sampleId}, ${level}, 'approved')">
            <i data-lucide="check"></i> 通过
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    showModal('modal-approval-action');
    if (window.lucide) window.lucide.createIcons();
  }

  async submit(sampleId, level, decision) {
    const comment = document.getElementById('approval-comment').value.trim();
    if (!comment) { showToast('请填写审批意见', 'warning'); return; }
    const endpoint = level === 1 ? '/api/workflow/samples/' + sampleId + '/verify-l1' : '/api/workflow/samples/' + sampleId + '/verify-l2';
    try {
      const resp = await fetch(endpoint, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment })
      });
      const r = await resp.json();
      if (r.success) {
        showToast(decision === 'approved' ? '✓ 通过' : '✗ 驳回' + '，样品进入' + (r.new_stage || '下一阶段'), 'success');
        hideModal('modal-approval-action');
        this.loadList(level);
      } else {
        showToast('操作失败：' + (r.error || ''), 'danger');
      }
    } catch (e) { showToast('错误：' + e.message, 'danger'); }
  }
}

window.approvalManager = new ApprovalManager();

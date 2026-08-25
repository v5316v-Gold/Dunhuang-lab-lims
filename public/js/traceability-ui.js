
/**
 * 2026-08-11 阶段 4 - 全流程溯源前端 UI
 * 一站式查看：委托 → 收样 → 检测 → 质控 → 核验 → 报告
 */
class TraceabilityManager {
  constructor() { this.modal = null; }

  openManager() {
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-traceability';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width:1200px; max-height:92vh; overflow:hidden; display:flex; flex-direction:column;">
        <div class="modal-header">
          <h3><i data-lucide="link"></i> 全流程溯源（阶段 4 节点 11）</h3>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <input type="text" id="trace-search" class="form-control" placeholder="输入委托号 / 样品号" style="height:32px;padding:4px 10px;font-size:13px;width:200px;" />
            <button class="btn btn-sm btn-primary" onclick="traceabilityMgr.search()">
              <i data-lucide="search"></i> 搜索
            </button>
          </div>
          <button class="modal-close" onclick="traceabilityMgr.close()">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y:auto; flex:1;">
          <div id="trace-summary-list"></div>
        </div>
        <div class="modal-footer">
          <span style="color:#8B7355;font-size:13px;margin-right:auto;">
            一站式查看委托→收样→检测→质控→核验→报告
          </span>
          <button class="btn btn-default" onclick="traceabilityMgr.close()">关闭</button>
        </div>
      </div>
    `;
    showModal('modal-traceability');
    if (window.lucide) window.lucide.createIcons();
    this.loadSummary();
  }

  close() { hideModal('modal-traceability'); }

  async loadSummary() {
    try {
      const resp = await fetch('/api/traceability/list/summary', { credentials: 'include' });
      const r = await resp.json();
      const data = r.data || [];
      const container = document.getElementById('trace-summary-list');
      if (!container) return;
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:40px;">暂无委托数据</p>';
        return;
      }
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>委托号</th>
              <th>项目名称</th>
              <th>客户</th>
              <th>样品数</th>
              <th>状态</th>
              <th>当前阶段</th>
              <th>价格</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(p => `
              <tr>
                <td><code>${p.project_no}</code></td>
                <td>${p.project_name || '—'}</td>
                <td>${p.client_name || '—'}</td>
                <td>${p.sample_count || 0}</td>
                <td><span class="tag tag-${p.status === 'completed' ? 'success' : (p.status === 'rejected' ? 'danger' : 'info')}">${p.status || '—'}</span></td>
                <td>${p.current_stage || '—'}</td>
                <td>¥ ${(p.price || 0).toLocaleString()}</td>
                <td>${(p.created_at || '').slice(0, 10)}</td>
                <td><button class="btn-link" onclick="traceabilityMgr.viewDetail('${p.id}')">查看完整链路</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      showToast('加载失败：' + e.message, 'danger');
    }
  }

  async search() {
    const kw = document.getElementById('trace-search').value.trim();
    if (!kw) { showToast('请输入委托号或样品号', 'warning'); return; }
    this.viewDetail(kw);
  }

  async viewDetail(identifier) {
    try {
      const resp = await fetch('/api/traceability/' + identifier, { credentials: 'include' });
      const r = await resp.json();
      if (!r.success) { showToast(r.error || '未找到', 'warning'); return; }
      this.renderDetail(r.data);
    } catch (e) { showToast('查询失败：' + e.message, 'danger'); }
  }

  renderDetail(data) {
    const container = document.getElementById('trace-summary-list');
    if (!container) return;
    const s = data.summary;
    const st = data.stats;

    const stageMap = {
      'draft': '草稿', 'submitted': '已提交', 'approved': '已批准', 'assigned': '已分派',
      'testing': '检测中', 'review-l1': '一级核验', 'report': '出报告', 'completed': '已完成',
      'rejected': '已驳回'
    };

    container.innerHTML = `
      <!-- 基本信息 -->
      <div class="card" style="background:linear-gradient(135deg,#FAF6EF 0%,#fff 100%);padding:16px;margin-bottom:12px;border:1px solid #E5DFD0;border-radius:8px;border-left:4px solid #C9A96E;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#3D2B1F;">
          <i data-lucide="file-text"></i> ${s.project_name || s.project_no}
        </h3>
        <div style="font-size:12px;color:#8B7355;">委托号：${s.project_no}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin-top:12px;font-size:13px;">
          <div><strong style="color:#8B7355;">客户：</strong>${s.client_name || '—'}</div>
          <div><strong style="color:#8B7355;">检测方法：</strong>${s.method_type || '—'}</div>
          <div><strong style="color:#8B7355;">状态：</strong><span class="tag tag-info">${stageMap[s.current_stage] || s.current_stage || s.status || '—'}</span></div>
          <div><strong style="color:#8B7355;">价格：</strong>¥ ${(s.price || 0).toLocaleString()}（${s.payment_status || 'unpaid'}）</div>
          <div><strong style="color:#8B7355;">委托时间：</strong>${(s.created_at || '').slice(0, 16).replace('T', ' ')}</div>
          <div><strong style="color:#8B7355;">审批时间：</strong>${(s.approved_at || '').slice(0, 16).replace('T', ' ')}</div>
        </div>
        <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #E5DFD0;font-size:12px;color:#8B7355;">
          统计：${st.total_stages} 阶段 · ${st.total_approvals} 审批 · ${st.total_qc} 质控（合格率 ${st.qc_pass_rate}%） · ${st.total_uncertainty} 不确定度 · ${st.total_retests} 复检 · ${st.total_retains} 留样 · ${st.total_capas} CAPA
        </div>
      </div>

      <!-- 流程时间轴 -->
      <h4 style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;"><i data-lucide="clock"></i> 工作流时间轴</h4>
      <ul class="approval-timeline" style="background:#fff;padding:16px;border:1px solid #E5DFD0;border-radius:8px;margin-bottom:16px;">
        ${data.workflow.length > 0 ? data.workflow.map(w => `
          <li>
            <div class="timeline-time">${(w.action_date || '').slice(0, 16).replace('T', ' ')}</div>
            <div class="timeline-actor"><strong>${w.user_name || '—'}</strong>: ${w.from_stage || '初始'} → ${w.to_stage}</div>
          </li>
        `).join('') : '<li><div class="timeline-meta">暂无流转记录</div></li>'}
      </ul>

      <!-- 审批记录 -->
      <h4 style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;"><i data-lucide="check-square"></i> 审批记录（${data.approvals.length}）</h4>
      <ul class="approval-timeline" style="background:#fff;padding:16px;border:1px solid #E5DFD0;border-radius:8px;margin-bottom:16px;">
        ${data.approvals.length > 0 ? data.approvals.map(a => `
          <li class="${a.decision}">
            <div class="timeline-time">${(a.created_at || '').slice(0, 16).replace('T', ' ')} · ${a.approval_role || a.approval_level}</div>
            <div class="timeline-actor"><strong>${a.approver_name || '—'}</strong>: ${a.decision === 'approved' ? '✓ 通过' : a.decision === 'rejected' ? '✗ 驳回' : a.decision}</div>
            ${a.comment ? `<div class="timeline-comment">${a.comment}</div>` : ''}
          </li>
        `).join('') : '<li><div class="timeline-meta">暂无审批记录</div></li>'}
      </ul>

      <!-- 质控数据 -->
      <h4 style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;"><i data-lucide="check-circle"></i> 质控记录（${data.qc.length}）</h4>
      ${data.qc.length > 0 ? `
        <table class="data-table" style="margin-bottom:16px;">
          <thead><tr><th>编号</th><th>名称</th><th>类型</th><th>标称</th><th>实测</th><th>偏差%</th><th>规则</th><th>判定</th></tr></thead>
          <tbody>
            ${data.qc.map(q => `
              <tr>
                <td><code>${q.qc_no}</code></td>
                <td>${q.qc_name}</td>
                <td>${q.qc_type}</td>
                <td>${q.expected_value} ${q.unit || ''}</td>
                <td><strong>${q.measured_value}</strong></td>
                <td>${(q.deviation_percent || 0).toFixed(2)}%</td>
                <td style="color:#C04851;">${q.rule_violated || '—'}</td>
                <td><span class="tag tag-${q.judgement === 'pass' ? 'success' : (q.judgement === 're' ? 'danger' : 'warning')}">${q.judgement}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#8B7355;padding:8px 16px;">暂无质控记录</p>'}

      <!-- 不确定度 -->
      <h4 style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;"><i data-lucide="sigma"></i> 测量不确定度（${data.uncertainty.length}）</h4>
      ${data.uncertainty.length > 0 ? `
        <table class="data-table" style="margin-bottom:16px;">
          <thead><tr><th>参数</th><th>测量值</th><th>u_A</th><th>u_B</th><th>u_c</th><th>k</th><th>U</th><th>U_rel%</th></tr></thead>
          <tbody>
            ${data.uncertainty.map(u => `
              <tr>
                <td>${u.parameter_name}</td>
                <td>${u.measurement_value} ${u.unit || ''}</td>
                <td>${(u.type_a_uncertainty || 0).toFixed(4)}</td>
                <td>${(u.type_b_uncertainty || 0).toFixed(4)}</td>
                <td><strong>${(u.combined_uncertainty || 0).toFixed(4)}</strong></td>
                <td>${u.coverage_factor}</td>
                <td><strong>${(u.expanded_uncertainty || 0).toFixed(4)}</strong></td>
                <td>${(u.relative_uncertainty || 0).toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#8B7355;padding:8px 16px;">暂无不确定度记录</p>'}

      <!-- 复检 / 留样 / CAPA -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="card" style="padding:12px;background:#fff;border:1px solid #E5DFD0;border-radius:8px;">
          <h5 style="margin:0 0 8px;font-size:13px;color:#3D2B1F;">🔄 复检（${data.retests.length}）</h5>
          ${data.retests.length === 0 ? '<p style="font-size:12px;color:#8B7355;">无</p>' :
            data.retests.map(r => `<div style="font-size:12px;padding:4px 0;"><code>${r.retest_no}</code> - ${r.retest_reason}<br><small style="color:#8B7355;">${r.judgement || '—'}</small></div>`).join('')
          }
        </div>
        <div class="card" style="padding:12px;background:#fff;border:1px solid #E5DFD0;border-radius:8px;">
          <h5 style="margin:0 0 8px;font-size:13px;color:#3D2B1F;">📦 留样（${data.retains.length}）</h5>
          ${data.retains.length === 0 ? '<p style="font-size:12px;color:#8B7355;">无</p>' :
            data.retains.map(r => `<div style="font-size:12px;padding:4px 0;"><code>${r.retain_code}</code><br><small style="color:#8B7355;">${r.storage_location || '—'} · ${r.destroy_status || '—'}</small></div>`).join('')
          }
        </div>
        <div class="card" style="padding:12px;background:#fff;border:1px solid #E5DFD0;border-radius:8px;">
          <h5 style="margin:0 0 8px;font-size:13px;color:#3D2B1F;">⚠️ CAPA（${data.capas.length}）</h5>
          ${data.capas.length === 0 ? '<p style="font-size:12px;color:#8B7355;">无</p>' :
            data.capas.map(c => `<div style="font-size:12px;padding:4px 0;"><code>${c.capa_no}</code> - ${(c.problem_description || '').slice(0, 20)}<br><span class="capa-status-pill capa-status-${c.status}">${c.status}</span></div>`).join('')
          }
        </div>
      </div>

      <!-- 操作 -->
      <div style="text-align:center;margin-top:20px;">
        <button class="btn btn-primary" onclick="window.open('/api/public/report/${s.project_no}')">
          <i data-lucide="download"></i> 下载完整报告
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

window.traceabilityMgr = new TraceabilityManager();

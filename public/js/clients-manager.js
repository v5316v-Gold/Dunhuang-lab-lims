
/**
 * 2026-08-11 P0 客户管理 UI（节点 1）
 */
class ClientsManager {
  constructor() {
    this.modal = null;
  }

  openModal(client = null) {
    this.currentClient = client;
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'modal-clients';
      this.modal.className = 'modal-overlay';
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3><i data-lucide="building"></i> ${client ? '编辑客户' : '新增客户'}</h3>
          <button class="modal-close" onclick="clientsManager.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-client" onsubmit="return false">
            <div class="form-group">
              <label class="required">客户名称</label>
              <input type="text" id="client-name" class="form-control" required value="${client ? client.client_name || '' : ''}" />
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>联系人</label>
                <input type="text" id="client-contact" class="form-control" value="${client ? client.contact_person || '' : ''}" />
              </div>
              <div class="form-group">
                <label>联系电话</label>
                <input type="tel" id="client-phone" class="form-control" value="${client ? client.contact_phone || '' : ''}" />
              </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>邮箱</label>
                <input type="email" id="client-email" class="form-control" value="${client ? client.contact_email || '' : ''}" />
              </div>
              <div class="form-group">
                <label>类型</label>
                <select id="client-type" class="form-control">
                  <option value="company" ${client && client.client_type === 'company' ? 'selected' : ''}>企业</option>
                  <option value="personnel" ${client && client.client_type === 'personnel' ? 'selected' : ''}>个人</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>地址</label>
              <input type="text" id="client-address" class="form-control" value="${client ? client.address || '' : ''}" />
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>信用等级</label>
                <select id="client-credit" class="form-control">
                  <option value="A" ${client && client.credit_level === 'A' ? 'selected' : ''}>A 级（VIP）</option>
                  <option value="B" ${!client || client.credit_level === 'B' ? 'selected' : ''}>B 级（标准）</option>
                  <option value="C" ${client && client.credit_level === 'C' ? 'selected' : ''}>C 级（关注）</option>
                  <option value="D" ${client && client.credit_level === 'D' ? 'selected' : ''}>D 级（风险）</option>
                </select>
              </div>
              <div class="form-group">
                <label>状态</label>
                <select id="client-status" class="form-control">
                  <option value="active" ${!client || client.status === 'active' ? 'selected' : ''}>启用</option>
                  <option value="inactive" ${client && client.status === 'inactive' ? 'selected' : ''}>停用</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>备注</label>
              <textarea id="client-remark" class="form-control" rows="2">${client ? client.remark || '' : ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onclick="clientsManager.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="clientsManager.save()">
            <i data-lucide="save"></i> 保存
          </button>
        </div>
      </div>
    `;
    showModal('modal-clients');
    if (window.lucide) window.lucide.createIcons();
  }

  closeModal() { hideModal('modal-clients'); }

  async save() {
    const data = {
      client_name: document.getElementById('client-name').value.trim(),
      contact_person: document.getElementById('client-contact').value.trim(),
      contact_phone: document.getElementById('client-phone').value.trim(),
      contact_email: document.getElementById('client-email').value.trim(),
      address: document.getElementById('client-address').value.trim(),
      client_type: document.getElementById('client-type').value,
      credit_level: document.getElementById('client-credit').value,
      status: document.getElementById('client-status').value,
      remark: document.getElementById('client-remark').value.trim()
    };
    if (!data.client_name) { showToast('请输入客户名称', 'warning'); return; }
    try {
      const url = this.currentClient ? `/api/clients/${this.currentClient.id}` : '/api/clients';
      const method = this.currentClient ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();
      if (result.success) {
        showToast(this.currentClient ? '客户更新成功' : '客户创建成功：' + (result.client_code || ''), 'success');
        this.closeModal();
        this.render();
      } else {
        showToast('保存失败：' + (result.error || ''), 'danger');
      }
    } catch (e) {
      showToast('网络错误：' + e.message, 'danger');
    }
  }

  async render() {
    const container = document.getElementById('clients-list');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">加载中...</p>';
    try {
      const resp = await fetch('/api/clients', { credentials: 'include' });
      const result = await resp.json();
      if (!result.success || !result.data || result.data.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#8B7355;padding:20px;">暂无客户记录</p>';
        return;
      }
      const tagMap = { A: 'success', B: 'info', C: 'warning', D: 'danger' };
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>客户编号</th>
              <th>客户名称</th>
              <th>联系人</th>
              <th>电话</th>
              <th>类型</th>
              <th>信用</th>
              <th>历史委托</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${result.data.map(c => `
              <tr>
                <td><code>${c.client_code}</code></td>
                <td><strong>${c.client_name}</strong></td>
                <td>${c.contact_person || '-'}</td>
                <td>${c.contact_phone || '-'}</td>
                <td>${c.client_type === 'company' ? '企业' : '个人'}</td>
                <td><span class="tag tag-${tagMap[c.credit_level] || 'info'}">${c.credit_level || '-'}</span></td>
                <td>${c.total_orders || 0}</td>
                <td><span class="tag tag-${c.status === 'active' ? 'success' : 'neutral'}">${c.status === 'active' ? '启用' : '停用'}</span></td>
                <td>
                  <button class="btn-link" onclick="clientsManager.openModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">编辑</button>
                  <button class="btn-link danger" onclick="clientsManager.delete(${c.id})">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      container.innerHTML = '<p style="text-align:center;color:#C04851;padding:20px;">加载失败：' + e.message + '</p>';
    }
  }

  async delete(id) {
    if (!confirm('确定删除此客户？相关项目不会被删除。')) return;
    try {
      const resp = await fetch('/api/clients/' + id, { method: 'DELETE', credentials: 'include' });
      const result = await resp.json();
      if (result.success) {
        showToast('已删除', 'success');
        this.render();
      } else {
        showToast('删除失败：' + result.error, 'danger');
      }
    } catch (e) {
      showToast('网络错误：' + e.message, 'danger');
    }
  }
}

window.clientsManager = new ClientsManager();


/**
 * 2026-08-11 UI 改进 — 通用组件 JS 库
 * 包含：消息中心、高级筛选器、批量操作、状态 Tag、附件上传
 */

// ============================================================
// 1. 消息中心 (P0-3)
// ============================================================
const MessageCenter = (function() {
  let panel = null;
  let isOpen = false;

  // 模拟数据（实际从后端 API 获取）
  const MOCK_MESSAGES = {
    todo: [
      { id: 1, icon: 'clipboard-list', iconType: 'todo', title: '设备 EQ-005 校准已到期', meta: '2 小时前 · 设备校准', unread: true, actionText: '去处理' },
      { id: 2, icon: 'flask-conical', iconType: 'todo', title: '3 个样品等待检测', meta: '今天 09:15 · 样品预约', unread: true, actionText: '查看' },
      { id: 3, icon: 'file-text', iconType: 'todo', title: '检测报告 REP-2026-008 需审核', meta: '昨天 16:30 · 报告审核', unread: false, actionText: '审核' },
      { id: 4, icon: 'users', iconType: 'todo', title: '5 名新员工待分配岗位', meta: '昨天 14:20 · 人员管理', unread: false, actionText: '分配' }
    ],
    alert: [
      { id: 5, icon: 'alert-triangle', iconType: 'alert', title: '设备 EQ-018 温度超限报警', meta: '30 分钟前 · 设备监控', unread: true, actionText: '查看' },
      { id: 6, icon: 'package', iconType: 'alert', title: '试剂 R-2024-018 即将过期（30 天）', meta: '1 小时前 · 试剂库存', unread: true, actionText: '处理' },
      { id: 7, icon: 'beaker', iconType: 'alert', title: '玻璃器皿 G-2023-105 破损待处理', meta: '3 小时前 · 玻璃器皿', unread: false, actionText: '查看' }
    ],
    system: [
      { id: 8, icon: 'check-circle', iconType: 'success', title: '数据备份成功（2026-08-11 02:00）', meta: '今早 02:00 · 系统', unread: false },
      { id: 9, icon: 'user-check', iconType: 'success', title: '张文博 已通过审核员资质', meta: '昨天 · 资质管理', unread: false }
    ]
  };

  function render() {
    const unreadCount = MOCK_MESSAGES.todo.filter(m => m.unread).length +
                       MOCK_MESSAGES.alert.filter(m => m.unread).length;

    panel = document.createElement('div');
    panel.className = 'msg-center-panel';
    panel.innerHTML = `
      <div class="msg-center-header">
        <h3>消息中心</h3>
        <button class="btn-link" onclick="MessageCenter.markAllRead()">全部已读</button>
      </div>
      <div class="msg-center-tabs">
        <button class="tab active" data-type="todo">待办 <span class="badge">${MOCK_MESSAGES.todo.filter(m=>m.unread).length}</span></button>
        <button class="tab" data-type="alert">预警 <span class="badge">${MOCK_MESSAGES.alert.filter(m=>m.unread).length}</span></button>
        <button class="tab" data-type="system">系统</button>
      </div>
      <div class="msg-center-list" id="msg-list"></div>
      <div class="msg-center-footer">
        <a onclick="MessageCenter.viewAll()">查看全部消息 →</a>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelectorAll('.msg-center-tabs .tab').forEach(tab => {
      tab.addEventListener('click', function() {
        panel.querySelectorAll('.msg-center-tabs .tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        renderList(this.dataset.type);
      });
    });

    const bell = document.querySelector('.home-action-btn[title="消息中心"]');
    if (bell && unreadCount > 0) bell.classList.add('has-unread');

    renderList('todo');
  }

  function renderList(type) {
    const list = panel.querySelector('#msg-list');
    const msgs = MOCK_MESSAGES[type] || [];
    if (msgs.length === 0) {
      list.innerHTML = '<div class="msg-empty"><i data-lucide="inbox" style="width:48px;height:48px;"></i>暂无消息</div>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    list.innerHTML = msgs.map(m => `
      <div class="msg-item ${m.unread ? 'unread' : ''}" data-id="${m.id}">
        <div class="msg-icon ${m.iconType}"><i data-lucide="${m.icon}" style="width:16px;height:16px;"></i></div>
        <div class="msg-body">
          <div class="msg-title">${m.title}</div>
          <div class="msg-meta">${m.meta}</div>
        </div>
        ${m.actionText ? `<button class="msg-action" onclick="MessageCenter.handleAction(${m.id}, event)">${m.actionText}</button>` : ''}
      </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();

    list.querySelectorAll('.msg-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.msg-action')) return;
        this.classList.remove('unread');
        const id = parseInt(this.dataset.id);
        for (const type in MOCK_MESSAGES) {
          const m = MOCK_MESSAGES[type].find(x => x.id === id);
          if (m) m.unread = false;
        }
      });
    });
  }

  function toggle() {
    if (isOpen) { close(); return; }
    if (!panel) render();
    panel.classList.add('active');
    isOpen = true;
    setTimeout(() => document.addEventListener('click', outsideClick), 10);
  }

  function close() {
    if (panel) panel.classList.remove('active');
    isOpen = false;
    document.removeEventListener('click', outsideClick);
  }

  function outsideClick(e) {
    if (panel && !panel.contains(e.target) && !e.target.closest('.home-action-btn[title="消息中心"]')) {
      close();
    }
  }

  function markAllRead() {
    for (const type in MOCK_MESSAGES) {
      MOCK_MESSAGES[type].forEach(m => m.unread = false);
    }
    const bell = document.querySelector('.home-action-btn[title="消息中心"]');
    if (bell) bell.classList.remove('has-unread');
    if (panel) {
      panel.querySelectorAll('.msg-center-tabs .badge').forEach(b => b.remove());
      renderList(panel.querySelector('.tab.active').dataset.type);
    }
    showToast('已全部标记为已读', 'success');
  }

  function handleAction(id, e) {
    e.stopPropagation();
    showToast('处理中...', 'info');
    setTimeout(() => { showToast('处理完成', 'success'); close(); }, 500);
  }

  function viewAll() { showToast('消息历史页面（待实现）', 'info'); }

  // 接受外部注入的实时预警
  let _extAlerts = [];
  function _injectAlerts(alerts) {
    if (!alerts || alerts.length === 0) return;
    _extAlerts = alerts;
    // 更新 MOCK_MESSAGES.alert + todo
    MOCK_MESSAGES.alert = alerts.filter(a => a.type === 'alert').map((a, i) => ({
      id: 1000 + i,
      icon: a.icon || 'alert-triangle',
      iconType: 'alert',
      title: a.title,
      meta: a.category + ' · ' + a.desc,
      unread: true,
      actionText: a.action || '查看'
    }));
    MOCK_MESSAGES.todo = alerts.filter(a => a.type === 'todo').map((a, i) => ({
      id: 2000 + i,
      icon: a.icon || 'clock',
      iconType: 'todo',
      title: a.title,
      meta: a.category + ' · ' + a.desc,
      unread: true,
      actionText: a.action || '查看'
    }));

    // 重新渲染（如果面板打开）
    if (panel && isOpen) {
      const activeTab = panel.querySelector('.tab.active');
      if (activeTab) renderList(activeTab.dataset.type);
      // 更新 tabs badge
      const tabs = panel.querySelectorAll('.msg-center-tabs .tab');
      tabs.forEach(t => {
        const type = t.dataset.type;
        const unread = MOCK_MESSAGES[type] ? MOCK_MESSAGES[type].filter(m => m.unread).length : 0;
        let badge = t.querySelector('.badge');
        if (unread > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            t.appendChild(badge);
          }
          badge.textContent = unread;
        } else if (badge) {
          badge.remove();
        }
      });
    }
  }

  return { toggle, close, markAllRead, handleAction, viewAll, render, _injectAlerts };
})();

document.addEventListener('DOMContentLoaded', function() {
  const bell = document.querySelector('.home-action-btn[title="消息中心"]');
  if (bell) {
    bell.addEventListener('click', function(e) {
      e.stopPropagation();
      MessageCenter.toggle();
    });
  }
});


// ============================================================
// 2. 高级筛选器 (P0-6)
// ============================================================
class AdvancedFilter {
  constructor(container, options) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = options;
    this.values = {};
    this.render();
  }

  render() {
    const self = this;
    const html = `
      <div class="filter-bar">
        ${this.options.fields.map(field => this.renderField(field)).join('')}
        <div class="filter-group" style="margin-left:auto;">
          <button class="btn btn-sm btn-primary" data-action="apply">
            <i data-lucide="search" style="width:14px;height:14px;"></i> 查询
          </button>
          <button class="btn btn-sm btn-default" data-action="reset">
            <i data-lucide="x" style="width:14px;height:14px;"></i> 重置
          </button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    this.container.querySelector('[data-action="apply"]').addEventListener('click', () => self.apply());
    this.container.querySelector('[data-action="reset"]').addEventListener('click', () => self.reset());
    if (window.lucide) window.lucide.createIcons();
  }

  renderField(field) {
    let input = '';
    switch (field.type) {
      case 'text':
        input = `<input type="text" class="form-control" data-field="${field.key}" placeholder="${field.placeholder || field.label}" />`;
        break;
      case 'select':
        input = `
          <select class="form-control" data-field="${field.key}">
            <option value="">${field.placeholder || '全部'}</option>
            ${field.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        `;
        break;
      case 'date':
        input = `<input type="date" class="form-control" data-field="${field.key}" placeholder="${field.placeholder || field.label}" />`;
        break;
      case 'daterange':
        input = `
          <input type="date" class="form-control" data-field="${field.key}_start" placeholder="开始日期" />
          <span style="color:#999;">~</span>
          <input type="date" class="form-control" data-field="${field.key}_end" placeholder="结束日期" />
        `;
        break;
    }
    return `
      <div class="filter-group">
        ${field.label ? `<label>${field.label}:</label>` : ''}
        ${input}
      </div>
    `;
  }

  apply() {
    const inputs = this.container.querySelectorAll('[data-field]');
    const values = {};
    inputs.forEach(input => { if (input.value) values[input.dataset.field] = input.value; });
    this.values = values;
    if (this.options.onChange) this.options.onChange(values);
  }

  reset() {
    this.container.querySelectorAll('[data-field]').forEach(input => {
      if (input.tagName === 'SELECT') input.selectedIndex = 0;
      else input.value = '';
    });
    this.values = {};
    if (this.options.onChange) this.options.onChange({});
  }

  getValues() { return this.values; }
}


// ============================================================
// 3. 批量操作 (P0-7)
// ============================================================
class BatchOperations {
  constructor(tableSelector, batchBarSelector, options = {}) {
    this.table = typeof tableSelector === 'string' ? document.querySelector(tableSelector) : tableSelector;
    this.batchBar = typeof batchBarSelector === 'string' ? document.querySelector(batchBarSelector) : batchBarSelector;
    this.options = options;
    this.selectedIds = new Set();
    window.__batchInstance = this;
    this.bindEvents();
  }

  bindEvents() {
    const checkAll = this.table.querySelector('thead input[type="checkbox"][data-check-all]');
    if (checkAll) {
      checkAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        this.table.querySelectorAll('tbody input[type="checkbox"][data-id]').forEach(cb => {
          cb.checked = checked;
          if (checked) this.selectedIds.add(cb.dataset.id);
          else this.selectedIds.delete(cb.dataset.id);
        });
        this.updateBatchBar();
      });
    }
    this.table.querySelectorAll('tbody input[type="checkbox"][data-id]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) this.selectedIds.add(e.target.dataset.id);
        else this.selectedIds.delete(e.target.dataset.id);
        this.updateBatchBar();
      });
    });
  }

  updateBatchBar() {
    const count = this.selectedIds.size;
    if (count === 0) { this.batchBar.classList.remove('active'); return; }
    this.batchBar.classList.add('active');
    this.batchBar.innerHTML = `
      <span class="selected-count">已选 <strong>${count}</strong> 项</span>
      <div class="batch-actions">
        ${this.options.actions ? this.options.actions.map(a => `
          <button class="btn btn-sm ${a.class || 'btn-default'}" data-batch-action="${a.handler}">
            <i data-lucide="${a.icon || 'check'}" style="width:14px;height:14px;"></i> ${a.label}
          </button>
        `).join('') : ''}
        <button class="btn btn-sm btn-default" data-batch-action="clearSelection">取消选择</button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    this.batchBar.querySelectorAll('[data-batch-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.batchAction;
        if (typeof this[action] === 'function') this[action]();
        else if (this.options.customActions && this.options.customActions[action]) this.options.customActions[action](this.getSelectedIds());
      });
    });
  }

  getSelectedIds() { return Array.from(this.selectedIds); }

  clearSelection() {
    this.selectedIds.clear();
    this.table.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    this.updateBatchBar();
  }

  batchDelete() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm('确定要删除选中的 ' + ids.length + ' 项吗？')) return;
    showToast('已删除 ' + ids.length + ' 项', 'success');
    this.clearSelection();
    if (this.options.onDelete) this.options.onDelete(ids);
  }

  batchExport() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    showToast('导出 ' + ids.length + ' 项...', 'info');
    if (this.options.onExport) this.options.onExport(ids);
  }
}


// ============================================================
// 4. 状态彩色 Tag (P0-8)
// ============================================================
function statusTag(status) {
  const map = {
    '正常': { type: 'success', icon: 'check-circle' },
    'normal': { type: 'success', icon: 'check-circle' },
    'active': { type: 'success', icon: 'check-circle' },
    '在用': { type: 'info', icon: 'activity' },
    '维护中': { type: 'warning', icon: 'tool' },
    'maintenance': { type: 'warning', icon: 'tool' },
    '校准中': { type: 'info', icon: 'crosshair' },
    'calibration': { type: 'info', icon: 'crosshair' },
    '已报废': { type: 'danger', icon: 'x-circle' },
    'scrapped': { type: 'danger', icon: 'x-circle' },
    '损坏': { type: 'danger', icon: 'alert-triangle' },
    'broken': { type: 'danger', icon: 'alert-triangle' },
    '待审核': { type: 'warning', icon: 'clock' },
    '已审核': { type: 'success', icon: 'check' },
    '已完成': { type: 'success', icon: 'check-circle' },
    '进行中': { type: 'info', icon: 'loader' },
    '已逾期': { type: 'danger', icon: 'alert-octagon' },
    '即将到期': { type: 'warning', icon: 'alert-triangle' },
    '即将过期': { type: 'warning', icon: 'clock' },
    '已过期': { type: 'danger', icon: 'x-circle' },
    '未提交': { type: 'neutral', icon: 'edit' },
    '已提交': { type: 'info', icon: 'send' },
    '合格': { type: 'success', icon: 'check' },
    '不合格': { type: 'danger', icon: 'x' }
  };
  const cfg = map[status] || { type: 'neutral', icon: 'circle' };
  return '<span class="tag tag-' + cfg.type + '"><i data-lucide="' + cfg.icon + '" style="width:12px;height:12px;"></i> ' + status + '</span>';
}


// ============================================================
// 5. 附件上传 (P0-10)
// ============================================================
class FileUpload {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container.id) this.container.id = 'file-upload-' + Date.now();
    this.options = Object.assign({ maxSize: 10 * 1024 * 1024, maxFiles: 5 }, options);
    this.files = [];
    this.render();
  }

  render() {
    const self = this;
    this.container.innerHTML = `
      <div class="file-upload">
        <div class="file-upload-area">
          <i data-lucide="upload-cloud" style="width:36px;height:36px;"></i>
          <p><strong>点击或拖拽文件到此处上传</strong></p>
          <p>支持 PDF / Word / Excel / 图片，单文件最大 10MB，最多 ${this.options.maxFiles} 个</p>
          <input type="file" multiple style="display:none;" />
        </div>
        <div class="file-list"></div>
      </div>
    `;
    const area = this.container.querySelector('.file-upload-area');
    const input = this.container.querySelector('input[type="file"]');
    if (window.lucide) window.lucide.createIcons();

    area.addEventListener('click', () => input.click());
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      self.addFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', (e) => {
      self.addFiles(e.target.files);
      input.value = '';
    });
  }

  addFiles(fileList) {
    for (const file of fileList) {
      if (this.files.length >= this.options.maxFiles) {
        showToast('最多只能上传 ' + this.options.maxFiles + ' 个文件', 'warning');
        break;
      }
      if (file.size > this.options.maxSize) {
        showToast(file.name + ' 超过 10MB', 'danger');
        continue;
      }
      this.files.push(file);
    }
    this.renderList();
  }

  renderList() {
    const list = this.container.querySelector('.file-list');
    const self = this;
    list.innerHTML = this.files.map((f, i) => `
      <div class="file-item">
        <i data-lucide="file" style="width:16px;height:16px;color:#8B6914;"></i>
        <span class="file-name">${f.name}</span>
        <span class="file-size">${(f.size / 1024).toFixed(1)} KB</span>
        <button class="file-remove" data-idx="${i}">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
    list.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        self.remove(idx);
      });
    });
  }

  remove(i) { this.files.splice(i, 1); this.renderList(); }
  getFiles() { return this.files; }
  clear() { this.files = []; this.renderList(); }
}


// ============================================================
// 6. 全局 Toast
// ============================================================
// 增强错误提示（长消息、含标题和提示）
function showError(title, message, hint) {
  type = 'danger';
  duration = 5000;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'background:#fff;border-left:4px solid #C04851;box-shadow:0 4px 16px rgba(192,72,81,0.2);border-radius:8px;padding:12px 16px;min-width:320px;max-width:420px;font-size:13px;color:#3D2B1F;animation:slideIn 0.2s ease;';
  toast.innerHTML = '<div style="display:flex;align-items:start;gap:10px;">'
    + '<i data-lucide="alert-circle" style="width:20px;height:20px;color:#C04851;flex-shrink:0;margin-top:2px;"></i>'
    + '<div style="flex:1;">'
    + '<div style="font-weight:600;color:#C04851;margin-bottom:4px;">' + (title || '操作失败') + '</div>'
    + '<div style="color:#3D2B1F;line-height:1.5;">' + (message || '') + '</div>'
    + (hint ? '<div style="color:#8B7355;font-size:12px;margin-top:6px;font-style:italic;">💡 ' + hint + '</div>' : '')
    + '</div></div>';
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 2500;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const icons = { success: 'check-circle', danger: 'x-circle', warning: 'alert-triangle', info: 'info' };
  const colors = { success: '#4A7A4A', danger: '#C04851', warning: '#8B6914', info: '#4A6B8A' };
  const toast = document.createElement('div');
  toast.style.cssText = 'background:#fff;border-left:3px solid ' + (colors[type] || colors.info) +
    ';box-shadow:0 4px 16px rgba(44,24,16,0.14);border-radius:8px;padding:10px 16px;display:flex;' +
    'align-items:center;gap:8px;min-width:240px;max-width:360px;font-size:14px;color:#3D2B1F;' +
    'animation:slideIn 0.2s ease;';
  toast.innerHTML = '<i data-lucide="' + (icons[type] || icons.info) + '" style="width:16px;height:16px;color:' +
    (colors[type] || colors.info) + ';"></i><span>' + message + '</span>';
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.showMessage = window.showMessage || showToast;

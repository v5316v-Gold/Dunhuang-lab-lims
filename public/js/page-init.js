
/**
 * 2026-08-11 UI 改进 — 4 个核心模块的筛选器/批量操作初始化
 * 模块：部门管理 / 设备台账 / 人员管理 / 试剂管理
 */

document.addEventListener('DOMContentLoaded', function() {
  // 等待 switchTab 加载完表格后再初始化（用 setTimeout 延迟）
  setTimeout(initAllPageFilters, 500);
});

// 监听 tab 切换
const _origSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
  if (_origSwitchTab) _origSwitchTab(tabId);
  // 切换后初始化对应模块
  setTimeout(() => {
    const initMap = {
      'departments': initDepartments,
      'equipment': initEquipment,
      'personnel': initPersonnel,
      'reagents': initReagents,
      'maintenance': initMaintenance,
      'calibration': initCalibration,
      'equipment-repairs': initEquipmentRepairs,
      'consumables': initConsumables,
      'glassware': initGlassware,
      'gases': initGases,
      'fumehood': initFumehood,
      'training': initTraining,
      'ehs-inspection': initEhsInspection,
      'ehs-incident': initEhsIncident,
      'ehs-hazard': initEhsHazard,
      'experimental-data': initExperimentalData,
      'appointments': initAppointments,
      'sample-processing': initSampleProcessing,
      'projects': initProjects
    };
    if (initMap[tabId]) initMap[tabId]();
  }, 300);
};

function initAllPageFilters() {
  // 不在 DOMContentLoaded 时初始化（表格还没数据）
  // 改为在 switchTab 触发后初始化
}


// ===== 1. 部门管理 =====
let _deptFilter = null;
let _deptBatch = null;
function initDepartments() {
  if (_deptFilter) return; // 只初始化一次
  if (!document.getElementById('filter-departments')) return;
  if (!document.getElementById('table-departments') ||
      !document.getElementById('table-departments').innerHTML.trim()) return;

  _deptFilter = new AdvancedFilter('#filter-departments', {
    fields: [
      { type: 'text', key: 'name', label: '部门名称', placeholder: '输入部门名称' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'active', label: '正常' },
        { value: 'inactive', label: '停用' }
      ]}
    ],
    onChange: (values) => filterTable('table-departments', values)
  });

  // 给表格加 checkbox 列和 data-table class
  const table = document.querySelector('#table-departments table');
  if (table) {
    table.classList.add('data-table');
    if (!table.querySelector('thead .checkbox-cell')) {
      const thead = table.querySelector('thead tr');
      const th = document.createElement('th');
      th.className = 'checkbox-cell';
      th.innerHTML = '<input type="checkbox" data-check-all />';
      thead.insertBefore(th, thead.firstChild);
    }
  }

  _deptBatch = new BatchOperations('#table-departments table', '#batch-bar-departments', {
    actions: [
      { label: '批量导出', icon: 'download', handler: 'batchExport' },
      { label: '批量删除', icon: 'trash', handler: 'batchDelete', class: 'btn-danger' }
    ]
  });

  // 给状态列加 Tag
  applyStatusTags('#table-departments', 'active', 'success', '正常');
  applyStatusTags('#table-departments', 'inactive', 'neutral', '停用');

  // 2026-08-11 增加：分页器
  if (window.Paginator) {
    const tableEl = document.getElementById('table-departments');
    if (tableEl && tableEl.parentElement) {
      new Paginator('#table-departments', { pageSize: 20 });
    }
  }
}


// ===== 2. 设备台账 =====
let _equipFilter = null;
let _equipBatch = null;
function initEquipment() {
  if (_equipFilter) return;
  if (!document.getElementById('filter-equipment')) return;
  if (!document.getElementById('table-equipment') ||
      !document.getElementById('table-equipment').innerHTML.trim()) return;

  _equipFilter = new AdvancedFilter('#filter-equipment', {
    fields: [
      { type: 'text', key: 'name', label: '设备名称', placeholder: '输入设备名称' },
      { type: 'text', key: 'no', label: '设备编号', placeholder: 'EQ-001' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'normal', label: '正常' },
        { value: 'maintenance', label: '维护中' },
        { value: 'calibration', label: '校准中' },
        { value: 'scrapped', label: '已报废' }
      ]},
      { type: 'daterange', key: 'date', label: '采购日期' }
    ],
    onChange: (values) => filterTable('table-equipment', values)
  });

  const table = document.querySelector('#table-equipment table');
  if (table) {
    table.classList.add('data-table');
    if (!table.querySelector('thead .checkbox-cell')) {
      const thead = table.querySelector('thead tr');
      const th = document.createElement('th');
      th.className = 'checkbox-cell';
      th.innerHTML = '<input type="checkbox" data-check-all />';
      thead.insertBefore(th, thead.firstChild);
    }
  }

  _equipBatch = new BatchOperations('#table-equipment table', '#batch-bar-equipment', {
    actions: [
      { label: '批量导出', icon: 'download', handler: 'batchExport' },
      { label: '批量校准', icon: 'crosshair', handler: 'batchExport', class: 'btn-default' },
      { label: '批量删除', icon: 'trash', handler: 'batchDelete', class: 'btn-danger' }
    ]
  });

  // 给状态列加 Tag
  applyStatusTags('#table-equipment', 'normal', 'success', '正常');
  applyStatusTags('#table-equipment', 'maintenance', 'warning', '维护中');
  applyStatusTags('#table-equipment', 'calibration', 'info', '校准中');
  applyStatusTags('#table-equipment', 'scrapped', 'danger', '已报废');
  applyStatusTags('#table-equipment', 'broken', 'danger', '损坏');

  // 2026-08-11 增加：分页器
  if (window.Paginator) {
    new Paginator('#table-equipment', { pageSize: 20 });
  }
}


// ===== 3. 人员管理 =====
let _persFilter = null;
let _persBatch = null;
function initPersonnel() {
  if (_persFilter) return;
  if (!document.getElementById('filter-personnel')) return;
  if (!document.getElementById('table-personnel') ||
      !document.getElementById('table-personnel').innerHTML.trim()) return;

  _persFilter = new AdvancedFilter('#filter-personnel', {
    fields: [
      { type: 'text', key: 'name', label: '姓名', placeholder: '输入姓名' },
      { type: 'select', key: 'role', label: '角色', options: [
        { value: 'admin', label: '管理员' },
        { value: 'analyst', label: '检测员' },
        { value: 'reviewer', label: '审核员' },
        { value: 'viewer', label: '查看者' }
      ]},
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'active', label: '在职' },
        { value: 'inactive', label: '离职' }
      ]}
    ],
    onChange: (values) => filterTable('table-personnel', values)
  });

  const table = document.querySelector('#table-personnel table');
  if (table) {
    table.classList.add('data-table');
    if (!table.querySelector('thead .checkbox-cell')) {
      const thead = table.querySelector('thead tr');
      const th = document.createElement('th');
      th.className = 'checkbox-cell';
      th.innerHTML = '<input type="checkbox" data-check-all />';
      thead.insertBefore(th, thead.firstChild);
    }
  }

  _persBatch = new BatchOperations('#table-personnel table', '#batch-bar-personnel', {
    actions: [
      { label: '批量导出', icon: 'download', handler: 'batchExport' },
      { label: '批量删除', icon: 'trash', handler: 'batchDelete', class: 'btn-danger' }
    ]
  });

  applyStatusTags('#table-personnel', 'active', 'success', '在职');
  applyStatusTags('#table-personnel', 'inactive', 'neutral', '离职');

  // 2026-08-11 增加：分页器
  if (window.Paginator) {
    new Paginator('#table-personnel', { pageSize: 20 });
  }
}


// ===== 4. 试剂管理 =====
let _reagFilter = null;
let _reagBatch = null;
function initReagents() {
  if (_reagFilter) return;
  if (!document.getElementById('filter-reagents')) return;
  if (!document.getElementById('table-reagents') ||
      !document.getElementById('table-reagents').innerHTML.trim()) return;

  _reagFilter = new AdvancedFilter('#filter-reagents', {
    fields: [
      { type: 'text', key: 'name', label: '试剂名称', placeholder: '输入试剂名称' },
      { type: 'text', key: 'cas', label: 'CAS号', placeholder: 'CAS 编号' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'normal', label: '正常' },
        { value: 'low', label: '库存不足' },
        { value: 'expired', label: '已过期' },
        { value: 'expiring', label: '即将过期' }
      ]}
    ],
    onChange: (values) => filterTable('table-reagents', values)
  });

  const table = document.querySelector('#table-reagents table');
  if (table) {
    table.classList.add('data-table');
    if (!table.querySelector('thead .checkbox-cell')) {
      const thead = table.querySelector('thead tr');
      const th = document.createElement('th');
      th.className = 'checkbox-cell';
      th.innerHTML = '<input type="checkbox" data-check-all />';
      thead.insertBefore(th, thead.firstChild);
    }
  }

  _reagBatch = new BatchOperations('#table-reagents table', '#batch-bar-reagents', {
    actions: [
      { label: '批量导出', icon: 'download', handler: 'batchExport' },
      { label: '批量盘点', icon: 'check-square', handler: 'batchExport', class: 'btn-default' },
      { label: '批量删除', icon: 'trash', handler: 'batchDelete', class: 'btn-danger' }
    ]
  });

  applyStatusTags('#table-reagents', 'normal', 'success', '正常');
  applyStatusTags('#table-reagents', 'low', 'warning', '库存不足');
  applyStatusTags('#table-reagents', 'expired', 'danger', '已过期');
  applyStatusTags('#table-reagents', 'expiring', 'warning', '即将过期');
  applyStatusTags('#table-reagents', 'active', 'success', '在用');

  // 2026-08-11 增加：分页器
  if (window.Paginator) {
    new Paginator('#table-reagents', { pageSize: 20 });
  }
}


// ===== 通用工具函数 =====

// 筛选表格行
function filterTable(tableId, values) {
  const table = document.querySelector('#' + tableId + ' table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    let match = true;
    for (const key in values) {
      if (!text.includes(String(values[key]).toLowerCase())) {
        match = false;
        break;
      }
    }
    row.style.display = match ? '' : 'none';
  });
}

// 给状态文字加彩色 Tag
function applyStatusTags(tableId, statusValue, tagType, tagLabel) {
  const table = document.querySelector('#' + tableId + ' table');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    cells.forEach(cell => {
      if (cell.textContent.trim() === statusValue) {
        cell.innerHTML = '<span class="tag tag-' + tagType + '"><i data-lucide="circle" style="width:12px;height:12px;"></i> ' + tagLabel + '</span>';
      }
    });
  });
  if (window.lucide) window.lucide.createIcons();
}


// ===== 5. 设备维护 =====
let _maintFilter = null, _maintBatch = null;
function initMaintenance() {
  if (_maintFilter) return;
  if (!document.getElementById('filter-maintenance')) return;
  if (!document.getElementById('table-maintenance') || !document.getElementById('table-maintenance').innerHTML.trim()) return;
  _maintFilter = new AdvancedFilter('#filter-maintenance', {
    fields: [
      { type: 'text', key: 'equip', label: '设备', placeholder: '设备名称' },
      { type: 'select', key: 'type', label: '类型', options: [
        { value: '维护', label: '维护' }, { value: '校准', label: '校准' },
        { value: '维修', label: '维修' }, { value: '期间核查', label: '期间核查' }
      ]}
    ],
    onChange: (v) => filterTable('table-maintenance', v)
  });
  const t = document.querySelector('#table-maintenance table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _maintBatch = new BatchOperations('#table-maintenance table', '#batch-bar-maintenance', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-maintenance', { pageSize: 20 });
}

// ===== 6. 设备校准 =====
let _calFilter = null, _calBatch = null;
function initCalibration() {
  if (_calFilter) return;
  if (!document.getElementById('filter-calibration')) return;
  if (!document.getElementById('table-calibration') || !document.getElementById('table-calibration').innerHTML.trim()) return;
  _calFilter = new AdvancedFilter('#filter-calibration', {
    fields: [
      { type: 'text', key: 'equip', label: '设备', placeholder: '设备名称' }
    ],
    onChange: (v) => filterTable('table-calibration', v)
  });
  const t = document.querySelector('#table-calibration table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _calBatch = new BatchOperations('#table-calibration table', '#batch-bar-calibration', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-calibration', { pageSize: 20 });
}

// ===== 7. 设备维修 =====
let _repFilter = null, _repBatch = null;
function initEquipmentRepairs() {
  if (_repFilter) return;
  if (!document.getElementById('filter-equipment-repairs')) return;
  if (!document.getElementById('table-equipment-repairs') || !document.getElementById('table-equipment-repairs').innerHTML.trim()) return;
  _repFilter = new AdvancedFilter('#filter-equipment-repairs', {
    fields: [
      { type: 'text', key: 'equip', label: '设备', placeholder: '设备名称' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'pending', label: '待处理' }, { value: 'in_progress', label: '处理中' },
        { value: 'completed', label: '已完成' }
      ]}
    ],
    onChange: (v) => filterTable('table-equipment-repairs', v)
  });
  const t = document.querySelector('#table-equipment-repairs table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _repBatch = new BatchOperations('#table-equipment-repairs table', '#batch-bar-equipment-repairs', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-equipment-repairs', { pageSize: 20 });
}

// ===== 8. 耗材管理 =====
let _consFilter = null, _consBatch = null;
function initConsumables() {
  if (_consFilter) return;
  if (!document.getElementById('filter-consumables')) return;
  if (!document.getElementById('table-consumables') || !document.getElementById('table-consumables').innerHTML.trim()) return;
  _consFilter = new AdvancedFilter('#filter-consumables', {
    fields: [
      { type: 'text', key: 'name', label: '耗材名称', placeholder: '耗材名称' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'normal', label: '正常' }, { value: 'low', label: '库存不足' }
      ]}
    ],
    onChange: (v) => filterTable('table-consumables', v)
  });
  const t = document.querySelector('#table-consumables table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _consBatch = new BatchOperations('#table-consumables table', '#batch-bar-consumables', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-consumables', { pageSize: 20 });
  applyStatusTags('#table-consumables', 'normal', 'success', '正常');
  applyStatusTags('#table-consumables', 'low', 'warning', '库存不足');
}

// ===== 9. 玻璃器皿 =====
let _glassFilter = null, _glassBatch = null;
function initGlassware() {
  if (_glassFilter) return;
  if (!document.getElementById('filter-glassware')) return;
  if (!document.getElementById('table-glassware') || !document.getElementById('table-glassware').innerHTML.trim()) return;
  _glassFilter = new AdvancedFilter('#filter-glassware', {
    fields: [
      { type: 'text', key: 'name', label: '器皿名称', placeholder: '器皿名称' }
    ],
    onChange: (v) => filterTable('table-glassware', v)
  });
  const t = document.querySelector('#table-glassware table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _glassBatch = new BatchOperations('#table-glassware table', '#batch-bar-glassware', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-glassware', { pageSize: 20 });
}

// ===== 10. 气体管理 =====
let _gasFilter = null, _gasBatch = null;
function initGases() {
  if (_gasFilter) return;
  if (!document.getElementById('filter-gases')) return;
  if (!document.getElementById('table-gases') || !document.getElementById('table-gases').innerHTML.trim()) return;
  _gasFilter = new AdvancedFilter('#filter-gases', {
    fields: [
      { type: 'text', key: 'name', label: '气体名称', placeholder: '气体名称' }
    ],
    onChange: (v) => filterTable('table-gases', v)
  });
  const t = document.querySelector('#table-gases table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _gasBatch = new BatchOperations('#table-gases table', '#batch-bar-gases', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-gases', { pageSize: 20 });
}

// ===== 11. 通风柜 =====
let _fhFilter = null, _fhBatch = null;
function initFumehood() {
  if (_fhFilter) return;
  if (!document.getElementById('filter-fumehood')) return;
  if (!document.getElementById('table-fumehood') || !document.getElementById('table-fumehood').innerHTML.trim()) return;
  _fhFilter = new AdvancedFilter('#filter-fumehood', {
    fields: [
      { type: 'text', key: 'location', label: '位置', placeholder: '位置' }
    ],
    onChange: (v) => filterTable('table-fumehood', v)
  });
  const t = document.querySelector('#table-fumehood table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _fhBatch = new BatchOperations('#table-fumehood table', '#batch-bar-fumehood', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-fumehood', { pageSize: 20 });
}

// ===== 12. 培训记录 =====
let _trFilter = null, _trBatch = null;
function initTraining() {
  if (_trFilter) return;
  if (!document.getElementById('filter-training')) return;
  if (!document.getElementById('table-training') || !document.getElementById('table-training').innerHTML.trim()) return;
  _trFilter = new AdvancedFilter('#filter-training', {
    fields: [
      { type: 'text', key: 'name', label: '人员', placeholder: '姓名' }
    ],
    onChange: (v) => filterTable('table-training', v)
  });
  const t = document.querySelector('#table-training table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _trBatch = new BatchOperations('#table-training table', '#batch-bar-training', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-training', { pageSize: 20 });
}

// ===== 13. EHS 巡检 =====
let _insFilter = null, _insBatch = null;
function initEhsInspection() {
  if (_insFilter) return;
  if (!document.getElementById('filter-ehs-inspection')) return;
  if (!document.getElementById('table-ehs-inspection') || !document.getElementById('table-ehs-inspection').innerHTML.trim()) return;
  _insFilter = new AdvancedFilter('#filter-ehs-inspection', {
    fields: [
      { type: 'text', key: 'location', label: '位置', placeholder: '巡检位置' }
    ],
    onChange: (v) => filterTable('table-ehs-inspection', v)
  });
  const t = document.querySelector('#table-ehs-inspection table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _insBatch = new BatchOperations('#table-ehs-inspection table', '#batch-bar-ehs-inspection', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-ehs-inspection', { pageSize: 20 });
}

// ===== 14. EHS 事故 =====
let _incFilter = null, _incBatch = null;
function initEhsIncident() {
  if (_incFilter) return;
  if (!document.getElementById('filter-ehs-incident')) return;
  if (!document.getElementById('table-ehs-incident') || !document.getElementById('table-ehs-incident').innerHTML.trim()) return;
  _incFilter = new AdvancedFilter('#filter-ehs-incident', {
    fields: [
      { type: 'text', key: 'location', label: '位置', placeholder: '事故位置' }
    ],
    onChange: (v) => filterTable('table-ehs-incident', v)
  });
  const t = document.querySelector('#table-ehs-incident table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _incBatch = new BatchOperations('#table-ehs-incident table', '#batch-bar-ehs-incident', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-ehs-incident', { pageSize: 20 });
}

// ===== 15. EHS 隐患 =====
let _hazFilter = null, _hazBatch = null;
function initEhsHazard() {
  if (_hazFilter) return;
  if (!document.getElementById('filter-ehs-hazard')) return;
  if (!document.getElementById('table-ehs-hazard') || !document.getElementById('table-ehs-hazard').innerHTML.trim()) return;
  _hazFilter = new AdvancedFilter('#filter-ehs-hazard', {
    fields: [
      { type: 'text', key: 'location', label: '位置', placeholder: '隐患位置' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'open', label: '待处理' }, { value: 'progress', label: '处理中' },
        { value: 'closed', label: '已处理' }
      ]}
    ],
    onChange: (v) => filterTable('table-ehs-hazard', v)
  });
  const t = document.querySelector('#table-ehs-hazard table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _hazBatch = new BatchOperations('#table-ehs-hazard table', '#batch-bar-ehs-hazard', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-ehs-hazard', { pageSize: 20 });
  applyStatusTags('#table-ehs-hazard', 'open', 'danger', '待处理');
  applyStatusTags('#table-ehs-hazard', 'progress', 'warning', '处理中');
  applyStatusTags('#table-ehs-hazard', 'closed', 'success', '已处理');
}

// ===== 16. 实验数据报告 =====
let _edrFilter = null, _edrBatch = null;
function initExperimentalData() {
  if (_edrFilter) return;
  if (!document.getElementById('filter-experimental-data')) return;
  if (!document.getElementById('table-experimental-data') || !document.getElementById('table-experimental-data').innerHTML.trim()) return;
  _edrFilter = new AdvancedFilter('#filter-experimental-data', {
    fields: [
      { type: 'text', key: 'no', label: '报告编号', placeholder: 'REP-2026-xxx' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'draft', label: '草稿' }, { value: 'submitted', label: '已提交' },
        { value: 'approved', label: '已批准' }, { value: 'rejected', label: '已驳回' }
      ]}
    ],
    onChange: (v) => filterTable('table-experimental-data', v)
  });
  const t = document.querySelector('#table-experimental-data table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _edrBatch = new BatchOperations('#table-experimental-data table', '#batch-bar-experimental-data', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'生成报告', icon:'file-text', handler:'batchExport', class:'btn-primary' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-experimental-data', { pageSize: 20 });
  applyStatusTags('#table-experimental-data', 'draft', 'neutral', '草稿');
  applyStatusTags('#table-experimental-data', 'submitted', 'info', '已提交');
  applyStatusTags('#table-experimental-data', 'approved', 'success', '已批准');
  applyStatusTags('#table-experimental-data', 'rejected', 'danger', '已驳回');
}

// ===== 17. 样品预约 =====
let _aptFilter = null, _aptBatch = null;
function initAppointments() {
  if (_aptFilter) return;
  if (!document.getElementById('filter-appointments')) return;
  if (!document.getElementById('table-appointments') || !document.getElementById('table-appointments').innerHTML.trim()) return;
  _aptFilter = new AdvancedFilter('#filter-appointments', {
    fields: [
      { type: 'text', key: 'no', label: '预约编号', placeholder: '预约编号' },
      { type: 'select', key: 'status', label: '状态', options: [
        { value: 'pending', label: '待确认' }, { value: 'confirmed', label: '已确认' },
        { value: 'completed', label: '已完成' }, { value: 'cancelled', label: '已取消' }
      ]}
    ],
    onChange: (v) => filterTable('table-appointments', v)
  });
  const t = document.querySelector('#table-appointments table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _aptBatch = new BatchOperations('#table-appointments table', '#batch-bar-appointments', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量确认', icon:'check', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-appointments', { pageSize: 20 });
}

// ===== 18. 样品处理 =====
let _spFilter = null, _spBatch = null;
function initSampleProcessing() {
  if (_spFilter) return;
  if (!document.getElementById('filter-sample-processing')) return;
  if (!document.getElementById('table-sample-processing') || !document.getElementById('table-sample-processing').innerHTML.trim()) return;
  _spFilter = new AdvancedFilter('#filter-sample-processing', {
    fields: [
      { type: 'text', key: 'no', label: '样品编号', placeholder: '样品编号' }
    ],
    onChange: (v) => filterTable('table-sample-processing', v)
  });
  const t = document.querySelector('#table-sample-processing table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _spBatch = new BatchOperations('#table-sample-processing table', '#batch-bar-sample-processing', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-sample-processing', { pageSize: 20 });
}

// ===== 19. 项目管理 =====
let _prjFilter = null, _prjBatch = null;
function initProjects() {
  if (_prjFilter) return;
  if (!document.getElementById('filter-projects')) return;
  if (!document.getElementById('table-projects') || !document.getElementById('table-projects').innerHTML.trim()) return;
  _prjFilter = new AdvancedFilter('#filter-projects', {
    fields: [
      { type: 'text', key: 'no', label: '项目编号', placeholder: 'PRJ-xxx' },
      { type: 'text', key: 'method', label: '方法', placeholder: 'ICP-MS 等' }
    ],
    onChange: (v) => filterTable('table-projects', v)
  });
  const t = document.querySelector('#table-projects table');
  if (t) { t.classList.add('data-table'); if (!t.querySelector('[data-check-all]')) { const th = document.createElement('th'); th.className='checkbox-cell'; th.innerHTML='<input type="checkbox" data-check-all />'; t.querySelector('thead tr').insertBefore(th, t.querySelector('thead tr').firstChild); } }
  _prjBatch = new BatchOperations('#table-projects table', '#batch-bar-projects', { actions: [{ label:'批量导出', icon:'download', handler:'batchExport' }, { label:'批量删除', icon:'trash', handler:'batchDelete', class:'btn-danger' }] });
  if (window.Paginator) new Paginator('#table-projects', { pageSize: 20 });
}

// LIMS App JS - 敦煌金检测中心LIMS系统

// Custom modal helpers (Bootstrap .modal() API doesn't work with custom .modal-overlay CSS)
function showModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hideModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

const API_MAP = {
  personnel: '/personnel',
  departments: '/departments',
  projects: '/projects',
  appointments: '/appointments',
  'sample-processing': '/sample-processing',
  equipment: '/equipment',
  maintenance: '/maintenance',
  calibration: '/calibration',
  'equipment-repairs': '/equipment-repairs',
  'consumable-suppliers': '/consumable-suppliers',
  consumables: '/consumables',
  'consumable-records': '/consumable-records',
  'glassware-suppliers': '/glassware-suppliers',
  glassware: '/glassware',
  'glassware-records': '/glassware-records',
  reagents: '/reagents',
  'reagent-records': '/reagent-records',
  'standard-substances': '/standard-substances',
  'reagent-inbound': '/reagent-inbound',
  'reagent-requisition': '/reagent-requisition',
  gases: '/gases',
  'gas-records': '/gas-records',
  'gas-inbound': '/gas-inbound',
  fumehood: '/fumehood',
  'fumehood-records': '/fumehood-records',
  'training-annual': '/training-annual',
  'training-records': '/training-records',
  'ehs-inspection': '/ehs-inspection',
  'ehs-incident': '/ehs-incident',
  'ehs-hazard': '/ehs-hazard',
  'experimental-data': '/experimental-data-reports',
};

let currentUser = null;

function api(path, method, body) {
  return fetch('/api' + path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  }).then(function(r) {
    if (!r.ok) {
      return r.text().then(function(text) {
        try { return JSON.parse(text); }
        catch(e) { return { error: '服务器错误(' + r.status + '): ' + text.substring(0, 100), _status: r.status }; }
      });
    }
    return r.json().catch(function(e) { return { error: '返回数据格式错误' }; });
  });
}

function showMessage(text, type) {
  var id = 'msg-' + Date.now();
  var cls = { success: 'alert-success', danger: 'alert-danger', warning: 'alert-warning' }[type] || 'alert-info';
  var div = document.createElement('div');
  div.className = 'alert ' + cls + ' alert-dismissible';
  div.id = id;
  div.innerHTML = '<a href="#" class="close" data-dismiss="alert">&times;</a>' + text;
  var container = document.getElementById('message-container') || document.body;
  container.insertBefore(div, container.firstChild);
  setTimeout(function() { var el = document.getElementById(id); if (el) el.remove(); }, 4000);
}

function switchTab(tab) {
  document.querySelectorAll('.page-view').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('.sidebar a').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById('page-' + tab);
  if (target) {
    target.style.display = 'block';
    var sidebarLink = document.querySelector('.sidebar a[href="#' + tab + '"]');
    if (sidebarLink) sidebarLink.classList.add('active');
  }
  if (typeof window['load' + capitalize(tab)] === 'function') {
    window['load' + capitalize(tab)]();
  }
}

function capitalize(s) { return s.split('-').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(''); }

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'number') d = new Date(d);
  if (d instanceof Date && isNaN(d)) return '';
  if (!(d instanceof Date)) return d;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderTable(headers, rows, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  if (!rows || rows.length === 0) { container.innerHTML = '<div class="alert alert-info">暂无数据</div>'; return; }
  var ths = headers.map(function(h) { return '<th>' + h + '</th>'; }).join('');
  var trs = rows.map(function(row) {
    return '<tr>' + row.map(function(cell) {
      return '<td>' + (cell === null || cell === undefined ? '' : cell) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  container.innerHTML = '<table class="table table-bordered table-striped table-hover"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
}

function deleteItem(tab, id) {
  if (!confirm('确定删除?')) return;
  api('/' + tab + '/' + id, 'DELETE').then(function(r) {
    if (r.error) { showMessage(r.error, 'danger'); return; }
    showMessage('删除成功', 'success');
    if (typeof window['load' + capitalize(tab)] === 'function') window['load' + capitalize(tab)]();
  });
}

// Login DOMContentLoaded - executed at bottom of file

// ========== HOME / DASHBOARD ==========

function drawPie(canvasId, legendId, data) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4;
  var total = data.reduce(function(s, d) { return s + (d.count || 0); }, 0);

  // 2026-08-03 升级：空数据时切换到 empty-state 组件（图标+提示+录入按钮）
  var emptyEl = document.getElementById('empty-' + canvasId);
  var leg = document.getElementById(legendId);

  if (total === 0) {
    if (canvas) canvas.style.display = 'none';
    if (emptyEl) { emptyEl.style.display = 'flex'; }
    if (leg) leg.innerHTML = '';
    if (window.lucide) window.lucide.createIcons();
    return;
  } else {
    if (canvas) canvas.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';
  }

  ctx.clearRect(0, 0, W, H);
  var startAngle = -Math.PI / 2;
  data.forEach(function(d) {
    if (!d.count) return;
    var slice = (d.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle += slice;
  });
  var leg = document.getElementById(legendId);
  if (leg) {
    leg.innerHTML = data.filter(function(d) { return d.count > 0; }).map(function(d) {
      return '<div class="pie-legend-item"><span class="pie-legend-dot" style="background:' + d.color + '"></span><span>' + d.label + '</span><span class="pie-legend-count">' + d.count + '</span></div>';
    }).join('');
  }
}

function fmtDate(d) {
  if (!d) return '';
  var nd = new Date(d);
  if (isNaN(nd)) return '';
  return nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' + String(nd.getDate()).padStart(2, '0');
}

function renderHomeListSamples(samples) {
  var el = document.getElementById('home-list-samples');
  if (!el) return;
  if (!samples || samples.length === 0) { el.innerHTML = '<div class="home-list-empty">暂无样品记录</div>'; return; }
  var stageColors = { pending:'background:rgba(212,168,67,0.15);color:#B8860B;', processing:'background:rgba(74,107,138,0.15);color:#4A6B8A;', completed:'background:rgba(74,107,138,0.2);color:#2D6A80;', archived:'background:rgba(201,169,110,0.15);color:#8B6914;' };
  var stageLabels = { pending:'待处理', processing:'处理中', completed:'已完成', archived:'已归档' };
  var html = '';
  samples.slice(0, 8).forEach(function(s) {
    var st = stageColors[s.workflow_status] || stageColors['pending'];
    var lb = stageLabels[s.workflow_status] || s.workflow_status || '';
    html += '<div class="home-list-item"><span class="home-list-item-name" title="' + (s.sample_name||'') + '">' + (s.sample_name||'—') + '</span><span class="home-list-badge" style="' + st + '">' + lb + '</span><span class="home-list-item-meta">' + fmtDate(s.processing_date) + '</span></div>';
  });
  el.innerHTML = html;
}

function renderHomeListHazards(hazards) {
  var el = document.getElementById('home-list-hazards');
  if (!el) return;
  if (!hazards || hazards.length === 0) { el.innerHTML = '<div class="home-list-empty">暂无隐患记录</div>'; return; }
  var sevColors = { '高':'background:rgba(160,82,45,0.15);color:#A0522D;', '中':'background:rgba(212,168,67,0.15);color:#B8860B;', '低':'background:rgba(74,107,138,0.12);color:#4A6B8A;', '重大':'background:rgba(160,82,45,0.2);color:#7A3A20;' };
  var statusColors = { 'pending':'background:rgba(212,168,67,0.15);color:#B8860B;', 'in-progress':'background:rgba(74,107,138,0.15);color:#4A6B8A;', 'resolved':'background:rgba(74,107,138,0.2);color:#2D6A80;', 'closed':'background:rgba(139,105,20,0.15);color:#8B6914;' };
  var statusLabels = { pending:'待处理', in_progress:'处理中', resolved:'已解决', closed:'已关闭' };
  var html = '';
  hazards.filter(function(h) { return h.status !== 'resolved' && h.status !== 'closed'; }).slice(0, 8).forEach(function(h) {
    html += '<div class="home-list-item"><span class="home-list-item-name" title="' + (h.description||'') + '">' + (h.hazard_location||'—') + '</span><span class="home-list-badge" style="' + (sevColors[h.severity_level]||'') + '">' + (h.severity_level||'') + '</span><span class="home-list-badge" style="' + (statusColors[h.status]||'') + '">' + (statusLabels[h.status]||h.status||'') + '</span></div>';
  });
  el.innerHTML = html || '<div class="home-list-empty">暂无待处理隐患</div>';
}

function renderHomeListInspections(records) {
  var el = document.getElementById('home-list-inspections');
  if (!el) return;
  if (!records || records.length === 0) { el.innerHTML = '<div class="home-list-empty">暂无巡检记录</div>'; return; }
  var overallColors = { '合格':'background:rgba(74,107,138,0.15);color:#4A6B8A;', '不合格':'background:rgba(160,82,45,0.15);color:#A0522D;', '基本合格':'background:rgba(212,168,67,0.15);color:#B8860B;' };
  var html = '';
  records.slice(0, 8).forEach(function(r) {
    html += '<div class="home-list-item"><span class="home-list-item-name">' + (r.inspector_name||'—') + '</span><span class="home-list-badge" style="' + (overallColors[r.overall_status]||'') + '">' + (r.overall_status||'—') + '</span><span class="home-list-item-meta">' + fmtDate(r.inspection_date) + '</span></div>';
  });
  el.innerHTML = html;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function updateClock() {
  var now = new Date();
  var dateStr = now.getFullYear() + '年' + pad2(now.getMonth()+1) + '月' + pad2(now.getDate()) + '日';
  var timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  var weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  var wd = weekdays[now.getDay()];
  var de = document.getElementById('home-date');
  var we = document.getElementById('home-weekday');
  var te = document.getElementById('home-time');
  if (de) de.textContent = dateStr;
  if (we) we.textContent = wd;
  if (te) te.textContent = timeStr;
}

window.loadHome = function() {
  updateClock();
  if (!window._homeClockInterval) window._homeClockInterval = setInterval(updateClock, 1000);
  var uname = document.getElementById('home-username');
  if (uname && currentUser) uname.textContent = currentUser.name || currentUser.username || '';
  var MODULES = [
    { icon:'<i data-lucide="user"></i>', name:'人员管理', tab:'personnel' },
    { icon:'<i data-lucide="building-2"></i>', name:'部门管理', tab:'departments' },
    { icon:'<i data-lucide="clipboard-list"></i>', name:'项目管理', tab:'projects' },
    { icon:'<i data-lucide="calendar-clock"></i>', name:'样品预约', tab:'appointments' },
    { icon:'<i data-lucide="test-tubes"></i>', name:'样品处理', tab:'sample-processing' },
    { icon:'<i data-lucide="settings"></i>', name:'设备台账', tab:'equipment' },
    { icon:'<i data-lucide="wrench"></i>', name:'设备维护', tab:'maintenance' },
    { icon:'<i data-lucide="ruler"></i>', name:'设备校准', tab:'calibration' },
    { icon:'<i data-lucide="hammer"></i>', name:'设备维修', tab:'equipment-repairs' },
    { icon:'<i data-lucide="package"></i>', name:'耗材管理', tab:'consumables' },
    { icon:'<i data-lucide="flask-round"></i>', name:'玻璃器皿', tab:'glassware' },
    { icon:'<i data-lucide="beaker"></i>', name:'试剂管理', tab:'reagents' },
    { icon:'<i data-lucide="wind"></i>', name:'气体管理', tab:'gases' },
    { icon:'<i data-lucide="fan"></i>', name:'通风柜', tab:'fumehood' },
    { icon:'<i data-lucide="graduation-cap"></i>', name:'培训记录', tab:'training' },
    { icon:'<i data-lucide="search"></i>', name:'日常巡检', tab:'ehs-inspection' },
    { icon:'<i data-lucide="siren"></i>', name:'事故记录', tab:'ehs-incident' },
    { icon:'<i data-lucide="alert-triangle"></i>', name:'隐患管理', tab:'ehs-hazard' },
    { icon:'<i data-lucide="bar-chart-3"></i>', name:'实验数据报告', tab:'experimental-data' }
  ];
  var grid = document.getElementById('home-module-grid');
  if (grid) {
    grid.innerHTML = MODULES.map(function(m) {
      return '<a class="home-mod-btn" href="#' + m.tab + '" onclick="switchTab(\'' + m.tab + '\');return false;"><span class="home-mod-icon">' + m.icon + '</span><span class="home-mod-name">' + m.name + '</span></a>';
    }).join('');
  }
  var endpoints = [
    { key:'personnel',    path:'/personnel' },
    { key:'equipment',   path:'/equipment' },
    { key:'samples',     path:'/sample-processing' },
    { key:'consumables', path:'/consumables' },
    { key:'reagents',    path:'/reagents' },
    { key:'hazards',     path:'/ehs-hazard' },
    { key:'inspections', path:'/ehs-inspection' }
  ];
  var results = {};
  var pending = endpoints.length;
  endpoints.forEach(function(ep) {
    api(ep.path, 'GET').then(function(r) {
      results[ep.key] = r.data || [];
      if (--pending === 0) finish();
    }).catch(function() {
      results[ep.key] = [];
      if (--pending === 0) finish();
    });
  });
  function finish() {
    var setStat = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    setStat('stat-personnel', results.personnel ? results.personnel.length : 0);
    setStat('stat-equipment', results.equipment ? results.equipment.length : 0);
    setStat('stat-samples', results.samples ? results.samples.length : 0);
    setStat('stat-consumables', results.consumables ? results.consumables.length : 0);
    setStat('stat-reagents', results.reagents ? results.reagents.length : 0);
    setStat('stat-hazards', results.hazards ? results.hazards.filter(function(h){return h.status==='pending'||h.status==='in-progress';}).length : 0);
    var mc = {};
    (results.samples||[]).forEach(function(s) { var m = s.detection_method||'未知'; mc[m] = (mc[m]||0)+1; });
    var methodColors = { '火法':'#C9A96E', 'ICP':'#4A6B8A', '未知':'#8B7355', 'XRF':'#A0522D', '化学法':'#6B8E8E', '光谱法':'#8B6914' };
    var methodData = Object.keys(mc).map(function(k) { return { label:k, count:mc[k], color:methodColors[k]||'#8B7355' }; });
    drawPie('chart-sample-method', 'legend-sample-method', methodData.length ? methodData : [{label:'暂无数据',count:0,color:'#e0d5c1'}]);
    var sc2 = {};
    (results.equipment||[]).forEach(function(e) { var s = e.status||'normal'; sc2[s] = (sc2[s]||0)+1; });
    var statusColors2 = { normal:'#4A6B8A', maintenance:'#C9A96E', calibration:'#8B6914', scrapped:'#A0522D' };
    var statusLabels2 = { normal:'正常', maintenance:'维护中', calibration:'校准中', scrapped:'已报废' };
    var equipData = Object.keys(sc2).map(function(k) { return { label:statusLabels2[k]||k, count:sc2[k], color:statusColors2[k]||'#8B7355' }; });
    drawPie('chart-equip-status', 'legend-equip-status', equipData.length ? equipData : [{label:'暂无数据',count:0,color:'#e0d5c1'}]);
    var rc = {};
    (results.reagents||[]).forEach(function(r) { var s = r.status||'normal'; rc[s] = (rc[s]||0)+1; });
    var reagColors = { normal:'#4A6B8A', expired:'#A0522D', low:'#C9A96E' };
    var reagLabels2 = { normal:'正常', expired:'已过期', low:'库存不足' };
    var reagData = Object.keys(rc).map(function(k) { return { label:reagLabels2[k]||k, count:rc[k], color:reagColors[k]||'#8B7355' }; });
    drawPie('chart-reagent-status', 'legend-reagent-status', reagData.length ? reagData : [{label:'暂无数据',count:0,color:'#e0d5c1'}]);
    renderHomeListSamples(results.samples||[]);
    renderHomeListHazards(results.hazards||[]);
    renderHomeListInspections(results.inspections||[]);
  }
};

// ========== Personnel ==========
window.loadPersonnel = function() {
  api('/personnel', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.name||'', d.dept||'', d.role||'', d.email||'', d.phone||'', d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editPerson(\'' + d.id + '\')">编辑</button><button class="btn btn-xs btn-danger" onclick="deleteItem(\'personnel\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['姓名','部门','角色','邮箱','手机','状态','操作'], rows, 'table-personnel');
  });
};

window.editPerson = function(id) {
  api('/personnel', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('personnel-id').value = id;
    document.getElementById('personnel-username').value = d.username||'';
    document.getElementById('personnel-password').value = '';
    document.getElementById('personnel-password').placeholder = '（已填写则修改密码）';
    document.getElementById('personnel-name').value = d.name||'';
    document.getElementById('personnel-dept').value = d.dept||'';
    document.getElementById('personnel-role').value = d.role||'analyst';
    document.getElementById('personnel-email').value = d.email||'';
    document.getElementById('personnel-phone').value = d.phone||'';
    document.getElementById('personnel-position').value = d.position||'';
    document.getElementById('personnel-status').value = d.status||'active';
    showModal('modal-personnel');
  });
};

// ========== Departments ==========
window.loadDepartments = function() {
  api('/departments', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.dept_no||'', d.name||'', d.parent_name||'', d.manager_name||'', d.phone||'', d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editDept(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'departments\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['部门编码','部门名称','上级部门','负责人','联系电话','状态','操作'], rows, 'table-departments');
  });
};

window.editDept = function(id) {
  api('/departments', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('dept-id').value = id;
    document.getElementById('dept-no').value = d.dept_no||'';
    document.getElementById('dept-name').value = d.name||'';
    document.getElementById('dept-parent').value = d.parent_id||'';
    document.getElementById('dept-phone').value = d.phone||'';
    document.getElementById('dept-status').value = d.status||'active';
    showModal('modal-departments');
  });
};

// ========== Projects ==========
window.loadProjects = function() {
  api('/projects', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.project_no||'', d.project_name||'', d.method_type||'', d.description||'',
        '<button class="btn btn-xs btn-primary" onclick="editProject(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'projects\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['项目编号','项目名称','检测方法','描述','操作'], rows, 'table-projects');
  });
};

window.editProject = function(id) {
  api('/projects', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('project-id').value = id;
    document.getElementById('project-no').value = d.project_no||'';
    document.getElementById('project-name').value = d.project_name||'';
    document.getElementById('project-method').value = d.method_type||'';
    document.getElementById('project-desc').value = d.description||'';
    showModal('modal-projects');
  });
};

// ========== Appointments ==========
window.loadAppointments = function() {
  api('/appointments', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.appointment_no||'', d.client_name||'', d.sample_type||'', formatDate(d.expected_date), d.contact_person||'', d.contact_phone||'', d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editAppointment(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'appointments\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['预约编号','客户名称','样品类型','预期日期','联系人','联系电话','状态','操作'], rows, 'table-appointments');
  });
};

window.editAppointment = function(id) {
  api('/appointments', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('appt-id').value = id;
    document.getElementById('appt-no').value = d.appointment_no||'';
    document.getElementById('appt-client').value = d.client_name||'';
    document.getElementById('appt-type').value = d.sample_type||'';
    document.getElementById('appt-date').value = d.expected_date||'';
    document.getElementById('appt-contact').value = d.contact_person||'';
    document.getElementById('appt-phone').value = d.contact_phone||'';
    document.getElementById('appt-status').value = d.status||'pending';
    document.getElementById('appt-remark').value = d.remark||'';
    showModal('modal-appointments');
  });
};

// ========== Sample Processing ==========
window.loadSampleProcessing = function() {
  api('/sample-processing', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.sample_code||'', d.sample_name||'', d.sample_type||'', d.packaging_intact||'', d.detection_method||'', formatDate(d.processing_date), d.operator_name||'', d.qa_review||'', d.workflow_status||'', d.archived||0,
        '<button class="btn btn-xs btn-primary" onclick="editSample(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'sample-processing\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['样品编号','样品名称','样品类型','包装完整','检测方法','处理日期','操作员','审核状态','流程状态','归档','操作'], rows, 'table-sample-processing');
  });
};

window.editSample = function(id) {
  api('/sample-processing', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('sample-id').value = id;
    document.getElementById('sample-code').value = d.sample_code||'';
    document.getElementById('sample-name').value = d.sample_name||'';
    document.getElementById('sample-type').value = d.sample_type||'';
    document.getElementById('sample-packaging').value = d.packaging_intact||'yes';
    document.getElementById('sample-method').value = d.processing_method||'';
    document.getElementById('sample-detection').value = d.detection_method||'';
    document.getElementById('sample-date').value = d.processing_date||'';
    document.getElementById('sample-desc').value = d.processing_desc||'';
    document.getElementById('sample-result').value = d.result_data||'';
    document.getElementById('sample-conclusion').value = d.result_conclusion||'';
    document.getElementById('sample-report').value = d.report_no||'';
    document.getElementById('sample-env-temp').value = d.environment_temp||'';
    document.getElementById('sample-env-humidity').value = d.environment_humidity||'';
    document.getElementById('sample-equip-id').value = d.equipment_id||'';
    document.getElementById('sample-operator-id').value = d.operator_id||'';
    document.getElementById('sample-supervisor-id').value = d.supervisor_id||'';
    document.getElementById('sample-consumables').value = d.consumables_used||'';
    document.getElementById('sample-reagents').value = d.reagents_used||'';
    document.getElementById('sample-gases').value = d.gases_used||'';
    showModal('modal-sample-processing');
  });
};

// ========== Equipment ==========
window.loadEquipment = function() {
  api('/equipment', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.equip_no||'', d.equip_name||'', d.model||'', d.manufacturer||'', formatDate(d.purchase_date), d.purchase_price||'', d.location||'', d.dept_name||'', d.status||'', d.responsible_name||'',
        '<button class="btn btn-xs btn-primary" onclick="editEquip(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'equipment\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['设备编号','设备名称','型号','厂商','采购日期','采购价格','位置','部门','状态','负责人','操作'], rows, 'table-equipment');
  });
};

window.populateEquipDropdowns = function(selectedDeptId, selectedRespId) {
  var deptSel = document.getElementById('equip-dept');
  var respSel = document.getElementById('equip-responsible');
  if (deptSel) {
    deptSel.innerHTML = '<option value="">--请选择部门--</option>';
    api('/departments', 'GET').then(function(r) {
      (r.data||[]).forEach(function(d) {
        var opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        if (selectedDeptId && d.id == selectedDeptId) opt.selected = true;
        deptSel.appendChild(opt);
      });
    });
  }
  if (respSel) {
    respSel.innerHTML = '<option value="">--请选择负责人--</option>';
    api('/personnel', 'GET').then(function(r) {
      (r.data||[]).filter(function(u) { return u.status === 'active'; }).forEach(function(u) {
        var opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = (u.name||u.username||'') + (u.position ? ' (' + u.position + ')' : '');
        if (selectedRespId && u.id == selectedRespId) opt.selected = true;
        respSel.appendChild(opt);
      });
    });
  }
};

window.editEquip = function(id) {
  api('/equipment', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('equip-id').value = id;
    document.getElementById('equip-no').value = d.equip_no||'';
    document.getElementById('equip-name').value = d.equip_name||'';
    document.getElementById('equip-model').value = d.model||'';
    document.getElementById('equip-mfr').value = d.manufacturer||'';
    
    document.getElementById('equip-date').value = d.purchase_date||'';
    document.getElementById('equip-price').value = d.purchase_price||'';
    document.getElementById('equip-value').value = d.current_value||'';
    document.getElementById('equip-location').value = d.location||'';
    document.getElementById('equip-status').value = d.status||'normal';
    populateEquipDropdowns(d.dept_id, d.responsible_person);
    showModal('modal-equipment');
  });
};

// ========== Maintenance ==========
window.loadMaintenance = function() {
  api('/maintenance', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.equip_name||'', formatDate(d.maintenance_date), d.maintenance_type||'', d.maintainer||'', d.cost||'', formatDate(d.next_maintenance_date),
        '<button class="btn btn-xs btn-primary" onclick="editMaint(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'maintenance\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['设备名称','维护日期','维护类型','维护人员','费用','下次维护日期','操作'], rows, 'table-maintenance');
  });
};

window.editMaint = function(id) {
  api('/maintenance', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('maint-id').value = id;
    document.getElementById('maint-equip').value = d.equip_id||'';
    document.getElementById('maint-date').value = d.maintenance_date||'';
    document.getElementById('maint-type').value = d.maintenance_type||'';
    document.getElementById('maint-person').value = d.maintainer||'';
    document.getElementById('maint-cost').value = d.cost||'';
    document.getElementById('maint-next').value = d.next_maintenance_date||'';
    document.getElementById('maint-desc').value = d.description||'';
    showModal('modal-maintenance');
  });
};

// ========== Calibration ==========
window.loadCalibration = function() {
  api('/calibration', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.equip_name||'', formatDate(d.calibration_date), d.calibration_org||'', d.certificate_no||'', formatDate(d.valid_date), d.result||'',
        '<button class="btn btn-xs btn-primary" onclick="editCalib(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'calibration\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['设备名称','校准日期','校准机构','证书编号','有效日期','结果','操作'], rows, 'table-calibration');
  });
};

window.editCalib = function(id) {
  api('/calibration', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('calib-id').value = id;
    document.getElementById('calib-equip').value = d.equip_id||'';
    document.getElementById('calib-date').value = d.calibration_date||'';
    document.getElementById('calib-org').value = d.calibration_org||'';
    document.getElementById('calib-cert').value = d.certificate_no||'';
    document.getElementById('calib-valid').value = d.valid_date||'';
    document.getElementById('calib-result').value = d.result||'';
    showModal('modal-calibration');
  });
};

// ========== Equipment Repairs ==========
window.loadEquipmentRepairs = function() {
  api('/equipment-repairs', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.equip_name||'', formatDate(d.repair_date), d.fault_desc||'', d.repair_action||'', d.repairer||'', d.cost||'', d.result||'', formatDate(d.next_inspection_date),
        '<button class="btn btn-xs btn-primary" onclick="editRepair(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'equipment-repairs\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['设备名称','维修日期','故障描述','维修措施','维修人员','费用','结果','下次检验日期','操作'], rows, 'table-equipment-repairs');
  });
};

window.editRepair = function(id) {
  api('/equipment-repairs', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('repair-id').value = id;
    document.getElementById('repair-equip').value = d.equip_id||'';
    document.getElementById('repair-date').value = d.repair_date||'';
    document.getElementById('repair-fault').value = d.fault_desc||'';
    document.getElementById('repair-action').value = d.repair_action||'';
    document.getElementById('repair-person').value = d.repairer||'';
    document.getElementById('repair-cost').value = d.cost||'';
    document.getElementById('repair-result').value = d.result||'';
    document.getElementById('repair-next').value = d.next_inspection_date||'';
    showModal('modal-equipment-repairs');
  });
};

// ========== Consumables ==========
window.loadConsumables = function() {
  api('/consumables', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.item_name||'', d.specification||'', d.unit||'', d.category||'', d.min_stock||'', d.current_stock||'', d.location||'', d.supplier_name||'',
        '<button class="btn btn-xs btn-primary" onclick="editConsumable(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'consumables\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['耗材名称','规格','单位','分类','最小库存','当前库存','位置','供应商','操作'], rows, 'table-consumables');
  });
};

window.editConsumable = function(id) {
  api('/consumables', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('cons-id').value = id;
    document.getElementById('cons-name').value = d.item_name||'';
    document.getElementById('cons-spec').value = d.specification||'';
    document.getElementById('cons-unit').value = d.unit||'';
    document.getElementById('cons-cat').value = d.category||'';
    document.getElementById('cons-min').value = d.min_stock||'';
    document.getElementById('cons-stock').value = d.current_stock||'';
    document.getElementById('cons-loc').value = d.location||'';
    showModal('modal-consumables');
  });
};

// ========== Glassware ==========
window.loadGlassware = function() {
  api('/glassware', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.item_name||'', d.specification||'', d.material||'', d.unit||'', d.current_stock||'', d.location||'', d.supplier_name||'',
        '<button class="btn btn-xs btn-primary" onclick="editGlass(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'glassware\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['物品名称','规格','材质','单位','当前库存','位置','供应商','操作'], rows, 'table-glassware');
  });
};

window.editGlass = function(id) {
  api('/glassware', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('glass-id').value = id;
    document.getElementById('glass-name').value = d.item_name||'';
    document.getElementById('glass-spec').value = d.specification||'';
    document.getElementById('glass-material').value = d.material||'';
    document.getElementById('glass-unit').value = d.unit||'';
    document.getElementById('glass-stock').value = d.current_stock||'';
    document.getElementById('glass-loc').value = d.location||'';
    showModal('modal-glassware');
  });
};

// ========== Reagents ==========
window.loadReagents = function() {
  api('/reagents', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.reagent_name||'', d.cas_no||'', d.formula||'', d.purity||'', d.manufacturer||'', d.supplier||'', d.location||'', d.current_stock||'', d.unit||'', d.min_stock||'', d.status||'', formatDate(d.expiry_date),
        '<button class="btn btn-xs btn-primary" onclick="editReagent(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'reagents\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['试剂名称','CAS号','分子式','纯度','生产厂家','供应商','位置','当前库存','单位','最小库存','状态','有效期','操作'], rows, 'table-reagents');
  });
};

window.editReagent = function(id) {
  api('/reagents', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('reag-id').value = id;
    document.getElementById('reag-name').value = d.reagent_name||'';
    document.getElementById('reag-cas').value = d.cas_no||'';
    document.getElementById('reag-formula').value = d.formula||'';
    document.getElementById('reag-purity').value = d.purity||'';
    document.getElementById('reag-mfr').value = d.manufacturer||'';
    document.getElementById('reag-supplier').value = d.supplier||'';
    document.getElementById('reag-location').value = d.location||'';
    document.getElementById('reag-stock').value = d.current_stock||'';
    document.getElementById('reag-unit').value = d.unit||'';
    document.getElementById('reag-min').value = d.min_stock||'';
    document.getElementById('reag-status').value = d.status||'normal';
    document.getElementById('reag-expiry').value = d.expiry_date||'';
    showModal('modal-reagents');
  });
};

// ========== Gases ==========
window.loadGases = function() {
  api('/gases', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.gas_name||'', d.purity||'', d.manufacturer||'', d.supplier||'', d.current_stock||'', d.unit||'', d.min_stock||'', d.location||'', d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editGas(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'gases\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['气体名称','纯度','厂商','供应商','当前库存','单位','最小库存','位置','状态','操作'], rows, 'table-gases');
  });
};

window.editGas = function(id) {
  api('/gases', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('gas-id').value = id;
    document.getElementById('gas-name').value = d.gas_name||'';
    document.getElementById('gas-purity').value = d.purity||'';
    document.getElementById('gas-mfr').value = d.manufacturer||'';
    document.getElementById('gas-supplier').value = d.supplier||'';
    document.getElementById('gas-stock').value = d.current_stock||'';
    document.getElementById('gas-unit').value = d.unit||'';
    document.getElementById('gas-min').value = d.min_stock||'';
    document.getElementById('gas-loc').value = d.location||'';
    document.getElementById('gas-status').value = d.status||'normal';
    showModal('modal-gases');
  });
};

// ========== Fumehood ==========
window.loadFumehood = function() {
  api('/fumehood', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.equip_no||'', d.equip_name||'', d.location||'', d.model||'', d.manufacturer||'', d.last_inspection_date?formatDate(d.last_inspection_date):'', d.status||'', d.responsible_name||'',
        '<button class="btn btn-xs btn-primary" onclick="editFumehood(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'fumehood\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['设备编号','设备名称','位置','型号','厂商','上次检验日期','状态','负责人','操作'], rows, 'table-fumehood');
  });
};

window.editFumehood = function(id) {
  api('/fumehood', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('fh-id').value = id;
    document.getElementById('fh-no').value = d.equip_no||'';
    document.getElementById('fh-name').value = d.equip_name||'';
    document.getElementById('fh-location').value = d.location||'';
    document.getElementById('fh-brand').value = (d.model||'') + (d.manufacturer ? ' / ' + d.manufacturer : '');
    document.getElementById('fh-speed').value = d.wind_speed||'';
    document.getElementById('fh-calib').value = d.last_inspection_date||'';
    document.getElementById('fh-status').value = d.status||'normal';
    showModal('modal-fumehood');
  });
};

// ========== Training ==========
window.loadTraining = function() {
  api('/training-records', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [d.trainer_name||'', d.training_content||'', formatDate(d.training_date), d.participant_names||'', d.result||'', d.certificate_no||'', formatDate(d.expiry_date), d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editTraining(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'training-records\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['培训人','培训内容','培训日期','参加人员','考核结果','证书编号','到期日期','状态','操作'], rows, 'table-training');
  });
};

window.editTraining = function(id) {
  api('/training-records', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('tr-id').value = id;
    document.getElementById('tr-trainer').value = d.trainer_name||'';
    document.getElementById('tr-content').value = d.training_content||'';
    document.getElementById('tr-date').value = d.training_date||'';
    document.getElementById('tr-participants').value = d.participant_names||'';
    document.getElementById('tr-result').value = d.result||'';
    document.getElementById('tr-cert').value = d.certificate_no||'';
    document.getElementById('tr-expiry').value = d.expiry_date||'';
    document.getElementById('tr-status').value = d.status||'completed';
    showModal('modal-training');
  });
};

// ========== EHS Inspection ==========
window.loadEhsInspection = function() {
  api('/ehs-inspection', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [formatDate(d.inspection_date), d.inspector_name||'', d.inspection_area||'', d.overall_status||'', d.findings||'', formatDate(d.next_inspection_date),
        '<button class="btn btn-xs btn-primary" onclick="editEhsInspection(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'ehs-inspection\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['巡检日期','巡检人','巡检区域','总体状态','发现问题','下次巡检日期','操作'], rows, 'table-ehs-inspection');
  });
};

window.editEhsInspection = function(id) {
  api('/ehs-inspection', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('ehsi-id').value = id;
    document.getElementById('ehsi-date').value = d.inspection_date||'';
    document.getElementById('ehsi-inspector').value = d.inspector_name||'';
    document.getElementById('ehsi-area').value = d.inspection_area||'';
    document.getElementById('ehsi-status').value = d.overall_status||'合格';
    document.getElementById('ehsi-findings').value = d.findings||'';
    document.getElementById('ehsi-next').value = d.next_inspection_date||'';
    showModal('modal-ehs-inspection');
  });
};

// ========== EHS Incident ==========
window.loadEhsIncident = function() {
  api('/ehs-incident', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [formatDate(d.incident_date), d.incident_type||'', d.location||'', d.severity_level||'', d.description||'', d.handling_result||'', formatDate(d.report_date),
        '<button class="btn btn-xs btn-primary" onclick="editEhsIncident(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'ehs-incident\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['事故日期','事故类型','地点','严重程度','描述','处理结果','报告日期','操作'], rows, 'table-ehs-incident');
  });
};

window.editEhsIncident = function(id) {
  api('/ehs-incident', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('ehsin-id').value = id;
    document.getElementById('ehsin-date').value = d.incident_date||'';
    document.getElementById('ehsin-type').value = d.incident_type||'';
    document.getElementById('ehsin-loc').value = d.location||'';
    document.getElementById('ehsin-severity').value = d.severity_level||'';
    document.getElementById('ehsin-desc').value = d.description||'';
    document.getElementById('ehsin-result').value = d.handling_result||'';
    document.getElementById('ehsin-reporter').value = d.reporter_id||'';
    showModal('modal-ehs-incident');
  });
};

// ========== EHS Hazard ==========
window.loadEhsHazard = function() {
  api('/ehs-hazard', 'GET').then(function(r) {
    var data = r.data||[];
    var rows = data.map(function(d) {
      return [formatDate(d.discovery_date), d.hazard_location||'', d.hazard_type||'', d.severity_level||'', d.description||'', d.control_measures||'', d.responsible_name||'', formatDate(d.deadline), d.status||'',
        '<button class="btn btn-xs btn-primary" onclick="editEhsHazard(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\'ehs-hazard\',\'' + d.id + '\')">删除</button>'];
    });
    renderTable(['发现日期','隐患位置','隐患类型','严重程度','描述','控制措施','责任人','期限','状态','操作'], rows, 'table-ehs-hazard');
  });
};

window.editEhsHazard = function(id) {
  api('/ehs-hazard', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('haz-id').value = id;
    document.getElementById('haz-date').value = d.discovery_date||'';
    document.getElementById('haz-loc').value = d.hazard_location||'';
    document.getElementById('haz-type').value = d.hazard_type||'';
    document.getElementById('haz-severity').value = d.severity_level||'';
    document.getElementById('haz-desc').value = d.description||'';
    document.getElementById('haz-control').value = d.control_measures||'';
    document.getElementById('haz-person').value = d.responsible_person||'';
    document.getElementById('haz-deadline').value = d.deadline||'';
    document.getElementById('haz-status').value = d.status||'pending';
    showModal('modal-ehs-hazard');
  });
};

// ========== Experimental Data Reports ==========
window.loadExperimentalData = function() {
  populateExpReportDropdowns();
  api('/experimental-data-reports', 'GET').then(function(r) {
    var data = r.data||[];
    var statusLabels = { draft:'草稿', pending_review:'待审核', approved:'已审核', archived:'已归档' };
    var statusColors = { draft:'color:#8B6914;', pending_review:'color:#B8860B;', approved:'color:#2D6A80;', archived:'color:#4A6B8A;' };
    var rows = data.map(function(d) {
      var sc = statusColors[d.status] || '';
      var sl = statusLabels[d.status] || d.status || '';
      var pdfLink = d.attachment_path
        ? '<a href="/uploads/' + d.attachment_path + '" target="_blank" style="color:#4A6B8A;">查看PDF</a>'
        : '<span style="color:#aaa;">无</span>';
      return [d.report_no||'', d.sample_code||'', d.project_name||'', formatDate(d.report_date),
        d.detection_method||'', d.analyst_name||'', d.supervisor_name||'',
        d.equip_name||'', d.conclusion||'',
        '<span style="' + sc + '">' + sl + '</span>',
        pdfLink,
        '<button class="btn btn-xs btn-primary" onclick="editExpReport(\'' + d.id + '\')">编辑</button> <button class="btn btn-xs btn-danger" onclick="deleteItem(\x27experimental-data\x27,\x27' + d.id + '\x27)">删除</button>'];
    });
    renderTable(['报告编号','样品编号','项目','报告日期','检测方法','检测员','审核员','设备','结论','状态','PDF','操作'], rows, 'table-experimental-data');
  });
};

window.populateExpReportDropdowns = function() {
  ['edr-project','edr-analyst','edr-supervisor','edr-equip'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (sel) sel.options.length = 1;
  });
  api('/projects', 'GET').then(function(r) {
    var sel = document.getElementById('edr-project');
    (r.data||[]).forEach(function(s) { var o = document.createElement('option'); o.value = s.id; o.textContent = (s.project_no||'') + ' - ' + (s.project_name||''); sel.appendChild(o); });
  });
  api('/personnel', 'GET').then(function(r) {
    var selA = document.getElementById('edr-analyst');
    var selS = document.getElementById('edr-supervisor');
    (r.data||[]).filter(function(u) { return u.status === 'active'; }).forEach(function(u) {
      var oa = document.createElement('option'); oa.value = u.id; oa.textContent = u.name||u.username||''; selA.appendChild(oa);
      var os = document.createElement('option'); os.value = u.id; os.textContent = u.name||u.username||''; selS.appendChild(os);
    });
  });
  api('/equipment', 'GET').then(function(r) {
    var sel = document.getElementById('edr-equip');
    (r.data||[]).forEach(function(e) { var o = document.createElement('option'); o.value = e.id; o.textContent = (e.equip_no||'') + ' - ' + (e.equip_name||''); sel.appendChild(o); });
  });
};

window.editExpReport = function(id) {
  api('/experimental-data-reports', 'GET').then(function(r) {
    var d = (r.data||[]).find(function(x) { return x.id == id; });
    if (!d) return;
    document.getElementById('edr-id').value = id;
    document.getElementById('edr-report-no').value = d.report_no||'';
    document.getElementById('edr-sample-code').value = d.sample_code||'';
    document.getElementById('edr-date').value = d.report_date||'';
    document.getElementById('edr-method').value = d.detection_method||'';
    document.getElementById('edr-result').value = d.result_data||'';
    document.getElementById('edr-conclusion').value = d.conclusion||'';
    document.getElementById('edr-remark').value = d.remark||'';
    document.getElementById('edr-status').value = d.status||'draft';
    document.getElementById('edr-attachment-path').value = d.attachment_path||'';
    document.getElementById('edr-file-name').textContent = d.attachment_path ? ('已上传: ' + d.attachment_path) : '';
    document.getElementById('edr-pdf-upload').value = '';
    populateExpReportDropdowns();
    setTimeout(function() {
      if (d.project_id) document.getElementById('edr-project').value = d.project_id;
      if (d.analyst_id) document.getElementById('edr-analyst').value = d.analyst_id;
      if (d.supervisor_id) document.getElementById('edr-supervisor').value = d.supervisor_id;
      if (d.equipment_id) document.getElementById('edr-equip').value = d.equipment_id;
    }, 100);
    showModal('modal-experimental-data');
  });
};

window.uploadExpPdf = function() {
  var fileInput = document.getElementById('edr-pdf-upload');
  var msgEl = document.getElementById('edr-upload-msg');
  if (!fileInput.files.length) { msgEl.textContent = '请先选择文件'; msgEl.style.color='red'; return; }
  var file = fileInput.files[0];
  if (file.type !== 'application/pdf') { msgEl.textContent = '仅支持PDF'; msgEl.style.color='red'; return; }
  msgEl.textContent = '上传中...';
  msgEl.style.color='#888';
  var formData = new FormData();
  formData.append('pdf', file);
  fetch('/api/experimental-data-reports-upload', { method:'POST', body: formData, credentials:'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.error) { msgEl.textContent = res.error; msgEl.style.color='red'; return; }
      document.getElementById('edr-attachment-path').value = res.filename;
      msgEl.textContent = '上传成功';
      msgEl.style.color='green';
      document.getElementById('edr-file-name').textContent = res.originalName + ' (' + (file.size/1024).toFixed(1) + 'KB)';
    })
    .catch(function() { msgEl.textContent = '上传失败'; msgEl.style.color='red'; });
};

// ========== ALL DOMContentLoaded handlers ==========
document.addEventListener('DOMContentLoaded', function() {
  // 2026-08-03 升级：初始化 Lucide 图标
  if (window.lucide) { try { window.lucide.createIcons(); } catch(e) { console.warn('lucide init failed:', e); } }


  // ---- LOGIN ----
  api('/auth/session', 'GET').then(function(r) {
    if (r.user) {
      currentUser = r.user;
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('main-ui').style.display = 'block';
      document.getElementById('user-name').textContent = r.user.name;
      switchTab('home');
    }
  });

  document.getElementById('btn-login').addEventListener('click', function() {
    var u = document.getElementById('login-username').value;
    var p = document.getElementById('login-password').value;
    if (!u || !p) { showMessage('请输入用户名和密码', 'warning'); return; }
    api('/auth/login', 'POST', { username: u, password: p }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      currentUser = r.user;
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('main-ui').style.display = 'block';
      document.getElementById('user-name').textContent = r.user.name;
      switchTab('home');
    });
  });

  document.getElementById('btn-logout').addEventListener('click', function() {
    api('/auth/logout', 'POST').then(function() {
      currentUser = null;
      location.reload();
    });
  });

  document.querySelectorAll('.sidebar a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab(this.getAttribute('href').slice(1));
    });
  });

  // ---- PERSONNEL ----
  var formPersonnel = document.getElementById('form-personnel');
  if (formPersonnel) formPersonnel.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('personnel-id').value;
    var body = {
      username: document.getElementById('personnel-username').value,
      name: document.getElementById('personnel-name').value,
      dept: document.getElementById('personnel-dept').value,
      role: document.getElementById('personnel-role').value,
      email: document.getElementById('personnel-email').value,
      phone: document.getElementById('personnel-phone').value,
      position: document.getElementById('personnel-position').value,
      status: document.getElementById('personnel-status').value
    };
    if (!id) {
      var pw = document.getElementById('personnel-password').value;
      if (!pw) { alert('密码为必填项'); return; }
      body.password = pw;
    } else {
      var pw = document.getElementById('personnel-password').value;
      if (pw) body.password = pw;
    }
    api(id ? '/personnel/' + id : '/personnel', id ? 'PUT' : 'POST', body).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-personnel');
      loadPersonnel();
    });
  });

  // ---- DEPARTMENTS ----
  var formDept = document.getElementById('form-departments');
  if (formDept) formDept.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('dept-id').value;
    api(id ? '/departments/' + id : '/departments', id ? 'PUT' : 'POST', {
      dept_no: document.getElementById('dept-no').value,
      name: document.getElementById('dept-name').value,
      parent_id: document.getElementById('dept-parent').value || null,
      phone: document.getElementById('dept-phone').value,
      status: document.getElementById('dept-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-departments');
      loadDepartments();
    });
  });

  // ---- PROJECTS ----
  var formProject = document.getElementById('form-projects');
  if (formProject) formProject.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('project-id').value;
    api(id ? '/projects/' + id : '/projects', id ? 'PUT' : 'POST', {
      project_no: document.getElementById('project-no').value,
      project_name: document.getElementById('project-name').value,
      method_type: document.getElementById('project-method').value,
      description: document.getElementById('project-desc').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-projects');
      loadProjects();
    });
  });

  // ---- APPOINTMENTS ----
  var formAppt = document.getElementById('form-appointments');
  if (formAppt) formAppt.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('appt-id').value;
    api(id ? '/appointments/' + id : '/appointments', id ? 'PUT' : 'POST', {
      appointment_no: document.getElementById('appt-no').value,
      client_name: document.getElementById('appt-client').value,
      sample_type: document.getElementById('appt-type').value,
      expected_date: document.getElementById('appt-date').value,
      contact_person: document.getElementById('appt-contact').value,
      contact_phone: document.getElementById('appt-phone').value,
      status: document.getElementById('appt-status').value,
      remark: document.getElementById('appt-remark').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-appointments');
      loadAppointments();
    });
  });

  // ---- SAMPLE PROCESSING ----
  var formSample = document.getElementById('form-sample-processing');
  if (formSample) formSample.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('sample-id').value;
    var operatorId = document.getElementById('sample-operator-id').value;
    api(id ? '/sample-processing/' + id : '/sample-processing', id ? 'PUT' : 'POST', {
      sample_code: document.getElementById('sample-code').value,
      sample_name: document.getElementById('sample-name').value,
      sample_type: document.getElementById('sample-type').value,
      packaging_intact: document.getElementById('sample-packaging').value,
      processing_method: document.getElementById('sample-method').value,
      detection_method: document.getElementById('sample-detection').value,
      processing_date: document.getElementById('sample-date').value,
      processing_desc: document.getElementById('sample-desc').value,
      result_data: document.getElementById('sample-result').value,
      result_conclusion: document.getElementById('sample-conclusion').value,
      report_no: document.getElementById('sample-report').value,
      environment_temp: document.getElementById('sample-env-temp').value || null,
      environment_humidity: document.getElementById('sample-env-humidity').value || null,
      equipment_id: document.getElementById('sample-equip-id').value || null,
      operator_id: operatorId || null,
      supervisor_id: document.getElementById('sample-supervisor-id').value || null,
      consumables_used: document.getElementById('sample-consumables').value || '',
      reagents_used: document.getElementById('sample-reagents').value || '',
      gases_used: document.getElementById('sample-gases').value || ''
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-sample-processing');
      loadSampleProcessing();
    });
  });

  // ---- EQUIPMENT ----
  var formEquip = document.getElementById('form-equipment');
  if (formEquip) formEquip.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('equip-id').value;
    api(id ? '/equipment/' + id : '/equipment', id ? 'PUT' : 'POST', {
      equip_no: document.getElementById('equip-no').value,
      equip_name: document.getElementById('equip-name').value,
      model: document.getElementById('equip-model').value,
      manufacturer: document.getElementById('equip-mfr').value,
      purchase_date: document.getElementById('equip-date').value,
      purchase_price: document.getElementById('equip-price').value,
      current_value: document.getElementById('equip-value').value,
      location: document.getElementById('equip-location').value,
      dept_id: (document.getElementById('equip-dept')||{}).value || null,
      status: document.getElementById('equip-status').value,
      responsible_person: (document.getElementById('equip-responsible')||{}).value || null
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-equipment');
      loadEquipment();
    });
  });

  // ---- MAINTENANCE ----
  var formMaint = document.getElementById('form-maintenance');
  if (formMaint) formMaint.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('maint-id').value;
    api(id ? '/maintenance/' + id : '/maintenance', id ? 'PUT' : 'POST', {
      equip_id: document.getElementById('maint-equip').value,
      maintenance_date: document.getElementById('maint-date').value,
      maintenance_type: document.getElementById('maint-type').value,
      maintainer: document.getElementById('maint-person').value,
      cost: document.getElementById('maint-cost').value,
      description: document.getElementById('maint-desc').value,
      next_maintenance_date: document.getElementById('maint-next').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-maintenance');
      loadMaintenance();
    });
  });

  // ---- CALIBRATION ----
  var formCalib = document.getElementById('form-calibration');
  if (formCalib) formCalib.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('calib-id').value;
    api(id ? '/calibration/' + id : '/calibration', id ? 'PUT' : 'POST', {
      equip_id: document.getElementById('calib-equip').value,
      calibration_date: document.getElementById('calib-date').value,
      calibration_org: document.getElementById('calib-org').value,
      certificate_no: document.getElementById('calib-cert').value,
      valid_date: document.getElementById('calib-valid').value,
      result: document.getElementById('calib-result').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-calibration');
      loadCalibration();
    });
  });

  // ---- EQUIPMENT REPAIRS ----
  var formRepair = document.getElementById('form-equipment-repairs');
  if (formRepair) formRepair.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('repair-id').value;
    api(id ? '/equipment-repairs/' + id : '/equipment-repairs', id ? 'PUT' : 'POST', {
      equip_id: document.getElementById('repair-equip').value,
      repair_date: document.getElementById('repair-date').value,
      fault_desc: document.getElementById('repair-fault').value,
      repair_action: document.getElementById('repair-action').value,
      repairer: document.getElementById('repair-person').value,
      cost: document.getElementById('repair-cost').value,
      result: document.getElementById('repair-result').value,
      next_inspection_date: document.getElementById('repair-next').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-equipment-repairs');
      loadEquipmentRepairs();
    });
  });

  // ---- CONSUMABLES ----
  var formCons = document.getElementById('form-consumables');
  if (formCons) formCons.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('cons-id').value;
    api(id ? '/consumables/' + id : '/consumables', id ? 'PUT' : 'POST', {
      item_name: document.getElementById('cons-name').value,
      specification: document.getElementById('cons-spec').value,
      unit: document.getElementById('cons-unit').value,
      category: document.getElementById('cons-cat').value,
      min_stock: document.getElementById('cons-min').value,
      current_stock: document.getElementById('cons-stock').value,
      location: document.getElementById('cons-loc').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-consumables');
      loadConsumables();
    });
  });

  // ---- GLASSWARE ----
  var formGlass = document.getElementById('form-glassware');
  if (formGlass) formGlass.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('glass-id').value;
    api(id ? '/glassware/' + id : '/glassware', id ? 'PUT' : 'POST', {
      item_name: document.getElementById('glass-name').value,
      specification: document.getElementById('glass-spec').value,
      material: document.getElementById('glass-material').value,
      unit: document.getElementById('glass-unit').value,
      current_stock: document.getElementById('glass-stock').value,
      location: document.getElementById('glass-loc').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-glassware');
      loadGlassware();
    });
  });

  // ---- REAGENTS ----
  var formReag = document.getElementById('form-reagents');
  if (formReag) formReag.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('reag-id').value;
    api(id ? '/reagents/' + id : '/reagents', id ? 'PUT' : 'POST', {
      reagent_name: document.getElementById('reag-name').value,
      cas_no: document.getElementById('reag-cas').value,
      formula: document.getElementById('reag-formula').value,
      purity: document.getElementById('reag-purity').value,
      manufacturer: document.getElementById('reag-mfr').value,
      supplier: document.getElementById('reag-supplier').value,
      location: document.getElementById('reag-location').value,
      current_stock: document.getElementById('reag-stock').value,
      unit: document.getElementById('reag-unit').value,
      min_stock: document.getElementById('reag-min').value,
      status: document.getElementById('reag-status').value,
      expiry_date: document.getElementById('reag-expiry').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-reagents');
      loadReagents();
    });
  });

  // ---- GASES ----
  var formGas = document.getElementById('form-gases');
  if (formGas) formGas.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('gas-id').value;
    api(id ? '/gases/' + id : '/gases', id ? 'PUT' : 'POST', {
      gas_name: document.getElementById('gas-name').value,
      purity: document.getElementById('gas-purity').value,
      manufacturer: document.getElementById('gas-mfr').value,
      supplier: document.getElementById('gas-supplier').value,
      current_stock: document.getElementById('gas-stock').value,
      unit: document.getElementById('gas-unit').value,
      min_stock: document.getElementById('gas-min').value,
      location: document.getElementById('gas-loc').value,
      status: document.getElementById('gas-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-gases');
      loadGases();
    });
  });


  // ---- FUMEHOOD ----
  var formFh = document.getElementById('form-fumehood');
  if (formFh) formFh.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('fh-id').value;
    api(id ? '/fumehood/' + id : '/fumehood', id ? 'PUT' : 'POST', {
      equip_no: document.getElementById('fh-no').value,
      equip_name: document.getElementById('fh-name').value,
      location: document.getElementById('fh-location').value,
      model: document.getElementById('fh-brand').value.split(' / ')[0]||'',
      manufacturer: document.getElementById('fh-brand').value.split(' / ')[1]||'',
      wind_speed: document.getElementById('fh-speed').value||'',
      last_inspection_date: document.getElementById('fh-calib').value||'',
      status: document.getElementById('fh-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-fumehood');
      loadFumehood();
    });
  });

  // ---- TRAINING ----
  var formTr = document.getElementById('form-training');
  if (formTr) formTr.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('tr-id').value;
    api(id ? '/training-records/' + id : '/training-records', id ? 'PUT' : 'POST', {
      trainer_name: document.getElementById('tr-trainer').value,
      training_content: document.getElementById('tr-content').value,
      training_date: document.getElementById('tr-date').value,
      participant_names: document.getElementById('tr-participants').value,
      result: document.getElementById('tr-result').value,
      certificate_no: document.getElementById('tr-cert').value,
      expiry_date: document.getElementById('tr-expiry').value,
      status: document.getElementById('tr-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-training');
      loadTraining();
    });
  });

  // ---- EHS INSPECTION ----
  var formEhsi = document.getElementById('form-ehs-inspection');
  if (formEhsi) formEhsi.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('ehsi-id').value;
    api(id ? '/ehs-inspection/' + id : '/ehs-inspection', id ? 'PUT' : 'POST', {
      inspection_date: document.getElementById('ehsi-date').value,
      inspector_name: document.getElementById('ehsi-inspector').value,
      inspection_area: document.getElementById('ehsi-area').value,
      overall_status: document.getElementById('ehsi-status').value,
      findings: document.getElementById('ehsi-findings').value,
      next_inspection_date: document.getElementById('ehsi-next').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-ehs-inspection');
      loadEhsInspection();
    });
  });

  // ---- EHS INCIDENT ----
  var formEhsin = document.getElementById('form-ehs-incident');
  if (formEhsin) formEhsin.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('ehsin-id').value;
    api(id ? '/ehs-incident/' + id : '/ehs-incident', id ? 'PUT' : 'POST', {
      incident_date: document.getElementById('ehsin-date').value,
      incident_type: document.getElementById('ehsin-type').value,
      location: document.getElementById('ehsin-loc').value,
      severity_level: document.getElementById('ehsin-severity').value,
      description: document.getElementById('ehsin-desc').value,
      handling_result: document.getElementById('ehsin-result').value,
      reporter_id: document.getElementById('ehsin-reporter').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-ehs-incident');
      loadEhsIncident();
    });
  });

  // ---- EHS HAZARD ----
  var formHaz = document.getElementById('form-ehs-hazard');
  if (formHaz) formHaz.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('haz-id').value;
    api(id ? '/ehs-hazard/' + id : '/ehs-hazard', id ? 'PUT' : 'POST', {
      discovery_date: document.getElementById('haz-date').value,
      hazard_location: document.getElementById('haz-loc').value,
      hazard_type: document.getElementById('haz-type').value,
      severity_level: document.getElementById('haz-severity').value,
      description: document.getElementById('haz-desc').value,
      control_measures: document.getElementById('haz-control').value,
      responsible_person: document.getElementById('haz-person').value,
      deadline: document.getElementById('haz-deadline').value,
      status: document.getElementById('haz-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-ehs-hazard');
      loadEhsHazard();
    });
  });

  // ---- EXPERIMENTAL DATA REPORTS ----
  var formExpReport = document.getElementById('form-experimental-data');
  if (formExpReport) formExpReport.addEventListener('submit', function(e) {
    e.preventDefault();
    var id = document.getElementById('edr-id').value;
    var selProject = document.getElementById('edr-project');
    var selAnalyst = document.getElementById('edr-analyst');
    var selSupervisor = document.getElementById('edr-supervisor');
    var selEquip = document.getElementById('edr-equip');
    api(id ? '/experimental-data-reports/' + id : '/experimental-data-reports', id ? 'PUT' : 'POST', {
      report_no: document.getElementById('edr-report-no').value,
      sample_code: document.getElementById('edr-sample-code').value,
      project_id: selProject ? selProject.value : '',
      report_date: document.getElementById('edr-date').value,
      detection_method: document.getElementById('edr-method').value,
      analyst_id: selAnalyst ? selAnalyst.value : '',
      supervisor_id: selSupervisor ? selSupervisor.value : '',
      equipment_id: selEquip ? selEquip.value : '',
      result_data: document.getElementById('edr-result').value,
      conclusion: document.getElementById('edr-conclusion').value,
      remark: document.getElementById('edr-remark').value,
      attachment_path: document.getElementById('edr-attachment-path').value,
      status: document.getElementById('edr-status').value
    }).then(function(r) {
      if (r.error) { showMessage(r.error, 'danger'); return; }
      showMessage('保存成功', 'success');
      hideModal('modal-experimental-data');
      loadExperimentalData();
    });
  });

}); // end DOMContentLoaded

// ========== Workflow DOMContentLoaded handlers ==========
document.addEventListener('DOMContentLoaded', function() {
});

// 2026-08-03 升级：每次切换页面后重新初始化 Lucide 图标（DOM 是动态的）
function refreshLucideIcons() {
  if (window.lucide) {
    try { window.lucide.createIcons(); } catch(e) { /* ignore */ }
  }
}
// Hook into hashchange (page switch)
window.addEventListener('hashchange', function() {
  setTimeout(refreshLucideIcons, 50);
});

// ---------- 折叠菜单 P1-1 ----------
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.nav-group-toggle').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var group = btn.closest('.nav-group');
      var children = group.querySelector('.nav-group-children');
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (children) children.style.display = expanded ? 'none' : '';
      var chevron = btn.querySelector('.nav-chevron i');
      if (chevron) chevron.style.transform = expanded ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
  });
});

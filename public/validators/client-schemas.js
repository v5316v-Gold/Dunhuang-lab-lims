/**
 * 客户端 zod schemas（MVP - 人员 + 设备）
 * 2026-08-03 任务 D
 *
 * 后端 schemas 来源: D:\lab lims\lims_project\validators\schemas.js
 * 简化版（只保留 2 个核心表单）
 */

// 等待 zod 加载
window.LIMS_SCHEMAS = {};


// ===== 枚举加载 (阶段 1.1 - 2026-08-11) =====
if (!window.LIMS_ENUMS) window.LIMS_ENUMS = {};

window.LIMS_ENUMS.metals = {
  ALL: (typeof LIMS_ENUMS_PRECIOUS_METALS !== 'undefined') ? LIMS_ENUMS_PRECIOUS_METALS : (window.LIMS_ENUMS && window.LIMS_ENUMS.metals && window.LIMS_ENUMS.metals.ALL) ? window.LIMS_ENUMS.metals.ALL : [],
  byCode: function(code) {
    var arr = (typeof LIMS_ENUMS_PRECIOUS_METALS !== 'undefined') ? LIMS_ENUMS_PRECIOUS_METALS : (window.LIMS_ENUMS && window.LIMS_ENUMS.metals && window.LIMS_ENUMS.metals.ALL) ? window.LIMS_ENUMS.metals.ALL : [];
    return arr.find(function(m) { return m.code === code; });
  },
  bySymbol: function(symbol) { return (window.LIMS_ENUMS_PRECIOUS_METALS || []).find(function(m) { return m.symbol === symbol; }); }
};

window.LIMS_ENUMS.materialTypes = {
  ALL: window.LIMS_ENUMS_MATERIAL_TYPES || [],
  byCode: function(code) { return (window.LIMS_ENUMS_MATERIAL_TYPES || []).find(function(m) { return m.code === code; }); }
};

window.LIMS_ENUMS.detectionMethods = {
  ALL: window.LIMS_ENUMS_DETECTION_METHODS || [],
  byCode: function(code) { return (window.LIMS_ENUMS_DETECTION_METHODS || []).find(function(m) { return m.code === code; }); }
};

window.LIMS_ENUMS.sampleForms = {
  ALL: window.LIMS_ENUMS_SAMPLE_FORMS || [],
  byCode: function(code) { return (window.LIMS_ENUMS_SAMPLE_FORMS || []).find(function(m) { return m.code === code; }); }
};

// 8 岗位 RBAC (阶段 1.2) - 与后端 lib/rbac.js 同步
window.LIMS_ENUMS.roles = {
  ALL: window.LIMS_ENUMS_ROLES || [],
  PERMISSIONS: window.LIMS_ENUMS_PERMISSIONS || {},
  byCode: function(code) { return (window.LIMS_ENUMS_ROLES || []).find(function(r) { return r.code === code; }); },
  byId: function(id) { return (window.LIMS_ENUMS_ROLES || []).find(function(r) { return r.id === id; }); },
  canDo: function(rank, permKey) {
    var perm = (window.LIMS_ENUMS_PERMISSIONS || {})[permKey];
    if (!perm) return false;
    return rank <= perm.rank;
  }
};

window.LIMS_ENUMS.combos = (function() {
  var total = (window.LIMS_ENUMS.metals.ALL.length)
            * (window.LIMS_ENUMS.materialTypes.ALL.length)
            * (window.LIMS_ENUMS.detectionMethods.ALL.length)
            * (window.LIMS_ENUMS.sampleForms.ALL.length);
  return {
    totalScenarios: total,
    listAll: function() {
      var out = [];
      window.LIMS_ENUMS.metals.ALL.forEach(function(m) {
        window.LIMS_ENUMS.materialTypes.ALL.forEach(function(mat) {
          window.LIMS_ENUMS.detectionMethods.ALL.forEach(function(method) {
            window.LIMS_ENUMS.sampleForms.ALL.forEach(function(form) {
              out.push({
                metal: m, material: mat, method: method, form: form,
                code: m.code + '|' + mat.code + '|' + method.code + '|' + form.code
              });
            });
          });
        });
      });
      return out;
    }
  };
})();

console.log('[ENUMS] 阶段 1.1+1.2 枚举已加载:');


// 2026-08-11 全局错误处理（消除 Unchecked runtime.lastError）
window.addEventListener('error', function(e) {
  if (e.message && e.message.includes('message channel')) return; // 忽略扩展消息
  console.warn('[GLOBAL ERROR]', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
  console.warn('[UNHANDLED PROMISE]', e.reason);
  e.preventDefault();
});

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof zod === 'undefined') {
      console.info('[ZOD] 未加载（可能是 CDN 阻塞或 CSP 限制），跳过客户端校验——服务器端仍会校验');
      return;
    }
    var z = zod.z;

    // ===== 人员 schema =====
    window.LIMS_SCHEMAS.personnel = z.object({
      name: z.string().min(1, '姓名必填').max(50, '姓名不超过 50 字'),
      dept: z.string().optional().default(''),
      title: z.string().optional().default(''),
      phone: z.string().regex(/^[0-9\-+()\s]*$/, '电话格式不正确').optional().or(z.literal('')),
      email: z.string().email('邮箱格式不正确').optional().or(z.literal(''))
    });

    // ===== 设备 schema =====
    window.LIMS_SCHEMAS.equipment = z.object({
      equip_no: z.string().min(1, '设备编号必填').max(50, '设备编号不超过 50 字'),
      equip_name: z.string().min(1, '设备名称必填').max(100, '设备名称不超过 100 字'),
      model: z.string().optional().default(''),
      manufacturer: z.string().optional().default(''),
      location: z.string().optional().default('')
    });
    // ===== 11 个新 schema（修复 25）=====
    window.LIMS_SCHEMAS.departments = z.object({
      name: z.string().min(1, '部门名称必填').max(100, '部门名称不超过 100 字')
    });

    window.LIMS_SCHEMAS.projects = z.object({
      project_no: z.string().min(1, '项目编号必填').max(50, '项目编号不超过 50 字'),
      project_name: z.string().min(1, '项目名称必填').max(200, '项目名称不超过 200 字'),
      method_type: z.string().optional().default(''),
      description: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.appointments = z.object({
      appointment_no: z.string().min(1, '预约编号必填').max(50, '预约编号不超过 50 字'),
      client_name: z.string().min(1, '客户名称必填').max(200, '客户名称不超过 200 字'),
      sample_type: z.string().optional().default(''),
      expected_date: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS['sample-processing'] = z.object({
      sample_code: z.string().min(1, '样品编号必填').max(50, '样品编号不超过 50 字'),
      sample_name: z.string().min(1, '样品名称必填').max(200, '样品名称不超过 200 字'),
      sample_type: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.maintenance = z.object({
      equip_id: z.string().min(1, '设备 ID 必填'),
      maintenance_type: z.string().min(1, '维护类型必填'),
      maintenance_date: z.string().min(1, '维护日期必填 (YYYY-MM-DD)')
    });

    window.LIMS_SCHEMAS.calibration = z.object({
      equip_id: z.string().min(1, '设备 ID 必填'),
      calibration_date: z.string().min(1, '校准日期必填'),
      calibration_org: z.string().min(1, '校准机构必填')
    });

    window.LIMS_SCHEMAS['equipment-repairs'] = z.object({
      equip_id: z.string().min(1, '设备 ID 必填'),
      repair_date: z.string().min(1, '维修日期必填'),
      fault_desc: z.string().min(1, '故障描述必填')
    });

    window.LIMS_SCHEMAS.consumables = z.object({
      item_name: z.string().min(1, '耗材名称必填').max(200, '耗材名称不超过 200 字'),
      specification: z.string().optional().default(''),
      unit: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.glassware = z.object({
      item_name: z.string().min(1, '玻璃器皿名称必填').max(200, '名称不超过 200 字'),
      specification: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.reagents = z.object({
      reagent_name: z.string().min(1, '试剂名称必填').max(200, '试剂名称不超过 200 字'),
      cas_no: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.gases = z.object({
      gas_name: z.string().min(1, '气体名称必填').max(200, '气体名称不超过 200 字'),
      specification: z.string().optional().default('')
    });

    window.LIMS_SCHEMAS.fumehood = z.object({
      fumehood_no: z.string().min(1, '通风柜编号必填').max(50, '通风柜编号不超过 50 字'),
      location: z.string().min(1, '位置必填')
    });

    window.LIMS_SCHEMAS.training = z.object({
      training_name: z.string().min(1, '培训名称必填').max(200, '培训名称不超过 200 字'),
      training_date: z.string().min(1, '培训日期必填 (YYYY-MM-DD)')
    });



    /**
     * 通用校验函数
     * @param {string} schemaName - LIMS_SCHEMAS 的 key
     * @param {object} formData - 表单数据
     * @returns {{ valid: boolean, errors: string[] }}
     */
    window.validateForm = function(schemaName, formData) {
      var schema = window.LIMS_SCHEMAS[schemaName];
      if (!schema) {
        console.warn('[VALIDATE] schema 不存在:', schemaName);
        return { valid: true, errors: [] };
      }
      var result = schema.safeParse(formData);
      if (result.success) {
        return { valid: true, errors: [] };
      }
      var errors = result.error.issues.map(function(i) {
        return (i.path.join('.') || '字段') + ': ' + i.message;
      });
      return { valid: false, errors: errors };
    };

    /**
     * 在表单字段下显示错误
     * @param {string} formSelector - '#form-personnel'
     * @param {string[]} errors
     */
    window.showFormErrors = function(formSelector, errors) {
      // 清旧错误
      var form = document.querySelector(formSelector);
      if (!form) return;
      form.querySelectorAll('.field-error').forEach(function(e) { e.remove(); });
      
      // 移除旧 alert
      var oldAlert = form.parentNode.querySelector('.form-error-alert');
      if (oldAlert) oldAlert.remove();
      
      if (errors.length === 0) return;
      
      // 显示 alert
      var alert = document.createElement('div');
      alert.className = 'form-error-alert';
      alert.style.cssText = 'background:#fde8e8;color:#A0522D;padding:10px 14px;border-radius:6px;margin-bottom:12px;border-left:4px solid #A0522D;';
      alert.innerHTML = '<strong>表单有 ' + errors.length + ' 个错误：</strong><ul style="margin:6px 0 0 18px;">' +
        errors.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ul>';
      form.parentNode.insertBefore(alert, form);
    };

    console.log('[ZOD] 客户端校验 schemas 已加载 (人员 + 设备)');
  }, 200);
});

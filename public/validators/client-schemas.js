/**
 * 客户端 zod schemas（MVP - 人员 + 设备）
 * 2026-08-03 任务 D
 *
 * 后端 schemas 来源: D:\lab lims\lims_project\validators\schemas.js
 * 简化版（只保留 2 个核心表单）
 */

// 等待 zod 加载
window.LIMS_SCHEMAS = {};

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof zod === 'undefined') {
      console.warn('[ZOD] 未加载，跳过客户端校验');
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

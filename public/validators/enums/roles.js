/**
 * 8 岗位 RBAC 枚举 (阶段 1.2)
 * 依据: server.js lib/rbac.js
 * 与后端 seedRoles 严格一致
 *
 * rank 越小权限越高:
 *   1 = 实验室主任 (最高)
 *   7 = 兼职 (最低)
 */

window.LIMS_ENUMS_ROLES = [
  { id: 1, code: 'lab_director',      name_zh: '实验室主任', name_en: 'Lab Director',      rank: 1, is_technical: 1, is_signatory: 1, signatory_level: 3 },
  { id: 2, code: 'qa_manager',        name_zh: '质量负责人', name_en: 'QA Manager',        rank: 2, is_technical: 1, is_signatory: 1, signatory_level: 3 },
  { id: 3, code: 'technical_manager', name_zh: '技术负责人', name_en: 'Technical Manager', rank: 3, is_technical: 1, is_signatory: 1, signatory_level: 2 },
  { id: 4, code: 'analyst',           name_zh: '检测员',     name_en: 'Analyst',            rank: 4, is_technical: 1, is_signatory: 0, signatory_level: 0 },
  { id: 5, code: 'reviewer',          name_zh: '复核员',     name_en: 'Reviewer',           rank: 4, is_technical: 1, is_signatory: 1, signatory_level: 2 },
  { id: 6, code: 'equipment_officer', name_zh: '设备员',     name_en: 'Equipment Officer',  rank: 5, is_technical: 0, is_signatory: 0, signatory_level: 0 },
  { id: 7, code: 'reagent_officer',   name_zh: '试剂员',     name_en: 'Reagent Officer',    rank: 5, is_technical: 0, is_signatory: 0, signatory_level: 0 },
  { id: 8, code: 'part_time',         name_zh: '兼职',       name_en: 'Part-time',          rank: 7, is_technical: 0, is_signatory: 0, signatory_level: 0 }
];

// 18 权限定义 (与 lib/rbac.js 一致)
window.LIMS_ENUMS_PERMISSIONS = {
  'equipment:read':     { rank: 4, label: '设备查看' },
  'equipment:create':   { rank: 4, label: '设备新增' },
  'equipment:update':   { rank: 4, label: '设备修改' },
  'equipment:delete':   { rank: 1, label: '设备删除', signatory: 1 },
  'sample:read':        { rank: 4, label: '样品查看' },
  'sample:create':      { rank: 4, label: '样品接收' },
  'sample:update':      { rank: 4, label: '样品修改' },
  'sample:dispose':     { rank: 3, label: '样品处置', signatory: 1 },
  'test:read':          { rank: 4, label: '检测查看' },
  'test:create':        { rank: 4, label: '检测分配' },
  'test:submit':        { rank: 4, label: '结果提交' },
  'test:approve':       { rank: 2, label: '检测审核', signatory: 2 },
  'report:read':        { rank: 4, label: '报告查看' },
  'report:create':      { rank: 2, label: '报告签发', signatory: 3 },
  'report:sign':        { rank: 2, label: '报告签字', signatory: 3 },
  'report:correct':     { rank: 2, label: '报告修订', signatory: 2 },
  'report:void':        { rank: 1, label: '报告作废', signatory: 3 },
  'nc:read':            { rank: 4, label: '不符合查看' },
  'nc:create':          { rank: 4, label: '不符合录入' },
  'nc:close':           { rank: 2, label: '不符合关闭', signatory: 2 }
};

// 注册到 LIMS_ENUMS
if (window.LIMS_ENUMS) {
  window.LIMS_ENUMS.roles = {
    ALL: window.LIMS_ENUMS_ROLES,
    PERMISSIONS: window.LIMS_ENUMS_PERMISSIONS,
    byCode: function(code) { return window.LIMS_ENUMS_ROLES.find(function(r) { return r.code === code; }); },
    byId: function(id) { return window.LIMS_ENUMS_ROLES.find(function(r) { return r.id === id; }); },
    canDo: function(rank, permKey) {
      var perm = window.LIMS_ENUMS_PERMISSIONS[permKey];
      if (!perm) return false;
      return rank <= perm.rank;
    },
    canSign: function(role, requiredLevel) {
      return role.is_signatory === 1 && role.signatory_level >= requiredLevel;
    }
  };
}

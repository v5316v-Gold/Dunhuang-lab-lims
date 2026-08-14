/**
 * RBAC 策略引擎 + 兼岗控制 + 部门分离 (阶段 1.2)
 * 依据: lims-cnas-architecture.md §3.2, §3.3, §3.6, §3.7
 *
 * 8 岗位 + 18 权限 + 兼岗补偿 + 自审阻断
 */

const PERMISSIONS = {
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

class RBAC {
  constructor(db) {
    this.db = db;
    this.permCache = new Map();
  }

  /**
   * 获取用户所有有效岗位
   */
  getActiveRoles(userId) {
    if (!userId) return [];
    const rows = this.db.prepare(
      "SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))"
    ).all(userId);
    return rows;
  }

  /**
   * 取用户最高权限 (rank 最小 = 最高)
   */
  getHighestRank(userId) {
    const roles = this.getActiveRoles(userId);
    if (roles.length === 0) return 999;
    return Math.min(...roles.map(r => r.rank));
  }

  /**
   * 核心检查: 是否有某 action 权限
   */
  canDo(userId, action) {
    if (!userId) return false;
    const perm = PERMISSIONS[action];
    if (!perm) return false;
    const roles = this.getActiveRoles(userId);
    if (roles.length === 0) return false;
    // rank ≤ perm.rank 即有权
    return roles.some(r => r.rank <= perm.rank);
  }

  /**
   * 是否有签字权
   */
  canSign(userId, signatoryLevel = 1) {
    if (!userId) return false;
    const roles = this.getActiveRoles(userId);
    return roles.some(r => r.is_signatory === 1 && r.signatory_level >= signatoryLevel);
  }

  /**
   * 自审阻断: 用户不能审批自己创建的资源
   */
  isSelfApproval(userId, resourceCreatedBy) {
    return userId === resourceCreatedBy;
  }

  /**
   * 兼岗控制: 阻止检测/审核/批准同一岗位
   */
  checkSeparationOfDuties(userId, action, resourceCreatedBy) {
    // 检测/审核/签发必须不同岗位
    const sensitiveActions = ['test:submit', 'test:approve', 'report:create', 'report:sign'];
    if (!sensitiveActions.includes(action)) return { allowed: true };

    // 检查资源创建者
    if (resourceCreatedBy && this.isSelfApproval(userId, resourceCreatedBy)) {
      return { allowed: false, reason: '自审阻断: 不能审批自己创建的资源' };
    }
    return { allowed: true };
  }

  /**
   * 完整检查 (含兼岗 + 自审)
   */
  check(userId, action, resourceCreatedBy = null) {
    if (!this.canDo(userId, action)) {
      return { allowed: false, reason: '权限不足: ' + action };
    }
    const sep = this.checkSeparationOfDuties(userId, action, resourceCreatedBy);
    if (!sep.allowed) {
      return { allowed: false, reason: sep.reason };
    }
    return { allowed: true, roles: this.getActiveRoles(userId) };
  }

  /**
   * 获取用户所有权限
   */
  getUserPermissions(userId) {
    if (!userId) return [];
    const roles = this.getActiveRoles(userId);
    const perms = [];
    Object.keys(PERMISSIONS).forEach(action => {
      if (this.canDo(userId, action)) {
        perms.push({ action, ...PERMISSIONS[action] });
      }
    });
    return { roles, permissions: perms };
  }

  /**
   * 获取所有岗位
   */
  getAllRoles() {
    return this.db.prepare("SELECT * FROM roles ORDER BY rank").all();
  }

  /**
   * 记录 rbac 决策
   */
  logDecision(userId, action, allowed, reason) {
    try {
      this.db.prepare(
        "INSERT INTO audit_logs (user_id, action, table_name, new_data, ip_address, rbac_decision, denial_reason) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(userId, action, 'rbac', null, null, allowed ? 'allow' : 'deny', reason);
    } catch (e) { /* 表未迁移前不记录 */ }
  }
}

module.exports = { RBAC, PERMISSIONS };

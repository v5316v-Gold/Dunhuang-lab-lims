/**
 * 权限 API (阶段 1.2)
 * 依据: lims-cnas-architecture.md §3.4
 */
const express = require('express');
const router = express.Router();
const { RBAC, PERMISSIONS } = require('../lib/rbac');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '未登录' });
  next();
}

let rbacInstance = null;
function getRbac(req) {
  if (!rbacInstance) {
    // 优先用 app.locals.db (新方式)，否则 global.db (老方式兼容)
    const db = req.app.locals.db || global.db;
    rbacInstance = new RBAC(db);
  }
  return rbacInstance;
}

// GET /api/permissions/me - 当前用户权限
router.get('/me', requireAuth, (req, res) => {
  const rbac = getRbac(req);
  const data = rbac.getUserPermissions(req.session.userId);
  res.json({ success: true, data, user: { id: req.session.userId, name: req.session.userName } });
});

// GET /api/permissions/roles - 8 岗位
router.get('/roles', requireAuth, (req, res) => {
  const rbac = getRbac(req);
  res.json({ success: true, data: rbac.getAllRoles() });
});

// GET /api/permissions/users/:id/roles - 某用户岗位
router.get('/users/:id/roles', requireAuth, (req, res) => {
  const rbac = getRbac(req);
  res.json({ success: true, data: rbac.getActiveRoles(parseInt(req.params.id)) });
});

// POST /api/permissions/users/:id/roles - 分配岗位
router.post('/users/:id/roles', requireAuth, (req, res) => {
  const rbac = getRbac(req);
  if (!rbac.canDo(req.session.userId, 'nc:close')) {
    return res.status(403).json({ error: '权限不足: 仅质量负责人可分配岗位' });
  }
  const { role_id, scope, expires_at } = req.body;
  if (!role_id) return res.status(400).json({ error: 'role_id 必填' });
  try {
    rbac.db.prepare(
      "INSERT OR IGNORE INTO user_roles (user_id, role_id, scope, granted_by, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).run(parseInt(req.params.id), role_id, scope || null, req.session.userId, expires_at || null);
    rbac.logDecision(req.session.userId, 'rbac:grant_role:' + role_id, true, null);
    res.json({ success: true });
  } catch (e) {
    rbac.logDecision(req.session.userId, 'rbac:grant_role:' + role_id, false, e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/permissions/users/:id/roles/:role_id
router.delete('/users/:id/roles/:role_id', requireAuth, (req, res) => {
  const rbac = getRbac(req);
  if (!rbac.canDo(req.session.userId, 'nc:close')) {
    return res.status(403).json({ error: '权限不足' });
  }
  rbac.db.prepare("DELETE FROM user_roles WHERE user_id=? AND role_id=?")
    .run(parseInt(req.params.id), parseInt(req.params.role_id));
  rbac.logDecision(req.session.userId, 'rbac:revoke_role:' + req.params.role_id, true, null);
  res.json({ success: true });
});

module.exports = router;

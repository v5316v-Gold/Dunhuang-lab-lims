const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 阶段 2 P1 - CAPA 流程（节点 8 不合格纠正预防）
// 参考：ISO 17025 + CNAS 质量控制体系
// ============================================================

// 列出 CAPA
router.get('/capas', requireAuth, (req, res) => {
  try {
    const { status, problem_type, responsible } = req.query;
    let sql = `SELECT c.*, u1.name as responsible_name, u2.name as verified_by_name, u3.name as created_by_name
               FROM capa_records c
               LEFT JOIN users u1 ON c.responsible_id=u1.id
               LEFT JOIN users u2 ON c.verified_by=u2.id
               LEFT JOIN users u3 ON c.created_by=u3.id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND c.status = ?'; params.push(status); }
    if (problem_type) { sql += ' AND c.problem_type = ?'; params.push(problem_type); }
    if (responsible) { sql += ' AND c.responsible_id = ?'; params.push(parseInt(responsible)); }
    sql += ' ORDER BY c.id DESC LIMIT 500';
    res.json({ success: true, data: queryAll(sql, params) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 创建 CAPA
router.post('/capas', requireAuth, (req, res) => {
  try {
    const { source_type, source_id, sample_id, problem_type, problem_description, root_cause, corrective_action, preventive_action, responsible_id, deadline, remark } = req.body;
    if (!problem_type || !problem_description) return res.status(400).json({ error: '问题类型/描述必填' });
    const max = queryOne('SELECT MAX(id) as max_id FROM capa_records');
    const nextId = (max && max.max_id) ? max.max_id + 1 : 1;
    const capa_no = 'CAPA-' + new Date().getFullYear() + '-' + String(nextId).padStart(4, '0');
    const result = run(
      `INSERT INTO capa_records
       (capa_no, source_type, source_id, sample_id, problem_type, problem_description, root_cause, corrective_action, preventive_action, responsible_id, deadline, status, created_by, verification_remark)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [capa_no, source_type || 'sample', source_id || null, sample_id || null,
       problem_type, problem_description, root_cause || '', corrective_action || '', preventive_action || '',
       responsible_id || req.session.userId, deadline || null,
       'open', req.session.userId, remark || '']
    );
    res.json({ success: true, id: result, capa_no });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 更新 CAPA 状态 + 验证
router.put('/capas/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, corrective_action, preventive_action, root_cause, completed_at, verification_remark } = req.body;
    // 根据状态判断是否需要 verified_by
    let updates = [];
    let params = [];
    if (status) { updates.push('status=?'); params.push(status); }
    if (corrective_action !== undefined) { updates.push('corrective_action=?'); params.push(corrective_action); }
    if (preventive_action !== undefined) { updates.push('preventive_action=?'); params.push(preventive_action); }
    if (root_cause !== undefined) { updates.push('root_cause=?'); params.push(root_cause); }
    if (completed_at) { updates.push('completed_at=?'); params.push(completed_at); }
    if (status === 'verified') { updates.push('verified_by=?'); params.push(req.session.userId); updates.push('verification_remark=?'); params.push(verification_remark || ''); }
    if (updates.length === 0) return res.status(400).json({ error: '无更新字段' });
    params.push(id);
    run('UPDATE capa_records SET ' + updates.join(',') + ' WHERE id=?', params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除 CAPA
router.delete('/capas/:id', requireAdmin, (req, res) => {
  try {
    run('DELETE FROM capa_records WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CAPA 统计
router.get('/capas/stats', requireAuth, (req, res) => {
  try {
    const data = queryAll(
      `SELECT problem_type,
              COUNT(*) as total,
              SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open_count,
              SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress_count,
              SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed_count,
              SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) as verified_count
       FROM capa_records GROUP BY problem_type`
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

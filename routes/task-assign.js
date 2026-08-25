const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 阶段 2 - 任务分派（节点 4）
// 流程：收样 → 分派检测员 → 检测中
// ============================================================

// 分派样品给检测员
router.post('/samples/:id/assign', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { analyst_id, method, remark } = req.body;
    if (!analyst_id) return res.status(400).json({ error: '请选择检测员' });
    // 检查样品状态
    const sample = queryOne('SELECT current_stage, sample_code FROM workflow_samples WHERE id=?', [id]);
    if (!sample) return res.status(404).json({ error: '样品不存在' });
    if (sample.current_stage !== 'acceptance' && sample.current_stage !== 'preparation') {
      return res.status(400).json({ error: '样品不在可分派阶段（当前：' + sample.current_stage + '）' });
    }
    // 更新样品
    run('UPDATE workflow_samples SET current_stage=?, operator_id=? WHERE id=?',
      ['testing', analyst_id, id]);
    // 写工作流历史
    run('INSERT INTO workflow_history (sample_id, from_stage, to_stage, action_user_id, action_date) VALUES (?,?,?,?,datetime(\'now\'))',
      [id, sample.current_stage, 'testing', req.session.userId]);
    // 写审批记录
    run('INSERT INTO approval_records (target_type, target_id, approval_level, approval_role, approver_id, decision, comment, from_stage, to_stage) VALUES (?,?,?,?,?,?,?,?,?)',
      ['sample', id, 0, '任务分派', req.session.userId, 'assigned',
       (method ? '方法：' + method + '；' : '') + (remark || ''), sample.current_stage, 'testing']);
    res.json({ success: true, analyst_id, new_stage: 'testing' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 提交检测结果（样品 testing → review-l1）
router.post('/samples/:id/submit-result', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { results, conclusion, remark } = req.body;
    // 简化：只更新 current_stage
    run('UPDATE workflow_samples SET current_stage=? WHERE id=?', ['testing_date', id]);
    run('INSERT INTO workflow_history (sample_id, from_stage, to_stage, action_user_id) VALUES (?,?,?,?)',
      [id, 'testing', 'review-l1', req.session.userId]);
    res.json({ success: true, new_stage: 'review-l1' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取样品的工作流历史
router.get('/samples/:id/history', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = queryAll(
      `SELECT h.*, u.name as user_name FROM workflow_history h
       LEFT JOIN users u ON h.action_user_id=u.id
       WHERE h.sample_id=? ORDER BY h.action_date ASC`,
      [id]
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 列出所有检测员（可分派对象）
router.get('/analysts', requireAuth, (req, res) => {
  try {
    const data = queryAll(
      `SELECT id, name, role, dept FROM users
       WHERE status='active' AND (role IN ('analyst', 'reviewer', 'lab_director', 'admin'))
       ORDER BY name`
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

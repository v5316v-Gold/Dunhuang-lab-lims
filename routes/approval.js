const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 阶段 2 P1 - 2 级审批流程（节点 9）
// 参考：金现代 LIMS 文档 + ISO 17025 报告审批
// 流程：检测员 → 一级核验 → 二级审核 → 技术负责人审批
// ============================================================

// 获取样品完整审批历史
router.get('/samples/:id/approvals', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = queryAll(
      `SELECT a.*, u.name as approver_name, u.role as approver_role
       FROM approval_records a LEFT JOIN users u ON a.approver_id=u.id
       WHERE a.target_type='sample' AND a.target_id=?
       ORDER BY a.created_at ASC`,
      [id]
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 1 级核验（核验员）
router.post('/samples/:id/verify-l1', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision, comment } = req.body;
    if (!['approved', 'rejected', 'returned'].includes(decision)) return res.status(400).json({ error: '无效决策' });

    // 检查样品状态
    const sample = queryOne('SELECT current_stage FROM workflow_samples WHERE id=?', [id]);
    if (!sample) return res.status(404).json({ error: '样品不存在' });
    if (sample.current_stage !== 'testing_date' && sample.current_stage !== 'testing' && sample.current_stage !== 'reviewed_date') {
      return res.status(400).json({ error: '样品不在可核验阶段（当前：' + sample.current_stage + '）' });
    }

    // 写审批记录
    run(
      `INSERT INTO approval_records
       (target_type, target_id, approval_level, approval_role, approver_id, decision, comment, from_stage, to_stage)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      ['sample', id, 1, '一级核验员', req.session.userId, decision, comment || '', sample.current_stage,
       decision === 'approved' ? 'reviewed_date' : 'testing_date']
    );

    // 更新样品阶段
    if (decision === 'approved') {
      run("UPDATE workflow_samples SET current_stage='reviewed_date' WHERE id=?", [id]);
    } else {
      run("UPDATE workflow_samples SET current_stage='testing_date' WHERE id=?", [id]);
    }

    res.json({ success: true, decision, new_stage: decision === 'approved' ? 'review-l1' : 'testing' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2 级审核（技术负责人 / 质量负责人）
router.post('/samples/:id/verify-l2', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: '无效决策' });

    // 检查样品状态
    const sample = queryOne('SELECT current_stage FROM workflow_samples WHERE id=?', [id]);
    if (!sample) return res.status(404).json({ error: '样品不存在' });
    if (sample.current_stage !== 'reviewed_date' && sample.current_stage !== 'review-l1') {
      return res.status(400).json({ error: '样品未通过一级核验（当前：' + sample.current_stage + '）' });
    }

    // 写审批记录
    run(
      `INSERT INTO approval_records
       (target_type, target_id, approval_level, approval_role, approver_id, decision, comment, from_stage, to_stage)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      ['sample', id, 2, '技术负责人', req.session.userId, decision, comment || '', 'reviewed_date',
       decision === 'approved' ? 'report_date' : 'testing_date']
    );

    if (decision === 'approved') {
      run("UPDATE workflow_samples SET current_stage='report_date' WHERE id=?", [id]);
    } else {
      // 退回重新检测
      run("UPDATE workflow_samples SET current_stage='testing_date' WHERE id=?", [id]);
    }

    res.json({ success: true, decision, new_stage: decision === 'approved' ? 'report' : 'testing' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取待审批列表（按级别）
router.get('/pending/:level', requireAuth, (req, res) => {
  try {
    const level = req.params.level;
    let stageFilter = '';
    if (level === '1') stageFilter = 'testing_date';
    else if (level === '2') stageFilter = 'reviewed_date';
    else return res.status(400).json({ error: 'level 必须是 1 或 2' });

    const data = queryAll(
      `SELECT s.*, u1.name as analyst_name, u2.name as inspector_name, c.client_name as client_name_full
       FROM samples s
       LEFT JOIN users u1 ON s.analyst_id=u1.id
       LEFT JOIN users u2 ON s.inspector_id=u2.id
       LEFT JOIN clients c ON s.client_id=c.id
       WHERE ${stageFilter}
       ORDER BY s.id DESC LIMIT 100`
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

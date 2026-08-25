const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 P0 工作流 API — 委托审批流（节点 2/9）
// ============================================================

// 提交委托（草稿 → 已提交）
router.post('/projects/:id/submit', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    run('UPDATE projects SET status=?, submitted_at=datetime(\'now\') WHERE id=?', ['submitted', id]);
    // 写审批历史
    run('INSERT INTO approval_records (target_type, target_id, approval_level, from_stage, to_stage, approver_id, decision, comment) VALUES (?,?,?,?,?,?,?,?)',
      ['project', id, 1, 'draft', 'submitted', req.session.userId, 'submitted', req.body.comment || '']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 审批委托（通过 / 驳回）
router.post('/projects/:id/approve', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: '无效决策' });
    if (decision === 'approved') {
      run('UPDATE projects SET status=?, approved_at=datetime(\'now\'), approval_user_id=?, approval_remark=? WHERE id=?',
        ['approved', req.session.userId, comment || '', id]);
      run('INSERT INTO approval_records (target_type, target_id, approval_level, approval_role, approver_id, decision, comment, from_stage, to_stage) VALUES (?,?,?,?,?,?,?,?,?)',
        ['project', id, 1, '业务员主管', req.session.userId, 'approved', comment || '', 'submitted', 'approved']);
    } else {
      run('UPDATE projects SET status=?, rejection_reason=?, approval_user_id=? WHERE id=?',
        ['rejected', comment || '', req.session.userId, id]);
      run('INSERT INTO approval_records (target_type, target_id, approval_level, approval_role, approver_id, decision, comment) VALUES (?,?,?,?,?,?,?)',
        ['project', id, 1, '业务员主管', req.session.userId, 'rejected', comment || '']);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取委托审批历史
router.get('/projects/:id/approvals', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const records = queryAll(
      'SELECT a.*, u.name as approver_name FROM approval_records a LEFT JOIN users u ON a.approver_id=u.id WHERE a.target_type=? AND a.target_id=? ORDER BY a.created_at DESC',
      ['project', id]
    );
    res.json({ success: true, data: records });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 样品收样（更新收样字段）
router.post('/samples/:id/accept', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { appearance_check, weight_received, photo_url, seal_status, acceptance_status, inspector_id, inspection_remark } = req.body;
    run(
      'UPDATE samples SET appearance_check=?, weight_received=?, photo_url=?, seal_status=?, acceptance_status=?, inspector_id=?, inspection_at=datetime(\'now\'), inspection_remark=? WHERE id=?',
      [appearance_check || '{}', weight_received || 0, photo_url || '', seal_status || 'sealed', acceptance_status || 'accepted', inspector_id || req.session.userId, inspection_remark || '', id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 生成样品二维码（节点 3）
router.post('/samples/:id/qr', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const s = queryOne('SELECT sample_code FROM workflow_samples WHERE id=?', [id]);
    if (!s) return res.status(404).json({ error: '样品不存在' });
    const qrContent = 'LIMS-DHJ-' + s.sample_code;
    run(
      'INSERT INTO qr_codes (target_type, target_id, qr_content, generated_by) VALUES (?,?,?,?)',
      ['sample', id, qrContent, req.session.userId]
    );
    res.json({ success: true, qr_content: qrContent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 留样入库（节点 5）
router.post('/samples/:id/retain', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { retain_type, retention_until, storage_location, retain_weight, container_type } = req.body;
    // 自动生成留样编号
    const max = queryOne('SELECT MAX(id) as max_id FROM retain_samples');
    const nextId = (max && max.max_id) ? max.max_id + 1 : 1;
    const retain_code = 'RET-' + String(nextId).padStart(5, '0');
    const result = run(
      'INSERT INTO retain_samples (sample_id, retain_code, retain_type, storage_location, retain_weight, container_type, retained_by, retention_until) VALUES (?,?,?,?,?,?,?,?)',
      [id, retain_code, retain_type || 'split', storage_location || '', retain_weight || 0, container_type || 'bottle', req.session.userId, retention_until]
    );
    res.json({ success: true, id: result.lastInsertRowid, retain_code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 留样列表
router.get('/retain-samples', requireAuth, (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = 'SELECT r.*, s.sample_code, s.sample_name FROM retain_samples r LEFT JOIN samples s ON r.sample_id=s.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND r.destroy_status = ?'; params.push(status); }
    if (keyword) { sql += ' AND (r.retain_code LIKE ? OR s.sample_code LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%'); }
    sql += ' ORDER BY r.id DESC LIMIT 500';
    res.json({ success: true, data: queryAll(sql, params) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 留样到期提醒
router.get('/retain-samples/expiring', requireAuth, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = queryAll(
      `SELECT r.*, s.sample_code FROM retain_samples r LEFT JOIN samples s ON r.sample_id=s.id
       WHERE r.destroy_status='retained' AND r.retention_until IS NOT NULL AND julianday(r.retention_until) - julianday('now') <= ? ORDER BY r.retention_until ASC`,
      [days]
    );
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 不确定度计算（节点 10 CNAS-GL005）
router.post('/samples/:id/uncertainty', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { parameter_name, measurement_value, type_a, type_b, num_measurements, mean_value, standard_deviation, coverage_factor, method } = req.body;
    if (!parameter_name) return res.status(400).json({ error: '参数名称不能为空' });
    // 同步 samples 表（外键需要）
    const sample = queryOne('SELECT sample_code FROM workflow_samples WHERE id=?', [id]);
    if (sample) {
      const exists = queryOne('SELECT id FROM samples WHERE id=?', [id]);
      if (!exists) {
        run('INSERT INTO samples (id, sample_code, sample_name) VALUES (?, ?, ?)', [id, sample.sample_code, sample.sample_name || '']);
      }
    }
    // 计算合成不确定度 u_c = sqrt(u_A^2 + u_B^2)
    const combined = Math.sqrt(Math.pow(type_a || 0, 2) + Math.pow(type_b || 0, 2));
    const k = coverage_factor || 2;
    const expanded = combined * k;
    const relative = measurement_value ? (expanded / measurement_value) * 100 : 0;
    const result = run(
      `INSERT INTO uncertainty_calculations
       (sample_id, parameter_name, measurement_value, type_a_uncertainty, type_a_source, type_b_uncertainty, type_b_source,
        combined_uncertainty, coverage_factor, expanded_uncertainty, relative_uncertainty, num_measurements, mean_value, standard_deviation, method, calculated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, parameter_name, measurement_value || 0, type_a || 0, 'repeated_measurements', type_b || 0, 'calibration_certificate',
       combined, k, expanded, relative, num_measurements || 1, mean_value || measurement_value, standard_deviation || 0, method || 'GUM', req.session.userId]
    );
    res.json({ success: true, id: result.lastInsertRowid, combined_uncertainty: combined, expanded_uncertainty: expanded, relative_uncertainty: relative });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 复检申请（节点 11）
router.post('/samples/:id/retest', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason, retest_method } = req.body;
    // 同步 samples
    const sample = queryOne('SELECT sample_code FROM workflow_samples WHERE id=?', [id]);
    if (sample) {
      const exists = queryOne('SELECT id FROM samples WHERE id=?', [id]);
      if (!exists) run('INSERT INTO samples (id, sample_code, sample_name) VALUES (?, ?, ?)', [id, sample.sample_code, sample.sample_name || '']);
    }
    const max = queryOne('SELECT MAX(id) as max_id FROM retest_records');
    const nextId = (max && max.max_id) ? max.max_id + 1 : 1;
    const retest_no = 'RT-' + String(nextId).padStart(5, '0');
    // 从留样调取
    const retain = queryOne('SELECT id FROM retain_samples WHERE sample_id=? AND destroy_status=?', [id, 'retained']);
    const result = run(
      'INSERT INTO retest_records (retest_no, original_sample_id, retest_retain_id, retest_reason, retest_method, requested_by) VALUES (?,?,?,?,?,?)',
      [retest_no, id, retain ? retain.id : null, reason || 'qc_fail', retest_method || 'ICP', req.session.userId]
    );
    res.json({ success: true, id: result.lastInsertRowid, retest_no, retest_retain_id: retain ? retain.id : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 留样销毁审批
router.post('/retain-samples/:id/destroy', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    run('UPDATE retain_samples SET destroy_status=?, destroyed_at=datetime(\'now\'), destroy_operator_id=?, destroy_remark=? WHERE id=?',
      ['destroyed', req.session.userId, req.body.remark || '', id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

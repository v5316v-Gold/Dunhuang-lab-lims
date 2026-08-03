const express = require('express');
const { WorkflowSampleCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

// STAGE MAP: appointment → received → encoded → split → testing → data_recorded → report → reviewed → archived

const STAGES = ['appointment', 'received', 'encoded', 'split', 'testing', 'data_recorded', 'report', 'reviewed', 'archived'];

const STAGE_LABELS = {
  appointment: '送样预约',
  received: '样品接收',
  encoded: '登记编码',
  split: '样品分流',
  testing: '检测执行',
  data_recorded: '数据记录',
  report: '报告生成',
  reviewed: '报告审核',
  archived: '归档存储',
  completed: '已完成'
};

const STAGE_COLORS = {
  appointment: '#1d4ed8',
  received: '#2563eb',
  encoded: '#3b82f6',
  split: '#06b6d4',
  testing: '#f97316',
  data_recorded: '#d97708',
  report: '#7c3aed',
  reviewed: '#6d28d9',
  archived: '#059669',
  completed: '#374151'
};

// GET /api/workflow/stages - 返回所有阶段定义
router.get('/stages', requireAuth, (req, res) => {
  res.json({ stages: STAGES, labels: STAGE_LABELS, colors: STAGE_COLORS });
});

// GET /api/workflow/samples - 返回所有样品及其当前阶段
router.get('/samples', requireAuth, (req, res) => {
  const rows = queryAll(`
    SELECT ws.*, u.name as operator_name, sup.name as supervisor_name
    FROM workflow_samples ws
    LEFT JOIN users u ON ws.operator_id=u.id
    LEFT JOIN users sup ON ws.supervisor_id=sup.id
    ORDER BY ws.id DESC
  `);
  res.json({ data: rows });
});

// POST /api/workflow/samples - 创建新样品（从预约开始）
router.post('/samples', requireAuth, validate(WorkflowSampleCreateSchema), (req, res) => {
  if (!req.body.sample_code) return res.status(400).json({ error: '样品编号必填' });
  try {
    const info = run(
      `INSERT INTO workflow_samples (sample_code,sample_name,sample_type,client_name,contact_phone,detection_method,appointment_date,operator_id,appointment_no,remark)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.body.sample_code,
        req.body.sample_name || '',
        req.body.sample_type || '',
        req.body.client_name || '',
        req.body.contact_phone || '',
        req.body.detection_method || 'ICP',
        req.body.appointment_date || '',
        req.session.userId,
        req.body.appointment_no || '',
        req.body.remark || ''
      ]
    );
    const sampleId = info.lastInsertRowid;
    // 记录历史
    run(`INSERT INTO workflow_history (sample_id,from_stage,to_stage,action_user_id,remark) VALUES (?,'',?,?,?)`,
      [sampleId, 'appointment', req.session.userId, '样品创建']);
    res.json({ success: true, id: sampleId });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '样品编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/workflow/samples/:id - 更新样品信息
router.put('/samples/:id', requireAuth, validate(WorkflowSampleCreateSchema), (req, res) => {
  try {
    run(`UPDATE workflow_samples SET
      sample_name=?,sample_type=?,client_name=?,contact_phone=?,detection_method=?,
      operator_id=?,supervisor_id=?,remark=?,updated_at=datetime('now')
      WHERE id=?`,
      [
        req.body.sample_name||'', req.body.sample_type||'',
        req.body.client_name||'', req.body.contact_phone||'',
        req.body.detection_method||'', req.body.operator_id||null,
        req.body.supervisor_id||null, req.body.remark||'',
        parseInt(req.params.id)
      ]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflow/samples/:id
router.delete('/samples/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM workflow_history WHERE sample_id=?', [parseInt(req.params.id)]);
    run('DELETE FROM workflow_samples WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflow/samples/:id/advance - 推进到下一阶段
router.post('/samples/:id/advance', requireAuth, (req, res) => {
  const sample = queryOne('SELECT * FROM workflow_samples WHERE id=?', [parseInt(req.params.id)]);
  if (!sample) return res.status(404).json({ error: '样品不存在' });

  const currentIdx = STAGES.indexOf(sample.current_stage);
  if (currentIdx === -1) return res.status(400).json({ error: '当前阶段无效' });
  if (currentIdx >= STAGES.length - 1) return res.status(400).json({ error: '样品已到达最终阶段' });

  const nextStage = STAGES[currentIdx + 1];
  const now = new Date().toISOString().slice(0, 10);

  // 更新对应日期字段
  const dateFieldMap = {
    received: 'received_date',
    encoded: 'encoded_date',
    split: 'split_date',
    testing: 'testing_date',
    data_recorded: 'data_recorded_date',
    report: 'report_date',
    reviewed: 'reviewed_date',
    archived: 'archived_date'
  };

  let updateSql = `UPDATE workflow_samples SET current_stage=?,updated_at=datetime('now')`;
  const params = [nextStage];

  if (dateFieldMap[nextStage]) {
    updateSql += `,${dateFieldMap[nextStage]}=?`;
    params.push(now);
  }

  updateSql += ' WHERE id=?';
  params.push(parseInt(req.params.id));

  try {
    run(updateSql, params);
    run(`INSERT INTO workflow_history (sample_id,from_stage,to_stage,action_user_id,remark)
        VALUES (?,?,?,?,?)`,
      [parseInt(req.params.id), sample.current_stage, nextStage, req.session.userId, req.body.remark || '']);
    res.json({ success: true, from: sample.current_stage, to: nextStage });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflow/samples/:id/revert - 退回上一阶段
router.post('/samples/:id/revert', requireAuth, (req, res) => {
  const sample = queryOne('SELECT * FROM workflow_samples WHERE id=?', [parseInt(req.params.id)]);
  if (!sample) return res.status(404).json({ error: '样品不存在' });

  const currentIdx = STAGES.indexOf(sample.current_stage);
  if (currentIdx <= 0) return res.status(400).json({ error: '样品已回到起始阶段' });

  const prevStage = STAGES[currentIdx - 1];

  try {
    run(`UPDATE workflow_samples SET current_stage=?,updated_at=datetime('now') WHERE id=?`,
      [prevStage, parseInt(req.params.id)]);
    run(`INSERT INTO workflow_history (sample_id,from_stage,to_stage,action_user_id,remark)
        VALUES (?,?,?,?,?)`,
      [parseInt(req.params.id), sample.current_stage, prevStage, req.session.userId, req.body.remark || '退回' ]);
    res.json({ success: true, from: sample.current_stage, to: prevStage });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflow/samples/:id/history - 获取流转历史
router.get('/samples/:id/history', requireAuth, (req, res) => {
  const rows = queryAll(`
    SELECT h.*, u.name as action_user_name
    FROM workflow_history h
    LEFT JOIN users u ON h.action_user_id=u.id
    WHERE h.sample_id=?
    ORDER BY h.id ASC
  `, [parseInt(req.params.id)]);
  res.json({ data: rows });
});

module.exports = router;
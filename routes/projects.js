const express = require('express');
const { ProjectCreateSchema, ProjectRecordCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

router.get('/projects', requireAuth, (req, res) => {
  try {
    const { status, client_id, keyword } = req.query;
    let sql = `SELECT p.*, c.client_name, c.contact_person
               FROM projects p LEFT JOIN clients c ON p.client_id=c.id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (client_id) { sql += ' AND p.client_id = ?'; params.push(parseInt(client_id)); }
    if (keyword) { sql += ' AND (p.project_no LIKE ? OR p.project_name LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%'); }
    sql += ' ORDER BY p.id DESC LIMIT 500';
    res.json({ success: true, data: queryAll(sql, params) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 2026-08-11 修复：按 ID 获取项目详情（解决 500 错误）
router.get('/projects/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
    const project = queryOne(
      `SELECT p.*, c.client_name, c.contact_person, c.contact_phone, c.contact_email,
              u.name as creator_name, u2.name as approval_user_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id=c.id
       LEFT JOIN users u ON p.created_by=u.id
       LEFT JOIN users u2 ON p.approval_user_id=u2.id
       WHERE p.id=?`, [id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    // 关联样品
    const samples = queryAll(
      `SELECT s.*, ws.current_stage, ws.operator_id, u.name as operator_name
       FROM samples s LEFT JOIN workflow_samples ws ON ws.id=s.id
       LEFT JOIN users u ON ws.operator_id=u.id
       WHERE s.project_id=?`, [id]);
    res.json({ success: true, data: { project, samples } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 2026-08-11 增强：项目完整工作流
router.get('/projects/:id/full', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '无效的 ID' });
    const project = queryOne('SELECT * FROM projects WHERE id=?', [id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    const samples = queryAll('SELECT * FROM samples WHERE project_id=?', [id]);
    const workflows = samples.length > 0 ? queryAll(
      `SELECT ws.*, u.name as operator_name
       FROM workflow_samples ws LEFT JOIN users u ON ws.operator_id=u.id
       WHERE ws.id IN (${samples.map(s => s.id).join(',') || '0'})`
    ) : [];
    const approvals = queryAll(
      `SELECT * FROM approval_records
       WHERE (target_type='project' AND target_id=?)
          OR (target_type='sample' AND target_id IN (${samples.map(s => s.id).join(',') || '0'}))
       ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: { project, samples, workflows, approvals } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', requireAuth, validate(ProjectCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO projects (project_no,project_name,method_type,description) VALUES (?,?,?,?)',
      [req.body.project_no, req.body.project_name, req.body.method_type, req.body.description||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '项目编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/projects/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // 检查是否有关联样品
    const sampleCount = queryOne('SELECT COUNT(*) as cnt FROM samples WHERE project_id=?', [id]);
    if (sampleCount && sampleCount.cnt > 0) {
      return res.status(400).json({ 
        error: '该项目关联 ' + sampleCount.cnt + ' 个样品，无法直接删除。请先删除关联样品。' 
      });
    }
    run('DELETE FROM projects WHERE id=?', [id]);
    res.json({ success: true });
  } catch(e) { 
    if (e.message && e.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: '项目被其他数据引用，无法删除' });
    }
    res.status(500).json({ error: e.message }); 
  }
});

router.get('/project-records', requireAuth, (req, res) => {
  res.json({ data: queryAll(
    `SELECT pr.*, p.project_name, p.method_type, u1.name as operator_name, u2.name as supervisor_name
     FROM project_records pr
     LEFT JOIN projects p ON pr.project_id=p.id
     LEFT JOIN users u1 ON pr.operator_id=u1.id
     LEFT JOIN users u2 ON pr.supervisor_id=u2.id
     ORDER BY pr.id DESC`
  ) });
});

router.post('/project-records', requireAuth, validate(ProjectRecordCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO project_records (project_id,record_date,sample_count,pass_count,fail_count,operator_id,supervisor_id,remark) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.project_id, req.body.record_date||'', req.body.sample_count||0, req.body.pass_count||0, req.body.fail_count||0, req.body.operator_id||null, req.body.supervisor_id||null, req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/project-records/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM project_records WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { 
    if (e.message && e.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: '检测记录被其他数据引用，无法删除' });
    }
    res.status(500).json({ error: e.message }); 
  }
});

router.put('/projects/:id', requireAuth, validate(ProjectCreateSchema), (req, res) => {
  try {
    run(
      'UPDATE projects SET project_no=?,project_name=?,method_type=?,description=?,updated_at=datetime("now") WHERE id=?',
      [req.body.project_no, req.body.project_name, req.body.method_type||'', req.body.description||'', parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '项目编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
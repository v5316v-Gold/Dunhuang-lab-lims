const express = require('express');
const router = express.Router();

router.get('/projects', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM projects ORDER BY id') });
});

router.post('/projects', requireAuth, (req, res) => {
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
    run('DELETE FROM projects WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
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

router.post('/project-records', requireAuth, (req, res) => {
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
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/projects/:id', requireAuth, (req, res) => {
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
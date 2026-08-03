const express = require('express');
const fumehood = express.Router();
const training = express.Router();

fumehood.get('/fumehood', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM fumehood ORDER BY id DESC') });
});

fumehood.post('/fumehood', requireAdmin, (req, res) => {
  try {
    const info = run(
      'INSERT INTO fumehood (fumehood_no,location,brand_model,wind_speed,calib_date,next_calib,status) VALUES (?,?,?,?,?,?,?)',
      [req.body.fumehood_no, req.body.location||'', req.body.brand_model||'', req.body.wind_speed||'', req.body.calib_date||'', req.body.next_calib||'', req.body.status||'normal']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

fumehood.put('/fumehood/:id', requireAdmin, (req, res) => {
  try {
    run('UPDATE fumehood SET fumehood_no=?,location=?,brand_model=?,wind_speed=?,calib_date=?,next_calib=?,status=? WHERE id=?',
      [req.body.fumehood_no, req.body.location||'', req.body.brand_model||'', req.body.wind_speed||'', req.body.calib_date||'', req.body.next_calib||'', req.body.status||'normal', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

fumehood.delete('/fumehood/:id', requireAdmin, (req, res) => {
  try { run('DELETE FROM fumehood WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

fumehood.get('/fumehood-records', requireAuth, (req, res) => {
  res.json({ data: queryAll(
    'SELECT fr.*, f.fumehood_no, u.name as user_name FROM fumehood_records fr LEFT JOIN fumehood f ON fr.fumehood_id=f.id LEFT JOIN users u ON fr.user_id=u.id ORDER BY fr.id DESC'
  ) });
});

fumehood.post('/fumehood-records', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO fumehood_records (fumehood_id,use_date,user_id,start_time,end_time,experiment_type,chemicals_used,protective_equip,remark) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.body.fumehood_id, req.body.use_date||'', req.body.user_id||null, req.body.start_time||'', req.body.end_time||'', req.body.experiment_type||'', req.body.chemicals_used||'', req.body.protective_equip||'', req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

fumehood.delete('/fumehood-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM fumehood_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

training.get('/training-annual', requireAuth, (req, res) => {
  res.json({ data: queryAll(
    'SELECT ta.*, d.name as dept_name FROM training_annual_plan ta LEFT JOIN departments d ON ta.dept_id=d.id ORDER BY ta.year DESC, ta.id DESC'
  ) });
});

training.post('/training-annual', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO training_annual_plan (year,dept_id,total_plan,total_actual,plan_target,actual_target) VALUES (?,?,?,?,?,?)',
      [req.body.year, req.body.dept_id||null, req.body.total_plan||0, req.body.total_actual||0, req.body.plan_target||0, req.body.actual_target||0]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

training.put('/training-annual/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE training_annual_plan SET year=?,dept_id=?,total_plan=?,total_actual=?,plan_target=?,actual_target=? WHERE id=?',
      [req.body.year, req.body.dept_id||null, req.body.total_plan||0, req.body.total_actual||0, req.body.plan_target||0, req.body.actual_target||0, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

training.delete('/training-annual/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM training_annual_plan WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

training.get('/training-records', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT tr.*, u.name as employee_name FROM training_records tr LEFT JOIN users u ON tr.employee_id=u.id') });
});

training.post('/training-records', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO training_records (employee_id,training_date,training_type,training_content,training_hours,trainer,assessment_result,certificate_no,valid_date,remark) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.body.employee_id, req.body.training_date||'', req.body.training_type||'', req.body.training_content||'', req.body.training_hours||0, req.body.trainer||'', req.body.assessment_result||'', req.body.certificate_no||'', req.body.valid_date||'', req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

training.delete('/training-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM training_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = { fumehood, training };
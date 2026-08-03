const express = require('express');
const { SampleAppointmentCreateSchema, SampleProcessingCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

router.get('/appointments', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT a.*, u.name as creator_name FROM sample_appointments a LEFT JOIN users u ON a.created_by=u.id ORDER BY a.id DESC') });
});

router.post('/appointments', requireAuth, validate(SampleAppointmentCreateSchema), (req, res) => {
  if (!req.body.appointment_no) return res.status(400).json({ error: '预约编号必填' });
  try {
    const info = run(
      'INSERT INTO sample_appointments (appointment_no,client_name,sample_type,expected_date,contact_person,contact_phone,status,remark,created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.body.appointment_no, req.body.client_name||'', req.body.sample_type||'', req.body.expected_date||'', req.body.contact_person||'', req.body.contact_phone||'', req.body.status||'pending', req.body.remark||'', req.session.userId]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '预约编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/appointments/:id', requireAuth, validate(SampleAppointmentCreateSchema), (req, res) => {
  try {
    run('UPDATE sample_appointments SET status=?,remark=? WHERE id=?',
      [req.body.status||'', req.body.remark||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/appointments/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM sample_appointments WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/sample-processing', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT sp.*, u.name as operator_name, sup.name as supervisor_name FROM sample_processing sp LEFT JOIN users u ON sp.operator_id=u.id LEFT JOIN users sup ON sp.supervisor_id=sup.id') });
});

router.post('/sample-processing', requireAuth, validate(SampleProcessingCreateSchema), (req, res) => {
  try {
    const info = run(
      `INSERT INTO sample_processing (sample_code,sample_name,sample_type,packaging_intact,processing_method,detection_method,processing_date,operator_id,supervisor_id,equipment_id,environment_temp,environment_humidity,consumables_used,reagents_used,gases_used,processing_desc,result_data,result_conclusion,report_no,qa_review,workflow_status,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.body.sample_code, req.body.sample_name, req.body.sample_type||'', req.body.packaging_intact||'yes', req.body.processing_method||'', req.body.detection_method||'', req.body.processing_date||'', req.body.operator_id||null, req.body.supervisor_id||null, req.body.equipment_id||null, req.body.environment_temp||null, req.body.environment_humidity||null, req.body.consumables_used||'', req.body.reagents_used||'', req.body.gases_used||'', req.body.processing_desc||'', req.body.result_data||'', req.body.result_conclusion||'', req.body.report_no||'', req.body.qa_review||'pending', req.body.workflow_status||'stage1_pending', 0]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/sample-processing/:id', requireAuth, validate(SampleProcessingCreateSchema), (req, res) => {
  try {
    run(
      `UPDATE sample_processing SET sample_code=?,sample_name=?,sample_type=?,packaging_intact=?,processing_method=?,detection_method=?,processing_date=?,operator_id=?,supervisor_id=?,equipment_id=?,environment_temp=?,environment_humidity=?,consumables_used=?,reagents_used=?,gases_used=?,processing_desc=?,result_data=?,result_conclusion=?,report_no=?,qa_review=?,workflow_status=?,archived=? WHERE id=?`,
      [req.body.sample_code, req.body.sample_name, req.body.sample_type||'', req.body.packaging_intact||'yes', req.body.processing_method||'', req.body.detection_method||'', req.body.processing_date||'', req.body.operator_id||null, req.body.supervisor_id||null, req.body.equipment_id||null, req.body.environment_temp||null, req.body.environment_humidity||null, req.body.consumables_used||'', req.body.reagents_used||'', req.body.gases_used||'', req.body.processing_desc||'', req.body.result_data||'', req.body.result_conclusion||'', req.body.report_no||'', req.body.qa_review||'pending', req.body.workflow_status||'stage1_pending', req.body.archived||0, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sample-processing/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM sample_processing WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/sample-processing/:id/workflow', requireAuth, (req, res) => {
  try {
    run('UPDATE sample_processing SET workflow_status=?,qa_review=?,archived=? WHERE id=?',
      [req.body.workflow_status||'', req.body.qa_review||'', req.body.archived||0, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
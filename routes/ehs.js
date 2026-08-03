const express = require('express');
const { EhsInspectionCreateSchema, EhsIncidentCreateSchema, EhsHazardCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

router.get('/ehs-inspection', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT di.*, u.name as inspector_name FROM ehs_daily_inspection di LEFT JOIN users u ON di.inspector_id=u.id') });
});

router.post('/ehs-inspection', requireAuth, validate(EhsInspectionCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO ehs_daily_inspection (inspection_date,inspector_id,fire_facilities,temp_value,humidity_value,ventilation_status,electrical_safety,chemical_storage,overall_status,remark) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.body.inspection_date||'', req.body.inspector_id||null, req.body.fire_facilities||'', req.body.temp_value||'', req.body.humidity_value||'', req.body.ventilation_status||'', req.body.electrical_safety||'', req.body.chemical_storage||'', req.body.overall_status||'', req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/ehs-inspection/:id', requireAuth, validate(EhsInspectionCreateSchema), (req, res) => {
  try {
    run('UPDATE ehs_daily_inspection SET overall_status=?,remark=? WHERE id=?',
      [req.body.overall_status||'', req.body.remark||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/ehs-inspection/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM ehs_daily_inspection WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/ehs-incident', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT ei.*, u.name as reporter_name FROM ehs_incident ei LEFT JOIN users u ON ei.reporter_id=u.id') });
});

router.post('/ehs-incident', requireAuth, validate(EhsIncidentCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO ehs_incident (incident_date,incident_type,severity,location,description,involved_persons,handling_result,reporter_id) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.incident_date||'', req.body.incident_type||'', req.body.severity||'', req.body.location||'', req.body.description||'', req.body.involved_persons||'', req.body.handling_result||'', req.body.reporter_id||null]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/ehs-incident/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM ehs_incident WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/ehs-hazard', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT eh.*, u.name as responsible_name FROM ehs_hazard eh LEFT JOIN users u ON eh.responsible_person=u.id') });
});

router.post('/ehs-hazard', requireAuth, validate(EhsHazardCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO ehs_hazard (discovery_date,hazard_location,hazard_type,severity_level,description,control_measures,responsible_person,deadline,status) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.body.discovery_date||'', req.body.hazard_location||'', req.body.hazard_type||'', req.body.severity_level||'', req.body.description||'', req.body.control_measures||'', req.body.responsible_person||null, req.body.deadline||'', req.body.status||'pending']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/ehs-hazard/:id', requireAuth, validate(EhsHazardCreateSchema), (req, res) => {
  try {
    run('UPDATE ehs_hazard SET status=?,control_measures=? WHERE id=?',
      [req.body.status||'', req.body.control_measures||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/ehs-hazard/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM ehs_hazard WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
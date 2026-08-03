const express = require('express');
const router = express.Router();
const { validate, EquipmentCreateSchema } = require('../validators/schemas');

router.get('/equipment', requireAuth, (req, res) => {
  const rows = queryAll(
    'SELECT e.*, d.name as dept_name, u.name as responsible_name FROM equipment e LEFT JOIN departments d ON e.dept_id=d.id LEFT JOIN users u ON e.responsible_person=u.id'
  );
  res.json({ data: rows });
});

router.post('/equipment', requireAuth, validate(EquipmentCreateSchema), (req, res) => {
  try {
    const info = run(
      'INSERT INTO equipment (equip_no,equip_name,model,manufacturer,serial_no,purchase_date,purchase_price,current_value,location,dept_id,status,responsible_person) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.body.equip_no, req.body.equip_name, req.body.model||'', req.body.manufacturer||'', req.body.serial_no||'', req.body.purchase_date||'', req.body.purchase_price||0, req.body.current_value||0, req.body.location||'', req.body.dept_id||null, req.body.status||'normal', req.body.responsible_person||null]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '设备编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/equipment/:id', requireAuth, (req, res) => {
  try {
    run(
      'UPDATE equipment SET equip_no=?,equip_name=?,model=?,manufacturer=?,serial_no=?,purchase_date=?,purchase_price=?,current_value=?,location=?,dept_id=?,status=?,responsible_person=? WHERE id=?',
      [req.body.equip_no, req.body.equip_name, req.body.model||'', req.body.manufacturer||'', req.body.serial_no||'', req.body.purchase_date||'', req.body.purchase_price||0, req.body.current_value||0, req.body.location||'', req.body.dept_id||null, req.body.status||'normal', req.body.responsible_person||null, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '设备编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/equipment/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM equipment WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/maintenance', requireAuth, (req, res) => {
  const rows = queryAll(
    'SELECT m.*, e.equip_name FROM equipment_maintenance m LEFT JOIN equipment e ON m.equip_id=e.id ORDER BY m.id DESC'
  );
  res.json({ data: rows });
});

router.post('/maintenance', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO equipment_maintenance (equip_id,maintenance_date,maintenance_type,maintainer,cost,description,next_maintenance_date) VALUES (?,?,?,?,?,?,?)',
      [req.body.equip_id||null, req.body.maintenance_date||'', req.body.maintenance_type||'', req.body.maintainer||'', req.body.cost||0, req.body.description||'', req.body.next_maintenance_date||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/maintenance/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM equipment_maintenance WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/calibration', requireAuth, (req, res) => {
  const rows = queryAll(
    'SELECT c.*, e.equip_name FROM equipment_calibration c LEFT JOIN equipment e ON c.equip_id=e.id ORDER BY c.id DESC'
  );
  res.json({ data: rows });
});

router.post('/calibration', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO equipment_calibration (equip_id,calibration_date,calibration_org,certificate_no,valid_date,result) VALUES (?,?,?,?,?,?)',
      [req.body.equip_id||null, req.body.calibration_date||'', req.body.calibration_org||'', req.body.certificate_no||'', req.body.valid_date||'', req.body.result||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/calibration/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM equipment_calibration WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/equipment-repairs', requireAuth, (req, res) => {
  const rows = queryAll(
    'SELECT r.*, e.equip_name FROM equipment_repairs r LEFT JOIN equipment e ON r.equip_id=e.id ORDER BY r.id DESC'
  );
  res.json({ data: rows });
});

router.post('/equipment-repairs', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO equipment_repairs (equip_id,repair_date,fault_desc,repair_action,repairer,cost,result,next_inspection_date) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.equip_id||null, req.body.repair_date||'', req.body.fault_desc||'', req.body.repair_action||'', req.body.repairer||'', req.body.cost||0, req.body.result||'', req.body.next_inspection_date||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/equipment-repairs/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM equipment_repairs WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();

router.get('/reagents', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM reagents ORDER BY id') });
});

router.post('/reagents', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO reagents (reagent_name,cas_no,formula,purity,manufacturer,supplier,location,current_stock,unit,min_stock,status,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.body.reagent_name, req.body.cas_no||'', req.body.formula||'', req.body.purity||'', req.body.manufacturer||'', req.body.supplier||'', req.body.location||'', req.body.current_stock||0, req.body.unit||'', req.body.min_stock||0, req.body.status||'normal', req.body.expiry_date||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/reagents/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE reagents SET reagent_name=?,cas_no=?,formula=?,purity=?,manufacturer=?,supplier=?,location=?,current_stock=?,unit=?,min_stock=?,status=?,expiry_date=? WHERE id=?',
      [req.body.reagent_name, req.body.cas_no||'', req.body.formula||'', req.body.purity||'', req.body.manufacturer||'', req.body.supplier||'', req.body.location||'', req.body.current_stock||0, req.body.unit||'', req.body.min_stock||0, req.body.status||'normal', req.body.expiry_date||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reagents/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM reagents WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/reagent-records', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT rr.*, r.reagent_name, u.name as operator_name FROM reagent_records rr LEFT JOIN reagents r ON rr.reagent_id=r.id LEFT JOIN users u ON rr.operator_id=u.id') });
});

router.post('/reagent-records', requireAuth, (req, res) => {
  try {
    const info = run('INSERT INTO reagent_records (reagent_id,record_type,quantity,operator_id,record_date,remark) VALUES (?,?,?,?,?,?)',
      [req.body.reagent_id, req.body.record_type, req.body.quantity||0, req.session.userId, req.body.record_date||'', req.body.remark||'']);
    if (req.body.record_type === 'inbound') db.run('UPDATE reagents SET current_stock=current_stock+? WHERE id=?', [req.body.quantity||0, req.body.reagent_id]);
    else db.run('UPDATE reagents SET current_stock=current_stock-? WHERE id=?', [req.body.quantity||0, req.body.reagent_id]);
    saveDB();
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reagent-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM reagent_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/standard-substances', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM standard_substances ORDER BY id') });
});

router.post('/standard-substances', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO standard_substances (substance_name,cas_no,concentration,manufacturer,certificate_no,lot_no,valid_date,current_stock,unit,storage_location,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.body.substance_name, req.body.cas_no||'', req.body.concentration||'', req.body.manufacturer||'', req.body.certificate_no||'', req.body.lot_no||'', req.body.valid_date||'', req.body.current_stock||0, req.body.unit||'', req.body.storage_location||'', req.body.status||'normal']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/standard-substances/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM standard_substances WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/reagent-inbound', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT ri.*, u1.name as operator_name, u2.name as approver_name FROM reagent_inbound ri LEFT JOIN users u1 ON ri.operator_id=u1.id LEFT JOIN users u2 ON ri.approver_id=u2.id') });
});

router.post('/reagent-inbound', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO reagent_inbound (inbound_no,supplier_name,inbound_date,total_amount,total_price,operator_id,approver_id,remark) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.inbound_no, req.body.supplier_name||'', req.body.inbound_date||'', req.body.total_amount||0, req.body.total_price||0, req.body.operator_id||null, req.body.approver_id||null, req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '入库单号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/reagent-inbound/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM reagent_inbound WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/reagent-requisition', requireAuth, (req, res) => {
  res.json({ data: queryAll(
    `SELECT rr.*, r.reagent_name, u1.name as requester_name, u2.name as approver_name
     FROM reagent_requisition rr LEFT JOIN reagents r ON rr.reagent_id=r.id
     LEFT JOIN users u1 ON rr.requester_id=u1.id LEFT JOIN users u2 ON rr.approver_id=u2.id`
  ) });
});

router.post('/reagent-requisition', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO reagent_requisition (requisition_no,reagent_id,requester_id,quantity,unit,purpose,approver_id,approve_status,approve_date,remark) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.body.requisition_no, req.body.reagent_id, req.session.userId, req.body.quantity||0, req.body.unit||'', req.body.purpose||'', req.body.approver_id||null, 'pending', '', req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '领取单号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/reagent-requisition/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE reagent_requisition SET approve_status=?,approve_date=? WHERE id=?',
      [req.body.approve_status||'', req.body.approve_date||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reagent-requisition/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM reagent_requisition WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
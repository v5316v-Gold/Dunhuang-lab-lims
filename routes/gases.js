const express = require('express');
const router = express.Router();

router.get('/gases', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM gases ORDER BY id') });
});

router.post('/gases', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO gases (gas_name,specification,manufacturer,supplier,current_stock,unit,location,cylinder_no,status,next_inspection_date) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.body.gas_name, req.body.specification||'', req.body.manufacturer||'', req.body.supplier||'', req.body.current_stock||0, req.body.unit||'', req.body.location||'', req.body.cylinder_no||'', req.body.status||'normal', req.body.next_inspection_date||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/gases/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE gases SET gas_name=?,specification=?,manufacturer=?,supplier=?,current_stock=?,unit=?,location=?,cylinder_no=?,status=?,next_inspection_date=? WHERE id=?',
      [req.body.gas_name, req.body.specification||'', req.body.manufacturer||'', req.body.supplier||'', req.body.current_stock||0, req.body.unit||'', req.body.location||'', req.body.cylinder_no||'', req.body.status||'normal', req.body.next_inspection_date||'', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gases/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM gases WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/gas-records', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT gr.*, g.gas_name, u.name as operator_name FROM gas_records gr LEFT JOIN gases g ON gr.gas_id=g.id LEFT JOIN users u ON gr.operator_id=u.id') });
});

router.post('/gas-records', requireAuth, (req, res) => {
  try {
    const info = run('INSERT INTO gas_records (gas_id,record_type,quantity,operator_id,record_date,remark) VALUES (?,?,?,?,?,?)',
      [req.body.gas_id, req.body.record_type, req.body.quantity||0, req.session.userId, req.body.record_date||'', req.body.remark||'']);
    if (req.body.record_type === 'inbound') db.run('UPDATE gases SET current_stock=current_stock+? WHERE id=?', [req.body.quantity||0, req.body.gas_id]);
    else db.run('UPDATE gases SET current_stock=current_stock-? WHERE id=?', [req.body.quantity||0, req.body.gas_id]);
    saveDB();
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gas-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM gas_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/gas-inbound', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT gi.*, u.name as operator_name FROM gas_inbound gi LEFT JOIN users u ON gi.operator_id=u.id') });
});

router.post('/gas-inbound', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO gas_inbound (inbound_no,supplier_name,inbound_date,gas_type,quantity,cylinder_count,operator_id,remark) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.inbound_no, req.body.supplier_name||'', req.body.inbound_date||'', req.body.gas_type||'', req.body.quantity||0, req.body.cylinder_count||0, req.session.userId, req.body.remark||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '入库单号已存在' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/gas-inbound/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM gas_inbound WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
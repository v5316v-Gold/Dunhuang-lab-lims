const express = require('express');
const router = express.Router();

router.get('/glassware-suppliers', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM glassware_suppliers ORDER BY id') });
});

router.post('/glassware-suppliers', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO glassware_suppliers (name,contact_person,phone,address,status) VALUES (?,?,?,?,?)',
      [req.body.name, req.body.contact_person||'', req.body.phone||'', req.body.address||'', req.body.status||'active']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/glassware-suppliers/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM glassware_suppliers WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/glassware', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT g.*, s.name as supplier_name FROM glassware g LEFT JOIN glassware_suppliers s ON g.supplier_id=s.id') });
});

router.post('/glassware', requireAuth, (req, res) => {
  try {
    const info = run(
      'INSERT INTO glassware (item_name,specification,material,unit,current_stock,location,supplier_id) VALUES (?,?,?,?,?,?,?)',
      [req.body.item_name, req.body.specification||'', req.body.material||'', req.body.unit||'', req.body.current_stock||0, req.body.location||'', req.body.supplier_id||null]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/glassware/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE glassware SET item_name=?,specification=?,material=?,unit=?,current_stock=?,location=?,supplier_id=? WHERE id=?',
      [req.body.item_name, req.body.specification||'', req.body.material||'', req.body.unit||'', req.body.current_stock||0, req.body.location||'', req.body.supplier_id||null, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/glassware/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM glassware WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/glassware-records', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT gr.*, g.item_name, u.name as operator_name FROM glassware_records gr LEFT JOIN glassware g ON gr.glassware_id=g.id LEFT JOIN users u ON gr.operator_id=u.id') });
});

router.post('/glassware-records', requireAuth, (req, res) => {
  try {
    const info = run('INSERT INTO glassware_records (glassware_id,record_type,quantity,operator_id,record_date,remark) VALUES (?,?,?,?,?,?)',
      [req.body.glassware_id, req.body.record_type, req.body.quantity||0, req.session.userId, req.body.record_date||'', req.body.remark||'']);
    if (req.body.record_type === 'inbound') db.run('UPDATE glassware SET current_stock=current_stock+? WHERE id=?', [req.body.quantity||0, req.body.glassware_id]);
    else db.run('UPDATE glassware SET current_stock=current_stock-? WHERE id=?', [req.body.quantity||0, req.body.glassware_id]);
    saveDB();
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/glassware-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM glassware_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
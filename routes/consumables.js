const express = require('express');
const router = express.Router();

router.get('/consumable-suppliers', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT * FROM consumable_suppliers ORDER BY id') });
});

router.post('/consumable-suppliers', requireAuth, (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: '供应商名称必填' });
  try {
    const info = run(
      'INSERT INTO consumable_suppliers (name,contact_person,phone,address,main_products,status) VALUES (?,?,?,?,?,?)',
      [req.body.name, req.body.contact_person||'', req.body.phone||'', req.body.address||'', req.body.main_products||'', req.body.status||'active']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/consumable-suppliers/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM consumable_suppliers WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/consumables', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT c.*, s.name as supplier_name FROM consumables c LEFT JOIN consumable_suppliers s ON c.supplier_id=s.id ORDER BY c.id') });
});

router.post('/consumables', requireAuth, (req, res) => {
  if (!req.body.item_name) return res.status(400).json({ error: '耗材名称必填' });
  try {
    const info = run(
      'INSERT INTO consumables (item_name,specification,unit,category,min_stock,current_stock,location,supplier_id) VALUES (?,?,?,?,?,?,?,?)',
      [req.body.item_name, req.body.specification||'', req.body.unit||'', req.body.category||'', req.body.min_stock||0, req.body.current_stock||0, req.body.location||'', req.body.supplier_id||null]
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/consumables/:id', requireAuth, (req, res) => {
  try {
    run('UPDATE consumables SET item_name=?,specification=?,unit=?,category=?,min_stock=?,current_stock=?,location=?,supplier_id=? WHERE id=?',
      [req.body.item_name||'', req.body.specification||'', req.body.unit||'', req.body.category||'', req.body.min_stock||0, req.body.current_stock||0, req.body.location||'', req.body.supplier_id||null, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/consumables/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM consumables WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/consumable-records', requireAuth, (req, res) => {
  res.json({ data: queryAll('SELECT cr.*, c.item_name, u.name as operator_name FROM consumable_records cr LEFT JOIN consumables c ON cr.consumable_id=c.id LEFT JOIN users u ON cr.operator_id=u.id') });
});

router.post('/consumable-records', requireAuth, (req, res) => {
  if (!req.body.consumable_id || !req.body.record_type) return res.status(400).json({ error: '参数不完整' });
  try {
    const info = run(
      'INSERT INTO consumable_records (consumable_id,record_type,quantity,operator_id,record_date,remark) VALUES (?,?,?,?,?,?)',
      [req.body.consumable_id, req.body.record_type, req.body.quantity||0, req.session.userId, req.body.record_date||'', req.body.remark||'']
    );
    if (req.body.record_type === 'inbound') db.run('UPDATE consumables SET current_stock=current_stock+? WHERE id=?', [req.body.quantity||0, req.body.consumable_id]);
    else db.run('UPDATE consumables SET current_stock=current_stock-? WHERE id=?', [req.body.quantity||0, req.body.consumable_id]);
    saveDB();
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/consumable-records/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM consumable_records WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
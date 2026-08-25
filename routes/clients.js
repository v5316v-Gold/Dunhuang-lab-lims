const express = require('express');
const router = express.Router();

// ============================================================
// 2026-08-11 P0 工作流 API — 客户管理（节点 1）
// ============================================================

// 获取客户列表
router.get('/clients', requireAuth, (req, res) => {
  try {
    const { keyword, status, client_type } = req.query;
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    if (keyword) { sql += ' AND (client_name LIKE ? OR client_code LIKE ? OR contact_person LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%'); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (client_type) { sql += ' AND client_type = ?'; params.push(client_type); }
    sql += ' ORDER BY id DESC LIMIT 500';
    res.json({ success: true, data: queryAll(sql, params) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取单个客户
router.get('/clients/:id', requireAuth, (req, res) => {
  try {
    const c = queryOne('SELECT * FROM clients WHERE id = ?', [parseInt(req.params.id)]);
    if (!c) return res.status(404).json({ error: '客户不存在' });
    res.json({ success: true, data: c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 新建客户
router.post('/clients', requireAuth, (req, res) => {
  try {
    const { client_name, contact_person, contact_phone, contact_email, address, client_type, credit_level, remark } = req.body;
    if (!client_name) return res.status(400).json({ error: '客户名称不能为空' });
    // 自动生成客户编号 CLT-001
    const max = queryOne("SELECT MAX(id) as max_id FROM clients");
    const nextId = (max && max.max_id) ? max.max_id + 1 : 1;
    const client_code = 'CLT-' + String(nextId).padStart(4, '0');
    const result = run(
      'INSERT INTO clients (client_code, client_name, contact_person, contact_phone, contact_email, address, client_type, credit_level, remark, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [client_code, client_name, contact_person||'', contact_phone||'', contact_email||'', address||'', client_type||'company', credit_level||'B', remark||'', 'active']
    );
    res.json({ success: true, id: result.lastInsertRowid, client_code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 更新客户
router.put('/clients/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { client_name, contact_person, contact_phone, contact_email, address, client_type, credit_level, status, remark } = req.body;
    run(
      'UPDATE clients SET client_name=?, contact_person=?, contact_phone=?, contact_email=?, address=?, client_type=?, credit_level=?, status=?, remark=?, updated_at=datetime(\'now\') WHERE id=?',
      [client_name, contact_person||'', contact_phone||'', contact_email||'', address||'', client_type||'company', credit_level||'B', status||'active', remark||'', id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除客户
router.delete('/clients/:id', requireAdmin, (req, res) => {
  try {
    run('DELETE FROM clients WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

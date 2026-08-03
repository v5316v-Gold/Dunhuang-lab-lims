const express = require('express');
const { DepartmentCreateSchema, PersonnelCreateSchema, UserCertCreateSchema, validate } = require('../validators/schemas');

const router = express.Router();

// GET /api/departments
router.get('/departments', requireAuth, (req, res) => {
  try {
    const rows = queryAll('SELECT * FROM departments ORDER BY id');
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/departments
router.post('/departments', requireAdmin, validate(DepartmentCreateSchema), (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: '部门名称必填' });
  try {
    const info = run('INSERT INTO departments (name, manager_id, parent_id) VALUES (?,?,?)',
      [req.body.name, req.body.manager_id||null, req.body.parent_id||null]);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/departments/:id
router.put('/departments/:id', requireAdmin, validate(DepartmentCreateSchema), (req, res) => {
  try {
    run('UPDATE departments SET name=?, manager_id=?, parent_id=? WHERE id=?',
      [req.body.name||'', req.body.manager_id||null, req.body.parent_id||null, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/departments/:id
router.delete('/departments/:id', requireAdmin, (req, res) => {
  try { run('DELETE FROM departments WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/personnel
router.get('/personnel', requireAuth, (req, res) => {
  try {
    const rows = queryAll('SELECT u.*, d.name as dept_name FROM users u LEFT JOIN departments d ON u.dept=d.id ORDER BY u.id DESC');
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/personnel
router.post('/personnel', requireAdmin, validate(PersonnelCreateSchema), (req, res) => {
  const { username, password, name, role, dept, title, email, phone, id_card, education, cert_no, hiredate } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: '用户名、密码、姓名必填' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = run(
      'INSERT INTO users (username,password,role,name,dept,title,email,phone,id_card,education,cert_no,hiredate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [username, hash, role||'analyst', name, dept||'', title||'', email||'', phone||'', id_card||'', education||'', cert_no||'', hiredate||'']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '用户名已存在' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/personnel/:id
router.put('/personnel/:id', requireAdmin, validate(PersonnelCreateSchema), (req, res) => {
  try {
    run('UPDATE users SET name=?,role=?,dept=?,title=?,email=?,phone=?,id_card=?,education=?,cert_no=?,hiredate=?,status=? WHERE id=?',
      [req.body.name||'', req.body.role||'analyst', req.body.dept||'', req.body.title||'', req.body.email||'', req.body.phone||'', req.body.id_card||'', req.body.education||'', req.body.cert_no||'', req.body.hiredate||'', req.body.status||'active', parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '用户名已存在' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/personnel/:id
router.delete('/personnel/:id', requireAdmin, (req, res) => {
  try { run('DELETE FROM users WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/user-certifications
router.get('/user-certifications', requireAuth, (req, res) => {
  try {
    const rows = queryAll('SELECT uc.*, u.name as user_name FROM user_certifications uc LEFT JOIN users u ON uc.user_id=u.id');
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/user-certifications
router.post('/user-certifications', requireAdmin, validate(UserCertCreateSchema), (req, res) => {
  if (!req.body.user_id || !req.body.cert_name) return res.status(400).json({ error: '用户ID和证书名称必填' });
  try {
    const info = run(
      'INSERT INTO user_certifications (user_id,cert_name,cert_no,issue_date,expiry_date,cert_file,status) VALUES (?,?,?,?,?,?,?)',
      [req.body.user_id, req.body.cert_name, req.body.cert_no||'', req.body.issue_date||'', req.body.expiry_date||'', req.body.cert_file||'', req.body.status||'valid']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/user-certifications/:id
router.delete('/user-certifications/:id', requireAdmin, (req, res) => {
  try { run('DELETE FROM user_certifications WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const user = queryOne('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const match = bcrypt.compareSync(password, user.password);
  if (!match) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.name = user.name;
  return res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: '退出失败' });
    return res.json({ success: true });
  });
});

router.get('/session', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  return res.json({ user: { id: req.session.userId, username: req.session.username, role: req.session.role, name: req.session.name } });
});

router.get('/all-users', requireAuth, (req, res) => {
  const users = queryAll('SELECT id, name, role, dept FROM users WHERE status = ?', ['active']);
  return res.json({ success: true, users });
});

module.exports = router;
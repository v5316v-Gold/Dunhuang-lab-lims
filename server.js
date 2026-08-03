// ============================================================
// 敦煌金检测中心 LIMS 系统 - 重构版 server.js
// 模块化架构 + CNAS 审计追踪
// ============================================================
// 配置加载（必须最先执行，使 process.env 在其他模块 require 前生效）
require('dotenv').config();

const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
// 优先使用 .env 中的路径；否则用历史硬编码（向后兼容）
const DB_DATA_PATH = process.env.DB_DATA_PATH || 'D:\\lims_data\\lims_cnas.data';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'D:\\lims_uploads';

// SESSION_SECRET 防御：必须从环境变量读取；缺失时仅在非生产环境使用固定 fallback
const SESSION_SECRET = (() => {
  const v = process.env.SESSION_SECRET;
  if (v && v.length >= 32) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] SESSION_SECRET 未配置或长度不足 32 字符。' +
      '生产环境必须设置。生成方式: openssl rand -base64 32'
    );
  }
  console.warn(
    '[WARN] 使用不安全的 SESSION_SECRET fallback（仅限开发环境）。' +
    '生产部署前请设置环境变量 SESSION_SECRET=<openssl rand -base64 32>'
  );
  return 'dev-only-INSECURE-fallback-DO-NOT-USE-IN-PRODUCTION';
})();
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config for PDF uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({ storage: storage, fileFilter: function(req, file, cb) {
  if (file.mimetype === 'application/pdf') { cb(null, true); }
  else { cb(new Error('仅支持PDF文件'), false); }
}, limits: { fileSize: 50 * 1024 * 1024 } });

let db;

// ============================================================
// Database helpers
// ============================================================
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  const r = db.exec('SELECT last_insert_rowid()');
  return { lastInsertRowid: r[0]?.values[0]?.[0] || 0 };
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_DATA_PATH, Buffer.from(data));
}

// ============================================================
// CNAS Audit Trail
// ============================================================
function makeAudit(action, table_name, record_id, old_data, req) {
  const user_id = req.session.userId || null;
  const username = req.session.username || '';
  const ip_address = req.ip || req.connection.remoteAddress || '';
  run(
    `INSERT INTO audit_logs (user_id, username, action, table_name, record_id, old_data, new_data, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [user_id, username, action, table_name, record_id,
     old_data ? JSON.stringify(old_data) : null,
     req.body ? JSON.stringify(req.body) : null,
     ip_address]
  );
}

// Also write audit entries for LIST queries (optional, skip for now)
// Only write CREATE / UPDATE / DELETE audit logs

// ============================================================
// Middleware
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,  // 已从 env 加载，强校验
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true, sameSite: 'lax' }  // 加固：httpOnly + sameSite
}));

// Make globals available to route modules
global.db = db;
global.requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
global.requireAdmin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};
global.queryAll = queryAll;
global.queryOne = queryOne;
global.run = run;
global.saveDB = saveDB;
global.bcrypt = bcrypt;
global.makeAudit = makeAudit;

// ============================================================
// Routes
// ============================================================
const authRoutes = require('./routes/auth');
const personnelRoutes = require('./routes/personnel');
const projectsRoutes = require('./routes/projects');
const sampleRoutes = require('./routes/sample');
const equipmentRoutes = require('./routes/equipment');
const consumablesRoutes = require('./routes/consumables');
const glasswareRoutes = require('./routes/glassware');
const reagentsRoutes = require('./routes/reagents');
const gasesRoutes = require('./routes/gases');
const fumehoodTrainingRoutes = require('./routes/fumehood');
const ehsRoutes = require('./routes/ehs');
const workflowRoutes = require('./routes/workflow');

app.use('/api/auth', authRoutes);
app.use('/api', personnelRoutes);       // /api/departments, /api/personnel, /api/user-certifications
app.use('/api', projectsRoutes);       // /api/projects, /api/project-records
app.use('/api', sampleRoutes);          // /api/appointments, /api/sample-processing
app.use('/api', equipmentRoutes);      // /api/equipment, /api/maintenance, /api/calibration, /api/equipment-repairs
app.use('/api', consumablesRoutes);    // /api/consumable-suppliers, /api/consumables, /api/consumable-records
app.use('/api', glasswareRoutes);      // /api/glassware-suppliers, /api/glassware, /api/glassware-records
app.use('/api', reagentsRoutes);       // /api/reagents, /api/reagent-records, /api/standard-substances, /api/reagent-inbound, /api/reagent-requisition
app.use('/api', gasesRoutes);          // /api/gases, /api/gas-records, /api/gas-inbound
app.use('/api', fumehoodTrainingRoutes.fumehood);    // /api/fumehood, /api/fumehood-records
app.use('/api', fumehoodTrainingRoutes.training);     // /api/training-annual, /api/training-records
app.use('/api', ehsRoutes);            // /api/ehs-inspection, /api/ehs-incident, /api/ehs-hazard
app.use('/api', workflowRoutes);   // /api/workflow/*

// ============================================================
// Dashboard Stats
// ============================================================
app.get('/api/dashboard/stats', (req, res) => {
  const total = queryOne('SELECT COUNT(*) as c FROM samples')?.c || 0;
  const pending = queryOne("SELECT COUNT(*) as c FROM sample_appointments WHERE status='pending'")?.c || 0;
  const equipment = queryOne('SELECT COUNT(*) as c FROM equipment')?.c || 0;
  const personnel = queryOne('SELECT COUNT(*) as c FROM users')?.c || 0;
  const consumables = queryOne('SELECT COUNT(*) as c FROM consumables')?.c || 0;
  const reagents = queryOne('SELECT COUNT(*) as c FROM reagents')?.c || 0;
  const hazards = queryOne("SELECT COUNT(*) as c FROM ehs_hazard WHERE status='pending'")?.c || 0;
  const projects = queryOne('SELECT COUNT(*) as c FROM projects')?.c || 0;
  res.json({ total, pending, equipment, personnel, consumables, reagents, hazards, projects });
});

// ============================================================
// Experimental Data Reports
// ============================================================
app.get('/api/experimental-data-reports', requireAuth, (req, res) => {
  const rows = queryAll(`
    SELECT r.*, u.name as analyst_name, s.name as supervisor_name,
           e.equip_name, p.project_name
    FROM experimental_data_reports r
    LEFT JOIN users u ON r.analyst_id=u.id
    LEFT JOIN users s ON r.supervisor_id=s.id
    LEFT JOIN equipment e ON r.equipment_id=e.id
    LEFT JOIN projects p ON r.project_id=p.id
    ORDER BY r.id DESC
  `);
  res.json({ data: rows });
});

app.post('/api/experimental-data-reports', requireAuth, (req, res) => {
  if (!req.body.report_no) return res.status(400).json({ error: '报告编号必填' });
  try {
    const info = run(
      `INSERT INTO experimental_data_reports (report_no,sample_code,project_id,report_date,detection_method,analyst_id,supervisor_id,equipment_id,result_data,conclusion,remark,attachment_path,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.body.report_no, req.body.sample_code||'',
       req.body.project_id||null, req.body.report_date||'',
       req.body.detection_method||'',
       req.body.analyst_id||null, req.body.supervisor_id||null,
       req.body.equipment_id||null, req.body.result_data||'',
       req.body.conclusion||'', req.body.remark||'',
       req.body.attachment_path||'', req.body.status||'draft']
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '报告编号已存在' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/experimental-data-reports/:id', requireAuth, (req, res) => {
  try {
    run(`UPDATE experimental_data_reports SET
      report_no=?,sample_code=?,project_id=?,report_date=?,detection_method=?,
      analyst_id=?,supervisor_id=?,equipment_id=?,result_data=?,conclusion=?,remark=?,attachment_path=?,status=?,
      updated_at=datetime('now') WHERE id=?`,
      [req.body.report_no, req.body.sample_code||'',
       req.body.project_id||null, req.body.report_date||'',
       req.body.detection_method||'',
       req.body.analyst_id||null, req.body.supervisor_id||null,
       req.body.equipment_id||null, req.body.result_data||'',
       req.body.conclusion||'', req.body.remark||'',
       req.body.attachment_path||'', req.body.status||'draft',
       parseInt(req.params.id)]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/experimental-data-reports/:id', requireAuth, (req, res) => {
  try { run('DELETE FROM experimental_data_reports WHERE id=?', [parseInt(req.params.id)]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// Upload PDF attachment
app.post('/api/experimental-data-reports-upload', requireAuth, upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择PDF文件' });
  // Return the saved filename for storage in the record
  res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
});

// Serve uploaded PDFs
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('文件不存在');
  res.sendFile(path.resolve(filePath));
});


// POST /api/consumption-records - 新增消耗记录
app.post('/api/consumption-records', requireAuth, (req, res) => {
  try {
    const { processing_id, item_type, item_id, item_name, quantity, unit, operator_id } = req.body;
    const result = query(
      "INSERT INTO consumption_records (processing_id, item_type, item_id, item_name, quantity, unit, operator_id) VALUES (?,?,?,?,?,?,?)",
      [processing_id||null, item_type||'', item_id||null, item_name||'', quantity||0, unit||'', operator_id||null]
    );
    const inserted = queryOne('SELECT * FROM consumption_records WHERE id=?', [result.lastInsertRowid]);
    res.json({ success: true, data: inserted });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/consumption-records/:id - 更新消耗记录
app.put('/api/consumption-records/:id', requireAuth, (req, res) => {
  try {
    const { processing_id, item_type, item_id, item_name, quantity, unit } = req.body;
    query(
      "UPDATE consumption_records SET processing_id=?, item_type=?, item_id=?, item_name=?, quantity=?, unit=? WHERE id=?",
      [processing_id||null, item_type||'', item_id||null, item_name||'', quantity||0, unit||'', req.params.id]
    );
    res.json({ success: true, data: queryOne('SELECT * FROM consumption_records WHERE id=?', [req.params.id]) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/consumption-records - 查看库存消耗记录
app.get('/api/consumption-records', requireAuth, (req, res) => {
  try {
    const rows = queryAll(
      "SELECT cr.*, u.name as operator_name, " +
      "sp.sample_code, sp.detection_method " +
      "FROM consumption_records cr " +
      "LEFT JOIN users u ON cr.operator_id = u.id " +
      "LEFT JOIN sample_processing sp ON cr.processing_id = sp.id " +
      "ORDER BY cr.id DESC LIMIT 200"
    );
    res.json({ data: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 实验工作流 API
// ============================================================

// GET /api/workflow/pending-assign - 管理员查看所有待分配的预约
app.get('/api/workflow/pending-assign', requireAuth, (req, res) => {
  try {
    const rows = queryAll(`
      SELECT a.*, u.name as creator_name
      FROM sample_appointments a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.workflow_status = 'pending'
      ORDER BY a.id DESC
    `);
    res.json({ data: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflow/assign - 为预约指派实验人员
app.post('/api/workflow/assign', requireAuth, (req, res) => {
  const { appointment_id, user_id, remark } = req.body;
  if (!appointment_id || !user_id) return res.status(400).json({ error: 'appointment_id 和 user_id 必填' });
  try {
    // 插入分配记录
    const info = run(
      `INSERT INTO workflow_assignments (appointment_id, assigned_to, assigned_by, remark)
       VALUES (?, ?, ?, ?)`,
      [appointment_id, user_id, req.session.userId, remark || '']
    );
    // 更新预约状态
    run(
      `UPDATE sample_appointments SET workflow_status = 'assigned', assigned_to = ? WHERE id = ?`,
      [user_id, appointment_id]
    );
    res.json({ success: true, assignment_id: info.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflow/my-tasks - 获取当前用户被分配的实验任务
app.get('/api/workflow/my-tasks', requireAuth, (req, res) => {
  try {
    const rows = queryAll(`
      SELECT
        wa.id as assignment_id,
        wa.appointment_id,
        wa.status,
        wa.assigned_at,
        wa.remark,
        wa.completed_at,
        a.sample_code,
        a.send_date,
        a.detection_method,
        a.client_name,
        a.sample_type,
        a.expected_date,
        a.contact_person,
        a.contact_phone,
        a.sample_count,
        a.packaging_intact,
        a.remark as appointment_remark,
        u1.name as assigned_by_name,
        a.workflow_status
      FROM workflow_assignments wa
      JOIN sample_appointments a ON wa.appointment_id = a.id
      LEFT JOIN users u1 ON wa.assigned_by = u1.id
      WHERE wa.assigned_to = ?
      ORDER BY wa.id DESC
    `, [req.session.userId]);
    res.json({ data: rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflow/complete-processing - 实验人员完成实验处理
app.post('/api/workflow/complete-processing', requireAuth, (req, res) => {
  const { assignment_id, processing_data, consumption_data } = req.body;
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id 必填' });
  try {
    // 获取分配记录
    const assignment = queryOne('SELECT * FROM workflow_assignments WHERE id = ?', [assignment_id]);
    if (!assignment) return res.status(404).json({ error: '分配记录不存在' });

    // 准备处理数据（合并原有字段 + 新字段）
    const pd = processing_data || {};
    const apptId = assignment.appointment_id;

    // 在 sample_processing 插入记录
    const procInfo = run(
      `INSERT INTO sample_processing (
        appointment_id, sample_code, sample_name, sample_type, packaging_intact,
        processing_method, detection_method, processing_date,
        equipment_id, environment_temp, environment_humidity,
        consumables_used, reagents_used, gases_used,
        processing_desc, result_data, result_conclusion,
        report_no, operator_id, supervisor_id,
        consumption_records, workflow_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        apptId,
        pd.sample_code || '',
        pd.sample_name || '',
        pd.sample_type || '',
        pd.packaging_intact || 'yes',
        pd.processing_method || '',
        pd.detection_method || '',
        pd.processing_date || '',
        pd.equipment_id || null,
        pd.environment_temp || '',
        pd.environment_humidity || '',
        pd.consumables_used || '',
        pd.reagents_used || '',
        pd.gases_used || '',
        pd.processing_desc || '',
        pd.result_data || '',
        pd.result_conclusion || '',
        pd.report_no || '',
        req.session.userId,
        pd.supervisor_id || null,
        JSON.stringify(consumption_data || []),
        'completed'
      ]
    );
    const processing_id = procInfo.lastInsertRowid;

    // 扣减库存 + 记录消耗
    const consumption_summary = [];
    const records = consumption_data || [];
    for (const item of records) {
      const { item_type, item_id, item_name, quantity, unit } = item;
      if (!item_type || !item_id || !quantity) continue;

      // 扣减对应表库存
      let table, stockCol;
      if (item_type === 'consumable') { table = 'consumables'; stockCol = 'current_stock'; }
      else if (item_type === 'reagent') { table = 'reagents'; stockCol = 'current_stock'; }
      else if (item_type === 'gas') { table = 'gases'; stockCol = 'current_stock'; }
      else continue;

      try {
        db.run(`UPDATE ${table} SET ${stockCol} = ${stockCol} - ? WHERE id = ?`, [quantity, item_id]);
      } catch(e) { /* ignore if column missing */ }

      // 插入消耗记录
      run(
        `INSERT INTO consumption_records (processing_id, item_type, item_id, item_name, quantity, unit, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [processing_id, item_type, item_id, item_name || '', quantity, unit || '', req.session.userId]
      );

      consumption_summary.push({ item_type, item_id, item_name, quantity, unit });
    }

    saveDB();

    // 更新 workflow_assignments 状态
    run(
      `UPDATE workflow_assignments SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      [assignment_id]
    );

    // 更新 sample_appointments 的 workflow_status
    run(
      `UPDATE sample_appointments SET workflow_status = 'completed' WHERE id = ?`,
      [apptId]
    );

    res.json({ success: true, processing_id, consumption_summary });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// Init DB
// ============================================================
async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_DATA_PATH)) {
    const buf = fs.readFileSync(DB_DATA_PATH);
    db = new SQL.Database(buf);
    console.log('[OK] Database loaded');
  } else {
    db = new SQL.Database();
    console.log('[OK] New database created');
  }
  db.run('PRAGMA foreign_keys = ON');

  // Update global db reference
  global.db = db;

  // Load schema
  const { createTables, runMigrations } = require('./db/schema');
  createTables(db);
  runMigrations(db);

  seedData();
  saveDB();
  return db;
}

function seedData() {
  const adminCheck = db.exec("SELECT id FROM users WHERE username='admin'");
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO users (username,password,role,name,dept,title) VALUES (?,?,?,?,?,?)",
      ['admin', hash, 'admin', '系统管理员', '质量管理部', 'LIMS系统管理员']);
    db.run("INSERT INTO departments (name) VALUES ('质量管理部')");
    db.run("INSERT INTO departments (name) VALUES ('检测部')");
    db.run("INSERT INTO departments (name) VALUES ('样品管理部')");
    db.run("INSERT INTO departments (name) VALUES ('设备管理部')");
    db.run("INSERT INTO departments (name) VALUES ('综合管理部')");

    // Sample detection methods
    const methods = [
      ['ICP-S-001', 'ICP电感耦合等离子体质谱法', 'ICP', '适用于矿石、土壤、水样中多元素定量分析'],
      ['FIRE-S-001', '火法金分析方法', '火法', '适用于金矿样品金含量测定'],
      ['XRF-S-001', 'X射线荧光光谱法', 'X荧光', '适用于固体样品主次元素半定量分析'],
      ['FAAS-S-001', '火焰原子吸收光谱法', '火焰原子', '适用于水质、土壤中金属元素定量分析'],
    ];
    methods.forEach(m => {
      db.run("INSERT INTO projects (project_no,project_name,method_type,description) VALUES (?,?,?,?)", m);
    });

    // Sample fumehood
    db.run("INSERT INTO fumehood (fumehood_no,location,brand_model,wind_speed,status) VALUES (?,?,?,?,?)",
      ['FH-001', '检测室A', '苏州林顿FH-1200', '0.5m/s', 'normal']);

    console.log('[OK] Default admin and depts created: admin / admin123');
  }
}

// ============================================================
// Start
// ============================================================
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  敦煌金检测中心LIMS系统已启动 [模块化架构]`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  局域网: http://192.168.2.55:${PORT}`);
    console.log(`  默认账号: admin / admin123`);
    console.log(`  审计追踪: 已启用\n`);
  });
}).catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

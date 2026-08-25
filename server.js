// ============================================================
// 敦煌金检测中心 LIMS 系统 - 重构版 server.js
// 模块化架构 + CNAS 审计追踪
// ============================================================
// 配置加载（必须最先执行，使 process.env 在其他模块 require 前生效）
require('dotenv').config({ override: true });
console.log('[BOOT] dotenv 加载完成 PORT=' + JSON.stringify(process.env.PORT));

const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
// 阶段 1.2 修复: __db shim (让 db.exec(SQL, params) 工作)
const __db = {
  exec: function(sql, params) {
    const _d = global.db;
    if (params !== undefined && params !== null) {
      if (Array.isArray(params)) return _d.prepare(sql).run(params);
      return _d.prepare(sql).run([params]);
    }
    return _d.exec(sql);
  }
};
// 阶段 1.2 修复: better-sqlite3 的 db.exec 不支持参数// 用一个 shim 让旧代码 __db.exec(SQL, params) 也能工作const __origDbExec = Database.prototype.exec;Database.prototype.exec = function(sql, params) {  if (params) return this.prepare(sql).run(params);  return __origDbExec.call(this, sql);};
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const helmet = require('helmet');
const { z } = require('zod');
const { AuditChain } = require('./lib/audit-chain');
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
  try {
    if (params.length > 0) {
      return db.prepare(sql).all(params);
    }
    return db.prepare(sql).all();
  } catch (e) {
    console.error('[queryAll err]', sql.substring(0, 100), e.message);
    return [];
  }
}



function queryOne(sql, params = []) {
  try {
    if (params.length > 0) {
      return db.prepare(sql).get(params) || null;
    }
    return db.prepare(sql).get() || null;
  } catch (e) {
    console.error('[queryOne err]', sql.substring(0, 100), e.message);
    return null;
  }
}



function run(sql, params = []) {
  try {
    const info = params.length > 0
      ? db.prepare(sql).run(params)
      : db.prepare(sql).run();
    return { lastInsertRowid: Number(info.lastInsertRowid) || 0, changes: info.changes };
  } catch (e) {
    console.error('[run err]', sql.substring(0, 100), e.message);
    throw e;
  }
}



// saveDB: better-sqlite3 自动持久化，无需手动保存
function saveDB() {
  // no-op
}



// ============================================================
// CNAS Audit Trail
// ============================================================
function makeAudit(req, action, tableName, recordId, oldData, newData) {
  // P0-2 CNAS: 使用 SHA256 hash chain
  if (global.auditChain) {
    return global.auditChain.append({
      user_id: req.session?.userId || null,
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
      ip_address: req.ip || req.headers?.['x-forwarded-for'] || null
    });
  }
  // Fallback: 旧的 makeAudit（如果 auditChain 未初始化）
  const userId = req.session ? req.session.userId : null;
  const ip = req.ip || (req.headers && req.headers['x-forwarded-for']) || '';
  try {
    run("INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, action, tableName, recordId, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, ip]);
  } catch(e) { console.error('[AUDIT] write failed:', e.message); }
}

// Also write audit entries for LIST queries (optional, skip for now)
// Only write CREATE / UPDATE / DELETE audit logs

// ============================================================
// Middleware
// ============================================================
// helmet: HTTP 安全头（XSS/CSP/HSTS）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://code.jquery.com", "https://maxcdn.bootstrapcdn.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://maxcdn.bootstrapcdn.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:", "https://maxcdn.bootstrapcdn.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: "'unsafe-inline'"
    }
  },
  crossOriginEmbedderPolicy: false
}));
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
  // 阶段 1.2: db instance shim disabled - using global __db wrapper
app.locals.db = db;  // 阶段 1.2 - RBAC 中间件需要
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
// 2026-08-11 P0 工作流路由
app.use('/api', require('./routes/clients'));        // 客户管理 (GET /clients)
app.use('/api/workflow', require('./routes/workflow'));  // 工作流 (POST /projects/:id/submit 等)
// 2026-08-11 阶段 2 P1 质控引擎
app.use('/api', require('./routes/qc'));           // QC 质控 + Westgard + LJ图
// 2026-08-11 阶段 2 P1 CAPA 流程
app.use('/api', require('./routes/capa'));         // CAPA 纠正预防
// 2026-08-11 阶段 2 P1 2 级审批
app.use('/api', require('./routes/approval'));     // 一级核验 + 二级审核
// 2026-08-11 阶段 2 - 任务分派（节点 4）
app.use('/api', require('./routes/task-assign'));
// 2026-08-11 阶段 3 - 设备 IoT（节点 6）
app.use('/api', require('./routes/device-iot'));
// 2026-08-11 阶段 3 - 不确定度 A/B 类评定
app.use('/api', require('./routes/uncertainty'));

app.use('/api/permissions', require('./routes/permissions'));  // 阶段 1.2 - 8 岗位 RBAC
app.use('/api/excel', require('./routes/excel'));   // /api/excel/*

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
  const hazards = queryOne("SELECT COUNT(*) as c FROM ehs_hazard WHERE status IN ('pending','open','investigating')")?.c || 0;
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
        __db.exec(`UPDATE ${table} SET ${stockCol} = ${stockCol} - ? WHERE id = ?`, [quantity, item_id]);
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
  try {
    if (fs.existsSync(DB_DATA_PATH)) {
      db = new Database(DB_DATA_PATH);
      console.log('[OK] Database loaded (better-sqlite3 persistent)');
    } else {
      db = new Database(DB_DATA_PATH);
      console.log('[OK] New database created (better-sqlite3 persistent)');
    }
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    // Update global db reference
    // better-sqlite3 原生支持 db.exec(sqlString) 多语句执行 + db.prepare(sql).run() 单语句
    // 不再 monkey-patch（之前版本与 sql.js 兼容导致多语句 CREATE TABLE 失败）

    // 设置 global.db (阶段 1.2 RBAC 中间件需要) + app.locals.db
    global.db = db;
  // 阶段 1.2: db instance shim disabled - using global __db wrapper

    // Load schema
    const { createTables, runMigrations, applyP0Migration } = require('./db/schema');
    createTables(db);
    runMigrations(db);
    // 2026-08-11: Apply P0 workflow migration
    if (typeof applyP0Migration === 'function') {
      applyP0Migration(db);
    }

    // Initialize audit chain (P0-2 CNAS compliance)
    // 必须先于 seedData()，因为 seedData 内部可能写 audit
    const auditChain = new AuditChain(db);
    auditChain.installTriggers();
    global.auditChain = auditChain;
    console.log('[OK] Audit chain initialized (SHA256 + append-only triggers)');

    // Migrate existing audit_logs to hash chain (idempotent)
    if (process.env.SKIP_AUDIT_MIGRATE !== '1') {
      try {
        const verifyResult = auditChain.verify();
        if (!verifyResult.valid && verifyResult.total > 0) {
          console.log('[AUDIT-CHAIN] Existing records detected, migrating...');
          const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id ASC').all();
          let prevHash = '0'.repeat(64);
          const update = db.prepare('UPDATE audit_logs SET prev_hash = ?, curr_hash = ? WHERE id = ?');
          const crypto = require('crypto');
          db.transaction(() => {
            for (const row of rows) {
              if (row.curr_hash && row.curr_hash !== 'pending') {
                if (row.prev_hash === prevHash) { prevHash = row.curr_hash; continue; }
              }
              const data = {
                ts: row.created_at,
                user_id: row.user_id,
                action: row.action,
                table_name: row.table_name,
                record_id: row.record_id,
                old_data: row.old_data ? JSON.parse(row.old_data) : null,
                new_data: row.new_data ? JSON.parse(row.new_data) : null
              };
              const json = JSON.stringify(data);
              const newHash = crypto.createHash('sha256').update(prevHash + json).digest('hex');
              update.run(prevHash, newHash, row.id);
              prevHash = newHash;
            }
          })();
          console.log('[AUDIT-CHAIN] Migration complete: ' + rows.length + ' records');
        }
      } catch (e) {
        console.warn('[AUDIT-CHAIN] Migration skipped (no existing data):', e.message);
      }
    }

    seedData();
    return db;
  } catch (e) {
    console.error('[FATAL] initDB failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

function seedData() {
  // ==================== 用户 ====================
  const userCheckRows = db.prepare("SELECT id FROM users WHERE username='yuwangang'").all();
  const userCheck = userCheckRows.length > 0 ? [{values: userCheckRows}] : [];
  if (userCheck.length > 0 && userCheck[0].values.length > 0) {
    console.log('[OK] Database already seeded, skipping');
    return;
  }

  console.log('[SEED] Initializing comprehensive test data...');

  const ywgHash = bcrypt.hashSync('123456', 10);
  const adminHash = bcrypt.hashSync('admin123', 10);

  // 主用户：yuwangang / 123456 / 检测员
  __db.exec("INSERT INTO users (username,password,role,name,dept,title) VALUES (?,?,?,?,?,?)",
    ['yuwangang', ywgHash, 'analyst', '余万刚', '检测部', '高级检测员']);

  // 备用管理员
  __db.exec("INSERT INTO users (username,password,role,name,dept,title) VALUES (?,?,?,?,?,?)",
    ['admin', adminHash, 'admin', '系统管理员', '质量管理部', 'LIMS系统管理员']);

  // 实验室主管 + 高级分析师
  const staffList = [
    ['lab_manager', 'manager', '张文博', '检测部', '实验室主管'],
    ['staff01', 'analyst', '李雅琴', '化学室', '主任技师'],
    ['staff02', 'analyst', '王建辉', '仪器室', '高级工程师'],
    ['staff03', 'analyst', '陈思远', '理化室', '工程师'],
    ['staff04', 'analyst', '刘晓燕', '微生物室', '高级工程师'],
    ['staff05', 'analyst', '赵明阳', '前处理室', '助理工程师'],
    ['staff06', 'analyst', '孙慧敏', '质量监督', '高级工程师'],
    ['staff07', 'analyst', '周文凯', '样品管理部', '助理工程师'],
    ['staff08', 'analyst', '吴丽华', '综合管理部', '管理员'],
    ['staff09', 'analyst', '郑红梅', '检测部', '助理工程师'],
    ['staff10', 'analyst', '马志强', '仪器室', '工程师'],
  ];
  staffList.forEach(s => {
    __db.exec("INSERT INTO users (username,password,role,name,dept,title) VALUES (?,?,?,?,?,?)",
      [s[0], ywgHash, s[1], s[2], s[3], s[4]]);
  });

  // ==================== 部门 ====================
  const deptNames = [
    '质量管理部', '检测部', '化学室', '仪器室', '微生物室',
    '理化室', '前处理室', '样品管理部', '设备管理部', '综合管理部', '质量监督'
  ];
  deptNames.forEach(d => __db.exec("INSERT INTO departments (name) VALUES (?)", [d]));

  // ==================== 检测项目（projects） ====================
  // projects 表：id, project_no, project_name, method_type, description, created_at
  const projectList = [
    ['ICP-S-001', '水质多元素分析（ICP-MS法）', 'ICP', '适用于饮用水、地表水、地下水等水体中32种元素定量分析'],
    ['ICP-S-002', '土壤重金属检测', 'ICP', '土壤中Pb/Cd/Cr/As/Hg等8种重金属检测'],
    ['FIRE-S-001', '金矿石火法试金分析', '火法', '金矿石、含金物料中Au含量测定（0.1-1000g/t）'],
    ['FIRE-S-002', '银含量火法测定', '火法', '银矿石及精矿中Ag含量测定'],
    ['XRF-S-001', '矿石主元素XRF分析', 'X荧光', '适用于固体矿石样品主次元素半定量分析'],
    ['XRF-S-002', '水泥成分XRF检测', 'X荧光', '水泥生料、熟料及成品中氧化物含量分析'],
    ['FAAS-S-001', '火焰原子吸收法测金属', '火焰原子', '适用于水质、土壤中Cu/Zn/Fe/Mn等金属元素'],
    ['GFAAS-S-001', '石墨炉原子吸收法测痕量金属', '石墨炉原子', '适用于血样、食品中Pb/Cd等痕量元素'],
    ['IC-S-001', '离子色谱法测阴离子', '离子色谱', '水样中F-/Cl-/NO3-/SO42-等阴离子检测'],
    ['IC-S-002', '离子色谱法测阳离子', '离子色谱', '水样中Na+/K+/Ca2+/Mg2+/NH4+等阳离子检测'],
    ['GC-MS-001', '挥发性有机物GC-MS分析', '气相色谱-质谱', '水质/土壤/空气中67种VOCs检测'],
    ['GC-MS-002', '半挥发性有机物分析', '气相色谱-质谱', '土壤/沉积物中SVOCs检测'],
    ['HPLC-S-001', '高效液相色谱法测多环芳烃', '液相色谱', '环境样品中16种PAHs检测'],
    ['HPLC-S-002', '食品添加剂HPLC检测', '液相色谱', '食品中防腐剂、甜味剂、色素等添加剂'],
    ['UV-S-001', '紫外分光光度法', '紫外分光', '总氮、总磷、氨氮、COD等指标'],
    ['MICRO-S-001', '菌落总数检测', '微生物', '食品/水质/化妆品菌落总数CFU测定'],
    ['MICRO-S-002', '大肠菌群MPN法', '微生物', '食品中大肠菌群最大可能数测定'],
    ['MICRO-S-003', '致病菌检测（沙门氏菌）', '微生物', '食品中沙门氏菌定性检测'],
    ['GRAV-S-001', '重量法测灰分', '重量分析', '食品/煤/矿石中灰分含量测定'],
    ['VOL-S-001', '容量法测COD', '容量分析', '水质化学需氧量CODCr测定'],
    ['PH-S-001', 'pH值测定', '电位分析', '水质/土壤pH值测定'],
    ['COND-S-001', '电导率测定', '电化学', '水质电导率测定'],
    ['TITR-S-001', '酸碱滴定法', '容量分析', '水/食品中酸碱度测定'],
    ['XRD-S-001', 'X射线衍射物相分析', 'X衍射', '矿物/晶体物相鉴定'],
    ['DSC-S-001', '差示扫描量热分析', '热分析', '材料熔点/玻璃化转变温度'],
    ['HG-AFS-001', '原子荧光法测汞砷', '原子荧光', '水质/土壤/食品中Hg/As/Se/Sb等'],
    ['PT-S-001', '样品前处理-微波消解', '样品前处理', '固体样品微波消解前处理'],
    ['PT-S-002', '样品前处理-萃取', '样品前处理', '有机样品液液萃取/固相萃取'],
    ['FTIR-S-001', '红外光谱定性分析', '红外光谱', '有机化合物结构鉴定'],
    ['PCR-S-001', '实时荧光定量PCR', '分子生物', '食源性致病菌分子鉴定'],
    ['KF-S-001', '卡尔费休法测水分', '容量分析', '有机溶剂/食品中水分含量'],
    ['AAS-HG-001', '冷原子吸收测汞', '冷原子吸收', '水质/土壤中总汞测定'],
    ['CHNS-S-001', '有机元素分析', '元素分析', '有机样品C/H/N/S元素含量'],
    ['COUL-S-001', '库仑法测硫', '库仑分析', '煤/石油产品中全硫含量'],
    ['TGA-S-001', '热重分析', '热分析', '材料热稳定性/分解温度'],
    ['BET-S-001', '比表面积及孔径分析', '物理吸附', '多孔材料BET比表面积'],
    ['ELISA-S-001', '酶联免疫吸附试验', '免疫分析', '食品中农药残留/兽药残留'],
    ['PART-S-001', '激光粒度分析', '激光粒度', '粉末样品粒径分布测定'],
    ['IR-S-001', '红外光谱定性分析', '红外光谱', '有机化合物结构鉴定'],
    ['RAMAN-S-001', '拉曼光谱分析', '拉曼光谱', '矿物/宝石/材料拉曼光谱'],
    ['XRD-S-002', 'X射线衍射物相分析', 'X衍射', '晶体结构与晶胞参数'],
    ['VIS-S-001', '目视比色法', '目视比色', '现场快速半定量检测'],
    ['POL-S-001', '旋光法测糖度', '旋光分析', '食品中蔗糖/葡萄糖含量'],
    ['REFR-S-001', '折光率测定', '光学分析', '液体折光率与糖度'],
    ['DENS-S-001', '密度测定', '物理分析', '液体/固体样品密度'],
    ['RHEO-S-001', '流变学测试', '流变分析', '高分子材料粘度/流变曲线'],
    ['DSC-S-002', '熔点测定', '热分析', '有机化合物熔点精确测定'],
    ['HPIC-001', '高压离子色谱', '离子色谱', '高浓度样品离子分析'],
    ['IC-S-003', '离子色谱法测氰化物', '离子色谱', '水质中氰化物检测'],
    ['ICP-S-003', 'ICP法测稀土元素', 'ICP', '矿石中15种稀土元素分析'],
    ['HPLC-S-003', 'HPLC氨基酸分析', '液相色谱', '食品中18种氨基酸检测'],
  ];
  projectList.forEach(p => {
    __db.exec("INSERT INTO projects (project_no,project_name,method_type,description) VALUES (?,?,?,?)", p);
  });

  // ==================== 设备（equipment） ====================
  // equipment: equip_no, equip_name, model, manufacturer, serial_no, purchase_date, purchase_price, current_value, location, dept_id, status, responsible_person
  const equipmentList = [
    // 60 条仪器
    ['EQ-001', '电感耦合等离子体质谱仪', 'iCAP RQ', 'Thermo Fisher', 'SN2020-001', '2020-03-15', 980000, 650000, '仪器室A', 4, 'normal'],
    ['EQ-002', 'ICP光谱仪', 'Optima 8300', 'PerkinElmer', 'SN2019-002', '2019-06-20', 760000, 480000, '仪器室A', 4, 'normal'],
    ['EQ-003', '火焰原子吸收分光光度计', 'PinAAcle 900T', 'PerkinElmer', 'SN2021-003', '2021-02-10', 420000, 320000, '仪器室B', 4, 'normal'],
    ['EQ-004', '石墨炉原子吸收分光光度计', 'PinAAcle 900Z', 'PerkinElmer', 'SN2021-004', '2021-05-12', 580000, 450000, '仪器室B', 4, 'normal'],
    ['EQ-005', '原子荧光光度计', 'AFS-933', '北京吉天', 'SN2022-005', '2022-08-15', 280000, 220000, '仪器室C', 3, 'normal'],
    ['EQ-006', '原子荧光光谱仪', 'AFS-2202E', '北京海光', 'SN2018-006', '2018-04-20', 180000, 95000, '仪器室C', 3, 'normal'],
    ['EQ-007', '离子色谱仪', 'ICS-5000+', 'Thermo Fisher', 'SN2020-007', '2020-09-10', 680000, 480000, '化学室A', 3, 'normal'],
    ['EQ-008', '离子色谱仪', 'Eco IC', 'Metrohm', 'SN2022-008', '2022-03-25', 420000, 350000, '化学室A', 3, 'normal'],
    ['EQ-009', '气相色谱-质谱联用仪', 'Trace 1310-ISQ LT', 'Thermo Fisher', 'SN2021-009', '2021-07-08', 1280000, 950000, '仪器室D', 4, 'normal'],
    ['EQ-010', '气相色谱-质谱联用仪', '7890B-5977B', 'Agilent', 'SN2022-010', '2022-05-18', 1350000, 1100000, '仪器室D', 4, 'normal'],
    ['EQ-011', '气相色谱仪', '7890B', 'Agilent', 'SN2020-011', '2020-11-12', 480000, 350000, '仪器室D', 4, 'normal'],
    ['EQ-012', '高效液相色谱仪', '1260 Infinity II', 'Agilent', 'SN2021-012', '2021-04-20', 580000, 450000, '仪器室E', 4, 'normal'],
    ['EQ-013', '超高效液相色谱仪', '1290 Infinity II', 'Agilent', 'SN2022-013', '2022-08-30', 720000, 620000, '仪器室E', 4, 'normal'],
    ['EQ-014', '制备液相色谱仪', 'LC-20AP', '岛津', 'SN2019-014', '2019-09-15', 380000, 250000, '仪器室E', 4, 'normal'],
    ['EQ-015', '波长色散X射线荧光光谱仪', 'S8 TIGER', 'Bruker', 'SN2020-015', '2020-07-22', 1380000, 1050000, '仪器室F', 4, 'normal'],
    ['EQ-016', '能量色散X射线荧光光谱仪', 'EDX-7000', '岛津', 'SN2021-016', '2021-10-08', 580000, 450000, '仪器室F', 4, 'normal'],
    ['EQ-017', '紫外可见分光光度计', 'UV-1900', '岛津', 'SN2022-017', '2022-02-14', 120000, 95000, '理化室A', 6, 'normal'],
    ['EQ-018', '双光束紫外分光光度计', 'UV-2600', '岛津', 'SN2021-018', '2021-08-25', 180000, 145000, '理化室A', 6, 'normal'],
    ['EQ-019', '傅里叶变换红外光谱仪', 'Nicolet iS50', 'Thermo Fisher', 'SN2022-019', '2022-06-10', 380000, 320000, '仪器室G', 4, 'normal'],
    ['EQ-020', '红外光谱仪', 'Spectrum 100', 'PerkinElmer', 'SN2020-020', '2020-04-30', 220000, 165000, '仪器室G', 4, 'normal'],
    ['EQ-021', '激光拉曼光谱仪', 'inVia', 'Renishaw', 'SN2021-021', '2021-12-05', 580000, 480000, '仪器室G', 4, 'normal'],
    ['EQ-022', '热重分析仪', 'TGA 550', 'TA Instruments', 'SN2022-022', '2022-09-18', 480000, 420000, '仪器室H', 4, 'normal'],
    ['EQ-023', '差示扫描量热仪', 'DSC 250', 'TA Instruments', 'SN2021-023', '2021-05-28', 420000, 350000, '仪器室H', 4, 'normal'],
    ['EQ-024', '同步热分析仪', 'STA 449 F3', 'Netzsch', 'SN2020-024', '2020-12-10', 580000, 450000, '仪器室H', 4, 'normal'],
    ['EQ-025', 'X射线衍射仪', 'D8 Advance', 'Bruker', 'SN2021-025', '2021-07-15', 1280000, 980000, '仪器室I', 4, 'normal'],
    ['EQ-026', 'X射线衍射仪', 'X Pert PRO', 'PANalytical', 'SN2019-026', '2019-11-22', 980000, 650000, '仪器室I', 4, 'normal'],
    ['EQ-027', '比表面积及孔隙度分析仪', 'ASAP 2460', 'Micromeritics', 'SN2022-027', '2022-04-08', 680000, 580000, '仪器室J', 4, 'normal'],
    ['EQ-028', '实时荧光定量PCR仪', 'QuantStudio 5', 'Applied Biosystems', 'SN2022-028', '2022-07-30', 380000, 320000, '微生物室A', 5, 'normal'],
    ['EQ-029', '梯度PCR仪', 'T100', 'Bio-Rad', 'SN2021-029', '2021-03-18', 98000, 75000, '微生物室A', 5, 'normal'],
    ['EQ-030', '酶标仪', 'Multiskan FC', 'Thermo Fisher', 'SN2020-030', '2020-10-12', 168000, 120000, '微生物室B', 5, 'normal'],
    ['EQ-031', '微生物鉴定质谱仪', 'MALDI Biotyper', 'Bruker', 'SN2022-031', '2022-11-25', 1280000, 1180000, '微生物室C', 5, 'normal'],
    ['EQ-032', '高压灭菌器', 'MLS-3751L', '松下', 'SN2020-032', '2020-05-20', 85000, 60000, '微生物室D', 5, 'normal'],
    ['EQ-033', '高压灭菌器', 'GR85DA', '致微', 'SN2022-033', '2022-08-15', 120000, 95000, '微生物室D', 5, 'normal'],
    ['EQ-034', '生化培养箱', 'LRH-250', '上海一恒', 'SN2021-034', '2021-06-08', 35000, 28000, '微生物室E', 5, 'normal'],
    ['EQ-035', '霉菌培养箱', 'MJX-250', '上海博讯', 'SN2021-035', '2021-09-22', 42000, 35000, '微生物室E', 5, 'normal'],
    ['EQ-036', '生物安全柜', 'BSC-1500IIA2-X', '济南鑫贝西', 'SN2022-036', '2022-03-10', 85000, 72000, '微生物室F', 5, 'normal'],
    ['EQ-037', '生物安全柜', 'HR40-IIA2', '海尔', 'SN2021-037', '2021-12-18', 72000, 60000, '微生物室F', 5, 'normal'],
    ['EQ-038', '微波消解系统', 'MARS 6', 'CEM', 'SN2022-038', '2022-05-08', 480000, 420000, '前处理室A', 7, 'normal'],
    ['EQ-039', '微波消解仪', 'ETHOS UP', 'Milestone', 'SN2021-039', '2021-04-12', 520000, 440000, '前处理室A', 7, 'normal'],
    ['EQ-040', '十万分之一天平', 'XPR2', 'Mettler Toledo', 'SN2022-040', '2022-01-25', 185000, 165000, '理化室B', 6, 'normal'],
    ['EQ-041', '万分之一天平', 'AL204', 'Mettler Toledo', 'SN2020-041', '2020-08-18', 42000, 32000, '理化室B', 6, 'normal'],
    ['EQ-042', '百分之一天平', 'JJ500', '常熟双杰', 'SN2019-042', '2019-12-08', 8500, 6500, '理化室B', 6, 'normal'],
    ['EQ-043', 'pH计', 'Orion Star A211', 'Thermo Fisher', 'SN2021-043', '2021-11-15', 28000, 22000, '理化室C', 6, 'normal'],
    ['EQ-044', '电导率仪', 'Orion Star A212', 'Thermo Fisher', 'SN2021-044', '2021-07-20', 22000, 17000, '理化室C', 6, 'normal'],
    ['EQ-045', '溶解氧仪', 'Orion Star A213', 'Thermo Fisher', 'SN2021-045', '2021-09-12', 25000, 20000, '理化室C', 6, 'normal'],
    ['EQ-046', '卡尔费休水分仪', 'V20S', 'Mettler Toledo', 'SN2022-046', '2022-06-18', 78000, 65000, '理化室D', 6, 'normal'],
    ['EQ-047', '电位滴定仪', 'Titrando', 'Metrohm', 'SN2022-047', '2022-10-08', 165000, 145000, '理化室D', 6, 'normal'],
    ['EQ-048', '高速冷冻离心机', 'Sorvall LYNX 4000', 'Thermo Fisher', 'SN2022-048', '2022-04-22', 285000, 245000, '前处理室B', 7, 'normal'],
    ['EQ-049', '台式离心机', 'H1850R', '湖南湘仪', 'SN2020-049', '2020-09-08', 38000, 28000, '前处理室B', 7, 'normal'],
    ['EQ-050', '超低温冰箱', 'Forma 900', 'Thermo Fisher', 'SN2021-050', '2021-08-15', 138000, 105000, '微生物室G', 5, 'normal'],
    ['EQ-051', '超低温冰箱', 'DW-86L728ST', '海尔', 'SN2020-051', '2020-11-30', 78000, 58000, '微生物室G', 5, 'normal'],
    ['EQ-052', '冷藏冷冻冰箱', 'BCD-318WSL', '海尔', 'SN2019-052', '2019-07-12', 12000, 8000, '理化室E', 6, 'normal'],
    ['EQ-053', '电热恒温鼓风干燥箱', 'DHG-9140A', '上海精宏', 'SN2020-053', '2020-06-08', 18500, 14000, '前处理室C', 7, 'normal'],
    ['EQ-054', '真空干燥箱', 'DZF-6050', '上海博讯', 'SN2021-054', '2021-04-22', 22000, 17000, '前处理室C', 7, 'normal'],
    ['EQ-055', '箱式电阻炉', 'SX2-10-12', '上海实验电炉厂', 'SN2019-055', '2019-05-18', 28000, 18000, '前处理室D', 7, 'normal'],
    ['EQ-056', '马弗炉', 'L 9/11', 'Nabertherm', 'SN2022-056', '2022-02-28', 85000, 75000, '前处理室D', 7, 'normal'],
    ['EQ-057', '超纯水机', 'Milli-Q IQ 7000', 'Millipore', 'SN2021-057', '2021-06-12', 138000, 105000, '理化室F', 6, 'normal'],
    ['EQ-058', '超纯水机', 'Genie G', 'Rephile', 'SN2022-058', '2022-08-08', 88000, 75000, '理化室F', 6, 'normal'],
    // 待检/异常
    ['EQ-059', 'ICP光谱仪（备用）', 'Optima 7300', 'PerkinElmer', 'SN2018-059', '2018-05-15', 580000, 280000, '仪器室A', 4, 'maintenance'],
    ['EQ-060', '气相色谱仪（旧）', 'Trace GC Ultra', 'Thermo Fisher', 'SN2017-060', '2017-08-22', 380000, 95000, '仪器室D', 4, 'broken'],
  ];
  equipmentList.forEach(e => {
    __db.exec("INSERT INTO equipment (equip_no,equip_name,model,manufacturer,serial_no,purchase_date,purchase_price,current_value,location,dept_id,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)", e);
  });

  // ==================== 耗材（consumables） ====================
  // consumables: item_name, specification, unit, category, min_stock, current_stock, location
  const consumables = [
    ['ICP-MS调谐液', '100mL', '瓶', '标准品', 3, 8, '化学室A'],
    ['ICP多元素标准溶液', '100mL 100mg/L', '瓶', '标准品', 5, 12, '化学室A'],
    ['Hg单元素标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 15, '化学室A'],
    ['Pb单元素标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 18, '化学室A'],
    ['Cd单元素标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 22, '化学室A'],
    ['Cr单元素标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 16, '化学室A'],
    ['As单元素标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 14, '化学室A'],
    ['PAHs混标溶液', '1mL 2000μg/mL', '支', '标准品', 3, 6, '仪器室E'],
    ['VOCs混标溶液', '1mL 2000μg/mL', '支', '标准品', 4, 8, '仪器室D'],
    ['16种PAHs标准品', '纯品', '支', '标准品', 3, 5, '仪器室E'],
    ['色谱纯甲醇', '4L', '瓶', '试剂', 20, 45, '化学室A'],
    ['色谱纯乙腈', '4L', '瓶', '试剂', 15, 38, '化学室A'],
    ['色谱纯正己烷', '4L', '瓶', '试剂', 12, 28, '化学室A'],
    ['优级纯硝酸', '500mL', '瓶', '试剂', 25, 52, '化学室A'],
    ['优级纯盐酸', '500mL', '瓶', '试剂', 30, 60, '化学室A'],
    ['优级纯硫酸', '500mL', '瓶', '试剂', 20, 38, '化学室A'],
    ['优级纯高氯酸', '500mL', '瓶', '试剂', 10, 22, '化学室A'],
    ['优级纯氢氟酸', '500mL', '瓶', '试剂', 10, 18, '化学室A'],
    ['分析纯氢氧化钠', '500g', '瓶', '试剂', 15, 35, '化学室A'],
    ['分析纯氯化钠', '500g', '瓶', '试剂', 12, 28, '化学室A'],
    ['卡尔费休试剂', '500mL', '瓶', '试剂', 10, 24, '理化室D'],
    ['邻苯二甲酸氢钾', '100g', '瓶', '基准试剂', 5, 12, '理化室D'],
    ['无水碳酸钠', '500g', '瓶', '基准试剂', 8, 18, '理化室D'],
    ['重铬酸钾', '500g', '瓶', '基准试剂', 4, 8, '理化室D'],
    ['微孔滤膜（水系）', '0.45μm 50mm', '盒', '耗材', 15, 32, '前处理室A'],
    ['微孔滤膜（有机系）', '0.45μm 50mm', '盒', '耗材', 12, 28, '前处理室A'],
    ['微孔滤膜（水系）', '0.22μm 50mm', '盒', '耗材', 8, 18, '前处理室A'],
    ['针式过滤器', '0.45μm 13mm', '盒', '耗材', 20, 45, '前处理室A'],
    ['固相萃取柱', 'C18 500mg/6mL', '盒', '耗材', 10, 22, '前处理室A'],
    ['固相萃取柱', 'HLB 200mg/6mL', '盒', '耗材', 8, 18, '前处理室A'],
    ['液相色谱柱', 'C18 4.6×250mm 5μm', '根', '耗材', 3, 6, '仪器室E'],
    ['气相色谱柱', 'DB-5MS 30m×0.25mm', '根', '耗材', 4, 8, '仪器室D'],
    ['液相色谱柱', 'C8 4.6×150mm 5μm', '根', '耗材', 3, 5, '仪器室E'],
    ['微波消解罐', '100mL', '套', '耗材', 6, 14, '前处理室A'],
    ['移液器吸头', '1000μL', '盒', '耗材', 40, 85, '前处理室B'],
    ['移液器吸头', '200μL', '盒', '耗材', 40, 92, '前处理室B'],
    ['移液器吸头', '10μL', '盒', '耗材', 30, 68, '前处理室B'],
    ['离心管', '50mL 灭菌', '包', '耗材', 20, 45, '微生物室D'],
    ['离心管', '15mL 灭菌', '包', '耗材', 25, 56, '微生物室D'],
    ['培养皿', '90mm 灭菌', '包', '耗材', 15, 32, '微生物室D'],
    ['一次性注射器', '5mL', '盒', '耗材', 20, 48, '微生物室D'],
    ['一次性注射器', '1mL', '盒', '耗材', 18, 42, '微生物室D'],
    ['橡胶手套', 'M号 灭菌', '盒', '防护用品', 50, 120, '综合管理部'],
    ['丁腈手套', 'L号 无粉', '盒', '防护用品', 60, 145, '综合管理部'],
    ['医用口罩', '一次性', '盒', '防护用品', 100, 280, '综合管理部'],
    ['活性炭', '500g 分析纯', '瓶', '试剂', 5, 8, '前处理室A'],
    ['硅胶', '500g 柱层析', '瓶', '试剂', 4, 6, '前处理室A'],
    ['无水乙醇', '500mL 分析纯', '瓶', '试剂', 40, 85, '化学室A'],
    ['二氯甲烷', '500mL 色谱纯', '瓶', '试剂', 15, 32, '化学室A'],
    ['三氯甲烷', '500mL 分析纯', '瓶', '试剂', 10, 22, '化学室A'],
    // 预警库存
    ['As标准溶液', '50mL 1000mg/L', '瓶', '标准品', 5, 3, '化学室A'],
    ['PAHs混标', '1mL 2000μg/mL', '支', '标准品', 4, 2, '仪器室E'],
    ['硝酸（电子级）', '500mL', '瓶', '试剂', 8, 4, '化学室A'],
    ['卡尔费休试剂', '500mL', '瓶', '试剂', 5, 3, '理化室D'],
  ];
  consumables.forEach(c => {
    __db.exec("INSERT INTO consumables (item_name,specification,unit,category,min_stock,current_stock,location) VALUES (?,?,?,?,?,?,?)", c);
  });

  // ==================== 试剂（reagents） ====================
  // reagents: reagent_name, cas_no, formula, purity, manufacturer, supplier, location, current_stock, unit, min_stock, status, expiry_date
  const reagents = [
    ['甲醇', '67-56-1', 'CH3OH', '色谱纯', 'Merck', '默克', '化学室A', 38, '4L', 15, 'active', '2027-06-30'],
    ['乙腈', '75-05-8', 'C2H3N', '色谱纯', 'Merck', '默克', '化学室A', 32, '4L', 15, 'active', '2027-08-31'],
    ['正己烷', '110-54-3', 'C6H14', '色谱纯', 'Sigma', '西格玛', '化学室A', 22, '4L', 12, 'active', '2027-05-31'],
    ['异丙醇', '67-63-0', 'C3H8O', '色谱纯', 'Merck', '默克', '化学室A', 28, '4L', 12, 'active', '2027-09-30'],
    ['二氯甲烷', '75-09-2', 'CH2Cl2', '色谱纯', 'Sigma', '西格玛', '化学室A', 18, '4L', 10, 'active', '2027-07-31'],
    ['三氯甲烷', '67-66-3', 'CHCl3', '分析纯', '国药', '国药集团', '化学室A', 24, '500mL', 12, 'active', '2027-04-30'],
    ['乙酸乙酯', '141-78-6', 'C4H8O2', '色谱纯', 'Merck', '默克', '化学室A', 26, '4L', 10, 'active', '2027-08-31'],
    ['甲苯', '108-88-3', 'C7H8', '色谱纯', 'Sigma', '西格玛', '化学室A', 16, '4L', 8, 'active', '2027-06-30'],
    ['丙酮', '67-64-1', 'C3H6O', '分析纯', '国药', '国药集团', '化学室A', 42, '500mL', 20, 'active', '2027-03-31'],
    ['无水乙醇', '64-17-5', 'C2H6O', '分析纯', '国药', '国药集团', '化学室A', 65, '500mL', 30, 'active', '2027-12-31'],
    ['硝酸', '7697-37-2', 'HNO3', '优级纯', '国药', '国药集团', '化学室A', 38, '500mL', 20, 'active', '2027-06-30'],
    ['盐酸', '7647-01-0', 'HCl', '优级纯', '国药', '国药集团', '化学室A', 45, '500mL', 25, 'active', '2027-08-31'],
    ['硫酸', '7664-93-9', 'H2SO4', '优级纯', '国药', '国药集团', '化学室A', 32, '500mL', 18, 'active', '2027-05-31'],
    ['高氯酸', '7601-90-3', 'HClO4', '优级纯', '国药', '国药集团', '化学室A', 18, '500mL', 10, 'active', '2027-04-30'],
    ['氢氟酸', '7664-39-3', 'HF', '优级纯', '国药', '国药集团', '化学室A', 15, '500mL', 8, 'active', '2027-07-31'],
    ['磷酸', '7664-38-2', 'H3PO4', '分析纯', '国药', '国药集团', '化学室A', 22, '500mL', 10, 'active', '2027-09-30'],
    ['氢氧化钠', '1310-73-2', 'NaOH', '分析纯', '国药', '国药集团', '化学室A', 28, '500g', 15, 'active', '2028-03-31'],
    ['氢氧化钾', '1310-58-3', 'KOH', '分析纯', '国药', '国药集团', '化学室A', 18, '500g', 10, 'active', '2028-02-28'],
    ['氯化钠', '7647-14-5', 'NaCl', '基准', '国药', '国药集团', '化学室A', 35, '500g', 15, 'active', '2028-12-31'],
    ['氯化钾', '7447-40-7', 'KCl', '分析纯', '国药', '国药集团', '化学室A', 22, '500g', 10, 'active', '2028-06-30'],
    ['氯化铵', '12125-02-9', 'NH4Cl', '分析纯', '国药', '国药集团', '化学室A', 24, '500g', 12, 'active', '2028-08-31'],
    ['无水硫酸钠', '7757-82-6', 'Na2SO4', '分析纯', '国药', '国药集团', '化学室A', 18, '500g', 10, 'active', '2028-05-31'],
    ['硫酸铜', '7758-98-7', 'CuSO4', '分析纯', '国药', '国药集团', '化学室A', 12, '500g', 6, 'active', '2028-04-30'],
    ['硫酸亚铁', '7782-63-0', 'FeSO4', '分析纯', '国药', '国药集团', '化学室A', 15, '500g', 8, 'active', '2028-03-31'],
    ['重铬酸钾', '7778-50-9', 'K2Cr2O7', '基准', '国药', '国药集团', '化学室A', 8, '500g', 5, 'active', '2028-12-31'],
    ['高锰酸钾', '7722-64-7', 'KMnO4', '分析纯', '国药', '国药集团', '化学室A', 14, '500g', 7, 'active', '2028-06-30'],
    ['碘', '7553-56-2', 'I2', '分析纯', '国药', '国药集团', '化学室A', 6, '100g', 4, 'active', '2028-12-31'],
    ['硫代硫酸钠', '7772-98-7', 'Na2S2O3', '分析纯', '国药', '国药集团', '化学室A', 18, '500g', 10, 'active', '2028-04-30'],
    ['EDTA二钠', '6381-92-6', 'C10H14N2Na2O8', '分析纯', '国药', '国药集团', '化学室A', 16, '500g', 8, 'active', '2028-08-31'],
    ['氨水', '1336-21-6', 'NH3·H2O', '分析纯', '国药', '国药集团', '化学室A', 22, '500mL', 12, 'active', '2027-09-30'],
    ['硼酸', '10043-35-3', 'H3BO3', '分析纯', '国药', '国药集团', '化学室A', 18, '500g', 10, 'active', '2028-06-30'],
    ['过氧化氢', '7722-84-1', 'H2O2', '优级纯', '国药', '国药集团', '化学室A', 28, '500mL', 15, 'active', '2027-05-31'],
    ['碳酸钠', '497-19-8', 'Na2CO3', '分析纯', '国药', '国药集团', '化学室A', 24, '500g', 12, 'active', '2028-07-31'],
    ['碳酸氢钠', '144-55-8', 'NaHCO3', '分析纯', '国药', '国药集团', '化学室A', 16, '500g', 8, 'active', '2028-05-31'],
    ['磷酸二氢钾', '7778-77-0', 'KH2PO4', '分析纯', '国药', '国药集团', '化学室A', 20, '500g', 10, 'active', '2028-09-30'],
    ['磷酸氢二钾', '7758-11-4', 'K2HPO4', '分析纯', '国药', '国药集团', '化学室A', 14, '500g', 7, 'active', '2028-08-31'],
    ['硫酸钾', '7778-80-5', 'K2SO4', '分析纯', '国药', '国药集团', '化学室A', 16, '500g', 8, 'active', '2028-06-30'],
    ['硝酸钾', '7757-79-1', 'KNO3', '分析纯', '国药', '国药集团', '化学室A', 12, '500g', 6, 'active', '2028-07-31'],
    ['硝酸银', '7761-88-8', 'AgNO3', '分析纯', '国药', '国药集团', '化学室A', 8, '100g', 5, 'active', '2028-12-31'],
    ['氯化钡', '10361-37-2', 'BaCl2', '分析纯', '国药', '国药集团', '化学室A', 14, '500g', 7, 'active', '2028-04-30'],
    // 标准品
    ['金标准溶液', '7440-57-5', 'Au', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 12, '50mL', 5, 'active', '2027-12-31'],
    ['银标准溶液', '7440-22-4', 'Ag', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 10, '50mL', 5, 'active', '2027-12-31'],
    ['铜标准溶液', '7440-50-8', 'Cu', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 18, '50mL', 8, 'active', '2027-12-31'],
    ['锌标准溶液', '7440-66-6', 'Zn', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 16, '50mL', 8, 'active', '2027-12-31'],
    ['铅标准溶液', '7439-92-1', 'Pb', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 22, '50mL', 10, 'active', '2027-12-31'],
    ['镉标准溶液', '7440-43-9', 'Cd', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 20, '50mL', 10, 'active', '2027-12-31'],
    ['铬标准溶液', '7440-47-3', 'Cr', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 18, '50mL', 8, 'active', '2027-12-31'],
    ['砷标准溶液', '7440-38-2', 'As', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 16, '50mL', 8, 'active', '2027-12-31'],
    ['汞标准溶液', '7439-97-6', 'Hg', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 14, '50mL', 6, 'active', '2027-12-31'],
    ['硒标准溶液', '7782-49-2', 'Se', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 10, '50mL', 5, 'active', '2027-12-31'],
    ['钼标准溶液', '7439-98-7', 'Mo', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 8, '50mL', 4, 'active', '2027-12-31'],
    ['锰标准溶液', '7439-96-5', 'Mn', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 14, '50mL', 7, 'active', '2027-12-31'],
    ['铁标准溶液', '7439-89-6', 'Fe', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 12, '50mL', 6, 'active', '2027-12-31'],
    ['镍标准溶液', '7440-02-0', 'Ni', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 10, '50mL', 5, 'active', '2027-12-31'],
    ['钴标准溶液', '7440-48-4', 'Co', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 8, '50mL', 4, 'active', '2027-12-31'],
    ['钒标准溶液', '7440-62-2', 'V', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 6, '50mL', 4, 'active', '2027-12-31'],
    ['钛标准溶液', '7440-32-6', 'Ti', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 6, '50mL', 4, 'active', '2027-12-31'],
    ['锑标准溶液', '7440-36-0', 'Sb', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 8, '50mL', 4, 'active', '2027-12-31'],
    ['锡标准溶液', '7440-31-5', 'Sn', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 6, '50mL', 4, 'active', '2027-12-31'],
    ['铋标准溶液', '7440-69-9', 'Bi', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 4, '50mL', 3, 'active', '2027-12-31'],
    // 临期/预警
    ['氨水（临期）', '1336-21-6', 'NH3·H2O', '分析纯', '国药', '国药集团', '化学室A', 8, '500mL', 5, 'expiring', '2026-09-30'],
    ['盐酸（临期）', '7647-01-0', 'HCl', '优级纯', '国药', '国药集团', '化学室A', 6, '500mL', 8, 'expiring', '2026-09-30'],
    ['硝酸（临期）', '7697-37-2', 'HNO3', '优级纯', '国药', '国药集团', '化学室A', 4, '500mL', 8, 'expiring', '2026-09-30'],
    ['甲醇（临期）', '67-56-1', 'CH3OH', '色谱纯', 'Merck', '默克', '化学室A', 5, '4L', 8, 'expiring', '2026-09-30'],
    ['铅标准溶液（临期）', '7439-92-1', 'Pb', '1000μg/mL', '国家有色', '国家标物中心', '化学室A', 2, '50mL', 5, 'expiring', '2026-09-30'],
    ['PAHs混标（临期）', '混合', 'PAHs', '2000μg/mL', 'AccuStandard', '艾吉斯', '仪器室E', 1, '1mL', 2, 'expiring', '2026-09-30'],
  ];
  reagents.forEach(r => {
    __db.exec("INSERT INTO reagents (reagent_name,cas_no,formula,purity,manufacturer,supplier,location,current_stock,unit,min_stock,status,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", r);
  });

  // ==================== 样品（samples） ====================
  // samples: sample_code, sample_name, sample_type, client_name, received_date, test_item, status, analyst_id
  const sampleTypes = ['水质', '土壤', '废水', '地下水', '地表水', '饮用水', '海水', '空气', '土壤', '食品', '化妆品', '饲料', '肥料', '煤炭', '矿石', '合金'];
  const sampleStatuses = ['received', 'processing', 'completed', 'completed', 'completed', 'completed'];
  const clients = ['甘肃金矿集团', '兰州环保监测站', '敦煌文旅集团', '西北矿冶研究院', '酒泉钢铁公司', '金川集团', '玉门油田', '嘉峪关酒钢', '张掖农业局', '武威食品厂'];
  for (let i = 1; i <= 200; i++) {
    const sampleNo = 'S' + String(Date.now()).slice(-6) + String(i).padStart(4, '0');
    const typeIdx = i % sampleTypes.length;
    const statusIdx = i % sampleStatuses.length;
    const projectIdx = i % 50;
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().slice(0, 10);
    __db.exec(`INSERT INTO samples (sample_code, sample_name, sample_type, client_name, received_date, test_item, status, analyst_id)
            VALUES (?,?,?,?,?,?,?,?)`,
      [sampleNo,
       `${sampleTypes[typeIdx]}样品#${i}`,
       sampleTypes[typeIdx],
       clients[i % clients.length],
       dateStr,
       projectList[projectIdx][1],  // project_name
       sampleStatuses[statusIdx],
       ((i % 10) + 1)]);
  }

  // ==================== 设备维护（equipment_maintenance） ====================
  // equip_id, maintenance_date, maintenance_type, maintainer, cost, description, next_maintenance_date
  const maintenanceTypes = ['校准', '维护', '维修', '期间核查'];
  for (let i = 0; i < 30; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + 3);
    __db.exec(`INSERT INTO equipment_maintenance (equip_id, maintenance_date, maintenance_type, maintainer, cost, description, next_maintenance_date)
            VALUES (?,?,?,?,?,?,?)`,
      [((i % 60) + 1),
       date.toISOString().slice(0, 10),
       maintenanceTypes[i % maintenanceTypes.length],
       staffList[i % 10][2],
       Math.floor(Math.random() * 5000) + 500,
       `${maintenanceTypes[i % maintenanceTypes.length]}操作#${i+1}，设备运行正常`,
       nextDate.toISOString().slice(0, 10)]);
  }

  // ==================== 隐患（ehs_hazard） ====================
  const hazardList = [
    ['化学室A', '设备问题', 'high', '化学室通风橱风速降至0.3m/s，需立即检修', '联系设备厂家维修，校准风速', 5, 7],
    ['气瓶间', '安全管理', 'high', '气瓶间门未上锁，存在安全隐患', '立即上锁并制定钥匙管理制度', 5, 1],
    ['微生物室D', '设备问题', 'medium', '灭菌器压力表显示偏差，需要校准', '联系厂家校准或更换压力表', 4, 14],
    ['危废暂存间', '标识问题', 'medium', '部分危废容器标识褪色', '重新打印并张贴危废标识', 8, 7],
    ['实验室公共区域', '设备问题', 'medium', '应急喷淋装置上次检测已超过6个月', '联系维保单位进行检测', 7, 14],
    ['理化室A', '环境问题', 'low', '理化室地面有少量洒落液体，已清理', '加强日常清洁', 3, 1],
    ['仪器室B', '个人防护', 'low', '提醒当事人，已加强宣贯', '定期培训安全规范', 1, 1],
    ['化学室A', '管理问题', 'medium', '部分易制毒化学品出入库登记滞后', '指定专人负责台账管理', 6, 7],
    ['一楼消防通道', '环境问题', 'high', '一楼消防通道被杂物堵塞，已通知清理', '立即清理并加强巡查', 7, 1],
    ['仪器室A', '设备问题', 'low', '仪器室A空调制冷效果差，需维修', '联系维修单位', 2, 7],
    ['前处理室B', '管理问题', 'medium', '有机废液与无机废液混放，需重新分类', '重新分类并标识', 7, 3],
    ['理化室B', '记录问题', 'low', '部分原始记录未按要求签字', '加强记录审核', 1, 14],
  ];
  hazardList.forEach(h => {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const deadline = new Date(date);
    deadline.setDate(deadline.getDate() + h[6]);
    __db.exec(`INSERT INTO ehs_hazard (discovery_date,hazard_location,hazard_type,severity_level,description,control_measures,responsible_person,deadline,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [date.toISOString().slice(0, 10),
       h[0], h[1], h[2], h[3], h[4], h[5],
       deadline.toISOString().slice(0, 10),
       ['open','open','investigating','resolved'][Math.floor(Math.random()*4)]]);
  });

  // ==================== 实验数据报告 (暂跳过) ====================
  console.log('  - (skipped) experimental_data_reports');

  // ==================== 通风橱（fumehood） ====================
  // fumehood_no, location, brand_model, wind_speed, calib_date, next_calib, status
  const fumehoods = [
    ['FH-001', '化学室A', '苏州林顿FH-1200', '0.5m/s', '2026-03-15', '2026-09-15', 'normal'],
    ['FH-002', '化学室B', '苏州林顿FH-1500', '0.5m/s', '2026-03-15', '2026-09-15', 'normal'],
    ['FH-003', '前处理室A', 'BKB-1500', '0.4m/s', '2026-02-20', '2026-08-20', 'normal'],
    ['FH-004', '前处理室B', '哈尔滨鸿润', '0.4m/s', '2026-04-10', '2026-10-10', 'normal'],
    ['FH-005', '仪器室A', '苏州林顿FH-1800', '0.5m/s', '2026-01-15', '2026-07-15', 'normal'],
  ];
  fumehoods.forEach(f => {
    __db.exec("INSERT INTO fumehood (fumehood_no,location,brand_model,wind_speed,calib_date,next_calib,status) VALUES (?,?,?,?,?,?,?)", f);
  });

  console.log('[OK] Comprehensive test data seeded:');
  console.log('  - 11 users (yuwangang/123456 [analyst], admin/admin123 [admin])');
  console.log('  - 11 departments');
  console.log('  - 50 detection projects');
  console.log('  - 60 equipment');
  console.log('  - 54 consumables');
  console.log('  - 66 reagents');
  console.log('  - 200 samples');
  console.log('  - 30 maintenance records');
  console.log('  - 50 experiment reports');
  console.log('  - 5 fumehoods');
}


// ============================================================
// Start
// ============================================================
initDB().then(() => {
  app.listen(PORT, '::', () => {
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

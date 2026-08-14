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

function createTables(db) {
  __db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT,
      role TEXT DEFAULT 'analyst',
      name TEXT,
      email TEXT,
      dept TEXT,
      title TEXT,
      phone TEXT,
      id_card TEXT,
      education TEXT,
      cert_no TEXT,
      hiredate TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      manager_id INTEGER,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS user_certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      cert_name TEXT,
      cert_no TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      cert_file TEXT,
      status TEXT DEFAULT 'valid',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_no TEXT UNIQUE NOT NULL,
      project_name TEXT,
      method_type TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS project_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      record_date TEXT,
      sample_count INTEGER,
      pass_count INTEGER,
      fail_count INTEGER,
      operator_id INTEGER,
      supervisor_id INTEGER,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS sample_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_no TEXT UNIQUE NOT NULL,
      client_name TEXT,
      sample_type TEXT,
      expected_date TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'pending',
      sample_count INTEGER DEFAULT 0,
      packaging_intact TEXT DEFAULT 'yes',
      detection_method TEXT,
      remark TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS sample_processing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_code TEXT,
      sample_name TEXT,
      sample_type TEXT,
      packaging_intact TEXT,
      processing_method TEXT,
      detection_method TEXT,
      processing_date TEXT,
      operator_id INTEGER,
      supervisor_id INTEGER,
      equipment_id INTEGER,
      environment_temp TEXT,
      environment_humidity TEXT,
      consumables_used TEXT,
      reagents_used TEXT,
      gases_used TEXT,
      processing_desc TEXT,
      result_data TEXT,
      result_conclusion TEXT,
      report_no TEXT,
      qa_review TEXT DEFAULT 'pending',
      workflow_status TEXT DEFAULT 'stage1_pending',
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equip_no TEXT UNIQUE NOT NULL,
      equip_name TEXT,
      model TEXT,
      manufacturer TEXT,
      serial_no TEXT,
      purchase_date TEXT,
      purchase_price REAL,
      current_value REAL,
      location TEXT,
      dept_id INTEGER,
      status TEXT DEFAULT 'normal',
      responsible_person INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dept_id) REFERENCES departments(id),
      FOREIGN KEY (responsible_person) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equip_id INTEGER,
      maintenance_date TEXT,
      maintenance_type TEXT,
      maintainer TEXT,
      cost REAL,
      description TEXT,
      next_maintenance_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (equip_id) REFERENCES equipment(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_calibration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equip_id INTEGER,
      calibration_date TEXT,
      calibration_org TEXT,
      certificate_no TEXT,
      valid_date TEXT,
      result TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (equip_id) REFERENCES equipment(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equip_id INTEGER,
      repair_date TEXT,
      fault_desc TEXT,
      repair_action TEXT,
      repairer TEXT,
      cost REAL,
      result TEXT,
      next_inspection_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (equip_id) REFERENCES equipment(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS consumable_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      main_products TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS consumables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT,
      specification TEXT,
      unit TEXT,
      category TEXT,
      min_stock INTEGER,
      current_stock INTEGER DEFAULT 0,
      location TEXT,
      supplier_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES consumable_suppliers(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS consumable_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumable_id INTEGER,
      record_type TEXT,
      quantity INTEGER,
      operator_id INTEGER,
      record_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (consumable_id) REFERENCES consumables(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS glassware_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS glassware (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT,
      specification TEXT,
      material TEXT,
      unit TEXT,
      current_stock INTEGER DEFAULT 0,
      location TEXT,
      supplier_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES glassware_suppliers(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS glassware_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      glassware_id INTEGER,
      record_type TEXT,
      quantity INTEGER,
      operator_id INTEGER,
      record_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (glassware_id) REFERENCES glassware(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS reagents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reagent_name TEXT,
      cas_no TEXT,
      formula TEXT,
      purity TEXT,
      manufacturer TEXT,
      supplier TEXT,
      location TEXT,
      current_stock REAL DEFAULT 0,
      unit TEXT,
      min_stock REAL,
      status TEXT DEFAULT 'normal',
      expiry_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS reagent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reagent_id INTEGER,
      record_type TEXT,
      quantity REAL,
      operator_id INTEGER,
      record_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reagent_id) REFERENCES reagents(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS standard_substances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      substance_name TEXT,
      cas_no TEXT,
      concentration TEXT,
      manufacturer TEXT,
      certificate_no TEXT,
      lot_no TEXT,
      valid_date TEXT,
      current_stock REAL DEFAULT 0,
      unit TEXT,
      storage_location TEXT,
      status TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS reagent_inbound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inbound_no TEXT UNIQUE NOT NULL,
      supplier_name TEXT,
      inbound_date TEXT,
      total_amount REAL,
      total_price REAL,
      operator_id INTEGER,
      approver_id INTEGER,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS reagent_requisition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requisition_no TEXT UNIQUE NOT NULL,
      reagent_id INTEGER,
      requester_id INTEGER,
      quantity REAL,
      unit TEXT,
      purpose TEXT,
      approver_id INTEGER,
      approve_status TEXT DEFAULT 'pending',
      approve_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reagent_id) REFERENCES reagents(id),
      FOREIGN KEY (requester_id) REFERENCES users(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS gases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gas_name TEXT,
      specification TEXT,
      manufacturer TEXT,
      supplier TEXT,
      current_stock REAL DEFAULT 0,
      unit TEXT,
      location TEXT,
      cylinder_no TEXT,
      status TEXT DEFAULT 'normal',
      next_inspection_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS gas_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gas_id INTEGER,
      record_type TEXT,
      quantity REAL,
      operator_id INTEGER,
      record_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gas_id) REFERENCES gases(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS gas_inbound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inbound_no TEXT UNIQUE NOT NULL,
      supplier_name TEXT,
      inbound_date TEXT,
      gas_type TEXT,
      quantity REAL,
      cylinder_count INTEGER,
      operator_id INTEGER,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS fumehood (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fumehood_no TEXT UNIQUE NOT NULL,
      location TEXT,
      brand_model TEXT,
      wind_speed TEXT,
      calib_date TEXT,
      next_calib TEXT,
      status TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS fumehood_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fumehood_id INTEGER,
      use_date TEXT,
      user_id INTEGER,
      start_time TEXT,
      end_time TEXT,
      experiment_type TEXT,
      chemicals_used TEXT,
      protective_equip TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fumehood_id) REFERENCES fumehood(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS training_annual_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER,
      dept_id INTEGER,
      total_plan INTEGER,
      total_actual INTEGER,
      plan_target INTEGER,
      actual_target INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dept_id) REFERENCES departments(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS training_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      training_date TEXT,
      training_type TEXT,
      training_content TEXT,
      training_hours REAL,
      trainer TEXT,
      assessment_result TEXT,
      certificate_no TEXT,
      valid_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS ehs_daily_inspection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_date TEXT,
      inspector_id INTEGER,
      fire_facilities TEXT,
      temp_value TEXT,
      humidity_value TEXT,
      ventilation_status TEXT,
      electrical_safety TEXT,
      chemical_storage TEXT,
      overall_status TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspector_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS ehs_incident (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_date TEXT,
      incident_type TEXT,
      severity TEXT,
      location TEXT,
      description TEXT,
      involved_persons TEXT,
      handling_result TEXT,
      reporter_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS ehs_hazard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discovery_date TEXT,
      hazard_location TEXT,
      hazard_type TEXT,
      severity_level TEXT,
      description TEXT,
      control_measures TEXT,
      responsible_person INTEGER,
      deadline TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (responsible_person) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_code TEXT UNIQUE NOT NULL,
      sample_name TEXT,
      sample_type TEXT,
      client_name TEXT,
      contact_phone TEXT,
      detection_method TEXT DEFAULT 'ICP',
      current_stage TEXT DEFAULT 'appointment',
      appointment_date TEXT,
      received_date TEXT,
      encoded_date TEXT,
      split_date TEXT,
      testing_date TEXT,
      data_recorded_date TEXT,
      report_date TEXT,
      reviewed_date TEXT,
      archived_date TEXT,
      operator_id INTEGER,
      supervisor_id INTEGER,
      appointment_no TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_id INTEGER,
      from_stage TEXT,
      to_stage TEXT,
      action_user_id INTEGER,
      action_date TEXT DEFAULT (datetime('now')),
      remark TEXT,
      FOREIGN KEY (sample_id) REFERENCES workflow_samples(id),
      FOREIGN KEY (action_user_id) REFERENCES users(id)
    )
  `);


  __db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_code TEXT UNIQUE NOT NULL,
      sample_name TEXT,
      sample_type TEXT,
      client_name TEXT,
      received_date TEXT,
      test_item TEXT,
      status TEXT DEFAULT 'pending',
      analyst_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (analyst_id) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_id INTEGER,
      test_item TEXT,
      result_data TEXT,
      result_pass TEXT,
      tested_by INTEGER,
      test_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sample_id) REFERENCES samples(id),
      FOREIGN KEY (tested_by) REFERENCES users(id)
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT,
      table_name TEXT,
      record_id INTEGER,
      old_data TEXT,
      new_data TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  __db.exec(`
    CREATE TABLE IF NOT EXISTS experimental_data_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT UNIQUE NOT NULL,
      sample_id INTEGER,
      project_id INTEGER,
      report_date TEXT,
      detection_method TEXT,
      analyst_id INTEGER,
      supervisor_id INTEGER,
      equipment_id INTEGER,
      result_data TEXT,
      conclusion TEXT,
      remark TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sample_id) REFERENCES samples(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (analyst_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )
  `);
}

function runMigrations(db) {
  // Migration: rebuild experimental_data_reports with sample_code (text) + attachment_path
  try {
    const rows = __db.exec("SELECT COUNT(*) FROM experimental_data_reports");
    const count = rows[0]?.values[0]?.[0] || 0;
    if (count === 0) {
      __db.exec('DROP TABLE IF EXISTS experimental_data_reports');
    }
  } catch(e) {}

  try {
    __db.exec(`CREATE TABLE IF NOT EXISTS experimental_data_reports_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT UNIQUE NOT NULL,
      sample_code TEXT,
      project_id INTEGER,
      report_date TEXT,
      detection_method TEXT,
      analyst_id INTEGER,
      supervisor_id INTEGER,
      equipment_id INTEGER,
      result_data TEXT,
      conclusion TEXT,
      remark TEXT,
      attachment_path TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (analyst_id) REFERENCES users(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);
    __db.exec(`INSERT INTO experimental_data_reports_new SELECT id,report_no,NULL as sample_code,project_id,report_date,detection_method,analyst_id,supervisor_id,equipment_id,result_data,conclusion,remark,NULL as attachment_path,status,created_at,updated_at FROM experimental_data_reports`);
    __db.exec('DROP TABLE IF EXISTS experimental_data_reports');
    __db.exec('ALTER TABLE experimental_data_reports_new RENAME TO experimental_data_reports');
  } catch(e) {}

  // Migration: create workflow_assignments table
  try {
    __db.exec(`CREATE TABLE IF NOT EXISTS workflow_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER,
      assigned_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending',
      completed_at TEXT,
      remark TEXT,
      FOREIGN KEY (appointment_id) REFERENCES sample_appointments(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`);
  } catch(e) {}

  // Migration: create consumption_records table
  try {
    __db.exec(`CREATE TABLE IF NOT EXISTS consumption_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      processing_id INTEGER,
      item_type TEXT,
      item_id INTEGER,
      item_name TEXT,
      quantity REAL,
      unit TEXT,
      operator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (processing_id) REFERENCES sample_processing(id)
    )`);
  } catch(e) {}

  const migrations = [
    { table: 'users', col: 'name TEXT', after: 'role' },
    { table: 'users', col: 'email TEXT', after: 'name' },
    { table: 'users', col: 'dept TEXT', after: 'email' },
    { table: 'users', col: 'title TEXT', after: 'dept' },
    { table: 'users', col: 'phone TEXT', after: 'title' },
    { table: 'users', col: 'id_card TEXT', after: 'phone' },
    { table: 'users', col: 'education TEXT', after: 'id_card' },
    { table: 'users', col: 'cert_no TEXT', after: 'education' },
    { table: 'users', col: 'hiredate TEXT', after: 'cert_no' },
    { table: 'users', col: 'status TEXT DEFAULT \'active\'', after: 'hiredate' },
    { table: 'users', col: 'created_at TEXT DEFAULT (datetime(\'now\'))', after: 'status' },
    // sample_appointments new columns
    { table: 'sample_appointments', col: 'sample_code TEXT', after: 'appointment_no' },
    { table: 'sample_appointments', col: 'send_date TEXT', after: 'sample_code' },
    { table: 'sample_appointments', col: 'workflow_status TEXT DEFAULT \'pending\'', after: 'status' },
    { table: 'sample_appointments', col: 'assigned_to INTEGER', after: 'workflow_status' },
    // sample_processing new columns
    { table: 'sample_processing', col: 'appointment_id INTEGER', after: 'id' },
    { table: 'sample_processing', col: 'packaging_intact TEXT', after: 'sample_type' },
    { table: 'sample_processing', col: 'consumption_records TEXT', after: 'report_path' },
    { table: 'sample_processing', col: 'workflow_status TEXT DEFAULT \'pending\'', after: 'consumption_records' },
  ];

  for (const mig of migrations) {
    try {
      __db.exec(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.col}`);
    } catch (e) {
      // ignore duplicate column errors
    }
// ========== RBAC (阶段 1.2) ==========
  __db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      name_zh VARCHAR(50) NOT NULL,
      name_en VARCHAR(50) NOT NULL,
      rank INTEGER NOT NULL,
      is_technical INTEGER DEFAULT 0,
      is_signatory INTEGER DEFAULT 0,
      can_be_combined INTEGER DEFAULT 1,
      signatory_level INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  __db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      is_primary INTEGER DEFAULT 1,
      scope TEXT,
      granted_at TEXT DEFAULT (datetime('now')),
      granted_by INTEGER,
      expires_at TEXT,
      UNIQUE(user_id, role_id)
    )
  `);
  // audit_logs 加 rbac_decision
  try { __db.exec(`ALTER TABLE audit_logs ADD COLUMN rbac_decision TEXT`); } catch (e) {}
  try { __db.exec(`ALTER TABLE audit_logs ADD COLUMN denial_reason TEXT`); } catch (e) {}

  // 8 岗位初始数据 (idempotent)
  const seedRoles = [
    [1, 'lab_director',     '实验室主任', 'Lab Director',     1, 1, 1, 1, 3],
    [2, 'qa_manager',       '质量负责人', 'QA Manager',       2, 1, 1, 1, 3],
    [3, 'technical_manager','技术负责人', 'Technical Manager', 3, 1, 1, 1, 2],
    [4, 'analyst',          '检测员',     'Analyst',           4, 1, 0, 1, 0],
    [5, 'reviewer',         '复核员',     'Reviewer',          4, 1, 1, 1, 2],
    [6, 'equipment_officer','设备员',     'Equipment Officer', 5, 0, 0, 1, 0],
    [7, 'reagent_officer',  '试剂员',     'Reagent Officer',   5, 0, 0, 1, 0],
    [8, 'part_time',        '兼职',       'Part-time',         7, 0, 0, 1, 0]
  ];
  seedRoles.forEach(r => {
    try {
      __db.exec('INSERT INTO roles (id, code, name_zh, name_en, rank, is_technical, is_signatory, can_be_combined, signatory_level) VALUES (?,?,?,?,?,?,?,?,?)', r);
    } catch (e) {}
  });
  }
}

module.exports = { createTables, runMigrations };
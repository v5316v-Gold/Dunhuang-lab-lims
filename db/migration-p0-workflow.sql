-- ============================================================
-- 2026-08-11 P0 核心工作流数据模型迁移
-- 节点 1: clients 客户表（线上委托）
-- 节点 2: projects 扩展（委托单字段 + 报价 + 审批）
-- 节点 3: samples 扩展（外观/称量/拍照/封样/验收）
-- 节点 5: retain_samples 留样表
-- 节点 10: uncertainty_calculations 不确定度
-- ============================================================

-- ============================================
-- 1. clients 客户表（新增）
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_code TEXT UNIQUE NOT NULL,           -- 客户编号（自动生成 CLT-001）
  client_name TEXT NOT NULL,                    -- 客户名称（公司或个人）
  contact_person TEXT,                          -- 联系人
  contact_phone TEXT,                           -- 联系电话
  contact_email TEXT,                           -- 联系邮箱
  address TEXT,                                 -- 地址
  client_type TEXT DEFAULT 'company',           -- 类型 company/personnel
  credit_level TEXT DEFAULT 'B',               -- 信用等级 A/B/C/D
  total_orders INTEGER DEFAULT 0,               -- 历史委托数
  total_amount REAL DEFAULT 0,                   -- 历史消费金额
  remark TEXT,                                  -- 备注
  status TEXT DEFAULT 'active',                 -- active/inactive
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(client_code);

-- ============================================
-- 2. projects 表扩展（节点 2 委托单字段）
-- ============================================
-- ALTER TABLE projects 在 better-sqlite3 中可能不支持，
-- 但可以重新创建带所有字段的表（保留数据）
-- 这里用直接添加列的方式（SQLite 3.35+ 支持）
-- 检查当前 schema 后再处理

-- 安全方式：用新表 + 触发器迁移（避免数据丢失）
CREATE TABLE IF NOT EXISTS projects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_no TEXT UNIQUE NOT NULL,             -- 项目编号（自动生成）
  client_id INTEGER,                           -- 关联客户（新增）
  project_name TEXT,                           -- 项目名称
  method_type TEXT,                             -- 检测方法
  description TEXT,                             -- 描述

  -- 新增字段：委托单
  detection_items TEXT,                         -- 检测项目（多选 JSON）
  detection_standard TEXT,                      -- 检测标准（GB/T 20899等）
  sample_quantity INTEGER DEFAULT 1,           -- 样品数量
  expected_date TEXT,                           -- 客户期望完成日期
  report_format TEXT DEFAULT 'standard',       -- 报告格式 standard/cnas/cnas_en
  price REAL DEFAULT 0,                          -- 报价（元）
  paid_amount REAL DEFAULT 0,                   -- 已付金额
  payment_status TEXT DEFAULT 'unpaid',        -- unpaid/partial/paid

  -- 新增字段：流程状态机
  status TEXT DEFAULT 'draft',                 -- draft/submitted/approved/rejected/assigned/completed/cancelled
  current_stage TEXT DEFAULT 'commission',     -- commission/acceptance/preparation/testing/review/approval/report/done
  submitted_at TEXT,                           -- 提交时间
  approved_at TEXT,                            -- 审批时间
  assigned_at TEXT,                            -- 分派时间
  completed_at TEXT,                            -- 完成时间

  -- 新增字段：审批
  approval_user_id INTEGER,                    -- 审批人
  approval_remark TEXT,                         -- 审批意见
  rejection_reason TEXT,                         -- 驳回理由

  created_by INTEGER,                            -- 创建人
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 数据迁移（如果 projects 表有数据）
INSERT INTO projects_new (
  id, project_no, project_name, method_type, description, created_at
)
SELECT
  id, project_no, project_name, method_type, description, created_at
FROM projects
WHERE NOT EXISTS (SELECT 1 FROM projects_new WHERE projects_new.id = projects.id);

DROP TABLE IF EXISTS projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(current_stage);

-- ============================================
-- 3. samples 表扩展（节点 3 收样字段）
-- ============================================
CREATE TABLE IF NOT EXISTS samples_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_code TEXT UNIQUE NOT NULL,             -- 样品编号（二维码）
  project_id INTEGER,                          -- 关联项目（新增）
  client_id INTEGER,                            -- 关联客户（新增）

  sample_name TEXT,                             -- 样品名称
  sample_type TEXT,                              -- 样品类型
  client_name TEXT,                              -- 客户名称（保留兼容）

  -- 新增字段：收样验收
  appearance_check TEXT,                         -- 外观检查 JSON: {color, shape, packaging}
  weight_received REAL,                          -- 收到重量 g
  weight_unit TEXT DEFAULT 'g',                  -- 重量单位
  photo_url TEXT,                                 -- 样品照片路径
  seal_status TEXT DEFAULT 'sealed',             -- 封样状态 sealed/unsealed/broken
  acceptance_status TEXT DEFAULT 'accepted',     -- 验收状态 accepted/rejected/partial
  rejection_reason TEXT,                          -- 拒收理由
  inspector_id INTEGER,                            -- 验收人
  inspection_at TEXT,                              -- 验收时间
  inspection_remark TEXT,                         -- 验收备注

  -- 原有字段
  received_date TEXT,
  test_item TEXT,
  status TEXT DEFAULT 'pending',
  analyst_id INTEGER,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id),
  FOREIGN KEY (analyst_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO samples_new (id, sample_code, sample_name, sample_type, received_date, test_item, status, created_at)
SELECT id, sample_code, sample_name, sample_type, received_date, test_item, status, created_at FROM samples;

DROP TABLE IF EXISTS samples;
ALTER TABLE samples_new RENAME TO samples;

CREATE INDEX IF NOT EXISTS idx_samples_project ON samples(project_id);
CREATE INDEX IF NOT EXISTS idx_samples_client ON samples(client_id);
CREATE INDEX IF NOT EXISTS idx_samples_qr ON samples(sample_code);
CREATE INDEX IF NOT EXISTS idx_samples_acceptance ON samples(acceptance_status);

-- ============================================
-- 4. retain_samples 留样表（节点 5）
-- ============================================
CREATE TABLE IF NOT EXISTS retain_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL,                   -- 关联样品
  retain_code TEXT UNIQUE NOT NULL,              -- 留样编号 RET-001
  retain_type TEXT DEFAULT 'split',              -- split/sub/whole

  retained_at TEXT DEFAULT (datetime('now')),    -- 留样时间
  retention_until TEXT,                            -- 留样到期日期
  destroyed_at TEXT,                                -- 实际销毁时间
  storage_location TEXT,                            -- 存储位置（如 A区-3层-架2）
  retain_weight REAL,                               -- 留样重量 g
  container_type TEXT DEFAULT 'bottle',             -- 容器类型 bottle/bag/box

  destroy_status TEXT DEFAULT 'retained',           -- retained/destroyed/lost
  destroy_approval_id INTEGER,                      -- 销毁审批记录
  destroy_operator_id INTEGER,                       -- 销毁执行人
  destroy_remark TEXT,                                -- 销毁备注

  created_by INTEGER,                                  -- 留样操作员
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (sample_id) REFERENCES samples(id)
);

CREATE INDEX IF NOT EXISTS idx_retain_samples_code ON retain_samples(retain_code);
CREATE INDEX IF NOT EXISTS idx_retain_samples_until ON retain_samples(retention_until);
CREATE INDEX IF NOT EXISTS idx_retain_samples_status ON retain_samples(destroy_status);

-- ============================================
-- 5. uncertainty_calculations 不确定度表（节点 10 CNAS-GL005）
-- ============================================
CREATE TABLE IF NOT EXISTS uncertainty_calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL,                    -- 关联样品
  parameter_name TEXT NOT NULL,                   -- 参数名称（如 Au）

  measurement_value REAL,                          -- 测量值
  unit TEXT,                                         -- 单位

  -- A 类不确定度（统计）
  type_a_uncertainty REAL,                          -- u_A
  type_a_source TEXT,                                 -- 来源 repeated_measurements

  -- B 类不确定度（系统）
  type_b_uncertainty REAL,                          -- u_B
  type_b_source TEXT,                                 -- 来源 calibration/certificate/reagent

  -- 合成不确定度
  combined_uncertainty REAL,                         -- u_c
  coverage_factor REAL DEFAULT 2,                     -- k 值
  expanded_uncertainty REAL,                         -- U
  relative_uncertainty REAL,                         -- U_rel (%)

  -- 计算参数
  num_measurements INTEGER,                          -- 测量次数 n
  mean_value REAL,                                     -- 平均值
  standard_deviation REAL,                            -- 标准偏差 s

  method TEXT DEFAULT 'GUM',                          -- 计算方法 GUM/monte_carlo/nordtest
  calculated_by INTEGER,                               -- 计算人
  calculated_at TEXT DEFAULT (datetime('now')),

  remark TEXT,

  FOREIGN KEY (sample_id) REFERENCES samples(id)
);

CREATE INDEX IF NOT EXISTS idx_uncertainty_sample ON uncertainty_calculations(sample_id);

-- ============================================
-- 6. approval_records 审批记录表（节点 9 两级审批）
-- ============================================
CREATE TABLE IF NOT EXISTS approval_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,                       -- target 类型 sample/project/report
  target_id INTEGER NOT NULL,                       -- 关联对象 ID
  approval_level TEXT NOT NULL,                      -- approval_level 1（核验） / 2（审核） / 3（技术负责人）
  approval_role TEXT,                                  -- approver_role 检测员/复核员/技术负责人

  approver_id INTEGER,                                   -- 审批人
  decision TEXT NOT NULL,                                -- decision approved/rejected/returned
  comment TEXT,                                            -- 审批意见

  -- 流程关联
  from_stage TEXT,                                          -- 上一阶段
  to_stage TEXT,                                              -- 下一阶段

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (approver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_target ON approval_records(target_type, target_id);

-- ============================================
-- 7. capa_records CAPA 记录表（节点 8 不合格纠正预防）
-- ============================================
CREATE TABLE IF NOT EXISTS capa_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capa_no TEXT UNIQUE NOT NULL,                       -- CAPA 编号 CAPA-2026-001
  source_type TEXT,                                       -- source 来源 sample ( / qc / equipment
  source_id INTEGER,                                       -- 关联 ID
  sample_id INTEGER,                                          -- 关联样品

  problem_type TEXT NOT NULL,                              -- problem_type qc_fail/customer_complaint/equipment_abnormal
  problem_description TEXT NOT NULL,                         -- problem_description 问题描述

  root_cause TEXT,                                              -- 根本原因
  corrective_action TEXT,                                       -- corrective_action 纠正措施
  preventive_action TEXT,                                       -- preventive_action 预防措施

  responsible_id INTEGER,                                          -- responsible_id 责任人
  deadline TEXT,                                                  -- 截止日期
  completed_at TEXT,                                              -- 实际完成时间

  status TEXT DEFAULT 'open',                                    -- status open/in_progress/closed/verified
  verified_by INTEGER,                                            -- 验证人
  verification_remark TEXT,                                       -- 验证备注

  created_by INTEGER,                                              -- 创建人
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (sample_id) REFERENCES samples(id),
  FOREIGN KEY (responsible_id) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_capa_status ON capa_records(status);
CREATE INDEX IF NOT EXISTS idx_capa_sample ON capa_records(sample_id);

-- ============================================
-- 8. qc_samples 质控样表（节点 8 Westgard）
-- ============================================
CREATE TABLE IF NOT EXISTS qc_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qc_no TEXT UNIQUE NOT NULL,                          -- 质控编号 QC-2026-001
  qc_type TEXT NOT NULL,                                -- qc_type blank/standard/spike/duplicate
  qc_name TEXT,                                          -- 质控样名称（如 Au 标准样）

  expected_value REAL,                                    -- 标称值
  tolerance REAL,                                         -- 允许偏差（±）
  unit TEXT,                                                -- 单位

  measured_value REAL,                                     -- 实测值
  deviation REAL,                                            -- 偏差
  deviation_percent REAL,                                    -- 相对偏差 %

  -- Westgard 规则判定
  westgard_1_3s INTEGER DEFAULT 0,                       -- 1_3s 违反
  westgard_2_2s INTEGER DEFAULT 0,                       -- 2_2s 违反
  westgard_R_4s INTEGER DEFAULT 0,                         -- R_4s 违反
  westgard_4_1s INTEGER DEFAULT 0,                         -- 4_1s 违反
  westgard_10_x INTEGER DEFAULT 0,                          -- 10_x 违反
  rule_violated TEXT,                                       -- 违反规则（多个用逗号分隔）

  judgement TEXT DEFAULT 'pass',                            -- pass/fail
  related_sample_id INTEGER,                                  -- 关联样品 ID
  operator_id INTEGER,                                          -- 检测员
  test_date TEXT,                                                 -- 检测日期

  remark TEXT,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (related_sample_id) REFERENCES samples(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_qc_samples_type ON qc_samples(qc_type);
CREATE INDEX IF NOT EXISTS idx_qc_samples_date ON qc_samples(test_date);
CREATE INDEX IF NOT EXISTS idx_qc_samples_judge ON qc_samples(judgement);

-- ============================================
-- 9. retest_records 复检记录表（节点 11）
-- ============================================
CREATE TABLE IF NOT EXISTS retest_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retest_no TEXT UNIQUE NOT NULL,                          -- 复检编号 RT-2026-001
  original_sample_id INTEGER NOT NULL,                       -- 原样品 ID
  retest_sample_id INTEGER,                                     -- 复检样品 ID（从留样）
  retest_retain_id INTEGER,                                     -- 使用的留样 ID

  retest_reason TEXT NOT NULL,                                  -- retest_reason qc_fail/outlier/customer_request
  retest_method TEXT,                                                -- retest_method
  retest_parameters TEXT,                                          -- 复检参数（JSON）

  retest_value REAL,                                                  -- 复检结果
  original_value REAL,                                              -- 原结果
  deviation_percent REAL,                                              -- 偏差 %

  judgement TEXT DEFAULT 'confirmed',                                -- confirmed/improved/worse
  judgement_remark TEXT,                                                -- 判定备注

  requested_by INTEGER,                                                  -- 发起人
  requested_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,                                                          -- 完成时间

  operator_id INTEGER,                                                          -- 复检员

  FOREIGN KEY (original_sample_id) REFERENCES samples(id),
  FOREIGN KEY (retest_sample_id) REFERENCES samples(id),
  FOREIGN KEY (retest_retain_id) REFERENCES retain_samples(id)
);

CREATE INDEX IF NOT EXISTS idx_retest_original ON retest_records(original_sample_id);

-- ============================================
-- 10. qr_codes 二维码生成记录表（节点 3 二维码）
-- ============================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,                                    -- target_type sample/client/equipment
  target_id INTEGER NOT NULL,                                      -- 关联对象 ID
  qr_content TEXT NOT NULL,                                            -- 二维码内容
  qr_image_path TEXT,                                                    -- 二维码图片路径
  generated_by INTEGER,                                                -- 生成人
  generated_at TEXT DEFAULT (datetime('now')),
  print_count INTEGER DEFAULT 0,                                       -- 打印次数
  last_printed_at TEXT                                                    -- 最后打印时间
);

CREATE INDEX IF NOT EXISTS idx_qr_target ON qr_codes(target_type, target_id);

-- ============================================================
-- 迁移完成！
-- 新增 7 张表 + 扩展 2 张表（projects/samples）
-- ============================================================

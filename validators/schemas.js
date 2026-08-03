/**
 * Zod schemas - 统一输入校验
 * 2026-08-03 Tier 1 整合
 */
const { z } = require('zod');

// ===== 通用字段 =====
const UsernameSchema = z.string().min(1).max(50);
const PasswordSchema = z.string().min(1).max(200);
const NonEmptyString = z.string().min(1);
const OptionalString = z.string().optional().default('');
const PositiveInt = z.number().int().min(0);
const OptionalInt = z.number().int().optional().nullable();
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, '日期格式应为 YYYY-MM-DD').optional();

// ===== 状态枚举 =====
const EquipmentStatus = z.enum(['normal', 'maintenance', 'broken', 'pending']);
const HazardSeverity = z.enum(['low', 'medium', 'high']);
const HazardStatus = z.enum(['pending', 'open', 'investigating', 'resolved']);
const UserRole = z.enum(['admin', 'manager', 'analyst']);
const UserStatus = z.enum(['active', 'inactive']);
const RecordType = z.enum(['in', 'out', 'transfer', 'adjust']);
const InspectionStatus = z.enum(['normal', 'minor_issue', 'major_issue']);

// ===== 用户/Auth =====
const UserLoginSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema
});

const UserCreateSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  role: UserRole.optional().default('analyst'),
  name: NonEmptyString,
  dept: OptionalString,
  title: OptionalString,
  email: z.string().email().optional().or(z.literal('')),
  phone: OptionalString,
  id_card: OptionalString,
  education: OptionalString,
  cert_no: OptionalString,
  hiredate: OptionalString
});

const UserCertCreateSchema = z.object({
  user_id: PositiveInt,
  cert_name: NonEmptyString,
  cert_no: NonEmptyString,
  issue_date: OptionalString,
  expiry_date: OptionalString,
  cert_file: OptionalString,
  status: UserStatus.optional().default('active')
});

// ===== 部门 =====
const DepartmentCreateSchema = z.object({
  name: NonEmptyString,
  manager_id: OptionalInt,
  parent_id: OptionalInt
});

// ===== 人员 =====
const PersonnelCreateSchema = z.object({
  name: NonEmptyString,
  dept: OptionalString,
  title: OptionalString,
  phone: OptionalString,
  email: z.string().email().optional().or(z.literal(''))
});

// ===== 设备 =====
const EquipmentCreateSchema = z.object({
  equip_no: NonEmptyString,
  equip_name: NonEmptyString,
  model: OptionalString,
  manufacturer: OptionalString,
  serial_no: OptionalString,
  purchase_date: OptionalString,
  purchase_price: z.number().min(0).optional().default(0),
  current_value: z.number().min(0).optional().default(0),
  location: OptionalString,
  dept_id: OptionalInt,
  status: EquipmentStatus.optional().default('normal'),
  responsible_person: OptionalInt
});

const MaintenanceCreateSchema = z.object({
  equip_id: PositiveInt,
  maintenance_date: NonEmptyString,
  maintenance_type: NonEmptyString,
  maintainer: NonEmptyString,
  cost: z.number().min(0).optional().default(0),
  description: OptionalString,
  next_maintenance_date: OptionalString
});

const CalibrationCreateSchema = z.object({
  equip_id: PositiveInt,
  calibration_date: NonEmptyString,
  calibration_org: NonEmptyString,
  certificate_no: OptionalString,
  valid_date: OptionalString,
  result: OptionalString
});

const RepairCreateSchema = z.object({
  equip_id: PositiveInt,
  repair_date: NonEmptyString,
  fault_desc: NonEmptyString,
  repair_action: OptionalString,
  repairer: NonEmptyString,
  cost: z.number().min(0).optional().default(0),
  result: OptionalString,
  next_inspection_date: OptionalString
});

// ===== 项目 =====
const ProjectCreateSchema = z.object({
  project_no: NonEmptyString,
  project_name: NonEmptyString,
  method_type: OptionalString,
  description: OptionalString
});

const ProjectRecordCreateSchema = z.object({
  project_id: PositiveInt,
  record_date: NonEmptyString,
  sample_count: PositiveInt.optional().default(0),
  pass_count: PositiveInt.optional().default(0),
  fail_count: PositiveInt.optional().default(0),
  operator_id: OptionalInt,
  supervisor_id: OptionalInt,
  remark: OptionalString
});

// ===== 样品 =====
const SampleAppointmentCreateSchema = z.object({
  appointment_no: NonEmptyString,
  client_name: NonEmptyString,
  sample_type: OptionalString,
  expected_date: OptionalString,
  contact_person: OptionalString,
  contact_phone: OptionalString,
  status: z.enum(['pending', 'approved', 'completed', 'cancelled']).optional().default('pending'),
  remark: OptionalString
});

const SampleProcessingCreateSchema = z.object({
  sample_code: NonEmptyString,
  sample_name: NonEmptyString,
  sample_type: OptionalString,
  packaging_intact: z.enum(['yes', 'no']).optional().default('yes'),
  processing_method: OptionalString,
  detection_method: OptionalString,
  processing_date: OptionalString,
  operator_id: OptionalInt,
  supervisor_id: OptionalInt,
  equipment_id: OptionalInt,
  environment_temp: z.number().optional().nullable(),
  environment_humidity: z.number().optional().nullable(),
  consumables_used: OptionalString,
  reagents_used: OptionalString,
  gases_used: OptionalString,
  processing_desc: OptionalString,
  result_data: OptionalString,
  result_conclusion: OptionalString,
  report_no: OptionalString,
  qa_review: OptionalString,
  workflow_status: OptionalString,
  archived: z.enum(['yes', 'no']).optional().default('no')
});

// ===== 耗材 =====
const ConsumableSupplierCreateSchema = z.object({
  name: NonEmptyString,
  contact_person: OptionalString,
  phone: OptionalString,
  address: OptionalString,
  main_products: OptionalString,
  status: z.enum(['active', 'inactive']).optional().default('active')
});

const ConsumableCreateSchema = z.object({
  item_name: NonEmptyString,
  specification: OptionalString,
  unit: OptionalString,
  category: OptionalString,
  min_stock: PositiveInt.optional().default(0),
  current_stock: PositiveInt.optional().default(0),
  location: OptionalString,
  supplier_id: OptionalInt
});

const ConsumableRecordCreateSchema = z.object({
  consumable_id: PositiveInt,
  record_type: RecordType,
  quantity: PositiveInt,
  operator_id: OptionalInt,
  record_date: NonEmptyString,
  remark: OptionalString
});

// ===== 试剂 =====
const ReagentCreateSchema = z.object({
  reagent_name: NonEmptyString,
  cas_no: OptionalString,
  formula: OptionalString,
  purity: OptionalString,
  manufacturer: OptionalString,
  supplier: OptionalString,
  location: OptionalString,
  current_stock: z.number().min(0).optional().default(0),
  unit: OptionalString,
  min_stock: z.number().min(0).optional().default(0),
  status: z.string().optional().default('active'),
  expiry_date: OptionalString
});

const ReagentRecordCreateSchema = z.object({
  reagent_id: PositiveInt,
  record_type: RecordType,
  quantity: z.number().min(0),
  operator_id: OptionalInt,
  record_date: NonEmptyString,
  remark: OptionalString
});

const StandardSubstanceCreateSchema = z.object({
  substance_name: NonEmptyString,
  cas_no: OptionalString,
  concentration: OptionalString,
  manufacturer: OptionalString,
  certificate_no: OptionalString,
  lot_no: OptionalString,
  valid_date: OptionalString,
  current_stock: z.number().min(0).optional().default(0),
  unit: OptionalString,
  storage_location: OptionalString,
  status: z.string().optional().default('active')
});

const ReagentInboundCreateSchema = z.object({
  inbound_no: NonEmptyString,
  supplier_name: NonEmptyString,
  inbound_date: NonEmptyString,
  total_amount: z.number().min(0).optional().default(0),
  total_price: z.number().min(0).optional().default(0),
  operator_id: OptionalInt,
  approver_id: OptionalInt,
  remark: OptionalString
});

const ReagentRequisitionCreateSchema = z.object({
  requisition_no: NonEmptyString,
  reagent_id: PositiveInt,
  requester_id: OptionalInt,
  quantity: z.number().min(0),
  unit: OptionalString,
  purpose: OptionalString,
  approver_id: OptionalInt,
  approve_status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending'),
  approve_date: OptionalString,
  remark: OptionalString
});

// ===== 玻璃器皿 =====
const GlasswareSupplierCreateSchema = z.object({
  name: NonEmptyString,
  contact_person: OptionalString,
  phone: OptionalString,
  address: OptionalString,
  status: z.enum(['active', 'inactive']).optional().default('active')
});

const GlasswareCreateSchema = z.object({
  item_name: NonEmptyString,
  specification: OptionalString,
  material: OptionalString,
  unit: OptionalString,
  current_stock: PositiveInt.optional().default(0),
  location: OptionalString,
  supplier_id: OptionalInt
});

const GlasswareRecordCreateSchema = z.object({
  glassware_id: PositiveInt,
  record_type: RecordType,
  quantity: PositiveInt,
  operator_id: OptionalInt,
  record_date: NonEmptyString,
  remark: OptionalString
});

// ===== 气体 =====
const GasCreateSchema = z.object({
  gas_name: NonEmptyString,
  specification: OptionalString,
  manufacturer: OptionalString,
  supplier: OptionalString,
  current_stock: z.number().min(0).optional().default(0),
  unit: OptionalString,
  location: OptionalString,
  cylinder_no: OptionalString,
  status: z.string().optional().default('normal'),
  next_inspection_date: OptionalString
});

const GasRecordCreateSchema = z.object({
  gas_id: PositiveInt,
  record_type: RecordType,
  quantity: z.number().min(0),
  operator_id: OptionalInt,
  record_date: NonEmptyString,
  remark: OptionalString
});

const GasInboundCreateSchema = z.object({
  inbound_no: NonEmptyString,
  supplier_name: NonEmptyString,
  inbound_date: NonEmptyString,
  gas_type: OptionalString,
  quantity: z.number().min(0),
  cylinder_count: PositiveInt.optional().default(1),
  operator_id: OptionalInt,
  remark: OptionalString
});

// ===== 通风橱 + 培训 =====
const FumehoodCreateSchema = z.object({
  fumehood_no: NonEmptyString,
  location: NonEmptyString,
  brand_model: OptionalString,
  wind_speed: OptionalString,
  calib_date: OptionalString,
  next_calib: OptionalString,
  status: z.string().optional().default('normal')
});

const FumehoodRecordCreateSchema = z.object({
  fumehood_id: PositiveInt,
  use_date: NonEmptyString,
  user_id: OptionalInt,
  start_time: OptionalString,
  end_time: OptionalString,
  experiment_type: OptionalString,
  chemicals_used: OptionalString,
  protective_equip: OptionalString,
  remark: OptionalString
});

const TrainingAnnualCreateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  dept_id: OptionalInt,
  total_plan: PositiveInt.optional().default(0),
  total_actual: PositiveInt.optional().default(0),
  plan_target: PositiveInt.optional().default(0),
  actual_target: PositiveInt.optional().default(0)
});

const TrainingRecordCreateSchema = z.object({
  employee_id: PositiveInt,
  training_date: NonEmptyString,
  training_type: NonEmptyString,
  training_content: OptionalString,
  training_hours: z.number().min(0).optional().default(0),
  trainer: OptionalString,
  assessment_result: z.enum(['pass', 'fail', 'excellent']).optional().default('pass'),
  certificate_no: OptionalString,
  valid_date: OptionalString,
  remark: OptionalString
});

// ===== EHS =====
const EhsInspectionCreateSchema = z.object({
  inspection_date: NonEmptyString,
  inspector_id: PositiveInt,
  fire_facilities: z.string().optional().default(''),
  temp_value: z.number().optional().nullable(),
  humidity_value: z.number().optional().nullable(),
  ventilation_status: OptionalString,
  electrical_safety: OptionalString,
  chemical_storage: OptionalString,
  overall_status: InspectionStatus.optional().default('normal'),
  remark: OptionalString
});

const EhsIncidentCreateSchema = z.object({
  incident_date: NonEmptyString,
  incident_type: NonEmptyString,
  severity: HazardSeverity,
  location: NonEmptyString,
  description: NonEmptyString,
  involved_persons: OptionalString,
  handling_result: OptionalString,
  reporter_id: OptionalInt
});

const EhsHazardCreateSchema = z.object({
  discovery_date: NonEmptyString,
  hazard_location: NonEmptyString,
  hazard_type: NonEmptyString,
  severity_level: HazardSeverity,
  description: NonEmptyString,
  control_measures: OptionalString,
  responsible_person: OptionalInt,
  deadline: OptionalString,
  status: HazardStatus.optional().default('open')
});

// ===== Workflow =====
const WorkflowSampleCreateSchema = z.object({
  sample_code: NonEmptyString,
  sample_name: NonEmptyString,
  sample_type: OptionalString,
  client_name: NonEmptyString,
  contact_phone: OptionalString,
  detection_method: OptionalString,
  appointment_date: OptionalString,
  operator_id: OptionalInt,
  appointment_no: OptionalString,
  remark: OptionalString
});

const WorkflowHistoryCreateSchema = z.object({
  sample_id: PositiveInt,
  from_stage: OptionalString,
  to_stage: NonEmptyString,
  action_user_id: OptionalInt,
  remark: OptionalString
});

/**
 * Express 中间件：校验 req.body
 * 用法：app.post('/api/xxx', validate(SomeSchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({ error: '数据校验失败', details: issues });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = {
  validate,
  // 用户
  UserLoginSchema, UserCreateSchema, UserCertCreateSchema,
  // 部门/人员
  DepartmentCreateSchema, PersonnelCreateSchema,
  // 设备
  EquipmentCreateSchema, MaintenanceCreateSchema, CalibrationCreateSchema, RepairCreateSchema,
  // 项目
  ProjectCreateSchema, ProjectRecordCreateSchema,
  // 样品
  SampleAppointmentCreateSchema, SampleProcessingCreateSchema,
  // 耗材
  ConsumableSupplierCreateSchema, ConsumableCreateSchema, ConsumableRecordCreateSchema,
  // 试剂
  ReagentCreateSchema, ReagentRecordCreateSchema, StandardSubstanceCreateSchema,
  ReagentInboundCreateSchema, ReagentRequisitionCreateSchema,
  // 玻璃器皿
  GlasswareSupplierCreateSchema, GlasswareCreateSchema, GlasswareRecordCreateSchema,
  // 气体
  GasCreateSchema, GasRecordCreateSchema, GasInboundCreateSchema,
  // 通风橱 + 培训
  FumehoodCreateSchema, FumehoodRecordCreateSchema,
  TrainingAnnualCreateSchema, TrainingRecordCreateSchema,
  // EHS
  EhsInspectionCreateSchema, EhsIncidentCreateSchema, EhsHazardCreateSchema,
  // Workflow
  WorkflowSampleCreateSchema, WorkflowHistoryCreateSchema
};

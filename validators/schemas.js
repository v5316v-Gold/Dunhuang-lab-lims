/**
 * Zod schemas - 统一输入校验
 * 2026-08-03 Tier 1 整合
 */
const { z } = require('zod');

// 通用：username / password
const UsernameSchema = z.string().min(1).max(50);
const PasswordSchema = z.string().min(1).max(200);

// 用户
const UserLoginSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema
});

const UserCreateSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  role: z.enum(['admin', 'manager', 'analyst']).optional().default('analyst'),
  name: z.string().min(1).max(50),
  dept: z.string().optional().default(''),
  title: z.string().optional().default('')
});

// 部门
const DepartmentCreateSchema = z.object({
  name: z.string().min(1).max(100)
});

// 人员
const PersonnelCreateSchema = z.object({
  name: z.string().min(1).max(50),
  dept: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal(''))
});

// 设备
const EquipmentCreateSchema = z.object({
  equip_no: z.string().min(1).max(50),
  equip_name: z.string().min(1).max(100),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serial_no: z.string().optional(),
  purchase_date: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['normal', 'maintenance', 'broken', 'pending']).optional().default('normal')
});

// 项目
const ProjectCreateSchema = z.object({
  project_no: z.string().min(1).max(50),
  project_name: z.string().min(1).max(200),
  method_type: z.string().optional(),
  description: z.string().optional()
});

// 样品
const SampleCreateSchema = z.object({
  sample_code: z.string().min(1).max(50),
  sample_name: z.string().min(1).max(200),
  sample_type: z.string().optional(),
  client_name: z.string().optional(),
  test_item: z.string().optional(),
  status: z.enum(['pending', 'received', 'processing', 'completed']).optional().default('pending')
});

// 耗材
const ConsumableCreateSchema = z.object({
  item_name: z.string().min(1).max(200),
  specification: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  min_stock: z.number().int().min(0).optional().default(0),
  current_stock: z.number().int().min(0).optional().default(0),
  location: z.string().optional()
});

// 试剂
const ReagentCreateSchema = z.object({
  reagent_name: z.string().min(1).max(200),
  cas_no: z.string().optional(),
  formula: z.string().optional(),
  purity: z.string().optional(),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  current_stock: z.number().min(0).optional().default(0),
  unit: z.string().optional(),
  min_stock: z.number().min(0).optional().default(0),
  status: z.string().optional().default('active'),
  expiry_date: z.string().optional()
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
  // schemas
  UserLoginSchema,
  UserCreateSchema,
  DepartmentCreateSchema,
  PersonnelCreateSchema,
  EquipmentCreateSchema,
  ProjectCreateSchema,
  SampleCreateSchema,
  ConsumableCreateSchema,
  ReagentCreateSchema
};

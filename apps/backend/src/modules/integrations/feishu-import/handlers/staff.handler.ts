// =====================================================
// STAFF 人员信息 handler — W3-A
// 飞书"人员信息"表:序号/姓名1/检测组/工号/联系电话
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { ImportHandler, PrismaTx, ValidationError, findOrCreateUser, isBlank } from '../handler.interface';
import { toDate } from '../value-normalizer';

export class StaffHandler implements ImportHandler {
  readonly entityType = ImportEntityType.STAFF;

  defaultMappings: Record<string, string> = {
    '序号': 'seq',
    '姓名1': 'name', '姓名': 'name', 'name': 'name',
    '检测组': 'group',
    '工号': 'username', 'username': 'username',
    '联系电话': 'phone', '手机': 'phone', '手机号': 'phone',
  };

  async validate(row: Record<string, any>): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    if (isBlank(row.username) && isBlank(row.name)) {
      errors.push({ field: 'username', message: '工号或姓名必填' });
    }
    return errors;
  }

  async create(row: Record<string, any>, tx: PrismaTx): Promise<string> {
    // 人员只创建用户,不关联其他(用户答复:人员名字不重要,有人员管理即可)
    const userId = await findOrCreateUser(tx, {
      username: row.username ?? row.name,
      name: row.name,
      phone: row.phone,
      role: 'ANALYST',
    });
    if (!userId) throw new Error('无法创建人员');
    return userId;
  }
}

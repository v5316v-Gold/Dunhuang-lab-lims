// =====================================================
// Phase 0.5 P0-2: MFA 强制装饰器
// 详见 docs/04-CNAS-COMPLIANCE.md §7.2 + 21 CFR Part 11
//
// 用法:
//   @Post('issue')
//   @RequireMfa('REPORT_ISSUE')
//   async issueReport() { ... }
//
// 业务场景(必须 MFA):
//   - 报告签发 / 电子签名
//   - OOS 关闭 / CAPA 批准
//   - 样品删除 / 软删除恢复
//   - 用户删除 / 角色变更
//   - 校准数据删除
//   - 标准物质删除
//   - 检测结果修改
//   - 留样处置
// =====================================================

import { SetMetadata } from '@nestjs/common';

export const MFA_REQUIRED_KEY = 'mfa:required';

export const MFA_SCENES = {
  // 报告
  REPORT_ISSUE: 'REPORT_ISSUE',
  REPORT_SIGN: 'REPORT_SIGN',
  REPORT_AMEND: 'REPORT_AMEND',
  REPORT_WITHDRAW: 'REPORT_WITHDRAW',
  // 不符合工作
  OOS_CLOSE: 'OOS_CLOSE',
  CAPA_APPROVE: 'CAPA_APPROVE',
  // 用户管理
  USER_DELETE: 'USER_DELETE',
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',
  USER_LOCKOUT_RESET: 'USER_LOCKOUT_RESET',
  // 设备
  EQUIPMENT_DELETE: 'EQUIPMENT_DELETE',
  EQUIPMENT_RETIRE: 'EQUIPMENT_RETIRE',
  // 试剂 / 标准物质
  REAGENT_DELETE: 'REAGENT_DELETE',
  REFERENCE_MATERIAL_DELETE: 'REFERENCE_MATERIAL_DELETE',
  // 检测数据
  TEST_RESULT_EDIT: 'TEST_RESULT_EDIT',
  TEST_RESULT_DELETE: 'TEST_RESULT_DELETE',
  // 留样
  SAMPLE_DISPOSAL: 'SAMPLE_DISPOSAL',
  SAMPLE_DELETE: 'SAMPLE_DELETE',
  // 内审 / 管评
  INTERNAL_AUDIT_APPROVE: 'INTERNAL_AUDIT_APPROVE',
  MANAGEMENT_REVIEW_APPROVE: 'MANAGEMENT_REVIEW_APPROVE',
  // 审计链
  AUDIT_CHAIN_EXPORT: 'AUDIT_CHAIN_EXPORT',
} as const;

export type MfaScene = (typeof MFA_SCENES)[keyof typeof MFA_SCENES];

/**
 * 标记需要 MFA 二次验证的端点
 * @param scene 业务场景
 */
export const RequireMfa = (scene: MfaScene) =>
  SetMetadata(MFA_REQUIRED_KEY, { scene, required: true });

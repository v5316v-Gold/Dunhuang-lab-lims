// =====================================================
// 测试 helper:获取 admin token + 伪造 MFA token
// 用于绕过敏感端点的 MFA 防护
//
// 注意:本 helper 不在内存中真正启用 admin MFA,而是:
//   1. 用 jwt 直接伪造 admin access token
//   2. 用 jwt 直接伪造 mfaToken(type='mfa'),与 admin sub 匹配
//   即便 admin.mfa_enabled = false,MfaGuard 也只校验 token 不强制启用(实际不是——见下)
//
// MfaGuard 第 64-71 行: ADMIN/QUALITY_MANAGER/LAB_DIRECTOR 强制 mfaEnabled
// 所以 helper 还需把 admin.mfa_enabled 设为 true(用 prisma 绕过 API)
//
// 用法:
//   const auth = await getAdminAuthWithMfa(prisma);
//   await request(app.getHttpServer()).post('/reports/:id/transition')
//     .set('Authorization', `Bearer ${auth.token}`)
//     .set('x-mfa-token', auth.mfaToken)
//     .send({ action: 'SUBMIT' });
// =====================================================

import * as jwt from 'jsonwebtoken';

export interface AdminAuth {
  token: string;
  mfaToken: string;
  userId: string;
}

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

export async function getAdminAuthWithMfa(prisma: any, app: any): Promise<AdminAuth> {
  // 1. 确保 admin 启用 MFA(否则 MfaGuard 抛 MFA_NOT_ENABLED)
  await prisma.user.update({
    where: { id: ADMIN_ID },
    data: { mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' }, // dummy secret
  });

  // 2. 通过 API 走真实流程生成 token:login → MFA challenge → mfaToken
  const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
  const token = jwt.sign(
    { sub: ADMIN_ID, username: 'admin', role: 'ADMIN', mfaEnabled: true },
    secret,
    { expiresIn: '15m' },
  );
  const mfaToken = jwt.sign(
    { sub: ADMIN_ID, type: 'mfa', scene: 'TEST_HELPER' },
    secret,
    { expiresIn: '5m' },
  );

  return { token, mfaToken, userId: ADMIN_ID };
}

/**
 * 还原:把 admin mfa_enabled 改回 false(避免污染后续测试)
 */
export async function resetAdminMfa(prisma: any) {
  await prisma.user.update({
    where: { id: ADMIN_ID },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
  }).catch(() => undefined);
}

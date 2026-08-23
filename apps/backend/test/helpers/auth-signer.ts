// =====================================================
// 轻量 MFA token signer helper(测试用)
// 不依赖 prisma,直接 jwt.sign 伪造 mfaToken
//
// 用法:
//   const mfaToken = signMfaToken('REPORT_ISSUE');
//   await request(app.getHttpServer()).post('/reports/:id/transition')
//     .set('Authorization', `Bearer ${adminToken}`)
//     .set('x-mfa-token', mfaToken)
//     .send({ action: 'SUBMIT' });
//
// 注意:MfaGuard 还会校验 admin.mfa_enabled=true(ADMIN 必须启用 MFA)
// 测试需在 beforeAll 里 prisma.user.update({mfaEnabled:true})
// =====================================================

import * as jwt from 'jsonwebtoken';

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

export function signMfaToken(scene: string = 'TEST_HELPER', userId: string = ADMIN_ID): string {
  const secret = process.env.JWT_SECRET || 'a-strong-dev-secret-32-characters-long!!';
  return jwt.sign(
    { sub: userId, type: 'mfa', scene },
    secret,
    { expiresIn: '5m' },
  );
}

/**
 * 确保 admin 用户启用 MFA(测试 helper — MfaGuard 强制 ADMIN 启用 MFA 才能过)
 */
export async function enableAdminMfa(prisma: any, userId: string = ADMIN_ID): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' },
  }).catch(() => undefined);
}

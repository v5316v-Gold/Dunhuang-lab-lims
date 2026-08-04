# ADR-0009:认证 = JWT + Refresh + TOTP(自建)

> **状态**: Accepted
> **日期**: 2026-08-04
> **决策人**: 天枢(架构师)+ 后端工程师
> **影响范围**: 认证 / 授权 / CNAS 合规

## 背景

敦煌金质检 LIMS 需要满足 CNAS 的**多因素认证**要求。认证方案选择:

| 维度 | 自建(JWT + TOTP) | 第三方 IdP(Keycloak / Auth0) |
|---|---|---|
| **CNAS 认可** | ✅ 自建可控 | ✅ |
| **运维成本** | ⭐⭐⭐ 低 | ⭐ 中(需运维 IdP) |
| **学习曲线** | ⭐⭐ 中 | ⭐⭐ 中 |
| **集成第三方** | ⚠️ 需对接 | ✅ 内置 SSO |
| **数据控制** | ✅ 自主 | ⚠️ 第三方存储 |
| **成本** | ⭐ 0 | ⚠️ 用户数计费 |
| **可定制** | ⭐⭐⭐ 完全 | ⭐ 有限 |

## 决策

**采用 NestJS 自建认证:JWT + Refresh Token + TOTP MFA**。预留 OIDC 接口(Phase 5 可对接 Keycloak / 钉钉 / 飞书)。

### 1. 认证流程

```
1. 用户登录:POST /auth/login {username, password}
   ↓ 验证密码(bcrypt)
   ↓ 生成 accessToken(JWT, 15 分钟) + refreshToken(opaque, 7 天)
   ↓ 返回 {accessToken, refreshToken, mfaRequired: true}

2. MFA 验证(若启用):POST /auth/mfa/verify {totpCode}
   ↓ 验证 TOTP(speakeasy)
   ↓ 验证成功 → 返回完整 accessToken

3. 访问 API:Authorization: Bearer <accessToken>
   ↓ 验证 JWT 签名 + 过期 + 撤销列表
   ↓ 通过 → 进入业务逻辑

4. Token 过期:POST /auth/refresh {refreshToken}
   ↓ 验证 refreshToken hash + 未过期 + 未撤销
   ↓ 生成新 accessToken + 新 refreshToken(rotation)

5. 登出:POST /auth/logout {refreshToken}
   ↓ 撤销 refreshToken(标记 revoked=true)
```

### 2. JWT 结构

```typescript
interface AccessTokenPayload {
  sub: string;          // userId
  username: string;
  roles: UserRole[];    // ['ANALYST', 'SENIOR_ANALYST']
  deptId?: string;
  iat: number;          // issued at
  exp: number;          // expires at (15 min)
  jti: string;          // JWT ID,用于撤销列表
}
```

### 3. Refresh Token 设计

```typescript
// Refresh Token = opaque random string(256 bit)
// 不存明文,只存 hash(SHA-256)
// 支持 rotation(每次 refresh 生成新 token,旧的失效)
// 撤销:revoked=true
```

```prisma
model UserSession {
  id               String   @id @default(uuid())
  userId           String
  refreshTokenHash String   // SHA-256 hex
  userAgent        String?
  ip               String?
  expiresAt        DateTime
  revoked          Boolean  @default(false)
  createdAt        DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
  @@index([refreshTokenHash])
}
```

### 4. TOTP MFA

```typescript
// apps/backend/src/common/auth/totp.service.ts
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TotpService {
  async enable(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const secret = speakeasy.generateSecret({
      name: `Dunhuang-LIMS:${user.username}`,
      issuer: '敦煌金质检',
      length: 32,
    });

    // 加密存储
    const encryptedSecret = this.crypto.encrypt(secret.base32);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptedSecret, mfaEnabled: false },
    });

    // 生成二维码
    const otpauthUrl = secret.otpauth_url;
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // 生成 10 个一次性备份码
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: backupCodes.map(c => this.crypto.encrypt(c)) },
    });

    return { secret: secret.base32, qrCode, backupCodes };
  }

  async verify(userId: string, totpCode: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = this.crypto.decrypt(user.mfaSecret);

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 1,  // 容忍 ±30 秒
    });
  }
}
```

### 5. RBAC 守卫

```typescript
// apps/backend/src/common/auth/decorators/require-role.decorator.ts
export const RequireRole = (...roles: UserRole[]) => SetMetadata('roles', roles);

// apps/backend/src/common/auth/rbac.guard.ts
@Injectable()
export class RbacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles?.length) return true;

    const req = context.switchToHttp().getRequest();
    const userRoles = req.user?.roles || [];

    return requiredRoles.some(role => userRoles.includes(role));
  }
}

// 使用示例
@Controller('samples')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SampleController {
  @Post()
  @RequireRole(UserRole.ANALYST, UserRole.SENIOR_ANALYST)
  async create(@Body() dto: CreateSampleDto) { /* ... */ }

  @Post(':id/approve')
  @RequireRole(UserRole.LAB_DIRECTOR)
  async approve(@Param('id') id: string) { /* ... */ }
}
```

### 6. 密码策略

```typescript
// apps/backend/src/common/auth/password-policy.ts
export const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  // bcrypt cost factor 12(默认)
  // 90 天强制修改(可配置)
};
```

## 理由

### 为什么自建(而非第三方 IdP)

| 维度 | 自建 | Keycloak |
|---|---|---|
| **CNAS 接受度** | ✅ 完全可控,审核员可看代码 | ✅ |
| **运维成本** | ⭐⭐⭐ 0 额外运维 | ⭐ 中 |
| **学习成本** | ⭐⭐ 中 | ⭐⭐ 中(学习 Keycloak) |
| **数据控制** | ✅ DB 自主 | ⚠️ Keycloak DB |
| **集成复杂度** | ⭐⭐⭐ 仅本系统 | ⚠️ 需 OIDC 集成 |
| **第三方依赖** | ❌ 无 | ⚠️ 强依赖 Keycloak |
| **升级风险** | ⭐⭐ 中 | ⭐ 中 |

**核心理由**:敦煌金质检 LIMS 用户量小(15-22 内部),自建认证足够;数据控制优先;降低第三方依赖。

### 为什么 JWT(而非 Session Cookie)

| 维度 | JWT | Session |
|---|---|---|
| **无状态** | ✅ 不存 session,适合 K8s 多副本 | ⚠️ 需 session store |
| **跨域** | ✅ 适合 SPA + API 分离 | ⚠️ CORS 复杂 |
| **撤销** | ⚠️ 需 jti 黑名单(Redis) | ✅ 直接删 session |
| **性能** | ✅ 无 DB 查询 | ⚠️ 每次查 Redis |

### 为什么 Refresh Token(而非仅 Access Token)

- Access Token 短期(15 分钟)→ 泄露风险低
- Refresh Token 长期(7 天)→ 无感续期
- Refresh Token rotation → 盗用立即被发现(旧 token 失效)

### 为什么 TOTP MFA(而非 SMS / 邮件)

| 维度 | TOTP | SMS | 邮件 |
|---|---|---|---|
| **CNAS 认可** | ✅ | ⚠️ SIM 卡劫持风险 | ⚠️ 邮箱劫持风险 |
| **离线可用** | ✅ | ❌ 需信号 | ⚠️ 需网络 |
| **成本** | ⭐⭐⭐ 0 | ⚠️ 短信费 | ⚠️ 邮件服务费 |
| **用户体验** | ⭐⭐⭐ 30 秒 | ⭐⭐ 等待 | ⭐ 等待 |

TOTP 是 RFC 6238 标准,Google Authenticator / 微软 Authenticator / Authy 等都支持。

## 替代方案

### 备选 1:第三方 IdP(Keycloak)
- **优势**: OIDC / SAML / LDAP 全支持
- **拒绝理由**: 运维成本;学习成本;用户量小过度设计

### 备选 2:Auth0 / Okta
- **优势**: 托管;扩展性
- **拒绝理由**: 成本高;数据出境风险

### 备选 3:仅密码(无 MFA)
- **优势**: 简单
- **拒绝理由**: CNAS / ISO 17025 要求多因素

### 备选 4:Session Cookie(无 JWT)
- **优势**: 简单
- **拒绝理由**: K8s 多副本 + 跨域 API 分离不友好

## 影响

### 正面影响
- ✅ **完全可控**:CNAS 审核员可看代码
- ✅ **无第三方依赖**:可离线运行
- ✅ **MFA 强制**:管理员 / 高级检测员必须启用
- ✅ **审计链集成**:JWT userId → PG 触发器 → audit_logs

### 负面影响 + 缓解
- ⚠️ **JWT 撤销难**:缓解:短期 15 分钟 + Redis 黑名单(jti)
- ⚠️ **MFA 私钥泄露**:缓解:加密存储 + 备份码一次性使用
- ⚠️ **Refresh token 盗用**:缓解:rotation + IP 绑定 + user-agent 绑定
- ⚠️ **密码爆破**:缓解:`@nestjs/throttler` 限流 + bcrypt cost 12

### 关键约束

1. **所有 API 必须经 JWT 验证**:`/auth/*` 白名单除外
2. **RBAC 守卫**:`@RequireRole()` + 全局 Guard
3. **MFA 强制启用**:管理员 + 高级检测员 + 批准人
4. **密码策略**:8 字符 + 大小写 + 数字 + 特殊
5. **审计链集成**:JWT userId 通过 `SET LOCAL` 传给 PG 触发器

## 验证标准

- [ ] `POST /auth/login` 返回 access + refresh token
- [ ] `POST /auth/refresh` rotation 正常(旧 token 失效)
- [ ] `POST /auth/mfa/enable` 返回 QR 码 + 备份码
- [ ] `POST /auth/mfa/verify` Google Authenticator 可验证
- [ ] `POST /auth/logout` 撤销 refresh token
- [ ] `@RequireRole()` 守卫生效(无权返回 403)
- [ ] JWT 签名用 RS256(非 HS256),公私钥分离
- [ ] MFA 强制:管理员登录必须验证 TOTP
- [ ] 性能:登录 P95 < 200ms
- [ ] CNAS 现场验证:审核员可看完整认证流程

## 相关决策

- ADR-0003: 审计链 SHA256
- ADR-0011: 贵金属检测业务约束

## 参考

- [RFC 7519 JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 6238 TOTP](https://www.rfc-editor.org/rfc/rfc6238)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Passport.js 文档](http://www.passportjs.org/)
- [NestJS Authentication 文档](https://docs.nestjs.com/security/authentication)
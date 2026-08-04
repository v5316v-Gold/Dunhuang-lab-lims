// =====================================================
// 认证 DTO(共享)
// =====================================================

export interface LoginRequest {
  username: string;
  password: string;
  totpCode?: string;
  useBackupCode?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaRequired: boolean;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    email: string;
    mfaEnabled: boolean;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TotpEnableResponse {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  backupCodes: string[];
}
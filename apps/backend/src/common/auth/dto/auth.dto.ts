// =====================================================
// 认证 DTO
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'zhang.san', description: '用户名' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @ApiProperty({ example: 'MySecure@Pass123', description: '密码' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: '123456', required: false, description: 'TOTP 码(若启用 MFA)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP 码必须为 6 位数字' })
  totpCode?: string;

  @ApiProperty({ example: false, required: false, description: '是否使用备份码' })
  @IsOptional()
  @IsBoolean()
  useBackupCode?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TotpVerifyDto {
  @ApiProperty({ example: '123456', description: 'TOTP 6 位码' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/, {
    message: '密码必须包含大小写字母、数字、特殊字符',
  })
  newPassword!: string;
}

export class LoginResponse {
  @ApiProperty({ description: 'Access Token(15 分钟)' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh Token(7 天)' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access Token 过期时间(秒)' })
  expiresIn!: number;

  @ApiProperty({ description: '是否需要 MFA 验证' })
  mfaRequired!: boolean;

  @ApiProperty({
    description: 'MFA 短期 token(5 分钟,仅敏感操作需要,Header X-MFA-Token)',
    required: false,
  })
  mfaToken?: string;

  @ApiProperty({ description: '当前用户信息' })
  user!: {
    id: string;
    username: string;
    name: string;
    role: string;
    email: string;
    mfaEnabled: boolean;
  };
}

export class MfaChallengeDto {
  @ApiProperty({ example: '123456', description: 'TOTP 6 位码' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ example: false, required: false, description: '是否使用备份码' })
  @IsOptional()
  @IsBoolean()
  useBackupCode?: boolean;
}

export class RegisterDto {
  @ApiProperty({ example: 'zhang.san', description: '用户名(字母数字点下划线,3-50)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: '用户名仅允许字母数字 . _ -' })
  username!: string;

  @ApiProperty({ example: 'MySecure@Pass123', description: '密码(大小写+数字+特殊字符,≥8)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/, {
    message: '密码必须包含大小写字母、数字、特殊字符',
  })
  password!: string;

  @ApiProperty({ example: '张三', description: '真实姓名' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'zhang.san@lims.local', description: '邮箱(唯一)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  email!: string;

  @ApiProperty({ required: false, description: '手机号(可选)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
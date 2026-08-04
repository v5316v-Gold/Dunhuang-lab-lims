// =====================================================
// 密码服务 - Argon2 哈希 + 密码策略
// 详见 ADR-0009
// =====================================================

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Argon2id 推荐参数
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  };

  /**
   * 哈希密码
   */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * 验证密码
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * 密码策略校验
   * - 至少 8 字符
   * - 必须包含大写、小写、数字、特殊字符
   */
  validatePolicy(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码至少 8 字符');
    }
    if (password.length > 128) {
      errors.push('密码最多 128 字符');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('密码必须包含数字');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    return { valid: errors.length === 0, errors };
  }
}
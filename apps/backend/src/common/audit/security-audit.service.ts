// =====================================================
// 系统/安全审计事件服务 — Phase 1 Task 2.1
// 架构映射: L2 审计要求(4 类事件补全: 用户/安全/系统/配置)
//
// 设计:
//   - 手动写入 audit_logs(action 带事件前缀,table_name 为事件域)
//   - 复用 SHA256 审计链(prev_hash/curr_hash 由链上最后一条衔接)
//   - 与 DB trigger 自动事件(audit_trigger)共存,互不干扰
//   - 写入失败仅记日志,不阻断业务(审计旁路)
// 适配: NestJS 10 + Prisma 5.22
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditEventTypeValue } from './audit-event.enum';

export interface AuditEventPayload {
  /** 事件类型(见 audit-event.enum) */
  event: AuditEventTypeValue;
  /** 业务域,写入 table_name(如 auth / rbac / system / config) */
  domain: string;
  /** 关联用户 ID(可为 null,如系统事件) */
  userId?: string | null;
  /** 用户名字符串(冗余存储,兼容审计链) */
  username?: string;
  /** 关联记录 ID(如被拒绝访问的资源) */
  recordId?: string | null;
  /** 事件详情(new_data JSONB) */
  detail?: Record<string, unknown>;
  /** 客户端 IP */
  ip?: string;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录一条系统/安全审计事件
   * 注意: 不阻断业务,失败仅告警
   */
  async record(payload: AuditEventPayload): Promise<void> {
    try {
      // 1. 取链上最后一条 curr_hash(与 DB trigger 相同算法)
      const last = await this.prisma.auditLog.findFirst({
        orderBy: { id: 'desc' },
        select: { currHash: true },
      });
      const prevHash = last?.currHash ?? '0000000000000000000000000000000000000000000000000000000000000000';
      const createdAt = new Date();

      // 2. 与 audit_trigger() 相同算法计算 SHA256(保证链语义一致)
      //    concat = prev_hash|user_id|username|action|table_name|record_id|new_data|created_at
      const newData = (payload.detail as object) ?? null;
      const concat =
        prevHash +
        '|' + (payload.userId ?? 'null') +
        '|' + (payload.username ?? 'null') +
        '|' + payload.event +
        '|' + payload.domain +
        '|' + (payload.recordId ?? '') +
        '|' + (newData ? JSON.stringify(newData) : '') +
        '|' + createdAt.toISOString();
      const currHash = createHash('sha256').update(concat).digest('hex');

      // 3. 写入 audit_logs(INSERT 允许,防篡改 trigger 只挡 UPDATE/DELETE/TRUNCATE)
      await this.prisma.auditLog.create({
        data: {
          userId: payload.userId ?? null,
          username: payload.username ?? 'system',
          action: payload.event,
          tableName: payload.domain,
          recordId: payload.recordId ?? null,
          newData: newData as object | undefined,
          prevHash,
          currHash,
          createdAt,
        },
      });
    } catch (e) {
      this.logger.error(`审计事件写入失败(不阻断业务): ${JSON.stringify(payload)}`, (e as Error).message);
    }
  }

  /**
   * 便捷方法: 记录安全事件(SECURITY:*)
   */
  async security(event: AuditEventTypeValue, detail: Record<string, unknown>, ip?: string): Promise<void> {
    await this.record({
      event,
      domain: 'security',
      username: 'system',
      detail: { ...detail, ip },
      ip,
    });
  }

  /**
   * 便捷方法: 记录系统事件(SYSTEM:*)
   */
  async system(event: AuditEventTypeValue, detail?: Record<string, unknown>): Promise<void> {
    await this.record({
      event,
      domain: 'system',
      username: 'system',
      detail,
    });
  }
}

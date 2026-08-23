// =====================================================
// 留样/记录保存期服务(W1 架构改进 — CNAS-CL01 §7.5.2)
// 默认值: sample 6 月, report 6 月, audit_log 永久
// 调用方: ReportService.transition 签发时,从 policy 读取留样期
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type RetentionEntityType = 'sample' | 'report' | 'audit_log' | 'qc_record' | 'equipment_record';

const DEFAULT_MONTHS: Record<RetentionEntityType, number> = {
  sample: 6,
  report: 6,
  audit_log: -1,  // 永久
  qc_record: 72,  // 6 年
  equipment_record: 180,  // 设备生命周期 + 5 年
};

@Injectable()
export class RetentionPolicyService implements OnModuleInit {
  private readonly logger = new Logger(RetentionPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 启动时 seed 默认策略(若表为空)
   */
  async onModuleInit(): Promise<void> {
    const count = await this.prisma.retentionPolicy.count();
    if (count > 0) return;
    const approverId = await this.getLabDirectorId();
    if (!approverId) {
      this.logger.warn('未找到实验室主任,跳过 RetentionPolicy seed');
      return;
    }
    const now = new Date();
    for (const entityType of Object.keys(DEFAULT_MONTHS) as RetentionEntityType[]) {
      await this.prisma.retentionPolicy.create({
        data: {
          entityType,
          retentionMonths: DEFAULT_MONTHS[entityType],
          archiveAfterMonths: 60,
          effectiveFrom: now,
          approvedById: approverId,
          description: '系统默认(CNAS §7.5.2 最低要求)',
        },
      });
    }
    this.logger.log(`已 seed ${Object.keys(DEFAULT_MONTHS).length} 条默认 RetentionPolicy`);
  }

  /**
   * 获取指定实体的留样期(月),-1 = 永久
   */
  async getMonths(entityType: RetentionEntityType): Promise<number> {
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: {
        entityType,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return policy?.retentionMonths ?? DEFAULT_MONTHS[entityType] ?? 6;
  }

  /**
   * 列表(供前端显示)
   */
  async findAll() {
    return this.prisma.retentionPolicy.findMany({
      orderBy: { entityType: 'asc' },
      include: { approvedBy: { select: { id: true, name: true } } },
    });
  }

  /**
   * 更新策略(实验室主任)
   */
  async update(entityType: string, retentionMonths: number, archiveAfterMonths: number, userId: string, description?: string) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: {
        entityType,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (existing) {
      // 关闭旧策略,创建新策略(版本化,避免改老数据)
      return this.prisma.$transaction(async (tx) => {
        await tx.retentionPolicy.update({
          where: { id: existing.id },
          data: { effectiveTo: new Date() },
        });
        return tx.retentionPolicy.create({
          data: {
            entityType,
            retentionMonths,
            archiveAfterMonths,
            effectiveFrom: new Date(),
            approvedById: userId,
            description,
          },
        });
      });
    }
    return this.prisma.retentionPolicy.create({
      data: { entityType, retentionMonths, archiveAfterMonths, effectiveFrom: new Date(), approvedById: userId, description },
    });
  }

  private async getLabDirectorId(): Promise<string | null> {
    // W1 框架阶段:无 LAB_DIRECTOR 时 fallback 到 ADMIN(允许系统管理员代为维护)
    // 待实验室主任账号正式就位后,自动切换到 LAB_DIRECTOR 角色
    const u = await this.prisma.user.findFirst({
      where: { role: { in: ['LAB_DIRECTOR', 'ADMIN'] }, status: 'ACTIVE' },
      orderBy: { role: 'asc' }, // ADMIN first → LAB_DIRECTOR 后建时优先
      select: { id: true },
    });
    return u?.id ?? null;
  }
}

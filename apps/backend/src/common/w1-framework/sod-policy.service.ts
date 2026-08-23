// =====================================================
// SoD 策略服务(W1 框架 — CNAS-CL01:2018 §7.8.4)
// 默认 STRICT(5 段 5 角色互斥);实验室主任可改为 RELAXED
// 策略变更走版本化:关闭旧策略,创建新策略(保留审计完整链)
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type SodMode = 'STRICT' | 'RELAXED';

@Injectable()
export class SodPolicyService implements OnModuleInit {
  private readonly logger = new Logger(SodPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 启动时 seed 默认 STRICT 策略(若表为空)
   */
  async onModuleInit(): Promise<void> {
    const count = await this.prisma.sodPolicy.count();
    if (count > 0) return;
    const approverId = await this.getLabDirectorId();
    if (!approverId) {
      this.logger.warn('未找到实验室主任/管理员,跳过 SodPolicy seed');
      return;
    }
    await this.prisma.sodPolicy.create({
      data: {
        mode: 'STRICT',
        applyToSampleTypes: [],
        effectiveFrom: new Date(),
        approvedById: approverId,
        description: '默认 SoD 策略:5 段 5 角色互斥(CNAS-CL01 §7.8.4 严格)',
      },
    });
    this.logger.log('已 seed 默认 SoD 策略:STRICT');
  }

  /** 列表 */
  async findAll() {
    return this.prisma.sodPolicy.findMany({
      orderBy: [{ effectiveFrom: 'desc' }],
      include: { approvedBy: { select: { id: true, name: true } } },
    });
  }

  /**
   * 更新策略(版本化:关闭旧,创建新)
   * 同时清掉签字人列表缓存(W2 SodService 解析时实时查 DB,无需缓存)
   */
  async update(id: string, mode: SodMode, applyToSampleTypes: string[], description: string | undefined, approverId: string) {
    const existing = await this.prisma.sodPolicy.findUnique({ where: { id } });
    if (!existing) {
      return this.prisma.sodPolicy.create({
        data: {
          mode,
          applyToSampleTypes,
          effectiveFrom: new Date(),
          approvedById: approverId,
          description,
        },
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.sodPolicy.update({
        where: { id },
        data: { effectiveTo: new Date() },
      });
      return tx.sodPolicy.create({
        data: {
          mode,
          applyToSampleTypes,
          effectiveFrom: new Date(),
          approvedById: approverId,
          description,
        },
      });
    });
  }

  /**
   * 获取当前生效的策略(已存在 — W2 SodService.check 直接调用这个)
   * 与 SodService 内部的简化版保持一致,统一暴露
   */
  async getActivePolicy(sampleType: string | null): Promise<{ id: string; mode: SodMode; applyToSampleTypes: string[] }> {
    const policies = await this.prisma.sodPolicy.findMany({
      where: {
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const matched = policies.find(p =>
      p.applyToSampleTypes.length === 0 || (!!sampleType && p.applyToSampleTypes.includes(sampleType)),
    );
    return matched
      ? { id: matched.id, mode: matched.mode as SodMode, applyToSampleTypes: matched.applyToSampleTypes }
      : { id: 'default-strict', mode: 'STRICT', applyToSampleTypes: [] };
  }

  private async getLabDirectorId(): Promise<string | null> {
    const u = await this.prisma.user.findFirst({
      where: { role: { in: ['LAB_DIRECTOR', 'ADMIN'] }, status: 'ACTIVE' },
      orderBy: { role: 'asc' },
      select: { id: true },
    });
    return u?.id ?? null;
  }
}

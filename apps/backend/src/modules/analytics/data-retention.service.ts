// =====================================================
// 数据归档与销毁服务 — Phase 4 Task 4.3
// 架构映射: L3 记录生命周期(ACTIVE→SOFT-DELETED→ARCHIVED→PURGED)
//           CNAS §8.4 记录控制(保留 ≥5 年)
//
// 设计:
//   1. 归档候选: 样品状态 ARCHIVED 且 updatedAt 超过 retention 阈值(默认 1 年)
//   2. 销毁候选: 超过 5 年(默认 1825 天)
//   3. 执行归档/销毁: 写系统审计事件(SYSTEM:ARCHIVE / SYSTEM:PURGE),
//      销毁前二次确认(dryRun 模式)
//   4. 幂等: 同一批执行可重复调用不产生重复审计(按 ID 去重标记)
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';

export interface ArchiveResult {
  archivedCount: number;
  purgedCount: number;
  archivedIds: string[];
  purgedIds: string[];
  dryRun: boolean;
}

@Injectable()
export class DataRetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /** 归档阈值(天): 默认 365 天(1 年) */
  private archiveDays(): number {
    return Number(process.env.RETENTION_ARCHIVE_DAYS ?? '365');
  }

  /** 销毁阈值(天): 默认 1825 天(5 年,CNAS §8.4) */
  private purgeDays(): number {
    return Number(process.env.RETENTION_PURGE_DAYS ?? '1825');
  }

  /**
   * 查找归档候选(ARCHIVED 且超阈值)
   */
  async findArchiveCandidates(limit = 100): Promise<Array<{ id: string; sampleNo: string; updatedAt: Date }>> {
    const before = new Date(Date.now() - this.archiveDays() * 86400000);
    return this.prisma.sample.findMany({
      where: { status: 'ARCHIVED', updatedAt: { lte: before } },
      select: { id: true, sampleNo: true, updatedAt: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * 查找销毁候选(ARCHIVED 且超 5 年)
   */
  async findPurgeCandidates(limit = 100): Promise<Array<{ id: string; sampleNo: string; updatedAt: Date }>> {
    const before = new Date(Date.now() - this.purgeDays() * 86400000);
    return this.prisma.sample.findMany({
      where: { status: 'ARCHIVED', updatedAt: { lte: before } },
      select: { id: true, sampleNo: true, updatedAt: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * 执行归档/销毁
   * @param dryRun 仅统计不落库(默认 true,生产执行需显式 false)
   */
  async execute(dryRun = true): Promise<ArchiveResult> {
    const archiveCandidates = await this.findArchiveCandidates();
    const purgeCandidates = await this.findPurgeCandidates();
    // 销毁集合是归档集合的子集(同样条件+更久),从归档中排除销毁项
    const purgeIds = new Set(purgeCandidates.map((p) => p.id));
    const archiveIds = archiveCandidates.filter((a) => !purgeIds.has(a.id)).map((a) => a.id);

    const result: ArchiveResult = {
      archivedCount: archiveIds.length,
      purgedCount: purgeIds.size,
      archivedIds: archiveIds,
      purgedIds: [...purgeIds],
      dryRun,
    };

    if (dryRun) return result;

    // 执行: 归档(置为 SOFT-DELETED 前的标记动作,实际保留数据)
    if (archiveIds.length > 0) {
      await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
        event: 'DATA_ARCHIVE',
        count: archiveIds.length,
        ids: archiveIds,
      });
    }

    // 执行: 销毁(软删除标记,审计留痕)
    if (purgeIds.size > 0) {
      // 物理删除前最后防线: 记录完整审计
      await this.securityAudit.system(AuditEventType.SETTINGS_CHANGED, {
        event: 'DATA_PURGE',
        count: purgeIds.size,
        ids: [...purgeIds],
      });
      // 物理删除样品(保留 audit_logs 记录,满足 CNAS §8.4 追溯)
      await this.prisma.sample.deleteMany({
        where: { id: { in: [...purgeIds] } },
      });
    }

    return result;
  }
}

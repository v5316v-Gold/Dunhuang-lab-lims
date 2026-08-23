// =====================================================
// 事件幂等服务(W1 架构改进)
// 监听器在执行前先查 ProcessedEvent.eventId,已处理则跳过
// 防止 qc.failed、SoD 违规告警等副作用事件被重复触发
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProcessedEventService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 检查事件是否已处理过
   */
  async isProcessed(eventId: string): Promise<boolean> {
    const record = await this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return !!record;
  }

  /**
   * 标记事件已处理(写入 ProcessedEvent 表)
   * 应在监听器副作用完成后调用
   */
  async markProcessed(eventId: string, eventName: string, listenerName: string): Promise<void> {
    await this.prisma.processedEvent.upsert({
      where: { eventId },
      create: { eventId, eventName, listenerName },
      update: {},
    });
  }

  /**
   * 清理过期事件(超过 30 天的事件 ID 不再需要判重)
   * 应由定时任务调用(W3 看板)
   */
  async cleanupExpired(days = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.prisma.processedEvent.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    return result.count;
  }
}

// =====================================================
// 仪器数据消费者 — 从 Redis Stream 拉取 → 落库 → Westgard 判断 → 审计
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditEventType } from '../../common/audit/audit-event.enum';
import { SecurityAuditService } from '../../common/audit/security-audit.service';
import { BusinessMetricsService } from '../../infrastructure/observability/business-metrics.service';

@Injectable()
export class InstrumentDataConsumer implements OnModuleInit {
  private readonly logger = new Logger(InstrumentDataConsumer.name);
  private running = false;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly securityAudit: SecurityAuditService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('INSTRUMENT_CONSUMER_ENABLED', 'true') !== 'true') {
      this.logger.warn('仪器数据消费者已禁用');
      return;
    }
    this.start().catch((e) => this.logger.error(`消费者启动失败: ${e.message}`));
  }

  private async start(): Promise<void> {
    this.running = true;
    this.logger.log('仪器数据消费者启动...');

    const consumerName = `backend-${process.pid}`;
    const streamKey = 'lims:instrument:data:stream';
    const group = 'lims-instrument-consumers';

    // 创建消费组(若不存在)
    try {
      await (this.redis as any).client.xgroup('CREATE', streamKey, group, '$', 'MKSTREAM');
    } catch (e: any) {
      if (!String(e.message).includes('BUSYGROUP')) {
        throw e;
      }
    }

    while (this.running) {
      try {
        const results = await (this.redis as any).client.xreadgroup(
          'GROUP', group, consumerName,
          'COUNT', 10,
          'BLOCK', 5000,
          'STREAMS', streamKey, '>',
        );

        if (!results) continue;

        for (const [, messages] of results as [string, [string, string[]][]][]) {
          for (const [id, fields] of messages) {
            await this.processMessage(id, fields);
            await (this.redis as any).client.xack(streamKey, group, id);
          }
        }
      } catch (e) {
        this.logger.error(`消费失败: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }

    const instrumentCode = obj.instrumentCode;
    const payload = JSON.parse(obj.payload);

    this.logger.debug(`处理消息 ${id} from ${instrumentCode}`);

    try {
      // 1. 审计:收到数据
      await this.securityAudit.system(AuditEventType.INSTRUMENT_DATA_RECEIVED, {
        instrumentCode,
        streamId: id,
        payloadSize: obj.payload.length,
      });

      // 2. 落库(简化:写到一个通用 Measurement 表)
      //    真实场景需要根据 payload.element / payload.value / payload.unit 路由到对应业务表
      //    这里假设仪器上报标准格式 { measurements: [{sampleId, element, value, unit}] }
      const measurements = (payload as any).measurements as Array<{
        sampleId?: string;
        element: string;
        value: number;
        unit: string;
      }> | undefined;

      if (!measurements?.length) {
        this.logger.warn(`消息 ${id} 无 measurements 字段`);
        return;
      }

      for (const m of measurements) {
        // TODO: 根据 sampleId 找到 SampleBatch + Test + 触发 Westgard
        // 这里只审计 + 计数
        await this.securityAudit.system(AuditEventType.QC_MEASUREMENT_RECORDED, {
          instrumentCode,
          sampleId: m.sampleId,
          element: m.element,
          value: m.value,
          unit: m.unit,
          streamId: id,
        });
      }

      // 3. 业务指标(原子进 counter)
      for (const m of measurements) {
        this.businessMetrics.incSampleReceived(m.element, instrumentCode);
      }
    } catch (e) {
      this.logger.error(`处理消息 ${id} 失败: ${(e as Error).message}`);
      await this.securityAudit.system(AuditEventType.INSTRUMENT_DATA_REJECTED, {
        instrumentCode,
        streamId: id,
        reason: (e as Error).message,
      });
    }
  }

  stop(): void {
    this.running = false;
  }
}

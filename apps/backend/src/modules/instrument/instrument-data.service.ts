// =====================================================
// 仪器数据服务 — 入 Redis Stream + 签名计算
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import { RedisService } from '../../infrastructure/redis/redis.service';

export interface InstrumentDataEnvelope {
  instrumentId: string;
  instrumentCode: string;
  receivedAt: Date;
  payload: Record<string, unknown>;
}

@Injectable()
export class InstrumentDataService {
  private readonly logger = new Logger(InstrumentDataService.name);
  private readonly streamKey = 'lims:instrument:data:stream';
  private readonly consumerGroup = 'lims-instrument-consumers';
  private readonly maxLen = 100000;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 入 Redis Stream(异步消费)
   */
  async enqueue(env: InstrumentDataEnvelope): Promise<string> {
    const fields: Record<string, string> = {
      instrumentId: env.instrumentId,
      instrumentCode: env.instrumentCode,
      receivedAt: env.receivedAt.toISOString(),
      payload: JSON.stringify(env.payload),
    };

    // ioredis xadd 签名:xadd(key, '*', field1, value1, field2, value2, ...)
    const streamId = await this.redis.getClient().xadd(
      this.streamKey,
      'MAXLEN', '~', this.maxLen.toString(),
      '*',
      ...Object.entries(fields).flatMap(([k, v]) => [k, v]),
    );

    this.logger.debug(`仪器 ${env.instrumentCode} 数据入队: ${streamId}`);
    return streamId as string;
  }

  /**
   * 签名(payload + timestamp + 共享密钥)
   */
  async computeSignature(payload: string, timestamp: string, secret: string): Promise<string> {
    const sig = createHash('sha256')
      .update(payload)
      .update(timestamp)
      .update(secret)
      .digest('hex');
    return sig;
  }
}

// =====================================================
// 原始记录单模块 — W4-B (CNAS §7.5 记录控制)
// =====================================================

import { Module, OnModuleInit, Logger } from '@nestjs/common';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEvents, TestCompletedEvent } from '../../common/events/domain-events';
import { RawRecordController } from './raw-record.controller';
import { RawRecordSheetService } from './raw-record.service';

@Module({
  controllers: [RawRecordController],
  providers: [RawRecordSheetService],
  exports: [RawRecordSheetService],
})
export class RawRecordModule implements OnModuleInit {
  private readonly logger = new Logger(RawRecordModule.name);

  constructor(
    private readonly rawRecordService: RawRecordSheetService,
    private readonly eventBus: DomainEventBus,
  ) {}

  /**
   * W4-C: 订阅 TEST_COMPLETED → 自动生成原始记录单(幂等)
   * 检测完成(ICP/火试金)→ 无需前端手动调 /raw-records/generate
   */
  onModuleInit() {
    this.eventBus.on<TestCompletedEvent>(DomainEvents.TEST_COMPLETED, async (event) => {
      try {
        const sheet = await this.rawRecordService.generateForTest(event.payload.testId);
        this.logger.log(`✓ W4-C 自动联动: 检测 ${event.payload.testId} 完成 → 原始记录单 ${sheet.sheetNo} 已生成`);
      } catch (e) {
        // 失败不传播:原始记录单可后续手动调 /raw-records/generate 补救
        this.logger.warn(`W4-C 自动联动失败(检测 ${event.payload.testId}): ${(e as Error).message}`);
      }
    });
    this.logger.log('RawRecordModule: subscribed to TEST_COMPLETED');
  }
}

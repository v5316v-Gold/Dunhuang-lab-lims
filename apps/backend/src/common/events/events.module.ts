// =====================================================
// 领域事件模块(全局)— 提供 DomainEventBus
// =====================================================

import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus';

@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}

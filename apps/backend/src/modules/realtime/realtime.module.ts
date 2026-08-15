// =====================================================
// W5 Realtime Module
// =====================================================

import { Module, Global } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeBus } from './realtime.bus';

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeBus],
  exports: [RealtimeBus],
})
export class RealtimeModule {}
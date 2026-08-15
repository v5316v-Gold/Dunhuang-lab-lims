// =====================================================
// 状态机 Module(全局)
// =====================================================

import { Global, Module } from '@nestjs/common';
import { StateMachineService } from './state-machine.service';

@Global()
@Module({
  providers: [StateMachineService],
  exports: [StateMachineService],
})
export class StateMachineModule {}
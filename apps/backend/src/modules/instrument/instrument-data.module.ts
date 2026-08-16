// =====================================================
// 检测仪器数据对接模块 — Phase 0.5 / P1-5
// 详见 docs/05-DEPLOYMENT.md §仪器对接
//
// 接收流程:
//   1. 仪器通过 mTLS 客户端证书 POST /api/v1/instruments/data
//   2. 校验证书 + 解析 CSV/JSON
//   3. 落 Redis Stream(异步解耦)
//   4. Worker 消费,落 Measurement + 触发 Westgard 判断 + 审计
//
// 安全:
//   - mTLS(用 deploy/ca/gen-client-cert.sh 给仪器签证书)
//   - 载荷 SHA-256 签名防重放 + 篡改
//   - 仪器白名单(只接收已注册设备)
// =====================================================

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { InstrumentDataController } from './instrument-data.controller';
import { InstrumentDataService } from './instrument-data.service';
import { InstrumentDataConsumer } from './instrument-data.consumer';
import { InstrumentRegistryService } from './instrument-registry.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [InstrumentDataController],
  providers: [InstrumentDataService, InstrumentDataConsumer, InstrumentRegistryService],
  exports: [InstrumentDataService, InstrumentRegistryService],
})
export class InstrumentDataModule {}

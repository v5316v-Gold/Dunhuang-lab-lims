// =====================================================
// 敦煌金质检 LIMS - 根模块
// 详见 docs/01-ARCHITECTURE.md §3 后端架构
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

// 基础设施层
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './common/auth/auth.module';
import { EventsModule } from './common/events/events.module';
import { LoggerModule } from './common/logger/logger.module';
import { StateMachineModule } from './common/state-machine/state-machine.module';
import { W1FrameworkModule } from './common/w1-framework/w1-framework.module';
import { HealthModule } from './infrastructure/health/health.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { MetricsModule } from './infrastructure/observability/metrics.module';

// 公共模块
import { SignatureModule } from './common/signature/signature.module';
import { QrCodeModule } from './common/qrcode/qrcode.module';

// 业务模块
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthorizedSignatoryModule } from './modules/authorized-signatory/authorized-signatory.module';
import { BatchModule } from './modules/batch/batch.module';
import { EhsModule } from './modules/ehs/ehs.module';
import { PreciousMetalModule } from './modules/precious-metal/precious-metal.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InstrumentDataModule } from './modules/instrument/instrument-data.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { QcModule } from './modules/qc/qc.module';
import { ReagentModule } from './modules/reagent/reagent.module';
import { ReportModule } from './modules/report/report.module';
import { SampleModule } from './modules/sample/sample.module';
import { TestModule } from './modules/test/test.module';
import { SopModule } from './modules/test/sop/sop.module';

@Module({
  imports: [
    // ============================================
    // 1. 配置(单一真源)
    // ============================================
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),

    // ============================================
    // 2. 限流(CNAS 安全要求)
    // ============================================
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // ============================================
    // 3. 基础设施层
    // ============================================
    TerminusModule,
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    LoggerModule,
    StateMachineModule,
    PrismaModule,
    RedisModule,
    MinioModule,
    QueueModule,
    MetricsModule,
    HealthModule,

    // ============================================
    // 4. 公共模块(横切关注点)
    // ============================================
    AuthModule,
    AuditModule,
    EventsModule,
    SignatureModule,
    W1FrameworkModule,
    QrCodeModule,

    // ============================================
    // 5. 业务模块(11 域)
    // ============================================
    IdentityModule,
    PersonnelModule,
    EquipmentModule,
    SampleModule,
    BatchModule,
    TestModule,
    SopModule,
    QcModule,
    ReportModule,
    AuthorizedSignatoryModule,
    ReagentModule,
    EhsModule,
    PreciousMetalModule,
    RealtimeModule,
    InstrumentDataModule,
    ComplianceModule,
    AnalyticsModule,
  ],
  providers: [
    // 全局限流守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
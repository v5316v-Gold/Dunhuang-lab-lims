// =====================================================
// 敦煌金质检 LIMS - 根模块
// 详见 docs/01-ARCHITECTURE.md §3 后端架构
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ClsModule } from 'nestjs-cls';

// 基础设施层
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { HealthModule } from './infrastructure/health/health.module';

// 公共模块
import { AuthModule } from './common/auth/auth.module';
import { AuditModule } from './common/audit/audit.module';
import { LoggerModule } from './common/logger/logger.module';

// 业务模块
import { IdentityModule } from './modules/identity/identity.module';
import { SampleModule } from './modules/sample/sample.module';
import { BatchModule } from './modules/batch/batch.module';
import { TestModule } from './modules/test/test.module';
import { QcModule } from './modules/qc/qc.module';
import { ReportModule } from './modules/report/report.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { ReagentModule } from './modules/reagent/reagent.module';
import { EhsModule } from './modules/ehs/ehs.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

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
    PrismaModule,
    RedisModule,
    MinioModule,
    QueueModule,
    HealthModule,

    // ============================================
    // 4. 公共模块(横切关注点)
    // ============================================
    AuthModule,
    AuditModule,

    // ============================================
    // 5. 业务模块(11 域)
    // ============================================
    IdentityModule,
    PersonnelModule,
    EquipmentModule,
    SampleModule,
    BatchModule,
    TestModule,
    QcModule,
    ReportModule,
    ReagentModule,
    EhsModule,
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
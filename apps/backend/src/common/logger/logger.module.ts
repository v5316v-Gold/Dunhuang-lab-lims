// =====================================================
// 日志模块 - Pino 集成
// =====================================================

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        customProps: () => ({ app: 'dunhuang-lims', env: process.env.NODE_ENV }),
      },
    }),
  ],
  providers: [
    LoggingInterceptor,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [LoggingInterceptor],
})
export class LoggerModule {}
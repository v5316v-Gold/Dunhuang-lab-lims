// =====================================================
// 敦煌金质检 LIMS - 应用入口
// 详见 docs/01-ARCHITECTURE.md
// =====================================================

// 必须最先加载 dotenv,否则 Prisma 客户端构造时拿不到 DATABASE_URL
import * as dotenv from 'dotenv';

import * as path from 'path';
// 兜底多个候选路径,兼容 dev (src) / build (dist) / monorepo
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];
for (const p of envCandidates) {
  dotenv.config({ path: p });
}

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AuditEventType } from './common/audit/audit-event.enum';
import { SecurityAuditService } from './common/audit/security-audit.service';
import { AuditContextInterceptor } from './common/audit/audit-context.interceptor';
import { installBigIntReplacer } from './common/filters/bigint-replacer';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpMetricsInterceptor } from './infrastructure/observability/http-metrics.interceptor';
import { assertEnv } from './config/env.schema';

async function bootstrap() {
  // Phase 0.5 Task A: 全局 BigInt JSON 序列化(audit_logs.id / file.size 等)
  installBigIntReplacer();

  // Phase 1 Task 2.3: 启动前环境变量校验(缺失/占位符/生产强度)
  // 校验失败即退出,避免"静默用默认值"导致生产事故
  if (!assertEnv()) {
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('APP_PORT', 3000);
  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const globalPrefix = config.get<string>('API_GLOBAL_PREFIX', '');

  // 安全:Helmet 安全响应头
  app.use(helmet());

  // Cookie 解析
  app.use(cookieParser());

  // API 前缀(可选)
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // API 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: `${apiPrefix}/v`,
  });

  // 全局 DTO 校验(class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器(从容器中获取,实现依赖注入)
  const loggingInterceptor = app.get(LoggingInterceptor);
  const auditContextInterceptor = app.get(AuditContextInterceptor);
  const httpMetricsInterceptor = app.get(HttpMetricsInterceptor);
  app.useGlobalInterceptors(loggingInterceptor, auditContextInterceptor, httpMetricsInterceptor);

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('敦煌金质检 LIMS API')
    .setDescription(
      'CNAS 合规实验室信息管理系统 API\n' +
        '业务:贵金属(黄金)检测 —— 火试金法 + ICP\n' +
        '合规:ISO 17025 + CNAS-CL01 + 21 CFR Part 11\n' +
        '数据完整性:ALCOA+ 9 原则',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT 访问令牌(15 分钟有效)',
      },
      'access-token',
    )
    .addTag('auth', '认证(登录/MFA/Token)')
    .addTag('users', '用户管理')
    .addTag('departments', '部门管理')
    .addTag('samples', '样品管理')
    .addTag('batches', '批次管理(火试金/ICP)')
    .addTag('tests', '检测任务')
    .addTag('qc', '质量控制(Westgard/6σ)')
    .addTag('reports', '检测报告(多级审核/电子签名)')
    .addTag('equipment', '设备管理')
    .addTag('personnel', '人员/培训/能力')
    .addTag('reagents', '试剂/耗材/库存')
    .addTag('ehs', 'EHS 隐患/应急')
    .addTag('analytics', '数据分析/趋势')
    .addTag('audit-logs', '审计日志(SHA256 链)')
    .addTag('health', '健康检查')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // 根路径友好指引:直接访问 3030 端口时显示中文入口页(而非 404 JSON)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req: any, res: any) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>敦煌金质检 LIMS · 后端服务</title>
<style>
  body { background:#08080a; color:#e8e6e3; font-family:"Microsoft YaHei",sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#121216; border:1px solid rgba(212,175,55,.3); border-radius:12px; padding:40px 48px; max-width:520px; }
  h1 { color:#d4af37; font-size:22px; margin:0 0 8px; }
  p { color:#a8a6a1; line-height:1.8; margin:8px 0; }
  a { color:#d4af37; }
  .links { margin-top:16px; }
  .links a { display:inline-block; background:rgba(212,175,55,.08); border:1px solid rgba(212,175,55,.35); border-radius:6px; padding:8px 16px; margin:4px 8px 4px 0; text-decoration:none; }
</style>
</head>
<body>
<div class="card">
  <h1>敦煌金质检 LIMS · 后端 API 服务</h1>
  <p>这是后端 API 服务端口(3030),不是前台页面入口。</p>
  <p>请通过前端系统访问业务功能:</p>
  <div class="links">
    <a href="http://127.0.0.1:5173/">→ 打开前端系统(5173)</a>
    <a href="/api/docs">API 文档(Swagger)</a>
    <a href="/health/ready">健康检查</a>
  </div>
  <p style="font-size:12px;color:#6d6b66;">CNAS-CL01:2018 / ISO 17025 · 数据完整性 ALCOA+ · 内部系统请勿外传</p>
</div>
</body>
</html>`);
  });

  // 优雅关闭
  app.enableShutdownHooks();

  await app.listen(port);

  // Phase 1 Task 2.1: 系统启动审计事件(SYSTEM:START)
  try {
    const securityAudit = app.get(SecurityAuditService);
    await securityAudit.system(AuditEventType.SYSTEM_START, {
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
    });
  } catch (e) {
    // 审计写入失败不阻断启动
    console.warn('系统启动审计写入失败(不阻断):', (e as Error).message);
  }

  // eslint-disable-next-line no-console
  console.info(`🚀 敦煌金质检 LIMS 后端启动成功`);
  // eslint-disable-next-line no-console
  console.info(`📚 Swagger UI: http://localhost:${port}/${apiPrefix}/docs`);
  // eslint-disable-next-line no-console
  console.info(`🏥 Health:    http://localhost:${port}/health`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ 启动失败:', err);
  process.exit(1);
});
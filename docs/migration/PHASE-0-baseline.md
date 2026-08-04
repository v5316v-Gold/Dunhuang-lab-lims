# Phase 0:基座校准(第 1 周)

> **周期**: 2026-08-11 ~ 2026-08-17(5 工作日 + 2 周末)
> **目标**: 项目骨架可运行,全栈可启动,CI/CD 跑通
> **业务约束**: 无(本阶段不涉及业务代码)
> **负责人**: 天枢(架构师 + 全栈)+ 菩提老祖(决策)+ 后端 + 前端 + DevOps

## 1. 任务清单

### Day 1-2:Monorepo 初始化

- [ ] **Task 0.1**: 初始化 pnpm workspace
  ```bash
  cd Dunhuang-lab-lims-main
  # 创建 pnpm-workspace.yaml
  cat > pnpm-workspace.yaml <<'EOF'
  packages:
    - 'apps/*'
    - 'packages/*'
  EOF

  # 创建 turbo.json
  cat > turbo.json <<'EOF'
  {
    "$schema": "https://turbo.build/schema.json",
    "pipeline": {
      "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
      "dev":   { "cache": false },
      "lint":  {},
      "test":  { "dependsOn": ["build"] },
      "clean": {}
    }
  }
  EOF

  pnpm install
  ```

- [ ] **Task 0.2**: 创建 5 个工作区包骨架
  ```bash
  mkdir -p apps/backend apps/frontend
  mkdir -p packages/shared-types packages/ui-kit packages/compliance-core packages/config
  ```

- [ ] **Task 0.3**: 初始化根 `package.json`
  ```json
  {
    "name": "dunhuang-lims",
    "version": "1.0.0",
    "private": true,
    "packageManager": "pnpm@9.0.0",
    "scripts": {
      "build": "turbo run build",
      "dev": "turbo run dev",
      "lint": "turbo run lint",
      "test": "turbo run test",
      "clean": "turbo run clean"
    },
    "devDependencies": {
      "turbo": "^2.0.0",
      "typescript": "^5.4.0",
      "@types/node": "^20.12.0"
    }
  }
  ```

- [ ] **Task 0.4**: 创建根 `.gitignore`(过滤 node_modules / dist / .turbo)
- [ ] **Task 0.5**: 创建 `tsconfig.base.json`(严格模式)
- [ ] **Task 0.6**: 创建 `.eslintrc.cjs` + `.prettierrc`(ESLint 强约束依赖方向)
- [ ] **Task 0.7**: 创建 `.env.example`(所有环境变量清单)

### Day 3-4:NestJS 骨架 + React 骨架

- [ ] **Task 0.8**: 初始化 NestJS 后端
  ```bash
  cd apps/backend
  pnpm init
  pnpm add @nestjs/core @nestjs/common @nestjs/platform-express
  pnpm add -D @nestjs/cli @nestjs/testing typescript ts-node @types/node
  npx nest new . --skip-git --package-manager pnpm
  ```

- [ ] **Task 0.9**: 初始化 React 前端(Vite + React 18 + TS)
  ```bash
  cd apps/frontend
  pnpm create vite . --template react-ts
  pnpm install
  pnpm add antd @ant-design/icons
  pnpm add @tanstack/react-query zustand zod react-router-dom
  pnpm add -D eslint-plugin-react-hooks
  ```

- [ ] **Task 0.10**: 创建后端模块骨架(`src/modules/identity` 空模块)
- [ ] **Task 0.11**: 创建前端视图骨架(`src/views/login.tsx` + `src/containers/`)
- [ ] **Task 0.12**: 创建 `packages/shared-types` 占位包(导出空 `index.ts`)

### Day 5:Docker Compose + CI

- [ ] **Task 0.13**: 创建根 `docker-compose.yml`(开发环境)
  ```yaml
  version: '3.9'
  services:
    postgres:
      image: timescale/timescaledb:latest-pg16
      container_name: dunhuang-pg
      environment:
        POSTGRES_DB: dunhuang_lims
        POSTGRES_USER: dunhuang
        POSTGRES_PASSWORD: ${PG_PASSWORD}
      ports:
        - '5432:5432'
      volumes:
        - pgdata:/var/lib/postgresql/data
        - ./infrastructure/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

    redis:
      image: redis:7-alpine
      container_name: dunhuang-redis
      ports:
        - '6379:6379'

    minio:
      image: minio/minio:latest
      container_name: dunhuang-minio
      command: server /data --console-address ":9001"
      environment:
        MINIO_ROOT_USER: minio
        MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
      ports:
        - '9000:9000'
        - '9001:9001'

    rabbitmq:
      image: rabbitmq:3-management-alpine
      container_name: dunhuang-mq
      ports:
        - '5672:5672'
        - '15672:15672'

    prometheus:
      image: prom/prometheus:latest
      container_name: dunhuang-prom
      ports:
        - '9090:9090'
      volumes:
        - ./infrastructure/docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

    grafana:
      image: grafana/grafana:latest
      container_name: dunhuang-grafana
      ports:
        - '3001:3000'

  volumes:
    pgdata:
  ```

- [ ] **Task 0.14**: 创建 `infrastructure/docker/postgres/init.sql`(启用 TimescaleDB)
  ```sql
  CREATE EXTENSION IF NOT EXISTS timescaledb;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  ```

- [ ] **Task 0.15**: 创建 GitHub Actions CI(`.github/workflows/ci.yml`)
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
          with: { version: 9 }
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm turbo run lint
        - run: pnpm turbo run build
        - run: pnpm turbo run test
  ```

- [ ] **Task 0.16**: 创建 `.github/workflows/cd-staging.yml`(CD 模板,Phase 4 再启用)
- [ ] **Task 0.17**: 创建 `README.md`(更新入口)
- [ ] **Task 0.18**: 创建 `CONTRIBUTING.md`(开发规范)

## 2. 交付物清单

| 类别 | 文件 |
|---|---|
| **根配置** | `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.gitignore`、`.eslintrc.cjs`、`.prettierrc`、`.env.example`、`docker-compose.yml` |
| **后端** | `apps/backend/package.json`、`apps/backend/src/main.ts`、`apps/backend/src/app.module.ts`、`apps/backend/nest-cli.json` |
| **前端** | `apps/frontend/package.json`、`apps/frontend/vite.config.ts`、`apps/frontend/src/main.tsx`、`apps/frontend/src/App.tsx` |
| **共享包** | `packages/shared-types/package.json`、`packages/shared-types/src/index.ts`、`packages/ui-kit/package.json`、`packages/compliance-core/package.json`、`packages/config/package.json` |
| **基础设施** | `infrastructure/docker/postgres/init.sql`、`infrastructure/docker/prometheus/prometheus.yml` |
| **CI/CD** | `.github/workflows/ci.yml`、`.github/workflows/cd-staging.yml` |
| **文档** | `README.md`、`CONTRIBUTING.md` |

## 3. 验证标准

### 功能验证

- [ ] **V-0.1**: `pnpm install` 一次安装全部依赖,无错误
- [ ] **V-0.2**: `pnpm dev` 同时启动后端(3000) + 前端(5173)
- [ ] **V-0.3**: `pnpm -F @dunhuang/lims-backend dev` 可单独启动后端
- [ ] **V-0.4**: `pnpm -F @dunhuang/lims-frontend dev` 可单独启动前端
- [ ] **V-0.5**: `docker compose up -d` 拉起 PG + Redis + MinIO + RabbitMQ + Prometheus + Grafana
- [ ] **V-0.6**: `psql -h localhost -U dunhuang -d dunhuang_lims` 可连接 PG,`\dx` 能看到 timescaledb 扩展

### CI 验证

- [ ] **V-0.7**: 推送 PR 触发 GitHub Actions CI,3 个任务(lint / build / test)全部 ✅
- [ ] **V-0.8**: Turbo 缓存命中(`pnpm turbo run build --summarize` 查看)

### 代码质量

- [ ] **V-0.9**: ESLint 0 error(包括依赖方向约束)
- [ ] **V-0.10**: TypeScript strict 模式 0 error(`tsc --noEmit`)

### 文档

- [ ] **V-0.11**: `README.md` 含 Quick Start 5 分钟启动指南
- [ ] **V-0.12**: `CONTRIBUTING.md` 含依赖方向、命名规范、PR 流程

## 4. 防御性兜底

| 坑点 | 影响 | 预防 |
|---|---|---|
| pnpm 镜像源被墙 | 安装失败 | 配置 `.npmrc` 使用 npmmirror 镜像 |
| Docker Desktop 内存不足 | 容器起不来 | 配置 4GB 内存 |
| TimescaleDB 镜像体积大 | 拉镜像慢 | 用 `timescale/timescaledb-ha` 或缓存到本地 registry |
| Node 版本不一致 | 构建失败 | `.nvmrc` 锁定 Node 20 LTS |
| TypeScript 装饰器配置 | NestJS 报错 | `tsconfig.json` 启用 `experimentalDecorators: true` |
| Vite + NestJS 跨域 CORS | 联调失败 | 后端启用 `@nestjs/platform-fastify` + CORS,或开发用 Vite proxy |
| GitHub Actions 缓存失效 | CI 慢 | 启用 `cache: pnpm` |
| 端口冲突 | 启动失败 | docker-compose 端口可配,`.env` 集中管理 |

## 5. 下阶段交付

Phase 0 完成后,进入 [Phase 1:基础设施](./PHASE-1-infra.md)
# LIMS Template

FastAPI + PostgreSQL 单体架构实验室信息管理系统（LIMS）模板。

## 技术栈

| 层级 | 技术 |
|------|------|
| Web框架 | FastAPI 0.115+ (异步) |
| ORM | SQLAlchemy 2.0 (async) |
| 数据库 | PostgreSQL 16 + asyncpg |
| 迁移 | Alembic |
| 验证 | Pydantic v2 |
| 认证 | JWT (python-jose) + Argon2 |
| 限流 | slowapi |
| 缓存 | Redis |

## 快速启动

### 1. 复制环境配置

```bash
cp .env.example .env
# 编辑 .env，修改 SECRET_KEY 为强随机值
```

### 2. 启动基础设施（Docker）

```bash
cd docker
docker-compose up -d postgres redis
```

### 3. 安装依赖

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
# macOS/Linux: source .venv/bin/activate

pip install -e ".[dev]"
```

### 4. 运行迁移

```bash
alembic upgrade head
```

### 5. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:8000/docs 查看 OpenAPI 文档。

## 项目结构

```
lims-template/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # pydantic-settings 配置
│   ├── api/
│   │   ├── deps.py          # 依赖注入（get_db, get_current_user）
│   │   └── v1/
│   │       ├── router.py    # 路由汇总
│   │       └── endpoints/   # 业务接口
│   ├── core/
│   │   ├── exceptions.py    # 全局异常
│   │   └── security.py     # JWT + 密码哈希
│   ├── db/
│   │   ├── base.py          # DeclarativeBase
│   │   └── session.py       # 异步Session
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic 请求/响应模型
│   └── services/            # 业务服务层
├── migrations/              # Alembic 迁移
├── docker/                  # Docker 配置
├── pyproject.toml
├── alembic.ini
└── .env.example
```

## API 概览

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/login` | 登录 |
| 认证 | `POST /api/v1/auth/register` | 注册 |
| 认证 | `GET /api/v1/auth/me` | 当前用户 |
| 样品 | `POST /api/v1/samples` | 创建样品 |
| 样品 | `GET /api/v1/samples` | 样品列表 |
| 样品 | `GET /api/v1/samples/{id}` | 样品详情 |
| 样品 | `PATCH /api/v1/samples/{id}` | 更新样品 |
| 样品 | `POST /api/v1/samples/{id}/assign` | 分配样品 |
| 样品 | `POST /api/v1/samples/{id}/status` | 状态流转 |
| 任务 | `POST /api/v1/assignments` | 创建检测任务 |
| 任务 | `GET /api/v1/assignments` | 任务列表 |
| 任务 | `POST /api/v1/assignments/{id}/start` | 开始任务 |
| 任务 | `POST /api/v1/assignments/{id}/complete` | 完成任务 |
| 结果 | `POST /api/v1/results` | 提交检测结果 |
| 结果 | `PUT /api/v1/results/{id}` | 修改结果（需填原因）|
| 结果 | `POST /api/v1/results/{id}/verify` | 审核结果 |
| 结果 | `POST /api/v1/results/{id}/lock` | 锁定结果 |

## 角色权限

| 角色 | 说明 | 权限 |
|------|------|------|
| ADMIN | 系统管理员 | 全权限 |
| QA_MANAGER | 质量经理 | 结果审核/签发 |
| LAB_MANAGER | 实验室主任 | 样品分配/方法管理 |
| TECHNICIAN | 实验员 | 执行检测/结果录入 |
| SAMPLER | 采样员 | 样品登记 |
| CLIENT | 委托方 | 仅查看自家报告 |
| AUDITOR | 审计员 | 只读+审计日志 |

## 开发命令

```bash
# 运行测试
pytest

# 代码检查
ruff check app/

# 自动修复
ruff check app/ --fix

# 类型检查
mypy app/
```

## 生产部署

```bash
cd docker
docker-compose -f docker-compose.yml up -d --build
```

## 下一步

1. ✅ 先跑起来，确认 API 通
2. 📋 补充 TestItem 初始化数据（检测方法目录）
3. 🔐 实现 LDAP/SSO 集成
4. 📝 实现报告生成（PDF）
5. 🔌 仪器接口对接（HTTP/TCP 适配器）
6. 📊 Dashboard 统计接口
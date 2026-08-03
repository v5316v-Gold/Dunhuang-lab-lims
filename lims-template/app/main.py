# ============================================================
# LIMS System - FastAPI Application Entry Point
# ============================================================
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.v1 import router as v1_router
from app.config import settings
from app.db.session import engine
from app.core.exceptions import LIMSException, NotFoundError, PermissionDeniedError


# -----------------------------------------------
# Rate Limiter
# -----------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# -----------------------------------------------
# Lifespan - startup / shutdown
# -----------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (dev only), warm up connections
    yield
    # Shutdown: dispose engine
    await engine.dispose()


# -----------------------------------------------
# FastAPI App
# -----------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Laboratory Information Management System (LIMS)",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(LIMSException)
async def lims_exception_handler(request: Request, exc: LIMSException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# -----------------------------------------------
# Routers
# -----------------------------------------------
app.include_router(v1_router, prefix="/api/v1")


# -----------------------------------------------
# Health Check
# -----------------------------------------------
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/ready", tags=["System"])
async def ready():
    # TODO: check DB connectivity before returning 200
    return {"status": "ready"}
"""
API v1 router - aggregates all endpoints
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, samples, assignments, test_results

router = APIRouter()

router.include_router(auth.router)
router.include_router(samples.router)
router.include_router(assignments.router)
router.include_router(test_results.router)
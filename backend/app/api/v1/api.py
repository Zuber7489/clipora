from fastapi import APIRouter
from backend.app.api.v1.endpoints import health, projects, clips, jobs

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(clips.router, prefix="/clips", tags=["Clips"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])

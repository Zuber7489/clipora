from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.models.entities import ProcessingJob
from backend.app.schemas.job import ProcessingJobResponse

router = APIRouter()

@router.get("/project/{project_id}", response_model=List[ProcessingJobResponse])
async def get_project_jobs(project_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves all processing jobs for a given project, ordered newest first."""
    result = await db.execute(
        select(ProcessingJob)
        .where(ProcessingJob.project_id == project_id)
        .order_by(ProcessingJob.started_at.desc().nullslast(), ProcessingJob.id.desc())
    )
    jobs = result.scalars().all()
    return jobs

@router.get("/{job_id}", response_model=ProcessingJobResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves a specific processing job by its job ID."""
    result = await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Processing job {job_id} not found."
        )
    return job

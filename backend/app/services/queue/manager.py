import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.entities import ProcessingJob

logger = logging.getLogger(__name__)

class JobQueueManager:
    """
    Durable, database-backed task queue manager supporting:
    - Atomic worker leasing
    - Worker heartbeats
    - Orphan job recovery on server restart
    - Status reporting
    """

    @classmethod
    async def enqueue_job(
        cls,
        db: AsyncSession,
        job_type: str,
        project_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        max_retries: int = 3
    ) -> ProcessingJob:
        job = ProcessingJob(
            id=str(uuid.uuid4()),
            project_id=project_id,
            job_type=job_type,
            status="queued",
            current_step="Queued for processing",
            progress_percentage=0,
            payload=payload or {},
            retry_count=0,
            max_retries=max_retries,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        logger.info(f"Enqueued job {job.id} (type={job_type}, project={project_id})")
        return job

    @classmethod
    async def claim_next_job(
        cls,
        db: AsyncSession,
        worker_id: str,
        job_type: Optional[str] = None
    ) -> Optional[ProcessingJob]:
        query = select(ProcessingJob).where(ProcessingJob.status == "queued")
        if job_type:
            query = query.where(ProcessingJob.job_type == job_type)
        query = query.order_by(ProcessingJob.created_at.asc()).limit(1)

        result = await db.execute(query)
        job = result.scalar_one_or_none()
        if not job:
            return None

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        job.status = "processing"
        job.locked_by = worker_id
        job.locked_at = now
        job.heartbeat_at = now
        job.started_at = now
        job.current_step = "Processing started"
        job.updated_at = now

        await db.commit()
        await db.refresh(job)
        logger.info(f"Worker {worker_id} claimed job {job.id}")
        return job

    @classmethod
    async def heartbeat(cls, db: AsyncSession, job_id: str, worker_id: str) -> bool:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = (
            update(ProcessingJob)
            .where(and_(ProcessingJob.id == job_id, ProcessingJob.locked_by == worker_id))
            .values(heartbeat_at=now, updated_at=now)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @classmethod
    async def update_progress(
        cls,
        db: AsyncSession,
        job_id: str,
        progress: int,
        step: str
    ) -> None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = (
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .values(progress_percentage=progress, current_step=step, updated_at=now)
        )
        await db.execute(stmt)
        await db.commit()

    @classmethod
    async def complete_job(
        cls,
        db: AsyncSession,
        job_id: str,
        result: Optional[Dict[str, Any]] = None
    ) -> Optional[ProcessingJob]:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = select(ProcessingJob).where(ProcessingJob.id == job_id)
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if job:
            job.status = "completed"
            job.progress_percentage = 100
            job.current_step = "Processing completed"
            job.completed_at = now
            job.locked_by = None
            job.result = result or {}
            job.updated_at = now
            await db.commit()
            await db.refresh(job)
        return job

    @classmethod
    async def fail_job(
        cls,
        db: AsyncSession,
        job_id: str,
        error_message: str
    ) -> Optional[ProcessingJob]:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = select(ProcessingJob).where(ProcessingJob.id == job_id)
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if job:
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = "queued"
                job.locked_by = None
                job.current_step = f"Retrying ({job.retry_count}/{job.max_retries})"
                job.error_message = f"Attempt failed: {error_message}"
            else:
                job.status = "failed"
                job.current_step = "Failed"
                job.locked_by = None
                job.completed_at = now
                job.error_message = error_message
            job.updated_at = now
            await db.commit()
            await db.refresh(job)
        return job

    @classmethod
    async def recover_orphaned_jobs(
        cls,
        db: AsyncSession,
        timeout_seconds: int = 180
    ) -> int:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        cutoff = now - timedelta(seconds=timeout_seconds)

        # Recover jobs where status == 'processing' but heartbeat timed out or worker crashed
        stmt = select(ProcessingJob).where(
            and_(
                ProcessingJob.status == "processing",
                or_(
                    ProcessingJob.heartbeat_at < cutoff,
                    and_(ProcessingJob.heartbeat_at.is_(None), ProcessingJob.locked_at < cutoff)
                )
            )
        )
        res = await db.execute(stmt)
        orphans = res.scalars().all()

        recovered_count = 0
        for job in orphans:
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = "queued"
                job.locked_by = None
                job.current_step = f"Recovered after worker timeout (retry {job.retry_count})"
            else:
                job.status = "failed"
                job.error_message = "Worker process terminated unexpectedly"
            job.updated_at = now
            recovered_count += 1

        if recovered_count > 0:
            await db.commit()
            logger.info(f"Recovered {recovered_count} orphaned jobs.")
        return recovered_count

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from backend.app.services.queue.manager import JobQueueManager
from backend.app.models.entities import ProcessingJob
from backend.app.core.database import AsyncSessionLocal, init_db

@pytest.mark.asyncio
async def test_job_enqueue():
    await init_db()
    async with AsyncSessionLocal() as db_session:
        job = await JobQueueManager.enqueue_job(
            db=db_session,
            job_type="render_clip",
            project_id=None,
            payload={"clip_id": "test-123", "style": "mrbeast_bouncy"}
        )
        assert job.id is not None
        assert job.status == "queued"
        assert job.progress_percentage == 0
        assert job.payload["style"] == "mrbeast_bouncy"

@pytest.mark.asyncio
async def test_job_claim_and_lease():
    await init_db()
    unique_type = f"type_{uuid.uuid4().hex[:6]}"
    async with AsyncSessionLocal() as db_session:
        job = await JobQueueManager.enqueue_job(
            db=db_session,
            job_type=unique_type,
            project_id=None,
            payload={"test": 1}
        )
        claimed = await JobQueueManager.claim_next_job(
            db=db_session,
            worker_id="worker-node-1",
            job_type=unique_type
        )
        assert claimed is not None
        assert claimed.id == job.id
        assert claimed.status == "processing"
        assert claimed.locked_by == "worker-node-1"
        assert claimed.locked_at is not None

        second_claim = await JobQueueManager.claim_next_job(
            db=db_session,
            worker_id="worker-node-2",
            job_type=unique_type
        )
        assert second_claim is None

@pytest.mark.asyncio
async def test_job_heartbeat_and_completion():
    await init_db()
    unique_type = f"type_{uuid.uuid4().hex[:6]}"
    async with AsyncSessionLocal() as db_session:
        job = await JobQueueManager.enqueue_job(
            db=db_session,
            job_type=unique_type,
            project_id=None
        )
        claimed = await JobQueueManager.claim_next_job(
            db=db_session,
            worker_id="worker-node-1",
            job_type=unique_type
        )
        hb_success = await JobQueueManager.heartbeat(db_session, claimed.id, "worker-node-1")
        assert hb_success is True

        hb_fail = await JobQueueManager.heartbeat(db_session, claimed.id, "imposter-worker")
        assert hb_fail is False

        completed = await JobQueueManager.complete_job(
            db=db_session,
            job_id=claimed.id,
            result={"output": "success.mp4"}
        )
        assert completed.status == "completed"
        assert completed.progress_percentage == 100
        assert completed.locked_by is None
        assert completed.result["output"] == "success.mp4"

@pytest.mark.asyncio
async def test_job_retry_and_orphan_recovery():
    await init_db()
    unique_type = f"type_{uuid.uuid4().hex[:6]}"
    async with AsyncSessionLocal() as db_session:
        job = await JobQueueManager.enqueue_job(
            db=db_session,
            job_type=unique_type,
            project_id=None,
            max_retries=2
        )
        claimed = await JobQueueManager.claim_next_job(
            db=db_session,
            worker_id="worker-1",
            job_type=unique_type
        )
        
        claimed.heartbeat_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=300)
        await db_session.commit()

        recovered = await JobQueueManager.recover_orphaned_jobs(db_session, timeout_seconds=60)
        assert recovered >= 1

        await db_session.refresh(claimed)
        assert claimed.status == "queued"
        assert claimed.retry_count == 1
        assert claimed.locked_by is None

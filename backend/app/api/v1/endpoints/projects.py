import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.entities import Project, ProcessingJob, ClipCandidate, GeneratedClip
from backend.app.schemas.project import ProjectResponse, ProjectDetailResponse, ImportUrlRequest, UrlInfoResponse
from backend.app.schemas.job import ProcessingJobResponse
from backend.app.services.video.probe import FFprobeService, MediaProbeError
from backend.app.services.storage.manager import StorageManager
from backend.app.services.pipeline import PipelineCoordinator
from backend.app.services.video.downloader import VideoUrlDownloader, UrlDownloadError

router = APIRouter()

@router.post("/inspect-url", response_model=UrlInfoResponse)
async def inspect_url(req: ImportUrlRequest):
    """Fetches video metadata (title, duration, thumbnail) from YouTube or direct URL."""
    try:
        import asyncio
        info = await asyncio.to_thread(VideoUrlDownloader.get_info, req.url)
        return info
    except UrlDownloadError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/import-url", response_model=ProjectResponse)
async def import_from_url(
    req: ImportUrlRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Downloads video from YouTube or supported URL, probes metadata,
    creates Project record, and launches the AI clipping pipeline.
    """
    import asyncio
    project_id = str(uuid.uuid4())
    
    try:
        download_data = await asyncio.to_thread(VideoUrlDownloader.download_video, req.url, project_id)
    except UrlDownloadError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    meta = download_data["metadata"]
    project_title = req.title.strip() if req.title and req.title.strip() else download_data["title"]

    project = Project(
        id=project_id,
        title=project_title,
        original_filename=download_data["filename"],
        file_path=str(download_data["file_path"]),
        file_size_bytes=meta["size_bytes"],
        duration_seconds=meta["duration"],
        video_width=meta["width"],
        video_height=meta["height"],
        fps=meta["fps"],
        status="uploaded"
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    if req.auto_generate:
        job_id = str(uuid.uuid4())
        job = ProcessingJob(
            id=job_id,
            project_id=project.id,
            job_type="full_pipeline",
            progress_percentage=0,
            current_step="Queued for processing",
            status="queued"
        )
        db.add(job)
        await db.commit()
        background_tasks.add_task(PipelineCoordinator.process_project_pipeline, project.id, job_id)

    return project

@router.post("/upload", response_model=ProjectResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    auto_generate: bool = Form(True),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts video upload, validates format and duration using FFprobe,
    stores in project storage, and initiates the processing pipeline.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded.")

    ext = Path(file.filename).suffix.lower()
    if ext not in settings.SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{ext}'. Allowed: {', '.join(settings.SUPPORTED_EXTENSIONS)}"
        )

    project_id = str(uuid.uuid4())
    save_path = StorageManager.get_upload_path(project_id, file.filename)
    
    # Stream file to disk
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save upload: {e}")

    # Inspect media via FFprobe
    try:
        metadata = FFprobeService.probe_file(save_path)
    except MediaProbeError as e:
        StorageManager.cleanup_temp_file(save_path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid video file: {e}")

    if not metadata["is_valid"]:
        StorageManager.cleanup_temp_file(save_path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is missing a valid video stream or is too short.")

    if metadata["duration"] > settings.MAX_VIDEO_DURATION_SECONDS:
        StorageManager.cleanup_temp_file(save_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Video exceeds maximum allowed length of {settings.MAX_VIDEO_DURATION_SECONDS/60:.0f} minutes."
        )

    project_title = title.strip() if title and title.strip() else Path(file.filename).stem

    project = Project(
        id=project_id,
        title=project_title,
        original_filename=file.filename,
        file_path=str(save_path),
        file_size_bytes=metadata["size_bytes"],
        duration_seconds=metadata["duration"],
        video_width=metadata["width"],
        video_height=metadata["height"],
        fps=metadata["fps"],
        status="uploaded"
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    if auto_generate:
        # Spawn job and trigger pipeline
        job_id = str(uuid.uuid4())
        job = ProcessingJob(
            id=job_id,
            project_id=project.id,
            job_type="full_pipeline",
            progress_percentage=0,
            current_step="Queued for processing",
            status="queued"
        )
        db.add(job)
        await db.commit()
        
        # Launch background pipeline
        background_tasks.add_task(PipelineCoordinator.process_project_pipeline, project.id, job_id)

    return project

@router.post("/{project_id}/generate", response_model=ProcessingJobResponse)
async def generate_clips_for_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Triggers clip generation for an existing project."""
    res = await db.execute(select(Project).where(Project.id == project_id))
    project = res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    job_id = str(uuid.uuid4())
    job = ProcessingJob(
        id=job_id,
        project_id=project.id,
        job_type="full_pipeline",
        progress_percentage=0,
        current_step="Queued for processing",
        status="queued"
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(PipelineCoordinator.process_project_pipeline, project.id, job_id)
    return job

@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """Lists all uploaded projects ordered by most recent."""
    stmt = select(Project).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves project details along with candidate and clip counts."""
    res = await db.execute(select(Project).where(Project.id == project_id))
    project = res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    # Counts
    cand_count = await db.scalar(
        select(func.count(ClipCandidate.id)).where(ClipCandidate.project_id == project_id)
    )
    clips_count = await db.scalar(
        select(func.count(GeneratedClip.id)).where(GeneratedClip.project_id == project_id)
    )

    data = {
        "id": project.id,
        "title": project.title,
        "original_filename": project.original_filename,
        "file_size_bytes": project.file_size_bytes,
        "duration_seconds": project.duration_seconds,
        "video_width": project.video_width,
        "video_height": project.video_height,
        "fps": project.fps,
        "status": project.status,
        "error_message": project.error_message,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "transcript_data": project.transcript_data,
        "clips_count": clips_count or 0,
        "candidates_count": cand_count or 0
    }
    return data

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Project).where(Project.id == project_id))
    project = res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    # Remove storage files
    upload_dir = settings.UPLOAD_DIR / project_id
    processed_dir = settings.PROCESSED_DIR / project_id
    StorageManager.cleanup_temp_file(upload_dir)
    StorageManager.cleanup_temp_file(processed_dir)

    await db.delete(project)
    await db.commit()
    return None

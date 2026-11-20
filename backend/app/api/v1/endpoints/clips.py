import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.entities import GeneratedClip, Project, ClipCandidate
from backend.app.schemas.clip import GeneratedClipResponse, RenderClipRequest
from backend.app.services.video.processor import VideoProcessor
from backend.app.services.subtitles.generator import SubtitleGenerator
from backend.app.services.storage.manager import StorageManager

router = APIRouter()

def _to_clip_response(clip: GeneratedClip, base_url: str = "/api/v1/clips") -> dict:
    viral_score = 85
    category = "insight"
    if clip.candidate:
        viral_score = clip.candidate.viral_score
        category = clip.candidate.category

    return {
        "id": clip.id,
        "project_id": clip.project_id,
        "candidate_id": clip.candidate_id,
        "title": clip.title,
        "start_time": clip.start_time,
        "end_time": clip.end_time,
        "duration": clip.duration,
        "video_url": f"{base_url}/{clip.id}/stream",
        "thumbnail_url": f"{base_url}/{clip.id}/thumbnail" if clip.thumbnail_path else None,
        "subtitle_style": clip.subtitle_style,
        "aspect_ratio": clip.aspect_ratio or "9:16",
        "crop_mode": clip.aspect_ratio or "smart_blur",
        "resolution": clip.resolution,
        "file_size_bytes": clip.file_size_bytes,
        "render_status": clip.render_status,
        "error_message": clip.error_message,
        "viral_score": viral_score,
        "category": category,
        "created_at": clip.created_at
    }

@router.get("/project/{project_id}", response_model=List[GeneratedClipResponse])
async def list_project_clips(project_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves all generated clips for a given project."""
    stmt = (
        select(GeneratedClip)
        .where(GeneratedClip.project_id == project_id)
        .order_by(GeneratedClip.start_time.asc())
    )
    result = await db.execute(stmt)
    clips = result.scalars().all()
    
    # Pre-fetch candidate scores if available
    res_list = []
    for c in clips:
        # Load candidate
        cand_res = await db.execute(select(ClipCandidate).where(ClipCandidate.id == c.candidate_id))
        c.candidate = cand_res.scalar_one_or_none()
        res_list.append(_to_clip_response(c))
    return res_list

@router.get("/{clip_id}", response_model=GeneratedClipResponse)
async def get_clip_details(clip_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GeneratedClip).where(GeneratedClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clip not found.")
    
    cand_res = await db.execute(select(ClipCandidate).where(ClipCandidate.id == clip.candidate_id))
    clip.candidate = cand_res.scalar_one_or_none()
    return _to_clip_response(clip)

@router.get("/{clip_id}/stream")
async def stream_clip(clip_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Streams the rendered MP4 video with HTTP range support for web player seeking."""
    result = await db.execute(select(GeneratedClip).where(GeneratedClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clip not found.")

    # Redirect to CDN if hosted remotely
    if clip.video_path.startswith("http://") or clip.video_path.startswith("https://"):
        return RedirectResponse(url=clip.video_path, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    if not Path(clip.video_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found on disk.")

    path = Path(clip.video_path)
    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        byte_range = range_header.strip().lower().replace("bytes=", "")
        range_parts = byte_range.split("-")
        start = int(range_parts[0]) if range_parts[0] else 0
        end = int(range_parts[1]) if len(range_parts) > 1 and range_parts[1] else file_size - 1
        length = end - start + 1

        def iter_chunk():
            with open(path, "rb") as f:
                f.seek(start)
                bytes_left = length
                chunk_size = 1024 * 512
                while bytes_left > 0:
                    read_size = min(chunk_size, bytes_left)
                    data = f.read(read_size)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(iter_chunk(), status_code=206, headers=headers)
    
    return FileResponse(path, media_type="video/mp4", filename=f"{clip.title}.mp4")

@router.get("/{clip_id}/thumbnail")
async def get_clip_thumbnail(clip_id: str, db: AsyncSession = Depends(get_db)):
    """Serves the thumbnail image for a clip."""
    result = await db.execute(select(GeneratedClip).where(GeneratedClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip or not clip.thumbnail_path or not Path(clip.thumbnail_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not found.")
    return FileResponse(Path(clip.thumbnail_path), media_type="image/jpeg")

@router.get("/{clip_id}/download")
async def download_clip(clip_id: str, db: AsyncSession = Depends(get_db)):
    """Forces browser download of the MP4 file."""
    result = await db.execute(select(GeneratedClip).where(GeneratedClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clip not found.")

    if clip.video_path.startswith("http://") or clip.video_path.startswith("https://"):
        return RedirectResponse(url=clip.video_path, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    if not Path(clip.video_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found.")

    safe_title = "".join(c for c in clip.title if c.isalnum() or c in (" ", "_", "-")).rstrip()
    download_filename = f"{safe_title or 'clip'}.mp4"
    return FileResponse(
        Path(clip.video_path),
        media_type="video/mp4",
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
    )

@router.post("/{clip_id}/render", response_model=GeneratedClipResponse)
async def re_render_clip(
    clip_id: str,
    req: RenderClipRequest,
    db: AsyncSession = Depends(get_db)
):
    """Re-renders a clip with modified template layout, subtitle style, or timing."""
    result = await db.execute(select(GeneratedClip).where(GeneratedClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clip not found.")

    proj_res = await db.execute(select(Project).where(Project.id == clip.project_id))
    project = proj_res.scalar_one_or_none()
    
    # Check source video file: first try project source, then try clip's existing video if needed
    source_video_path = None
    if project and project.file_path and Path(project.file_path).exists():
        source_video_path = Path(project.file_path)
    elif clip.video_path and Path(clip.video_path).exists():
        source_video_path = Path(clip.video_path)

    if not source_video_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Original source video missing.")

    start_time = req.start_time if req.start_time is not None else clip.start_time
    end_time = req.end_time if req.end_time is not None else clip.end_time
    subtitle_style = req.subtitle_style or clip.subtitle_style or "bold_viral"
    crop_mode = req.crop_mode or clip.aspect_ratio or "smart_blur"

    # Re-generate subtitles
    transcript_words = project.transcript_data.get("words", []) if (project and project.transcript_data) else []
    sub_path = StorageManager.get_temp_file_path(prefix=f"sub_rerender_{clip.id}", extension=".ass")
    await asyncio.to_thread(
        SubtitleGenerator.generate_ass,
        words=transcript_words,
        output_path=sub_path,
        style_name=subtitle_style,
        clip_start=start_time,
        clip_end=end_time,
        headline_hook=clip.title
    )

    out_mp4 = StorageManager.get_clip_render_path(clip.project_id, clip.id)
    render_meta = await asyncio.to_thread(
        VideoProcessor.render_vertical_clip,
        source_video=source_video_path,
        start_time=start_time,
        end_time=end_time,
        output_video_path=out_mp4,
        subtitle_ass_path=sub_path,
        crop_mode=crop_mode,
        clip_title=clip.title,
        author_name=project.title if project else "Stream Highlights",
        author_handle="clipora_live"
    )

    clip.start_time = start_time
    clip.end_time = end_time
    clip.duration = render_meta.get("duration", end_time - start_time)
    clip.subtitle_style = subtitle_style
    clip.aspect_ratio = crop_mode
    clip.file_size_bytes = render_meta.get("size_bytes", 0)
    clip.render_status = "completed"
    await db.commit()

    cand_res = await db.execute(select(ClipCandidate).where(ClipCandidate.id == clip.candidate_id))
    clip.candidate = cand_res.scalar_one_or_none()
    return _to_clip_response(clip)

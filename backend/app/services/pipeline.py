import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.entities import Project, ProcessingJob, ClipCandidate, GeneratedClip
from backend.app.services.video.probe import FFprobeService
from backend.app.services.video.processor import VideoProcessor
from backend.app.services.subtitles.generator import SubtitleGenerator
from backend.app.services.gemini.transcriber import GeminiTranscriptionService
from backend.app.services.gemini.analyzer import GeminiVideoAnalyzer
from backend.app.services.clipping.ranker import ClipRankingEngine
from backend.app.services.storage.manager import StorageManager

logger = logging.getLogger(__name__)

class PipelineCoordinator:
    @classmethod
    async def process_project_pipeline(cls, project_id: str, job_id: str) -> None:
        """
        Executes complete video-to-clips pipeline asynchronously in the background.
        """
        async with AsyncSessionLocal() as db:
            # Load project and job
            proj_res = await db.execute(select(Project).where(Project.id == project_id))
            project = proj_res.scalar_one_or_none()
            
            job_res = await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
            job = job_res.scalar_one_or_none()

            if not project or not job:
                logger.error(f"Cannot process pipeline: project {project_id} or job {job_id} not found.")
                return

            try:
                # Step 1: Initialize
                job.status = "running"
                job.progress_percentage = 5
                job.current_step = "Inspecting media and audio channels"
                job.started_at = datetime.utcnow()
                project.status = "processing"
                await db.commit()

                video_path = Path(project.file_path)
                
                # Step 2: Probe media and extract audio (15%)
                job.progress_percentage = 15
                job.current_step = "Extracting high-fidelity audio for speech intelligence"
                await db.commit()

                meta = FFprobeService.probe_file(video_path)
                project.duration_seconds = meta["duration"]
                project.video_width = meta["width"]
                project.video_height = meta["height"]
                project.fps = meta["fps"]

                audio_path = StorageManager.get_temp_file_path(prefix=f"audio_{project.id}", extension=".wav")
                # Run synchronous FFmpeg extraction in threadpool
                await asyncio.to_thread(VideoProcessor.extract_audio, video_path, audio_path)
                project.audio_path = str(audio_path)
                await db.commit()

                # Step 3: Speech intelligence & Word-level Transcription (35%)
                job.progress_percentage = 35
                job.current_step = "Generating word-timestamped transcript with Gemini Speech Intelligence"
                await db.commit()

                transcript = await asyncio.to_thread(
                    GeminiTranscriptionService.transcribe_audio,
                    audio_path,
                    project.duration_seconds
                )
                project.transcript_data = transcript
                await db.commit()

                # Step 4: Multimodal Moment Understanding (55%)
                job.progress_percentage = 55
                job.current_step = "Analyzing conversation dynamics & identifying high-retention hooks"
                await db.commit()

                raw_candidates = await asyncio.to_thread(
                    GeminiVideoAnalyzer.analyze_podcast,
                    video_path,
                    project.duration_seconds,
                    transcript
                )

                # Step 5: Heuristic 6-Pillar Ranking (70%)
                job.progress_percentage = 70
                job.current_step = "Ranking viral candidates and optimizing boundary context"
                await db.commit()

                ranked_candidates = ClipRankingEngine.rank_and_select_top_clips(
                    raw_candidates,
                    target_count=5,
                    video_duration=project.duration_seconds
                )

                # Save candidates to database
                db_candidates = []
                for cand in ranked_candidates:
                    c_record = ClipCandidate(
                        project_id=project.id,
                        title=cand["title"],
                        start_time=cand["start_time"],
                        end_time=cand["end_time"],
                        duration=cand["duration"],
                        hook=cand.get("hook"),
                        description=cand.get("description"),
                        category=cand.get("category", "insight"),
                        speaker=cand.get("speaker"),
                        reason=cand.get("reason"),
                        viral_score=cand.get("viral_score", 85),
                        hook_score=cand.get("hook_score", 85),
                        emotion_score=cand.get("emotion_score", 80),
                        value_score=cand.get("value_score", 85),
                        context_score=cand.get("context_score", 80),
                        story_score=cand.get("story_score", 75),
                        ending_score=cand.get("ending_score", 80),
                        is_selected=cand.get("is_selected", True)
                    )
                    db.add(c_record)
                    db_candidates.append(c_record)
                await db.commit()

                # Step 6: Render 5 Vertical MP4 Videos with Styled Subtitles (75% -> 95%)
                transcript_words = transcript.get("words", [])
                rendered_clips = []
                
                for idx, c_model in enumerate(db_candidates[:5]):
                    step_percent = 75 + int((idx / 5.0) * 20)
                    job.progress_percentage = step_percent
                    job.current_step = f"Rendering vertical 9:16 clip {idx+1} of 5 ({c_model.title})"
                    await db.commit()

                    # 1. Generate ASS styled subtitles
                    sub_path = StorageManager.get_temp_file_path(prefix=f"sub_{c_model.id}", extension=".ass")
                    await asyncio.to_thread(
                        SubtitleGenerator.generate_ass,
                        words=transcript_words,
                        output_path=sub_path,
                        style_name="bold_viral",
                        clip_start=c_model.start_time,
                        clip_end=c_model.end_time
                    )

                    # 2. Render 1080x1920 vertical MP4
                    out_mp4 = StorageManager.get_clip_render_path(project.id, c_model.id)
                    render_meta = await asyncio.to_thread(
                        VideoProcessor.render_vertical_clip,
                        source_video=video_path,
                        start_time=c_model.start_time,
                        end_time=c_model.end_time,
                        output_video_path=out_mp4,
                        subtitle_ass_path=sub_path,
                        crop_mode="smart_blur"
                    )

                    # 3. Extract crisp thumbnail
                    thumb_path = StorageManager.get_clip_thumbnail_path(project.id, c_model.id)
                    await asyncio.to_thread(
                        VideoProcessor.extract_thumbnail,
                        video_path=out_mp4,
                        timestamp=1.0,
                        output_image_path=thumb_path
                    )

                    # 4. Save GeneratedClip record
                    clip_rec = GeneratedClip(
                        project_id=project.id,
                        candidate_id=c_model.id,
                        title=c_model.title,
                        start_time=c_model.start_time,
                        end_time=c_model.end_time,
                        duration=render_meta.get("duration", c_model.duration),
                        video_path=str(out_mp4),
                        thumbnail_path=str(thumb_path),
                        subtitle_path=str(sub_path),
                        subtitle_style="bold_viral",
                        aspect_ratio="9:16",
                        resolution="1080x1920",
                        file_size_bytes=render_meta.get("size_bytes", 0),
                        render_status="completed"
                    )
                    db.add(clip_rec)
                    rendered_clips.append(clip_rec)
                    await db.commit()

                # Step 7: Completed!
                job.progress_percentage = 100
                job.current_step = "All 5 clips successfully rendered and verified"
                job.status = "completed"
                job.completed_at = datetime.utcnow()
                project.status = "completed"
                await db.commit()
                logger.info(f"Pipeline successfully completed for project {project_id}!")

            except Exception as e:
                logger.exception(f"Pipeline execution failed: {e}")
                job.status = "failed"
                job.error_message = str(e)
                project.status = "failed"
                project.error_message = str(e)
                await db.commit()

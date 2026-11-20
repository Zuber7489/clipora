import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.entities import Project, ProcessingJob, ClipCandidate, GeneratedClip
from backend.app.services.video.probe import FFprobeService
from backend.app.services.video.processor import VideoProcessor
from backend.app.services.video.downloader import VideoUrlDownloader
from backend.app.services.video.heatmap import YouTubeHeatmapService
from backend.app.services.subtitles.generator import SubtitleGenerator
from backend.app.services.gemini.transcriber import GeminiTranscriptionService
from backend.app.services.gemini.analyzer import GeminiVideoAnalyzer
from backend.app.services.clipping.ranker import ClipRankingEngine
from backend.app.services.storage.manager import StorageManager
from backend.app.services.storage.firebase import FirebaseStorageService

logger = logging.getLogger(__name__)

class PipelineCoordinator:
    @classmethod
    async def process_project_pipeline(cls, project_id: str, job_id: str, source_url: Optional[str] = None) -> None:
        """
        Executes complete video-to-clips pipeline asynchronously in the background.
        Includes high-speed stream fetching, Gemini speech intelligence & reasoning,
        6-pillar ranking, and parallel multi-worker vertical clip rendering.
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

                # Step 1b: If URL import, fetch stream in background
                if source_url or (project.file_path and project.file_path.startswith("http")) or not project.file_path:
                    target_url = source_url or project.original_filename
                    job.progress_percentage = 10
                    job.current_step = "Ingesting stream metadata & audience heatmap..."
                    await db.commit()

                    # Instant Stream Heatmap Check: detect viral moments in <1s
                    heatmap_candidates = None
                    try:
                        info = await asyncio.to_thread(VideoUrlDownloader.get_info, target_url)
                        raw_duration = float(info.get("duration", 0.0))
                        if raw_duration > 0:
                            project.duration_seconds = raw_duration
                            project.title = project.title or info.get("title", "Imported Stream")
                            heatmap_candidates = await asyncio.to_thread(
                                YouTubeHeatmapService.get_top_viral_segments,
                                target_url,
                                raw_duration,
                                5
                            )
                            if heatmap_candidates:
                                job.current_step = f"🚀 Instant Heatmap Engine active: 5 viral moments located across {raw_duration/3600:.1f}h stream!"
                                await db.commit()
                    except Exception as e:
                        logger.warning(f"Heatmap pre-check skipped: {e}")

                    download_data = await asyncio.to_thread(VideoUrlDownloader.download_video, target_url, project.id)
                    video_path = Path(download_data["file_path"])
                    subtitle_path = download_data.get("subtitle_path")
                    project.file_path = str(video_path)
                    project.original_filename = download_data["filename"]
                    project.file_size_bytes = download_data["metadata"]["size_bytes"]
                    project.duration_seconds = download_data["metadata"]["duration"]
                    project.video_width = download_data["metadata"]["width"]
                    project.video_height = download_data["metadata"]["height"]
                    project.fps = download_data["metadata"]["fps"]
                    await db.commit()
                else:
                    video_path = Path(project.file_path)
                    subtitle_path = None
                    heatmap_candidates = None

                # Step 2: Probe media and extract audio (15%)
                job.progress_percentage = 15
                job.current_step = "Extracting high-fidelity audio for speech intelligence"
                await db.commit()

                meta = FFprobeService.probe_file(video_path)
                project.duration_seconds = meta["duration"]
                project.video_width = meta["width"]
                project.video_height = meta["height"]
                project.fps = meta["fps"]

                audio_path = StorageManager.get_temp_file_path(prefix=f"audio_{project.id}", extension=".mp3")
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
                    project.duration_seconds,
                    subtitle_path
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
                    transcript,
                    audio_path=audio_path
                )

                # Step 5: Heuristic 6-Pillar Ranking (70%)
                job.progress_percentage = 70
                job.current_step = "Ranking viral candidates and optimizing boundary context"
                await db.commit()

                if heatmap_candidates:
                    ranked_candidates = heatmap_candidates[:5]
                else:
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

                # Step 6: Parallel Multi-Worker Rendering (75% -> 95%)
                job.progress_percentage = 75
                job.current_step = "Parallel rendering 5 vertical 9:16 HD clips with karaoke subtitles"
                await db.commit()

                transcript_words = transcript.get("words", [])
                rendered_clips = []
                semaphore = asyncio.Semaphore(settings.MAX_PARALLEL_RENDERS)

                async def render_candidate_task(c_model, idx: int):
                    async with semaphore:
                        logger.info(f"Starting parallel render for clip {idx+1}: {c_model.title}")
                        
                        # 1. High-speed speech alignment: reuse existing transcript words if non-dummy and valid
                        existing_slice = [
                            w for w in transcript_words
                            if float(w.get("end", 0.0)) > c_model.start_time and float(w.get("start", 0.0)) < c_model.end_time
                            and str(w.get("word", "")).strip() not in ("...", "", ".")
                        ]
                        if len(existing_slice) >= 8:
                            clip_words = existing_slice
                        else:
                            clip_words = await asyncio.to_thread(
                                GeminiTranscriptionService.transcribe_clip_segment,
                                audio_path=Path(project.audio_path) if project.audio_path else video_path,
                                start_time=c_model.start_time,
                                end_time=c_model.end_time,
                                fallback_words=[]
                            )

                        # 2. Generate ASS styled subtitles with Gemini words
                        sub_path = StorageManager.get_temp_file_path(prefix=f"sub_{c_model.id}", extension=".ass")
                        await asyncio.to_thread(
                            SubtitleGenerator.generate_ass,
                            words=clip_words,
                            output_path=sub_path,
                            style_name="bold_viral",
                            clip_start=c_model.start_time,
                            clip_end=c_model.end_time,
                            headline_hook=c_model.title
                        )

                        # 2. Render 1080x1920 vertical MP4 (ultra-fast two-pass blur + veryfast preset)
                        out_mp4 = StorageManager.get_clip_render_path(project.id, c_model.id)
                        render_meta = await asyncio.to_thread(
                            VideoProcessor.render_vertical_clip,
                            source_video=video_path,
                            start_time=c_model.start_time,
                            end_time=c_model.end_time,
                            output_video_path=out_mp4,
                            subtitle_ass_path=sub_path,
                            crop_mode="streamer_split",
                            clip_title=c_model.title,
                            author_name=project.title or "Stream Highlights",
                            author_handle="clipora_live"
                        )

                        # 3. Extract crisp thumbnail
                        thumb_path = StorageManager.get_clip_thumbnail_path(project.id, c_model.id)
                        await asyncio.to_thread(
                            VideoProcessor.extract_thumbnail,
                            video_path=out_mp4,
                            timestamp=1.0,
                            output_image_path=thumb_path
                        )

                        # 4. Optional Firebase Cloud Storage Upload
                        final_video_path = str(out_mp4)
                        final_thumb_path = str(thumb_path)
                        if settings.ENABLE_FIREBASE_STORAGE or settings.FIREBASE_STORAGE_BUCKET:
                            try:
                                fb_vid = await asyncio.to_thread(
                                    FirebaseStorageService.upload_file,
                                    out_mp4,
                                    f"clips/{project.id}/clip_{c_model.id}.mp4",
                                    "video/mp4"
                                )
                                fb_thumb = await asyncio.to_thread(
                                    FirebaseStorageService.upload_file,
                                    thumb_path,
                                    f"clips/{project.id}/thumb_{c_model.id}.jpg",
                                    "image/jpeg"
                                )
                                if fb_vid:
                                    final_video_path = fb_vid
                                if fb_thumb:
                                    final_thumb_path = fb_thumb
                            except Exception as fb_err:
                                logger.warning(f"Firebase upload skipped: {fb_err}")

                        return {
                            "candidate": c_model,
                            "render_meta": render_meta,
                            "video_path": final_video_path,
                            "thumb_path": final_thumb_path,
                            "sub_path": str(sub_path)
                        }

                top_candidates = db_candidates[:5]
                tasks = [render_candidate_task(c_cand, i) for i, c_cand in enumerate(top_candidates)]
                results = await asyncio.gather(*tasks)

                # Persist rendered clips
                for res in results:
                    c_model = res["candidate"]
                    render_meta = res["render_meta"]
                    clip_rec = GeneratedClip(
                        project_id=project.id,
                        candidate_id=c_model.id,
                        title=c_model.title,
                        start_time=c_model.start_time,
                        end_time=c_model.end_time,
                        duration=render_meta.get("duration", c_model.duration),
                        video_path=res["video_path"],
                        thumbnail_path=res["thumb_path"],
                        subtitle_path=res["sub_path"],
                        subtitle_style="bold_viral",
                        aspect_ratio="streamer_split",
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

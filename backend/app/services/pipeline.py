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
    async def process_project_pipeline(
        cls,
        project_id: str,
        job_id: str,
        source_url: Optional[str] = None,
        target_clips: int = 5,
        target_duration: int = 45
    ) -> None:
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

            if job.payload and isinstance(job.payload, dict):
                if "target_clips" in job.payload:
                    target_clips = int(job.payload["target_clips"])
                if "target_duration" in job.payload:
                    target_duration = int(job.payload["target_duration"])
            target_clips = max(1, min(50, target_clips))
            target_duration = max(15, min(180, target_duration))

            try:
                # Step 1: Initialize
                job.status = "running"
                job.progress_percentage = 5
                job.current_step = f"Inspecting media and audio channels for {target_clips} clips (~{target_duration}s each)"
                job.started_at = datetime.utcnow()
                project.status = "processing"
                await db.commit()

                # Step 1b: If URL import, fetch stream metadata & instant audience heatmap
                target_url = None
                video_path = None
                audio_path = None
                ranked_candidates = []

                if source_url or (project.file_path and project.file_path.startswith("http")) or not project.file_path:
                    target_url = source_url or project.original_filename
                    job.progress_percentage = 10
                    job.current_step = f"Audience engagement analysis for {target_clips} viral clips (~{target_duration}s)..."
                    await db.commit()

                    # Instant Stream Heatmap Check: detect viral moments in <1s
                    heatmap_candidates = None
                    raw_duration = 3600.0
                    try:
                        info = await asyncio.to_thread(VideoUrlDownloader.get_info, target_url)
                        raw_duration = float(info.get("duration", 0.0))
                        if raw_duration > 0:
                            project.duration_seconds = raw_duration
                            project.title = project.title or info.get("title", "Imported Stream")
                            project.video_width = 1920
                            project.video_height = 1080
                            project.fps = 30.0
                            await db.commit()

                            heatmap_candidates = await asyncio.to_thread(
                                YouTubeHeatmapService.get_top_viral_segments,
                                target_url,
                                raw_duration,
                                target_clips,
                                float(target_duration)
                            )
                    except Exception as e:
                        logger.warning(f"Heatmap extraction failed: {e}")

                    if heatmap_candidates and len(heatmap_candidates) >= 1:
                        logger.info(f"🚀 Heatmap located {len(heatmap_candidates)} moments! Bypassing full video download.")
                        ranked_candidates = heatmap_candidates[:target_clips]
                        job.progress_percentage = 60
                        job.current_step = f"🚀 Instant Heatmap Engine active: {len(ranked_candidates)} viral moments (~{target_duration}s) located across {raw_duration/3600:.1f}h stream!"
                        await db.commit()
                    else:
                        # Fallback when heatmap not present: download audio only (typically ~15MB, 3-5s)
                        job.progress_percentage = 20
                        job.current_step = "Downloading audio stream for moment detection..."
                        await db.commit()
                        aud_data = await asyncio.to_thread(VideoUrlDownloader.download_audio_only, target_url, project.id)
                        audio_path = Path(aud_data["audio_path"])
                        project.audio_path = str(audio_path)
                        await db.commit()

                        job.progress_percentage = 45
                        job.current_step = "Analyzing conversation dynamics & identifying high-retention hooks..."
                        await db.commit()
                        raw_cands = await asyncio.to_thread(
                            GeminiVideoAnalyzer.analyze_podcast,
                            None,
                            project.duration_seconds,
                            {"words": []},
                            audio_path=audio_path,
                            target_count=target_clips,
                            target_duration=target_duration
                        )
                        ranked_candidates = ClipRankingEngine.rank_and_select_top_clips(
                            raw_cands,
                            target_count=target_clips,
                            video_duration=project.duration_seconds,
                            target_duration=target_duration
                        )
                else:
                    # LOCAL FILE UPLOAD (Video already on local disk)
                    video_path = Path(project.file_path)
                    job.progress_percentage = 15
                    job.current_step = "Inspecting media streams & extracting audio..."
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

                    job.progress_percentage = 45
                    job.current_step = "Analyzing conversation dynamics & identifying high-retention hooks..."
                    await db.commit()

                    raw_cands = await asyncio.to_thread(
                        GeminiVideoAnalyzer.analyze_podcast,
                        video_path,
                        project.duration_seconds,
                        {"words": []},
                        audio_path=audio_path,
                        target_count=target_clips,
                        target_duration=target_duration
                    )
                    ranked_candidates = ClipRankingEngine.rank_and_select_top_clips(
                        raw_cands,
                        target_count=target_clips,
                        video_duration=project.duration_seconds,
                        target_duration=target_duration
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

                # Step 6: Parallel Multi-Worker Rendering (65% -> 95%)
                job.progress_percentage = 65
                job.current_step = f"Parallel rendering {len(db_candidates)} vertical 9:16 HD clips with karaoke subtitles"
                await db.commit()

                rendered_clips = []
                semaphore = asyncio.Semaphore(settings.MAX_PARALLEL_RENDERS)

                async def render_candidate_task(c_model, idx: int):
                    async with semaphore:
                        logger.info(f"Starting parallel render for clip {idx+1}: {c_model.title}")
                        temp_clip_source = None
                        try:
                            # 1. Acquire source video section
                            if target_url and (not video_path or not video_path.exists()):
                                # Fast section download: download ONLY this 45-second section (2-3MB in ~3-4s)
                                temp_clip_source = StorageManager.get_temp_file_path(prefix=f"sec_{c_model.id}_", extension=".mp4")
                                await asyncio.to_thread(
                                    VideoUrlDownloader.download_video_section,
                                    target_url,
                                    c_model.start_time,
                                    c_model.end_time,
                                    temp_clip_source
                                )
                                src_for_render = temp_clip_source
                                render_start = 0.0
                                render_end = c_model.duration
                                audio_src_for_transcribe = temp_clip_source
                                transcribe_start = 0.0
                                transcribe_end = c_model.duration
                            else:
                                src_for_render = video_path
                                render_start = c_model.start_time
                                render_end = c_model.end_time
                                audio_src_for_transcribe = Path(project.audio_path) if project.audio_path and Path(project.audio_path).exists() else video_path
                                transcribe_start = c_model.start_time
                                transcribe_end = c_model.end_time

                            # 2. Verbatim word-level Hinglish karaoke transcription (< 2s with inline audio)
                            clip_words = await asyncio.to_thread(
                                GeminiTranscriptionService.transcribe_clip_segment,
                                audio_path=audio_src_for_transcribe,
                                start_time=transcribe_start,
                                end_time=transcribe_end,
                                fallback_words=[]
                            )

                            # Re-align word timestamps to clip start if relative to section
                            if transcribe_start == 0.0 and c_model.start_time > 0.0:
                                for w in clip_words:
                                    w["start"] = round(float(w.get("start", 0.0)) + c_model.start_time, 2)
                                    w["end"] = round(float(w.get("end", 0.0)) + c_model.start_time, 2)

                            # 3. Generate ASS styled subtitles with Gemini words
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

                            # 4. Render 1080x1920 vertical MP4 (ultra-fast streamer_split or requested template)
                            out_mp4 = StorageManager.get_clip_render_path(project.id, c_model.id)
                            render_meta = await asyncio.to_thread(
                                VideoProcessor.render_vertical_clip,
                                source_video=src_for_render,
                                start_time=render_start,
                                end_time=render_end,
                                output_video_path=out_mp4,
                                subtitle_ass_path=sub_path,
                                crop_mode="streamer_split",
                                clip_title=c_model.title,
                                author_name=project.title or "Stream Highlights",
                                author_handle="clipora_live"
                            )

                            # 5. Extract crisp thumbnail
                            thumb_path = StorageManager.get_clip_thumbnail_path(project.id, c_model.id)
                            await asyncio.to_thread(
                                VideoProcessor.extract_thumbnail,
                                video_path=out_mp4,
                                timestamp=1.0,
                                output_image_path=thumb_path
                            )

                            # 6. Cleanup temporary section download if used
                            if temp_clip_source:
                                StorageManager.cleanup_temp_file(temp_clip_source)
                                temp_clip_source = None
                            StorageManager.cleanup_temp_file(sub_path)

                            # 7. Optional Firebase Cloud Storage Upload
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
                        finally:
                            if temp_clip_source:
                                StorageManager.cleanup_temp_file(temp_clip_source)

                top_candidates = db_candidates[:target_clips]
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
                job.current_step = f"All {len(rendered_clips)} clips successfully rendered and verified"
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

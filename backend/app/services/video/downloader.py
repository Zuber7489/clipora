import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import yt_dlp
from backend.app.core.config import settings
from backend.app.services.video.probe import FFprobeService, MediaProbeError
from backend.app.services.storage.manager import StorageManager

logger = logging.getLogger(__name__)

class UrlDownloadError(Exception):
    pass

class VideoUrlDownloader:
    """
    Downloads public user-specified video URLs (YouTube, direct MP4, or podcast links)
    for processing in the ClipForge AI clipping pipeline.
    """

    @classmethod
    def get_info(cls, url: str) -> Dict[str, Any]:
        """Extracts title and duration metadata without downloading the full video."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    "title": info.get("title", "Imported Podcast"),
                    "duration": float(info.get("duration", 0.0)),
                    "uploader": info.get("uploader", "Unknown"),
                    "thumbnail": info.get("thumbnail"),
                    "webpage_url": info.get("webpage_url", url)
                }
        except Exception as e:
            raise UrlDownloadError(f"Could not fetch video info from URL: {e}")

    @classmethod
    def download_audio_only(cls, url: str, project_id: str) -> Dict[str, Any]:
        """
        Ultra-fast audio ingestion: downloads ONLY audio stream (typically 15-25MB for 50 min),
        taking seconds rather than minutes.
        """
        project_dir = settings.UPLOAD_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        output_template = str(project_dir / "audio_stream.%(ext)s")

        ydl_opts = {
            'format': 'ba[ext=m4a]/ba/bestaudio',
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "Imported Podcast")
                video_id = info.get("id", "audio")

                candidates = list(project_dir.glob("audio_stream.*"))
                if not candidates:
                    raise UrlDownloadError("Audio stream download completed but file was not found.")
                audio_file = candidates[0]
        except Exception as e:
            raise UrlDownloadError(f"Failed to download audio stream from URL: {e}")

        try:
            meta = FFprobeService.probe_file(audio_file)
        except MediaProbeError as e:
            StorageManager.cleanup_temp_file(audio_file)
            raise UrlDownloadError(f"Downloaded audio is invalid: {e}")

        return {
            "title": title,
            "audio_path": audio_file,
            "duration": meta["duration"],
            "metadata": meta
        }

    @classmethod
    def download_video_section(cls, url: str, start_time: float, end_time: float, output_path: Path) -> Path:
        """
        Downloads ONLY the targeted section [start_time, end_time] in HD rather than downloading the entire video.
        """
        import yt_dlp.utils
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # Using output_path stem and ext
        output_template = str(output_path.with_suffix('')) + ".%(ext)s"

        ydl_opts = {
            'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'download_ranges': yt_dlp.utils.download_range_func(None, [(start_time, end_time)]),
            'quiet': True,
            'no_warnings': True,
            'force_keyframes_at_cuts': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if not output_path.exists():
            # Check if saved with different extension
            candidates = list(output_path.parent.glob(f"{output_path.stem}.*"))
            if candidates:
                return candidates[0]
            raise UrlDownloadError(f"Section download failed: file not found at {output_path}")

        return output_path

    @classmethod
    def download_video(cls, url: str, project_id: str) -> Dict[str, Any]:
        """
        Downloads video from YouTube or supported platforms into project uploads directory.
        Returns probed metadata and saved file path.
        """
        project_dir = settings.UPLOAD_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        output_template = str(project_dir / "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'writesubtitles': False,
            'writeautomaticsub': False,
            'subtitleslangs': [],
            'quiet': True,
            'no_warnings': True,
            'noprogress': True,
            'max_filesize': settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "Imported Podcast")
                video_id = info.get("id", "video")
                
                # Identify downloaded file
                target_file = project_dir / f"{video_id}.mp4"
                if not target_file.exists():
                    candidates = list(project_dir.glob(f"{video_id}.*"))
                    media_candidates = [c for c in candidates if c.suffix.lower() not in ['.vtt', '.srt', '.part']]
                    if media_candidates:
                        target_file = media_candidates[0]
                    else:
                        raise UrlDownloadError("Video download finished but file was not found on disk.")

        except Exception as e:
            raise UrlDownloadError(f"Failed to download video from URL: {e}")

        # Optional Subtitle Ingestion — completely isolated, never crashes main pipeline
        subtitle_path_result = None
        try:
            sub_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['hi', 'en', 'hi-Latn', 'en-US'],
                'outtmpl': str(project_dir / "%(id)s.%(ext)s"),
                'quiet': True,
                'no_warnings': True,
                'noprogress': True,
                'ignoreerrors': True,
                'socket_timeout': 10,
            }
            with yt_dlp.YoutubeDL(sub_opts) as ydl_sub:
                try:
                    ydl_sub.download([url])
                except Exception:
                    pass  # 429, network error — silently skip
        except Exception as sub_err:
            logger.warning(f"Optional subtitle download skipped: {sub_err}")

        # Probe the downloaded video
        try:
            meta = FFprobeService.probe_file(target_file)
        except MediaProbeError as e:
            StorageManager.cleanup_temp_file(target_file)
            raise UrlDownloadError(f"Downloaded media is invalid: {e}")

        if meta["duration"] > settings.MAX_VIDEO_DURATION_SECONDS:
            StorageManager.cleanup_temp_file(target_file)
            raise UrlDownloadError(
                f"Video duration ({meta['duration']/60:.1f}m) exceeds the maximum allowed limit of {settings.MAX_VIDEO_DURATION_SECONDS/60:.0f} minutes."
            )

        # Check for extracted subtitles (VTT or SRT)
        vtt_candidates = list(project_dir.glob("*.vtt")) + list(project_dir.glob("*.srt"))
        sub_file = vtt_candidates[0] if vtt_candidates else None

        return {
            "title": title,
            "file_path": target_file,
            "filename": target_file.name,
            "metadata": meta,
            "subtitle_path": sub_file
        }

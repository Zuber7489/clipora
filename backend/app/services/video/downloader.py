import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional
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
    def download_video(cls, url: str, project_id: str) -> Dict[str, Any]:
        """
        Downloads video from YouTube or supported platforms into project uploads directory.
        Returns probed metadata and saved file path.
        """
        project_dir = settings.UPLOAD_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        output_template = str(project_dir / "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'quiet': True,
            'no_warnings': True,
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
                    # Check if another extension was saved
                    candidates = list(project_dir.glob(f"{video_id}.*"))
                    if candidates:
                        target_file = candidates[0]
                    else:
                        raise UrlDownloadError("Video download finished but file was not found on disk.")

        except Exception as e:
            raise UrlDownloadError(f"Failed to download video from URL: {e}")

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

        return {
            "title": title,
            "file_path": target_file,
            "filename": target_file.name,
            "metadata": meta
        }

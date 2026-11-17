import re
import uuid
import shutil
from pathlib import Path
from typing import Optional
from backend.app.core.config import settings

class StorageManager:
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Removes unsafe characters and path traversal attempts."""
        clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
        return clean.strip("._") or "unnamed_video.mp4"

    @classmethod
    def get_upload_path(cls, project_id: str, original_filename: str) -> Path:
        """Returns isolated upload path for project."""
        project_dir = settings.UPLOAD_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        safe_name = cls.sanitize_filename(original_filename)
        return project_dir / safe_name

    @classmethod
    def get_clip_render_path(cls, project_id: str, clip_id: str, extension: str = ".mp4") -> Path:
        """Returns path for rendered clip video."""
        project_dir = settings.PROCESSED_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir / f"clip_{clip_id}{extension}"

    @classmethod
    def get_clip_thumbnail_path(cls, project_id: str, clip_id: str) -> Path:
        """Returns path for clip thumbnail."""
        project_dir = settings.PROCESSED_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir / f"thumb_{clip_id}.jpg"

    @classmethod
    def get_temp_file_path(cls, prefix: str = "temp", extension: str = ".tmp") -> Path:
        """Returns temporary file path in temporary storage."""
        unique_name = f"{prefix}_{uuid.uuid4().hex[:8]}{extension}"
        return settings.TEMPORARY_DIR / unique_name

    @classmethod
    def cleanup_temp_file(cls, file_path: Optional[Path]) -> None:
        """Safely removes temporary file if it exists."""
        if file_path and file_path.exists():
            try:
                if file_path.is_file():
                    file_path.unlink(missing_ok=True)
                elif file_path.is_dir():
                    shutil.rmtree(file_path, ignore_errors=True)
            except Exception:
                pass

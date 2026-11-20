import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"

class Settings(BaseSettings):
    PROJECT_NAME: str = "ClipForge AI"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'clipforge.db'}"
    
    # Storage Paths
    STORAGE_ROOT: Path = STORAGE_DIR
    UPLOAD_DIR: Path = STORAGE_DIR / "uploads"
    PROCESSED_DIR: Path = STORAGE_DIR / "processed"
    TEMPORARY_DIR: Path = STORAGE_DIR / "temporary"
    
    # Gemini AI (gemini-3.1-flash-lite for active capacity & < 1.3s latency)
    GEMINI_API_KEY: str = ""
    GEMINI_ANALYSIS_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_TRANSCRIPTION_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_TEMPERATURE: float = 0.3
    
    # Processing Limits & Validation
    MAX_UPLOAD_SIZE_MB: int = 2048
    MAX_VIDEO_DURATION_SECONDS: int = 43200
    SUPPORTED_EXTENSIONS: List[str] = [".mp4", ".mov", ".mkv", ".webm", ".avi"]
    
    # Video Processing Defaults
    OUTPUT_WIDTH: int = 1080
    OUTPUT_HEIGHT: int = 1920
    OUTPUT_FPS: int = 30
    DEFAULT_CLIP_COUNT: int = 5
    
    # Firebase Cloud Storage (Optional 100% Free CDN)
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = None
    FIREBASE_STORAGE_BUCKET: Optional[str] = None
    ENABLE_FIREBASE_STORAGE: bool = False
    
    # Ultra-Fast Parallel Concurrency
    MAX_PARALLEL_RENDERS: int = 2

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure directories exist
for directory in [settings.STORAGE_ROOT, settings.UPLOAD_DIR, settings.PROCESSED_DIR, settings.TEMPORARY_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

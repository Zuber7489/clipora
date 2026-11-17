from fastapi import APIRouter
import shutil
from backend.app.core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    ffmpeg_found = shutil.which("ffmpeg") is not None
    ffprobe_found = shutil.which("ffprobe") is not None
    
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "ffmpeg_available": ffmpeg_found,
        "ffprobe_available": ffprobe_found,
        "gemini_api_configured": bool(settings.GEMINI_API_KEY),
        "models": {
            "transcription": settings.GEMINI_TRANSCRIPTION_MODEL,
            "analysis": settings.GEMINI_ANALYSIS_MODEL
        }
    }

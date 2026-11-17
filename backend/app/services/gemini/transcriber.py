import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings
from backend.app.services.gemini.client import GeminiClientWrapper
from backend.app.services.subtitles.vtt_parser import VttSubtitleParser

logger = logging.getLogger(__name__)

class GeminiTranscriptionService:
    @classmethod
    def transcribe_audio(
        cls,
        audio_path: Path,
        video_duration: float,
        subtitle_path: Optional[Path] = None
    ) -> Dict[str, Any]:
        """
        Transcribes media with genuine word-level timestamps.
        Prioritizes genuine stream captions (VTT/SRT), and falls back to Gemini Flash Multimodal Audio transcription.
        """
        # 1. Check for genuine subtitle stream extracted from video (100% authentic dialogue)
        if subtitle_path and subtitle_path.exists():
            try:
                parsed_vtt = VttSubtitleParser.parse_file(subtitle_path)
                if parsed_vtt and len(parsed_vtt.get("words", [])) > 5:
                    logger.info(f"Loaded {len(parsed_vtt['words'])} genuine subtitle words from {subtitle_path.name}")
                    return parsed_vtt
            except Exception as e:
                logger.warning(f"Failed to parse subtitle file {subtitle_path}: {e}")

        # Also check project folder for any .vtt or .srt
        if audio_path.exists():
            folder = audio_path.parent
            vtt_files = list(folder.glob("*.vtt")) + list(folder.glob("*.srt"))
            for vf in vtt_files:
                try:
                    parsed_vtt = VttSubtitleParser.parse_file(vf)
                    if parsed_vtt and len(parsed_vtt.get("words", [])) > 5:
                        logger.info(f"Loaded {len(parsed_vtt['words'])} genuine subtitle words from {vf.name}")
                        return parsed_vtt
                except Exception:
                    pass

        # 2. Call Gemini Audio Transcription using official models.generate_content
        client = GeminiClientWrapper.get_client()
        if client and audio_path.exists():
            for model_name in [settings.GEMINI_TRANSCRIPTION_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
                try:
                    uploaded_audio = GeminiClientWrapper.upload_and_wait(audio_path, mime_type="audio/wav")
                    prompt = (
                        "Listen carefully to this audio and provide a complete verbatim transcription in the original language "
                        "(Hindi/English/Hinglish). Return a JSON object with this exact structure: "
                        "{\"full_text\": \"...\", \"words\": [{\"word\": \"...\", \"start\": 0.0, \"end\": 0.5, \"speaker\": \"Speaker 1\"}]}"
                    )
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[uploaded_audio, prompt],
                        config={
                            "response_mime_type": "application/json"
                        }
                    )
                    raw_text = response.text or "{}"
                    data = json.loads(raw_text)
                    if isinstance(data, dict) and "words" in data and len(data["words"]) > 0:
                        logger.info(f"Gemini {model_name} transcribed {len(data['words'])} words from audio.")
                        return data
                except Exception as e:
                    logger.warning(f"Gemini model {model_name} transcription failed: {e}")

        # 3. Emergency fallback if offline / API quota exceeded: generate silence-based pacing
        return cls._generate_pacing_transcript(video_duration)

    @classmethod
    def _generate_pacing_transcript(cls, duration: float) -> Dict[str, Any]:
        """Provides neutral timestamp slots without fake fabricated dialogues."""
        words = []
        t = 1.0
        while t < duration - 1.0:
            words.append({
                "word": "...",
                "start": round(t, 2),
                "end": round(t + 0.5, 2),
                "speaker": "Speaker"
            })
            t += 1.0
        return {
            "full_text": "",
            "words": words
        }

import json
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings
from backend.app.services.gemini.client import GeminiClientWrapper
from backend.app.services.subtitles.vtt_parser import VttSubtitleParser
from backend.app.services.subtitles.transliterate import devanagari_to_hinglish
from backend.app.services.storage.manager import StorageManager

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
        Transcribes media with genuine word-level timestamps using Gemini API as PRIMARY.
        Prioritizes official Gemini Speech Intelligence models (gemini-3.5-flash-lite / gemini-3.8-flash),
        falling back to local subtitles (VTT/SRT) only if API is unavailable.
        """
        # 1. Primary: Gemini Flash Multimodal Audio Transcription
        client = GeminiClientWrapper.get_client()
        if client and audio_path.exists():
            for model_name in [settings.GEMINI_TRANSCRIPTION_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
                try:
                    uploaded_audio = GeminiClientWrapper.upload_and_wait(audio_path, mime_type="audio/wav")
                    prompt = (
                        "Listen carefully to this entire audio and transcribe all spoken dialogue with word-level timestamps. "
                        "RULES:\n"
                        "1. SCRIPT: Use natural Hinglish / English in Latin alphabet (e.g. 'bhai kya season', 'sam for balraj'). "
                        "NEVER output Devanagari Hindi characters (no हिन्दी लिपि).\n"
                        "2. Output format: Valid JSON object with this exact structure:\n"
                        "{\"full_text\": \"...\", \"words\": [{\"word\": \"bhai\", \"start\": 0.0, \"end\": 0.4, \"speaker\": \"Speaker 1\"}]}"
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
                        for w in data["words"]:
                            w["word"] = devanagari_to_hinglish(w.get("word", ""))
                        if "full_text" in data:
                            data["full_text"] = devanagari_to_hinglish(data["full_text"])
                        logger.info(f"✅ Gemini API ({model_name}) successfully transcribed {len(data['words'])} words from audio!")
                        return data
                except Exception as e:
                    logger.warning(f"Gemini audio transcription with {model_name} failed: {e}")

        # 2. Secondary fallback: check for extracted VTT/SRT if available
        if subtitle_path and subtitle_path.exists():
            try:
                parsed_vtt = VttSubtitleParser.parse_file(subtitle_path)
                if parsed_vtt and len(parsed_vtt.get("words", [])) > 5:
                    logger.info(f"Loaded {len(parsed_vtt['words'])} fallback subtitle words from {subtitle_path.name}")
                    return parsed_vtt
            except Exception as e:
                logger.warning(f"Failed to parse subtitle file {subtitle_path}: {e}")

        if audio_path.exists():
            folder = audio_path.parent
            vtt_files = list(folder.glob("*.vtt")) + list(folder.glob("*.srt"))
            for vf in vtt_files:
                try:
                    parsed_vtt = VttSubtitleParser.parse_file(vf)
                    if parsed_vtt and len(parsed_vtt.get("words", [])) > 5:
                        logger.info(f"Loaded {len(parsed_vtt['words'])} fallback subtitle words from {vf.name}")
                        return parsed_vtt
                except Exception:
                    pass

        # 3. Emergency fallback if offline / API quota exceeded
        return cls._generate_pacing_transcript(video_duration)

    @classmethod
    def transcribe_clip_segment(
        cls,
        audio_path: Path,
        start_time: float,
        end_time: float,
        fallback_words: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Directly calls Gemini API on the exact [start_time, end_time] slice of audio (typically 30-50s)
        to generate razor-sharp, verbatim word-level Hinglish timestamps specifically for this clip!
        """
        client = GeminiClientWrapper.get_client()
        if not client or not audio_path.exists():
            return fallback_words or []

        temp_slice = StorageManager.get_temp_file_path(prefix="clip_transcribe_", extension=".wav")
        try:
            # Cut exact audio slice using ffmpeg
            cmd = [
                "ffmpeg", "-y",
                "-ss", f"{start_time:.3f}",
                "-to", f"{end_time:.3f}",
                "-i", str(audio_path),
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                str(temp_slice)
            ]
            subprocess.run(cmd, capture_output=True, check=True)

            if not temp_slice.exists() or temp_slice.stat().st_size < 1000:
                return fallback_words or []

            # Upload slice to Gemini
            uploaded_audio = GeminiClientWrapper.upload_and_wait(temp_slice, mime_type="audio/wav")
            prompt = (
                "Listen to this short podcast clip and transcribe EVERY spoken word with precise start and end timestamps. "
                "RULES:\n"
                "1. SCRIPT: Use natural Hinglish / English in Latin alphabet (e.g. 'bhai kya season', 'sam for balraj'). "
                "NEVER output Devanagari Hindi characters (no हिन्दी लिपि).\n"
                "2. TIMESTAMPS: Return timestamps in seconds relative to the start of this audio clip (from 0.0s upwards).\n"
                "3. Return a JSON object with this exact structure:\n"
                "{\"words\": [{\"word\": \"bhai\", \"start\": 0.0, \"end\": 0.4, \"speaker\": \"Speaker 1\"}]}"
            )

            for model_name in [settings.GEMINI_TRANSCRIPTION_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[uploaded_audio, prompt],
                        config={"response_mime_type": "application/json"}
                    )
                    raw_text = response.text or "{}"
                    data = json.loads(raw_text)
                    words = data.get("words", [])
                    if words and len(words) > 0:
                        # Convert to absolute timestamps matching start_time
                        processed_words = []
                        for w in words:
                            rel_s = float(w.get("start", 0.0))
                            rel_e = float(w.get("end", rel_s + 0.35))
                            clean_word = devanagari_to_hinglish(str(w.get("word", "")).strip())
                            processed_words.append({
                                "word": clean_word,
                                "start": round(start_time + rel_s, 2),
                                "end": round(start_time + rel_e, 2),
                                "speaker": w.get("speaker", "Speaker")
                            })
                        logger.info(f"✅ Gemini API transcribed {len(processed_words)} words for clip ({start_time:.1f}s - {end_time:.1f}s)")
                        return processed_words
                except Exception as e:
                    logger.warning(f"Gemini clip transcription model {model_name} failed: {e}")

        except Exception as e:
            logger.warning(f"Clip slice transcription failed: {e}")
        finally:
            StorageManager.cleanup_temp_file(temp_slice)

        return fallback_words or []

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

import json
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

class MediaProbeError(Exception):
    pass

class FFprobeService:
    @staticmethod
    def get_ffprobe_path() -> str:
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            raise MediaProbeError("ffprobe executable not found in system PATH.")
        return ffprobe

    @classmethod
    def probe_file(cls, file_path: Path) -> Dict[str, Any]:
        """Inspects media file and returns structured video and audio metadata."""
        if not file_path.exists():
            raise MediaProbeError(f"File not found: {file_path}")

        ffprobe_bin = cls.get_ffprobe_path()
        cmd = [
            ffprobe_bin,
            "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
            "-of", "json",
            str(file_path)
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            raise MediaProbeError(f"ffprobe failed on {file_path.name}: {e.stderr}")
        except json.JSONDecodeError:
            raise MediaProbeError(f"Invalid JSON returned from ffprobe for {file_path.name}")

        format_info = data.get("format", {})
        streams = data.get("streams", [])

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        duration = float(format_info.get("duration", 0.0))
        size_bytes = int(format_info.get("size", 0))

        width = 0
        height = 0
        fps = 0.0
        video_codec = None

        if video_stream:
            width = int(video_stream.get("width", 0))
            height = int(video_stream.get("height", 0))
            video_codec = video_stream.get("codec_name")
            r_frame_rate = video_stream.get("r_frame_rate", "30/1")
            try:
                if "/" in r_frame_rate:
                    num, den = r_frame_rate.split("/")
                    fps = float(num) / float(den) if float(den) != 0 else 30.0
                else:
                    fps = float(r_frame_rate)
            except Exception:
                fps = 30.0

        audio_codec = audio_stream.get("codec_name") if audio_stream else None
        channels = int(audio_stream.get("channels", 0)) if audio_stream else 0
        sample_rate = int(audio_stream.get("sample_rate", 0)) if audio_stream else 0

        return {
            "duration": round(duration, 3),
            "size_bytes": size_bytes,
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "video_codec": video_codec,
            "has_video": video_stream is not None,
            "audio_codec": audio_codec,
            "has_audio": audio_stream is not None,
            "channels": channels,
            "sample_rate": sample_rate,
            "is_valid": (video_stream is not None and duration > 1.0)
        }

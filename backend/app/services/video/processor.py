import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.services.video.probe import FFprobeService, MediaProbeError
from backend.app.services.video.reframer import FaceReframer

class VideoProcessingError(Exception):
    pass

class VideoProcessor:
    @staticmethod
    def get_ffmpeg_path() -> str:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise VideoProcessingError("ffmpeg executable not found in system PATH.")
        return ffmpeg

    @classmethod
    def extract_audio(cls, video_path: Path, output_audio_path: Path) -> Path:
        """Extracts audio as a clean 16kHz 16-bit mono WAV file for Gemini transcription."""
        ffmpeg = cls.get_ffmpeg_path()
        output_audio_path.parent.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            ffmpeg,
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_audio_path)
        ]
        
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            if not output_audio_path.exists() or output_audio_path.stat().st_size == 0:
                raise VideoProcessingError(f"Audio extraction produced an empty file: {output_audio_path}")
            return output_audio_path
        except subprocess.CalledProcessError as e:
            raise VideoProcessingError(f"FFmpeg audio extraction failed: {e.stderr}")

    @classmethod
    def extract_thumbnail(cls, video_path: Path, timestamp: float, output_image_path: Path) -> Path:
        """Extracts a thumbnail image at a given timestamp."""
        ffmpeg = cls.get_ffmpeg_path()
        output_image_path.parent.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            ffmpeg,
            "-y",
            "-ss", str(max(0.0, timestamp)),
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            str(output_image_path)
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return output_image_path
        except subprocess.CalledProcessError:
            # Fallback to start of video
            cmd[2] = "0.0"
            subprocess.run(cmd, capture_output=True, text=True)
            return output_image_path

    @classmethod
    def render_vertical_clip(
        cls,
        source_video: Path,
        start_time: float,
        end_time: float,
        output_video_path: Path,
        subtitle_ass_path: Optional[Path] = None,
        crop_mode: str = "smart_blur" # "smart_blur", "face_tracking", or "center_crop"
    ) -> Dict[str, Any]:
        """
        Renders a 1080x1920 9:16 vertical video clip with accurate cut,
        smart vertical reframing, burned styled subtitles, and loudness normalization.
        """
        ffmpeg = cls.get_ffmpeg_path()
        output_video_path.parent.mkdir(parents=True, exist_ok=True)
        
        clip_duration = end_time - start_time
        if clip_duration <= 0:
            raise VideoProcessingError(f"Invalid clip duration: {clip_duration}s")

        # Handle Windows path formatting for FFmpeg subtitles filter
        sub_filter = ""
        if subtitle_ass_path and subtitle_ass_path.exists():
            clean_sub_path = str(subtitle_ass_path.resolve()).replace("\\", "/")
            if ":" in clean_sub_path:
                drive, rest = clean_sub_path.split(":", 1)
                clean_sub_path = f"{drive}\\:{rest}"
            sub_filter = f",subtitles='{clean_sub_path}'"

        # Determine filter complex or video filter
        use_filter_complex = False

        if crop_mode == "face_tracking":
            try:
                # Probe original dimensions
                meta = FFprobeService.probe_file(source_video)
                src_w = meta["width"]
                src_h = meta["height"]
                speaker_x = FaceReframer.calculate_speaker_crop_x(
                    video_path=source_video,
                    start_time=start_time,
                    end_time=end_time,
                    src_width=src_w,
                    src_height=src_h
                )
                crop_w = int(src_h * (9.0 / 16.0))
                crop_x = int(max(0, speaker_x - (crop_w / 2.0)))
                vf = f"crop={crop_w}:{src_h}:{crop_x}:0,scale=1080:1920,fps={settings.OUTPUT_FPS}{sub_filter}"
            except Exception:
                crop_mode = "smart_blur"

        if crop_mode == "center_crop":
            vf = f"scale=-2:1920,crop=1080:1920:(in_w-1080)/2:0,fps={settings.OUTPUT_FPS}{sub_filter}"
        elif crop_mode == "smart_blur":
            use_filter_complex = True
            vf = (
                f"[0:v]split=2[bg][fg];"
                f"[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg_blurred];"
                f"[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];"
                f"[bg_blurred][fg_scaled]overlay=(W-w)/2:(H-h)/2,fps={settings.OUTPUT_FPS}{sub_filter}[v_out]"
            )

        cmd = [
            ffmpeg,
            "-y",
            "-ss", f"{start_time:.3f}",
            "-to", f"{end_time:.3f}",
            "-i", str(source_video),
        ]

        if use_filter_complex:
            cmd.extend(["-filter_complex", vf, "-map", "[v_out]", "-map", "0:a?"])
        else:
            cmd.extend(["-vf", vf, "-map", "0:v", "-map", "0:a?"])

        # Audio normalization and output encoding
        cmd.extend([
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-movflags", "+faststart",
            str(output_video_path)
        ])

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            # If loudnorm or complex filter failed, fallback to basic scale
            cmd_fallback = [
                ffmpeg, "-y",
                "-ss", f"{start_time:.3f}",
                "-to", f"{end_time:.3f}",
                "-i", str(source_video),
                "-vf", f"scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black{sub_filter}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k",
                str(output_video_path)
            ]
            subprocess.run(cmd_fallback, capture_output=True, text=True, check=True)

        return FFprobeService.probe_file(output_video_path)

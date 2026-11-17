import os
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.services.video.probe import FFprobeService, MediaProbeError
from backend.app.services.video.reframer import FaceReframer

logger = logging.getLogger(__name__)

def _detect_hw_encoder() -> str:
    """Auto-detect fastest available hardware encoder. Tries h264_qsv / h264_mf first."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return "libx264"
    
    # 1. Try Intel QSV
    try:
        res_qsv = subprocess.run(
            [ffmpeg, "-y", "-f", "lavfi", "-i", "color=black:s=64x64:d=0.1",
             "-c:v", "h264_qsv", "-f", "null", "-"],
            capture_output=True, text=True, timeout=5
        )
        if res_qsv.returncode == 0:
            logger.info("✅ h264_qsv hardware encoder active — utilizing Intel GPU Quick Sync")
            return "h264_qsv"
    except Exception:
        pass

    # 2. Try Windows Media Foundation
    try:
        res_mf = subprocess.run(
            [ffmpeg, "-y", "-f", "lavfi", "-i", "color=black:s=64x64:d=0.1",
             "-c:v", "h264_mf", "-b:v", "1M", "-f", "null", "-"],
            capture_output=True, text=True, timeout=5
        )
        if res_mf.returncode == 0:
            logger.info("✅ h264_mf hardware encoder detected — utilizing Windows Hardware Acceleration")
            return "h264_mf"
    except Exception:
        pass

    logger.info("⚡ Using libx264 superfast software encoder")
    return "libx264"

_HW_ENCODER = _detect_hw_encoder()

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
        crop_mode: str = "smart_blur"
    ) -> Dict[str, Any]:
        """
        Renders a 1080x1920 9:16 vertical video clip with accurate cut,
        smart vertical reframing, burned styled subtitles, and loudness normalization.
        Supports crop_mode: "split_stacked", "face_tracking", "smart_blur", "center_crop".
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

        use_filter_complex = False
        color_grade = "eq=contrast=1.06:brightness=0.01:saturation=1.12"

        # Split Stacked Podcast Layout (1080x960 top, 1080x960 bottom, 4px divider)
        if crop_mode == "split_stacked":
            use_filter_complex = True
            try:
                meta = FFprobeService.probe_file(source_video)
                src_w, src_h = meta["width"], meta["height"]
                spk_a_x, spk_b_x = FaceReframer.calculate_multi_speaker_crop_x(
                    video_path=source_video,
                    start_time=start_time,
                    end_time=end_time,
                    src_width=src_w,
                    src_height=src_h
                )
                target_aspect = 1080.0 / 960.0
                pane_crop_w = int(src_h * target_aspect)
                pane_crop_w = min(pane_crop_w, src_w)

                crop_x1 = int(max(0, min(src_w - pane_crop_w, spk_a_x - pane_crop_w / 2.0)))
                crop_x2 = int(max(0, min(src_w - pane_crop_w, spk_b_x - pane_crop_w / 2.0)))

                vf = (
                    f"[0:v]split=2[spk1][spk2];"
                    f"[spk1]crop={pane_crop_w}:{src_h}:{crop_x1}:0,scale=1080:960:flags=lanczos[top];"
                    f"[spk2]crop={pane_crop_w}:{src_h}:{crop_x2}:0,scale=1080:960:flags=lanczos[bottom];"
                    f"[top][bottom]vstack=inputs=2[stacked];"
                    f"[stacked]drawbox=y=958:h=4:color=0x222222@1.0:t=fill,{color_grade},fps={settings.OUTPUT_FPS}{sub_filter}[v_out]"
                )
            except Exception as e:
                logger.warning(f"split_stacked rendering failed: {e}. Falling back to smart_blur.")
                crop_mode = "smart_blur"

        if crop_mode == "face_tracking":
            try:
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
                crop_x = int(max(0, min(src_w - crop_w, speaker_x - (crop_w / 2.0))))
                vf = f"crop={crop_w}:{src_h}:{crop_x}:0,scale=1080:1920,{color_grade},fps={settings.OUTPUT_FPS}{sub_filter}"
            except Exception as e:
                logger.warning(f"face_tracking rendering failed: {e}. Falling back to smart_blur.")
                crop_mode = "smart_blur"

        if crop_mode == "center_crop":
            vf = f"scale=-2:1920,crop=1080:1920:(in_w-1080)/2:0,{color_grade},fps={settings.OUTPUT_FPS}{sub_filter}"
        elif crop_mode == "smart_blur":
            use_filter_complex = True
            vf = (
                f"[0:v]split=2[bg][fg];"
                f"[bg]scale=54:96:force_original_aspect_ratio=increase,crop=54:96,boxblur=2:1,scale=1080:1920:flags=bilinear,eq=contrast=0.9:brightness=-0.08:saturation=1.2[bg_blurred];"
                f"[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];"
                f"[bg_blurred][fg_scaled]overlay=(W-w)/2:(H-h)/2,{color_grade},fps={settings.OUTPUT_FPS}{sub_filter}[v_out]"
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

        audio_filter = (
            "dynaudnorm=p=0.9:m=10.0:s=5,"
            "equalizer=f=3200:t=o:w=1:g=2.5,"
            "volume=1.06"
        )

        if _HW_ENCODER == "h264_qsv":
            enc_args = ["-c:v", "h264_qsv", "-preset", "veryfast", "-global_quality", "23"]
        elif _HW_ENCODER == "h264_mf":
            enc_args = ["-c:v", "h264_mf", "-b:v", "6M"]
        else:
            enc_args = ["-c:v", "libx264", "-preset", "superfast", "-crf", "21"]

        cmd.extend([
            "-af", audio_filter,
            *enc_args,
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
            logger.warning(f"Primary render failed, trying superfast libx264 fallback: {e.stderr[-300:]}")
            cmd_fallback = [
                ffmpeg, "-y",
                "-ss", f"{start_time:.3f}",
                "-to", f"{end_time:.3f}",
                "-i", str(source_video),
                "-vf", f"scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black{sub_filter}",
                "-c:v", "libx264", "-preset", "superfast", "-crf", "22", "-pix_fmt", "yuv420p",
                "-af", "dynaudnorm=p=0.9:m=10.0",
                "-c:a", "aac", "-b:a", "192k",
                str(output_video_path)
            ]
            subprocess.run(cmd_fallback, capture_output=True, text=True, check=True)

        return FFprobeService.probe_file(output_video_path)

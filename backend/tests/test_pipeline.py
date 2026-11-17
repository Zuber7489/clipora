import asyncio
import subprocess
import shutil
from pathlib import Path
import pytest
from backend.app.services.video.probe import FFprobeService
from backend.app.services.video.processor import VideoProcessor
from backend.app.services.subtitles.generator import SubtitleGenerator
from backend.app.services.gemini.transcriber import GeminiTranscriptionService
from backend.app.services.gemini.analyzer import GeminiVideoAnalyzer
from backend.app.services.clipping.ranker import ClipRankingEngine
from backend.app.core.config import settings

def create_synthetic_test_video(output_path: Path, duration: int = 15) -> Path:
    """Generates a synthetic 16:9 test video with test audio tone and visual timecode."""
    ffmpeg = shutil.which("ffmpeg")
    assert ffmpeg is not None, "ffmpeg must be in PATH"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        ffmpeg, "-y",
        "-f", "lavfi",
        "-i", f"testsrc=duration={duration}:size=1280x720:rate=30",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:duration={duration}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, text=True, check=True)
    return output_path

def test_ffprobe_metadata(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "test_input.mp4", duration=12)
    meta = FFprobeService.probe_file(test_video)
    assert meta["has_video"] is True
    assert meta["has_audio"] is True
    assert meta["width"] == 1280
    assert meta["height"] == 720
    assert 11.5 <= meta["duration"] <= 12.5

def test_audio_extraction(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "test_input.mp4", duration=10)
    audio_out = tmp_path / "extracted_audio.wav"
    VideoProcessor.extract_audio(test_video, audio_out)
    assert audio_out.exists()
    assert audio_out.stat().st_size > 1000

def test_subtitle_generation(tmp_path):
    words = [
        {"word": "Welcome", "start": 0.5, "end": 1.0, "speaker": "Host"},
        {"word": "to", "start": 1.0, "end": 1.2, "speaker": "Host"},
        {"word": "ClipForge", "start": 1.2, "end": 1.8, "speaker": "Host"},
        {"word": "AI", "start": 1.8, "end": 2.2, "speaker": "Host"},
    ]
    sub_out = tmp_path / "test.ass"
    SubtitleGenerator.generate_ass(words, sub_out, style_name="bold_viral", clip_start=0.0, clip_end=5.0)
    assert sub_out.exists()
    content = sub_out.read_text(encoding="utf-8")
    assert "[Script Info]" in content
    assert "PlayResX: 1080" in content
    assert "PlayResY: 1920" in content
    assert "CLIPFORGE" in content

def test_clip_ranking_engine():
    candidates = [
        {"title": "Clip A", "start_time": 0.0, "end_time": 30.0, "hook_score": 90, "emotion_score": 85, "value_score": 90, "context_score": 80, "story_score": 75, "ending_score": 80},
        {"title": "Clip B", "start_time": 10.0, "end_time": 40.0, "hook_score": 70, "emotion_score": 70, "value_score": 70, "context_score": 70, "story_score": 70, "ending_score": 70}, # Overlaps Clip A
        {"title": "Clip C", "start_time": 45.0, "end_time": 85.0, "hook_score": 95, "emotion_score": 90, "value_score": 95, "context_score": 90, "story_score": 85, "ending_score": 90},
        {"title": "Clip D", "start_time": 90.0, "end_time": 130.0, "hook_score": 80, "emotion_score": 80, "value_score": 80, "context_score": 80, "story_score": 80, "ending_score": 80},
        {"title": "Clip E", "start_time": 140.0, "end_time": 180.0, "hook_score": 88, "emotion_score": 85, "value_score": 85, "context_score": 85, "story_score": 80, "ending_score": 80},
        {"title": "Clip F", "start_time": 190.0, "end_time": 230.0, "hook_score": 82, "emotion_score": 80, "value_score": 80, "context_score": 80, "story_score": 75, "ending_score": 75},
    ]
    selected = ClipRankingEngine.rank_and_select_top_clips(candidates, target_count=5, video_duration=300.0)
    assert len(selected) == 5
    # Overlapping clip B should not be selected before higher scoring independent clips
    titles = [s["title"] for s in selected]
    assert "Clip C" in titles
    assert "Clip A" in titles

def test_vertical_video_rendering(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "test_input.mp4", duration=8)
    sub_path = tmp_path / "subs.ass"
    words = [{"word": "TESTING", "start": 0.5, "end": 2.0}]
    SubtitleGenerator.generate_ass(words, sub_path, style_name="bold_viral", clip_start=0.0, clip_end=4.0)
    
    out_mp4 = tmp_path / "rendered_vertical.mp4"
    meta = VideoProcessor.render_vertical_clip(
        source_video=test_video,
        start_time=1.0,
        end_time=5.0,
        output_video_path=out_mp4,
        subtitle_ass_path=sub_path,
        crop_mode="smart_blur"
    )
    assert out_mp4.exists()
    assert meta["width"] == 1080
    assert meta["height"] == 1920
    assert 3.5 <= meta["duration"] <= 4.5
    assert meta["has_audio"] is True

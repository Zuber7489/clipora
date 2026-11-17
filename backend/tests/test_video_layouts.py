import subprocess
import shutil
from pathlib import Path
import pytest
import numpy as np
from backend.app.services.video.reframer import FaceReframer
from backend.app.services.video.processor import VideoProcessor
from backend.app.services.video.probe import FFprobeService

def create_synthetic_test_video(output_path: Path, duration: int = 6) -> Path:
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

def test_detect_faces_empty_frame():
    reframer = FaceReframer()
    assert reframer.detect_faces(None) == []
    assert reframer.detect_faces(np.array([])) == []

def test_detect_faces_synthetic_frame():
    reframer = FaceReframer()
    # Blank 640x480 frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    boxes = reframer.detect_faces(frame)
    assert isinstance(boxes, list)

def test_speaker_crop_x_clamping(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "clamp_test.mp4", duration=2)
    crop_x = FaceReframer.calculate_speaker_crop_x(
        video_path=test_video,
        start_time=0.0,
        end_time=2.0,
        src_width=1280,
        src_height=720,
        target_aspect=9.0/16.0
    )
    target_crop_w = int(720 * (9.0 / 16.0))
    half_crop = target_crop_w / 2.0
    assert half_crop <= crop_x <= (1280 - half_crop)

def test_dynamic_crop_trajectory_smoothing(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "trajectory_test.mp4", duration=3)
    crop_w = int(720 * (9.0 / 16.0))
    traj = FaceReframer.get_dynamic_crop_trajectory(
        video_path=test_video,
        start_time=0.0,
        end_time=3.0,
        crop_w=crop_w,
        crop_h=720
    )
    assert len(traj) > 0
    for x in traj:
        assert crop_w / 2.0 <= x <= 1280 - (crop_w / 2.0)

def test_split_stacked_layout_rendering(tmp_path):
    test_video = create_synthetic_test_video(tmp_path / "podcast_input.mp4", duration=3)
    out_mp4 = tmp_path / "rendered_split_stacked.mp4"
    meta = VideoProcessor.render_vertical_clip(
        source_video=test_video,
        start_time=0.0,
        end_time=3.0,
        output_video_path=out_mp4,
        crop_mode="split_stacked"
    )
    assert out_mp4.exists()
    assert meta["width"] == 1080
    assert meta["height"] == 1920
    assert meta["has_audio"] is True

def test_facereframer_lifecycle():
    with FaceReframer() as reframer:
        assert reframer is not None
        reframer.detect_faces(np.zeros((100, 100, 3), dtype=np.uint8))

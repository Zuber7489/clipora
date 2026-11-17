import pytest
import asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.database import init_db
from backend.app.core.config import settings
from backend.app.services.video.probe import FFprobeService
from backend.tests.test_pipeline import create_synthetic_test_video

@pytest.mark.asyncio
async def test_full_api_workflow(tmp_path):
    # Ensure database schema is initialized
    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        health_resp = await client.get("/api/v1/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["status"] == "online"
        assert health_data["ffmpeg_available"] is True

        # 2. Create synthetic test video (20s)
        test_video = create_synthetic_test_video(tmp_path / "podcast_sample.mp4", duration=20)
        
        # 3. Upload video
        with open(test_video, "rb") as f:
            files = {"file": ("podcast_sample.mp4", f, "video/mp4")}
            data = {"title": "Test AI Podcast Episode", "auto_generate": "true"}
            upload_resp = await client.post("/api/v1/projects/upload", files=files, data=data)
            
        assert upload_resp.status_code == 200
        proj_data = upload_resp.json()
        project_id = proj_data["id"]
        assert proj_data["title"] == "Test AI Podcast Episode"
        assert 19.0 <= proj_data["duration_seconds"] <= 21.0

        # 4. Wait for background processing pipeline to finish (polls job status)
        proj_detail = await client.get(f"/api/v1/projects/{project_id}")
        assert proj_detail.status_code == 200

        max_wait = 120
        waited = 0
        final_status = "unknown"
        while waited < max_wait:
            await asyncio.sleep(2)
            waited += 2
            chk = await client.get(f"/api/v1/projects/{project_id}")
            status_val = chk.json()["status"]
            if status_val in ("completed", "failed"):
                final_status = status_val
                break

        assert final_status == "completed", f"Pipeline failed or timed out: status={final_status}"

        # 5. Fetch generated clips
        clips_resp = await client.get(f"/api/v1/clips/project/{project_id}")
        assert clips_resp.status_code == 200
        clips = clips_resp.json()
        assert len(clips) == 5, f"Expected exactly 5 generated clips, got {len(clips)}"

        # 6. Verify each clip properties
        first_clip = clips[0]
        clip_id = first_clip["id"]
        assert first_clip["resolution"] == "1080x1920"
        assert first_clip["aspect_ratio"] == "9:16"
        assert first_clip["render_status"] == "completed"
        assert first_clip["viral_score"] > 50

        # 7. Test download endpoint
        dl_resp = await client.get(f"/api/v1/clips/{clip_id}/download")
        assert dl_resp.status_code == 200
        assert len(dl_resp.content) > 10000

        # Verify downloaded content with FFprobe
        dl_file = tmp_path / "downloaded_clip.mp4"
        dl_file.write_bytes(dl_resp.content)
        meta = FFprobeService.probe_file(dl_file)
        assert meta["width"] == 1080
        assert meta["height"] == 1920
        assert meta["has_video"] is True
        assert meta["has_audio"] is True

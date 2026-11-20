from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict

class ProjectBase(BaseModel):
    title: str = Field(..., description="Project title")

class ProjectCreate(ProjectBase):
    pass

class ImportUrlRequest(BaseModel):
    url: str = Field(..., description="YouTube URL or direct video URL")
    title: Optional[str] = Field(None, description="Optional custom title")
    num_clips: int = Field(5, description="Number of viral clips to extract (1 to 50)", ge=1, le=50)
    target_duration: int = Field(45, description="Target clip duration in seconds (15 to 180)", ge=15, le=180)
    crop_mode: str = Field("streamer_split", description="Layout template: 'streamer_split', 'twitter_post', 'smart_blur', 'center_crop'")
    subtitle_style: str = Field("bold_viral", description="Karaoke subtitle style: 'bold_viral', 'clean_minimal', 'podcast_pro'")
    auto_generate: bool = Field(True, description="Whether to trigger clips pipeline immediately")

class GenerateClipsRequest(BaseModel):
    num_clips: int = Field(5, description="Number of viral clips to generate (1 to 50)", ge=1, le=50)
    target_duration: int = Field(45, description="Target clip duration in seconds (15 to 180)", ge=15, le=180)
    crop_mode: str = Field("streamer_split", description="Layout template: 'streamer_split', 'twitter_post', 'smart_blur', 'center_crop'")
    subtitle_style: str = Field("bold_viral", description="Karaoke subtitle style: 'bold_viral', 'clean_minimal', 'podcast_pro'")

class UrlInfoResponse(BaseModel):
    title: str
    duration: float
    uploader: str
    thumbnail: Optional[str] = None
    webpage_url: str

class ProjectResponse(ProjectBase):
    id: str
    original_filename: str
    file_size_bytes: int
    duration_seconds: float
    video_width: int
    video_height: int
    fps: float
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ProjectDetailResponse(ProjectResponse):
    transcript_data: Optional[Any] = None
    clips_count: int = 0
    candidates_count: int = 0

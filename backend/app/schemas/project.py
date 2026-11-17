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
    auto_generate: bool = Field(True, description="Whether to trigger 5 clips pipeline immediately")

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

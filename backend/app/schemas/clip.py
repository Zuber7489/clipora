from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ClipCandidateBase(BaseModel):
    title: str
    start_time: float
    end_time: float
    duration: float
    hook: Optional[str] = None
    description: Optional[str] = None
    category: str = "insight"
    speaker: Optional[str] = None
    reason: Optional[str] = None
    viral_score: int = 70
    hook_score: int = 70
    emotion_score: int = 70
    value_score: int = 70
    context_score: int = 70
    story_score: int = 70
    ending_score: int = 70
    is_selected: bool = False

class ClipCandidateResponse(ClipCandidateBase):
    id: str
    project_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Pydantic schema for structured output from Gemini analysis
class GeminiClipItem(BaseModel):
    title: str = Field(..., description="High-engagement, click-worthy title for the short")
    start_time: float = Field(..., description="Start timestamp in seconds (must align with beginning of a thought)")
    end_time: float = Field(..., description="End timestamp in seconds (must align with end of thought, roughly 30-60s)")
    hook: str = Field(..., description="The attention-grabbing hook or sentence opening the clip")
    description: str = Field(..., description="Brief summary of the clip topic")
    category: str = Field(default="gaming", description="One of: gaming, roast, reaction, humor, debate, insight, motivation, story")
    speaker: Optional[str] = Field(default="Speaker 1", description="Primary speaker in this moment")
    reason: str = Field(..., description="Why this moment has viral potential and works as a standalone short")
    hook_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for hook strength")
    emotion_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for emotional resonance")
    value_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for educational/information value")
    context_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for standalone intelligibility")
    story_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for storytelling quality")
    ending_score: int = Field(default=80, ge=1, le=100, description="Score 1-100 for satisfying conclusion")

class GeminiClipAnalysisOutput(BaseModel):
    clips: List[GeminiClipItem] = Field(..., description="List of 8 to 15 strongest standalone clip moments distributed across the entire episode (beginning, middle, climax, and ending)")

class GeneratedClipResponse(BaseModel):
    id: str
    project_id: str
    candidate_id: Optional[str] = None
    title: str
    start_time: float
    end_time: float
    duration: float
    video_url: str
    thumbnail_url: Optional[str] = None
    subtitle_style: str
    aspect_ratio: str
    crop_mode: Optional[str] = "smart_blur"
    resolution: str
    file_size_bytes: int
    render_status: str
    error_message: Optional[str] = None
    viral_score: Optional[int] = None
    category: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RenderClipRequest(BaseModel):
    subtitle_style: str = Field(default="bold_viral", description="Style: 'bold_viral', 'clean_minimal', 'podcast_pro'")
    crop_mode: str = Field(default="smart_blur", description="Mode: 'smart_blur', 'face_tracking', 'center_crop'")
    aspect_ratio: str = Field(default="9:16", description="Aspect ratio: '9:16'")
    start_time: Optional[float] = None
    end_time: Optional[float] = None

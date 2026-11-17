import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Float, Integer, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    audio_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    video_width: Mapped[int] = mapped_column(Integer, default=0)
    video_height: Mapped[int] = mapped_column(Integer, default=0)
    fps: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Status: 'uploaded', 'processing', 'analyzed', 'rendering', 'completed', 'failed'
    status: Mapped[str] = mapped_column(String(50), default="uploaded")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Full transcript JSON: list of words/utterances with timestamps and speakers
    transcript_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    candidates: Mapped[List["ClipCandidate"]] = relationship("ClipCandidate", back_populates="project", cascade="all, delete-orphan")
    clips: Mapped[List["GeneratedClip"]] = relationship("GeneratedClip", back_populates="project", cascade="all, delete-orphan")
    jobs: Mapped[List["ProcessingJob"]] = relationship("ProcessingJob", back_populates="project", cascade="all, delete-orphan")


class ClipCandidate(Base):
    __tablename__ = "clip_candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    
    hook: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="insight")
    speaker: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # AI Ranking Breakdown
    viral_score: Mapped[int] = mapped_column(Integer, default=70)
    hook_score: Mapped[int] = mapped_column(Integer, default=70)
    emotion_score: Mapped[int] = mapped_column(Integer, default=70)
    value_score: Mapped[int] = mapped_column(Integer, default=70)
    context_score: Mapped[int] = mapped_column(Integer, default=70)
    story_score: Mapped[int] = mapped_column(Integer, default=70)
    ending_score: Mapped[int] = mapped_column(Integer, default=70)
    
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship
    project: Mapped["Project"] = relationship("Project", back_populates="candidates")
    rendered_clip: Mapped[Optional["GeneratedClip"]] = relationship("GeneratedClip", back_populates="candidate", uselist=False)


class GeneratedClip(Base):
    __tablename__ = "generated_clips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("clip_candidates.id", ondelete="SET NULL"), nullable=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    
    video_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    subtitle_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    
    subtitle_style: Mapped[str] = mapped_column(String(50), default="bold_viral")
    aspect_ratio: Mapped[str] = mapped_column(String(20), default="9:16")
    resolution: Mapped[str] = mapped_column(String(20), default="1080x1920")
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status: 'pending', 'rendering', 'completed', 'failed'
    render_status: Mapped[str] = mapped_column(String(50), default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="clips")
    candidate: Mapped[Optional["ClipCandidate"]] = relationship("ClipCandidate", back_populates="rendered_clip")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    
    job_type: Mapped[str] = mapped_column(String(50), default="full_pipeline") # 'full_pipeline', 'render_clip', 'analyze'
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[str] = mapped_column(String(100), default="queued")
    status: Mapped[str] = mapped_column(String(50), default="queued") # 'queued', 'processing', 'completed', 'failed'
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Task Queue Payload & Leases
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    locked_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="jobs")

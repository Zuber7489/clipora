from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class ProcessingJobResponse(BaseModel):
    id: str
    project_id: str
    job_type: str
    progress_percentage: int
    current_step: str
    status: str
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

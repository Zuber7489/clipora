export interface Project {
  id: string;
  title: string;
  original_filename: string;
  file_size_bytes: number;
  duration_seconds: number;
  video_width: number;
  video_height: number;
  fps: number;
  status: 'uploaded' | 'processing' | 'analyzed' | 'rendering' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
  clips_count?: number;
  candidates_count?: number;
}

export interface GeneratedClip {
  id: string;
  project_id: string;
  candidate_id?: string;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  video_url: string;
  thumbnail_url?: string;
  subtitle_style: 'bold_viral' | 'clean_minimal' | 'podcast_pro';
  aspect_ratio: string;
  resolution: string;
  file_size_bytes: number;
  render_status: 'pending' | 'rendering' | 'completed' | 'failed';
  error_message?: string;
  viral_score: number;
  category: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  project_id: string;
  job_type: string;
  progress_percentage: number;
  current_step: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  gemini_api_configured: boolean;
  models: {
    transcription: string;
    analysis: string;
  };
}

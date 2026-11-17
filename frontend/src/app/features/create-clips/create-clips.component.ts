import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpEventType } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-create-clips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="create-container">
      <header class="create-header">
        <h1 class="page-title">Create AI Podcast Shorts</h1>
        <p class="page-subtitle">Upload your full episode or paste a YouTube podcast URL. Gemini extracts 5 viral hooks, and FFmpeg renders 1080x1920 vertical shorts with animated subtitles.</p>

        <!-- Mode Tabs -->
        <div class="mode-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            [class.active]="activeTab() === 'upload'"
            (click)="activeTab.set('upload')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload File (MP4, MOV)
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            [class.active]="activeTab() === 'youtube'"
            (click)="activeTab.set('youtube')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
            </svg>
            Paste YouTube URL
          </button>
        </div>
      </header>

      <div class="upload-grid">
        <!-- Left: Upload or YouTube Card -->
        <div class="main-card card">
          @if (activeTab() === 'upload') {
            <!-- Tab 1: Local File Upload -->
            <div class="upload-section" [class.dragging]="isDragging()" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
              @if (!selectedFile()) {
                <div class="drop-zone" (click)="fileInput.click()">
                  <input #fileInput type="file" (change)="onFileSelected($event)" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" style="display: none">
                  
                  <div class="upload-icon-wrapper">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>

                  <h3>Drag & drop your podcast video</h3>
                  <p class="upload-hint">Supports MP4, MOV, WEBM or MKV (up to 2GB, 30-60 min recommended)</p>

                  <button type="button" class="btn btn-secondary browse-btn">
                    Browse Video Files
                  </button>
                </div>
              } @else {
                <div class="selected-file-view">
                  <div class="file-header">
                    <div class="file-info">
                      <span class="file-name">{{ selectedFile()?.name }}</span>
                      <span class="file-size">{{ formatBytes(selectedFile()?.size || 0) }}</span>
                    </div>
                    <button type="button" (click)="removeSelectedFile()" class="btn-icon-danger" title="Remove file">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  @if (videoPreviewUrl()) {
                    <div class="preview-player-container">
                      <video [src]="videoPreviewUrl()" controls class="preview-video"></video>
                    </div>
                  }

                  <div class="form-group">
                    <label class="form-label">Episode Title</label>
                    <input type="text" [(ngModel)]="projectTitle" placeholder="e.g. Scaling to 100k Users Masterclass" class="form-input">
                  </div>

                  @if (isUploading()) {
                    <div class="upload-progress-wrapper">
                      <div class="progress-bar-bg">
                        <div class="progress-bar-fill" [style.width.%]="uploadProgress()"></div>
                      </div>
                      <span class="progress-text">Uploading & validating media: {{ uploadProgress() }}%</span>
                    </div>
                  }

                  @if (errorMessage()) {
                    <div class="error-alert">{{ errorMessage() }}</div>
                  }

                  <div class="action-row">
                    <button (click)="uploadAndGenerate()" [disabled]="isUploading()" class="btn btn-primary btn-lg">
                      @if (isUploading()) {
                        <span class="spinner-small"></span> Uploading...
                      } @else {
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Generate 5 Viral Clips
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- Tab 2: YouTube URL Import -->
            <div class="youtube-section">
              <div class="youtube-intro">
                <div class="yt-badge-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#f43f5e">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="yt-heading">Paste YouTube Podcast Link</h3>
                  <p class="yt-sub">Enter any full podcast or interview link. We'll fetch the stream and run our Gemini clipping engine.</p>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">YouTube URL</label>
                <div class="url-input-wrapper">
                  <input 
                    type="url" 
                    [(ngModel)]="youtubeUrl" 
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..." 
                    class="form-input url-input"
                    (keyup.enter)="fetchUrlInfo()">
                  <button type="button" (click)="fetchUrlInfo()" [disabled]="isFetchingInfo() || !youtubeUrl" class="btn btn-secondary">
                    @if (isFetchingInfo()) {
                      <span class="spinner-small"></span>
                    } @else {
                      Fetch Info
                    }
                  </button>
                </div>
              </div>

              <!-- Fetched Preview Card -->
              @if (urlInfo()) {
                <div class="url-preview-card">
                  @if (urlInfo()?.thumbnail) {
                    <img [src]="urlInfo()?.thumbnail" alt="Video thumbnail" class="yt-thumb">
                  }
                  <div class="yt-meta">
                    <span class="yt-title">{{ urlInfo()?.title }}</span>
                    <div class="yt-submeta">
                      <span>Channel: <strong>{{ urlInfo()?.uploader }}</strong></span>
                      <span>Duration: <strong>{{ formatDuration(urlInfo()?.duration || 0) }}</strong></span>
                    </div>
                  </div>
                </div>
              }

              <div class="form-group" style="margin-top: 16px;">
                <label class="form-label">Custom Title (Optional)</label>
                <input type="text" [(ngModel)]="projectTitle" placeholder="Leave empty to use YouTube title" class="form-input">
              </div>

              @if (errorMessage()) {
                <div class="error-alert">{{ errorMessage() }}</div>
              }

              <div class="action-row" style="margin-top: 20px;">
                <button (click)="importAndGenerate()" [disabled]="isImporting() || !youtubeUrl" class="btn btn-primary btn-lg">
                  @if (isImporting()) {
                    <span class="spinner-small"></span> Ingesting YouTube Stream...
                  } @else {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Import & Generate 5 Clips
                  }
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Right: How ClipForge Works -->
        <div class="pipeline-guide card">
          <h3 class="guide-title">How ClipForge AI Works</h3>
          <div class="guide-steps">
            <div class="guide-step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>Audio & Frame Extraction</h4>
                <p>FFprobe inspects duration and codecs, while FFmpeg extracts clean speech audio.</p>
              </div>
            </div>

            <div class="guide-step">
              <div class="step-num">2</div>
              <div class="step-content">
                <h4>Gemini 3.5 Speech Intelligence</h4>
                <p>Generates word-level timestamps and speaker diarization for pixel-perfect subtitle sync.</p>
              </div>
            </div>

            <div class="guide-step">
              <div class="step-num">3</div>
              <div class="step-content">
                <h4>Gemini 3.8 Multimodal Analysis</h4>
                <p>Identifies high-retention hooks, debates, emotional shifts, and standalone insights.</p>
              </div>
            </div>

            <div class="guide-step">
              <div class="step-num">4</div>
              <div class="step-content">
                <h4>6-Pillar Heuristic Ranking</h4>
                <p>Scores candidates (Hook 25%, Emotion 20%, Value 20%) and selects top 5 non-overlapping clips.</p>
              </div>
            </div>

            <div class="guide-step">
              <div class="step-num">5</div>
              <div class="step-content">
                <h4>FFmpeg 9:16 Vertical Video Render</h4>
                <p>Renders 1080x1920 MP4s with smart background blur and burned animated word highlights.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .create-container {
      padding: 36px 40px;
      max-width: 1400px;
      margin-left: 260px;
    }

    .create-header { margin-bottom: 28px; }
    .page-title { font-size: 2rem; font-weight: 800; color: #fff; }
    .page-subtitle { font-size: 0.95rem; color: var(--text-muted); margin-top: 4px; max-width: 720px; }

    .mode-tabs {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
      &.active {
        color: #fff;
        background: rgba(99, 102, 241, 0.15);
        border-color: var(--primary);
        box-shadow: 0 0 15px var(--primary-glow);
      }
    }

    .upload-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 28px;
    }

    .main-card {
      padding: 36px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
    }

    .upload-section {
      border: 2px dashed rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-sm);
      padding: 24px;
      transition: all 0.2s ease;
      &.dragging { border-color: var(--primary); background: rgba(99, 102, 241, 0.08); }
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 320px;
      cursor: pointer;
      text-align: center;
    }

    .upload-icon-wrapper {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.12);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    h3 { font-size: 1.3rem; font-weight: 700; color: #fff; }
    .upload-hint { font-size: 0.85rem; color: var(--text-dim); margin-top: 6px; margin-bottom: 24px; }
    .browse-btn { pointer-events: none; }

    .selected-file-view { display: flex; flex-direction: column; gap: 20px; }

    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .file-info { display: flex; flex-direction: column; }
    .file-name { font-size: 1.05rem; font-weight: 700; color: #fff; }
    .file-size { font-size: 0.8rem; color: var(--text-dim); }

    .btn-icon-danger {
      color: var(--text-dim);
      padding: 6px;
      border-radius: 6px;
      &:hover { color: var(--accent-rose); background: rgba(244, 63, 94, 0.1); }
    }

    .preview-player-container {
      width: 100%;
      max-height: 260px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-video { width: 100%; max-height: 260px; }

    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .form-input {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;

      &:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
    }

    .url-input-wrapper { display: flex; gap: 10px; }
    .url-input { flex: 1; }

    /* YouTube Styles */
    .youtube-section { display: flex; flex-direction: column; gap: 20px; }
    .youtube-intro { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .yt-badge-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      background: rgba(244, 63, 94, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .yt-heading { font-size: 1.2rem; font-weight: 700; color: #fff; }
    .yt-sub { font-size: 0.85rem; color: var(--text-muted); margin-top: 2px; }

    .url-preview-card {
      display: flex;
      gap: 16px;
      padding: 16px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      align-items: center;
    }

    .yt-thumb {
      width: 130px;
      height: 74px;
      object-fit: cover;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .yt-meta { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
    .yt-title { font-size: 0.95rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .yt-submeta { display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-dim); }

    .upload-progress-wrapper { display: flex; flex-direction: column; gap: 8px; }
    .progress-bar-bg { height: 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent-purple)); border-radius: 4px; transition: width 0.3s ease; }
    .progress-text { font-size: 0.8rem; color: var(--text-muted); }

    .error-alert { padding: 12px 16px; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-sm); color: #fca5a5; font-size: 0.85rem; }

    .action-row { margin-top: 10px; }
    .btn-lg { width: 100%; padding: 14px; font-size: 1.05rem; }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    .pipeline-guide { padding: 32px; background: var(--bg-card); height: fit-content; }
    .guide-title { font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); }
    .guide-steps { display: flex; flex-direction: column; gap: 22px; }
    .guide-step { display: flex; gap: 16px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(99, 102, 241, 0.15); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0; }
    .step-content { h4 { font-size: 0.95rem; font-weight: 700; color: #fff; } p { font-size: 0.85rem; color: var(--text-dim); margin-top: 2px; } }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CreateClipsComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  activeTab = signal<'upload' | 'youtube'>('upload');

  // File Upload State
  selectedFile = signal<File | null>(null);
  videoPreviewUrl = signal<string | null>(null);
  isDragging = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  uploadProgress = signal<number>(0);

  // YouTube State
  youtubeUrl = '';
  urlInfo = signal<{ title: string; duration: number; uploader: string; thumbnail?: string; webpage_url: string } | null>(null);
  isFetchingInfo = signal<boolean>(false);
  isImporting = signal<boolean>(false);

  projectTitle = '';
  errorMessage = signal<string | null>(null);

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      this.handleFile(e.dataTransfer.files[0]);
    }
  }

  onFileSelected(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.handleFile(target.files[0]);
    }
  }

  handleFile(file: File): void {
    this.errorMessage.set(null);
    const validExtensions = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      this.errorMessage.set(`File type '${ext}' not supported. Please select MP4, MOV, WEBM or MKV.`);
      return;
    }

    this.selectedFile.set(file);
    this.projectTitle = file.name.replace(/\.[^/.]+$/, '');
    this.videoPreviewUrl.set(URL.createObjectURL(file));
  }

  removeSelectedFile(): void {
    if (this.videoPreviewUrl()) {
      URL.revokeObjectURL(this.videoPreviewUrl()!);
    }
    this.selectedFile.set(null);
    this.videoPreviewUrl.set(null);
    this.projectTitle = '';
    this.errorMessage.set(null);
  }

  fetchUrlInfo(): void {
    if (!this.youtubeUrl.trim()) return;
    this.isFetchingInfo.set(true);
    this.errorMessage.set(null);

    this.api.inspectUrl(this.youtubeUrl.trim()).subscribe({
      next: (info) => {
        this.urlInfo.set(info);
        if (!this.projectTitle) {
          this.projectTitle = info.title;
        }
        this.isFetchingInfo.set(false);
      },
      error: (err) => {
        this.isFetchingInfo.set(false);
        this.errorMessage.set(err.error?.detail || 'Could not fetch video info from URL. Check if URL is public.');
      }
    });
  }

  importAndGenerate(): void {
    if (!this.youtubeUrl.trim()) return;
    this.isImporting.set(true);
    this.errorMessage.set(null);

    this.api.importUrl(this.youtubeUrl.trim(), this.projectTitle, true).subscribe({
      next: (project) => {
        if (project && project.id) {
          this.router.navigate(['/projects', project.id, 'processing']);
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        this.errorMessage.set(err.error?.detail || 'Failed to import video from URL.');
      }
    });
  }

  uploadAndGenerate(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadProgress.set(5);
    this.errorMessage.set(null);

    this.api.uploadVideoWithProgress(file, this.projectTitle, true).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round((100 * event.loaded) / event.total);
          this.uploadProgress.set(Math.min(95, progress));
        } else if (event.type === HttpEventType.Response) {
          const project = event.body;
          if (project && project.id) {
            this.router.navigate(['/projects', project.id, 'processing']);
          }
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.detail || 'Failed to upload video. Please ensure file is valid.');
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

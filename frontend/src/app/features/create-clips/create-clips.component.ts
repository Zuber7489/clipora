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
        <p class="page-subtitle">Upload your full episode. Gemini will extract 5 viral hooks, and FFmpeg will render vertical 9:16 videos with animated subtitles.</p>
      </header>

      <div class="upload-grid">
        <!-- Left: Upload Card -->
        <div class="card upload-card" [class.dragging]="isDragging()" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
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

              <!-- Video Preview -->
              @if (videoPreviewUrl()) {
                <div class="preview-player-container">
                  <video [src]="videoPreviewUrl()" controls class="preview-video"></video>
                </div>
              }

              <!-- Settings -->
              <div class="form-group">
                <label class="form-label">Episode Title</label>
                <input type="text" [(ngModel)]="projectTitle" placeholder="e.g. Scaling to 100k Users Masterclass" class="form-input">
              </div>

              <!-- Upload Progress -->
              @if (isUploading()) {
                <div class="upload-progress-wrapper">
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" [style.width.%]="uploadProgress()"></div>
                  </div>
                  <span class="progress-text">Uploading & validating media: {{ uploadProgress() }}%</span>
                </div>
              }

              <!-- Error Alert -->
              @if (errorMessage()) {
                <div class="error-alert">
                  {{ errorMessage() }}
                </div>
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

        <!-- Right: What Happens Next info -->
        <div class="pipeline-guide card">
          <h3 class="guide-title">How ClipForge AI Works</h3>
          <div class="guide-steps">
            <div class="guide-step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>Audio & Frame Extraction</h4>
                <p>FFprobe inspects duration and codecs, while FFmpeg extracts 16kHz speech audio.</p>
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
                <p>Renders 1080x1920 MP4s with smart blurred background and burned animated word highlights.</p>
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

    .create-header {
      margin-bottom: 32px;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
    }

    .page-subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-top: 4px;
      max-width: 720px;
    }

    .upload-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 28px;
    }

    .upload-card {
      padding: 36px;
      border: 2px dashed rgba(255, 255, 255, 0.12);
      background: var(--bg-card);
      transition: all 0.2s ease;

      &.dragging {
        border-color: var(--primary);
        background: rgba(99, 102, 241, 0.08);
      }
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 380px;
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

    .selected-file-view {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .file-info {
      display: flex;
      flex-direction: column;
    }

    .file-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
    }

    .file-size {
      font-size: 0.8rem;
      color: var(--text-dim);
    }

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

    .preview-video {
      width: 100%;
      max-height: 260px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-input {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;

      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-glow);
      }
    }

    .upload-progress-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .progress-bar-bg {
      height: 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--accent-purple));
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .error-alert {
      padding: 12px 16px;
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: var(--radius-sm);
      color: #fca5a5;
      font-size: 0.85rem;
    }

    .action-row {
      margin-top: 10px;
    }

    .btn-lg {
      width: 100%;
      padding: 14px;
      font-size: 1.05rem;
    }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    .pipeline-guide {
      padding: 32px;
      background: var(--bg-card);
      height: fit-content;
    }

    .guide-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .guide-steps {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .guide-step {
      display: flex;
      gap: 16px;
    }

    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      color: var(--primary);
      border: 1px solid rgba(99, 102, 241, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.8rem;
      flex-shrink: 0;
    }

    .step-content {
      h4 { font-size: 0.95rem; font-weight: 700; color: #fff; }
      p { font-size: 0.85rem; color: var(--text-dim); margin-top: 2px; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class CreateClipsComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  selectedFile = signal<File | null>(null);
  videoPreviewUrl = signal<string | null>(null);
  isDragging = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  uploadProgress = signal<number>(0);
  errorMessage = signal<string | null>(null);
  projectTitle = '';

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
}

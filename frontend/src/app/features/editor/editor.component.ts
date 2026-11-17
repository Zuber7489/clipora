import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { GeneratedClip } from '../../core/models/project.model';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="editor-container">
      <header class="editor-header">
        <div class="breadcrumbs">
          <a routerLink="/projects">Projects</a>
          <span>/</span>
          <a [routerLink]="['/projects', clip()?.project_id]">Episode Results</a>
          <span>/</span>
          <span class="active">Editor</span>
        </div>
        <div class="title-row">
          <h1 class="page-title">Clip Studio & Reframing Editor</h1>
          @if (clip()) {
            <a [href]="clip()?.video_url?.replace('/stream', '/download')" download class="btn btn-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download MP4
            </a>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state card">
          <div class="spinner"></div>
          <span>Loading clip studio...</span>
        </div>
      } @else if (clip()) {
        <div class="studio-layout">
          <!-- Left: 9:16 Video Player -->
          <div class="player-column">
            <div class="video-container card">
              <video
                #studioVideo
                [src]="clip()?.video_url"
                controls
                playsinline
                class="vertical-preview">
              </video>
            </div>
            <div class="player-caption">
              <span class="badge badge-viral">{{ clip()?.viral_score }}/100 VIRAL</span>
              <span class="badge badge-category">{{ clip()?.category }}</span>
              <span class="pill-info">{{ clip()?.resolution }}</span>
            </div>
          </div>

          <!-- Right: Customization Panel -->
          <div class="controls-column card">
            <h2 class="panel-title">Studio Adjustments</h2>

            <!-- 1. Subtitle Typography -->
            <div class="control-section">
              <label class="section-label">Subtitle Typography</label>
              <div class="options-grid">
                <div class="option-card" [class.selected]="selectedStyle === 'bold_viral'" (click)="selectedStyle = 'bold_viral'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">Bold Viral</span>
                  </div>
                  <p class="option-desc">Yellow karaoke highlight, heavy outline, maximum TikTok engagement</p>
                </div>

                <div class="option-card" [class.selected]="selectedStyle === 'clean_minimal'" (click)="selectedStyle = 'clean_minimal'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">Clean Minimal</span>
                  </div>
                  <p class="option-desc">Crisp white typography with subtle translucent backing pill</p>
                </div>

                <div class="option-card" [class.selected]="selectedStyle === 'podcast_pro'" (click)="selectedStyle = 'podcast_pro'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">Podcast Professional</span>
                  </div>
                  <p class="option-desc">Mint green attribution, lower-third formatting for interviews</p>
                </div>
              </div>
            </div>

            <!-- 2. Reframing & Crop Mode -->
            <div class="control-section">
              <label class="section-label">Vertical 9:16 Reframing Strategy</label>
              <div class="options-grid">
                <div class="option-card" [class.selected]="selectedCrop === 'smart_blur'" (click)="selectedCrop = 'smart_blur'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">Smart Background Blur (Standard)</span>
                  </div>
                  <p class="option-desc">Dual-layer blurred background with centered landscape video</p>
                </div>

                <div class="option-card" [class.selected]="selectedCrop === 'face_tracking'" (click)="selectedCrop = 'face_tracking'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">AI Face Tracking Crop</span>
                  </div>
                  <p class="option-desc">Tracks speaker face center-of-mass and crops to 9:16 full-screen</p>
                </div>

                <div class="option-card" [class.selected]="selectedCrop === 'center_crop'" (click)="selectedCrop = 'center_crop'">
                  <div class="option-header">
                    <span class="radio-circle"></span>
                    <span class="option-title">Center Crop</span>
                  </div>
                  <p class="option-desc">Direct static center cut filling 1080x1920</p>
                </div>
              </div>
            </div>

            <!-- 3. Timestamp Fine-Tuning -->
            <div class="control-section">
              <label class="section-label">Clip Boundaries (Seconds)</label>
              <div class="timing-grid">
                <div class="time-field">
                  <span class="time-label">Start Time</span>
                  <div class="input-with-controls">
                    <button (click)="adjustStart(-0.5)" class="btn-step">-0.5s</button>
                    <input type="number" step="0.1" [(ngModel)]="startTime" class="time-input">
                    <button (click)="adjustStart(0.5)" class="btn-step">+0.5s</button>
                  </div>
                </div>

                <div class="time-field">
                  <span class="time-label">End Time</span>
                  <div class="input-with-controls">
                    <button (click)="adjustEnd(-0.5)" class="btn-step">-0.5s</button>
                    <input type="number" step="0.1" [(ngModel)]="endTime" class="time-input">
                    <button (click)="adjustEnd(0.5)" class="btn-step">+0.5s</button>
                  </div>
                </div>
              </div>
              <div class="duration-readout">
                Calculated Duration: <strong>{{ (endTime - startTime).toFixed(1) }}s</strong>
              </div>
            </div>

            <!-- Submit Re-render -->
            <div class="action-footer">
              <button (click)="reRender()" [disabled]="isRendering() || (endTime <= startTime)" class="btn btn-primary btn-lg">
                @if (isRendering()) {
                  <span class="spinner-small"></span> Rendering 1080x1920 MP4...
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  Re-render Vertical Clip
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .editor-container {
      padding: 36px 40px;
      max-width: 1400px;
      margin-left: 260px;
    }

    .editor-header { margin-bottom: 28px; }

    .breadcrumbs {
      display: flex;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-dim);
      margin-bottom: 8px;
      a { color: var(--primary); &:hover { text-decoration: underline; } }
      .active { color: var(--text-muted); }
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-title {
      font-size: 1.8rem;
      font-weight: 800;
      color: #fff;
    }

    .studio-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 32px;
      align-items: start;
    }

    .player-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .video-container {
      position: relative;
      width: 100%;
      aspect-ratio: 9 / 16;
      background: #000;
      overflow: hidden;
      border-radius: var(--radius-md);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    }

    .vertical-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .player-caption {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge-category {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .pill-info {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
      background: rgba(255, 255, 255, 0.04);
      padding: 3px 8px;
      border-radius: 4px;
    }

    .controls-column {
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .panel-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .control-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .option-card {
      padding: 16px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.02);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover { background: rgba(255, 255, 255, 0.04); }
      &.selected {
        border-color: var(--primary);
        background: rgba(99, 102, 241, 0.12);
        box-shadow: 0 0 15px var(--primary-glow);
      }
    }

    .option-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .radio-circle {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--text-dim);

      .option-card.selected & {
        border-color: var(--primary);
        background: var(--primary);
      }
    }

    .option-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #fff;
    }

    .option-desc {
      font-size: 0.75rem;
      color: var(--text-dim);
      line-height: 1.35;
    }

    .timing-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .time-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .time-label {
      font-size: 0.75rem;
      color: var(--text-dim);
      font-weight: 600;
    }

    .input-with-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .time-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 10px;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.95rem;
      text-align: center;

      &:focus {
        outline: none;
        border-color: var(--primary);
      }
    }

    .btn-step {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }

    .duration-readout {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .action-footer {
      margin-top: 12px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }

    .btn-lg {
      width: 100%;
      padding: 14px;
      font-size: 1rem;
    }

    .loading-state {
      padding: 60px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class EditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  clipId = '';
  clip = signal<GeneratedClip | null>(null);
  loading = signal<boolean>(true);
  isRendering = signal<boolean>(false);

  selectedStyle = 'bold_viral';
  selectedCrop = 'smart_blur';
  startTime = 0.0;
  endTime = 30.0;

  ngOnInit(): void {
    this.clipId = this.route.snapshot.paramMap.get('clipId') || '';
    if (!this.clipId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.loadClip();
  }

  loadClip(): void {
    this.loading.set(true);
    this.api.getClip(this.clipId).subscribe({
      next: (data) => {
        this.clip.set(data);
        this.selectedStyle = data.subtitle_style || 'bold_viral';
        this.startTime = data.start_time;
        this.endTime = data.end_time;
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  adjustStart(delta: number): void {
    const next = Math.max(0, +(this.startTime + delta).toFixed(1));
    if (next < this.endTime - 2.0) {
      this.startTime = next;
    }
  }

  adjustEnd(delta: number): void {
    const next = +(this.endTime + delta).toFixed(1);
    if (next > this.startTime + 2.0) {
      this.endTime = next;
    }
  }

  reRender(): void {
    this.isRendering.set(true);
    this.api.reRenderClip(this.clipId, {
      subtitle_style: this.selectedStyle,
      crop_mode: this.selectedCrop,
      start_time: this.startTime,
      end_time: this.endTime
    } as any).subscribe({
      next: (updated) => {
        this.isRendering.set(false);
        // Add cachebuster to video url so browser player updates
        updated.video_url = `${updated.video_url}?t=${Date.now()}`;
        this.clip.set(updated);
      },
      error: () => {
        this.isRendering.set(false);
      }
    });
  }
}

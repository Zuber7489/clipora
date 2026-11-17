import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project, GeneratedClip } from '../../core/models/project.model';

@Component({
  selector: 'app-project-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="results-container">
      <header class="results-header">
        <div>
          <div class="breadcrumbs">
            <a routerLink="/projects">Projects</a>
            <span>/</span>
            <span class="active">{{ project()?.title }}</span>
          </div>
          <h1 class="page-title">{{ project()?.title }}</h1>
          <p class="page-subtitle">5 AI-extracted vertical clips ready for TikTok, Instagram Reels and YouTube Shorts.</p>
        </div>

        <div class="header-actions">
          <button (click)="downloadAll()" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download All 5 Clips
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state card">
          <div class="spinner"></div>
          <span>Loading generated clips...</span>
        </div>
      } @else if (clips().length === 0) {
        <div class="empty-state card">
          <h3>No clips found</h3>
          <p>Processing may still be running for this episode.</p>
          <a [routerLink]="['/projects', projectId, 'processing']" class="btn btn-secondary">Check Processing Status</a>
        </div>
      } @else {
        <!-- 5 Vertical Clips Grid -->
        <div class="clips-grid">
          @for (clip of clips(); track clip.id; let idx = $index) {
            <div class="clip-card card">
              <!-- 9:16 Video Player -->
              <div class="video-wrapper">
                <video
                  #videoPlayer
                  [src]="clip.video_url"
                  [poster]="clip.thumbnail_url || ''"
                  controls
                  playsinline
                  preload="metadata"
                  class="vertical-video">
                </video>
                <div class="clip-badge-overlay">
                  <span class="badge badge-viral">{{ clip.viral_score }}/100 VIRAL</span>
                  <span class="badge badge-category">{{ clip.category }}</span>
                </div>
              </div>

              <!-- Clip Metadata & Info -->
              <div class="clip-body">
                <div class="clip-title-row">
                  <span class="clip-index">#{{ idx + 1 }}</span>
                  <h3 class="clip-title" [title]="clip.title">{{ clip.title }}</h3>
                </div>

                <div class="clip-stats">
                  <div class="stat-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>{{ formatDuration(clip.duration) }}</span>
                  </div>
                  <div class="stat-pill">
                    <span>{{ formatTimestamp(clip.start_time) }} - {{ formatTimestamp(clip.end_time) }}</span>
                  </div>
                  <div class="stat-pill style-pill">
                    <span>{{ formatStyleName(clip.subtitle_style) }}</span>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="clip-actions">
                  <a [href]="clip.video_url.replace('/stream', '/download')" download class="btn btn-success btn-download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                  </a>

                  <a [routerLink]="['/editor', clip.id]" class="btn btn-primary btn-icon" title="Open Studio Editor">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon>
                      <line x1="3" y1="22" x2="21" y2="22"></line>
                    </svg>
                  </a>

                  <button (click)="openStyleModal(clip)" class="btn btn-secondary btn-icon" title="Quick Style Modal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Customization Modal -->
      @if (activeModalClip()) {
        <div class="modal-backdrop" (click)="closeStyleModal()">
          <div class="modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Customize Subtitle Style</h3>
              <button (click)="closeStyleModal()" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <p class="modal-desc">Choose typography style to burn into <strong>{{ activeModalClip()?.title }}</strong>:</p>

              <div class="style-options">
                <label class="style-choice" [class.selected]="selectedStyle === 'bold_viral'">
                  <input type="radio" name="subtitleStyle" value="bold_viral" [(ngModel)]="selectedStyle">
                  <div class="style-info">
                    <span class="style-name">Bold Viral (Recommended)</span>
                    <span class="style-detail">Yellow animated word pop, heavy outline, maximum TikTok/Reels engagement</span>
                  </div>
                </label>

                <label class="style-choice" [class.selected]="selectedStyle === 'clean_minimal'">
                  <input type="radio" name="subtitleStyle" value="clean_minimal" [(ngModel)]="selectedStyle">
                  <div class="style-info">
                    <span class="style-name">Clean Minimal</span>
                    <span class="style-detail">Crisp white typography with subtle translucent backing</span>
                  </div>
                </label>

                <label class="style-choice" [class.selected]="selectedStyle === 'podcast_pro'">
                  <input type="radio" name="subtitleStyle" value="podcast_pro" [(ngModel)]="selectedStyle">
                  <div class="style-info">
                    <span class="style-name">Podcast Professional</span>
                    <span class="style-detail">Mint green highlights, lower-third formatting for interviews</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button (click)="closeStyleModal()" class="btn btn-secondary">Cancel</button>
              <button (click)="reRenderActiveClip()" [disabled]="isReRendering()" class="btn btn-primary">
                @if (isReRendering()) {
                  <span class="spinner-small"></span> Re-rendering MP4...
                } @else {
                  Re-render Clip
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .results-container {
      padding: 36px 40px;
      max-width: 1400px;
      margin-left: 260px;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 32px;
    }

    .breadcrumbs {
      display: flex;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-dim);
      margin-bottom: 8px;
      a { color: var(--primary); &:hover { text-decoration: underline; } }
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
    }

    .clips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
    }

    .clip-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      transition: transform 0.2s ease, border-color 0.2s ease;

      &:hover {
        transform: translateY(-4px);
        border-color: rgba(99, 102, 241, 0.4);
      }
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 9 / 16;
      background: #000;
      overflow: hidden;
    }

    .vertical-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .clip-badge-overlay {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
      z-index: 5;
    }

    .badge-category {
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .clip-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 12px;
    }

    .clip-title-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .clip-index {
      font-weight: 800;
      color: var(--primary);
      font-size: 0.95rem;
    }

    .clip-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .clip-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: var(--text-dim);
      background: rgba(255, 255, 255, 0.04);
      padding: 3px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);

      &.style-pill {
        color: var(--accent-purple);
        border: 1px solid rgba(168, 85, 247, 0.2);
      }
    }

    .clip-actions {
      display: flex;
      gap: 8px;
      margin-top: auto;
      padding-top: 8px;
    }

    .btn-download {
      flex: 1;
      font-size: 0.85rem;
      padding: 8px 12px;
    }

    .btn-icon {
      padding: 8px 12px;
    }

    .loading-state, .empty-state {
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

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-dialog {
      width: 100%;
      max-width: 520px;
      padding: 28px;
      background: var(--bg-card);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      h3 { font-size: 1.25rem; font-weight: 700; color: #fff; }
    }

    .btn-close {
      font-size: 1.5rem;
      color: var(--text-dim);
      &:hover { color: #fff; }
    }

    .modal-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .style-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .style-choice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover { background: rgba(255, 255, 255, 0.02); }
      &.selected {
        border-color: var(--primary);
        background: rgba(99, 102, 241, 0.1);
      }
    }

    .style-name {
      display: block;
      font-weight: 700;
      color: #fff;
      font-size: 0.9rem;
    }

    .style-detail {
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ProjectResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  projectId = '';
  project = signal<Project | null>(null);
  clips = signal<GeneratedClip[]>([]);
  loading = signal<boolean>(true);

  activeModalClip = signal<GeneratedClip | null>(null);
  selectedStyle = 'bold_viral';
  isReRendering = signal<boolean>(false);

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.loadProjectAndClips();
  }

  loadProjectAndClips(): void {
    this.loading.set(true);
    this.api.getProject(this.projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        this.api.getClips(this.projectId).subscribe({
          next: (clipList) => {
            this.clips.set(clipList);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  openStyleModal(clip: GeneratedClip): void {
    this.activeModalClip.set(clip);
    this.selectedStyle = clip.subtitle_style || 'bold_viral';
  }

  closeStyleModal(): void {
    this.activeModalClip.set(null);
  }

  reRenderActiveClip(): void {
    const clip = this.activeModalClip();
    if (!clip) return;

    this.isReRendering.set(true);
    this.api.reRenderClip(clip.id, { subtitle_style: this.selectedStyle }).subscribe({
      next: (updatedClip) => {
        this.isReRendering.set(false);
        this.closeStyleModal();
        this.loadProjectAndClips();
      },
      error: () => {
        this.isReRendering.set(false);
      }
    });
  }

  downloadAll(): void {
    for (const c of this.clips()) {
      const link = document.createElement('a');
      link.href = c.video_url.replace('/stream', '/download');
      link.download = `${c.title}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  formatDuration(secs: number): string {
    const s = Math.round(secs);
    return `${s}s`;
  }

  formatTimestamp(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  formatStyleName(style: string): string {
    switch (style) {
      case 'clean_minimal': return 'Clean Minimal';
      case 'podcast_pro': return 'Podcast Pro';
      default: return 'Bold Viral';
    }
  }
}

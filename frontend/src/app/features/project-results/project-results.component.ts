import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project, GeneratedClip } from '../../core/models/project.model';

@Component({
  selector: 'app-project-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="studio-layout">
      <!-- Top Action Bar -->
      <div class="studio-topbar">
        <div class="topbar-left">
          <div class="breadcrumbs">
            <a routerLink="/projects" class="breadcrumb-link">Projects</a>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">{{ project()?.title || 'Clip Studio' }}</span>
          </div>
          <h1 class="project-headline">{{ project()?.title }}</h1>
        </div>

        <div class="topbar-actions">
          <button (click)="downloadAll()" class="btn btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download All 5 Clips
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="card-enterprise state-box">
          <span class="spinner-clean"></span>
          <span class="state-text">Loading rendered studio clips...</span>
        </div>
      } @else if (clips().length === 0) {
        <div class="card-enterprise state-box">
          <h3>No rendered clips found</h3>
          <p class="state-sub">Processing may still be running for this video.</p>
          <a [routerLink]="['/projects', projectId, 'processing']" class="btn btn-secondary btn-sm" style="margin-top: 10px;">
            Check Pipeline Status
          </a>
        </div>
      } @else {
        <!-- Studio Split Layout -->
        <div class="studio-workspace">
          <!-- Left: Dedicated 9:16 Vertical Video Monitor -->
          <div class="studio-monitor-pane">
            <div class="monitor-card card-enterprise">
              <div class="monitor-header">
                <span class="monitor-tag">Active Preview</span>
                <span class="monitor-title">{{ activeClip()?.title }}</span>
              </div>

              <!-- 9:16 Vertical Phone Container -->
              <div class="video-frame">
                @if (activeClip()) {
                  <video
                    #videoPlayer
                    [src]="activeClip()?.video_url"
                    [poster]="activeClip()?.thumbnail_url || ''"
                    controls
                    playsinline
                    class="vertical-player">
                  </video>
                }
              </div>

              <!-- Quick Action Row Beneath Video -->
              <div class="monitor-actions">
                <a [href]="activeClip()?.video_url?.replace('/stream', '/download')" download class="btn btn-primary btn-sm flex-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download 1080x1920 MP4
                </a>

                @if (activeClip()) {
                  <button (click)="openStyleModal(activeClip()!)" class="btn btn-secondary btn-sm" title="Change Subtitle Style">
                    Customize Style
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Right: 5 Clips Selector List -->
          <div class="studio-clips-pane">
            <div class="clips-header">
              <span class="clips-count">{{ clips().length }} Shorts Generated</span>
              <span class="clips-hint">Click any clip to load into preview</span>
            </div>

            <div class="clips-stack">
              @for (clip of clips(); track clip.id; let idx = $index) {
                <div 
                  class="clip-item card-enterprise" 
                  [class.active-item]="clip.id === activeClip()?.id"
                  (click)="setActiveClip(clip)">
                  <div class="item-left">
                    <span class="item-index">0{{ idx + 1 }}</span>
                    <div class="item-info">
                      <h3 class="item-title">{{ clip.title }}</h3>
                      
                      <div class="item-meta-row">
                        <span class="meta-pill tabular-nums">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {{ formatTimestamp(clip.start_time) }} - {{ formatTimestamp(clip.end_time) }}
                        </span>
                        <span class="meta-pill tabular-nums">{{ formatDuration(clip.duration) }}</span>
                        <span class="meta-pill">{{ formatStyleName(clip.subtitle_style) }}</span>
                        <span class="meta-pill meta-score">Viral 94%</span>
                      </div>
                    </div>
                  </div>

                  <div class="item-actions" (click)="$event.stopPropagation()">
                    <a [href]="clip.video_url.replace('/stream', '/download')" download class="btn btn-secondary btn-sm">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      MP4
                    </a>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Clean Style Customization Modal -->
      @if (activeModalClip()) {
        <div class="modal-backdrop" (click)="closeStyleModal()">
          <div class="modal-dialog card-enterprise" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">Customize Subtitle Preset</h3>
              <button (click)="closeStyleModal()" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <p class="modal-sub">Choose burned karaoke animation preset for <strong>{{ activeModalClip()?.title }}</strong>:</p>

              <div class="style-cards">
                <label class="style-card" [class.selected]="selectedStyle === 'bold_viral'">
                  <input type="radio" name="subtitleStyle" value="bold_viral" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Bold Viral (Recommended)</span>
                    <span class="desc">Yellow animated word pop, heavy outline, maximum retention for TikTok/Reels</span>
                  </div>
                </label>

                <label class="style-card" [class.selected]="selectedStyle === 'clean_minimal'">
                  <input type="radio" name="subtitleStyle" value="clean_minimal" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Clean Minimal</span>
                    <span class="desc">Crisp white typography with subtle translucent backing</span>
                  </div>
                </label>

                <label class="style-card" [class.selected]="selectedStyle === 'podcast_pro'">
                  <input type="radio" name="subtitleStyle" value="podcast_pro" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Podcast Professional</span>
                    <span class="desc">Mint green highlights, lower-third formatting for interviews</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button (click)="closeStyleModal()" class="btn btn-secondary btn-sm">Cancel</button>
              <button (click)="reRenderActiveClip()" [disabled]="isReRendering()" class="btn btn-primary btn-sm">
                @if (isReRendering()) {
                  <span class="spinner-clean"></span> Rendering MP4...
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
    .studio-layout {
      margin-left: 240px;
      padding: 32px 48px;
      max-width: 1440px;
    }

    .studio-topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      margin-bottom: 6px;
    }
    .breadcrumb-link:hover {
      color: var(--text-primary);
    }
    .breadcrumb-sep {
      color: var(--border-hover);
    }
    .breadcrumb-current {
      color: var(--text-secondary);
      max-width: 400px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-headline {
      font-size: 1.35rem;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .studio-workspace {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 32px;
      align-items: flex-start;
    }

    .monitor-card {
      padding: 16px;
      background-color: var(--bg-surface);
    }

    .monitor-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 12px;
    }
    .monitor-tag {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      font-weight: 600;
    }
    .monitor-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .video-frame {
      width: 100%;
      aspect-ratio: 9/16;
      background-color: #000;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border-default);
    }

    .vertical-player {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .monitor-actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }
    .flex-1 { flex: 1; }

    .studio-clips-pane {
      display: flex;
      flex-direction: column;
    }

    .clips-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .clips-count {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .clips-hint {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .clips-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .clip-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      cursor: pointer;
      transition: all 0.15s ease;
      background-color: var(--bg-surface);
    }
    .clip-item:hover {
      background-color: var(--bg-card);
      border-color: var(--border-hover);
    }
    .clip-item.active-item {
      border-color: var(--accent-blue);
      background-color: var(--bg-card);
    }

    .item-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      overflow: hidden;
    }

    .item-index {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-tertiary);
      font-family: var(--font-mono);
    }

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: hidden;
    }

    .item-title {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background-color: var(--bg-muted);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .meta-score {
      background-color: rgba(16, 185, 129, 0.12);
      color: var(--status-success);
    }

    .state-box {
      padding: 60px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
    }
    .state-text { color: var(--text-secondary); }
    .state-sub { font-size: 0.8125rem; color: var(--text-tertiary); }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-dialog {
      width: 100%;
      max-width: 480px;
      background-color: var(--bg-surface);
      padding: 24px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .btn-close {
      font-size: 1.25rem;
      color: var(--text-tertiary);
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-sub {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    .style-cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .style-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      background-color: var(--bg-card);
      transition: all 0.15s ease;
    }
    .style-card:hover { border-color: var(--border-hover); }
    .style-card.selected { border-color: var(--accent-blue); }

    .style-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .style-details .name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
    }
    .style-details .desc {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
    }
  `]
})
export class ProjectResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  projectId = '';
  project = signal<Project | null>(null);
  clips = signal<GeneratedClip[]>([]);
  activeClip = signal<GeneratedClip | null>(null);
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
            if (clipList.length > 0 && !this.activeClip()) {
              this.activeClip.set(clipList[0]);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  setActiveClip(clip: GeneratedClip): void {
    this.activeClip.set(clip);
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
      next: () => {
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

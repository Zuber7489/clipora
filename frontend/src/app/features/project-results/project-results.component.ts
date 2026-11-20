import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
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
            Download All {{ clips().length }} Clips
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
                  <button (click)="openStyleModal(activeClip()!)" class="btn btn-secondary btn-sm" title="Customize Layout Template and Subtitles">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    Templates & Style
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
                        <span class="meta-pill meta-template">{{ formatTemplateName(clip.crop_mode || clip.aspect_ratio) }}</span>
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

      <!-- Clean Layout & Style Customization Modal -->
      @if (activeModalClip()) {
        <div class="modal-backdrop" (click)="closeStyleModal()">
          <div class="modal-dialog card-enterprise" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-box">
                <h3 class="modal-title">Customize Template & Subtitles</h3>
                <span class="modal-clip-name">{{ activeModalClip()?.title }}</span>
              </div>
              <button (click)="closeStyleModal()" class="btn-close">&times;</button>
            </div>

            <div class="modal-body-scroll">
              <!-- Section 1: Social Layout Template -->
              <div class="modal-section">
                <label class="section-label">1. Video Layout Template</label>
                <div class="template-grid">
                  <label class="template-card" [class.selected]="selectedCropMode === 'streamer_split'" (click)="selectedCropMode = 'streamer_split'">
                    <input type="radio" name="cropMode" value="streamer_split" [(ngModel)]="selectedCropMode">
                    <div class="template-mini split-mini">
                      <div class="mini-top">Streamer</div>
                      <div class="mini-divider"></div>
                      <div class="mini-bottom">Gameplay</div>
                    </div>
                    <div class="t-details">
                      <span class="t-name">Streamer Split</span>
                      <span class="t-desc">Top webcam, bottom gameplay stream (TikTok & Reels)</span>
                    </div>
                  </label>

                  <label class="template-card" [class.selected]="selectedCropMode === 'twitter_post'" (click)="selectedCropMode = 'twitter_post'">
                    <input type="radio" name="cropMode" value="twitter_post" [(ngModel)]="selectedCropMode">
                    <div class="template-mini twitter-mini">
                      <div class="mini-tw-bar">
                        <span class="tw-dot"></span>
                        <span class="tw-badge">𝕏</span>
                      </div>
                      <div class="mini-tw-vid">Framed Video</div>
                    </div>
                    <div class="t-details">
                      <span class="t-name">Twitter / X Post</span>
                      <span class="t-desc">Dark card with avatar, verified badge & hook text</span>
                    </div>
                  </label>

                  <label class="template-card" [class.selected]="selectedCropMode === 'smart_blur'" (click)="selectedCropMode = 'smart_blur'">
                    <input type="radio" name="cropMode" value="smart_blur" [(ngModel)]="selectedCropMode">
                    <div class="template-mini blur-mini">
                      <div class="mini-blur-bg"></div>
                      <div class="mini-sharp-fg">16:9</div>
                    </div>
                    <div class="t-details">
                      <span class="t-name">Smart Blur</span>
                      <span class="t-desc">9:16 blurred backdrop with sharp centered video</span>
                    </div>
                  </label>

                  <label class="template-card" [class.selected]="selectedCropMode === 'center_crop'" (click)="selectedCropMode = 'center_crop'">
                    <input type="radio" name="cropMode" value="center_crop" [(ngModel)]="selectedCropMode">
                    <div class="template-mini focus-mini">
                      <div class="mini-focus">9:16 Full</div>
                    </div>
                    <div class="t-details">
                      <span class="t-name">Center Focus</span>
                      <span class="t-desc">Minimalist 9:16 portrait crop</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Section 2: Subtitle Presets -->
              <div class="modal-section" style="margin-top: 20px;">
                <label class="section-label">2. Burned Karaoke Subtitles</label>
                <div class="style-cards">
                  <label class="style-card" [class.selected]="selectedStyle === 'bold_viral'" (click)="selectedStyle = 'bold_viral'">
                    <input type="radio" name="subtitleStyle" value="bold_viral" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Bold Viral (Recommended)</span>
                      <span class="desc">Yellow animated word pop, heavy outline, maximum retention for TikTok/Reels</span>
                    </div>
                  </label>

                  <label class="style-card" [class.selected]="selectedStyle === 'clean_minimal'" (click)="selectedStyle = 'clean_minimal'">
                    <input type="radio" name="subtitleStyle" value="clean_minimal" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Clean Minimal</span>
                      <span class="desc">Crisp white typography with subtle translucent backing</span>
                    </div>
                  </label>

                  <label class="style-card" [class.selected]="selectedStyle === 'podcast_pro'" (click)="selectedStyle = 'podcast_pro'">
                    <input type="radio" name="subtitleStyle" value="podcast_pro" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Podcast Professional</span>
                      <span class="desc">Mint green highlights, lower-third formatting for interviews</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button (click)="closeStyleModal()" class="btn btn-secondary btn-sm">Cancel</button>
              <button (click)="reRenderActiveClip()" [disabled]="isReRendering()" class="btn btn-primary btn-sm">
                @if (isReRendering()) {
                  <span class="spinner-clean"></span> Rendering Clip...
                } @else {
                  Apply & Re-render Clip
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
      max-width: 620px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-surface);
      padding: 24px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .modal-title-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-clip-name {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      max-width: 500px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-close {
      font-size: 1.25rem;
      color: var(--text-tertiary);
      cursor: pointer;
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-body-scroll {
      overflow-y: auto;
      max-height: calc(90vh - 150px);
      padding-right: 6px;
    }

    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 10px;
    }

    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .template-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .template-card input[type="radio"] { display: none; }
    .template-card:hover { border-color: var(--border-hover); }
    .template-card.selected {
      border-color: var(--accent-blue);
      background-color: rgba(37, 99, 235, 0.08);
    }

    .template-mini {
      width: 100%;
      height: 64px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      position: relative;
    }

    .split-mini {
      display: flex;
      flex-direction: column;
      background: #000;
    }
    .mini-top {
      flex: 1;
      background: #1e293b;
      font-size: 8px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
    }
    .mini-divider {
      height: 2px;
      background: var(--accent-blue);
    }
    .mini-bottom {
      flex: 1;
      background: #09090b;
      font-size: 8px;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
    }

    .twitter-mini {
      display: flex;
      flex-direction: column;
      padding: 6px;
      gap: 4px;
      background: #000;
    }
    .mini-tw-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tw-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #2563eb;
    }
    .tw-badge {
      font-size: 9px;
      color: #a1a1aa;
      font-weight: bold;
    }
    .mini-tw-vid {
      flex: 1;
      background: #18181b;
      border-radius: 4px;
      font-size: 8px;
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .blur-mini {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    .mini-blur-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #1e1b4b, #09090b);
      opacity: 0.7;
    }
    .mini-sharp-fg {
      position: relative;
      z-index: 1;
      width: 80%;
      height: 38px;
      background: #09090b;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      font-size: 8px;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .focus-mini {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    .mini-focus {
      width: 44px;
      height: 100%;
      background: #18181b;
      border-left: 1px solid var(--border-hover);
      border-right: 1px solid var(--border-hover);
      font-size: 8px;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .t-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .t-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .t-desc {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      line-height: 1.25;
    }

    .meta-template {
      background-color: rgba(37, 99, 235, 0.12);
      color: var(--accent-blue);
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
    .style-card input[type="radio"] { display: none; }
    .style-card:hover { border-color: var(--border-hover); }
    .style-card.selected {
      border-color: var(--accent-blue);
      background-color: rgba(37, 99, 235, 0.08);
    }

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
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
    }
  `]
})
export class ProjectResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  @ViewChild('videoPlayer') videoPlayerRef?: ElementRef<HTMLVideoElement>;

  projectId = '';
  project = signal<Project | null>(null);
  clips = signal<GeneratedClip[]>([]);
  activeClip = signal<GeneratedClip | null>(null);
  loading = signal<boolean>(true);

  activeModalClip = signal<GeneratedClip | null>(null);
  selectedCropMode = 'streamer_split';
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
    this.selectedCropMode = clip.crop_mode || (clip.aspect_ratio && clip.aspect_ratio !== '9:16' ? clip.aspect_ratio : 'streamer_split');
  }

  closeStyleModal(): void {
    this.activeModalClip.set(null);
  }

  reRenderActiveClip(): void {
    const clip = this.activeModalClip();
    if (!clip) return;

    this.isReRendering.set(true);
    this.api.reRenderClip(clip.id, {
      subtitle_style: this.selectedStyle,
      crop_mode: this.selectedCropMode
    }).subscribe({
      next: (updatedClip) => {
        this.isReRendering.set(false);
        this.closeStyleModal();
        const cleanBaseUrl = updatedClip.video_url.split('?')[0];
        const cacheBusted: GeneratedClip = {
          ...updatedClip,
          crop_mode: this.selectedCropMode,
          aspect_ratio: this.selectedCropMode,
          video_url: `${cleanBaseUrl}?t=${Date.now()}`,
          thumbnail_url: updatedClip.thumbnail_url ? `${updatedClip.thumbnail_url.split('?')[0]}?t=${Date.now()}` : undefined
        };
        this.clips.update(list => list.map(c => c.id === clip.id ? cacheBusted : c));
        if (this.activeClip()?.id === clip.id) {
          this.activeClip.set(cacheBusted);
        }
        setTimeout(() => {
          if (this.videoPlayerRef?.nativeElement) {
            this.videoPlayerRef.nativeElement.load();
            this.videoPlayerRef.nativeElement.play().catch(() => {});
          }
        }, 80);
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

  formatTemplateName(mode: string | undefined): string {
    switch (mode) {
      case 'streamer_split': return 'Streamer Split';
      case 'twitter_post': return 'Twitter / X';
      case 'center_crop': return 'Center Focus';
      case 'split_stacked': return 'Podcast Split';
      default: return 'Smart Blur';
    }
  }
}

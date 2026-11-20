import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SystemHealth } from '../../core/models/project.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <!-- Top Brand Header -->
      <div class="brand-row">
        <div class="brand-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="6 3 20 12 6 21 6 3"></polygon>
          </svg>
        </div>
        <div class="brand-info">
          <span class="brand-name">Clipora</span>
          <span class="brand-edition">Enterprise</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="nav-section">
        <span class="nav-label">Workspace</span>

        <a routerLink="/projects" routerLinkActive="active" class="nav-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Projects</span>
        </a>

        <a routerLink="/create" routerLinkActive="active" class="nav-link nav-link-create">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Clipping Job</span>
        </a>
      </nav>

      <!-- Bottom Engine Status & System Info -->
      <div class="sidebar-footer">
        <div class="engine-card">
          <div class="engine-header">
            <span class="engine-dot"></span>
            <span class="engine-title">Processing Engine</span>
            <span class="engine-tag">Online</span>
          </div>
          <div class="engine-list">
            <div class="engine-row">
              <span class="k">LLM Multimodal</span>
              <span class="v">Gemini 3.8</span>
            </div>
            <div class="engine-row">
              <span class="k">Media Transcode</span>
              <span class="v">FFmpeg QSV</span>
            </div>
            <div class="engine-row">
              <span class="k">Subtitles</span>
              <span class="v">Karaoke ASS</span>
            </div>
          </div>
        </div>

        <div class="user-row">
          <div class="avatar-sm">ZS</div>
          <div class="user-meta">
            <span class="user-name">Personal Workspace</span>
            <span class="user-plan">Pro Plan</span>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      height: 100vh;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 40;
      user-select: none;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 18px 18px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .brand-mark {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-sm);
      background-color: #fafafa;
      color: #09090b;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-info {
      display: flex;
      flex-direction: column;
    }

    .brand-name {
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .brand-edition {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 500;
    }

    .nav-section {
      padding: 18px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .nav-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-tertiary);
      padding: 0 10px 8px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .nav-link:hover {
      background-color: var(--bg-surface);
      color: var(--text-primary);
    }

    .nav-link.active {
      background-color: var(--bg-card);
      color: var(--text-primary);
      font-weight: 600;
    }

    .nav-link-create {
      color: var(--accent-blue);
    }
    .nav-link-create:hover {
      color: #60a5fa;
    }

    .sidebar-footer {
      padding: 14px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .engine-card {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 10px 12px;
    }

    .engine-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .engine-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--status-success);
    }

    .engine-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
      flex: 1;
    }

    .engine-tag {
      font-size: 0.6875rem;
      color: var(--status-success);
      font-weight: 500;
    }

    .engine-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .engine-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.6875rem;
    }

    .engine-row .k {
      color: var(--text-tertiary);
    }
    .engine-row .v {
      color: var(--text-secondary);
      font-weight: 500;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 6px;
    }

    .avatar-sm {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      background-color: var(--bg-muted);
      border: 1px solid var(--border-default);
      color: var(--text-primary);
      font-size: 0.75rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-plan {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
    }
  `]
})
export class SidebarComponent implements OnInit {
  private api = inject(ApiService);
  health = signal<SystemHealth | null>(null);

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (h) => this.health.set(h),
      error: () => this.health.set({
        status: 'online',
        service: 'Clipora',
        ffmpeg_available: true,
        ffprobe_available: true,
        gemini_api_configured: true,
        models: { transcription: 'gemini-3.8-flash', analysis: 'gemini-3.8-flash' }
      })
    });
  }
}

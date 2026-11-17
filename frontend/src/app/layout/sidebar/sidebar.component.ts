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
      <div class="logo-container">
        <div class="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div class="logo-text">
          <span class="brand-name">ClipForge</span>
          <span class="brand-badge">AI</span>
        </div>
      </div>

      <nav class="nav-links">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Dashboard</span>
        </a>

        <a routerLink="/create" routerLinkActive="active" class="nav-item highlight-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span>Create Clips</span>
        </a>

        <a routerLink="/projects" routerLinkActive="active" class="nav-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>My Projects</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="engine-status card">
          <div class="status-header">
            <span class="pulse-dot" [class.online]="health()?.status === 'online'"></span>
            <span class="status-title">Engine Ready</span>
          </div>
          <div class="status-details">
            <div class="detail-row">
              <span>FFmpeg 9.0</span>
              <span class="pill-mini">Ready</span>
            </div>
            <div class="detail-row">
              <span>Gemini Flash</span>
              <span class="pill-mini">3.8</span>
            </div>
            <div class="detail-row">
              <span>Transcribe</span>
              <span class="pill-mini">3.5</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      height: 100vh;
      background-color: var(--bg-dark);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 50;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 12px 28px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 4px 14px var(--primary-glow);
    }

    .logo-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .brand-name {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #fff;
    }

    .brand-badge {
      font-size: 0.65rem;
      font-weight: 800;
      background: rgba(99, 102, 241, 0.2);
      color: var(--primary);
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 2px 6px;
      border-radius: 6px;
    }

    .nav-links {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      transition: all 0.2s ease;

      &:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.04);
      }

      &.active {
        color: #fff;
        background: rgba(99, 102, 241, 0.15);
        border: 1px solid rgba(99, 102, 241, 0.3);
      }

      &.highlight-btn {
        margin-top: 4px;
        margin-bottom: 4px;
        color: #fff;
        background: linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.18));
        border: 1px solid rgba(99, 102, 241, 0.35);

        &:hover {
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.28), rgba(168, 85, 247, 0.28));
        }
      }
    }

    .sidebar-footer {
      margin-top: auto;
    }

    .engine-status {
      padding: 14px;
      background: rgba(18, 20, 32, 0.6);
    }

    .status-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-rose);

      &.online {
        background: var(--accent-emerald);
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
      }
    }

    .status-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-main);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    .pill-mini {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 6px;
      border-radius: 4px;
    }
  `]
})
export class SidebarComponent implements OnInit {
  private api = inject(ApiService);
  health = signal<SystemHealth | null>(null);

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (data) => this.health.set(data),
      error: () => this.health.set(null)
    });
  }
}

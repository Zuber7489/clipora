import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div>
          <h1 class="page-title">Podcast Studio Dashboard</h1>
          <p class="page-subtitle">Turn 30-minute long-form conversations into 5 high-converting vertical shorts.</p>
        </div>
        <a routerLink="/create" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Upload New Podcast
        </a>
      </header>

      <!-- Stats Grid -->
      <section class="stats-grid">
        <div class="stat-card card">
          <div class="stat-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 10l5 5-5 5"></path>
              <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total Projects</span>
            <span class="stat-val">{{ projects().length }}</span>
          </div>
        </div>

        <div class="stat-card card">
          <div class="stat-icon emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">AI Clips Rendered</span>
            <span class="stat-val">{{ totalClipsCount() }}</span>
          </div>
        </div>

        <div class="stat-card card">
          <div class="stat-icon cyan">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Export Target</span>
            <span class="stat-val">1080x1920 (9:16)</span>
          </div>
        </div>

        <div class="stat-card card">
          <div class="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Intelligence</span>
            <span class="stat-val">Gemini 3.8 + FFmpeg</span>
          </div>
        </div>
      </section>

      <!-- Projects Section -->
      <section class="section-container">
        <div class="section-header">
          <h2 class="section-title">Recent Podcast Sessions</h2>
          <a routerLink="/projects" class="section-link">View all &rarr;</a>
        </div>

        @if (loading()) {
          <div class="loading-state card">
            <div class="spinner"></div>
            <span>Loading projects...</span>
          </div>
        } @else if (projects().length === 0) {
          <div class="empty-state card">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3>No Podcast Projects Yet</h3>
            <p>Upload your first full-length episode to generate 5 AI viral short clips with animated subtitles.</p>
            <a routerLink="/create" class="btn btn-primary">Upload First Episode</a>
          </div>
        } @else {
          <div class="projects-table-wrapper card">
            <table class="projects-table">
              <thead>
                <tr>
                  <th>Episode Title</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Clips</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (p of projects(); track p.id) {
                  <tr>
                    <td class="title-cell">
                      <div class="title-text">{{ p.title }}</div>
                      <div class="filename-text">{{ p.original_filename }}</div>
                    </td>
                    <td>{{ formatDuration(p.duration_seconds) }}</td>
                    <td>
                      <span class="status-badge" [class]="p.status">
                        {{ p.status }}
                      </span>
                    </td>
                    <td>
                      <span class="clips-pill">{{ p.clips_count || 5 }} clips</span>
                    </td>
                    <td class="date-cell">{{ formatDate(p.created_at) }}</td>
                    <td>
                      @if (p.status === 'completed') {
                        <a [routerLink]="['/projects', p.id]" class="btn btn-secondary btn-sm">
                          View Clips
                        </a>
                      } @else if (p.status === 'processing') {
                        <a [routerLink]="['/projects', p.id, 'processing']" class="btn btn-primary btn-sm">
                          Tracking
                        </a>
                      } @else {
                        <button (click)="generateClips(p.id)" class="btn btn-primary btn-sm">
                          Generate
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 36px 40px;
      max-width: 1400px;
      margin-left: 260px;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #fff;
    }

    .page-subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      padding: 22px;
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .stat-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;

      &.purple {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }
      &.emerald {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }
      &.cyan {
        background: rgba(6, 182, 212, 0.15);
        color: #22d3ee;
      }
      &.amber {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }
    }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-val {
      font-size: 1.5rem;
      font-weight: 800;
      color: #fff;
      margin-top: 2px;
    }

    .section-container {
      margin-top: 24px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
    }

    .section-link {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--primary);
      &:hover { text-decoration: underline; }
    }

    .projects-table-wrapper {
      overflow-x: auto;
      background: var(--bg-card);
    }

    .projects-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;

      th {
        padding: 16px 20px;
        color: var(--text-dim);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        border-bottom: 1px solid var(--border-color);
      }

      td {
        padding: 18px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: var(--text-main);
      }

      tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    .title-cell {
      .title-text { font-weight: 700; color: #fff; }
      .filename-text { font-size: 0.8rem; color: var(--text-dim); margin-top: 2px; }
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;

      &.completed {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }
      &.processing {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }
      &.uploaded {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }
      &.failed {
        background: rgba(244, 63, 94, 0.15);
        color: #f43f5e;
      }
    }

    .clips-pill {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.06);
      padding: 3px 8px;
      border-radius: 6px;
      color: var(--text-muted);
    }

    .date-cell {
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    .btn-sm {
      padding: 6px 14px;
      font-size: 0.8rem;
    }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .empty-icon {
        color: var(--text-dim);
        margin-bottom: 8px;
      }

      h3 { font-size: 1.25rem; font-weight: 700; color: #fff; }
      p { color: var(--text-muted); max-width: 480px; margin-bottom: 12px; }
    }

    .loading-state {
      padding: 50px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: var(--text-muted);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  projects = signal<Project[]>([]);
  loading = signal<boolean>(true);

  totalClipsCount = signal<number>(0);

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.api.listProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        const total = data.reduce((acc, p) => acc + (p.clips_count || (p.status === 'completed' ? 5 : 0)), 0);
        this.totalClipsCount.set(total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  generateClips(id: string): void {
    this.api.generateClips(id).subscribe({
      next: () => this.loadProjects()
    });
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

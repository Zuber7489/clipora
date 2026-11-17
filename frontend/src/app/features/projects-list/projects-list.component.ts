import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="projects-container">
      <header class="projects-header">
        <div>
          <h1 class="page-title">My Podcast Projects</h1>
          <p class="page-subtitle">Manage all uploaded episodes and rendered short-form libraries.</p>
        </div>
        <a routerLink="/create" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Upload Episode
        </a>
      </header>

      @if (loading()) {
        <div class="loading-state card">
          <div class="spinner"></div>
          <span>Loading project list...</span>
        </div>
      } @else if (projects().length === 0) {
        <div class="empty-state card">
          <h3>No Projects Yet</h3>
          <p>Get started by uploading your first podcast video.</p>
          <a routerLink="/create" class="btn btn-primary">Create Clips</a>
        </div>
      } @else {
        <div class="projects-grid">
          @for (p of projects(); track p.id) {
            <div class="project-card card">
              <div class="card-header">
                <span class="status-pill" [class]="p.status">{{ p.status }}</span>
                <span class="date-text">{{ formatDate(p.created_at) }}</span>
              </div>

              <h3 class="proj-title" [title]="p.title">{{ p.title }}</h3>
              <p class="proj-filename">{{ p.original_filename }}</p>

              <div class="proj-meta">
                <div class="meta-item">
                  <span class="label">Duration</span>
                  <span class="val">{{ formatDuration(p.duration_seconds) }}</span>
                </div>
                <div class="meta-item">
                  <span class="label">Resolution</span>
                  <span class="val">{{ p.video_width }}x{{ p.video_height }}</span>
                </div>
                <div class="meta-item">
                  <span class="label">Clips</span>
                  <span class="val">{{ p.clips_count || 5 }} shorts</span>
                </div>
              </div>

              <div class="card-actions">
                @if (p.status === 'completed') {
                  <a [routerLink]="['/projects', p.id]" class="btn btn-primary btn-sm flex-1">
                    View 5 Clips
                  </a>
                } @else if (p.status === 'processing') {
                  <a [routerLink]="['/projects', p.id, 'processing']" class="btn btn-secondary btn-sm flex-1">
                    View Progress
                  </a>
                } @else {
                  <button (click)="generate(p.id)" class="btn btn-primary btn-sm flex-1">
                    Generate Clips
                  </button>
                }

                <button (click)="deleteProject(p.id)" class="btn-delete" title="Delete project">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .projects-container {
      padding: 36px 40px;
      max-width: 1400px;
      margin-left: 260px;
    }

    .projects-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .page-title { font-size: 2rem; font-weight: 800; color: #fff; }
    .page-subtitle { font-size: 0.95rem; color: var(--text-muted); margin-top: 4px; }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .project-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-pill {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--radius-full);

      &.completed { background: rgba(16, 185, 129, 0.15); color: #34d399; }
      &.processing { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
      &.uploaded { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      &.failed { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
    }

    .date-text { font-size: 0.75rem; color: var(--text-dim); }

    .proj-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proj-filename {
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-top: -6px;
      font-family: var(--font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proj-meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: var(--radius-sm);
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      .label { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; }
      .val { font-size: 0.85rem; font-weight: 700; color: var(--text-main); font-family: var(--font-mono); }
    }

    .card-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: auto;
      padding-top: 8px;
    }

    .flex-1 { flex: 1; }
    .btn-sm { padding: 8px 14px; font-size: 0.85rem; }

    .btn-delete {
      color: var(--text-dim);
      padding: 8px;
      border-radius: var(--radius-sm);
      &:hover { color: var(--accent-rose); background: rgba(244, 63, 94, 0.1); }
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

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ProjectsListComponent implements OnInit {
  private api = inject(ApiService);
  projects = signal<Project[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  generate(id: string): void {
    this.api.generateClips(id).subscribe(() => this.load());
  }

  deleteProject(id: string): void {
    if (confirm('Delete this project and all its generated MP4 clips?')) {
      this.api.deleteProject(id).subscribe(() => this.load());
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

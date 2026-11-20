import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="projects-layout">
      <!-- Top Action Bar -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Projects</h1>
          <p class="page-subtitle">Video ingestion library, transcription index, and rendered vertical clips.</p>
        </div>
        <a routerLink="/create" class="btn btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Project
        </a>
      </div>

      <!-- Controls Row: Filter Tabs & Search -->
      <div class="controls-row">
        <div class="segmented-control">
          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="statusFilter() === 'all'" 
            (click)="statusFilter.set('all')">
            All ({{ projects().length }})
          </button>
          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="statusFilter() === 'completed'" 
            (click)="statusFilter.set('completed')">
            Completed ({{ countByStatus('completed') }})
          </button>
          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="statusFilter() === 'processing'" 
            (click)="statusFilter.set('processing')">
            Processing ({{ countByStatus('processing') }})
          </button>
          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="statusFilter() === 'failed'" 
            (click)="statusFilter.set('failed')">
            Failed ({{ countByStatus('failed') }})
          </button>
        </div>

        <div class="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            placeholder="Filter projects by title..." 
            class="search-input">
        </div>
      </div>

      <!-- Projects Enterprise Table -->
      @if (loading()) {
        <div class="card-enterprise state-box">
          <span class="spinner-clean"></span>
          <span class="state-text">Loading projects directory...</span>
        </div>
      } @else if (filteredProjects().length === 0) {
        <div class="card-enterprise state-box empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 class="empty-title">No projects found</h3>
          <p class="empty-desc">
            @if (searchQuery) {
              No results match your search term "{{ searchQuery }}".
            } @else {
              Get started by importing a podcast or gameplay video.
            }
          </p>
          <a routerLink="/create" class="btn btn-secondary btn-sm" style="margin-top: 8px;">
            Create First Project
          </a>
        </div>
      } @else {
        <div class="card-enterprise table-container">
          <table class="enterprise-table">
            <thead>
              <tr>
                <th style="width: 44%;">Project Title</th>
                <th style="width: 14%;">Status</th>
                <th style="width: 12%;">Clips</th>
                <th style="width: 14%;">Duration</th>
                <th style="width: 16%; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (p of filteredProjects(); track p.id) {
                <tr class="table-row">
                  <td>
                    <div class="project-cell">
                      <a [routerLink]="p.status === 'completed' ? ['/projects', p.id] : ['/projects', p.id, 'processing']" class="project-title-link">
                        {{ p.title }}
                      </a>
                      <span class="project-subtext">{{ p.original_filename || 'YouTube Stream' }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="status-pill" [class]="p.status">
                      <span class="status-dot"></span>
                      {{ formatStatus(p.status) }}
                    </span>
                  </td>
                  <td class="tabular-nums font-mono-subtle">
                    @if (p.status === 'completed') {
                      {{ p.clips_count || 5 }} clips ready
                    } @else {
                      {{ p.clips_count || 'AI' }} clips
                    }
                  </td>
                  <td class="tabular-nums font-mono-subtle">
                    {{ formatDuration(p.duration_seconds) }}
                  </td>
                  <td style="text-align: right;">
                    <div class="row-actions">
                      @if (p.status === 'completed') {
                        <a [routerLink]="['/projects', p.id]" class="btn btn-secondary btn-sm">
                          View {{ p.clips_count || 5 }} Clips
                        </a>
                      } @else if (p.status === 'processing') {
                        <a [routerLink]="['/projects', p.id, 'processing']" class="btn btn-secondary btn-sm">
                          Live Progress
                        </a>
                      } @else {
                        <button (click)="retry(p.id)" class="btn btn-secondary btn-sm">
                          Retry Job
                        </button>
                      }

                      <button (click)="deleteProject(p.id)" class="btn-icon-danger" title="Delete project record">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .projects-layout {
      margin-left: 240px;
      padding: 36px 48px;
      max-width: 1320px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }

    .controls-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 6px 12px;
      width: 280px;
      color: var(--text-tertiary);
      transition: border-color 0.15s ease;
    }
    .search-box:focus-within {
      border-color: var(--accent-blue);
      color: var(--text-primary);
    }
    .search-input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: 0.8125rem;
      width: 100%;
    }
    .search-input::placeholder {
      color: var(--text-tertiary);
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
    }

    .enterprise-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    .enterprise-table thead th {
      padding: 12px 18px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
      border-bottom: 1px solid var(--border-default);
      background-color: var(--bg-surface);
    }

    .enterprise-table tbody tr {
      border-bottom: 1px solid var(--border-subtle);
      transition: background-color 0.12s ease;
    }
    .enterprise-table tbody tr:last-child {
      border-bottom: none;
    }
    .enterprise-table tbody tr:hover {
      background-color: var(--bg-card);
    }

    .enterprise-table tbody td {
      padding: 14px 18px;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .project-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 480px;
    }

    .project-title-link {
      font-weight: 500;
      color: var(--text-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
    .project-title-link:hover {
      color: #60a5fa;
    }

    .project-subtext {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .font-mono-subtle {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .row-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn-icon-danger {
      padding: 6px;
      border-radius: var(--radius-sm);
      color: var(--text-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-icon-danger:hover {
      background-color: var(--status-danger-bg);
      color: var(--status-danger);
    }

    .state-box {
      padding: 60px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 12px;
    }

    .state-text {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .empty-icon {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      margin-bottom: 4px;
    }

    .empty-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .empty-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      max-width: 320px;
    }
  `]
})
export class ProjectsListComponent implements OnInit {
  private api = inject(ApiService);

  projects = signal<Project[]>([]);
  loading = signal<boolean>(true);
  statusFilter = signal<'all' | 'completed' | 'processing' | 'failed'>('all');
  searchQuery = '';

  filteredProjects = computed(() => {
    let list = this.projects();
    const filter = this.statusFilter();
    if (filter !== 'all') {
      list = list.filter(p => p.status === filter);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.original_filename && p.original_filename.toLowerCase().includes(q)));
    }
    return list;
  });

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.api.listProjects().subscribe({
      next: (data: Project[]) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  countByStatus(status: string): number {
    return this.projects().filter(p => p.status === status).length;
  }

  deleteProject(id: string): void {
    if (!confirm('Are you sure you want to delete this project and all its clips?')) return;
    this.api.deleteProject(id).subscribe({
      next: () => {
        this.projects.set(this.projects().filter(p => p.id !== id));
      }
    });
  }

  retry(id: string): void {
    this.api.generateClips(id).subscribe({
      next: () => this.loadProjects()
    });
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'completed': return 'Completed';
      case 'processing': return 'Processing';
      case 'failed': return 'Failed';
      case 'queued': return 'Queued';
      default: return status;
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

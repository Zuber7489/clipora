import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project, ProcessingJob } from '../../core/models/project.model';

@Component({
  selector: 'app-processing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="processing-layout">
      <!-- Top Navigation & Title -->
      <div class="processing-header">
        <a routerLink="/projects" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Projects
        </a>
        <h1 class="page-title" style="margin-top: 6px;">Pipeline Execution</h1>
        <p class="page-subtitle">{{ project()?.title || 'Processing video stream' }}</p>
      </div>

      <!-- Main Execution Monitor Card -->
      <div class="card-enterprise monitor-card">
        <!-- Progress Bar Header -->
        <div class="progress-header">
          <div class="status-indicator-col">
            <span class="status-pill processing">
              <span class="status-dot"></span>
              {{ job()?.status === 'running' ? 'Active Execution' : (job()?.status || 'Processing') }}
            </span>
            <span class="step-summary">{{ currentStep() }}</span>
          </div>
          <span class="progress-value tabular-nums">{{ progress() }}%</span>
        </div>

        <!-- Linear Crisp Progress Bar -->
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" [style.width.%]="progress()"></div>
        </div>

        <!-- Discrete Linear Steps -->
        <div class="steps-checklist">
          <!-- Step 1 -->
          <div class="step-item" [class.step-done]="progress() >= 15" [class.step-active]="progress() > 0 && progress() < 25">
            <div class="step-badge">
              @if (progress() >= 15) {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                1
              }
            </div>
            <div class="step-content">
              <span class="step-name">Media Stream Ingestion & Codec Probe</span>
              <span class="step-detail">FFprobe codec detection & 16kHz audio stream extraction</span>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="step-item" [class.step-done]="progress() >= 45" [class.step-active]="progress() >= 15 && progress() < 50">
            <div class="step-badge">
              @if (progress() >= 45) {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                2
              }
            </div>
            <div class="step-content">
              <span class="step-name">Gemini 3.8 Speech Intelligence</span>
              <span class="step-detail">Hinglish/English word-level timestamp alignment</span>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="step-item" [class.step-done]="progress() >= 65" [class.step-active]="progress() >= 50 && progress() < 70">
            <div class="step-badge">
              @if (progress() >= 65) {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                3
              }
            </div>
            <div class="step-content">
              <span class="step-name">Multimodal Timeline Partitioning</span>
              <span class="step-detail">5-zone timeline search across entire duration (no start-clustering)</span>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="step-item" [class.step-done]="progress() >= 75" [class.step-active]="progress() >= 70 && progress() < 80">
            <div class="step-badge">
              @if (progress() >= 75) {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                4
              }
            </div>
            <div class="step-content">
              <span class="step-name">6-Pillar Heuristic Ranking Engine</span>
              <span class="step-detail">Selecting top 5 non-overlapping viral moments with temporal spacing</span>
            </div>
          </div>

          <!-- Step 5 -->
          <div class="step-item" [class.step-done]="progress() >= 100" [class.step-active]="progress() >= 80 && progress() < 100">
            <div class="step-badge">
              @if (progress() >= 100) {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                5
              }
            </div>
            <div class="step-content">
              <span class="step-name">Parallel 9:16 Video Rendering</span>
              <span class="step-detail">1080x1920 reframing, blur background & animated subtitles</span>
            </div>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="error-banner" style="margin-top: 24px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .processing-layout {
      margin-left: 240px;
      padding: 40px 48px;
      max-width: 820px;
    }

    .processing-header {
      margin-bottom: 24px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      font-weight: 500;
    }
    .back-link:hover {
      color: var(--text-primary);
    }

    .monitor-card {
      padding: 32px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .status-indicator-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step-summary {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .progress-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .progress-bar-bg {
      height: 6px;
      background-color: var(--bg-muted);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-bottom: 32px;
    }

    .progress-bar-fill {
      height: 100%;
      background-color: var(--accent-blue);
      border-radius: var(--radius-full);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .steps-checklist {
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-top: 1px solid var(--border-subtle);
      padding-top: 24px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      opacity: 0.45;
      transition: opacity 0.2s ease;
    }

    .step-item.step-done, .step-item.step-active {
      opacity: 1;
    }

    .step-badge {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      color: var(--text-tertiary);
      font-size: 0.6875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .step-done .step-badge {
      background-color: var(--status-success-bg);
      border-color: rgba(16, 185, 129, 0.3);
      color: var(--status-success);
    }

    .step-active .step-badge {
      background-color: var(--accent-blue-subtle);
      border-color: var(--accent-blue);
      color: #93c5fd;
    }

    .step-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .step-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .step-detail {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: var(--status-danger-bg);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      color: #fca5a5;
      font-size: 0.8125rem;
    }
  `]
})
export class ProcessingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  projectId = '';
  project = signal<Project | null>(null);
  job = signal<ProcessingJob | null>(null);

  progress = signal<number>(5);
  currentStep = signal<string>('Initializing pipeline...');
  errorMessage = signal<string | null>(null);

  private pollInterval: any;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.projectId) {
      this.router.navigate(['/projects']);
      return;
    }

    this.fetchProject();
    this.pollInterval = setInterval(() => this.pollStatus(), 2000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  fetchProject(): void {
    this.api.getProject(this.projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.status === 'completed' || (proj.clips_count ?? 0) >= 5) {
          this.progress.set(100);
          this.currentStep.set('All 5 vertical clips rendered successfully!');
          clearInterval(this.pollInterval);
          setTimeout(() => this.router.navigate(['/projects', this.projectId]), 800);
        }
      }
    });
  }

  pollStatus(): void {
    this.api.getProjectJobs(this.projectId).subscribe({
      next: (jobs: ProcessingJob[]) => {
        if (jobs && jobs.length > 0) {
          const latest = jobs[0];
          this.job.set(latest);
          this.progress.set(latest.progress_percentage || 5);
          this.currentStep.set(latest.current_step || 'Processing...');

          if (latest.status === 'completed') {
            this.progress.set(100);
            clearInterval(this.pollInterval);
            setTimeout(() => this.router.navigate(['/projects', this.projectId]), 1000);
          } else if (latest.status === 'failed') {
            this.errorMessage.set(latest.error_message || 'Processing job encountered an error.');
            clearInterval(this.pollInterval);
          }
        }
      }
    });
  }
}

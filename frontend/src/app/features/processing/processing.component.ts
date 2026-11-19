import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project, ProcessingJob } from '../../core/models/project.model';

@Component({
  selector: 'app-processing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="processing-container">
      <div class="processing-card card">
        <div class="spinner-glow-wrapper">
          <div class="pulse-ring"></div>
          <div class="spinner-main"></div>
          <div class="center-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
        </div>

        <h2 class="processing-title">ClipForge Engine Processing</h2>
        <p class="processing-subtitle">{{ project()?.title || 'Analyzing your podcast media' }}</p>

        <!-- Main Progress Bar -->
        <div class="progress-section">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" [style.width.%]="progress()"></div>
          </div>
          <div class="progress-meta">
            <span class="step-text">{{ currentStep() }}</span>
            <span class="percent-text">{{ progress() }}%</span>
          </div>
        </div>

        <!-- Stage Timeline -->
        <div class="stages-timeline">
          <div class="timeline-step" [class.done]="progress() >= 15" [class.active]="progress() > 0 && progress() < 35">
            <div class="step-indicator">
              @if (progress() >= 15) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                1
              }
            </div>
            <div class="step-info">
              <span class="name">Audio & Codec Extraction</span>
              <span class="sub">FFprobe validation & 16kHz speech WAV</span>
            </div>
          </div>

          <div class="timeline-step" [class.done]="progress() >= 45" [class.active]="progress() >= 15 && progress() < 55">
            <div class="step-indicator">
              @if (progress() >= 45) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                2
              }
            </div>
            <div class="step-info">
              <span class="name">Gemini 3.5 Transcribe</span>
              <span class="sub">Word-level timestamps & speaker diarization</span>
            </div>
          </div>

          <div class="timeline-step" [class.done]="progress() >= 65" [class.active]="progress() >= 45 && progress() < 70">
            <div class="step-indicator">
              @if (progress() >= 65) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                3
              }
            </div>
            <div class="step-info">
              <span class="name">Gemini 3.8 Multimodal Analysis</span>
              <span class="sub">Detecting viral hooks & standalone moments</span>
            </div>
          </div>

          <div class="timeline-step" [class.done]="progress() >= 75" [class.active]="progress() >= 65 && progress() < 75">
            <div class="step-indicator">
              @if (progress() >= 75) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                4
              }
            </div>
            <div class="step-info">
              <span class="name">6-Pillar Heuristic Ranking</span>
              <span class="sub">Scoring hook, emotion, value & context</span>
            </div>
          </div>

          <div class="timeline-step" [class.done]="progress() === 100" [class.active]="progress() >= 75 && progress() < 100">
            <div class="step-indicator">
              @if (progress() === 100) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                5
              }
            </div>
            <div class="step-info">
              <span class="name">FFmpeg 9:16 Vertical Video Render</span>
              <span class="sub">Rendering 5 MP4s with animated word highlight subtitles</span>
            </div>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="error-box">
            <strong>Processing Error:</strong> {{ errorMessage() }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .processing-container {
      padding: 60px 40px;
      max-width: 800px;
      margin-left: calc(260px + (100vw - 260px - 800px) / 2);
    }

    .processing-card {
      padding: 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .spinner-glow-wrapper {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
    }

    .spinner-main {
      position: absolute;
      width: 100px;
      height: 100px;
      border: 3px solid rgba(255, 255, 255, 0.08);
      border-top-color: var(--primary);
      border-right-color: var(--accent-purple);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .pulse-ring {
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--primary-glow);
      animation: pulse 2s ease-in-out infinite;
    }

    .center-icon {
      position: relative;
      z-index: 2;
      color: #fff;
    }

    .processing-title {
      font-size: 1.7rem;
      font-weight: 800;
      color: #fff;
    }

    .processing-subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-top: 6px;
      margin-bottom: 36px;
    }

    .progress-section {
      width: 100%;
      margin-bottom: 40px;
    }

    .progress-bar-bg {
      width: 100%;
      height: 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--accent-purple), var(--accent-emerald));
      border-radius: 6px;
      transition: width 0.4s ease;
    }

    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .step-text { color: var(--text-main); font-weight: 600; }
    .percent-text { font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 700; }

    .stages-timeline {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      text-align: left;
    }

    .timeline-step {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      opacity: 0.5;
      transition: all 0.2s ease;

      &.active {
        opacity: 1;
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.35);
      }

      &.done {
        opacity: 1;
        border-color: rgba(16, 185, 129, 0.3);
      }
    }

    .step-indicator {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;

      .timeline-step.active & {
        background: var(--primary);
        color: #fff;
      }

      .timeline-step.done & {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
    }

    .step-info {
      display: flex;
      flex-direction: column;
      .name { font-size: 0.9rem; font-weight: 700; color: #fff; }
      .sub { font-size: 0.75rem; color: var(--text-dim); }
    }

    .error-box {
      margin-top: 24px;
      padding: 16px;
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: var(--radius-sm);
      color: #fca5a5;
      width: 100%;
      text-align: left;
      font-size: 0.9rem;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(0.95); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 0.8; } }
  `]
})
export class ProcessingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  projectId = '';
  project = signal<Project | null>(null);
  progress = signal<number>(5);
  currentStep = signal<string>('Initializing pipeline...');
  errorMessage = signal<string | null>(null);
  
  private pollInterval: any;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.projectId) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private startPolling(): void {
    this.checkStatus();
    this.pollInterval = setInterval(() => this.checkStatus(), 2500);
  }

  private checkStatus(): void {
    this.api.getProject(this.projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.status === 'completed' || (proj.clips_count ?? 0) >= 5) {
          this.progress.set(100);
          this.currentStep.set('All 5 vertical clips rendered successfully!');
          clearInterval(this.pollInterval);
          setTimeout(() => {
            this.router.navigate(['/projects', this.projectId]);
          }, 800);
        } else if (proj.status === 'failed') {
          clearInterval(this.pollInterval);
          this.errorMessage.set(proj.error_message || 'Video processing failed.');
        } else {
          // Dynamic progress based on real backend state & clip count
          const rendered = proj.clips_count || 0;
          if (rendered > 0) {
            const calculatedProgress = Math.min(98, 75 + (rendered * 4.5));
            this.progress.set(Math.round(calculatedProgress));
            this.currentStep.set(`Rendering vertical clip ${Math.min(5, rendered + 1)} of 5 with karaoke subtitles...`);
          } else {
            const cur = this.progress();
            if (cur < 75) {
              this.progress.set(cur + 3);
            }
            if (this.progress() < 25) this.currentStep.set('Extracting audio & probing duration...');
            else if (this.progress() < 50) this.currentStep.set('Gemini speech transcription & word timestamps...');
            else if (this.progress() < 75) this.currentStep.set('Gemini multimodal moment analysis & hook detection...');
            else this.currentStep.set('FFmpeg 9:16 vertical reframing & subtitle burning (Clip 1 of 5)...');
          }
        }
      },
      error: (err) => {
        this.errorMessage.set('Failed to connect to backend.');
      }
    });
  }
}

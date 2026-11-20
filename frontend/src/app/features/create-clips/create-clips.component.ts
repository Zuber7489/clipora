import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpEventType } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-create-clips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="create-layout">
      <!-- Page Header -->
      <div class="create-header">
        <h1 class="page-title">New Clipping Job</h1>
        <p class="page-subtitle">Ingest a podcast or video episode. Gemini 3.8 extracts viral moments into customized 1080x1920 vertical shorts.</p>
      </div>

      <!-- Segmented Ingestion Mode Selector -->
      <div class="mode-selector-row">
        <div class="segmented-control">
          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="activeTab() === 'youtube'" 
            (click)="activeTab.set('youtube')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
            </svg>
            YouTube Ingestion
          </button>

          <button 
            type="button" 
            class="segmented-tab" 
            [class.active]="activeTab() === 'upload'" 
            (click)="activeTab.set('upload')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Local File Upload
          </button>
        </div>
      </div>

      <!-- Main Ingestion Box -->
      <div class="card-enterprise main-canvas">
        @if (activeTab() === 'youtube') {
          <!-- YouTube Mode -->
          <div class="canvas-section">
            <label class="field-label">YouTube URL</label>
            <div class="url-input-group">
              <input 
                type="text" 
                [(ngModel)]="youtubeUrl" 
                (keydown.enter)="fetchInfo()"
                placeholder="https://www.youtube.com/watch?v=..." 
                class="input-enterprise">
              <button 
                type="button" 
                (click)="fetchInfo()" 
                [disabled]="isFetchingInfo() || !youtubeUrl.trim()" 
                class="btn btn-secondary">
                @if (isFetchingInfo()) {
                  <span class="spinner-clean"></span> Inspecting...
                } @else {
                  Inspect
                }
              </button>
            </div>

            @if (urlInfo()) {
              <div class="video-preview-strip">
                @if (urlInfo()?.thumbnail) {
                  <img [src]="urlInfo()?.thumbnail" alt="Thumbnail" class="video-thumb">
                }
                <div class="video-meta">
                  <span class="video-title">{{ urlInfo()?.title }}</span>
                  <div class="video-details">
                    <span>Channel: <strong>{{ urlInfo()?.uploader }}</strong></span>
                    <span>Duration: <strong class="tabular-nums">{{ formatDuration(urlInfo()?.duration || 0) }}</strong></span>
                    <span class="pill-output">{{ targetClips }} clips (~{{ targetDuration }}s each)</span>
                  </div>
                </div>
              </div>
            }

            <div class="form-row" style="margin-top: 20px;">
              <div class="form-col">
                <label class="field-label">Custom Project Title (Optional)</label>
                <input 
                  type="text" 
                  [(ngModel)]="projectTitle" 
                  placeholder="Leave empty to use video title" 
                  class="input-enterprise">
              </div>
            </div>

            <!-- Number of Clips Selection -->
            <div class="form-row" style="margin-top: 20px;">
              <div class="form-col">
                <div class="field-label-row">
                  <label class="field-label">Number of Viral Clips</label>
                  <span class="field-hint">Select how many AI clips to extract</span>
                </div>
                <div class="clip-count-group">
                  @for (cnt of [1, 2, 3, 5, 10, 15, 20]; track cnt) {
                    <button 
                      type="button" 
                      class="count-chip" 
                      [class.active]="targetClips === cnt" 
                      (click)="targetClips = cnt">
                      {{ cnt }} {{ cnt === 1 ? 'Clip' : 'Clips' }}
                    </button>
                  }
                  <div class="custom-count-wrapper">
                    <span class="custom-prefix">Custom:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="50" 
                      [(ngModel)]="targetClips" 
                      class="custom-count-input"
                      placeholder="5">
                  </div>
                </div>
              </div>
            </div>

            <!-- Target Clip Duration (Seconds) Selection -->
            <div class="form-row" style="margin-top: 20px;">
              <div class="form-col">
                <div class="field-label-row">
                  <label class="field-label">Target Clip Duration (Seconds)</label>
                  <span class="field-hint">Control length of each extracted clip</span>
                </div>
                <div class="clip-duration-group">
                  @for (opt of durationOptions; track opt.seconds) {
                    <button 
                      type="button" 
                      class="duration-chip" 
                      [class.active]="targetDuration === opt.seconds" 
                      (click)="targetDuration = opt.seconds">
                      <span class="chip-main">{{ opt.label }}</span>
                      <span class="chip-sub">{{ opt.hint }}</span>
                    </button>
                  }
                  <div class="custom-duration-wrapper">
                    <span class="custom-prefix">Custom:</span>
                    <input 
                      type="number" 
                      min="15" 
                      max="180" 
                      [(ngModel)]="targetDuration" 
                      class="custom-duration-input"
                      placeholder="45">
                    <span class="custom-suffix">sec</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Video Layout Template Section -->
            <div class="template-section-wrapper" style="margin-top: 24px;">
              <div class="field-label-row">
                <label class="field-label">1. Video Layout Template</label>
                <span class="field-hint">Select social layout for rendered 9:16 clips</span>
              </div>
              <div class="template-grid">
                <label class="template-card" [class.selected]="selectedCropMode === 'streamer_split'" (click)="selectedCropMode = 'streamer_split'">
                  <input type="radio" name="cropModeYt" value="streamer_split" [(ngModel)]="selectedCropMode">
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
                  <input type="radio" name="cropModeYt" value="twitter_post" [(ngModel)]="selectedCropMode">
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
                  <input type="radio" name="cropModeYt" value="smart_blur" [(ngModel)]="selectedCropMode">
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
                  <input type="radio" name="cropModeYt" value="center_crop" [(ngModel)]="selectedCropMode">
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

            <!-- Burned Karaoke Subtitles Section -->
            <div class="template-section-wrapper" style="margin-top: 24px;">
              <div class="field-label-row">
                <label class="field-label">2. Burned Karaoke Subtitles</label>
                <span class="field-hint">Choose on-screen dynamic caption styling</span>
              </div>
              <div class="style-cards">
                <label class="style-card" [class.selected]="selectedStyle === 'bold_viral'" (click)="selectedStyle = 'bold_viral'">
                  <input type="radio" name="subStyleYt" value="bold_viral" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Bold Viral (Recommended)</span>
                    <span class="desc">Yellow animated word pop, heavy outline, maximum viral retention</span>
                  </div>
                </label>

                <label class="style-card" [class.selected]="selectedStyle === 'clean_minimal'" (click)="selectedStyle = 'clean_minimal'">
                  <input type="radio" name="subStyleYt" value="clean_minimal" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Clean Minimal</span>
                    <span class="desc">Crisp white typography with subtle translucent backing</span>
                  </div>
                </label>

                <label class="style-card" [class.selected]="selectedStyle === 'podcast_pro'" (click)="selectedStyle = 'podcast_pro'">
                  <input type="radio" name="subStyleYt" value="podcast_pro" [(ngModel)]="selectedStyle">
                  <div class="style-details">
                    <span class="name">Podcast Professional</span>
                    <span class="desc">Mint green highlights, lower-third formatting for interviews</span>
                  </div>
                </label>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <div class="action-footer">
              <button 
                type="button" 
                (click)="importAndGenerate()" 
                [disabled]="isImporting() || !youtubeUrl.trim()" 
                class="btn btn-primary btn-lg">
                @if (isImporting()) {
                  <span class="spinner-clean"></span> Starting Ingestion Pipeline...
                } @else {
                  Generate {{ targetClips }} Clips (~{{ targetDuration }}s, {{ getCropModeLabel(selectedCropMode) }})
                }
              </button>
            </div>
          </div>
        } @else {
          <!-- Local File Upload Mode -->
          <div class="canvas-section">
            @if (!selectedFile()) {
              <div 
                class="dropzone" 
                [class.dragging]="isDragging()" 
                (dragover)="onDragOver($event)" 
                (dragleave)="onDragLeave($event)" 
                (drop)="onDrop($event)"
                (click)="fileInput.click()">
                <input #fileInput type="file" (change)="onFileSelected($event)" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" style="display: none">
                
                <div class="drop-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <h3 class="drop-heading">Click or drag video file to this area</h3>
                <p class="drop-specs">MP4, MOV, WEBM or MKV. Up to 2GB in size.</p>
                <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 12px; pointer-events: none;">
                  Select File from Computer
                </button>
              </div>
            } @else {
              <div class="selected-file-strip">
                <div class="file-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
                <div class="file-info-col">
                  <span class="file-name">{{ selectedFile()?.name }}</span>
                  <span class="file-size tabular-nums">{{ formatBytes(selectedFile()?.size || 0) }}</span>
                </div>
                <button type="button" (click)="removeSelectedFile()" class="btn btn-ghost btn-sm" title="Remove file">
                  Remove
                </button>
              </div>

              <div class="form-row" style="margin-top: 20px;">
                <div class="form-col">
                  <label class="field-label">Project Title</label>
                  <input 
                    type="text" 
                    [(ngModel)]="projectTitle" 
                    placeholder="Enter project name" 
                    class="input-enterprise">
                </div>
              </div>

              <!-- Number of Clips Selection (Upload mode) -->
              <div class="form-row" style="margin-top: 20px;">
                <div class="form-col">
                  <div class="field-label-row">
                    <label class="field-label">Number of Viral Clips</label>
                    <span class="field-hint">Select how many AI clips to extract</span>
                  </div>
                  <div class="clip-count-group">
                    @for (cnt of [1, 2, 3, 5, 10, 15, 20]; track cnt) {
                      <button 
                        type="button" 
                        class="count-chip" 
                        [class.active]="targetClips === cnt" 
                        (click)="targetClips = cnt">
                        {{ cnt }} {{ cnt === 1 ? 'Clip' : 'Clips' }}
                      </button>
                    }
                    <div class="custom-count-wrapper">
                      <span class="custom-prefix">Custom:</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="50" 
                        [(ngModel)]="targetClips" 
                        class="custom-count-input"
                        placeholder="5">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Target Clip Duration (Seconds) Selection (Upload mode) -->
              <!-- Target Clip Duration (Seconds) Selection (Upload mode) -->
              <div class="form-row" style="margin-top: 20px;">
                <div class="form-col">
                  <div class="field-label-row">
                    <label class="field-label">Target Clip Duration (Seconds)</label>
                    <span class="field-hint">Control length of each extracted clip</span>
                  </div>
                  <div class="clip-duration-group">
                    @for (opt of durationOptions; track opt.seconds) {
                      <button 
                        type="button" 
                        class="duration-chip" 
                        [class.active]="targetDuration === opt.seconds" 
                        (click)="targetDuration = opt.seconds">
                        <span class="chip-main">{{ opt.label }}</span>
                        <span class="chip-sub">{{ opt.hint }}</span>
                      </button>
                    }
                    <div class="custom-duration-wrapper">
                      <span class="custom-prefix">Custom:</span>
                      <input 
                        type="number" 
                        min="15" 
                        max="180" 
                        [(ngModel)]="targetDuration" 
                        class="custom-duration-input"
                        placeholder="45">
                      <span class="custom-suffix">sec</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Video Layout Template Section (Upload) -->
              <div class="template-section-wrapper" style="margin-top: 24px;">
                <div class="field-label-row">
                  <label class="field-label">1. Video Layout Template</label>
                  <span class="field-hint">Select social layout for rendered 9:16 clips</span>
                </div>
                <div class="template-grid">
                  <label class="template-card" [class.selected]="selectedCropMode === 'streamer_split'" (click)="selectedCropMode = 'streamer_split'">
                    <input type="radio" name="cropModeUpload" value="streamer_split" [(ngModel)]="selectedCropMode">
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
                    <input type="radio" name="cropModeUpload" value="twitter_post" [(ngModel)]="selectedCropMode">
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
                    <input type="radio" name="cropModeUpload" value="smart_blur" [(ngModel)]="selectedCropMode">
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
                    <input type="radio" name="cropModeUpload" value="center_crop" [(ngModel)]="selectedCropMode">
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

              <!-- Burned Karaoke Subtitles Section (Upload) -->
              <div class="template-section-wrapper" style="margin-top: 24px;">
                <div class="field-label-row">
                  <label class="field-label">2. Burned Karaoke Subtitles</label>
                  <span class="field-hint">Choose on-screen dynamic caption styling</span>
                </div>
                <div class="style-cards">
                  <label class="style-card" [class.selected]="selectedStyle === 'bold_viral'" (click)="selectedStyle = 'bold_viral'">
                    <input type="radio" name="subStyleUpload" value="bold_viral" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Bold Viral (Recommended)</span>
                      <span class="desc">Yellow animated word pop, heavy outline, maximum viral retention</span>
                    </div>
                  </label>

                  <label class="style-card" [class.selected]="selectedStyle === 'clean_minimal'" (click)="selectedStyle = 'clean_minimal'">
                    <input type="radio" name="subStyleUpload" value="clean_minimal" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Clean Minimal</span>
                      <span class="desc">Crisp white typography with subtle translucent backing</span>
                    </div>
                  </label>

                  <label class="style-card" [class.selected]="selectedStyle === 'podcast_pro'" (click)="selectedStyle = 'podcast_pro'">
                    <input type="radio" name="subStyleUpload" value="podcast_pro" [(ngModel)]="selectedStyle">
                    <div class="style-details">
                      <span class="name">Podcast Professional</span>
                      <span class="desc">Mint green highlights, lower-third formatting for interviews</span>
                    </div>
                  </label>
                </div>
              </div>

              @if (isUploading()) {
                <div class="upload-progress-box">
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" [style.width.%]="uploadProgress()"></div>
                  </div>
                  <span class="upload-status-text tabular-nums">Uploading media... {{ uploadProgress() }}%</span>
                </div>
              }

              @if (errorMessage()) {
                <div class="error-banner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{{ errorMessage() }}</span>
                </div>
              }

              <div class="action-footer">
                <button 
                  type="button" 
                  (click)="uploadAndGenerate()" 
                  [disabled]="isUploading()" 
                  class="btn btn-primary btn-lg">
                  @if (isUploading()) {
                    <span class="spinner-clean"></span> Uploading & Processing...
                  } @else {
                    Upload & Generate {{ targetClips }} Clips (~{{ targetDuration }}s, {{ getCropModeLabel(selectedCropMode) }})
                  }
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .create-layout {
      margin-left: 240px;
      padding: 40px 48px;
      max-width: 900px;
    }

    .create-header {
      margin-bottom: 24px;
    }

    .mode-selector-row {
      margin-bottom: 20px;
    }

    .main-canvas {
      padding: 32px;
    }

    .canvas-section {
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .url-input-group {
      display: flex;
      gap: 8px;
    }

    .video-preview-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 14px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      margin-top: 14px;
    }

    .video-thumb {
      width: 104px;
      height: 60px;
      object-fit: cover;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-default);
      flex-shrink: 0;
    }

    .video-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
    }

    .video-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .video-details {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .pill-output {
      background-color: rgba(37, 99, 235, 0.15);
      color: #93c5fd;
      padding: 2px 6px;
      border-radius: var(--radius-xs);
      font-size: 0.6875rem;
      font-weight: 500;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-col {
      flex: 1;
    }

    .dropzone {
      border: 2px dashed var(--border-default);
      border-radius: var(--radius-lg);
      padding: 56px 24px;
      text-align: center;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      background-color: rgba(255, 255, 255, 0.01);
    }
    .dropzone:hover, .dropzone.dragging {
      border-color: var(--accent-blue);
      background-color: var(--accent-blue-subtle);
    }

    .drop-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }

    .drop-heading {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .drop-specs {
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      margin-top: 4px;
    }

    .selected-file-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
    }

    .file-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background-color: var(--bg-surface);
      border: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
    }

    .file-info-col {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .file-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .upload-progress-box {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .progress-bar-bg {
      height: 6px;
      background-color: var(--bg-card);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background-color: var(--accent-blue);
      border-radius: var(--radius-full);
      transition: width 0.2s ease;
    }

    .upload-status-text {
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
      margin-top: 16px;
    }

    .field-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .clip-count-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .count-chip {
      padding: 7px 14px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .count-chip:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .count-chip.active {
      background-color: var(--accent-blue);
      border-color: var(--accent-blue);
      color: #ffffff;
      font-weight: 600;
    }

    .custom-count-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
    }

    .custom-prefix {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .custom-count-input {
      width: 52px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.8125rem;
      font-weight: 600;
      text-align: center;
      outline: none;
    }

    .clip-duration-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .duration-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 14px;
      color: var(--text-secondary);
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }

    .duration-chip:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .duration-chip.active {
      background-color: var(--accent-blue);
      border-color: var(--accent-blue);
      color: #ffffff;
    }

    .duration-chip.active .chip-sub {
      color: rgba(255, 255, 255, 0.85);
    }

    .chip-main {
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.2;
    }

    .chip-sub {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      margin-top: 2px;
      line-height: 1;
    }

    .custom-duration-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
    }

    .custom-duration-input {
      width: 48px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.8125rem;
      font-weight: 600;
      text-align: center;
      outline: none;
    }

    .custom-suffix {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .action-footer {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: flex-end;
    }

    .template-section-wrapper {
      display: flex;
      flex-direction: column;
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
      line-height: 1.3;
    }
  `]
})
export class CreateClipsComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  activeTab = signal<'youtube' | 'upload'>('youtube');

  // File Upload State
  selectedFile = signal<File | null>(null);
  isDragging = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  uploadProgress = signal<number>(0);

  // Target viral clips count (default 5, configurable 1 to 50)
  targetClips = 5;

  // Target clip duration in seconds (default 45s, configurable 15 to 180)
  targetDuration = 45;
  durationOptions = [
    { label: '< 30s', hint: 'Shorts / TikTok', seconds: 25 },
    { label: '30s - 60s', hint: 'Reels (Recommended)', seconds: 45 },
    { label: '60s - 90s', hint: 'In-Depth', seconds: 75 },
    { label: '90s - 120s', hint: 'Podcast Highlight', seconds: 105 }
  ];

  // Selected Social Layout & Karaoke Subtitles upfront
  selectedCropMode = 'streamer_split';
  selectedStyle = 'bold_viral';

  getCropModeLabel(mode: string): string {
    const labels: Record<string, string> = {
      streamer_split: 'Streamer Split',
      twitter_post: 'Twitter / X Post',
      smart_blur: 'Smart Blur',
      center_crop: 'Center Focus'
    };
    return labels[mode] || 'Streamer Split';
  }

  // YouTube State
  youtubeUrl = '';
  projectTitle = '';
  urlInfo = signal<{ title: string; duration: number; uploader: string; thumbnail?: string; webpage_url: string } | null>(null);
  isFetchingInfo = signal<boolean>(false);
  isImporting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      if (!this.projectTitle) {
        this.projectTitle = input.files[0].name.replace(/\.[^/.]+$/, "");
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.selectedFile.set(event.dataTransfer.files[0]);
      if (!this.projectTitle) {
        this.projectTitle = event.dataTransfer.files[0].name.replace(/\.[^/.]+$/, "");
      }
    }
  }

  removeSelectedFile(): void {
    this.selectedFile.set(null);
  }

  fetchInfo(): void {
    if (!this.youtubeUrl.trim()) return;
    this.isFetchingInfo.set(true);
    this.errorMessage.set(null);

    this.api.inspectUrl(this.youtubeUrl.trim()).subscribe({
      next: (info) => {
        this.urlInfo.set(info);
        if (!this.projectTitle) {
          this.projectTitle = info.title;
        }
        this.isFetchingInfo.set(false);
      },
      error: (err) => {
        this.isFetchingInfo.set(false);
        this.errorMessage.set(err.error?.detail || 'Could not fetch video metadata from URL. Please verify the URL.');
      }
    });
  }

  importAndGenerate(): void {
    if (!this.youtubeUrl.trim()) return;
    this.isImporting.set(true);
    this.errorMessage.set(null);

    const clipsCount = Math.max(1, Math.min(50, this.targetClips || 5));
    const clipDuration = Math.max(15, Math.min(180, this.targetDuration || 45));
    this.api.importUrl(
      this.youtubeUrl.trim(), 
      this.projectTitle, 
      true, 
      clipsCount, 
      clipDuration,
      this.selectedCropMode,
      this.selectedStyle
    ).subscribe({
      next: (project) => {
        if (project && project.id) {
          this.router.navigate(['/projects', project.id, 'processing']);
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        this.errorMessage.set(err.error?.detail || 'Failed to import video from URL.');
      }
    });
  }

  uploadAndGenerate(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadProgress.set(5);
    this.errorMessage.set(null);

    const clipsCount = Math.max(1, Math.min(50, this.targetClips || 5));
    const clipDuration = Math.max(15, Math.min(180, this.targetDuration || 45));
    this.api.uploadVideoWithProgress(
      file, 
      this.projectTitle, 
      true, 
      clipsCount, 
      clipDuration,
      this.selectedCropMode,
      this.selectedStyle
    ).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round((100 * event.loaded) / event.total);
          this.uploadProgress.set(Math.min(95, progress));
        } else if (event.type === HttpEventType.Response) {
          const project = event.body;
          if (project && project.id) {
            this.router.navigate(['/projects', project.id, 'processing']);
          }
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.detail || 'Failed to upload video. Please ensure the file is valid.');
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

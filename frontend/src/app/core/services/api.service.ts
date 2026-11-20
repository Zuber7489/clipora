import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project, GeneratedClip, ProcessingJob, SystemHealth } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/v1';

  getHealth(): Observable<SystemHealth> {
    return this.http.get<SystemHealth>(`${this.baseUrl}/health`);
  }

  listProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/projects`);
  }

  getProjects(): Observable<Project[]> {
    return this.listProjects();
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/projects/${id}`);
  }

  uploadVideoWithProgress(file: File, title: string, autoGenerate: boolean = true): Observable<HttpEvent<Project>> {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('auto_generate', String(autoGenerate));

    const req = new HttpRequest('POST', `${this.baseUrl}/projects/upload`, formData, {
      reportProgress: true
    });
    return this.http.request<Project>(req);
  }

  inspectUrl(url: string): Observable<{ title: string; duration: number; uploader: string; thumbnail?: string; webpage_url: string }> {
    return this.http.post<any>(`${this.baseUrl}/projects/inspect-url`, { url });
  }

  importUrl(url: string, title?: string, autoGenerate: boolean = true): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/projects/import-url`, {
      url,
      title: title || undefined,
      auto_generate: autoGenerate
    });
  }

  generateClips(projectId: string): Observable<ProcessingJob> {
    return this.http.post<ProcessingJob>(`${this.baseUrl}/projects/${projectId}/generate`, {});
  }

  getJob(jobId: string): Observable<ProcessingJob> {
    return this.http.get<ProcessingJob>(`${this.baseUrl}/jobs/${jobId}`);
  }

  getProjectJobs(projectId: string): Observable<ProcessingJob[]> {
    return this.http.get<ProcessingJob[]>(`${this.baseUrl}/jobs/project/${projectId}`);
  }

  getClips(projectId: string): Observable<GeneratedClip[]> {
    return this.http.get<GeneratedClip[]>(`${this.baseUrl}/clips/project/${projectId}`);
  }

  getClip(clipId: string): Observable<GeneratedClip> {
    return this.http.get<GeneratedClip>(`${this.baseUrl}/clips/${clipId}`);
  }

  reRenderClip(clipId: string, options: { subtitle_style?: string; crop_mode?: string; start_time?: number; end_time?: number }): Observable<GeneratedClip> {
    return this.http.post<GeneratedClip>(`${this.baseUrl}/clips/${clipId}/render`, options);
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${projectId}`);
  }

  getDownloadUrl(clipId: string): string {
    return `${this.baseUrl}/clips/${clipId}/download`;
  }

  getVideoStreamUrl(clipId: string): string {
    return `${this.baseUrl}/clips/${clipId}/stream`;
  }
}

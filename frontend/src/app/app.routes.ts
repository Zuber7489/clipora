import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    redirectTo: 'projects',
    pathMatch: 'full'
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/projects-list/projects-list.component').then(m => m.ProjectsListComponent)
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./features/create-clips/create-clips.component').then(m => m.CreateClipsComponent)
  },
  {
    path: 'projects/:id/processing',
    loadComponent: () =>
      import('./features/processing/processing.component').then(m => m.ProcessingComponent)
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./features/project-results/project-results.component').then(m => m.ProjectResultsComponent)
  },
  {
    path: 'editor/:clipId',
    loadComponent: () =>
      import('./features/editor/editor.component').then(m => m.EditorComponent)
  },
  {
    path: '**',
    redirectTo: 'projects'
  }
];

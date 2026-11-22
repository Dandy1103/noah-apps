import { Routes } from '@angular/router';
import { SystemsComponent } from './features/systems/systems.component';
import { VisibilityComponent } from './features/visibility/visibility.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'systems' },
  { path: 'systems', component: SystemsComponent },
  { path: 'visibility', component: VisibilityComponent },
  { path: '**', redirectTo: 'systems' },
];

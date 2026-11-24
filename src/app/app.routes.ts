import { Routes } from '@angular/router';
import { requireSession } from './require-session';
import { NavigationComponent } from './features/navigation/navigation.component';
import { SystemsComponent } from './features/systems/systems.component';

export const routes: Routes = [
  { path: '', canActivate: [requireSession], children: [
  { path: '', pathMatch: 'full', redirectTo: 'systems' },
  { path: 'systems', component: SystemsComponent },
  { path: 'navigation', component: NavigationComponent },
  { path: '**', redirectTo: 'systems' },
  ]},
];

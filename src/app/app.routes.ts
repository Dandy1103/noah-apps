import { Routes } from '@angular/router';
import { requireAppsManagement, requirePermissionManagement, requireSession } from './require-session';
import { NavigationComponent } from './features/navigation/navigation.component';
import { SystemsComponent } from './features/systems/systems.component';
import { PermissionsComponent } from './features/permissions/permissions.component';

export const routes: Routes = [
  { path: '', canActivate: [requireSession], children: [
  { path: '', pathMatch: 'full', redirectTo: 'systems' },
  { path: 'systems', canActivate: [requireAppsManagement], component: SystemsComponent },
  { path: 'navigation', canActivate: [requireAppsManagement], component: NavigationComponent },
  { path: 'permissions', canActivate: [requirePermissionManagement], component: PermissionsComponent },
  { path: '**', redirectTo: 'systems' },
  ]},
];

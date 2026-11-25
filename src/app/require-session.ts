import { CanActivateFn } from '@angular/router';

export function sendToLogin(): void {
  const next = location.pathname + location.search;
  location.replace('/auth/login?' + new URLSearchParams({ next }));
}

export const requireSession: CanActivateFn = () => {
  return fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).then((response) => {
    if (response.ok) return true;
    if (response.status === 401) sendToLogin();
    return false;
  }).catch(() => false);
};

function requirePermission(key: string): CanActivateFn {
  return () => fetch('/api/apps/session', { credentials: 'same-origin', cache: 'no-store' }).then(async (response) => {
    if (response.status === 401) {
      sendToLogin();
      return false;
    }
    if (!response.ok) return false;
    const session = await response.json() as { permissions?: string[] };
    if (session.permissions?.includes(key)) return true;
    location.replace('/portal');
    return false;
  }).catch(() => false);
}

export const requireAppsManagement = requirePermission('apps-management');
export const requirePermissionManagement = requirePermission('permissions-manage');

export async function signedIn(): Promise<boolean> {
  const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
  if (response?.ok) return true;
  if (!response || response.status === 401) sendToLogin();
  return false;
}

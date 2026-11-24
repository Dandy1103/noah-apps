import { Injectable, signal } from '@angular/core';

const localHosts = ['localhost', '127.0.0.1', '[::1]'];
export const catalogOrigin = localHosts.includes(location.hostname)
  ? 'http://localhost:3002'
  : location.hostname === 'noah-platform.dandy-cheng.com'
    ? ''
    : 'https://noah-platform.dandy-cheng.com';

@Injectable({ providedIn: 'root' })
export class AppsSessionService {
  private readonly status = signal<'loading' | 'login' | 'ready' | 'forbidden' | 'error'>('loading');
  private readonly name = signal('');
  private authOrigin = '';
  private csrfToken = '';

  readonly state = this.status.asReadonly();
  readonly displayName = this.name.asReadonly();

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      const response = await fetch(`${catalogOrigin}/api/apps/login-config`);
      if (!response.ok) throw new Error();
      const configuration = await response.json() as { authOrigin: string; appsOrigin: string };
      const appUrl = new URL(configuration.appsOrigin);
      if (localHosts.includes(location.hostname) && localHosts.includes(appUrl.hostname) &&
          appUrl.origin !== location.origin) {
        appUrl.pathname = location.pathname;
        appUrl.search = location.search;
        appUrl.hash = location.hash;
        location.replace(appUrl);
        return;
      }
      this.authOrigin = new URL(configuration.authOrigin).origin;
      await this.refresh();
    } catch {
      this.status.set('error');
    }
  }

  signInUrl(path: string): string {
    const section = path.split(/[?#]/, 1)[0] === '/navigation' ? 'navigation' : 'systems';
    return `${this.authOrigin}/api/apps/login?section=${section}`;
  }

  async write(path: string, init: RequestInit): Promise<Response> {
    const response = await fetch(`${this.authOrigin}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': this.csrfToken },
    });
    if (response.status === 401) this.setState('login');
    if (response.status === 403) await this.refresh().catch(() => {});
    return response;
  }

  async signOut(): Promise<boolean> {
    try {
      const response = await this.write('/api/apps/session/logout', { method: 'POST' });
      return response.status === 204 || this.state() === 'login';
    } catch {
      return false;
    }
  }

  private async refresh(): Promise<void> {
    const response = await fetch(`${this.authOrigin}/api/apps/session`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      this.setState(response.status === 401 ? 'login' : 'forbidden');
      return;
    }
    if (!response.ok) throw new Error();
    const session = await response.json() as { displayName: string; csrfToken: string };
    this.csrfToken = session.csrfToken;
    this.name.set(session.displayName);
    this.status.set('ready');
  }

  private setState(state: 'login' | 'forbidden'): void {
    this.csrfToken = '';
    this.name.set('');
    this.status.set(state);
  }
}

import { Injectable, signal } from '@angular/core';

export interface ManagedSystem {
  name: string;
  repo: string;
  url: string;
  localUrl?: string;
  audience: string;
  online: boolean;
}

export interface NavLinkRecord {
  label: string;
  app: string | null;
  path: string;
}

export interface NavSectionRecord {
  title: string;
  links: NavLinkRecord[];
}

export interface NavGroupRecord {
  label: string;
  app: string | null;
  sections: NavSectionRecord[];
}

export interface AppCatalog {
  systems: ManagedSystem[];
  groups: NavGroupRecord[];
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly preview = signal<NavGroupRecord[] | null>(null);
  readonly navRevision = signal(0);
  private readonly base = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:3002'
    : '';

  load(signal?: AbortSignal): Promise<AppCatalog> {
    return this.request('/api/apps/catalog', { method: 'GET', signal });
  }

  saveSystems(systems: ManagedSystem[], signal?: AbortSignal): Promise<AppCatalog> {
    return this.request('/api/apps/systems', { method: 'PUT', body: JSON.stringify(systems), signal });
  }

  saveNav(groups: NavGroupRecord[], signal?: AbortSignal): Promise<AppCatalog> {
    return this.request('/api/apps/nav', { method: 'PUT', body: JSON.stringify(groups), signal });
  }

  private async request(path: string, init: RequestInit): Promise<AppCatalog> {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await readMessage(response));
    return response.json() as Promise<AppCatalog>;
  }
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    if (body.message) return body.message;
  } catch {
    return '儲存失敗，請稍後再試。';
  }
  return '儲存失敗，請稍後再試。';
}

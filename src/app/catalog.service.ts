import { inject, Injectable, signal } from '@angular/core';
import { AppsSessionService } from './apps-session.service';

export interface ManagedSystem {
  name: string;
  repo: string;
  url: string;
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

export interface AccountPermission {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  permissions: string[];
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  adminOnly: boolean;
}

export interface AppPermissions {
  currentAccountId: string;
  isAdmin: boolean;
  definitions: PermissionDefinition[];
  accounts: AccountPermission[];
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly preview = signal<NavGroupRecord[] | null>(null);
  readonly catalog = signal<AppCatalog | null>(null);
  readonly navRevision = signal(0);
  private readonly session = inject(AppsSessionService);
  private catalogRequest: Promise<AppCatalog> | null = null;

  load(signal?: AbortSignal): Promise<AppCatalog> {
    if (signal?.aborted) return Promise.reject(new DOMException('已取消。', 'AbortError'));
    if (!this.catalogRequest) {
      this.catalogRequest = this.request('/api/apps/catalog/managed', { method: 'GET' }).then((body) => {
        this.catalog.set(body);
        return body;
      });
    }
    return this.catalogRequest;
  }

  refresh(): void {
    this.catalogRequest = null;
    this.navRevision.update((value) => value + 1);
  }

  saveSystems(systems: ManagedSystem[], signal?: AbortSignal): Promise<AppCatalog> {
    return this.request('/api/apps/systems', { method: 'PUT', body: JSON.stringify(systems), signal });
  }

  saveNav(groups: NavGroupRecord[], signal?: AbortSignal): Promise<AppCatalog> {
    return this.request('/api/apps/nav', { method: 'PUT', body: JSON.stringify(groups), signal });
  }

  loadPermissions(signal?: AbortSignal): Promise<AppPermissions> {
    return this.request<AppPermissions>('/api/apps/permissions', { method: 'GET', signal });
  }

  savePermissions(accounts: Array<Pick<AccountPermission, 'id' | 'permissions'> & Partial<Pick<AccountPermission, 'admin'>>>, signal?: AbortSignal): Promise<AppPermissions> {
    return this.request<AppPermissions>('/api/apps/permissions', { method: 'PUT', body: JSON.stringify({ accounts }), signal });
  }

  private async request<T = AppCatalog>(path: string, init: RequestInit): Promise<T> {
    const response = init.method === 'GET'
      ? await this.session.read(path, init.signal ?? undefined)
      : await this.session.write(path, init);
    if (!response.ok) throw new Error(await readMessage(response));
    return response.json() as Promise<T>;
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

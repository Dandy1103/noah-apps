import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputDirective } from '@dandy1103/ui';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MANAGED_APPS } from '../../catalog';
import { CatalogService, ManagedSystem } from '../../catalog.service';
import { portalEntry } from '../../layout/navbar/nav-catalog';

@Component({
  selector: 'app-systems',
  standalone: true,
  imports: [NoahPageHeadingComponent, NoahButtonComponent, NoahInputDirective],
  templateUrl: './systems.component.html',
  styleUrl: './systems.component.scss',
})
export class SystemsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly controller = new AbortController();

  get portalHome(): string {
    return portalEntry(this.systems.length ? { systems: this.systems } : null);
  }
  readonly status = signal('讀取中');
  readonly canEdit = signal(false);
  readonly isSaving = signal(false);
  systems: ManagedSystem[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controller.abort());
    void this.reload();
  }

  text(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return target.value;
    return '';
  }

  async save(): Promise<void> {
    this.isSaving.set(true);
    this.status.set('');
    try {
      const saved = await this.catalog.saveSystems(this.systems.map((system) => ({
        ...system,
        name: system.name.trim(),
        url: system.url.trim(),
        localUrl: (system.localUrl || '').trim(),
        audience: system.audience.trim(),
      })), this.controller.signal);
      this.systems = saved.systems;
      this.catalog.navRevision.update((value) => value + 1);
      this.status.set('已儲存。');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : '儲存失敗，請稍後再試。');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async reload(): Promise<void> {
    try {
      const catalog = await this.catalog.load(this.controller.signal);
      this.systems = catalog.systems;
      this.canEdit.set(true);
      this.status.set('');
    } catch {
      this.systems = MANAGED_APPS.map((app) => ({ ...app }));
      this.canEdit.set(false);
      this.status.set('API 沒有回應，現在顯示的是專案裡的備份。');
    }
  }
}

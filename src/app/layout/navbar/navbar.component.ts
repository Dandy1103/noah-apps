import { Component, computed, effect, inject, signal } from '@angular/core';
import { NoahNavbarComponent } from '@dandy1103/ui';
import { applyNav, NavCatalog } from './nav-catalog';
import { CatalogService } from '../../catalog.service';

const repo = 'noah-apps';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NoahNavbarComponent],
  template: `@if (groups(); as groups) { <noah-navbar [groups]="groups" [currentLabel]="currentLabel()" /> }`,
})
export class NavbarComponent {
  private readonly catalogs = inject(CatalogService);
  private readonly catalog = signal<NavCatalog | null>(null);

  constructor() {
    effect((onCleanup) => {
      this.catalogs.navRevision();
      const request = new AbortController();
      onCleanup(() => request.abort());
      void this.catalogs.load(request.signal).then(value => {
        if (!request.signal.aborted) this.catalog.set(value);
      }).catch(() => {});
    });
  }

  readonly groups = computed(() => {
    const catalog = this.catalog();
    const preview = this.catalogs.preview();
    return catalog ? applyNav({ ...catalog, groups: preview ?? catalog.groups }, repo) : null;
  });

  readonly currentLabel = computed(() => {
    const catalog = this.catalog();
    const group = catalog?.groups.find(value => value.app === repo);
    return catalog?.systems.find(value => value.repo === repo)?.name?.trim() || group?.label || '應用管理';
  });
}

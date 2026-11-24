import { NoahLoadingMaskComponent, NoahSidebarComponent, NoahSidebarSection } from '@dandy1103/ui';
import { Component, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppsSessionService } from './apps-session.service';
import { CatalogService, NavGroupRecord } from './catalog.service';
import { HeaderComponent } from './layout/header/header.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { signedIn } from './require-session';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NoahLoadingMaskComponent, NoahSidebarComponent, RouterOutlet, HeaderComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly session = inject(AppsSessionService);
  readonly router = inject(Router);
  private readonly catalogs = inject(CatalogService);
  readonly sections = signal<NoahSidebarSection[]>([]);
  readonly shellReady = signal(false);

  constructor() {
    void this.open();
    effect((onCleanup) => {
      this.catalogs.navRevision();
      const request = new AbortController();
      onCleanup(() => request.abort());
      void this.catalogs.load(request.signal).then((catalog) => {
        if (!request.signal.aborted) this.sections.set(sectionsFor(catalog.groups, 'noah-apps'));
      }).catch(() => {});
    });
  }

  private async open(): Promise<void> {
    if (!await signedIn()) return;
    const catalog = await this.catalogs.load().catch(() => null);
    if (catalog) this.sections.set(sectionsFor(catalog.groups, 'noah-apps'));
    this.shellReady.set(true);
  }

  @ViewChild('signInDialog')
  set signInDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (dialog && !dialog.nativeElement.open) dialog.nativeElement.showModal();
  }
}

function sectionsFor(groups: readonly NavGroupRecord[], repo: string): NoahSidebarSection[] {
  const mine = groups.find((group) => group && group.app === repo);
  if (!mine || !Array.isArray(mine.sections)) return [];
  const sections: NoahSidebarSection[] = [];
  for (const section of mine.sections) {
    if (!section || typeof section.title !== 'string' || !Array.isArray(section.links)) continue;
    const links: NoahSidebarSection['links'][number][] = [];
    for (const link of section.links) {
      if (!link || typeof link.label !== 'string') continue;
      const path = typeof link.path === 'string' ? link.path : '';
      links.push({ label: link.label, path: path ? `/${path}` : '/', exact: true });
    }
    if (links.length) sections.push({ title: section.title, links });
  }
  return sections;
}

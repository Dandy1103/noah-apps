import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputDirective } from '@dandy1103/ui';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CatalogService, ManagedSystem, NavGroupRecord } from '../../catalog.service';
import { portalEntry } from '../../layout/navbar/nav-catalog';

interface DraftLink {
  key: number;
  label: string;
  app: string;
  path: string;
}

interface DraftSection {
  key: number;
  title: string;
  links: DraftLink[];
}

interface DraftGroup {
  key: number;
  label: string;
  app: string;
  sections: DraftSection[];
}

type PointerDrag =
  | { kind: 'group'; index: number; startX: number; startY: number; moved: boolean }
  | { kind: 'section'; group: DraftGroup; index: number; startX: number; startY: number; moved: boolean }
  | { kind: 'link'; section: DraftSection; index: number; startX: number; startY: number; moved: boolean };

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [NoahPageHeadingComponent, NoahButtonComponent, NoahInputDirective],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
  private readonly catalog = inject(CatalogService);
  private readonly controller = new AbortController();
  private key = 0;
  private pointer: PointerDrag | null = null;
  private ignoreClick = false;
  private readonly motions = new Map<string, Animation>();

  get portalHome(): string {
    return portalEntry(this.systems.length ? { systems: this.systems } : null);
  }
  readonly status = signal('讀取中');
  readonly isSaving = signal(false);
  readonly isReady = signal(false);
  readonly selectedKey = signal<number | null>(null);
  systems: ManagedSystem[] = [];
  groups: DraftGroup[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controller.abort();
      this.catalog.preview.set(null);
    });
    void this.reload();
  }

  selected(): DraftGroup | null {
    const key = this.selectedKey();
    return this.groups.find((group) => group.key === key) ?? null;
  }

  selectedIndex(): number {
    const key = this.selectedKey();
    return this.groups.findIndex((group) => group.key === key);
  }

  async save(): Promise<void> {
    this.isSaving.set(true);
    this.status.set('');
    try {
      const saved = await this.catalog.saveNav(this.payload(), this.controller.signal);
      this.catalog.preview.set(null);
      this.catalog.navRevision.update((value) => value + 1);
      this.apply(saved.systems, saved.groups);
      this.status.set('已儲存。');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : '儲存失敗，請稍後再試。');
    } finally {
      this.isSaving.set(false);
    }
  }

  selectGroup(key: number): void {
    if (this.ignoreClick) {
      this.ignoreClick = false;
      return;
    }
    this.selectedKey.set(key);
  }

  addGroup(): void {
    const group: DraftGroup = {
      key: this.nextKey(),
      label: '',
      app: '',
      sections: [{ key: this.nextKey(), title: '', links: [] }],
    };
    this.groups.push(group);
    this.selectedKey.set(group.key);
    this.syncPreview();
  }

  moveSelected(step: number): void {
    const index = this.selectedIndex();
    this.animateMove('.order [data-flip-key]', '', () => {
      this.place(this.groups, index, index + step);
    });
    this.syncPreview();
  }

  removeSelected(): void {
    const index = this.selectedIndex();
    if (index < 0) return;
    this.groups.splice(index, 1);
    const next = this.groups[index] ?? this.groups[index - 1] ?? null;
    this.selectedKey.set(next?.key ?? null);
    this.syncPreview();
  }

  addSection(group: DraftGroup): void {
    group.sections.push({ key: this.nextKey(), title: '', links: [] });
    this.syncPreview();
  }

  removeSection(group: DraftGroup, index: number): void {
    group.sections.splice(index, 1);
    this.syncPreview();
  }

  addLink(section: DraftSection): void {
    section.links.push({ key: this.nextKey(), label: '', app: '', path: '' });
    this.syncPreview();
  }

  removeLink(section: DraftSection, index: number): void {
    section.links.splice(index, 1);
    this.syncPreview();
  }

  systemName(repo: string): string {
    return this.systems.find((system) => system.repo === repo)?.name ?? '';
  }

  holdingGroup(index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'group' && pointer.index === index;
  }

  holdingSection(index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'section' && pointer.index === index;
  }

  holdingLink(index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'link' && pointer.index === index;
  }

  startGroupPointer(index: number, event: PointerEvent): void {
    this.capture(event, { kind: 'group', index, startX: event.clientX, startY: event.clientY, moved: false });
  }

  moveGroupPointer(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.kind !== 'group' || !this.pastThreshold(pointer, event)) return;
    const to = this.stepToward(event, '.order [data-flip-key]', 'data-order-index', pointer.index);
    if (to === null) return;
    this.slide(this.groups, pointer, to, '.order [data-flip-key]', 'data-order-index');
  }

  startSectionPointer(group: DraftGroup, index: number, event: PointerEvent): void {
    this.capture(event, { kind: 'section', group, index, startX: event.clientX, startY: event.clientY, moved: false });
  }

  moveSectionPointer(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.kind !== 'section' || !this.pastThreshold(pointer, event)) return;
    const to = this.stepToward(event, '.panel > .section', 'data-section-index', pointer.index);
    if (to === null) return;
    this.slide(pointer.group.sections, pointer, to, '.panel > .section', 'data-section-index');
  }

  startLinkPointer(section: DraftSection, index: number, event: PointerEvent): void {
    this.capture(event, { kind: 'link', section, index, startX: event.clientX, startY: event.clientY, moved: false });
  }

  moveLinkPointer(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.kind !== 'link' || !this.pastThreshold(pointer, event)) return;
    const to = this.stepToward(
      event,
      `.section__links [data-section-key="${pointer.section.key}"]`,
      'data-link-index',
      pointer.index,
    );
    if (to === null) return;
    this.slide(
      pointer.section.links,
      pointer,
      to,
      `.section__links [data-section-key="${pointer.section.key}"]`,
      'data-link-index',
    );
  }

  stopPointer(): void {
    if (this.pointer?.moved) {
      this.ignoreClick = true;
      this.syncPreview();
    }
    this.pointer = null;
  }

  text(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return target.value;
    return '';
  }

  note(): void {
    this.syncPreview();
  }

  private capture(event: PointerEvent, pointer: PointerDrag): void {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // 不是真實指標時抓不到，放開時仍會清掉
    }
    this.pointer = pointer;
  }

  private pastThreshold(pointer: PointerDrag, event: PointerEvent): boolean {
    if (pointer.moved) return true;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (dx * dx + dy * dy < 9) return false;
    pointer.moved = true;
    return true;
  }

  private stepToward(event: PointerEvent, selector: string, indexAttr: string, from: number): number | null {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .sort((left, right) => Number(left.getAttribute(indexAttr)) - Number(right.getAttribute(indexAttr)));
    const current = elements[from];
    if (!current) return null;
    const origin = this.layoutBox(current);
    for (const step of [1, -1]) {
      const neighbor = elements[from + step];
      if (!neighbor) continue;
      if (this.crossed(event.clientX, event.clientY, origin, this.layoutBox(neighbor))) return from + step;
    }
    return null;
  }

  private layoutBox(element: HTMLElement): { x: number; y: number; w: number; h: number } {
    const rect = element.getBoundingClientRect();
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return {
      x: rect.left - matrix.m41,
      y: rect.top - matrix.m42,
      w: element.offsetWidth,
      h: element.offsetHeight,
    };
  }

  private crossed(
    x: number,
    y: number,
    origin: { x: number; y: number },
    neighbor: { x: number; y: number; w: number; h: number },
  ): boolean {
    const dx = neighbor.x - origin.x;
    const dy = neighbor.y - origin.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const center = neighbor.x + neighbor.w / 2;
      return dx > 0 ? x > center : x < center;
    }
    const center = neighbor.y + neighbor.h / 2;
    return dy > 0 ? y > center : y < center;
  }

  private slide<T>(list: T[], pointer: PointerDrag, to: number, selector: string, indexAttr: string): void {
    if (Math.abs(pointer.index - to) !== 1) return;
    const held = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find((element) => Number(element.getAttribute(indexAttr)) === pointer.index)
      ?.getAttribute('data-flip-key') ?? '';
    this.animateMove(selector, held, () => {
      this.place(list, pointer.index, to);
      pointer.index = to;
    });
  }

  private animateMove(selector: string, heldKey: string, mutate: () => void): void {
    for (const motion of this.motions.values()) motion.finish();
    this.motions.clear();
    const before = new Map<string, DOMRect>();
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const key = element.getAttribute('data-flip-key');
      if (key && key !== heldKey) before.set(key, element.getBoundingClientRect());
    }
    mutate();
    requestAnimationFrame(() => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const key = element.getAttribute('data-flip-key');
        const previous = key ? before.get(key) : undefined;
        if (!key || !previous || key === heldKey) continue;
        const next = element.getBoundingClientRect();
        const dx = previous.left - next.left;
        const dy = previous.top - next.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        this.motions.set(key, element.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 200, easing: 'ease-out' },
        ));
      }
    });
  }

  private async reload(): Promise<void> {
    try {
      const catalog = await this.catalog.load(this.controller.signal);
      this.apply(catalog.systems, catalog.groups);
      this.status.set('');
    } catch {
      this.status.set('無法讀取導覽。請確認 API 有啟動。');
    }
  }

  private apply(systems: ManagedSystem[], groups: NavGroupRecord[]): void {
    const previous = this.selected()?.app ?? '';
    this.systems = systems;
    this.groups = groups.map((group) => ({
      key: this.nextKey(),
      label: group.label,
      app: group.app ?? '',
      sections: group.sections.map((section) => ({
        key: this.nextKey(),
        title: section.title,
        links: section.links.map((link) => ({
          key: this.nextKey(),
          label: link.label,
          app: link.app ?? '',
          path: link.path,
        })),
      })),
    }));
    const match = previous ? this.groups.find((group) => group.app === previous) : undefined;
    this.selectedKey.set(match?.key ?? this.groups[0]?.key ?? null);
    this.isReady.set(true);
  }

  private payload(): NavGroupRecord[] {
    return this.groups.map((group) => ({
      label: this.systemName(group.app),
      app: group.app || null,
      sections: group.sections.map((section) => ({
        title: section.title.trim(),
        links: section.links.map((link) => ({
          label: link.label.trim(),
          app: link.app || null,
          path: link.path.trim(),
        })),
      })),
    }));
  }

  private syncPreview(): void {
    if (!this.isReady()) return;
    this.catalog.preview.set(this.payload());
  }

  private place<T>(list: T[], from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
  }

  private nextKey(): number {
    this.key += 1;
    return this.key;
  }
}

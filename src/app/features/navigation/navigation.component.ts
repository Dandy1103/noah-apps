import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent, NoahLoadingMaskComponent, NoahTableComponent, type NoahSelectOption } from '@dandy1103/ui';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, HostListener, inject, Injector, signal, ViewChild } from '@angular/core';
import { CatalogService, ManagedSystem, NavGroupRecord } from '../../catalog.service';
import { portalEntry } from '../../layout/navbar/nav-catalog';
import { OperationLoadingService } from '@dandy1103/common';
import { ToastService } from '../../shared/toast/toast.service';

interface DraftLink {
  key: number;
  label: string;
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
  readonly app: string;
  sections: DraftSection[];
}

type InlineEdit =
  | { field: DraftSection; title: string }
  | { field: DraftLink; label: string; path: string };

type PointerTarget =
  | { kind: 'group'; index: number }
  | { kind: 'section'; group: DraftGroup; index: number }
  | { kind: 'link'; section: DraftSection; index: number };

type PointerDrag = PointerTarget & { id: number; startX: number; startY: number; moved: boolean };

@Component({
  selector: 'app-navigation',
  standalone: true,
  host: { '[class.with-floating-actions]': 'isReady()' },
  imports: [NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent, NoahLoadingMaskComponent, NoahTableComponent],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly controller = new AbortController();
  readonly loading = inject(OperationLoadingService).create(this.controller.signal);
  private readonly draftGroups = signal<DraftGroup[] | null>(null);
  private readonly activeEdit = signal<InlineEdit | null>(null);
  private readonly systemOptions = signal<readonly NoahSelectOption[]>([]);
  private savedGroups: DraftGroup[] = [];
  private key = 0;
  private pointer: PointerDrag | null = null;
  private readonly motions = new Map<string, Animation>();
  @ViewChild('activeField', { read: ElementRef }) private activeField?: ElementRef<HTMLElement>;

  get portalHome(): string {
    return portalEntry(this.systems.length ? { systems: this.systems } : null);
  }
  readonly status = signal('');
  readonly isSaving = signal(false);
  readonly isReady = signal(false);
  readonly isEditing = computed(() => this.draftGroups() !== null);
  readonly selectedKey = signal<number | null>(null);
  readonly activeFieldKey = computed(() => this.activeEdit()?.field.key ?? null);
  readonly isGroupPickerOpen = signal(false);
  readonly availableSystemOptions = computed(() => {
    const assigned = new Set(this.groups.map((group) => group.app));
    return this.systemOptions().filter(({ value }) => value !== 'noah-portal' && !assigned.has(value));
  });
  systems: ManagedSystem[] = [];

  get groups(): DraftGroup[] {
    return this.draftGroups() ?? this.savedGroups;
  }

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

  edit(): void {
    if (!this.isReady() || this.isEditing()) return;
    this.status.set('');
    this.draftGroups.set(this.savedGroups.map((group) => ({
      ...group,
      sections: group.sections.map((section) => ({
        ...section,
        links: section.links.map((link) => ({ ...link })),
      })),
    })));
  }

  cancel(): void {
    if (!this.isEditing() || this.isSaving()) return;
    this.closeEditor();
    if (!this.selected()) this.selectedKey.set(this.savedGroups[0]?.key ?? null);
    this.status.set('');
  }

  async save(): Promise<void> {
    if (!this.isEditing() || this.isSaving()) return;
    this.isSaving.set(true);
    this.status.set('');
    try {
      const saved = await this.loading.run(() => this.catalog.saveNav(this.payload(), this.controller.signal));
      if (this.controller.signal.aborted) return;
      this.apply(saved.systems, saved.groups);
      this.closeEditor();
      this.catalog.refresh();
      this.toast.showSuccess('導覽已儲存');
    } catch (error) {
      if (this.controller.signal.aborted) return;
      this.toast.showError('儲存失敗', (error instanceof Error && error.message.trim()) || '請稍後再試。');
    } finally {
      this.isSaving.set(false);
    }
  }

  private closeEditor(): void {
    const pointer = this.pointer;
    this.pointer = null;
    const host = this.host.nativeElement;
    if (pointer && host.hasPointerCapture(pointer.id)) host.releasePointerCapture(pointer.id);
    for (const motion of this.motions.values()) motion.cancel();
    this.motions.clear();
    this.activeEdit.set(null);
    this.closeGroupPicker();
    this.draftGroups.set(null);
    this.catalog.preview.set(null);
  }

  selectGroup(key: number): void {
    if (this.selectedKey() === key) return;
    this.activeEdit.set(null);
    this.closeGroupPicker();
    this.selectedKey.set(key);
  }

  activateField(field: DraftSection | DraftLink): void {
    const key = field.key;
    if (!this.isEditing() || this.isSaving() || this.activeFieldKey() === key) return;
    this.activeEdit.set('title' in field
      ? { field, title: field.title }
      : { field, label: field.label, path: field.path });
    afterNextRender(() => {
      if (this.activeFieldKey() === key && !this.isSaving()) {
        this.activeField?.nativeElement.querySelector('input')?.focus();
      }
    }, { injector: this.injector });
  }

  finishInlineEdit(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    const edit = this.activeEdit();
    // Some browsers report 229 while the keyboard event is handled by the IME.
    if (!edit || event.isComposing || event.keyCode === 229 || this.isSaving()) return;

    event.preventDefault();
    if (event.key === 'Escape') {
      if ('title' in edit) {
        edit.field.title = edit.title;
      } else {
        edit.field.label = edit.label;
        edit.field.path = edit.path;
      }
      this.syncPreview();
    }
    const key = edit.field.key;
    this.activeEdit.set(null);
    afterNextRender(() => {
      if (!this.isEditing() || this.activeFieldKey() !== null || this.isSaving()) return;
      this.host.nativeElement.querySelector<HTMLButtonElement>(
        `button[data-inline-editor="${key}"], [data-inline-editor="${key}"] .text-edit`,
      )?.focus();
    }, { injector: this.injector });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.closeGroupPicker();
    const active = this.activeFieldKey();
    if (active === null || this.isSaving()) return;

    const staysOpen = event.composedPath().some((target) =>
      target instanceof Element && (
        target.getAttribute('data-inline-editor') === String(active) ||
        target.hasAttribute('data-opens-inline-editor')
      ),
    );
    if (!staysOpen) this.activeEdit.set(null);
  }

  closeGroupPicker(): void {
    this.isGroupPickerOpen.set(false);
  }

  toggleGroupPicker(): void {
    this.isGroupPickerOpen.update((open) => !open);
  }

  addGroup(app: string): void {
    const draft = this.draftGroups();
    if (!draft || this.isSaving()) return;
    const system = this.availableSystemOptions().find((option) => option.value === app);
    if (!system) return;
    const group: DraftGroup = {
      key: this.nextKey(),
      label: system.label,
      app: system.value,
      sections: [{ key: this.nextKey(), title: '', links: [] }],
    };
    this.draftGroups.set([...draft, group]);
    this.selectGroup(group.key);
    this.activateField(group.sections[0]);
    this.syncPreview();
  }

  addSection(group: DraftGroup): void {
    const section = { key: this.nextKey(), title: '', links: [] };
    group.sections.push(section);
    this.activateField(section);
    this.syncPreview();
  }

  removeSection(group: DraftGroup, index: number): void {
    const section = group.sections[index];
    const active = this.activeFieldKey();
    if (section.key === active || section.links.some((link) => link.key === active)) this.activeEdit.set(null);
    group.sections.splice(index, 1);
    this.syncPreview();
  }

  addLink(section: DraftSection): void {
    const link = { key: this.nextKey(), label: '', path: '' };
    section.links.push(link);
    this.activateField(link);
    this.syncPreview();
  }

  removeLink(section: DraftSection, index: number): void {
    if (section.links[index].key === this.activeFieldKey()) this.activeEdit.set(null);
    this.closeGroupPicker();
    section.links.splice(index, 1);
    this.syncPreview();
  }

  systemName(repo: string): string {
    return this.systems.find((system) => system.repo === repo)?.name ?? '';
  }

  groupName(group: DraftGroup): string {
    return this.systemName(group.app) || group.label || '未命名群組';
  }

  holdingGroup(index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'group' && pointer.index === index;
  }

  holdingSection(index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'section' && pointer.index === index;
  }

  holdingLink(sectionKey: number, index: number): boolean {
    const pointer = this.pointer;
    return !!pointer?.moved && pointer.kind === 'link' && pointer.section.key === sectionKey && pointer.index === index;
  }

  startGroupPointer(index: number, event: PointerEvent): void {
    this.startPointer(event, { kind: 'group', index });
  }

  private moveGroupPointer(pointer: PointerDrag, event: PointerEvent): void {
    const to = this.stepToward(event, '.order [data-flip-key]', 'data-order-index', pointer.index);
    if (to === null) return;
    this.slide(this.groups, pointer, to, '.order [data-flip-key]', 'data-order-index');
  }

  startSectionPointer(group: DraftGroup, index: number, event: PointerEvent): void {
    this.startPointer(event, { kind: 'section', group, index });
  }

  private moveSectionPointer(pointer: Extract<PointerDrag, { kind: 'section' }>, event: PointerEvent): void {
    const to = this.stepToward(event, '.panel > .section', 'data-section-index', pointer.index);
    if (to === null) return;
    this.slide(pointer.group.sections, pointer, to, '.panel > .section', 'data-section-index');
  }

  startLinkPointer(section: DraftSection, index: number, event: PointerEvent): void {
    this.startPointer(event, { kind: 'link', section, index });
  }

  private moveLinkPointer(pointer: Extract<PointerDrag, { kind: 'link' }>, event: PointerEvent): void {
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

  @HostListener('document:pointermove', ['$event'])
  movePointer(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id || this.isSaving()) return;
    if (event.buttons === 0) {
      this.stopPointer();
      return;
    }
    if (!this.markDragging(pointer, event)) return;

    switch (pointer.kind) {
      case 'group': this.moveGroupPointer(pointer, event); break;
      case 'section': this.moveSectionPointer(pointer, event); break;
      case 'link': this.moveLinkPointer(pointer, event); break;
    }
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  releasePointer(event: PointerEvent): void {
    if (event.pointerId === this.pointer?.id) this.stopPointer();
  }

  @HostListener('lostpointercapture', ['$event'])
  losePointerCapture(event: PointerEvent): void {
    if (event.target === this.host.nativeElement) this.releasePointer(event);
  }

  @HostListener('window:blur')
  stopPointer(): void {
    const moved = this.pointer?.moved;
    this.pointer = null;
    if (moved) this.syncPreview();
  }

  text(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement) return target.value;
    return '';
  }

  note(): void {
    this.syncPreview();
  }

  private startPointer(event: PointerEvent, target: PointerTarget): void {
    if (!this.isEditing() || this.isSaving() || this.pointer || event.button !== 0) return;
    this.pointer = { ...target, id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  }

  private markDragging(pointer: PointerDrag, event: PointerEvent): boolean {
    if (pointer.moved) return true;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (dx * dx + dy * dy < 9) return false;
    pointer.moved = true;
    this.closeGroupPicker();
    // Capture on the host after the threshold so reordering rows cannot drop it.
    try {
      this.host.nativeElement.setPointerCapture(pointer.id);
    } catch {
      // Document listeners still handle moves and release if capture is unavailable.
    }
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
      if (!this.isEditing()) return;
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
      const catalog = await this.loading.run(() => this.catalog.load(this.controller.signal));
      this.apply(catalog.systems, catalog.groups);
      this.status.set('');
    } catch {
      this.status.set('無法讀取導覽。請確認 API 有啟動。');
    }
  }

  private apply(systems: ManagedSystem[], groups: NavGroupRecord[]): void {
    const previous = this.selected()?.app ?? '';
    this.systems = systems;
    this.savedGroups = groups.map((group) => ({
      key: this.nextKey(),
      label: group.label,
      app: group.app ?? '',
      sections: group.sections.map((section) => ({
        key: this.nextKey(),
        title: section.title,
        links: section.links.map((link) => ({
          key: this.nextKey(),
          label: link.label,
          path: link.path,
        })),
      })),
    }));
    this.systemOptions.set(systems.map(({ repo, name }) => ({ value: repo, label: name })));
    const match = previous ? this.savedGroups.find((group) => group.app === previous) : undefined;
    this.selectedKey.set(match?.key ?? this.savedGroups[0]?.key ?? null);
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
          app: group.app || null,
          path: link.path.trim(),
        })),
      })),
    }));
  }

  private syncPreview(): void {
    if (!this.isEditing() || this.isSaving()) return;
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

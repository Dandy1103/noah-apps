import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent, NoahSelectComponent, type NoahSelectOption } from '@dandy1103/ui';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MANAGED_APPS } from '../../catalog';
import { CatalogService, ManagedSystem } from '../../catalog.service';
import { portalEntry } from '../../layout/navbar/nav-catalog';

const SYSTEM_ACRONYMS = new Set(['hrm', 'crm', 'erp', 'itsm', 'lms']);

@Component({
  selector: 'app-systems',
  standalone: true,
  imports: [NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent, NoahSelectComponent],
  templateUrl: './systems.component.html',
  styleUrl: './systems.component.scss',
})
export class SystemsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly controller = new AbortController();
  private readonly draftSystems = signal<ManagedSystem[] | null>(null);

  get portalHome(): string {
    return portalEntry(this.systems.length ? { systems: this.systems } : null);
  }
  readonly status = signal('讀取中');
  readonly canEdit = signal(false);
  readonly isEditing = computed(() => this.draftSystems() !== null);
  readonly isSaving = signal(false);
  readonly statusOptions: readonly NoahSelectOption[] = [
    { value: 'true', label: '上線' },
    { value: 'false', label: '未開' },
  ];
  private systems: ManagedSystem[] = [];

  get displayedSystems(): ManagedSystem[] {
    return this.draftSystems() ?? this.systems;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controller.abort());
    void this.reload();
  }

  englishSystemName(repo: string): string {
    return repo.replace(/^noah-/, '').split('-').map((word) =>
      SYSTEM_ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
    ).join(' ');
  }

  text(event: Event): string {
    const target = event.target;
    if (target instanceof HTMLInputElement) return target.value;
    return '';
  }

  edit(): void {
    if (!this.canEdit() || this.isEditing()) return;
    this.status.set('');
    this.draftSystems.set(this.systems.map((system) => ({ ...system })));
  }

  cancel(): void {
    if (!this.isEditing() || this.isSaving()) return;
    this.draftSystems.set(null);
    this.status.set('');
  }

  async save(): Promise<void> {
    const draft = this.draftSystems();
    if (!this.canEdit() || !draft || this.isSaving()) return;
    this.isSaving.set(true);
    this.status.set('');
    try {
      const saved = await this.catalog.saveSystems(draft.map((system) => ({
        ...system,
        name: system.name.trim(),
        url: system.url.trim(),
      })), this.controller.signal);
      this.systems = saved.systems;
      this.catalog.refresh();
      this.draftSystems.set(null);
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

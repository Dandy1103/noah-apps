import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent } from '@dandy1103/ui';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { OperationLoadingService, ToastService } from '@dandy1103/common';
import { AccountPermission, CatalogService, ManagedSystem } from '../../catalog.service';
import { portalEntry } from '../../layout/navbar/nav-catalog';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly controller = new AbortController();
  readonly loading = inject(OperationLoadingService).create(this.controller.signal);
  readonly status = signal('');
  readonly search = signal('');
  readonly isSaving = signal(false);
  readonly systems = signal<ManagedSystem[]>([]);
  readonly accounts = signal<AccountPermission[]>([]);
  readonly selectedAccount = signal<AccountPermission | null>(null);
  readonly editingSystems = signal<string[]>([]);
  readonly filteredAccounts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    if (!query) return this.accounts();
    return this.accounts().filter((account) => `${account.name} ${account.email}`.toLocaleLowerCase().includes(query));
  });

  get portalHome(): string {
    return portalEntry(this.catalog.catalog()?.systems.length ? { systems: this.catalog.catalog()!.systems } : null);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controller.abort());
    void this.reload();
  }

  editPermissions(account: AccountPermission): void {
    if (this.isSaving()) return;
    this.selectedAccount.set(account);
    this.editingSystems.set([...account.systems]);
  }

  closeEditor(): void {
    if (this.isSaving()) return;
    this.selectedAccount.set(null);
  }

  toggleSystem(repo: string, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.editingSystems.update((systems) => event.target instanceof HTMLInputElement && event.target.checked
      ? [...new Set([...systems, repo])]
      : systems.filter((system) => system !== repo));
  }

  systemName(repo: string): string {
    return this.systems().find((system) => system.repo === repo)?.name ?? repo;
  }

  async save(): Promise<void> {
    const selected = this.selectedAccount();
    if (!selected || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const accounts = this.accounts().map((account) => account.id === selected.id
        ? { ...account, systems: this.editingSystems() }
        : account);
      const result = await this.loading.run(() => this.catalog.savePermissions(accounts, this.controller.signal));
      if (this.controller.signal.aborted) return;
      this.accounts.set(result.accounts);
      this.selectedAccount.set(null);
      this.toast.showSuccess('權限已儲存');
    } catch (error) {
      if (!this.controller.signal.aborted) this.toast.showError('儲存失敗', (error instanceof Error && error.message.trim()) || '請稍後再試。');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async reload(): Promise<void> {
    try {
      const [catalog, permissions] = await Promise.all([
        this.loading.run(() => this.catalog.load(this.controller.signal)),
        this.loading.run(() => this.catalog.loadPermissions(this.controller.signal)),
      ]);
      if (this.controller.signal.aborted) return;
      this.systems.set(catalog.systems);
      this.accounts.set(permissions.accounts.map((account) => ({ ...account, systems: [...account.systems] })));
    } catch (error) {
      if (!this.controller.signal.aborted) this.status.set((error instanceof Error && error.message.trim()) || '無法讀取帳號權限，請確認權限 API 已啟動。');
    }
  }
}

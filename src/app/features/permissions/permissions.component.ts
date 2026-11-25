import { NoahPageHeadingComponent, NoahButtonComponent, NoahInputComponent } from '@dandy1103/ui';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { OperationLoadingService, ToastService } from '@dandy1103/common';
import { AccountPermission, CatalogService, PermissionDefinition } from '../../catalog.service';
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
  readonly accounts = signal<AccountPermission[]>([]);
  readonly definitions = signal<PermissionDefinition[]>([]);
  readonly currentAccountId = signal('');
  readonly isAdmin = signal(false);
  readonly selectedAccount = signal<AccountPermission | null>(null);
  readonly editingPermissions = signal<string[]>([]);
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
    if (this.isSaving() || account.admin || account.id === this.currentAccountId()) return;
    this.selectedAccount.set(account);
    this.editingPermissions.set([...account.permissions]);
  }

  closeEditor(): void {
    if (this.isSaving()) return;
    this.selectedAccount.set(null);
  }

  togglePermission(key: string, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.editingPermissions.update((permissions) => event.target instanceof HTMLInputElement && event.target.checked
      ? [...new Set([...permissions, key])]
      : permissions.filter((permission) => permission !== key));
  }

  permissionLabel(key: string): string {
    return this.definitions().find((permission) => permission.key === key)?.label ?? key;
  }

  async save(): Promise<void> {
    const selected = this.selectedAccount();
    if (!selected || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const result = await this.loading.run(() => this.catalog.savePermissions([
        { id: selected.id, permissions: this.editingPermissions() },
      ], this.controller.signal));
      if (this.controller.signal.aborted) return;
      this.accounts.set(result.accounts);
      this.definitions.set(result.definitions);
      this.currentAccountId.set(result.currentAccountId);
      this.isAdmin.set(result.isAdmin);
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
      const permissions = await this.loading.run(() => this.catalog.loadPermissions(this.controller.signal));
      if (this.controller.signal.aborted) return;
      this.accounts.set(permissions.accounts.map((account) => ({ ...account, permissions: [...account.permissions] })));
      this.definitions.set(permissions.definitions);
      this.currentAccountId.set(permissions.currentAccountId);
      this.isAdmin.set(permissions.isAdmin);
    } catch (error) {
      if (!this.controller.signal.aborted) this.status.set((error instanceof Error && error.message.trim()) || '無法讀取帳號權限，請確認權限 API 已啟動。');
    }
  }
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NoahHeaderAction, NoahHeaderComponent } from '@dandy1103/ui';
import { AppsSessionService } from '../../apps-session.service';
import { loadCatalog, NavCatalog, portalEntry } from '../navbar/nav-catalog';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  template: `
    <noah-header [homeHref]="homeHref" [actions]="actions" [userName]="session.displayName()" (submitted)="signOut($event)" />
    @if (signOutError()) { <p role="alert">登出失敗。請重新整理後再試。</p> }
  `,
})
export class HeaderComponent {
  private readonly catalog = signal<NavCatalog | null>(null);
  readonly session = inject(AppsSessionService);
  readonly signOutError = signal(false);
  private signingOut = false;

  constructor() {
    const request = new AbortController();
    inject(DestroyRef).onDestroy(() => request.abort());
    void loadCatalog(request.signal).then((value) => this.catalog.set(value));
  }

  get homeHref(): string {
    return portalEntry(this.catalog());
  }

  get actions(): NoahHeaderAction[] {
    const home = this.homeHref;
    const origin = home ? new URL(home, location.origin).origin + '/' : '';
    return [
      { label: '個人資料', href: portalEntry(this.catalog(), 'profile') },
      { label: '我的權限', href: portalEntry(this.catalog(), 'permissions') },
      { label: '變更密碼', href: origin ? new URL('auth/change-password', origin).href : '' },
      { label: '登出', href: origin ? new URL('auth/logout', origin).href : '', method: 'post' },
    ];
  }

  async signOut(event: Event): Promise<void> {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || new URL(form.action).pathname !== '/auth/logout') return;
    event.preventDefault();
    if (this.signingOut) return;
    this.signingOut = true;
    this.signOutError.set(false);
    if (await this.session.signOut()) {
      form.submit();
    } else {
      this.signOutError.set(true);
      this.signingOut = false;
    }
  }
}

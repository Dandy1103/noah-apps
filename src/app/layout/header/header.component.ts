import { Component, inject, signal } from '@angular/core';
import { NoahHeaderAction, NoahHeaderComponent } from '@dandy1103/ui';
import { AppsSessionService } from '../../apps-session.service';

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
  readonly homeHref = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:4200/'
    : 'https://noahportal.dandy-cheng.com/';
  readonly actions: NoahHeaderAction[] = [
    { label: '個人資料', href: new URL('profile', this.homeHref).href },
    { label: '我的權限', href: new URL('permissions', this.homeHref).href },
    { label: '變更密碼', href: new URL('auth/change-password', this.homeHref).href },
    { label: '登出', href: new URL('auth/logout', this.homeHref).href, method: 'post' },
  ];
  readonly session = inject(AppsSessionService);
  readonly signOutError = signal(false);
  private signingOut = false;

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

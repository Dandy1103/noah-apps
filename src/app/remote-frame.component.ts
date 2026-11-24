import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppsSessionService } from './apps-session.service';

@Component({
  selector: 'app-remote-frame',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (session.state() === 'ready') {
      <router-outlet />
    } @else if (session.state() === 'login') {
      <dialog #signInDialog class="sign-in-dialog" aria-labelledby="sign-in-title" (cancel)="$event.preventDefault()">
        <h1 id="sign-in-title">登入逾時請重新登入</h1>
        <a class="sign-in-action" [href]="session.signInUrl(router.url)" autofocus>重新登入</a>
      </dialog>
    } @else {
      @switch (session.state()) {
        @case ('loading') { <p role="status">正在確認登入狀態…</p> }
        @case ('forbidden') { <p role="alert">你的帳號沒有應用管理權限。請聯絡管理員確認。</p> }
        @case ('error') {
          <p role="alert">應用管理載入失敗。</p>
          <button type="button" class="app-button" (click)="session.load()">重新載入</button>
        }
      }
    }
  `,
  styleUrl: './app.component.scss',
})
export class RemoteFrameComponent {
  readonly session = inject(AppsSessionService);
  readonly router = inject(Router);

  @ViewChild('signInDialog')
  set signInDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (dialog && !dialog.nativeElement.open) dialog.nativeElement.showModal();
  }
}

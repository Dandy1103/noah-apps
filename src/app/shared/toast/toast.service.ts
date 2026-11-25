import { Injectable, signal } from '@angular/core';

const FADE_DURATION_MS = 150;
const SUCCESS_DISPLAY_DURATION_MS = 4000;

export interface ToastNotice {
  variant: 'success' | 'error';
  message: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly notice = signal<ToastNotice | null>(null);
  readonly isLeaving = signal(false);
  readonly fadeDuration = `${FADE_DURATION_MS}ms`;
  private timer = 0;

  showSuccess(message: string, detail?: string): void {
    this.show({ variant: 'success', message, detail });
    this.timer = window.setTimeout(() => this.dismiss(), SUCCESS_DISPLAY_DURATION_MS);
  }

  showError(message: string, detail?: string): void {
    this.show({ variant: 'error', message, detail });
  }

  dismiss(): void {
    if (!this.notice() || this.isLeaving()) return;
    window.clearTimeout(this.timer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.notice.set(null);
      return;
    }
    this.isLeaving.set(true);
    this.timer = window.setTimeout(() => {
      this.notice.set(null);
      this.isLeaving.set(false);
    }, FADE_DURATION_MS);
  }

  private show(notice: ToastNotice): void {
    window.clearTimeout(this.timer);
    this.notice.set(notice);
    this.isLeaving.set(false);
  }
}

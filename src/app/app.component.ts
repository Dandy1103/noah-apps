import { NoahSidebarComponent } from '@dandy1103/ui';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppsSessionService } from './apps-session.service';
import { HeaderComponent } from './layout/header/header.component';
import { NavbarComponent } from './layout/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NoahSidebarComponent, RouterOutlet, HeaderComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly session = inject(AppsSessionService);
  readonly router = inject(Router);
  readonly sections = [{ title: '應用', links: [
    { label: '系統清單', path: '/systems' },
    { label: '導覽', path: '/navigation' },
  ] }];

  @ViewChild('signInDialog')
  set signInDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (dialog && !dialog.nativeElement.open) dialog.nativeElement.showModal();
  }
}

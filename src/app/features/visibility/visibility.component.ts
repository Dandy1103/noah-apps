import { Component } from '@angular/core';
import { MANAGED_APPS } from '../../catalog';
import { TableComponent } from '../../shared/table/table.component';

@Component({
  selector: 'app-visibility',
  standalone: true,
  imports: [TableComponent],
  templateUrl: './visibility.component.html',
  styleUrl: '../systems/systems.component.scss',
})
export class VisibilityComponent {
  readonly apps = MANAGED_APPS;
  readonly portalHome = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:4200/'
    : 'https://noahportal.dandy-cheng.com/';
}

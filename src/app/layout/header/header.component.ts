import { Component } from '@angular/core';
import { NoahHeaderComponent } from '@dandy1103/ui';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  template: `<noah-header />`,
})
export class HeaderComponent {}

import { Component, inject } from '@angular/core';
import { NoahNavbarComponent } from '@dandy1103/navbar';
import { CatalogService } from '../../catalog.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NoahNavbarComponent],
  template: `<noah-navbar repo="noah-apps" fallbackLabel="應用管理" [preview]="catalogs.preview()" [revision]="catalogs.navRevision()" />`,
})
export class NavbarComponent {
  readonly catalogs = inject(CatalogService);
}

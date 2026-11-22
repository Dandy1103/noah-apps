import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, NgZone, ViewChild, effect, inject, signal } from '@angular/core';
import { CatalogService } from '../../catalog.service';
import { applyNav, loadCatalog, NavCatalog, NavGroup } from './nav-catalog';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements AfterViewInit {
  currentLabel = '應用管理';
  readonly opened = signal<string | null>(null);
  readonly moreOpen = signal(false);
  readonly visibleCount = signal(20);
  groups: NavGroup[] = this.buildGroups();
  private savedCatalog: NavCatalog | null = null;
  private observer?: ResizeObserver;
  private readonly zone = inject(NgZone);

  @ViewChild('bar') private bar?: ElementRef<HTMLElement>;
  @ViewChild('measure') private measureRow?: ElementRef<HTMLElement>;
  @ViewChild('more') private more?: ElementRef<HTMLElement>;

  constructor() {
    const catalogs = inject(CatalogService);
    const controller = new AbortController();
    inject(DestroyRef).onDestroy(() => {
      controller.abort();
      this.observer?.disconnect();
    });
    effect(() => {
      const preview = catalogs.preview();
      catalogs.navRevision();
      if (preview && this.savedCatalog) {
        this.applyCatalog({ ...this.savedCatalog, groups: preview });
        return;
      }
      void loadCatalog(controller.signal).then((catalog) => {
        if (!catalog || catalogs.preview()) return;
        this.savedCatalog = catalog;
        this.applyCatalog(catalog);
      });
    });
  }

  private applyCatalog(catalog: NavCatalog): void {
    this.groups = applyNav(catalog, 'noah-apps');
    const mine = catalog.groups.find((group) => group.app === 'noah-apps');
    const named = catalog.systems.find((system) => system.repo === mine?.app);
    if (mine) this.currentLabel = named?.name || mine.label;
    requestAnimationFrame(() => this.measure());
  }

  ngAfterViewInit(): void {
    this.measure();
    const bar = this.bar?.nativeElement;
    if (!bar) return;
    this.observer = new ResizeObserver(() => this.zone.run(() => this.measure()));
    this.observer.observe(bar);
  }

  open(label: string): void {
    this.opened.set(label);
  }

  openFromBar(label: string): void {
    this.moreOpen.set(false);
    this.opened.set(label);
  }

  toggleMore(): void {
    this.moreOpen.update((open) => !open);
    this.opened.set(null);
  }

  overflowCurrent(): boolean {
    return this.groups.slice(this.visibleCount()).some((group) => group.label === this.currentLabel);
  }

  @HostListener('document:click', ['$event'])
  closeMoreFromOutside(event: MouseEvent): void {
    if (!this.moreOpen()) return;
    const root = this.more?.nativeElement;
    const target = event.target;
    if (root && target instanceof Node && root.contains(target)) return;
    this.moreOpen.set(false);
    this.opened.set(null);
  }

  @HostListener('document:keydown.escape')
  closeMoreFromKeyboard(): void {
    this.moreOpen.set(false);
    this.hide();
  }

  close(event: FocusEvent): void {
    const next = event.relatedTarget;
    const current = event.currentTarget;
    if (next instanceof Node && current instanceof Node && current.contains(next)) return;
    this.opened.set(null);
  }

  hide(): void {
    this.opened.set(null);
  }

  private measure(): void {
    const bar = this.bar?.nativeElement;
    const measure = this.measureRow?.nativeElement;
    if (!bar || !measure) return;
    const probes = Array.from(measure.querySelectorAll<HTMLElement>('[data-item]'));
    const more = measure.querySelector<HTMLElement>('[data-more]');
    if (!probes.length || !more) {
      this.visibleCount.set(this.groups.length);
      return;
    }
    const style = getComputedStyle(bar);
    const available = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gap = 4;
    const widths = probes.map((probe) => probe.offsetWidth);
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(widths.length - 1, 0);
    if (total <= available) {
      this.visibleCount.set(widths.length);
      return;
    }
    const budget = available - more.offsetWidth - gap;
    let used = 0;
    let count = 0;
    for (const width of widths) {
      const next = used + width + (count > 0 ? gap : 0);
      if (next > budget) break;
      used = next;
      count += 1;
    }
    this.visibleCount.set(count);
  }

  private path(section: string): string {
    return new URL(section, document.baseURI).pathname;
  }

  private hrm(section: string): string {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const origin = local ? 'http://localhost:4201/' : 'https://noahhrm.dandy-cheng.com/';
    return new URL(section, origin).toString();
  }

  private buildGroups(): NavGroup[] {
    return [
      {
        label: '公告',
        sections: [
          { title: '公告', links: [
            { label: '公告列表', href: null },
            { label: '發布公告', href: null },
          ] },
        ],
      },
      {
        label: '通知',
        sections: [
          { title: '通知', links: [
            { label: '我的通知', href: null },
            { label: '發送通知', href: null },
          ] },
        ],
      },
      {
        label: '文件',
        sections: [
          { title: '文件', links: [
            { label: '文件庫', href: null },
            { label: '分類', href: null },
          ] },
        ],
      },
      {
        label: '行事曆',
        sections: [
          { title: '行事曆', links: [
            { label: '公司行事曆', href: null },
            { label: '活動', href: null },
          ] },
        ],
      },
      {
        label: '帳號管理',
        sections: [
          { title: '帳號', links: [
            { label: '帳號列表', href: null },
            { label: '帳號申請', href: null },
          ] },
          { title: '權限', links: [
            { label: '權限設定', href: null },
          ] },
        ],
      },
      {
        label: '應用管理',
        sections: [
          { title: '應用', links: [
            { label: '系統清單', href: this.path('systems') },
            { label: '導覽', href: this.path('navigation') },
          ] },
        ],
      },
      {
        label: '人資管理',
        sections: [
          { title: '人員', links: [
            { label: '員工資料', href: this.hrm('employees') },
            { label: '組織', href: this.hrm('organization') },
          ] },
          { title: '出勤', links: [
            { label: '出勤紀錄', href: this.hrm('attendance') },
            { label: '加班', href: this.hrm('overtime') },
          ] },
          { title: '假勤', links: [
            { label: '請假', href: this.hrm('leave') },
            { label: '出差', href: this.hrm('trip') },
          ] },
        ],
      },
      {
        label: '客戶關係',
        sections: [
          { title: '客戶', links: [
            { label: '客戶資料', href: null },
            { label: '聯絡人', href: null },
          ] },
          { title: '銷售', links: [
            { label: '商機', href: null },
            { label: '報價', href: null },
            { label: '合約', href: null },
          ] },
        ],
      },
      {
        label: '財務會計',
        sections: [
          { title: '請款', links: [
            { label: '費用報銷', href: null },
            { label: '付款', href: null },
          ] },
          { title: '採購', links: [
            { label: '採購單', href: null },
            { label: '供應商', href: null },
          ] },
          { title: '庫存', links: [
            { label: '庫存查詢', href: null },
          ] },
        ],
      },
      {
        label: '資訊服務',
        sections: [
          { title: '服務', links: [
            { label: '報修', href: null },
            { label: '需求單', href: null },
          ] },
        ],
      },
      {
        label: '教育訓練',
        sections: [
          { title: '課程', links: [
            { label: '課程目錄', href: null },
            { label: '我的課程', href: null },
          ] },
          { title: '報名', links: [
            { label: '開課報名', href: null },
            { label: '學習紀錄', href: null },
          ] },
        ],
      },
      {
        label: '簽核',
        sections: [
          { title: '流程', links: [
            { label: '待我簽核', href: null },
            { label: '我送出的', href: null },
            { label: '表單', href: null },
          ] },
        ],
      },
      {
        label: '總務行政',
        sections: [
          { title: '場地', links: [
            { label: '會議室', href: null },
            { label: '訪客', href: null },
          ] },
          { title: '庶務', links: [
            { label: '備品', href: null },
            { label: '公務車', href: null },
            { label: '修繕', href: null },
          ] },
        ],
      },
      {
        label: '薪資',
        sections: [
          { title: '薪資', links: [
            { label: '薪資單', href: null },
            { label: '投保', href: null },
          ] },
          { title: '稅務', links: [
            { label: '所得扣繳', href: null },
          ] },
        ],
      },
      {
        label: '專案管理',
        sections: [
          { title: '案子', links: [
            { label: '專案', href: null },
            { label: '成員', href: null },
            { label: '進度', href: null },
          ] },
          { title: '工時', links: [
            { label: '工時填報', href: null },
          ] },
        ],
      },
    ];
  }
}

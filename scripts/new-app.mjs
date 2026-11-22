import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';

const appsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parentDir = resolve(appsRoot, '..');
const gh = 'C:\\Program Files\\GitHub CLI\\gh.exe';

const groups = [
  ['公告', [['公告', ['公告列表', '發布公告']]]],
  ['通知', [['通知', ['我的通知', '發送通知']]]],
  ['文件', [['文件', ['文件庫', '分類']]]],
  ['行事曆', [['行事曆', ['公司行事曆', '活動']]]],
  ['帳號管理', [['帳號', ['帳號列表', '帳號申請']], ['權限', ['權限設定']]]],
  ['應用管理', [['應用', ['系統清單', '導覽']]]],
  ['人資管理', [['人員', ['員工資料', '組織']], ['出勤', ['出勤紀錄', '加班']], ['假勤', ['請假', '出差']]]],
  ['客戶關係', [['客戶', ['客戶資料', '聯絡人']], ['銷售', ['商機', '報價', '合約']]]],
  ['財務會計', [['請款', ['費用報銷', '付款']], ['採購', ['採購單', '供應商']], ['庫存', ['庫存查詢']]]],
  ['資訊服務', [['服務', ['報修', '需求單']]]],
  ['教育訓練', [['課程', ['課程目錄', '我的課程']], ['報名', ['開課報名', '學習紀錄']]]],
  ['簽核', [['流程', ['待我簽核', '我送出的', '表單']]]],
  ['總務行政', [['場地', ['會議室', '訪客']], ['庶務', ['備品', '公務車', '修繕']]]],
  ['薪資', [['薪資', ['薪資單', '投保']], ['稅務', ['所得扣繳']]]],
  ['專案管理', [['案子', ['專案', '成員', '進度']], ['工時', ['工時填報']]]],
];

const localOnly = process.argv.includes('--local');
const args = process.argv.slice(2).filter((arg) => arg !== '--local');
const words = [];
let explicitPort = 0;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--port') {
    explicitPort = Number(args[index + 1]);
    index += 1;
    continue;
  }
  words.push(args[index]);
}

const name = words[0] || await ask('倉庫名稱，例如 noah-notice：');
const title = words[1] || await ask('畫面上的名稱，例如 公告：');

if (!/^noah-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
  throw new Error('倉庫名稱要用小寫，例如 noah-notice。');
}
if (!title || /['"\\]/.test(title)) {
  throw new Error('畫面上的名稱不能是空的，也不能含引號。');
}

const target = join(parentDir, name);
if (existsSync(target)) throw new Error(`${target} 已經存在。`);

const port = explicitPort || nextPort();
const product = title;

console.log(`建立 ${name}，畫面名稱 ${title}，port ${port}`);
writeProject(target, { name, title, product, port });
copyAssets(target);
registerApp(name, title);
await registerRemote(name, title);
run('npm', ['install'], target);
run('git', ['init', '-b', 'main'], target);
run('git', ['add', '-A'], target);
run('git', ['commit', '-m', 'chore: add the app shell'], target);

if (!localOnly) {
  run(gh, ['repo', 'create', `Dandy1103/${name}`, '--public', '--source', target, '--remote', 'origin', '--push'], target);
  run('git', ['checkout', '-b', 'develop'], target);
  run('git', ['push', '-u', 'origin', 'develop'], target);
}

addWorkspaceFolder(name);
console.log(`完成。資料夾在 ${target}`);
console.log(localOnly ? '這次沒有建立 GitHub 倉庫。' : `倉庫在 https://github.com/Dandy1103/${name}`);
console.log(`啟動：cd "${target}" 然後 npm start，開 http://localhost:${port}/`);

function ask(question) {
  const rl = createInterface({ input, output });
  return rl.question(question).finally(() => rl.close());
}

function nextPort() {
  let max = 4202;
  for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(parentDir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const start = pkg.scripts?.start ?? '';
    const match = start.match(/--port\s+(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function copyAssets(target) {
  mkdirSync(join(target, 'src', 'assets', 'images'), { recursive: true });
  copyFileSync(join(appsRoot, 'src', 'favicon.ico'), join(target, 'src', 'favicon.ico'));
  copyFileSync(join(appsRoot, 'src', 'assets', 'images', 'logo.png'), join(target, 'src', 'assets', 'images', 'logo.png'));
  copyFileSync(join(appsRoot, 'src', 'app', 'layout', 'header', 'header.component.scss'), join(target, 'src', 'app', 'layout', 'header', 'header.component.scss'));
  copyFileSync(join(appsRoot, 'src', 'app', 'layout', 'navbar', 'navbar.component.html'), join(target, 'src', 'app', 'layout', 'navbar', 'navbar.component.html'));
  copyFileSync(join(appsRoot, 'src', 'app', 'layout', 'navbar', 'navbar.component.scss'), join(target, 'src', 'app', 'layout', 'navbar', 'navbar.component.scss'));
  copyFileSync(join(appsRoot, 'src', 'app', 'shared', 'table', 'table.component.scss'), join(target, 'src', 'app', 'shared', 'table', 'table.component.scss'));
}

async function registerRemote(repo, label) {
  try {
    const response = await fetch('http://127.0.0.1:3002/api/apps/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: label, repo, url: '', audience: '尚未開放', online: false }),
    });
    if (!response.ok) console.log('系統清單 API 沒有收下這筆，稍後可在應用管理補。');
  } catch {
    console.log('系統清單 API 沒開，這次只寫進本機備份。');
  }
}

function registerApp(repo, label) {
  const catalogPath = join(appsRoot, 'src', 'app', 'catalog.ts');
  const text = readFileSync(catalogPath, 'utf8');
  if (text.includes(`repo: '${repo}'`)) return;
  const line = `  { name: '${label}', repo: '${repo}', url: '', audience: '尚未開放', online: false },\n`;
  writeFileSync(catalogPath, text.replace(/\r?\n\];\s*$/, `\n${line}];\n`));
}

function addWorkspaceFolder(repo) {
  const workspace = join(parentDir, 'noah-ui', 'noah-workspace.code-workspace');
  if (!existsSync(workspace)) return;
  const json = JSON.parse(readFileSync(workspace, 'utf8'));
  const folder = { path: `../${repo}` };
  if (json.folders.some((item) => item.path === folder.path)) return;
  json.folders.push(folder);
  writeFileSync(workspace, JSON.stringify(json, null, '\t') + '\n');
}

function run(command, commandArgs, cwd) {
  let executable = command;
  let args = commandArgs;
  if (command === 'npm' && process.platform === 'win32') {
    const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (existsSync(cli)) {
      executable = process.execPath;
      args = [cli, ...commandArgs];
    } else {
      executable = 'npm.cmd';
    }
  }
  const result = spawnSync(executable, args, {
    cwd,
    stdio: 'inherit',
    shell: executable.endsWith('.cmd'),
  });
  if (result.status !== 0) {
    const detail = result.error ? result.error.message : `結束代碼 ${result.status}`;
    throw new Error(`${command} 失敗：${detail}`);
  }
}

function writeProject(target, project) {
  const files = {
    'package.json': packageJson(project),
    'angular.json': angularJson(project),
    'tsconfig.json': tsconfig(),
    'tsconfig.app.json': tsconfigApp(),
    '.gitignore': gitignore(),
    'README.md': readme(project),
    'src/index.html': indexHtml(project),
    'src/main.ts': mainTs(),
    'src/styles.scss': styles(),
    'src/app/app.config.ts': appConfig(),
    'src/app/app.routes.ts': routes(),
    'src/app/app.component.ts': appComponent(),
    'src/app/app.component.html': '<app-header />\n<app-navbar />\n<main class="workspace">\n  <router-outlet />\n</main>\n',
    'src/app/app.component.scss': '.workspace {\n  padding: 28px 32px 48px;\n}\n',
    'src/app/layout/header/header.component.ts': headerTs(),
    'src/app/layout/header/header.component.html': headerHtml(project),
    'src/app/layout/navbar/navbar.component.ts': navbarTs(project),
    'src/app/shared/table/table.component.ts': tableTs(),
    'src/app/features/home/home.component.ts': homeTs(),
    'src/app/features/home/home.component.html': homeHtml(project),
    'src/app/features/home/home.component.scss': homeScss(),
  };
  for (const [file, contents] of Object.entries(files)) {
    const full = join(target, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
}

function packageJson(project) {
  return `{
  "name": "${project.name}",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "ng": "ng",
    "start": "ng serve --port ${project.port}",
    "build": "ng build"
  },
  "dependencies": {
    "@angular/common": "^17.3.0",
    "@angular/compiler": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/platform-browser": "^17.3.0",
    "@angular/router": "^17.3.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.3"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.3.17",
    "@angular/cli": "^17.3.17",
    "@angular/compiler-cli": "^17.3.0",
    "typescript": "~5.4.2"
  }
}
`;
}

function angularJson(project) {
  return `{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "${project.name}": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/${project.name}",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.scss"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
                { "type": "anyComponentStyle", "maximumWarning": "12kb", "maximumError": "16kb" }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": { "port": ${project.port} },
          "configurations": {
            "production": { "buildTarget": "${project.name}:build:production" },
            "development": { "buildTarget": "${project.name}:build:development" }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
`;
}

function tsconfig() {
  return `{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist/out-tsc",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "declaration": false,
    "experimentalDecorators": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
`;
}

function tsconfigApp() {
  return `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
`;
}

function gitignore() {
  return `/dist
/node_modules
/.angular/cache
/.env
/.env.*
!.env.example
npm-debug.log
.idea/
.vscode/*
!.vscode/settings.json
.DS_Store
Thumbs.db
`;
}

function readme(project) {
  return `# ${project.product}

${project.title}。

\`\`\`bash
npm install
npm start
\`\`\`

開啟 http://localhost:${project.port}/

\`main\` 是穩定版，\`develop\` 是開發分支。
`;
}

function indexHtml(project) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>${project.title}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;
}

function mainTs() {
  return `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
`;
}

function styles() {
  return `:root {
  --brand: #001430;
  --color-primary: #001430;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-border: #e2e8f0;
  --color-surface-selected: #edf2f8;
  --color-info: #0284c7;
  --radius-sm: 4px;
  --shadow-md: 0 4px 12px rgb(15 23 42 / 8%);
  --header-height: 60px;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
  font-family: Inter, "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  font-size: 16px;
}

h1 { margin: 0; }
`;
}

function appConfig() {
  return `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
};
`;
}

function routes() {
  return `import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: '**', redirectTo: '' },
];
`;
}

function appComponent() {
  return `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { NavbarComponent } from './layout/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
`;
}

function headerTs() {
  return `import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly portalHomeUrl = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:4200/'
    : 'https://noahportal.dandy-cheng.com/';
}
`;
}

function headerHtml(project) {
  return `<header class="site-header">
  <a class="site-header__home" [href]="portalHomeUrl" aria-label="回入口">
    <img class="site-header__logo" src="assets/images/logo.png" width="360" height="120" alt="諾亞數智">
  </a>
  <span class="site-header__product">${project.product}</span>
</header>
`;
}

function linkHref(project, groupLabel, sectionTitle, sections, item, index) {
  const hrmPaths = {
    員工資料: 'employees',
    組織: 'organization',
    出勤紀錄: 'attendance',
    加班: 'overtime',
    請假: 'leave',
    出差: 'trip',
  };
  if (groupLabel === '人資管理' && hrmPaths[item]) return `this.hrm('${hrmPaths[item]}')`;
  if (groupLabel === '應用管理' && item === '系統清單') return `this.apps('systems')`;
  if (groupLabel === '應用管理' && item === '導覽') return `this.apps('navigation')`;
  if (groupLabel === project.title && index === 0 && sectionTitle === sections[0][0]) return 'this.path("")';
  return 'null';
}

function navbarTs(project) {
  const links = groups.map(([label, sections]) => {
    const rendered = sections.map(([sectionTitle, items]) => {
      const renderedItems = items.map((item, index) => {
        const href = linkHref(project, label, sectionTitle, sections, item, index);
        return `{ label: '${item}', href: ${href} }`;
      }).join(', ');
      return `{ title: '${sectionTitle}', links: [${renderedItems}] }`;
    }).join(', ');
    return `{ label: '${label}', sections: [${rendered}] }`;
  }).join(',\n      ');
  return `import { Component, signal } from '@angular/core';

interface NavLink {
  label: string;
  href: string | null;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

interface NavGroup {
  label: string;
  sections: NavSection[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly currentLabel = '${project.title}';
  readonly opened = signal<string | null>(null);
  readonly groups: NavGroup[] = [
      ${links}
  ];

  open(label: string): void {
    this.opened.set(label);
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

  private path(section: string): string {
    return new URL(section, document.baseURI).pathname;
  }

  private hrm(section: string): string {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const origin = local ? 'http://localhost:4201/' : 'https://noahhrm.dandy-cheng.com/';
    return new URL(section, origin).toString();
  }

  private apps(section: string): string | null {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!local) return null;
    return new URL(section, 'http://localhost:4202/').toString();
  }
}
`;
}

function tableTs() {
  return `import { Component } from '@angular/core';

@Component({
  selector: 'app-table',
  standalone: true,
  template: '<div class="data-table"><ng-content /></div>',
  styleUrl: './table.component.scss',
})
export class TableComponent {}
`;
}

function homeTs() {
  return `import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly portalHome = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:4200/'
    : 'https://noahportal.dandy-cheng.com/';
}
`;
}

function homeHtml(project) {
  return `<div class="roster-head">
  <div class="roster-head__title">
    <h1>${project.title}</h1>
  </div>
  <nav class="crumb" aria-label="麵包屑">
    <ol>
      <li><a [href]="portalHome">首頁</a></li>
      <li aria-current="page">${project.title}</li>
    </ol>
  </nav>
</div>
<p class="note">這個專案剛開好，功能接著做。</p>
`;
}

function homeScss() {
  return `:host { display: block; }

.roster-head { margin-bottom: 16px; }

.roster-head__title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 12px;
  border-left: 3px solid #001430;
}

.roster-head__title h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.crumb { margin-top: 4px; }

.crumb ol {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 16px;
}

.crumb li + li::before {
  content: "/";
  margin: 0 8px;
  color: var(--color-text-secondary);
}

.crumb a {
  color: var(--color-text-secondary);
  text-decoration: none;
}

.crumb a:hover { text-decoration: underline; }

.crumb [aria-current="page"] {
  color: var(--color-text-primary);
  font-weight: 600;
}

.note {
  margin: 0;
  color: #64748b;
}
`;
}

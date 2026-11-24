import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';

const appsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parentDir = resolve(appsRoot, '..');
const gh = 'C:\\Program Files\\GitHub CLI\\gh.exe';

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
    const match = start.match(/--port\s+(\d+)/) || start.match(/dev\.mjs\s+\S+\s+(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function copyAssets(target) {
  mkdirSync(join(target, 'src', 'assets', 'images'), { recursive: true });
  copyFileSync(join(appsRoot, 'src', 'favicon.ico'), join(target, 'src', 'favicon.ico'));
  copyFileSync(join(appsRoot, 'src', 'assets', 'images', 'logo.png'), join(target, 'src', 'assets', 'images', 'logo.png'));
}

async function registerRemote(repo, label) {
  try {
    const response = await fetch('http://127.0.0.1:3002/api/apps/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: label, repo, url: '', audience: '尚未開放', online: false }),
    });
    if (response.status === 401 || response.status === 403) {
      console.log('請用管理員帳號登入應用管理，將新系統加入清單。');
    } else if (!response.ok) {
      console.log('系統清單 API 沒有收下這筆，稍後可在應用管理補。');
    }
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
    'Dockerfile': dockerfile(project),
    '.dockerignore': dockerignore(),
    'server/index.mjs': staticServer(project),
    'src/index.html': indexHtml(project),
    'src/main.ts': mainTs(),
    'src/styles.scss': styles(),
    'src/app/app.config.ts': appConfig(),
    'proxy.conf.mjs': devProxy(),
    'src/app/require-session.ts': requireSession(),
    'src/app/app.routes.ts': routes(),
    'src/app/app.component.ts': appComponent(),
    'src/app/app.component.html': appHtml(),
    'src/app/shared/table/table.component.ts': tableTs(),
    'src/app/features/home/home.component.ts': homeTs(),
    'src/app/features/home/home.component.html': homeHtml(project),
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
          "options": { "proxyConfig": "proxy.conf.mjs", "port": ${project.port} },
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
    "lib": ["ES2022", "dom"],
    "baseUrl": "./",
    "paths": {
      "@dandy1103/navbar": ["../noah-ui/projects/ui/src/lib/navbar/navbar.component.ts"],
      "@dandy1103/header": ["../noah-ui/projects/ui/src/lib/header/header.component.ts"]
    }
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

function dockerfile(project) {
  return `FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server ./server
COPY --from=build /app/dist/${project.name} ./dist/${project.name}
USER node
CMD ["node", "server/index.mjs"]
`;
}

function dockerignore() {
  return `node_modules
dist
.git
.angular
.env
.env.*
`;
}

function staticServer(project) {
  return `import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || 8080);
const browserDir = resolve(import.meta.dirname, '..', 'dist', '${project.name}', 'browser');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const relative = decodeURIComponent(url.pathname).replace(/^\\/+/, '');
  const requested = resolve(browserDir, relative);
  const inside = requested === browserDir || requested.startsWith(\`\${browserDir}\${sep}\`);
  const file = inside && existsSync(requested) && statSync(requested).isFile()
    ? requested
    : join(browserDir, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('找不到。');
    return;
  }
  const isIndex = file === join(browserDir, 'index.html');
  response.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Cache-Control': isIndex ? 'no-store' : 'public, max-age=31536000',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log('${project.title}在 http://0.0.0.0:' + port);
});
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
  return '';
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

function devProxy() {
  return `const target = 'https://noah-platform.dandy-cheng.com';
const platformHost = 'noah-platform.dandy-cheng.com';

function markDevHost(proxyReq, req) {
  proxyReq.removeHeader('x-forwarded-port');
  const host = req.headers.host;
  if (!host) return;
  proxyReq.setHeader('X-Forwarded-Host', host);
  proxyReq.setHeader('X-Forwarded-Proto', 'http');
  proxyReq.setHeader('X-Noah-Dev-Host', host);
  proxyReq.setHeader('X-Noah-Dev-Proto', 'http');
}

function stayHere(proxyRes) {
  const location = proxyRes.headers.location;
  if (!location) return;
  proxyRes.headers.location = Array.isArray(location) ? location.map(localPath) : localPath(location);
}

function localPath(location) {
  if (!location || location.startsWith('/')) return location;
  try {
    const next = new URL(location);
    if (next.hostname !== platformHost) return location;
    return \`\${next.pathname}\${next.search}\${next.hash}\`;
  } catch {
    return location;
  }
}

const rule = {
  target,
  secure: true,
  changeOrigin: true,
  onProxyReq: markDevHost,
  onProxyRes: stayHere,
};

export default {
  '/api': rule,
  '/oauth2': rule,
  '/login': rule,
  '/auth': rule,
};
`;
}

function requireSession() {
  return `import { CanActivateFn } from '@angular/router';

export function sendToLogin(): void {
  const next = location.pathname + location.search;
  location.replace('/auth/login?' + new URLSearchParams({ next }));
}

export const requireSession: CanActivateFn = () => {
  return fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).then((response) => {
    if (response.ok) return true;
    if (response.status === 401) sendToLogin();
    return false;
  }).catch(() => false);
};

export async function signedIn(): Promise<boolean> {
  const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
  if (response?.ok) return true;
  if (!response || response.status === 401) sendToLogin();
  return false;
}
`;
}

function routes() {
  return `import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { requireSession } from './require-session';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [requireSession] },
  { path: '**', redirectTo: '' },
];
`;
}

function appComponent() {
  return `import { Component, signal } from '@angular/core';
import { NoahLoadingMaskComponent } from '@dandy1103/ui';
import { RouterOutlet } from '@angular/router';
import { signedIn } from './require-session';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NoahLoadingMaskComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly shellReady = signal(false);

  constructor() {
    void this.open();
  }

  private async open(): Promise<void> {
    if (!await signedIn()) return;
    this.shellReady.set(true);
  }
}
`;
}

function appHtml() {
  return `@if (shellReady()) {
  <router-outlet />
} @else {
  <noah-loading-mask />
}
`;
}

function tableTs() {
  return `import { Component } from '@angular/core';

@Component({
  selector: 'app-table',
  standalone: true,
  template: '<div class="data-table"><ng-content /></div>',
})
export class TableComponent {}
`;
}

function homeTs() {
  return `import { NoahPageHeadingComponent } from '@dandy1103/ui';
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NoahPageHeadingComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly portalHome = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://localhost:4200/'
    : 'https://noahportal.dandy-cheng.com/';
}
`;
}

function homeHtml(project) {
  return `<noah-page-heading title="${project.title}" [breadcrumbs]="[{ label: '首頁', href: portalHome }, { label: '${project.title}' }]" />
<p class="note">這個專案剛開好，功能接著做。</p>
`;
}

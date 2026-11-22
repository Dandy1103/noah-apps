import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { addSystem, closeStore, prepare, readCatalog, replaceNav, replaceSystems } from './store.mjs';

const port = Number(process.env.PORT || process.env.APPS_PORT || 3002);
const host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
const browserDir = resolve(import.meta.dirname, '..', 'dist', 'noah-apps', 'browser');
const writeOrigins = new Set([
  'http://localhost:4202',
  'http://127.0.0.1:4202',
  'https://noahapps.dandy-cheng.com',
]);
const readOrigins = new Set([
  ...writeOrigins,
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  'https://noahportal.dandy-cheng.com',
  'https://noahhrm.dandy-cheng.com',
]);

const server = createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  try {
    const result = await route(request);
    if (result) {
      send(response, result.status, result.body);
      return;
    }
    if (request.method === 'GET' && serveBrowser(request, response)) return;
    send(response, 404, { message: '找不到。' });
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error(error);
    send(response, status, { message: status === 500 ? '系統清單暫時讀不到。' : error.message });
  }
});

await prepare();
server.listen(port, host, () => {
  console.log(`導覽 API 在 http://${host}:${port}`);
});

async function route(request) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/healthz') return { status: 200, body: { ok: true } };
  if (request.method === 'GET' && url.pathname === '/api/apps/catalog') return { status: 200, body: await readCatalog() };
  if (request.method === 'PUT' && url.pathname === '/api/apps/systems') {
    requireWriter(request);
    return { status: 200, body: await replaceSystems(await readJson(request)) };
  }
  if (request.method === 'POST' && url.pathname === '/api/apps/systems') {
    requireWriter(request);
    return { status: 200, body: await addSystem(await readJson(request)) };
  }
  if (request.method === 'PUT' && url.pathname === '/api/apps/nav') {
    requireWriter(request);
    return { status: 200, body: await replaceNav(await readJson(request)) };
  }
  if (url.pathname.startsWith('/api/')) return { status: 404, body: { message: '找不到。' } };
  return null;
}

const fileTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function serveBrowser(request, response) {
  if (!existsSync(browserDir)) return false;
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  let relative = '';
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return false;
  }
  const requested = resolve(browserDir, relative);
  if (requested !== browserDir && !requested.startsWith(`${browserDir}${sep}`)) return false;
  const file = existsSync(requested) && statSync(requested).isFile() ? requested : join(browserDir, 'index.html');
  if (!existsSync(file)) return false;
  response.writeHead(200, {
    'Content-Type': fileTypes[extname(file)] || 'application/octet-stream',
    'Cache-Control': file === join(browserDir, 'index.html') ? 'no-store' : 'public, max-age=31536000',
  });
  createReadStream(file).pipe(response);
  return true;
}

function requireWriter(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!writeOrigins.has(origin)) {
    const error = new Error('只能從應用管理儲存。');
    error.status = 403;
    throw error;
  }
}

function canReadCatalog(origin) {
  if (readOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    const isLocal = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    const isFamily = url.protocol === 'https:' && url.hostname.endsWith('.dandy-cheng.com');
    return isLocal || isFamily;
  } catch {
    return false;
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!origin || !canReadCatalog(origin)) return;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error('內容太大。');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('格式不對。');
    error.status = 400;
    throw error;
  }
}

process.on('SIGINT', async () => {
  server.close();
  await closeStore();
  process.exit(0);
});

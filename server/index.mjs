import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, resolve, sep } from 'node:path';

const port = Number(process.env.PORT || process.env.APPS_PORT || 3002);
const host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
const browserDir = resolve(import.meta.dirname, '..', 'dist', 'noah-apps', 'browser');
const core = new URL(process.env.CORE_URL || 'http://127.0.0.1:8080');
if (!['http:', 'https:'].includes(core.protocol)) throw new Error('CORE_URL 須使用 http 或 https。');
const requestCore = core.protocol === 'https:' ? httpsRequest : httpRequest;

const server = createServer((request, response) => {
  const url = requestUrl(request);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    forward(request, response, '/api/apps/healthz');
    return;
  }
  if (url.pathname.startsWith('/api/apps/')) {
    forward(request, response, url.pathname + url.search);
    return;
  }
  if (!url.pathname.startsWith('/api/') && request.method === 'GET' && serveBrowser(request, response)) return;
  send(response, 404, { message: '找不到。' });
});

server.listen(port, host, () => {
  console.log('應用管理在 http://' + host + ':' + port);
});

function forward(request, response, path) {
  const headers = { ...request.headers, host: core.host };
  delete headers.connection;
  delete headers.cookie;
  delete headers.authorization;
  const upstream = requestCore(core, { method: request.method, path, headers, timeout: 15000 }, result => {
    const headers = { ...result.headers };
    delete headers.connection;
    response.writeHead(result.statusCode, headers);
    result.on('error', () => response.destroy());
    result.pipe(response);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => {
    if (response.headersSent) response.destroy();
    else send(response, 502, { message: '應用管理暫時無法連線，請稍後再試。' });
  });
  response.on('close', () => upstream.destroy());
  request.pipe(upstream);
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

function requestUrl(request) {
  const raw = request.url || '/';
  const path = raw.startsWith('//') ? `/${raw.replace(/^\/+/, '')}` : raw;
  return new URL(path, 'http://127.0.0.1');
}

function serveBrowser(request, response) {
  if (!existsSync(browserDir)) return false;
  const url = requestUrl(request);
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

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

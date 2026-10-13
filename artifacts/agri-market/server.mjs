// Production frontend only. Marketplace/private-media APIs remain in API Server.
import { createServer, request } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzip, brotliCompress } from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const benchmark = process.argv.includes('--benchmark');
const port = benchmark ? 19062 : Number(process.env.PORT || 19061);
const root = resolve(fileURLToPath(new URL('./dist/public/', import.meta.url)));
const basePath = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const compress = { br: promisify(brotliCompress), gzip: promisify(gzip) };
const cached = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function acceptedEncoding(header = '') {
  const accepted = new Map(header.split(',').map(part => {
    const [name, ...params] = part.trim().split(';');
    const q = params.find(p => p.trim().startsWith('q='));
    return [name, q ? Number(q.trim().slice(2)) : 1];
  }));
  for (const name of ['br', 'gzip']) if ((accepted.get(name) ?? accepted.get('*') ?? 0) > 0) return name;
  return null;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (basePath && pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
    if (pathname.startsWith('/api/')) {
      if (!benchmark) { res.writeHead(404); res.end(); return; }
      const proxy = request({ hostname: '127.0.0.1', port: 8080, path: req.url,
        method: req.method, headers: { ...req.headers, host: 'localhost:8080' } }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(proxy); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}/`)) { res.writeHead(403); res.end(); return; }
    let metadata;
    try { metadata = await stat(file); if (!metadata.isFile()) throw new Error('directory'); }
    catch {
      // Missing assets must be real 404s, not HTML pretending to be JavaScript.
      if (extname(pathname)) { res.writeHead(404); res.end(); return; }
      file = resolve(root, 'index.html'); metadata = await stat(file);
    }
    const extension = extname(file);
    const immutable = /[-.][A-Za-z0-9_-]{8,}\.(js|css|woff2|png|jpg|webp|svg)$/.test(file);
    const encoding = ['.html', '.js', '.css', '.svg', '.txt'].includes(extension)
      ? acceptedEncoding(req.headers['accept-encoding']) : null;
    const key = `${file}:${metadata.mtimeMs}:${encoding || 'identity'}`;
    let data = cached.get(key);
    if (!data) {
      data = await readFile(file);
      if (encoding) data = await compress[encoding](data);
      // Bound the cache; only public build artifacts, never user/API data.
      if (cached.size > 256) cached.clear();
      cached.set(key, data);
    }
    res.setHeader('Content-Type', types[extension] || 'application/octet-stream');
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable'
      : extension === '.html' ? 'no-cache' : 'public, max-age=3600');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', data.length);
    res.writeHead(200);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end(); }
}).listen(port, benchmark ? '127.0.0.1' : '0.0.0.0');

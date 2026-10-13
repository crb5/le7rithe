// Temporary, localhost-only benchmark server. No publishing or data changes.
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(new URL('../../', import.meta.url).pathname, 'artifacts/agri-market/dist/public');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const proxy = request({ hostname: '127.0.0.1', port: 8080, path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:8080' } }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(proxy);
    return;
  }
  let file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
  if (!file.startsWith(root + '/')) file = `${root}/index.html`;
  try {
    let data;
    try { data = await readFile(file); }
    catch { file = `${root}/index.html`; data = await readFile(file); }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(500); res.end(); }
}).listen(19062, '127.0.0.1', () => console.log('Image benchmark server ready on localhost:19062'));

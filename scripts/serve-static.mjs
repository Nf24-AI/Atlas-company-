// Minimal static file server for previewing / testing the built DEMO (dist/). Localhost only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 4173);
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json'};
http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(DIR, rel);
  if (!full.startsWith(DIR + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(full)] || 'application/octet-stream'});
  fs.createReadStream(full).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`static demo on http://127.0.0.1:${PORT}`));

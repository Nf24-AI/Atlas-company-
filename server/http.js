// HTTP helpers: JSON responses with security headers, bounded body parsing, cookies,
// same-origin enforcement for state-changing requests, and a tiny router.
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
  // No inline scripts; three.js is served same-origin. Style attributes are used for HUD positioning.
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

export function sendJson(res, data, status = 200, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers});
  res.end(JSON.stringify(data));
}

export async function readJson(req, limit = 64 * 1024) {
  const type = req.headers['content-type'] || '';
  if (!type.startsWith('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(); if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, {maxAge, secure} = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict`;
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (secure) c += '; Secure';
  return c;
}

/**
 * CSRF defence for cookie-authenticated mutations: the request must carry an Origin (or Referer)
 * whose host equals the Host header (or the configured public origin). JSON content-type is also
 * required, which a cross-site <form> cannot send without a CORS preflight.
 */
export function assertSameOrigin(req, publicOrigin = '') {
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : '');
  if (!origin) throw new HttpError(403, 'Missing Origin header');
  let host;
  try { host = new URL(origin).host; } catch { throw new HttpError(403, 'Bad Origin'); }
  if (publicOrigin && origin === publicOrigin) return;
  if (host !== req.headers.host) throw new HttpError(403, 'Cross-origin request blocked');
}

export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([A-Za-z0-9_-]+)'; }) + '$');
    routes.push({method, re, keys, handler, opts});
  };
  return {
    get: (p, h, o) => add('GET', p, h, o), post: (p, h, o) => add('POST', p, h, o),
    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(pathname); if (!m) continue;
        return {handler: r.handler, opts: r.opts, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]))};
      }
      return null;
    },
  };
}

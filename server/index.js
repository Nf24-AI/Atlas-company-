// ATLAS Company OS server entry. Binds to localhost by default and refuses to bind elsewhere
// unless explicitly acknowledged (ATLAS_ALLOW_REMOTE) — the API must never be public without
// a TLS proxy and a reviewed deployment (see docs/DEPLOYMENT.md).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {loadEnvFile, loadConfig, ROOT} from './config.js';
import {openDatabase} from './db/index.js';
import {createRepo} from './repo.js';
import {createSessions, SESSION_COOKIE} from './auth.js';
import {createRouter, sendJson, readJson, parseCookies, cookie, assertSameOrigin, HttpError, SECURITY_HEADERS} from './http.js';
import {createRateLimiter} from './ratelimit.js';
import {createProviders} from './agents/providers.js';
import {createJobs} from './agents/jobs.js';
import {createOrchestrator} from './agents/orchestrator.js';
import {registerRoutes} from './routes.js';

const WEB = path.join(ROOT, 'public');
const VENDOR = {'/vendor/three.module.min.js': path.join(ROOT, 'node_modules', 'three', 'build', 'three.module.min.js')};
const MIME = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json'};
const RATES = {auth: [10, 15 * 60e3], agent: [30, 10 * 60e3], mutate: [180, 60e3], read: [600, 60e3]};
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export function createApp(config = loadConfig(), {fetchImpl} = {}) {
  const db = openDatabase(config.dbFile);
  const repo = createRepo(db); repo.raw = db;
  const sessions = createSessions(db, {days: config.sessionDays});
  const providers = createProviders(config, fetchImpl ? {fetchImpl} : {});
  const jobs = createJobs({onError: (e, job) => console.error(`[job ${job.kind}] ${e.message}`)});
  const orch = createOrchestrator({repo, providers, config, jobs});
  const router = createRouter();
  registerRoutes(router, {repo, orch, jobs, config, providers});
  const limiter = createRateLimiter();

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const ip = req.socket.remoteAddress || 'unknown';
    try {
      if (pathname.startsWith('/api/')) {
        const match = router.match(req.method, pathname);
        if (!match) throw new HttpError(404, 'Not found');
        const rateKey = match.opts.rate || (req.method === 'GET' ? 'read' : 'mutate');
        const [limit, win] = RATES[rateKey];
        const rl = limiter.hit(`${rateKey}:${ip}`, limit, win);
        if (!rl.ok) return sendJson(res, {error: 'Too many requests'}, 429, {'Retry-After': String(rl.retryAfter)});
        if (req.method !== 'GET') assertSameOrigin(req, config.publicOrigin);
        const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        const user = sessions.resolve(token);
        const company = user ? repo.companyForUser(user.id) : null;
        if (!match.opts.public && (!user || !company)) throw new HttpError(401, 'Authentication required');
        const setCookies = [];
        const ctx = {
          sessions,
          setSession: s => setCookies.push(cookie(SESSION_COOKIE, s.token, {maxAge: s.maxAge, secure: config.secureCookies})),
          clearSession: () => { sessions.destroy(token); setCookies.push(cookie(SESSION_COOKIE, '', {maxAge: 0, secure: config.secureCookies})); },
        };
        const body = req.method === 'GET' ? undefined : await readJson(req);
        const out = await match.handler({req, body, params: match.params, user, company, ctx, query: url.searchParams});
        return sendJson(res, out, 200, setCookies.length ? {'Set-Cookie': setCookies} : {});
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
      return serveStatic(pathname, res);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[request]', req.method, pathname, e.message);
      // 5xx messages are generic so internal details (paths, provider errors) are not leaked.
      return sendJson(res, {error: status >= 500 ? 'Internal error' : String(e.message).slice(0, 300)}, status);
    }
  }

  function serveStatic(pathname, res) {
    let full;
    if (VENDOR[pathname]) full = VENDOR[pathname];
    else {
      const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
      if (!/^[\w./-]+$/.test(rel) || rel.includes('..')) throw new HttpError(400, 'Invalid path');
      full = path.resolve(WEB, rel);
      if (!full.startsWith(WEB + path.sep)) throw new HttpError(400, 'Invalid path');
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new HttpError(404, 'Not found');
    res.writeHead(200, {'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS});
    fs.createReadStream(full).pipe(res);
  }

  return {handler, db, repo, jobs, orch, providers, sessions, config};
}

export function start(config = loadConfig()) {
  if (!LOOPBACK.has(config.host) && !config.allowRemote) {
    console.error(`Refusing to bind to ${config.host}: the ATLAS API must stay on localhost unless ATLAS_ALLOW_REMOTE=i-understand-the-risks is set behind a TLS proxy (docs/DEPLOYMENT.md).`);
    process.exit(1);
  }
  const app = createApp(config);
  const server = http.createServer(app.handler);
  server.listen(config.port, config.host, () => {
    const live = ['groq', 'deepseek'].filter(p => app.providers.isLive(p));
    console.log(`ATLAS Company OS: http://${config.host}:${config.port}  (providers LIVE: ${live.join(', ') || 'none — all employees in DEMO mode'})`);
  });
  setInterval(() => app.sessions.purgeExpired(), 3600e3).unref();
  return {server, app};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'server.js');
if (isMain) { loadEnvFile(); start(); }

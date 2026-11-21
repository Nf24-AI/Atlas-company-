// API client. On the static GitHub Pages build (<meta name="atlas-mode" content="static-demo">)
// requests are served by an in-browser DEMO backend instead of the network — no server, no AI.
const isStaticDemo = () => document.querySelector('meta[name="atlas-mode"]')?.content === 'static-demo';
let demoBackend = null;

export async function api(route, body) {
  if (isStaticDemo()) {
    demoBackend ??= (await import('./demo-backend.js')).createDemoBackend(window.localStorage);
    return demoBackend.handle(route, body);
  }
  const res = await fetch(route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const err = Error(j.error || `HTTP ${res.status}`); err.status = res.status; throw err; }
  return j;
}
export const staticDemo = isStaticDemo;

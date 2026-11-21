// Client-side state: one authoritative snapshot from GET /api/state, refreshed adaptively
// (fast while agent jobs run, slow when idle). Subscribers re-render from the snapshot.
import {api} from '../net/api-client.js';

export function createStore({onError} = {}) {
  let data = null, timer = null, inflight = null;
  const subs = new Set();
  const busy = () => Boolean(data && (data.jobs?.running || data.jobs?.queued?.length || data.employees?.some(e => ['executing', 'planning', 'reviewing'].includes(e.status))));
  async function refresh() {
    if (inflight) return inflight;
    inflight = api('/api/state').then(d => { data = d; for (const s of subs) s(d); return d; })
      .catch(e => { onError?.(e); throw e; })
      .finally(() => { inflight = null; schedule(); });
    return inflight;
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => refresh().catch(() => {}), busy() ? 1500 : 8000); }
  return {
    refresh, get data() { return data; },
    subscribe(fn) { subs.add(fn); if (data) fn(data); return () => subs.delete(fn); },
    stop() { clearTimeout(timer); },
    employee: role => data?.employees?.find(e => e.roleKey === role),
    activeProject: () => data?.projects?.find(p => !['completed', 'cancelled'].includes(p.status)) || data?.projects?.[0] || null,
  };
}

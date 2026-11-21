// In-process job queue: one agent job at a time per company (no continuous/background AI —
// jobs exist only when the CEO starts them). Each job has an AbortController so the CEO's
// emergency stop cancels in-flight model calls and tool loops immediately.
import crypto from 'node:crypto';

export function createJobs({onError = () => {}} = {}) {
  const queues = new Map(); // companyId -> {running, pending: []}
  const recent = [];
  const q = id => { let x = queues.get(id); if (!x) { x = {running: null, pending: []}; queues.set(id, x); } return x; };

  async function pump(companyId) {
    const cq = q(companyId);
    if (cq.running || !cq.pending.length) return;
    const job = cq.pending.shift();
    cq.running = job; job.status = 'running'; job.startedAt = new Date().toISOString();
    try { job.result = await job.fn(job.controller.signal); job.status = 'succeeded'; }
    catch (e) { job.status = e.halted || job.controller.signal.aborted ? 'cancelled' : 'failed'; job.error = String(e.message).slice(0, 500); onError(e, job); }
    finally {
      job.finishedAt = new Date().toISOString(); cq.running = null;
      recent.unshift(job); recent.length = Math.min(recent.length, 50);
      job.resolve();
      pump(companyId);
    }
  }

  return {
    enqueue(companyId, {kind, label, targetId}, fn) {
      const cq = q(companyId);
      if ([cq.running, ...cq.pending].some(j => j && j.kind === kind && j.targetId === targetId)) {
        throw Object.assign(new Error('This job is already queued or running'), {status: 409});
      }
      let resolve; const done = new Promise(r => { resolve = r; });
      const job = {id: crypto.randomUUID(), companyId, kind, label, targetId, status: 'queued', createdAt: new Date().toISOString(), controller: new AbortController(), fn, resolve, done};
      cq.pending.push(job);
      queueMicrotask(() => pump(companyId));
      return job;
    },
    /** Emergency stop: abort the running job and drop everything queued. */
    stopAll(companyId) {
      const cq = q(companyId); let n = 0;
      for (const j of cq.pending) { j.status = 'cancelled'; j.finishedAt = new Date().toISOString(); j.resolve(); recent.unshift(j); n++; }
      cq.pending = [];
      if (cq.running) { cq.running.controller.abort(); n++; }
      return n;
    },
    list(companyId) {
      const cq = q(companyId);
      const view = j => ({id: j.id, kind: j.kind, label: j.label, targetId: j.targetId, status: j.status, error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt});
      return {running: cq.running && view(cq.running), queued: cq.pending.map(view), recent: recent.filter(j => j.companyId === companyId).slice(0, 15).map(view)};
    },
    idle: companyId => { const cq = q(companyId); return !cq.running && !cq.pending.length; },
    /** Resolves when the given job finishes (tests). */
    wait: job => job.done,
  };
}

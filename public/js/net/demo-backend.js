// In-browser DEMO backend for the static GitHub Pages build. Mirrors the local API shape,
// stores state in localStorage, and only ever returns scripted DEMO replies.
import {demoReply} from '../shared/demo-scripts.js';

const KEY = 'atlas-static-demo-v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const now = () => new Date().toISOString();
const initial = () => ({projects: [{id: 'project-1', name: 'تأسيس الشركة الرقمية', status: 'active'}], tasks: [], decisions: [], runs: [], meetings: [], audit: []});

export function createDemoBackend(storage) {
  let state;
  try { state = JSON.parse(storage.getItem(KEY)) || initial(); } catch { state = initial(); }
  const save = () => { try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ } };
  const fail = (msg, status) => { const e = Error(msg); e.status = status; throw e; };
  const turn = (role, text) => {
    const output = {...demoReply(role, text), demo: true};
    const run = {id: uid(), role, input: text, output, at: now(), mode: 'demo'};
    state.runs.unshift(run);
    if (output.proposal) {
      const d = {id: uid(), role, createdAt: now(), status: 'pending', kind: output.proposal.type, title: output.proposal.title, description: output.proposal.description, acceptanceCriteria: output.proposal.acceptanceCriteria || '', runId: run.id};
      state.decisions.unshift(d); output.pendingId = d.id;
    }
    save(); return {output, mode: 'demo', runId: run.id};
  };
  return {
    async handle(route, b) {
      if (route === '/api/state') return {...state, config: {manager: false, director: false}, staticDemo: true};
      if (route === '/api/agent') { if (!['manager', 'director'].includes(b.role)) fail('Invalid role', 400); return turn(b.role, String(b.text || '').slice(0, 2200)); }
      if (route === '/api/escalate') { const r = state.runs.find(x => x.id === b.runId && x.role === 'manager'); if (!r) fail('Manager run not found', 404); return turn('director', 'مراجعة: ' + r.input); }
      if (route === '/api/approval') {
        const p = state.decisions.find(x => x.id === b.id); if (!p || p.status !== 'pending') fail('Proposal not pending', 409);
        if (!['approved', 'rejected'].includes(b.status)) fail('Invalid status', 400);
        p.status = b.status; p.reviewedAt = now();
        if (b.status === 'approved' && p.kind === 'task') state.tasks.unshift({id: uid(), title: p.title, description: p.description, acceptanceCriteria: p.acceptanceCriteria, status: 'todo', createdAt: now(), proposalId: p.id});
        save(); return {ok: true, proposal: p};
      }
      if (route === '/api/task-status') {
        const t = state.tasks.find(x => x.id === b.id); if (!t) fail('Task not found', 404);
        if (!['todo', 'in_progress', 'submitted'].includes(b.status)) fail('Unsupported status', 400);
        t.status = b.status; save(); return {ok: true, task: t};
      }
      fail('Not found', 404);
    },
  };
}

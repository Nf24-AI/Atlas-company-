// STATIC DEMO backend for the public GitHub Pages build. Runs entirely in the browser with
// localStorage. NOTHING here calls an AI model, runs code, touches git or a server: replies,
// plans, code changes, test runs and QA reports are PRE-WRITTEN SIMULATIONS, labelled as such.
// It implements the same routes as the real server so the UI can be explored end to end.
import {demoReply, demoPlan, demoReview} from '../shared/demo-scripts.js';

const KEY = 'atlas-static-demo-v2';
const SIM = 'SIMULATED — static demo, pre-written content (no AI, no code execution)';
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
const ROLE_NAMES = {manager: 'مدير المشاريع', director: 'المدير التقني', developer: 'المطوّر', qa: 'مهندس الجودة'};
const MODELS = {manager: ['groq', 'openai/gpt-oss-120b'], director: ['deepseek', 'deepseek-v4-pro'], developer: ['deepseek', 'deepseek-flash'], qa: ['groq', 'openai/gpt-oss-120b']};
const PERMS = {manager: ['meeting.reply', 'project.plan', 'decision.escalate', 'task.assign'], director: ['meeting.reply', 'decision.review'], developer: ['meeting.reply', 'sandbox.read', 'sandbox.write.src', 'tests.run', 'git.branch_commit', 'pr.open'], qa: ['meeting.reply', 'sandbox.read', 'sandbox.write.qa', 'tests.run', 'qa.report']};

function fresh() {
  return {
    company: {id: 'demo', name: 'ATLAS (Static demo)', motto: ''},
    employees: Object.keys(ROLE_NAMES).map(r => ({id: 'emp-' + r, roleKey: r, name: ROLE_NAMES[r], kind: 'ai', provider: MODELS[r][0], model: MODELS[r][1], status: 'available', statusDetail: '', dailyBudgetUsd: 0.5, maxSteps: 12, mode: 'demo', permissions: PERMS[r]})),
    projects: [], tasks: [], decisions: [], approvals: [], deliverables: [], meetings: [], runs: [], evaluations: [], halted: false,
  };
}

export function createDemoBackend(storage) {
  let s;
  try { s = JSON.parse(storage.getItem(KEY)) || fresh(); } catch { s = fresh(); }
  const save = () => { try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ } };
  const emp = role => s.employees.find(e => e.roleKey === role);
  const fail = (status, msg) => { const e = Error(msg); e.status = status; throw e; };
  const find = (arr, id) => arr.find(x => x.id === id) || fail(404, 'Not found');
  const run = (role, kind, extra = {}) => { const r = {id: uid(), employeeId: emp(role).id, kind, mode: 'demo', status: 'succeeded', steps: 1, costUsd: 0, createdAt: now(), tools: [], ...extra}; s.runs.unshift(r); return r; };
  const setStatus = (role, status, detail = '') => Object.assign(emp(role), {status, statusDetail: detail});
  const notHalted = () => s.halted && fail(423, 'Agents are halted (emergency stop). Resume first.');

  const routes = {
    'GET /api/auth/status': () => ({setupRequired: false, user: {email: 'demo@example.invalid', displayName: 'CEO (demo)', locale: 'ar'}}),
    'POST /api/auth/logout': () => ({ok: true}),
    'GET /api/state': () => ({
      user: {displayName: 'CEO (demo)'}, company: s.company, employees: s.employees, projects: s.projects, tasks: s.tasks, decisions: s.decisions,
      approvals: s.approvals, deliverables: s.deliverables, meetings: s.meetings.slice(0, 20), runs: s.runs.slice(0, 30), evaluations: s.evaluations,
      usage: {since: now().slice(0, 7) + '-01', totalUsd: 0, budgetUsd: 0, rows: []}, jobs: {running: null, queued: []}, halted: s.halted,
      integrations: {github: null}, liveProviders: {groq: false, deepseek: false}, staticDemo: true,
    }),
    'POST /api/meetings': b => {
      notHalted();
      const r = demoReply(b.role === 'director' ? 'director' : 'manager', b.text || '');
      const output = {speech: r.speech, verdict: r.verdict, rationale: SIM};
      s.meetings.unshift({id: uid(), employeeId: emp(b.role).id, mode: 'demo', ceoInput: b.text, channel: b.channel, reply: r.speech, summary: SIM, createdAt: now()});
      run(b.role, 'meeting');
      return {mode: 'demo', output};
    },
    'POST /api/projects': b => {
      if (s.projects.some(p => !['completed', 'cancelled'].includes(p.status))) fail(409, 'One active project at a time');
      const p = {id: uid(), name: b.name, objective: b.objective, status: 'draft', plan: null, createdAt: now()}; s.projects.unshift(p); return {project: p};
    },
    'POST /api/projects/:id/plan': (b, id) => {
      notHalted();
      const p = find(s.projects, id), plan = demoPlan(p);
      p.plan = {...plan, mode: 'demo'}; p.status = 'awaiting_approval';
      for (const t of plan.tasks) s.tasks.push({id: uid(), projectId: p.id, ...t, status: 'proposed', reworkCount: 0, createdAt: now()});
      for (const e of plan.escalations) s.decisions.unshift({id: uid(), projectId: p.id, title: e.title, question: e.question, status: 'pending', directorReview: null, createdAt: now()});
      run('manager', 'plan'); setStatus('manager', 'awaiting_approval', 'الخطة بانتظار اعتمادك');
      return {ok: true};
    },
    'POST /api/projects/:id/decide-plan': (b, id) => {
      const p = find(s.projects, id); p.status = b.approve ? 'active' : 'cancelled';
      for (const t of s.tasks.filter(x => x.projectId === id && x.status === 'proposed')) t.status = b.approve ? 'todo' : 'rejected';
      setStatus('manager', 'available'); return {ok: true};
    },
    'POST /api/decisions/:id/review': (b, id) => {
      notHalted();
      const d = find(s.decisions, id); d.directorReview = {...demoReview(), mode: 'demo'}; d.status = 'awaiting_ceo'; run('director', 'review'); return {ok: true};
    },
    'POST /api/decisions/:id/decide': (b, id) => { const d = find(s.decisions, id); d.status = b.approve ? 'approved' : 'rejected'; return {ok: true}; },
    'POST /api/tasks/:id/approve': (b, id) => { const t = find(s.tasks, id); t.status = b.approve ? 'todo' : 'rejected'; return {ok: true}; },
    'POST /api/tasks/:id/execute': (b, id) => {
      notHalted();
      const t = find(s.tasks, id), attempt = t.reworkCount + 1, defect = attempt === 1;
      const dev = run('developer', 'execute', {taskId: id, steps: 6, tools: ['list_files', 'read_file', 'write_file', 'write_file', 'run_tests', 'submit_work'].map(tool => ({tool, status: 'ok', summary: SIM, durationMs: 0}))});
      s.deliverables.unshift({id: uid(), taskId: id, runId: dev.id, kind: 'pull_request', title: `${t.title} (attempt ${attempt})`, summary: defect ? 'محاكاة: المحاولة الأولى تتضمن خللًا متعمدًا (لا تستبعد المهام المكتملة).' : 'محاكاة: أصلح المطوّر الخلل.', branch: `atlas/task-${id.slice(0, 8)}`, isLocalPr: true, evidence: {label: SIM, diffStat: ' src/tasks.js | 6 ++++++\n (simulated)'}, status: 'submitted', createdAt: now()});
      const qa = run('qa', 'qa', {taskId: id, steps: 4, status: 'succeeded'});
      const cases = [['QA-1 open task due before now', 'pass'], ['QA-2 completed task is never overdue', defect ? 'fail' : 'pass'], ['QA-3 no due date', 'pass'], ['QA-4 due exactly now', 'pass']].map(([name, result]) => ({name, result}));
      s.deliverables.unshift({id: uid(), taskId: id, runId: qa.id, kind: 'qa_report', title: `QA report (attempt ${attempt})`, summary: defect ? 'محاكاة: رُفض التسليم — المهام المكتملة تظهر كمتأخرة.' : 'محاكاة: كل الحالات ناجحة.', evidence: {label: SIM, verdict: defect ? 'fail' : 'pass', testCases: cases, defects: defect ? [{severity: 'major', title: 'Completed tasks are returned as overdue'}] : []}, status: 'submitted', createdAt: now()});
      if (defect) { t.status = 'rework'; t.reworkCount = attempt; setStatus('developer', 'available', 'QA رفض التسليم — بانتظار إعادة العمل'); }
      else { t.status = 'awaiting_ceo'; s.approvals.unshift({id: uid(), action: 'pr.merge', targetType: 'task', targetId: id, summary: `دمج «${t.title}» (محاكاة)`, status: 'pending', createdAt: now()}); setStatus('developer', 'awaiting_approval', 'طلب الدمج بانتظارك'); }
      return {ok: true};
    },
    'GET /api/tasks/:id': (b, id) => ({task: find(s.tasks, id), deliverables: s.deliverables.filter(d => d.taskId === id), runs: s.runs.filter(r => r.taskId === id), evaluations: []}),
    'GET /api/tasks/:id/diff': () => ({diff: '(static demo — no repository; diff is not available)'}),
    'POST /api/approvals/:id/decide': (b, id) => {
      const a = find(s.approvals, id); a.status = b.approve ? 'approved' : 'rejected';
      const t = s.tasks.find(x => x.id === a.targetId);
      if (t) t.status = b.approve ? 'done' : 'rework';
      if (b.approve && s.tasks.every(x => ['done', 'rejected'].includes(x.status))) for (const p of s.projects) if (p.status === 'active') p.status = 'completed';
      setStatus('developer', b.approve ? 'completed' : 'available'); return {ok: true};
    },
    'POST /api/evaluations': b => { s.evaluations.unshift({id: uid(), employeeId: b.employeeId, taskId: b.taskId, evaluator: 'ceo', scores: b.scores, overall: +(Object.values(b.scores).reduce((x, y) => x + y, 0) / Math.max(1, Object.keys(b.scores).length)).toFixed(2), comment: b.comment || '', createdAt: now()}); return {ok: true}; },
    'POST /api/agents/stop': () => { s.halted = true; return {ok: true}; },
    'POST /api/agents/resume': () => { s.halted = false; return {ok: true}; },
    'POST /api/settings/budget': () => ({ok: true}),
    'GET /api/audit': () => ({audit: []}),
  };

  return {
    async handle(route, body) {
      const method = body === undefined ? 'GET' : 'POST';
      const m = route.match(/^(\/api\/\w+)\/([\w-]+)(\/[\w-]+)?$/);
      const key = routes[`${method} ${route}`] ? `${method} ${route}` : m ? `${method} ${m[1]}/:id${m[3] || ''}` : '';
      const fn = routes[key];
      if (!fn) fail(404, 'Not available in the static demo');
      const out = fn(body || {}, m?.[2]);
      save();
      return structuredClone(out);
    },
    reset() { s = fresh(); save(); },
  };
}

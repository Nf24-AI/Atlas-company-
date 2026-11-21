// API + database integration tests: auth, authorization, CSRF, validation, and the full
// CEO → Manager → Director → CEO → Developer → QA → rework → CEO merge → evaluation workflow
// in DEMO mode (scripted agent content, REAL sandbox tool execution), plus restart persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/index.js';
import {loadConfig} from '../server/config.js';
import * as G from '../server/tools/git.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-wf-'));
const config = () => loadConfig({ATLAS_DATA_DIR: tmp, GROQ_API_KEY: '', DEEPSEEK_API_KEY: ''});

async function boot() {
  const app = createApp(config());
  const server = http.createServer(app.handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, route, body, {origin = base, raw = false} = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + route, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const json = await res.json().catch(() => ({}));
    if (raw) return {status: res.status, json, headers: res.headers};
    if (!res.ok) throw Object.assign(new Error(`${method} ${route} → ${res.status} ${json.error}`), {status: res.status});
    return json;
  };
  const close = () => new Promise(r => { server.close(r); app.db.close(); });
  return {app, call, close, base, setCookie: c => { cookie = c; }, getCookie: () => cookie};
}
const waitJobs = async (app, cid) => { for (let i = 0; i < 600 && !app.jobs.idle(cid); i++) await new Promise(r => setTimeout(r, 50)); assert.ok(app.jobs.idle(cid), 'jobs did not finish'); };

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));

let companyId, projectId, taskId;

test('unauthenticated API access is refused; health is public', async () => {
  const s = await boot();
  try {
    assert.equal((await s.call('GET', '/api/health')).setupRequired, true);
    assert.equal((await s.call('GET', '/api/state', undefined, {raw: true})).status, 401);
    assert.equal((await s.call('POST', '/api/projects', {name: 'x'}, {raw: true})).status, 401);
    // security headers on every response
    const r = await fetch(s.base + '/');
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  } finally { await s.close(); }
});

test('setup: CSRF/origin enforced, password policy, one-time only, login works', async () => {
  const s = await boot();
  try {
    assert.equal((await s.call('POST', '/api/auth/setup', {email: 'a@b.co', password: 'longenough1', displayName: 'CEO'}, {origin: 'https://evil.example', raw: true})).status, 403);
    assert.equal((await s.call('POST', '/api/auth/setup', {email: 'a@b.co', password: 'short', displayName: 'CEO'}, {raw: true})).status, 400);
    const r = await s.call('POST', '/api/auth/setup', {email: 'ceo@atlas.test', password: 'correct horse battery', displayName: 'Nawaf', companyName: 'ATLAS'});
    companyId = r.companyId;
    assert.match(s.getCookie(), /^atlas_sid=/);
    assert.equal((await s.call('POST', '/api/auth/setup', {email: 'x@y.co', password: 'another password', displayName: 'X'}, {raw: true})).status, 409);
    await s.call('POST', '/api/auth/logout', {});
    assert.equal((await s.call('GET', '/api/state', undefined, {raw: true})).status, 401);
    assert.equal((await s.call('POST', '/api/auth/login', {email: 'ceo@atlas.test', password: 'wrong password'}, {raw: true})).status, 401);
    await s.call('POST', '/api/auth/login', {email: 'CEO@atlas.test', password: 'correct horse battery'});
    const st = await s.call('GET', '/api/state');
    assert.deepEqual(st.employees.map(e => e.roleKey), ['ceo', 'manager', 'director', 'developer', 'qa']);
    assert.ok(st.employees.filter(e => e.kind === 'ai').every(e => e.mode === 'demo'), 'no keys → every AI employee is DEMO');
    assert.ok(!JSON.stringify(st).includes('password_hash'));
    // content-type enforcement (a cross-site form cannot send JSON)
    const form = await fetch(s.base + '/api/projects', {method: 'POST', headers: {Origin: s.base, Cookie: s.getCookie(), 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'name=x'});
    assert.equal(form.status, 415);
  } finally { await s.close(); }
});

test('full acceptance workflow (DEMO content, real sandbox execution)', {timeout: 120000}, async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/login', {email: 'ceo@atlas.test', password: 'correct horse battery'});
    // input validation
    assert.equal((await s.call('POST', '/api/projects', {name: 'x', objective: 'short'}, {raw: true})).status, 400);
    // meeting with the manager (labelled DEMO)
    const m = await s.call('POST', '/api/meetings', {role: 'manager', text: 'أبي نطلق المنتج في أسبوع بدون اختبارات'});
    assert.equal(m.mode, 'demo');
    assert.equal(m.output.verdict, 'challenge');
    // 4. CEO assigns a project
    const p = await s.call('POST', '/api/projects', {name: 'فلتر المهام المتأخرة', objective: 'نريد إضافة فلتر للمهام المتأخرة في مكتبة المهام مع اختبارات كاملة'});
    projectId = p.project.id;
    assert.equal((await s.call('POST', '/api/projects', {name: 'second one', objective: 'one project at a time please'}, {raw: true})).status, 409);
    // 5–6. Manager plans; Director reviews the escalation
    await s.call('POST', `/api/projects/${projectId}/plan`, {});
    await waitJobs(s.app, companyId);
    let st = await s.call('GET', '/api/state');
    const proj = st.projects.find(x => x.id === projectId);
    assert.equal(proj.status, 'awaiting_approval');
    assert.equal(proj.plan.mode, 'demo');
    const dec = st.decisions.find(d => d.projectId === projectId);
    assert.equal(dec.status, 'awaiting_ceo');
    assert.equal(dec.directorReview.verdict, 'approve');
    const tasks = st.tasks.filter(t => t.projectId === projectId);
    assert.ok(tasks.length >= 1 && tasks.every(t => t.status === 'proposed'));
    taskId = tasks.find(t => t.assigneeRole === 'developer').id;
    // cannot execute before CEO approval
    assert.equal((await s.call('POST', `/api/tasks/${taskId}/execute`, {}, {raw: true})).status, 409);
    // 7. CEO approves the plan and the Director-reviewed decision
    await s.call('POST', `/api/projects/${projectId}/decide-plan`, {approve: true});
    await s.call('POST', `/api/decisions/${dec.id}/decide`, {approve: true, note: 'موافق'});
    // 8–11. Developer executes in the sandbox; QA rejects attempt 1; rework; QA passes attempt 2
    await s.call('POST', `/api/tasks/${taskId}/execute`, {});
    await waitJobs(s.app, companyId);
    const detail = await s.call('GET', `/api/tasks/${taskId}`);
    assert.equal(detail.task.status, 'awaiting_ceo');
    assert.equal(detail.task.reworkCount, 1, 'exactly one QA rejection → rework cycle');
    const qa = detail.deliverables.filter(d => d.kind === 'qa_report');
    assert.deepEqual(qa.map(d => d.evidence.verdict), ['fail', 'pass']);
    assert.ok(qa[0].evidence.systemTestRun.failures.some(f => f.includes('QA-2')), 'QA-2 (completed tasks) caught the defect in a real test run');
    assert.equal(qa[1].evidence.systemTestRun.passed, true);
    const pr = detail.deliverables.find(d => d.kind === 'pull_request');
    assert.equal(pr.isLocalPr, true, 'no GitHub sandbox configured → labelled local PR');
    assert.match(pr.branch, /^atlas\/task-/);
    const codeDeliverables = detail.deliverables.filter(d => d.kind === 'code');
    assert.equal(codeDeliverables.length, 2);
    assert.ok(codeDeliverables.every(d => /^[0-9a-f]{40}$/.test(d.commitSha)), 'real git commits');
    assert.match(codeDeliverables[0].evidence.label, /DEMO/);
    const devRun = detail.runs.find(r => r.kind === 'develop');
    assert.ok(devRun.tools.some(t => t.tool === 'write_file' && t.status === 'ok'));
    assert.ok(devRun.tools.some(t => t.tool === 'run_tests'));
    // the sandbox branch really contains the change; main does not (yet)
    const repoDir = path.join(tmp, 'sandbox', projectId, 'repo');
    assert.match(await G.git(repoDir, ['show', `${pr.branch}:src/tasks.js`]), /overdueTasks/);
    assert.doesNotMatch(await G.git(repoDir, ['show', 'main:src/tasks.js']), /overdueTasks/);
    const diff = await s.call('GET', `/api/tasks/${taskId}/diff`);
    assert.match(diff.diff, /\+export function overdueTasks/);
    // 12. CEO reviews and approves the merge (CEO-only action)
    st = await s.call('GET', '/api/state');
    const merge = st.approvals.find(a => a.action === 'pr.merge' && a.status === 'pending');
    assert.ok(merge);
    await s.call('POST', `/api/approvals/${merge.id}/decide`, {approve: true});
    assert.match(await G.git(repoDir, ['show', 'main:src/tasks.js']), /!task\.completedAt/);
    st = await s.call('GET', '/api/state');
    assert.equal(st.tasks.find(t => t.id === taskId).status, 'done');
    assert.equal(st.projects.find(x => x.id === projectId).status, 'completed');
    // system evaluations from evidence
    const sys = st.evaluations.filter(e => e.evaluator === 'system');
    assert.equal(sys.length, 2);
    assert.equal(sys.find(e => e.employeeId === st.employees.find(x => x.roleKey === 'developer').id).evidence.reworkCount, 1);
    // 13. CEO evaluates employees
    const devId = st.employees.find(e => e.roleKey === 'developer').id;
    await s.call('POST', '/api/evaluations', {employeeId: devId, taskId, scores: {quality: 4, rework: 3, tests: 5}, comment: 'جيد بعد إعادة العمل'});
    assert.equal((await s.call('POST', '/api/evaluations', {employeeId: devId, scores: {quality: 9}}, {raw: true})).status, 400);
    // evaluations and audit are append-only at the database level
    assert.throws(() => s.app.db.run("UPDATE evaluations SET overall = 5"), /immutable/);
    assert.throws(() => s.app.db.run('DELETE FROM audit_logs'), /append-only/);
    // 15. usage/costs visible (DEMO → $0, no provider calls)
    assert.equal(st.usage.totalUsd, 0);
  } finally { await s.close(); }
});

test('14. everything persists after a restart', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/login', {email: 'ceo@atlas.test', password: 'correct horse battery'});
    const st = await s.call('GET', '/api/state');
    assert.equal(st.tasks.find(t => t.id === taskId).status, 'done');
    assert.ok(st.decisions.some(d => d.status === 'approved'));
    assert.ok(st.meetings.length >= 1);
    assert.equal(st.evaluations.filter(e => e.evaluator === 'ceo').length, 1);
    const audit = await s.call('GET', '/api/audit');
    for (const a of ['company.setup', 'project.plan.approved', 'task.rejected_by_qa', 'pr.merged', 'evaluation.create']) assert.ok(audit.audit.some(x => x.action === a), a);
  } finally { await s.close(); }
});

test('emergency stop halts agents and blocks new jobs until resumed', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/login', {email: 'ceo@atlas.test', password: 'correct horse battery'});
    await s.call('POST', '/api/agents/stop', {});
    const p = await s.call('POST', '/api/projects', {name: 'Second project', objective: 'Another small improvement to the library'});
    assert.equal((await s.call('POST', `/api/projects/${p.project.id}/plan`, {}, {raw: true})).status, 423);
    assert.equal((await s.call('POST', '/api/meetings', {role: 'manager', text: 'hello there'}, {raw: true})).status, 423);
    await s.call('POST', '/api/agents/resume', {});
    assert.equal((await s.call('GET', '/api/state')).halted, false);
    await s.call('POST', `/api/projects/${p.project.id}/cancel`, {});
  } finally { await s.close(); }
});

test('rate limiting on login', async () => {
  const s = await boot();
  try {
    let last;
    for (let i = 0; i < 11; i++) last = await s.call('POST', '/api/auth/login', {email: 'nobody@x.co', password: 'whatever123'}, {raw: true});
    assert.equal(last.status, 429);
  } finally { await s.close(); }
});

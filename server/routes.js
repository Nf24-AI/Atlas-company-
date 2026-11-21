// API routes. Authorization model (single-tenant local install):
//   * every /api route except health/auth requires a valid session;
//   * the company is ALWAYS the session user's own company (never a client-supplied id);
//   * CEO-only actions (approvals, merges, evaluations, permissions, budgets, stop) are performed
//     by the authenticated human; AI employees can never call these routes.
import {validate, S} from './validate.js';
import {HttpError} from './http.js';
import {hashPassword, verifyPassword, checkPasswordPolicy} from './auth.js';
import * as G from './tools/git.js';
import {ensureSandbox} from './tools/sandbox.js';
import {githubEnabled} from './tools/github.js';

const EVAL_DIMENSIONS = ['quality', 'compliance', 'tests', 'decisions', 'time', 'rework', 'reliability', 'cost'];

export function registerRoutes(router, {repo, orch, jobs, config, providers}) {
  const ok = (data = {}) => ({ok: true, ...data});
  const need = (cond, status, msg) => { if (!cond) throw new HttpError(status, msg); };

  // ---------------------------------------------------------------- public
  router.get('/api/health', () => ({ok: true, setupRequired: repo.userCount() === 0}), {public: true});
  router.get('/api/auth/status', ({user}) => ({setupRequired: repo.userCount() === 0, user: user ? {email: user.email, displayName: user.displayName, locale: user.locale} : null}), {public: true});

  router.post('/api/auth/setup', ({body, ctx}) => {
    const b = validate({type: 'object', props: {email: S.str(200, {min: 3, pattern: /^[^\s@]+@[^\s@]+$/}), password: {type: 'string', trim: false, max: 200}, displayName: S.str(80, {min: 1}), companyName: S.str(80, {default: 'ATLAS'}), locale: {type: 'string', enum: ['ar', 'en'], default: 'ar'}}}, body);
    checkPasswordPolicy(b.password);
    const {userId, companyId} = repo.setup({email: b.email, displayName: b.displayName, companyName: b.companyName, passwordHash: hashPassword(b.password), models: config.models, locale: b.locale});
    const s = ctx.sessions.create(userId);
    ctx.setSession(s);
    return ok({companyId});
  }, {public: true, rate: 'auth'});

  router.post('/api/auth/login', ({body, ctx}) => {
    const b = validate({type: 'object', props: {email: S.str(200, {min: 3}), password: {type: 'string', trim: false, max: 200}}}, body);
    const u = repo.findUserByEmail(b.email);
    // Same work whether or not the user exists, to avoid account enumeration by timing.
    const valid = u ? verifyPassword(b.password, u.password_hash) : (verifyPassword(b.password, hashPassword('x'.repeat(12))) && false);
    if (!valid) { repo.audit(u ? repo.companyForUser(u.id)?.id : null, 'system', null, 'auth.login.failed', 'user', u?.id ?? null, {}); throw new HttpError(401, 'Invalid email or password'); }
    const company = repo.companyForUser(u.id);
    repo.audit(company?.id, 'user', u.id, 'auth.login', 'user', u.id, {});
    ctx.setSession(ctx.sessions.create(u.id));
    return ok();
  }, {public: true, rate: 'auth'});

  router.post('/api/auth/logout', ({ctx}) => { ctx.clearSession(); return ok(); }, {public: true});

  // ---------------------------------------------------------------- state
  router.get('/api/state', ({company, user}) => {
    const cid = company.id;
    const employees = repo.employees(cid).map(e => ({...e, mode: e.kind === 'ai' ? orch.modeOf(e) : 'human', permissions: repo.permissionsOf(e.id)}));
    return {
      user: {email: user.email, displayName: user.displayName, locale: user.locale},
      company: {id: cid, name: company.name, motto: company.motto},
      employees, projects: repo.projects(cid), tasks: repo.tasks(cid), decisions: repo.decisions(cid),
      approvals: repo.approvals(cid), deliverables: repo.deliverables(cid), meetings: repo.meetings(cid, null, 20),
      runs: repo.runs(cid, 30), evaluations: repo.evaluations(cid), usage: repo.usageSummary(cid),
      jobs: jobs.list(cid), halted: repo.agentsHalted(cid),
      integrations: {github: githubEnabled(config.github) ? {repo: config.github.repo} : null},
      liveProviders: {groq: providers.isLive('groq'), deepseek: providers.isLive('deepseek')},
    };
  });

  // ---------------------------------------------------------------- meetings
  router.post('/api/meetings', async ({body, company}) => {
    const b = validate({type: 'object', props: {role: {type: 'string', enum: ['manager', 'director', 'developer', 'qa']}, text: S.str(2200, {min: 3}), channel: {type: 'string', enum: ['text', 'voice'], default: 'text'}, projectId: S.opt(S.id)}}, body);
    if (b.projectId) need(repo.project(company.id, b.projectId), 404, 'Project not found');
    need(!repo.agentsHalted(company.id), 423, 'Agents are halted (emergency stop). Resume first.');
    try { return await orch.meeting(company.id, b); }
    catch (e) { if (e.budget) throw new HttpError(402, e.message); if (e.code) throw new HttpError(502, `Model provider error: ${e.message}`); throw e; }
  }, {rate: 'agent'});

  // ---------------------------------------------------------------- projects & planning
  router.post('/api/projects', ({body, company, user}) => {
    const b = validate({type: 'object', props: {name: S.str(120, {min: 3}), objective: S.str(2000, {min: 10}), description: S.str(4000, {default: ''})}}, body);
    need(repo.projects(company.id).filter(p => ['draft', 'planning', 'awaiting_approval', 'active'].includes(p.status)).length < 1, 409, 'MVP limit: one active project at a time. Complete or cancel the current project first.');
    return ok({project: repo.createProject(company.id, user.id, b)});
  });
  router.post('/api/projects/:id/cancel', ({params, company, user}) => {
    const p = repo.project(company.id, params.id); need(p, 404, 'Project not found');
    need(jobs.idle(company.id), 409, 'Stop running agent jobs first');
    repo.updateProject(company.id, p.id, {status: 'cancelled'}); repo.audit(company.id, 'user', user.id, 'project.cancel', 'project', p.id);
    return ok();
  });
  router.post('/api/projects/:id/plan', ({params, company, user}) => {
    need(repo.project(company.id, params.id), 404, 'Project not found');
    need(!repo.agentsHalted(company.id), 423, 'Agents are halted (emergency stop). Resume first.');
    const job = orch.planProject(company.id, user.id, params.id);
    return ok({jobId: job.id});
  }, {rate: 'agent'});
  router.post('/api/projects/:id/decide-plan', ({params, body, company, user}) => {
    const b = validate({type: 'object', props: {approve: {type: 'boolean'}, reason: S.str(1000, {default: ''})}}, body);
    need(repo.project(company.id, params.id), 404, 'Project not found');
    orch.decidePlan(company.id, user.id, params.id, b.approve, b.reason);
    return ok();
  });

  // ---------------------------------------------------------------- decisions
  router.post('/api/decisions/:id/review', ({params, company}) => {
    need(repo.decision(company.id, params.id), 404, 'Decision not found');
    need(!repo.agentsHalted(company.id), 423, 'Agents are halted');
    return ok({jobId: orch.reviewDecisionJob(company.id, params.id).id});
  }, {rate: 'agent'});
  router.post('/api/decisions/:id/decide', ({params, body, company, user}) => {
    const b = validate({type: 'object', props: {approve: {type: 'boolean'}, note: S.str(1000, {default: ''})}}, body);
    const d = repo.decision(company.id, params.id); need(d, 404, 'Decision not found');
    need(!['approved', 'rejected'].includes(d.status), 409, 'Decision already decided');
    repo.decide(company.id, d.id, user.id, b.approve ? 'approved' : 'rejected', b.note);
    return ok();
  });

  // ---------------------------------------------------------------- tasks
  router.get('/api/tasks/:id', ({params, company}) => {
    const t = repo.task(company.id, params.id); need(t, 404, 'Task not found');
    const runs = repo.runs(company.id, 200).filter(r => r.taskId === t.id).map(r => ({...r, tools: repo.toolExecutions(company.id, r.id)}));
    return {task: t, deliverables: repo.deliverables(company.id, t.id), runs, evaluations: repo.evaluations(company.id).filter(e => e.taskId === t.id)};
  });
  router.post('/api/tasks/:id/approve', ({params, body, company, user}) => {
    const b = validate({type: 'object', props: {approve: {type: 'boolean'}}}, body);
    const t = repo.task(company.id, params.id); need(t, 404, 'Task not found'); need(t.status === 'proposed', 409, 'Task is not a proposal');
    const p = repo.project(company.id, t.projectId); need(p.status === 'active' || !b.approve, 409, 'Approve the project plan first');
    repo.setTaskStatus(company.id, t.id, b.approve ? 'todo' : 'rejected'); repo.audit(company.id, 'user', user.id, b.approve ? 'task.approved' : 'task.rejected', 'task', t.id);
    return ok();
  });
  router.post('/api/tasks/:id/execute', ({params, company, user}) => {
    const t = repo.task(company.id, params.id); need(t, 404, 'Task not found');
    need(['todo', 'rework'].includes(t.status), 409, `Task status is ${t.status}`);
    need(!repo.agentsHalted(company.id), 423, 'Agents are halted (emergency stop). Resume first.');
    return ok({jobId: orch.executeTask(company.id, user.id, t.id).id});
  }, {rate: 'agent'});
  router.get('/api/tasks/:id/diff', async ({params, company}) => {
    const t = repo.task(company.id, params.id); need(t, 404, 'Task not found');
    const pr = repo.deliverables(company.id, t.id).find(d => d.kind === 'pull_request'); need(pr?.branch, 404, 'No branch for this task');
    const dir = await ensureSandbox(config.sandboxDir, t.projectId);
    const base = pr.status === 'merged' ? `${pr.branch}^1` : 'main';
    const diff = await G.git(dir, ['diff', pr.status === 'merged' ? `main~1...main` : `${base}...${pr.branch}`]).catch(e => `(diff unavailable: ${e.message})`);
    return {branch: pr.branch, diff: diff.length > 60000 ? diff.slice(0, 60000) + '\n…[truncated]' : diff};
  });

  // ---------------------------------------------------------------- approvals (CEO authority)
  router.post('/api/approvals/:id/decide', async ({params, body, company, user}) => {
    const b = validate({type: 'object', props: {approve: {type: 'boolean'}, reason: S.str(1000, {default: ''})}}, body);
    const a = repo.approval(company.id, params.id); need(a, 404, 'Approval not found'); need(a.status === 'pending', 409, 'Approval is not pending');
    if (a.action === 'pr.merge') return ok(await orch.decideMerge(company.id, user.id, a.id, b.approve, b.reason));
    if (a.action === 'plan.approve') { orch.decidePlan(company.id, user.id, a.targetId, b.approve, b.reason); return ok(); }
    // Other CEO-only actions (deploy, spend, account creation, permission change) are recorded but
    // have no executor in the MVP: approving them performs nothing automatically.
    repo.decideApproval(company.id, a.id, user.id, b.approve ? 'approved' : 'rejected', b.reason);
    return ok({note: 'Recorded. No automatic executor exists for this action in the MVP.'});
  });

  // ---------------------------------------------------------------- evaluations (CEO only; append-only)
  router.post('/api/evaluations', ({body, company, user}) => {
    const dim = {type: 'integer', min: 1, max: 5, optional: true};
    const b = validate({type: 'object', props: {employeeId: S.id, taskId: S.opt(S.id), scores: {type: 'object', props: Object.fromEntries(EVAL_DIMENSIONS.map(k => [k, dim]))}, comment: S.str(2000, {default: ''})}}, body);
    const emp = repo.employee(company.id, b.employeeId); need(emp && emp.kind === 'ai', 404, 'AI employee not found');
    if (b.taskId) { const t = repo.task(company.id, b.taskId); need(t, 404, 'Task not found'); need(['done', 'blocked', 'awaiting_ceo', 'rework'].includes(t.status), 409, 'Evaluate tasks after they have produced results'); }
    const vals = Object.values(b.scores).filter(v => v !== undefined); need(vals.length > 0, 400, 'At least one score is required');
    const id = repo.addEvaluation(company.id, {employeeId: emp.id, taskId: b.taskId, evaluator: 'ceo', scores: b.scores, overall: Math.round(vals.reduce((x, y) => x + y, 0) / vals.length * 100) / 100, comment: b.comment});
    repo.audit(company.id, 'user', user.id, 'evaluation.create', 'employee', emp.id, {evaluationId: id});
    return ok({id});
  });

  // ---------------------------------------------------------------- runs, jobs, kill switch, budgets
  router.get('/api/runs/:id', ({params, company}) => { const r = repo.run(company.id, params.id); need(r, 404, 'Run not found'); return {run: r, tools: repo.toolExecutions(company.id, r.id)}; });
  router.post('/api/agents/stop', ({company, user}) => {
    repo.setSetting(company.id, 'agents_halted', 'true');
    const n = jobs.stopAll(company.id);
    repo.audit(company.id, 'user', user.id, 'agents.emergency_stop', 'company', company.id, {jobsStopped: n});
    return ok({jobsStopped: n});
  });
  router.post('/api/agents/resume', ({company, user}) => {
    repo.setSetting(company.id, 'agents_halted', 'false');
    for (const e of repo.employees(company.id)) if (e.status === 'blocked' && /halted|budget/i.test(e.statusDetail)) repo.setEmployeeStatus(company.id, e.id, 'available');
    repo.audit(company.id, 'user', user.id, 'agents.resume', 'company', company.id);
    return ok();
  });
  router.post('/api/settings/budget', ({body, company, user}) => {
    const b = validate({type: 'object', props: {monthlyBudgetUsd: {type: 'number', min: 0, max: 100, optional: true}, employeeId: S.opt(S.id), dailyBudgetUsd: {type: 'number', min: 0, max: 20, optional: true}}}, body);
    if (b.monthlyBudgetUsd !== undefined) repo.setSetting(company.id, 'monthly_budget_usd', b.monthlyBudgetUsd);
    if (b.employeeId && b.dailyBudgetUsd !== undefined) {
      need(repo.employee(company.id, b.employeeId), 404, 'Employee not found');
      repo.raw.run('UPDATE employees SET daily_budget_usd = ? WHERE company_id = ? AND id = ?', b.dailyBudgetUsd, company.id, b.employeeId);
    }
    repo.audit(company.id, 'user', user.id, 'settings.budget', 'company', company.id, b);
    return ok();
  });
  router.get('/api/audit', ({company}) => ({audit: repo.auditLog(company.id, 150)}));
}

// Company OS repository. Every company-owned query is scoped by companyId, which the route
// layer derives from the authenticated session — never from request input (data isolation).
import crypto from 'node:crypto';

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
const j = v => JSON.stringify(v ?? null);
const p = (s, d = null) => { if (s === null || s === undefined) return d; try { return JSON.parse(s); } catch { return d; } };

export const ROLE_PERMISSIONS = Object.freeze({
  ceo: [],
  manager: ['meeting.reply', 'project.plan', 'decision.escalate', 'task.assign'],
  director: ['meeting.reply', 'decision.review'],
  developer: ['meeting.reply', 'sandbox.read', 'sandbox.write.src', 'tests.run', 'git.branch_commit', 'pr.open'],
  qa: ['meeting.reply', 'sandbox.read', 'sandbox.write.qa', 'tests.run', 'qa.report'],
});
export const EMPLOYEE_STATUSES = ['available', 'planning', 'in_meeting', 'executing', 'reviewing', 'blocked', 'awaiting_approval', 'completed'];

export function createRepo(db) {
  const audit = (companyId, actorType, actorId, action, targetType = null, targetId = null, detail = {}) =>
    db.run('INSERT INTO audit_logs (id, company_id, actor_type, actor_id, action, target_type, target_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      uid(), companyId, actorType, actorId, action, targetType, targetId, j(detail), now());

  const rowEmployee = r => r && ({id: r.id, roleKey: r.role_key, name: r.name, kind: r.kind, provider: r.provider, model: r.model, status: r.status,
    statusDetail: r.status_detail, statusRunId: r.status_run_id, dailyBudgetUsd: r.daily_budget_usd, maxSteps: r.max_steps, updatedAt: r.updated_at});
  const rowProject = r => r && ({id: r.id, name: r.name, objective: r.objective, description: r.description, status: r.status, plan: p(r.plan), sandboxPath: r.sandbox_path ? true : false, createdAt: r.created_at, updatedAt: r.updated_at});
  const rowTask = r => r && ({id: r.id, projectId: r.project_id, title: r.title, description: r.description, acceptanceCriteria: p(r.acceptance_criteria, []), assigneeRole: r.assignee_role,
    priority: r.priority, status: r.status, reworkCount: r.rework_count, startedAt: r.started_at, completedAt: r.completed_at, createdAt: r.created_at, updatedAt: r.updated_at});
  const rowDecision = r => r && ({id: r.id, projectId: r.project_id, kind: r.kind, title: r.title, question: r.question, proposedBy: r.proposed_by, directorReview: p(r.director_review), status: r.status, ceoNote: r.ceo_note, decidedAt: r.decided_at, createdAt: r.created_at});
  const rowDeliverable = r => r && ({id: r.id, taskId: r.task_id, employeeId: r.employee_id, runId: r.run_id, kind: r.kind, title: r.title, summary: r.summary, branch: r.branch, commitSha: r.commit_sha,
    prUrl: r.pr_url, prNumber: r.pr_number, isLocalPr: !!r.is_local_pr, evidence: p(r.evidence, {}), status: r.status, createdAt: r.created_at});
  const rowApproval = r => r && ({id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, requestedBy: r.requested_by, summary: r.summary, payload: p(r.payload, {}), status: r.status, reason: r.reason, decidedAt: r.decided_at, createdAt: r.created_at});
  const rowRun = r => r && ({id: r.id, employeeId: r.employee_id, projectId: r.project_id, taskId: r.task_id, kind: r.kind, mode: r.mode, status: r.status, input: r.input, output: p(r.output), error: r.error,
    steps: r.steps, tokensIn: r.tokens_in, tokensOut: r.tokens_out, costUsd: r.cost_usd, startedAt: r.started_at, finishedAt: r.finished_at, createdAt: r.created_at});

  const api = {
    audit,
    userCount: () => db.get('SELECT COUNT(*) n FROM users').n,
    findUserByEmail: email => db.get('SELECT * FROM users WHERE email = ?', email),
    companyForUser: userId => db.get('SELECT * FROM companies WHERE owner_id = ? ORDER BY created_at LIMIT 1', userId),

    /** First-run setup: CEO user + company + employees + permissions + settings, atomically. */
    setup({email, displayName, passwordHash, companyName, models, locale = 'ar'}) {
      return db.tx(() => {
        if (api.userCount() > 0) throw Object.assign(new Error('Setup already completed'), {status: 409});
        const userId = uid(), companyId = uid(), t = now();
        db.run('INSERT INTO users (id, email, display_name, password_hash, locale, created_at) VALUES (?,?,?,?,?,?)', userId, email, displayName, passwordHash, locale, t);
        db.run('INSERT INTO companies (id, owner_id, name, motto, created_at) VALUES (?,?,?,?,?)', companyId, userId, companyName, 'من الفكرة إلى التنفيذ', t);
        const staff = [
          ['ceo', displayName, 'human', null, null, 0, 0],
          ['manager', 'Project Manager', 'ai', models.manager.provider, models.manager.model, 0.5, 6],
          ['director', 'Technical Director', 'ai', models.director.provider, models.director.model, 0.5, 4],
          ['developer', 'Software Developer', 'ai', models.developer.provider, models.developer.model, 1.0, 14],
          ['qa', 'QA Engineer', 'ai', models.qa.provider, models.qa.model, 0.5, 10],
        ];
        for (const [role, name, kind, provider, model, budget, steps] of staff) {
          const eid = uid();
          db.run('INSERT INTO employees (id, company_id, role_key, name, kind, provider, model, daily_budget_usd, max_steps, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', eid, companyId, role, name, kind, provider, model, budget, steps, t);
          for (const perm of ROLE_PERMISSIONS[role]) db.run('INSERT INTO employee_permissions (employee_id, permission_key, granted_by, granted_at) VALUES (?,?,?,?)', eid, perm, 'system:setup', t);
        }
        for (const [k, v] of [['agents_halted', 'false'], ['monthly_budget_usd', '5']]) db.run('INSERT INTO settings (company_id, key, value, updated_at) VALUES (?,?,?,?)', companyId, k, v, t);
        audit(companyId, 'user', userId, 'company.setup', 'company', companyId, {employees: staff.length});
        return {userId, companyId};
      });
    },

    // ---- settings / kill switch / budget
    setting: (companyId, key, d = null) => db.get('SELECT value FROM settings WHERE company_id = ? AND key = ?', companyId, key)?.value ?? d,
    setSetting(companyId, key, value) { db.run('INSERT INTO settings (company_id, key, value, updated_at) VALUES (?,?,?,?) ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', companyId, key, String(value), now()); },
    agentsHalted: companyId => api.setting(companyId, 'agents_halted', 'false') === 'true',

    // ---- employees
    employees: companyId => db.all('SELECT * FROM employees WHERE company_id = ? ORDER BY CASE role_key WHEN \'ceo\' THEN 0 WHEN \'manager\' THEN 1 WHEN \'director\' THEN 2 WHEN \'developer\' THEN 3 ELSE 4 END', companyId).map(rowEmployee),
    employeeByRole: (companyId, role) => rowEmployee(db.get('SELECT * FROM employees WHERE company_id = ? AND role_key = ?', companyId, role)),
    employee: (companyId, id) => rowEmployee(db.get('SELECT * FROM employees WHERE company_id = ? AND id = ?', companyId, id)),
    permissionsOf: employeeId => db.all('SELECT permission_key FROM employee_permissions WHERE employee_id = ?', employeeId).map(r => r.permission_key),
    hasPermission: (employeeId, perm) => !!db.get('SELECT 1 x FROM employee_permissions WHERE employee_id = ? AND permission_key = ?', employeeId, perm),
    setEmployeeStatus(companyId, employeeId, status, detail = '', runId = null) {
      if (!EMPLOYEE_STATUSES.includes(status)) throw new Error('bad status ' + status);
      db.run('UPDATE employees SET status = ?, status_detail = ?, status_run_id = ?, updated_at = ? WHERE company_id = ? AND id = ?', status, String(detail).slice(0, 200), runId, now(), companyId, employeeId);
    },

    // ---- projects
    createProject(companyId, userId, {name, objective, description = ''}) {
      const id = uid(), t = now();
      db.run('INSERT INTO projects (id, company_id, name, objective, description, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', id, companyId, name, objective, description, 'draft', userId, t, t);
      audit(companyId, 'user', userId, 'project.create', 'project', id, {name});
      return api.project(companyId, id);
    },
    project: (companyId, id) => rowProject(db.get('SELECT * FROM projects WHERE company_id = ? AND id = ?', companyId, id)),
    projectRaw: (companyId, id) => db.get('SELECT * FROM projects WHERE company_id = ? AND id = ?', companyId, id),
    projects: companyId => db.all('SELECT * FROM projects WHERE company_id = ? ORDER BY created_at DESC', companyId).map(rowProject),
    updateProject(companyId, id, fields) {
      const cols = {status: 'status', plan: 'plan', sandboxPath: 'sandbox_path', description: 'description'};
      for (const [k, v] of Object.entries(fields)) if (cols[k]) db.run(`UPDATE projects SET ${cols[k]} = ?, updated_at = ? WHERE company_id = ? AND id = ?`, k === 'plan' ? j(v) : v, now(), companyId, id);
    },

    // ---- tasks
    createTask(companyId, projectId, t) {
      const id = uid(), ts = now();
      db.run('INSERT INTO tasks (id, company_id, project_id, title, description, acceptance_criteria, assignee_role, priority, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        id, companyId, projectId, t.title, t.description || '', j(t.acceptanceCriteria || []), t.assigneeRole || 'developer', t.priority || 'medium', t.status || 'proposed', ts, ts);
      return api.task(companyId, id);
    },
    task: (companyId, id) => rowTask(db.get('SELECT * FROM tasks WHERE company_id = ? AND id = ?', companyId, id)),
    tasks: (companyId, projectId = null) => (projectId ? db.all('SELECT * FROM tasks WHERE company_id = ? AND project_id = ? ORDER BY created_at', companyId, projectId) : db.all('SELECT * FROM tasks WHERE company_id = ? ORDER BY created_at', companyId)).map(rowTask),
    setTaskStatus(companyId, id, status, extra = {}) {
      const t = now();
      db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE company_id = ? AND id = ?', status, t, companyId, id);
      if (extra.started) db.run('UPDATE tasks SET started_at = COALESCE(started_at, ?) WHERE company_id = ? AND id = ?', t, companyId, id);
      if (extra.completed) db.run('UPDATE tasks SET completed_at = ? WHERE company_id = ? AND id = ?', t, companyId, id);
      if (extra.rework) db.run('UPDATE tasks SET rework_count = rework_count + 1 WHERE company_id = ? AND id = ?', companyId, id);
    },

    // ---- decisions
    createDecision(companyId, d) {
      const id = uid();
      db.run('INSERT INTO decisions (id, company_id, project_id, kind, title, question, proposed_by, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, companyId, d.projectId || null, d.kind || 'technical', d.title, d.question || '', d.proposedBy, d.status || 'pending', now());
      return api.decision(companyId, id);
    },
    decision: (companyId, id) => rowDecision(db.get('SELECT * FROM decisions WHERE company_id = ? AND id = ?', companyId, id)),
    decisions: (companyId, projectId = null) => (projectId ? db.all('SELECT * FROM decisions WHERE company_id = ? AND project_id = ? ORDER BY created_at', companyId, projectId) : db.all('SELECT * FROM decisions WHERE company_id = ? ORDER BY created_at DESC', companyId)).map(rowDecision),
    setDirectorReview(companyId, id, review) { db.run('UPDATE decisions SET director_review = ?, status = ? WHERE company_id = ? AND id = ?', j(review), 'awaiting_ceo', companyId, id); },
    decide(companyId, id, userId, status, note = '') {
      db.run('UPDATE decisions SET status = ?, ceo_note = ?, decided_by = ?, decided_at = ? WHERE company_id = ? AND id = ?', status, note, userId, now(), companyId, id);
      audit(companyId, 'user', userId, 'decision.' + status, 'decision', id, {note});
    },

    // ---- deliverables
    createDeliverable(companyId, d) {
      const id = uid();
      db.run('INSERT INTO deliverables (id, company_id, task_id, employee_id, run_id, kind, title, summary, branch, commit_sha, pr_url, pr_number, is_local_pr, evidence, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        id, companyId, d.taskId, d.employeeId, d.runId || null, d.kind, d.title, d.summary || '', d.branch || null, d.commitSha || null, d.prUrl || null, d.prNumber || null, d.isLocalPr ? 1 : 0, j(d.evidence || {}), d.status || 'submitted', now());
      return api.deliverable(companyId, id);
    },
    deliverable: (companyId, id) => rowDeliverable(db.get('SELECT * FROM deliverables WHERE company_id = ? AND id = ?', companyId, id)),
    deliverables: (companyId, taskId = null) => (taskId ? db.all('SELECT * FROM deliverables WHERE company_id = ? AND task_id = ? ORDER BY created_at', companyId, taskId) : db.all('SELECT * FROM deliverables WHERE company_id = ? ORDER BY created_at DESC LIMIT 200', companyId)).map(rowDeliverable),
    setDeliverableStatus(companyId, id, status) { db.run('UPDATE deliverables SET status = ? WHERE company_id = ? AND id = ?', status, companyId, id); },

    // ---- approvals (CEO-only actions)
    requestApproval(companyId, a) {
      const id = uid();
      db.run('INSERT INTO approvals (id, company_id, action, target_type, target_id, requested_by, summary, payload, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, companyId, a.action, a.targetType, a.targetId, a.requestedBy, a.summary || '', j(a.payload || {}), 'pending', now());
      audit(companyId, a.requestedBy === 'system' ? 'system' : 'employee', a.requestedBy, 'approval.request', 'approval', id, {action: a.action});
      return api.approval(companyId, id);
    },
    approval: (companyId, id) => rowApproval(db.get('SELECT * FROM approvals WHERE company_id = ? AND id = ?', companyId, id)),
    approvals: (companyId, status = null) => (status ? db.all('SELECT * FROM approvals WHERE company_id = ? AND status = ? ORDER BY created_at DESC', companyId, status) : db.all('SELECT * FROM approvals WHERE company_id = ? ORDER BY created_at DESC LIMIT 200', companyId)).map(rowApproval),
    pendingApprovalFor: (companyId, action, targetId) => rowApproval(db.get('SELECT * FROM approvals WHERE company_id = ? AND action = ? AND target_id = ? AND status = \'pending\'', companyId, action, targetId)),
    decideApproval(companyId, id, userId, status, reason = '') {
      const r = db.run('UPDATE approvals SET status = ?, decided_by = ?, decided_at = ?, reason = ? WHERE company_id = ? AND id = ? AND status = \'pending\'', status, userId, now(), reason, companyId, id);
      if (!r.changes) throw Object.assign(new Error('Approval is not pending'), {status: 409});
      audit(companyId, 'user', userId, 'approval.' + status, 'approval', id, {reason});
    },
    markApproval(companyId, id, status) { db.run('UPDATE approvals SET status = ? WHERE company_id = ? AND id = ?', status, companyId, id); },

    // ---- meetings
    createMeeting(companyId, m) {
      const id = uid();
      db.run('INSERT INTO meetings (id, company_id, employee_id, project_id, run_id, mode, ceo_input, input_channel, reply, summary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, companyId, m.employeeId, m.projectId || null, m.runId || null, m.mode, m.ceoInput, m.channel || 'text', m.reply, m.summary || '', now());
      return id;
    },
    meetings: (companyId, employeeId = null, limit = 30) => (employeeId ? db.all('SELECT * FROM meetings WHERE company_id = ? AND employee_id = ? ORDER BY created_at DESC LIMIT ?', companyId, employeeId, limit) : db.all('SELECT * FROM meetings WHERE company_id = ? ORDER BY created_at DESC LIMIT ?', companyId, limit))
      .map(r => ({id: r.id, employeeId: r.employee_id, projectId: r.project_id, runId: r.run_id, mode: r.mode, ceoInput: r.ceo_input, channel: r.input_channel, reply: r.reply, summary: r.summary, createdAt: r.created_at})),

    // ---- runs, tools, usage
    createRun(companyId, r) {
      const id = uid(), t = now();
      db.run('INSERT INTO agent_runs (id, company_id, employee_id, project_id, task_id, kind, mode, status, input, started_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, companyId, r.employeeId, r.projectId || null, r.taskId || null, r.kind, r.mode, 'running', String(r.input || '').slice(0, 4000), t, t);
      return id;
    },
    finishRun(companyId, id, {status, output = null, error = null}) {
      db.run('UPDATE agent_runs SET status = ?, output = ?, error = ?, finished_at = ? WHERE company_id = ? AND id = ?', status, output === null ? null : j(output), error ? String(error).slice(0, 1000) : null, now(), companyId, id);
    },
    addRunStep(companyId, id) { db.run('UPDATE agent_runs SET steps = steps + 1 WHERE company_id = ? AND id = ?', companyId, id); },
    run: (companyId, id) => rowRun(db.get('SELECT * FROM agent_runs WHERE company_id = ? AND id = ?', companyId, id)),
    runs: (companyId, limit = 50) => db.all('SELECT * FROM agent_runs WHERE company_id = ? ORDER BY created_at DESC LIMIT ?', companyId, limit).map(rowRun),
    activeRuns: companyId => db.all('SELECT * FROM agent_runs WHERE company_id = ? AND status = \'running\'', companyId).map(rowRun),
    recordTool(companyId, t) {
      db.run('INSERT INTO tool_executions (id, company_id, run_id, employee_id, tool, args, status, result_summary, duration_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', uid(), companyId, t.runId, t.employeeId, t.tool, j(t.args || {}).slice(0, 2000), t.status, String(t.summary || '').slice(0, 2000), t.durationMs || 0, now());
    },
    toolExecutions: (companyId, runId) => db.all('SELECT tool, args, status, result_summary, duration_ms, created_at FROM tool_executions WHERE company_id = ? AND run_id = ? ORDER BY created_at, rowid', companyId, runId)
      .map(r => ({tool: r.tool, args: p(r.args, {}), status: r.status, summary: r.result_summary, durationMs: r.duration_ms, at: r.created_at})),
    recordUsage(companyId, u) {
      db.run('INSERT INTO usage_records (id, company_id, employee_id, run_id, provider, model, tokens_in, tokens_out, cached_tokens, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', uid(), companyId, u.employeeId, u.runId || null, u.provider, u.model, u.tokensIn, u.tokensOut, u.cachedTokens || 0, u.costUsd, now());
      if (u.runId) db.run('UPDATE agent_runs SET tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_usd = cost_usd + ? WHERE company_id = ? AND id = ?', u.tokensIn, u.tokensOut, u.costUsd, companyId, u.runId);
    },
    spend(companyId, {employeeId = null, since}) {
      const r = employeeId ? db.get('SELECT COALESCE(SUM(cost_usd),0) c FROM usage_records WHERE company_id = ? AND employee_id = ? AND created_at >= ?', companyId, employeeId, since)
        : db.get('SELECT COALESCE(SUM(cost_usd),0) c FROM usage_records WHERE company_id = ? AND created_at >= ?', companyId, since);
      return r.c;
    },
    usageSummary(companyId) {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const rows = db.all('SELECT e.role_key role, u.provider, u.model, COUNT(*) calls, SUM(u.tokens_in) tin, SUM(u.tokens_out) tout, SUM(u.cost_usd) cost FROM usage_records u JOIN employees e ON e.id = u.employee_id WHERE u.company_id = ? AND u.created_at >= ? GROUP BY e.role_key, u.provider, u.model', companyId, monthStart.toISOString());
      return {since: monthStart.toISOString(), rows: rows.map(r => ({role: r.role, provider: r.provider, model: r.model, calls: r.calls, tokensIn: r.tin, tokensOut: r.tout, costUsd: Math.round(r.cost * 1e6) / 1e6})),
        totalUsd: rows.reduce((a, r) => a + r.cost, 0), budgetUsd: Number(api.setting(companyId, 'monthly_budget_usd', '5'))};
    },

    // ---- evaluations (append-only)
    addEvaluation(companyId, e) {
      const id = uid();
      db.run('INSERT INTO evaluations (id, company_id, employee_id, task_id, evaluator, scores, overall, evidence, comment, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, companyId, e.employeeId, e.taskId || null, e.evaluator, j(e.scores), e.overall, j(e.evidence || {}), e.comment || '', now());
      return id;
    },
    evaluations: (companyId, employeeId = null) => (employeeId ? db.all('SELECT * FROM evaluations WHERE company_id = ? AND employee_id = ? ORDER BY created_at DESC', companyId, employeeId) : db.all('SELECT * FROM evaluations WHERE company_id = ? ORDER BY created_at DESC LIMIT 200', companyId))
      .map(r => ({id: r.id, employeeId: r.employee_id, taskId: r.task_id, evaluator: r.evaluator, scores: p(r.scores, {}), overall: r.overall, evidence: p(r.evidence, {}), comment: r.comment, createdAt: r.created_at})),

    auditLog: (companyId, limit = 100) => db.all('SELECT actor_type, actor_id, action, target_type, target_id, detail, created_at FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?', companyId, limit)
      .map(r => ({actorType: r.actor_type, actorId: r.actor_id, action: r.action, targetType: r.target_type, targetId: r.target_id, detail: p(r.detail, {}), at: r.created_at})),
  };
  return api;
}

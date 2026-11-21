// Orchestrator: turns CEO intent into bounded, audited agent runs.
//   Meeting:   CEO ↔ any employee (one model call, validated output).
//   Planning:  Manager plan → Director reviews escalations → CEO approves plan.
//   Delivery:  Developer (sandbox tools) → PR → QA (independent tests) → rework loop → CEO merge approval.
// Hard limits in code: max steps per run, max rework cycles, per-call + per-run timeouts, retries
// (providers.js), daily per-employee and monthly company budgets, global kill switch.
import {validate} from '../validate.js';
import {PROMPTS, SCHEMAS, JSON_INSTRUCTIONS, untrusted} from './employees.js';
import * as demo from './demo.js';
import {estimateTokens, priceFor, BudgetError, ProviderError} from './providers.js';
import {executeTool, toolDefinitions} from '../tools/registry.js';
import {ensureSandbox, readFile as sbRead} from '../tools/sandbox.js';
import * as G from '../tools/git.js';
import {runTests} from '../tools/test-runner.js';
import {githubEnabled, openPullRequest, mergePullRequest} from '../tools/github.js';

export const LIMITS = Object.freeze({maxReworkCycles: 2, runTimeoutMs: 6 * 60 * 1000, maxEscalationsPerPlan: 3, jsonRepairAttempts: 1});
export class HaltedError extends Error { constructor() { super('Agent execution is halted by the CEO (emergency stop).'); this.halted = true; } }
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const monthStart = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const short = (s, n) => String(s ?? '').slice(0, n);

export function createOrchestrator({repo, providers, config, jobs}) {
  const modeOf = emp => (emp.kind === 'ai' && providers.isLive(emp.provider) ? 'live' : 'demo');
  const guard = (companyId, signal) => {
    if (repo.agentsHalted(companyId)) throw new HaltedError();
    if (signal?.aborted) throw new HaltedError();
  };

  function budgetCheck(companyId, emp, messages, maxTokens) {
    const price = priceFor(emp.provider, emp.model);
    if (!price) throw new ProviderError(`No verified pricing for ${emp.provider}:${emp.model}`, {code: 'unpriced'});
    const est = (estimateTokens(messages) * price.in + maxTokens * price.out) / 1e6;
    const daily = repo.spend(companyId, {employeeId: emp.id, since: dayStart()});
    if (daily + est > emp.dailyBudgetUsd) throw new BudgetError(`Daily budget for ${emp.roleKey} would be exceeded ($${daily.toFixed(4)} spent + ~$${est.toFixed(4)} > $${emp.dailyBudgetUsd}). Raise it in the CEO workspace or wait until tomorrow (UTC).`);
    const monthly = repo.spend(companyId, {since: monthStart()}), cap = Number(repo.setting(companyId, 'monthly_budget_usd', String(config.monthlyBudgetUsd)));
    if (monthly + est > cap) throw new BudgetError(`Monthly company budget would be exceeded ($${monthly.toFixed(4)} + ~$${est.toFixed(4)} > $${cap}).`);
  }

  async function chatMetered(ctx, req) {
    guard(ctx.companyId, ctx.signal);
    budgetCheck(ctx.companyId, ctx.employee, req.messages, req.maxTokens ?? 1500);
    const r = await providers.chat({provider: ctx.employee.provider, model: ctx.employee.model, signal: ctx.signal, ...req});
    repo.recordUsage(ctx.companyId, {employeeId: ctx.employee.id, runId: ctx.runId, provider: ctx.employee.provider, model: ctx.employee.model, ...r.usage, costUsd: r.costUsd});
    repo.addRunStep(ctx.companyId, ctx.runId);
    return r;
  }

  /** LIVE structured call: JSON mode + schema validation, one bounded repair attempt. */
  async function liveJson(ctx, kind, userContent, {thinking = false, maxTokens = 1800} = {}) {
    const messages = [{role: 'system', content: PROMPTS[ctx.employee.roleKey] + '\n\n' + JSON_INSTRUCTIONS[kind]}, ...(ctx.history || []), {role: 'user', content: userContent}];
    for (let attempt = 0; ; attempt++) {
      const r = await chatMetered(ctx, {messages, json: true, maxTokens, thinking});
      try {
        const parsed = JSON.parse(r.message.content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        return validate(SCHEMAS[kind], parsed);
      } catch (e) {
        if (attempt >= LIMITS.jsonRepairAttempts) throw new ProviderError(`Model output failed validation: ${short(e.message, 200)}`, {code: 'invalid_output'});
        messages.push({role: 'assistant', content: short(r.message.content, 4000)}, {role: 'user', content: `Your reply was invalid (${short(e.message, 200)}). Reply again with ONE valid JSON object matching the required shape.`});
      }
    }
  }

  /** Wrap work in an agent_run with employee status, timeout, audit and clear failure states. */
  async function withRun(companyId, emp, {kind, input, projectId, taskId, status, detail, signal}, fn) {
    const mode = modeOf(emp);
    const runId = repo.createRun(companyId, {employeeId: emp.id, projectId, taskId, kind, mode, input});
    repo.setEmployeeStatus(companyId, emp.id, status, detail, runId);
    repo.audit(companyId, 'employee', emp.id, `run.${kind}.start`, 'agent_run', runId, {mode});
    const runSignal = AbortSignal.any([AbortSignal.timeout(LIMITS.runTimeoutMs), ...(signal ? [signal] : [])]);
    const ctx = {companyId, employee: emp, runId, mode, signal: runSignal, repo};
    try {
      guard(companyId, runSignal);
      const output = await fn(ctx);
      repo.finishRun(companyId, runId, {status: 'succeeded', output});
      repo.audit(companyId, 'employee', emp.id, `run.${kind}.succeeded`, 'agent_run', runId, {mode});
      return {runId, mode, output};
    } catch (e) {
      const st = e.halted || e.code === 'cancelled' ? 'cancelled' : e.budget ? 'blocked' : 'failed';
      repo.finishRun(companyId, runId, {status: st, error: e.message});
      repo.setEmployeeStatus(companyId, emp.id, st === 'blocked' ? 'blocked' : 'available', st === 'blocked' ? short(e.message, 200) : '');
      repo.audit(companyId, 'employee', emp.id, `run.${kind}.${st}`, 'agent_run', runId, {error: short(e.message, 300)});
      e.runId = runId; e.runStatus = st;
      throw e;
    }
  }
  const idle = (companyId, emp, status = 'available', detail = '') => repo.setEmployeeStatus(companyId, emp.id, status, detail);

  // ------------------------------------------------------------------ meetings
  async function meeting(companyId, {role, text, channel = 'text', projectId = null}) {
    const emp = repo.employeeByRole(companyId, role);
    if (!emp || emp.kind !== 'ai') throw Object.assign(new Error('Unknown employee'), {status: 404});
    const project = projectId ? repo.project(companyId, projectId) : repo.projects(companyId).find(p => p.status !== 'cancelled' && p.status !== 'completed');
    const res = await withRun(companyId, emp, {kind: 'meeting', input: text, projectId: project?.id, status: 'in_meeting', detail: 'اجتماع مع CEO'}, async ctx => {
      if (ctx.mode === 'demo') return demo.demoMeeting(role, text);
      const recent = repo.meetings(companyId, emp.id, 4).reverse();
      ctx.history = recent.flatMap(m => [{role: 'user', content: untrusted('ceo', m.ceoInput)}, {role: 'assistant', content: JSON.stringify({speech: m.reply})}]);
      const ctxLine = project ? `Active project: ${project.name} — objective: ${project.objective}\n` : 'No active project yet.\n';
      return liveJson(ctx, 'meeting', ctxLine + untrusted('ceo', text), {thinking: role === 'director'});
    });
    const out = res.output;
    let proposedTaskId = null, decisionId = null;
    if (role === 'manager' && out.proposal && project) {
      proposedTaskId = repo.createTask(companyId, project.id, {title: out.proposal.title, description: out.proposal.description, acceptanceCriteria: out.proposal.acceptanceCriteria, assigneeRole: 'developer', status: 'proposed'}).id;
    }
    if (role === 'manager' && out.escalate) {
      decisionId = repo.createDecision(companyId, {projectId: project?.id, title: short('مراجعة تقنية: ' + text, 160), question: `CEO: ${text}\nManager: ${out.speech}\nRationale: ${out.rationale}`, proposedBy: emp.id}).id;
    }
    repo.createMeeting(companyId, {employeeId: emp.id, projectId: project?.id, runId: res.runId, mode: res.mode, ceoInput: text, channel, reply: out.speech, summary: short(out.rationale, 500)});
    idle(companyId, emp);
    return {runId: res.runId, mode: res.mode, output: out, proposedTaskId, decisionId};
  }

  // ------------------------------------------------------------------ planning
  async function reviewDecision(companyId, decisionId, {signal} = {}) {
    const d = repo.decision(companyId, decisionId);
    if (!d || !['pending', 'in_review'].includes(d.status)) throw Object.assign(new Error('Decision is not awaiting review'), {status: 409});
    const dir = repo.employeeByRole(companyId, 'director');
    const res = await withRun(companyId, dir, {kind: 'review', input: d.question || d.title, projectId: d.projectId, status: 'reviewing', detail: 'مراجعة قرار تقني', signal}, async ctx => {
      if (ctx.mode === 'demo') return demo.demoReview();
      return liveJson(ctx, 'review', `Escalated decision from the Project Manager:\n${untrusted('manager', `${d.title}\n${d.question}`)}`, {thinking: true, maxTokens: 2500});
    });
    repo.setDirectorReview(companyId, decisionId, {...res.output, mode: res.mode, runId: res.runId});
    idle(companyId, dir);
    return res;
  }

  async function planProject(companyId, userId, projectId, {signal} = {}) {
    const project = repo.project(companyId, projectId);
    if (!project || !['draft', 'planning'].includes(project.status)) throw Object.assign(new Error('Project cannot be planned in its current state'), {status: 409});
    const mgr = repo.employeeByRole(companyId, 'manager');
    repo.updateProject(companyId, projectId, {status: 'planning'});
    let res;
    try {
      res = await withRun(companyId, mgr, {kind: 'plan', input: project.objective, projectId, status: 'planning', detail: 'إعداد خطة المشروع', signal}, async ctx => {
        if (ctx.mode === 'demo') return validate(SCHEMAS.plan, demo.demoPlan(project));
        return liveJson(ctx, 'plan', `New project from the CEO.\nName: ${untrusted('ceo', project.name)}\nObjective: ${untrusted('ceo', project.objective)}\nDescription: ${untrusted('ceo', project.description)}\nThe sandbox repository is a small dependency-free JavaScript task library (src/tasks.js, node --test).`, {maxTokens: 3000});
      });
    } catch (e) { repo.updateProject(companyId, projectId, {status: 'draft'}); throw e; }
    const plan = res.output;
    for (const t of plan.tasks) repo.createTask(companyId, projectId, {...t, status: 'proposed'});
    const decisions = plan.escalations.slice(0, LIMITS.maxEscalationsPerPlan).map(e => repo.createDecision(companyId, {projectId, title: e.title, question: e.question, proposedBy: mgr.id, status: 'in_review'}));
    repo.updateProject(companyId, projectId, {plan: {summary: plan.summary, challenge: plan.challenge, scope: plan.scope, risks: plan.risks, mode: res.mode, runId: res.runId}});
    repo.audit(companyId, 'employee', mgr.id, 'project.plan.drafted', 'project', projectId, {tasks: plan.tasks.length, escalations: decisions.length});
    for (const d of decisions) { // Manager → Director escalation (bounded, sequential)
      try { await reviewDecision(companyId, d.id, {signal}); } catch (e) { if (e.halted || e.budget) throw e; repo.audit(companyId, 'system', null, 'decision.review.failed', 'decision', d.id, {error: short(e.message, 200)}); }
    }
    repo.updateProject(companyId, projectId, {status: 'awaiting_approval'});
    repo.requestApproval(companyId, {action: 'plan.approve', targetType: 'project', targetId: projectId, requestedBy: mgr.id, summary: plan.summary});
    idle(companyId, mgr, 'awaiting_approval', 'بانتظار اعتماد الخطة من CEO');
    return {plan, mode: res.mode, runId: res.runId};
  }

  function decidePlan(companyId, userId, projectId, approve, reason = '') {
    const appr = repo.pendingApprovalFor(companyId, 'plan.approve', projectId);
    if (!appr) throw Object.assign(new Error('No pending plan approval for this project'), {status: 409});
    repo.decideApproval(companyId, appr.id, userId, approve ? 'approved' : 'rejected', reason);
    for (const t of repo.tasks(companyId, projectId).filter(t => t.status === 'proposed')) repo.setTaskStatus(companyId, t.id, approve ? 'todo' : 'rejected');
    repo.updateProject(companyId, projectId, {status: approve ? 'active' : 'draft'});
    repo.markApproval(companyId, appr.id, approve ? 'executed' : 'rejected');
    idle(companyId, repo.employeeByRole(companyId, 'manager'));
    repo.audit(companyId, 'user', userId, approve ? 'project.plan.approved' : 'project.plan.rejected', 'project', projectId, {reason});
  }

  // ------------------------------------------------------------------ delivery
  const author = emp => ({name: `ATLAS ${emp.name}`, email: `${emp.roleKey}@atlas.local`});
  const makeToolCtx = (ctx, repoDir) => {
    const perms = new Set(repo.permissionsOf(ctx.employee.id));
    return {...ctx, repoDir, has: p => perms.has(p), writes: 0, changed: new Set(), author: author(ctx.employee), submission: null, lastTestRun: null};
  };

  async function scripted(tctx, steps) {
    for (const s of steps) {
      guard(tctx.companyId, tctx.signal);
      const r = await executeTool(tctx, s.tool, s.args);
      repo.addRunStep(tctx.companyId, tctx.runId);
      if (r.status === 'denied' || r.status === 'error') throw new Error(`DEMO step ${s.tool} failed: ${r.result}`);
    }
  }

  async function liveToolLoop(tctx, briefing) {
    const role = tctx.employee.roleKey;
    const messages = [{role: 'system', content: PROMPTS[role]}, {role: 'user', content: briefing}];
    const tools = toolDefinitions(role);
    for (let step = 0; step < tctx.employee.maxSteps; step++) {
      const r = await chatMetered(tctx, {messages, tools, maxTokens: 4000});
      const calls = r.message.toolCalls.filter(c => c.name);
      if (!calls.length) {
        messages.push({role: 'assistant', content: short(r.message.content, 4000) || '(empty)'}, {role: 'user', content: `Continue using the tools. When finished call ${role === 'qa' ? 'submit_qa_report' : 'submit_work'}.`});
        continue;
      }
      messages.push({role: 'assistant', content: r.message.content || null, tool_calls: calls.map(c => ({id: c.id, type: 'function', function: {name: c.name, arguments: c.arguments || '{}'}}))});
      for (const c of calls) {
        let args; try { args = JSON.parse(c.arguments || '{}'); } catch { args = null; }
        const out = args === null ? {status: 'error', result: 'Arguments were not valid JSON.'} : await executeTool(tctx, c.name, args);
        messages.push({role: 'tool', tool_call_id: c.id, content: untrusted(`tool:${c.name}`, short(out.result, 8000))});
      }
      if (tctx.submission) return;
    }
    throw new Error(`Step limit reached (${tctx.employee.maxSteps}) without a submission`);
  }

  async function developerRun(companyId, task, repoDir, branch, attempt, defects, signal) {
    const dev = repo.employeeByRole(companyId, 'developer');
    return withRun(companyId, dev, {kind: 'develop', input: `${task.title} (attempt ${attempt})`, projectId: task.projectId, taskId: task.id, status: 'executing', detail: `تنفيذ: ${short(task.title, 80)}`, signal}, async ctx => {
      await G.checkoutBranch(repoDir, branch, {create: true});
      const tctx = makeToolCtx(ctx, repoDir);
      if (ctx.mode === 'demo') await scripted(tctx, demo.demoDeveloperSteps(attempt, rel => sbRead(repoDir, rel)));
      else await liveToolLoop(tctx, `Task: ${untrusted('task', task.title)}\nDescription: ${untrusted('task', task.description)}\nAcceptance criteria:\n${untrusted('task', task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n'))}\n` +
        (defects.length ? `QA rejected the previous attempt. Defects to fix:\n${untrusted('qa', defects.map(d => `- [${d.severity}] ${d.title}: ${d.detail || ''}`).join('\n'))}\n` : '') + `You are on branch ${branch}.`);
      if (!tctx.submission) throw new Error('Developer did not submit work');
      return {summary: tctx.submission.summary, commitSha: tctx.submission.sha, changedFiles: [...tctx.changed], ownTestRun: tctx.lastTestRun ? {passed: tctx.lastTestRun.passed, counts: tctx.lastTestRun.counts} : null, attempt, label: ctx.mode === 'demo' ? demo.DEMO_LABEL : 'LIVE — model-generated via tool calls'};
    });
  }

  async function qaRun(companyId, task, repoDir, branch, signal) {
    const qa = repo.employeeByRole(companyId, 'qa');
    return withRun(companyId, qa, {kind: 'qa', input: task.title, projectId: task.projectId, taskId: task.id, status: 'reviewing', detail: `اختبار: ${short(task.title, 80)}`, signal}, async ctx => {
      await G.checkoutBranch(repoDir, branch);
      const tctx = makeToolCtx(ctx, repoDir);
      if (ctx.mode === 'demo') {
        await scripted(tctx, demo.demoQaSteps());
        const report = demo.demoQaReport(tctx.lastTestRun);
        await executeTool(tctx, 'submit_qa_report', report);
      } else {
        await liveToolLoop(tctx, `Verify this task independently.\nTask: ${untrusted('task', task.title)}\nDescription: ${untrusted('task', task.description)}\nAcceptance criteria:\n${untrusted('task', task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n'))}\nBranch under test: ${branch}.`);
      }
      if (!tctx.submission) throw new Error('QA did not submit a report');
      // Evidence enforcement: the system re-runs the full suite itself; a "pass" without green tests is overridden.
      const verify = await runTests(repoDir);
      repo.recordTool(companyId, {runId: ctx.runId, employeeId: qa.id, tool: 'system.verify_tests', args: {}, status: verify.timedOut ? 'timeout' : 'ok', summary: `${verify.passed ? 'PASS' : 'FAIL'} ${verify.counts.pass}/${verify.counts.tests}`, durationMs: verify.durationMs});
      const claimed = tctx.submission.verdict;
      const verdict = claimed === 'pass' && verify.passed ? 'pass' : 'fail';
      const defects = [...(tctx.submission.defects || [])];
      if (claimed === 'pass' && !verify.passed) defects.push({title: 'QA claimed pass but the system test run failed', severity: 'critical', detail: verify.failures.join('; ')});
      return {verdict, claimedVerdict: claimed, overridden: verdict !== claimed, summary: tctx.submission.summary, testCases: tctx.submission.testCases, defects,
        systemTestRun: {passed: verify.passed, counts: verify.counts, failures: verify.failures, timedOut: verify.timedOut, output: verify.output.slice(-6000)}, commitSha: tctx.submission.sha,
        label: ctx.mode === 'demo' ? 'DEMO — scripted QA steps; verdict derived from the REAL test run' : 'LIVE — model-run QA; verdict enforced against the real test run'};
    });
  }

  async function executeTask(companyId, userId, taskId, {signal} = {}) {
    let task = repo.task(companyId, taskId);
    if (!task) throw Object.assign(new Error('Task not found'), {status: 404});
    if (task.assigneeRole !== 'developer') throw Object.assign(new Error('Only developer tasks can be executed in the sandbox'), {status: 409});
    if (!['todo', 'rework'].includes(task.status)) throw Object.assign(new Error(`Task status is ${task.status}; it must be approved (todo) or in rework`), {status: 409});
    const project = repo.projectRaw(companyId, task.projectId);
    if (project.status !== 'active') throw Object.assign(new Error('The project plan must be approved by the CEO first'), {status: 409});
    const repoDir = await ensureSandbox(config.sandboxDir, project.id);
    if (!project.sandbox_path) repo.updateProject(companyId, project.id, {sandboxPath: repoDir});
    const branch = `atlas/task-${task.id.slice(0, 8)}`;
    let defects = [];
    const prior = repo.deliverables(companyId, taskId).filter(d => d.kind === 'qa_report').at(-1);
    if (prior) defects = prior.evidence.defects || [];
    repo.setTaskStatus(companyId, taskId, 'in_progress', {started: true});
    const dev = repo.employeeByRole(companyId, 'developer'), qa = repo.employeeByRole(companyId, 'qa');
    try {
      for (;;) {
        task = repo.task(companyId, taskId);
        const attempt = task.reworkCount + 1;
        const d = await developerRun(companyId, task, repoDir, branch, attempt, defects, signal);
        const stat = await G.diffStat(repoDir).catch(() => '');
        repo.createDeliverable(companyId, {taskId, employeeId: dev.id, runId: d.runId, kind: 'code', title: `Attempt ${attempt}: ${short(task.title, 100)}`, summary: d.output.summary, branch, commitSha: d.output.commitSha,
          evidence: {mode: d.mode, label: d.output.label, changedFiles: d.output.changedFiles, diffStat: stat, ownTestRun: d.output.ownTestRun}});
        if (!repo.deliverables(companyId, taskId).some(x => x.kind === 'pull_request')) await openPr(companyId, task, dev, d, repoDir, branch);
        idle(companyId, dev);
        repo.setTaskStatus(companyId, taskId, 'in_qa');
        const q = await qaRun(companyId, task, repoDir, branch, signal);
        repo.createDeliverable(companyId, {taskId, employeeId: qa.id, runId: q.runId, kind: 'qa_report', title: `QA report — attempt ${attempt}: ${q.output.verdict.toUpperCase()}`, summary: q.output.summary, branch, commitSha: q.output.commitSha,
          status: q.output.verdict === 'pass' ? 'accepted' : 'rejected', evidence: {mode: q.mode, ...q.output}});
        idle(companyId, qa);
        if (q.output.verdict === 'pass') {
          repo.setTaskStatus(companyId, taskId, 'awaiting_ceo');
          const pr = repo.deliverables(companyId, taskId).find(x => x.kind === 'pull_request');
          repo.requestApproval(companyId, {action: 'pr.merge', targetType: 'task', targetId: taskId, requestedBy: dev.id, summary: `Merge ${branch} after QA pass`, payload: {deliverableId: pr?.id, branch}});
          idle(companyId, dev, 'awaiting_approval', 'بانتظار موافقة CEO على الدمج');
          return {status: 'awaiting_ceo', attempts: attempt};
        }
        defects = q.output.defects;
        repo.setTaskStatus(companyId, taskId, 'rework', {rework: true});
        repo.audit(companyId, 'employee', qa.id, 'task.rejected_by_qa', 'task', taskId, {attempt, defects: defects.length});
        if (attempt > LIMITS.maxReworkCycles) {
          repo.setTaskStatus(companyId, taskId, 'blocked');
          idle(companyId, repo.employeeByRole(companyId, 'manager'), 'blocked', `المهمة «${short(task.title, 60)}» فشلت ${attempt} مرات — تحتاج قرار CEO`);
          return {status: 'blocked', attempts: attempt};
        }
      }
    } catch (e) {
      const cur = repo.task(companyId, taskId);
      if (['in_progress', 'in_qa'].includes(cur.status)) repo.setTaskStatus(companyId, taskId, e.halted ? 'todo' : 'blocked');
      throw e;
    } finally {
      await G.checkoutBranch(repoDir, 'main').catch(() => {});
    }
  }

  async function openPr(companyId, task, dev, d, repoDir, branch) {
    const body = `Task: ${task.title}\n\nAcceptance criteria:\n${task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}\n\n${d.output.summary}\n\n_${d.output.label}. Opened by the ATLAS Developer employee; merge requires CEO approval._`;
    if (githubEnabled(config.github)) {
      const t0 = Date.now();
      try {
        const pr = await openPullRequest(config.github, repoDir, {branch, title: `[ATLAS] ${short(task.title, 100)}`, body});
        repo.recordTool(companyId, {runId: d.runId, employeeId: dev.id, tool: 'github.open_pr', args: {branch}, status: 'ok', summary: pr.url, durationMs: Date.now() - t0});
        return repo.createDeliverable(companyId, {taskId: task.id, employeeId: dev.id, runId: d.runId, kind: 'pull_request', title: `PR #${pr.number}: ${short(task.title, 100)}`, summary: body, branch, commitSha: d.output.commitSha, prUrl: pr.url, prNumber: pr.number, evidence: {mode: d.mode}});
      } catch (e) {
        repo.recordTool(companyId, {runId: d.runId, employeeId: dev.id, tool: 'github.open_pr', args: {branch}, status: 'error', summary: e.message, durationMs: Date.now() - t0});
        throw e;
      }
    }
    return repo.createDeliverable(companyId, {taskId: task.id, employeeId: dev.id, runId: d.runId, kind: 'pull_request', title: `Local review request: ${short(task.title, 100)}`, summary: body, branch, commitSha: d.output.commitSha, isLocalPr: true,
      evidence: {mode: d.mode, note: 'GitHub sandbox not configured — this is a LOCAL pull request (branch in the local sandbox repository), not a GitHub PR.'}});
  }

  async function decideMerge(companyId, userId, approvalId, approve, reason = '') {
    const appr = repo.approval(companyId, approvalId);
    if (!appr || appr.action !== 'pr.merge' || appr.status !== 'pending') throw Object.assign(new Error('Merge approval is not pending'), {status: 409});
    const task = repo.task(companyId, appr.targetId);
    repo.decideApproval(companyId, approvalId, userId, approve ? 'approved' : 'rejected', reason);
    const dev = repo.employeeByRole(companyId, 'developer');
    if (!approve) {
      repo.setTaskStatus(companyId, task.id, 'rework', {rework: true});
      repo.createDeliverable(companyId, {taskId: task.id, employeeId: dev.id, kind: 'review', title: 'CEO review: changes requested', summary: reason || 'CEO rejected the merge.', status: 'rejected', evidence: {defects: [{title: reason || 'CEO requested changes', severity: 'major', detail: 'CEO review'}]}});
      repo.markApproval(companyId, approvalId, 'rejected');
      idle(companyId, dev);
      return {status: 'rework'};
    }
    const pr = repo.deliverables(companyId, task.id).find(x => x.kind === 'pull_request');
    const repoDir = await ensureSandbox(config.sandboxDir, task.projectId);
    try {
      let mergedSha;
      if (pr && !pr.isLocalPr && pr.prNumber) { const r = await mergePullRequest(config.github, pr.prNumber); mergedSha = r.sha; }
      else {
        await G.checkoutBranch(repoDir, 'main');
        await G.git(repoDir, ['merge', '--no-ff', '-q', '-m', `Merge ${pr?.branch} (approved by CEO)`, pr?.branch], {author: {name: 'ATLAS CEO approval', email: 'ceo@atlas.local'}});
        mergedSha = await G.headSha(repoDir);
      }
      repo.markApproval(companyId, approvalId, 'executed');
      if (pr) repo.setDeliverableStatus(companyId, pr.id, 'merged');
      repo.setTaskStatus(companyId, task.id, 'done', {completed: true});
      repo.audit(companyId, 'user', userId, 'pr.merged', 'task', task.id, {sha: mergedSha, local: pr?.isLocalPr});
      systemEvaluations(companyId, task.id);
      idle(companyId, dev, 'completed', `أُنجزت: ${short(task.title, 60)}`);
      const project = repo.projectRaw(companyId, task.projectId);
      if (repo.tasks(companyId, project.id).every(t => ['done', 'rejected'].includes(t.status) || t.assigneeRole !== 'developer')) repo.updateProject(companyId, project.id, {status: 'completed'});
      return {status: 'done', mergedSha};
    } catch (e) {
      repo.markApproval(companyId, approvalId, 'failed');
      repo.audit(companyId, 'system', null, 'pr.merge.failed', 'task', task.id, {error: short(e.message, 300)});
      throw e;
    }
  }

  /** Evidence-based scores (0–5) computed by the system — employees cannot write these. */
  function systemEvaluations(companyId, taskId) {
    const task = repo.task(companyId, taskId);
    const dels = repo.deliverables(companyId, taskId);
    const qaReports = dels.filter(d => d.kind === 'qa_report');
    const runs = repo.runs(companyId, 500).filter(r => r.taskId === taskId);
    const hours = task.startedAt && task.completedAt ? (Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 36e5 : null;
    for (const role of ['developer', 'qa']) {
      const emp = repo.employeeByRole(companyId, role);
      const mine = runs.filter(r => r.employeeId === emp.id);
      const cost = mine.reduce((a, r) => a + r.costUsd, 0);
      const failedRuns = mine.filter(r => r.status === 'failed').length;
      const last = qaReports.at(-1)?.evidence || {};
      const scores = role === 'developer' ? {
        tests: last.systemTestRun?.passed ? 5 : 0,
        compliance: last.verdict === 'pass' ? 5 : 1,
        rework: Math.max(0, 5 - 2 * task.reworkCount),
        reliability: Math.max(0, 5 - 2 * failedRuns),
        cost: cost === 0 ? 5 : cost < 0.05 ? 4 : cost < 0.2 ? 3 : 1,
      } : {
        defectDetection: qaReports.some(r => r.evidence.verdict === 'fail') && qaReports.at(-1)?.evidence.verdict === 'pass' ? 5 : qaReports.length ? 4 : 0,
        honesty: qaReports.some(r => r.evidence.overridden) ? 0 : 5,
        reliability: Math.max(0, 5 - 2 * failedRuns),
        cost: cost === 0 ? 5 : cost < 0.05 ? 4 : cost < 0.2 ? 3 : 1,
      };
      const vals = Object.values(scores);
      repo.addEvaluation(companyId, {employeeId: emp.id, taskId, evaluator: 'system', scores, overall: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100,
        evidence: {reworkCount: task.reworkCount, qaReports: qaReports.length, costUsd: Math.round(cost * 1e6) / 1e6, completionHours: hours && Math.round(hours * 100) / 100, failedRuns}, comment: 'Computed from recorded evidence (tests, QA reports, runs, usage).'});
    }
  }

  // Background wrappers: long jobs run through the job queue so the CEO can stop them.
  return {
    modeOf, meeting, reviewDecision, decidePlan, decideMerge, systemEvaluations,
    planProject: (companyId, userId, projectId) => jobs.enqueue(companyId, {kind: 'plan', label: 'Project planning', targetId: projectId}, signal => planProject(companyId, userId, projectId, {signal})),
    executeTask: (companyId, userId, taskId) => jobs.enqueue(companyId, {kind: 'execute', label: 'Develop + QA', targetId: taskId}, signal => executeTask(companyId, userId, taskId, {signal})),
    reviewDecisionJob: (companyId, decisionId) => jobs.enqueue(companyId, {kind: 'review', label: 'Director review', targetId: decisionId}, signal => reviewDecision(companyId, decisionId, {signal})),
  };
}

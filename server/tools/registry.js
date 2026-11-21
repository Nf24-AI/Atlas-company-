// Tool registry for AI employees. A tool runs only if (1) it is in the employee role's allowlist
// AND (2) the employee currently holds the tool's permission in the database. Both checks are
// code, so a prompt-injected model cannot talk its way into a tool. Every call is recorded.
import {validate, S} from '../validate.js';
import * as sb from './sandbox.js';
import * as G from './git.js';
import {runTests} from './test-runner.js';

const str = (max, extra) => S.str(max, extra);
export const TOOLS = {
  list_files: {permission: 'sandbox.read', description: 'List files in the sandbox repository.', params: {type: 'object', props: {}},
    run: ctx => { const files = sb.listFiles(ctx.repoDir); return {result: files.join('\n'), summary: `${files.length} files`}; }},
  read_file: {permission: 'sandbox.read', description: 'Read a text file from the sandbox repository.', params: {type: 'object', props: {path: str(200)}},
    run: (ctx, a) => { const text = sb.readFile(ctx.repoDir, a.path); return {result: text, summary: `read ${a.path} (${text.length} chars)`}; }},
  write_file: {permission: ctx => (ctx.has('sandbox.write.src') ? 'sandbox.write.src' : 'sandbox.write.qa'),
    description: 'Create or overwrite a file. Developer: src/, test/ (not test/qa/), README.md. QA: test/qa/ only.',
    params: {type: 'object', props: {path: str(200), content: {type: 'string', max: sb.LIMITS.maxFileBytes, trim: false}}},
    run: (ctx, a, scope) => {
      if (++ctx.writes > sb.LIMITS.maxWritesPerRun) throw new sb.PolicyError('write limit reached for this run');
      const rel = sb.writeFile(ctx.repoDir, a.path, a.content, scope); ctx.changed.add(rel);
      return {result: `wrote ${rel}`, summary: `wrote ${rel} (${a.content.length} chars)`};
    }},
  run_tests: {permission: 'tests.run', description: 'Run the full automated test suite (node --test) in the sandbox. Returns pass/fail counts and failures.', params: {type: 'object', props: {}},
    run: async ctx => {
      const r = await runTests(ctx.repoDir); ctx.lastTestRun = r;
      return {result: JSON.stringify({passed: r.passed, counts: r.counts, failures: r.failures, timedOut: r.timedOut, output: r.output.slice(-3000)}), summary: `${r.passed ? 'PASS' : 'FAIL'} ${r.counts.pass}/${r.counts.tests}`, status: r.timedOut ? 'timeout' : 'ok'};
    }},
  show_diff: {permission: 'sandbox.read', description: 'Show the diff of the current branch against main.', params: {type: 'object', props: {}},
    run: async ctx => { const d = await G.diff(ctx.repoDir); return {result: d || '(no changes)', summary: `diff ${d.length} chars`}; }},
  submit_work: {permission: 'git.branch_commit', description: 'Commit all changes on the feature branch and submit the work for QA. Call once when done.',
    params: {type: 'object', props: {summary: str(1500, {min: 5}), commitMessage: str(120, {min: 5})}}, final: true,
    run: async (ctx, a) => {
      const sha = await G.commitAll(ctx.repoDir, a.commitMessage, ctx.author);
      ctx.submission = {...a, sha};
      return {result: sha ? `committed ${sha}` : 'nothing to commit', summary: sha ? `commit ${sha.slice(0, 8)}` : 'no changes'};
    }},
  submit_qa_report: {permission: 'qa.report', description: 'Submit the QA verdict with test cases and defects. Call once when done.', final: true,
    params: {type: 'object', props: {
      verdict: {type: 'string', enum: ['pass', 'fail']}, summary: str(1500, {min: 5}),
      testCases: {type: 'array', max: 30, truncate: true, items: {type: 'object', props: {name: str(200), criterion: str(300, {optional: true}), result: {type: 'string', enum: ['pass', 'fail', 'not_run']}}}},
      defects: {type: 'array', max: 20, truncate: true, items: {type: 'object', props: {title: str(200), severity: {type: 'string', enum: ['critical', 'major', 'minor', 'trivial']}, detail: str(1000, {optional: true})}}},
    }},
    run: async (ctx, a) => {
      const sha = await G.commitAll(ctx.repoDir, 'test(qa): QA test cases', ctx.author);
      ctx.submission = {...a, sha};
      return {result: 'report received', summary: `verdict ${a.verdict}, ${a.defects.length} defects`};
    }},
};

export const ROLE_TOOLS = Object.freeze({
  developer: ['list_files', 'read_file', 'write_file', 'run_tests', 'show_diff', 'submit_work'],
  qa: ['list_files', 'read_file', 'write_file', 'run_tests', 'show_diff', 'submit_qa_report'],
  manager: [], director: [], ceo: [],
});

/** JSON-schema tool definitions for OpenAI-compatible function calling. */
export function toolDefinitions(role) {
  const toJson = s => s.type === 'object' ? {type: 'object', properties: Object.fromEntries(Object.entries(s.props).map(([k, v]) => [k, toJson(v)])), required: Object.entries(s.props).filter(([, v]) => !v.optional).map(([k]) => k)}
    : s.type === 'array' ? {type: 'array', items: toJson(s.items)} : {type: s.type === 'integer' ? 'integer' : s.type, ...(s.enum ? {enum: s.enum} : {})};
  return ROLE_TOOLS[role].map(name => ({type: 'function', function: {name, description: TOOLS[name].description, parameters: toJson(TOOLS[name].params)}}));
}

/**
 * Execute one tool call for an employee, enforcing allowlist + permission, validating args,
 * recording the execution. Never throws for policy problems: returns {status:'denied'|'error'}.
 */
export async function executeTool(ctx, name, rawArgs) {
  const started = Date.now();
  const record = (status, summary, args) => ctx.repo.recordTool(ctx.companyId, {runId: ctx.runId, employeeId: ctx.employee.id, tool: String(name).slice(0, 60), args: args ?? {}, status, summary, durationMs: Date.now() - started});
  const tool = TOOLS[name];
  if (!tool || !ROLE_TOOLS[ctx.employee.roleKey]?.includes(name)) {
    record('denied', 'tool not in role allowlist', rawArgs);
    return {status: 'denied', result: `Tool "${name}" is not available to the ${ctx.employee.roleKey} role.`};
  }
  const perm = typeof tool.permission === 'function' ? tool.permission(ctx) : tool.permission;
  if (!ctx.has(perm)) {
    record('denied', `missing permission ${perm}`, rawArgs);
    return {status: 'denied', result: `Permission "${perm}" is not granted to this employee.`};
  }
  let args;
  try { args = validate(tool.params, rawArgs ?? {}); } catch (e) { record('error', 'invalid arguments: ' + e.message, rawArgs); return {status: 'error', result: 'Invalid arguments: ' + e.message}; }
  try {
    const out = await tool.run(ctx, args, perm);
    const logArgs = name === 'write_file' ? {path: args.path, bytes: args.content.length} : args;
    record(out.status || 'ok', out.summary, logArgs);
    return {status: out.status || 'ok', result: out.result, final: Boolean(tool.final)};
  } catch (e) {
    const status = e.policy ? 'denied' : 'error';
    record(status, e.message, name === 'write_file' ? {path: args.path} : args);
    return {status, result: `${status === 'denied' ? 'Denied' : 'Error'}: ${e.message}`};
  }
}

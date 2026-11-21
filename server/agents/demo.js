// DEMO mode content for each workflow step. Used ONLY when the employee's provider has no API key.
// Everything here is scripted text/code written in advance by the ATLAS authors — NOT generated
// by AI. The orchestrator labels every DEMO run and deliverable accordingly. Tool executions
// (writing files, running tests, git commits) are still REAL actions in the sandbox.
import {demoReply, demoPlan, demoReview} from '../../public/js/shared/demo-scripts.js';

export const DEMO_LABEL = 'DEMO — scripted content, not AI-generated';

export function demoMeeting(role, input) {
  const r = demoReply(role === 'director' ? 'director' : 'manager', input);
  const base = {speech: r.speech, verdict: r.verdict, rationale: r.rationale, escalate: Boolean(r.escalate)};
  if (role === 'developer') return {speech: 'أنا جاهز للعمل داخل مستودع الـsandbox فقط. أعطني مهمة معتمدة من مدير المشاريع وسأنفذها وأرفع Pull Request.', verdict: 'clarify', rationale: DEMO_LABEL, escalate: false};
  if (role === 'qa') return {speech: 'لن أعتمد أي تسليم دون تشغيل الاختبارات بنفسي وكتابة حالات اختبار لكل معيار قبول.', verdict: 'clarify', rationale: DEMO_LABEL, escalate: false};
  if (r.proposal?.type === 'task') base.proposal = {title: r.proposal.title, description: r.proposal.description, acceptanceCriteria: [r.proposal.acceptanceCriteria]};
  return base;
}

export {demoPlan, demoReview};

// --- Scripted developer patches. Attempt 1 deliberately contains a defect (completed tasks are
// not excluded) so the DEMO shows QA rejecting work and rework. Attempt 2 fixes it.
const IMPL_V1 = `
/** Open-or-not tasks whose due date is before \`now\`. */
export function overdueTasks(tasks, now = new Date().toISOString()) {
  const t = Date.parse(now);
  return tasks.filter(task => task.due !== null && Date.parse(task.due) < t);
}
`;
const IMPL_V2 = `
/** Open tasks whose due date is strictly before \`now\`. Completed and undated tasks are excluded. */
export function overdueTasks(tasks, now = new Date().toISOString()) {
  const t = Date.parse(now);
  return tasks.filter(task => !task.completedAt && task.due !== null && Date.parse(task.due) < t);
}
`;
const DEV_TEST = `import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask, overdueTasks} from '../src/tasks.js';

test('overdueTasks returns tasks due before now', () => {
  const late = createTask('late', {due: '2026-01-01T00:00:00Z'});
  const future = createTask('future', {due: '2999-01-01T00:00:00Z'});
  assert.deepEqual(overdueTasks([late, future], '2026-06-01T00:00:00Z').map(t => t.title), ['late']);
});

test('overdueTasks ignores tasks without a due date', () => {
  assert.deepEqual(overdueTasks([createTask('nodate')], '2026-06-01T00:00:00Z'), []);
});
`;
export function demoDeveloperSteps(attempt, read) {
  const base = read('src/tasks.js').replace(/\n\/\*\* (Open-or-not|Open tasks)[\s\S]*$/, '\n').trimEnd() + '\n';
  const impl = attempt === 1 ? IMPL_V1 : IMPL_V2;
  const readme = read('README.md').includes('overdueTasks') ? null : read('README.md').trimEnd() + '\n- `overdueTasks(tasks, now)` — open tasks whose due date is before `now`.\n';
  return [
    {tool: 'list_files', args: {}},
    {tool: 'read_file', args: {path: 'src/tasks.js'}},
    {tool: 'write_file', args: {path: 'src/tasks.js', content: base + impl}},
    ...(attempt === 1 ? [{tool: 'write_file', args: {path: 'test/overdue.test.js', content: DEV_TEST}}] : []),
    ...(readme ? [{tool: 'write_file', args: {path: 'README.md', content: readme}}] : []),
    {tool: 'run_tests', args: {}},
    {tool: 'submit_work', args: {summary: attempt === 1 ? 'أضفت overdueTasks مع اختبارات وحدة وتوثيق. (DEMO: كود مكتوب مسبقًا يتضمن خللًا متعمدًا لعرض دورة الرفض)' : 'أصلحت استبعاد المهام المكتملة في overdueTasks بناءً على تقرير QA. (DEMO: كود مكتوب مسبقًا)',
      commitMessage: attempt === 1 ? 'feat: add overdueTasks filter' : 'fix: exclude completed tasks from overdueTasks'}},
  ];
}

const QA_TEST = `import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask, completeTask, overdueTasks} from '../../src/tasks.js';

const NOW = '2026-06-01T00:00:00Z';

test('QA-1 open task due before now is overdue', () => {
  assert.equal(overdueTasks([createTask('a', {due: '2026-05-01T00:00:00Z'})], NOW).length, 1);
});
test('QA-2 completed task is never overdue', () => {
  const done = completeTask(createTask('b', {due: '2026-05-01T00:00:00Z'}), '2026-05-02T00:00:00Z');
  assert.deepEqual(overdueTasks([done], NOW), []);
});
test('QA-3 task without due date is not overdue', () => {
  assert.deepEqual(overdueTasks([createTask('c')], NOW), []);
});
test('QA-4 task due exactly now is not overdue (strictly before)', () => {
  assert.deepEqual(overdueTasks([createTask('d', {due: NOW})], NOW), []);
});
`;
export function demoQaSteps() {
  return [
    {tool: 'read_file', args: {path: 'src/tasks.js'}},
    {tool: 'show_diff', args: {}},
    {tool: 'write_file', args: {path: 'test/qa/overdue.qa.test.js', content: QA_TEST}},
    {tool: 'run_tests', args: {}},
  ];
}
/** QA verdict in DEMO is DERIVED from the real test run, never scripted. */
export function demoQaReport(testRun) {
  const failed = testRun?.failures || [];
  const pass = Boolean(testRun?.passed);
  const crit = ['يُرجع المهام المفتوحة المتأخرة', 'يستبعد المهام المكتملة', 'يستبعد المهام بلا تاريخ', 'جميع الاختبارات تنجح'];
  return {
    verdict: pass ? 'pass' : 'fail',
    summary: pass ? `نجحت جميع الاختبارات (${testRun.counts.pass}/${testRun.counts.tests}) وكل معيار قبول مغطى باختبار.` : `فشل ${testRun?.counts?.fail ?? '?'} من ${testRun?.counts?.tests ?? '?'} اختبارات. التسليم مرفوض ويعود للتطوير.`,
    testCases: [['QA-1', crit[0]], ['QA-2', crit[1]], ['QA-3', crit[2]], ['QA-4', 'حد: الاستحقاق في نفس اللحظة']].map(([n, c]) => ({name: n, criterion: c, result: failed.some(f => f.startsWith(n)) ? 'fail' : (testRun ? 'pass' : 'not_run')})),
    defects: failed.map(f => ({title: f, severity: /QA-2|QA-1/.test(f) ? 'major' : 'minor', detail: 'اختبار QA فشل عند التشغيل الفعلي في الـsandbox.'})),
  };
}

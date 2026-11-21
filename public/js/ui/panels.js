// In-game panels opened from the 3D office: employee offices (meeting + role work), meeting room,
// operations center and the CEO workspace. Rendering is driven by the store snapshot; actions call
// the API and refresh. Every piece of model output is escaped (untrusted).
import {api} from '../net/api-client.js';
import {createVoice} from '../voice/voice.js';
import {$, esc, fmtTime, usd, toast, safeLink} from './dom.js';
import {t, L, getLang} from './i18n.js';

const ROLE_INFO = {
  manager: {ar: 'مدير المشاريع التقنية', en: 'Technical Project Manager', color: '#2d7168'},
  director: {ar: 'المدير التقني', en: 'Technical Director', color: '#80613b'},
  developer: {ar: 'مطوّر البرمجيات', en: 'Software Developer', color: '#3a4f7a'},
  qa: {ar: 'مهندس ضمان الجودة', en: 'QA Engineer', color: '#7a4a62'},
};
const CONSENT_KEY = 'atlas-voice-consent-v1';
const consented = () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch { return false; } };
const modeTag = mode => `<span class="tag ${mode === 'live' ? 'live' : 'demo'}">${esc(mode === 'live' ? t('live') : t('demo'))}</span>`;
const statusChip = s => `<span class="chip st-${esc(s)}">${esc(t('status.' + s) || s)}</span>`;
const taskChip = s => `<span class="chip ts-${esc(s)}">${esc(t('task.' + s))}</span>`;
const list = (arr, cls = '') => (arr?.length ? `<ul class="${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const empty = msg => `<div class="feed-empty">${esc(msg)}</div>`;

export function createPanels({store, offices, onClose}) {
  let current = null, wsTab = 'overview', taskView = null, busy = false;
  const voice = createVoice({
    onListening: on => { $('voiceOrb')?.classList.toggle('listening', on); if (on && $('voiceState')) $('voiceState').textContent = t('listening'); },
    onSpeaking: on => { $('voiceOrb')?.classList.toggle('speaking', on); },
    onResult: text => { if ($('utterance')) { $('utterance').value = text; sendMeeting('voice'); } },
    onError: err => { toast('تعذر التعرف على الصوت: ' + err); if ($('voiceState')) $('voiceState').textContent = t('textFallback'); },
  });
  const isOpen = () => !$('overlay').hidden;
  const d = () => store.data;
  const emp = role => store.employee(role);

  function open(target) {
    current = target; taskView = null;
    $('overlay').hidden = false; document.body.classList.add('overlay-open');
    const o = offices[target];
    $('panelKicker').textContent = (o?.label || target).toUpperCase();
    $('panelTitle').textContent = L(o?.arabic, o?.en);
    if (ROLE_INFO[target]) renderEmployeeShell(target);
    else render();
    $('closePanel').focus();
  }
  function close() { if (!isOpen()) return; voice.stop(); $('overlay').hidden = true; document.body.classList.remove('overlay-open'); current = null; onClose?.(); }
  $('closePanel').onclick = close;
  $('overlay').addEventListener('click', e => { if (e.target === $('overlay')) close(); });

  // Re-render dynamic parts on every snapshot, without clobbering text the CEO is typing.
  store.subscribe(() => { if (isOpen()) render(); });
  function render() {
    if (!current || !d()) return;
    if (ROLE_INFO[current]) return renderEmployeeDynamic(current);
    const body = $('panelBody');
    if (body.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    $('panelSubtitle').textContent = '';
    const html = current === 'ceo' ? workspace() : current === 'meeting' ? meetingRoom() : operations();
    if (html !== body.__last) { body.innerHTML = html; body.__last = html; } // skip no-op re-renders (keeps focus/hover stable)
  }

  // ------------------------------------------------------------------ employee office
  function renderEmployeeShell(role) {
    const e = emp(role);
    $('panelSubtitle').textContent = L(ROLE_INFO[role].ar, ROLE_INFO[role].en);
    $("panelBody").__last = null;
    $('panelBody').innerHTML = `<div id="empHeader"></div>
      <div class="section-header"><h3>${L('اجتماع مباشر', 'Live meeting')}</h3><span class="status-light" id="speechSupport">${voice.canListen ? 'VOICE' : 'TEXT'}</span></div>
      <div class="meeting-card">
        <div class="voice-stage"><div id="voiceOrb" class="voice-orb"><span>◉</span></div><div><b id="voiceState">${esc(t('ready'))}</b><small>${L('اضغط للتحدث (Push-to-talk) أو اكتب. Esc للإغلاق.', 'Push to talk or type. Esc closes.')}</small></div></div>
        <div class="voice-actions">
          <button id="micBtn" class="btn primary" type="button" ${voice.canListen ? '' : 'disabled'}>◉ ${voice.canListen ? esc(t('speak')) : L('الصوت غير مدعوم في هذا المتصفح', 'Speech not supported here')}</button>
          <button id="stopVoiceBtn" class="btn ghost" type="button">■ ${esc(t('stopVoice'))}</button>
        </div>
        <div id="voiceConsent" class="consent" hidden><p>${L('التعرف الصوتي في Chrome وEdge يرسل الصوت إلى خدمة سحابية تابعة لمزوّد المتصفح لتحويله إلى نص. لا يحفظ ATLAS أي تسجيل صوتي، بل النص فقط، ولا يرسل الصوت لأي مزود ذكاء اصطناعي.', 'In Chrome/Edge, speech recognition sends audio to the browser vendor’s cloud service. ATLAS never stores recordings (text only) and never sends audio to AI providers.')}</p>
          <div class="action-row"><button id="consentYes" class="btn primary small" type="button">${L('أوافق', 'I agree')}</button><button id="consentNo" class="btn ghost small" type="button">${esc(t('textFallback'))}</button></div></div>
        <label for="utterance" class="field-label">${L('نص الاجتماع / بديل صوتي', 'Transcript / text input')}</label>
        <textarea id="utterance" rows="3" maxlength="2200" placeholder="${esc(L('مثال: أريد إضافة فلتر للمهام المتأخرة مع اختبارات كاملة…', 'e.g. Add an overdue-tasks filter with full tests…'))}"></textarea>
        <button id="sendBtn" class="btn action" type="button">${esc(t('send'))} ${esc(e?.name || role)} <span>↗</span></button>
      </div>
      <div id="agentOutcome" class="outcome" hidden></div>
      <div id="roleSection"></div><div id="historySection"></div>`;
    $('micBtn').onclick = () => { if (!voice.canListen) return; if (consented()) return startListening(); $('voiceConsent').hidden = false; };
    $('consentYes').onclick = () => { try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch { /* ignore */ } $('voiceConsent').hidden = true; startListening(); };
    $('consentNo').onclick = () => { $('voiceConsent').hidden = true; $('utterance').focus(); };
    $('stopVoiceBtn').onclick = () => { voice.stop(); $('voiceState').textContent = t('ready'); };
    $('sendBtn').onclick = () => sendMeeting('text');
    renderEmployeeDynamic(role);
  }
  function startListening() { try { voice.listen(); } catch (e) { toast(e.message); } }

  function renderEmployeeDynamic(role) {
    const e = emp(role); if (!e || !$('empHeader')) return;
    $('empHeader').innerHTML = `<div class="employee-hero"><div class="employee-letter" style="background:${ROLE_INFO[role].color}">${esc(offices[role].letter)}</div>
      <div><strong>${esc(e.name)}</strong><small>${esc(e.provider || '')} · <code>${esc(e.model || '')}</code></small>${statusChip(e.status)} ${modeTag(e.mode)}
      ${e.statusDetail ? `<small class="detail">${esc(e.statusDetail)}</small>` : ''}</div></div>
      <details class="perm"><summary>${L('الصلاحيات المفعلة', 'Granted permissions')} (${e.permissions.length})</summary>${list(e.permissions, 'mono')}</details>`;
    const rs = $('roleSection');
    if (!(rs.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
      const html = ({manager: managerSection, director: directorSection, developer: developerSection, qa: qaSection})[role]();
      if (html !== rs.__last) { rs.innerHTML = html; rs.__last = html; }
    }
    const ms = d().meetings.filter(m => m.employeeId === e.id).slice(0, 4);
    $('historySection').innerHTML = `<div class="section-header"><h3>${L('سجل الاجتماعات', 'Meeting history')}</h3><span>${L('محفوظ في قاعدة البيانات', 'Persisted')}</span></div>` +
      (ms.length ? `<div class="feed">${ms.map(m => `<article class="feed-item"><header><b>${L('أنت', 'You')}: ${esc(m.ceoInput.slice(0, 120))}</b>${modeTag(m.mode)}</header><p>${esc(m.reply)}</p><small>${m.channel === 'voice' ? '🎙 ' : ''}${fmtTime(m.createdAt)}</small></article>`).join('')}</div>` : empty(L('لا توجد اجتماعات بعد.', 'No meetings yet.')));
  }

  async function sendMeeting(channel) {
    const role = current, text = $('utterance')?.value.trim();
    if (!text || text.length < 3) { toast(L('تحدث أو اكتب طلبًا أولًا', 'Say or type a request first')); return; }
    if (busy) return; busy = true; $('sendBtn').disabled = true; $('voiceState').textContent = t('thinking');
    try {
      const r = await api('/api/meetings', {role, text, channel, projectId: store.activeProject()?.id});
      const o = r.output, panel = $('agentOutcome'); panel.hidden = false;
      const verdict = {approve: L('موافقة', 'Agrees'), challenge: L('اعتراض مهني', 'Challenges'), clarify: L('يطلب توضيحًا', 'Needs clarification')}[o.verdict] || '';
      panel.innerHTML = `${modeTag(r.mode)} <span class="tag ${o.verdict === 'challenge' ? 'warning' : ''}">${esc(verdict)}</span><p>${esc(o.speech)}</p>${o.rationale ? `<p class="rationale">${esc(o.rationale)}</p>` : ''}
        <div class="action-row">${r.proposedTaskId ? `<span class="tag">${L('أُضيفت مهمة مقترحة — تحتاج موافقتك', 'Proposed task added — needs your approval')}</span><button class="btn small primary" data-act="approve-task" data-id="${esc(r.proposedTaskId)}">${L('اعتماد المهمة', 'Approve task')}</button>` : ''}
        ${r.decisionId ? `<button class="btn small" data-act="review" data-id="${esc(r.decisionId)}">${L('إحالة إلى المدير التقني ↗', 'Escalate to Director ↗')}</button>` : ''}</div>`;
      $('voiceState').textContent = t('ready'); $('utterance').value = '';
      voice.speak(o.speech);
      await store.refresh();
    } catch (e) { toast(e.message); $('voiceState').textContent = t('ready'); }
    finally { busy = false; if ($('sendBtn')) $('sendBtn').disabled = false; }
  }

  function projectCard(p) {
    if (!p) return '';
    const tasks = d().tasks.filter(x => x.projectId === p.id);
    const plan = p.plan;
    return `<article class="feed-item project"><header><b>${esc(p.name)}</b><span class="chip">${esc(t('project.' + p.status))}</span></header>
      <p>${esc(p.objective)}</p>
      ${plan ? `${modeTag(plan.mode)}<p><strong>${L('الخطة', 'Plan')}:</strong> ${esc(plan.summary)}</p>${plan.challenge ? `<p class="warn">⚠ ${esc(plan.challenge)}</p>` : ''}
        <div class="two-col"><div><small>${L('ضمن النطاق', 'In scope')}</small>${list(plan.scope?.in)}</div><div><small>${L('خارج النطاق', 'Out of scope')}</small>${list(plan.scope?.out)}</div></div>
        ${plan.risks?.length ? `<small>${L('المخاطر', 'Risks')}</small>${list(plan.risks)}` : ''}` : ''}
      ${tasks.length ? `<div class="task-mini">${tasks.map(x => `<div>${taskChip(x.status)} <b>${esc(x.title)}</b> <small>→ ${esc(x.assigneeRole)}</small>${list(x.acceptanceCriteria, 'criteria')}</div>`).join('')}</div>` : ''}
      <footer>${p.status === 'draft' ? `<button class="btn primary small" data-act="plan" data-id="${esc(p.id)}">${L('اطلب من المدير إعداد الخطة', 'Ask the Manager to plan')}</button>` : ''}
      ${p.status === 'awaiting_approval' ? `<button class="btn primary small" data-act="approve-plan" data-id="${esc(p.id)}">${L('اعتماد الخطة (CEO)', 'Approve plan (CEO)')}</button><button class="btn small" data-act="reject-plan" data-id="${esc(p.id)}">${L('رفض', 'Reject')}</button>` : ''}
      ${p.status === 'planning' ? `<span class="tag">${L('المدير يعمل على الخطة…', 'Manager is planning…')}</span>` : ''}</footer></article>`;
  }

  function managerSection() {
    const p = store.activeProject(), activeOpen = p && !['completed', 'cancelled'].includes(p.status);
    return `<div class="section-header"><h3>${L('المشروع', 'Project')}</h3><span>${L('مشروع واحد في كل مرة', 'One project at a time')}</span></div>
      ${activeOpen ? projectCard(p) : `<form class="form-card" data-form="project">
        <label>${L('اسم المشروع', 'Project name')}<input name="name" required minlength="3" maxlength="120" placeholder="${esc(L('مثال: فلتر المهام المتأخرة', 'e.g. Overdue tasks filter'))}"></label>
        <label>${L('الهدف', 'Objective')}<textarea name="objective" rows="2" required minlength="10" maxlength="2000" placeholder="${esc(L('ماذا تريد أن يتحقق؟', 'What should be achieved?'))}"></textarea></label>
        <button class="btn primary small" type="submit">${L('إسناد المشروع للمدير', 'Assign project to the Manager')}</button></form>${p ? projectCard(p) : ''}`}`;
  }
  function decisionCard(x) {
    const r = x.directorReview;
    return `<article class="feed-item"><header><b>${esc(x.title)}</b><span class="chip">${esc(x.status)}</span></header>${x.question ? `<p class="muted">${esc(x.question.slice(0, 400))}</p>` : ''}
      ${r ? `${modeTag(r.mode)} <span class="tag ${r.verdict === 'approve' ? '' : 'warning'}">${esc(r.verdict)}</span><p>${esc(r.summary)}</p>${r.recommendation ? `<p><strong>${L('التوصية', 'Recommendation')}:</strong> ${esc(r.recommendation)}</p>` : ''}
        ${r.risks?.length ? `<small>${L('المخاطر', 'Risks')}</small>${list(r.risks)}` : ''}${r.evidence?.length ? `<small>${L('الأدلة', 'Evidence')}</small>${list(r.evidence)}` : ''}${r.alternatives?.length ? `<small>${L('البدائل', 'Alternatives')}</small>${list(r.alternatives)}` : ''}` : ''}
      <footer>${['pending', 'in_review'].includes(x.status) && !r ? `<button class="btn small" data-act="review" data-id="${esc(x.id)}">${L('اطلب مراجعة المدير التقني', 'Request Director review')}</button>` : ''}
      ${!['approved', 'rejected'].includes(x.status) ? `<button class="btn primary small" data-act="decide" data-approve="1" data-id="${esc(x.id)}">${L('اعتماد القرار', 'Approve decision')}</button><button class="btn small" data-act="decide" data-approve="0" data-id="${esc(x.id)}">${L('رفض', 'Reject')}</button>` : ''}</footer></article>`;
  }
  function directorSection() {
    const ds = d().decisions;
    return `<div class="section-header"><h3>${L('القرارات التقنية', 'Technical decisions')}</h3><span>${ds.filter(x => !['approved', 'rejected'].includes(x.status)).length} ${L('مفتوحة', 'open')}</span></div>
      ${ds.length ? `<div class="feed">${ds.slice(0, 8).map(decisionCard).join('')}</div>` : empty(L('لا توجد قرارات مُصعّدة. المدير يصعّد القرارات المهمة أثناء التخطيط.', 'No escalations yet. The Manager escalates important decisions while planning.'))}`;
  }
  function developerSection() {
    const tasks = d().tasks.filter(x => x.assigneeRole === 'developer' && !['proposed', 'rejected'].includes(x.status));
    return `<div class="section-header"><h3>${L('مهام التطوير', 'Development tasks')}</h3><span>${L('داخل sandbox معزول', 'Isolated sandbox')}</span></div>
      ${tasks.length ? `<div class="feed">${tasks.map(x => `<article class="feed-item"><header><b>${esc(x.title)}</b>${taskChip(x.status)}</header>${list(x.acceptanceCriteria, 'criteria')}
        <footer>${['todo', 'rework'].includes(x.status) ? `<button class="btn primary small" data-act="execute" data-id="${esc(x.id)}">${x.status === 'rework' ? L('إعادة التنفيذ بعد رفض QA', 'Re-run after QA rejection') : L('تنفيذ المهمة في الـsandbox', 'Execute in sandbox')}</button>` : ''}
        <button class="btn small ghost" data-act="task" data-id="${esc(x.id)}">${L('الأدلة والتفاصيل', 'Evidence & details')}</button>${x.reworkCount ? `<small>${L('مرات إعادة العمل', 'Rework')}: ${x.reworkCount}</small>` : ''}</footer></article>`).join('')}</div>`
        : empty(L('لا توجد مهام معتمدة للتطوير. اعتمد خطة المدير أولًا.', 'No approved development tasks. Approve the Manager’s plan first.'))}`;
  }
  function qaReportCard(r) {
    const ev = r.evidence || {};
    return `<article class="feed-item"><header><b>${esc(r.title)}</b><span class="tag ${ev.verdict === 'pass' ? '' : 'warning'}">${esc((ev.verdict || '').toUpperCase())}</span></header>
      <small>${esc(ev.label || '')}</small><p>${esc(r.summary)}</p>
      ${ev.systemTestRun ? `<p class="mono">${L('تشغيل الاختبارات الفعلي', 'Real test run')}: ${ev.systemTestRun.passed ? 'PASS' : 'FAIL'} ${ev.systemTestRun.counts.pass}/${ev.systemTestRun.counts.tests}</p>` : ''}
      ${ev.overridden ? `<p class="warn">⚠ ${L('ادّعى QA النجاح لكن الاختبارات فشلت — رُفض تلقائيًا', 'QA claimed pass but tests failed — overridden')}</p>` : ''}
      ${ev.testCases?.length ? `<table class="mini"><tbody>${ev.testCases.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.criterion || '')}</td><td class="r-${esc(c.result)}">${esc(c.result)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${ev.defects?.length ? `<small>${L('العيوب', 'Defects')}</small><ul>${ev.defects.map(x => `<li><span class="sev sev-${esc(x.severity)}">${esc(x.severity)}</span> ${esc(x.title)}</li>`).join('')}</ul>` : ''}</article>`;
  }
  function qaSection() {
    const reports = d().deliverables.filter(x => x.kind === 'qa_report').slice(0, 6);
    return `<div class="section-header"><h3>${L('تقارير الجودة', 'QA reports')}</h3><span>${L('الحكم يُفرض وفق تشغيل الاختبارات الحقيقي', 'Verdict enforced by the real test run')}</span></div>${reports.length ? `<div class="feed">${reports.map(qaReportCard).join('')}</div>` : empty(L('لا توجد تقارير بعد.', 'No reports yet.'))}`;
  }

  // ------------------------------------------------------------------ meeting room & operations
  function meetingRoom() {
    const ms = d().meetings, byId = Object.fromEntries(d().employees.map(e => [e.id, e]));
    return `<p class="muted">${L('سجل كل الاجتماعات مع ملخص كل رد. النصوص الصوتية تُحفظ كنص فقط.', 'All meetings with a summary of each reply. Voice is stored as text only.')}</p>
      ${ms.length ? `<div class="feed">${ms.map(m => `<article class="feed-item"><header><b>${esc(byId[m.employeeId]?.name || '')}</b>${modeTag(m.mode)}</header><p><strong>CEO:</strong> ${esc(m.ceoInput)}</p><p>${esc(m.reply)}</p>${m.summary ? `<p class="rationale">${L('ملخص', 'Summary')}: ${esc(m.summary)}</p>` : ''}<small>${m.channel === 'voice' ? '🎙 ' : '⌨ '}${fmtTime(m.createdAt)}</small></article>`).join('')}</div>` : empty(L('لا توجد اجتماعات بعد.', 'No meetings yet.'))}`;
  }
  const COLS = [['proposed'], ['todo'], ['in_progress', 'in_qa'], ['rework', 'blocked'], ['awaiting_ceo'], ['done']];
  function kanban() {
    const tasks = d().tasks;
    return `<div class="kanban">${COLS.map(c => `<div class="kcol"><h4>${esc(c.map(s => t('task.' + s)).join(' / '))} <span>${tasks.filter(x => c.includes(x.status)).length}</span></h4>
      ${tasks.filter(x => c.includes(x.status)).map(x => `<button class="kcard" data-act="task" data-id="${esc(x.id)}"><b>${esc(x.title)}</b><small>${esc(x.assigneeRole)}${x.reworkCount ? ' · ↻' + x.reworkCount : ''}</small></button>`).join('')}</div>`).join('')}</div>`;
  }
  function activity(limit = 12) {
    const runs = d().runs.slice(0, limit), byId = Object.fromEntries(d().employees.map(e => [e.id, e]));
    return runs.length ? `<table class="mini"><tbody>${runs.map(r => `<tr><td>${esc(byId[r.employeeId]?.name || '')}</td><td>${esc(r.kind)}</td><td class="run-${esc(r.status)}">${esc(r.status)}</td><td>${esc(r.mode)}</td><td>${r.steps}</td><td>${usd(r.costUsd)}</td><td>${fmtTime(r.createdAt)}</td></tr>`).join('')}</tbody></table>` : empty(L('لا يوجد نشاط بعد.', 'No activity yet.'));
  }
  function jobsBox() {
    const j = d().jobs;
    return `<div class="jobs">${d().halted ? `<span class="tag warning">${esc(t('halted'))}</span>` : ''}${j.running ? `<span class="tag">▶ ${esc(j.running.label)}</span>` : ''}${j.queued.map(x => `<span class="tag">⏳ ${esc(x.label)}</span>`).join('')}
      ${d().halted ? `<button class="btn small" data-act="resume">${esc(t('resume'))}</button>` : `<button class="btn small danger" data-act="stop">■ ${esc(t('stop'))}</button>`}</div>`;
  }
  function operations() {
    return `${jobsBox()}<div class="section-header"><h3>${L('لوحة المهام', 'Task board')}</h3></div>${kanban()}<div class="section-header"><h3>${L('نشاط الموظفين (تشغيلات حقيقية مسجلة)', 'Employee activity (recorded runs)')}</h3></div>${activity()}`;
  }

  // ------------------------------------------------------------------ CEO workspace
  const TABS = [['overview', 'نظرة عامة', 'Overview'], ['tasks', 'المهام', 'Tasks'], ['approvals', 'الموافقات', 'Approvals'], ['deliverables', 'التسليمات', 'Deliverables'], ['employees', 'الموظفون', 'Employees'], ['costs', 'التكاليف', 'Costs'], ['audit', 'السجل', 'Audit']];
  function workspace() {
    const tabs = `<nav class="tabs" role="tablist">${TABS.map(([k, ar, en]) => `<button role="tab" aria-selected="${wsTab === k}" class="${wsTab === k ? 'on' : ''}" data-act="tab" data-id="${k}">${esc(L(ar, en))}${k === 'approvals' && pendingCount() ? ` <span class="badge">${pendingCount()}</span>` : ''}</button>`).join('')}</nav>`;
    const body = taskView ? taskDetail() : ({overview: wsOverview, tasks: () => kanban(), approvals: wsApprovals, deliverables: wsDeliverables, employees: wsEmployees, costs: wsCosts, audit: wsAudit})[wsTab]();
    return tabs + `<div class="ws-body">${body}</div>`;
  }
  const pendingCount = () => d().approvals.filter(a => a.status === 'pending').length + d().decisions.filter(x => x.status === 'awaiting_ceo').length + d().tasks.filter(x => x.status === 'proposed' && store.activeProject()?.status === 'active').length;
  function wsOverview() {
    const p = store.activeProject(), u = d().usage;
    const busyEmps = d().employees.filter(e => e.kind === 'ai');
    return `${jobsBox()}<div class="office-stats"><div><small>${L('المشروع', 'Project')}</small><strong>${esc(p ? t('project.' + p.status) : '—')}</strong></div><div><small>${L('بانتظار قرارك', 'Awaiting you')}</small><strong>${pendingCount()}</strong></div><div><small>${L('إنفاق الشهر', 'Spend this month')}</small><strong>${usd(u.totalUsd)} / $${u.budgetUsd}</strong></div></div>
      <div class="emp-grid">${busyEmps.map(e => `<div class="emp-tile"><b>${esc(e.name)}</b>${statusChip(e.status)}${modeTag(e.mode)}<small>${esc(e.statusDetail || '')}</small></div>`).join('')}</div>
      ${p ? projectCard(p) : empty(L('لا يوجد مشروع. اذهب إلى مكتب مدير المشاريع لإسناد مشروع.', 'No project. Visit the Project Manager’s office to assign one.'))}
      ${d().integrations.github ? `<p class="muted">GitHub sandbox: <code>${esc(d().integrations.github.repo)}</code></p>` : `<p class="muted">${L('GitHub sandbox غير مُعد: طلبات الدمج محلية (فرع git داخل sandbox) ومُعلّمة بذلك.', 'GitHub sandbox not configured: pull requests are local (git branch in the sandbox) and labelled as such.')}</p>`}`;
  }
  function wsApprovals() {
    const pend = d().approvals.filter(a => a.status === 'pending'), decs = d().decisions.filter(x => x.status === 'awaiting_ceo' || x.status === 'pending');
    const proposed = d().tasks.filter(x => x.status === 'proposed');
    return `<div class="section-header"><h3>${L('إجراءات تتطلب موافقة CEO', 'Actions requiring CEO approval')}</h3></div>
      ${pend.length ? `<div class="feed">${pend.map(a => `<article class="feed-item"><header><b>${esc(a.action)}</b><small>${fmtTime(a.createdAt)}</small></header><p>${esc(a.summary)}</p>
        <footer><button class="btn primary small" data-act="approval" data-approve="1" data-id="${esc(a.id)}">${a.action === 'pr.merge' ? L('موافقة ودمج', 'Approve & merge') : L('موافقة', 'Approve')}</button><button class="btn small" data-act="approval" data-approve="0" data-id="${esc(a.id)}">${a.action === 'pr.merge' ? L('رفض وإعادة للتطوير', 'Reject → rework') : L('رفض', 'Reject')}</button>
        ${a.targetType === 'task' ? `<button class="btn small ghost" data-act="task" data-id="${esc(a.targetId)}">${L('مراجعة الأدلة', 'Review evidence')}</button>` : ''}</footer></article>`).join('')}</div>` : empty(L('لا توجد إجراءات معلقة.', 'Nothing pending.'))}
      ${decs.length ? `<div class="section-header"><h3>${L('قرارات تقنية', 'Technical decisions')}</h3></div><div class="feed">${decs.map(decisionCard).join('')}</div>` : ''}
      ${proposed.length ? `<div class="section-header"><h3>${L('مهام مقترحة', 'Proposed tasks')}</h3></div><div class="feed">${proposed.map(x => `<article class="feed-item"><header><b>${esc(x.title)}</b>${taskChip(x.status)}</header>${list(x.acceptanceCriteria, 'criteria')}<footer><button class="btn small primary" data-act="approve-task" data-id="${esc(x.id)}">${L('اعتماد', 'Approve')}</button><button class="btn small" data-act="reject-task" data-id="${esc(x.id)}">${L('رفض', 'Reject')}</button></footer></article>`).join('')}</div>` : ''}`;
  }
  function deliverableRow(x) {
    const ev = x.evidence || {};
    return `<article class="feed-item"><header><b>${x.prUrl ? safeLink(x.prUrl, x.title) : esc(x.title)}</b><span class="chip">${esc(x.kind)} · ${esc(x.status)}</span></header>
      ${x.isLocalPr ? `<p class="warn">${L('طلب دمج محلي — ليس Pull Request على GitHub.', 'Local review request — not a GitHub pull request.')}</p>` : ''}
      ${ev.label ? `<small>${esc(ev.label)}</small>` : ''}<p>${esc(x.summary).slice(0, 600)}</p>
      ${x.branch ? `<p class="mono">${esc(x.branch)}${x.commitSha ? ' @ ' + esc(x.commitSha.slice(0, 10)) : ''}</p>` : ''}${ev.diffStat ? `<pre class="mono">${esc(ev.diffStat)}</pre>` : ''}
      <footer><button class="btn small ghost" data-act="task" data-id="${esc(x.taskId)}">${L('فتح المهمة', 'Open task')}</button></footer></article>`;
  }
  const wsDeliverables = () => (d().deliverables.length ? `<div class="feed">${d().deliverables.map(x => x.kind === 'qa_report' ? qaReportCard(x) : deliverableRow(x)).join('')}</div>` : empty(L('لا توجد تسليمات بعد.', 'No deliverables yet.')));
  function wsEmployees() {
    const tasks = d().tasks.filter(x => ['done', 'blocked', 'awaiting_ceo', 'rework'].includes(x.status));
    return d().employees.filter(e => e.kind === 'ai').map(e => {
      const evs = d().evaluations.filter(x => x.employeeId === e.id);
      return `<article class="feed-item"><header><b>${esc(e.name)}</b>${statusChip(e.status)}${modeTag(e.mode)}</header>
        <p class="mono">${esc(e.provider)} · ${esc(e.model)} · ${L('حد يومي', 'daily cap')} $${e.dailyBudgetUsd} · ${L('أقصى خطوات', 'max steps')} ${e.maxSteps}</p>
        <form class="inline-form" data-form="budget" data-id="${esc(e.id)}"><label>${L('الحد اليومي $', 'Daily cap $')}<input name="daily" type="number" min="0" max="20" step="0.1" value="${e.dailyBudgetUsd}"></label><button class="btn small" type="submit">${L('حفظ', 'Save')}</button></form>
        ${evs.length ? `<table class="mini"><tbody>${evs.map(v => `<tr><td>${esc(v.evaluator)}</td><td><b>${v.overall}</b>/5</td><td class="mono">${esc(Object.entries(v.scores).map(([k, s]) => `${k}:${s}`).join(' '))}</td><td>${esc(v.comment).slice(0, 80)}</td><td>${fmtTime(v.createdAt)}</td></tr>`).join('')}</tbody></table>` : `<small>${L('لا تقييمات بعد', 'No evaluations yet')}</small>`}
        <details><summary>${L('تقييم الموظف (CEO)', 'Evaluate (CEO)')}</summary><form class="form-card" data-form="evaluate" data-id="${esc(e.id)}">
          <label>${L('المهمة', 'Task')}<select name="taskId"><option value="">${L('— عام —', '— general —')}</option>${tasks.map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>
          <div class="score-grid">${['quality', 'compliance', 'tests', 'decisions', 'time', 'rework', 'reliability', 'cost'].map(k => `<label>${k}<select name="${k}"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select></label>`).join('')}</div>
          <label>${L('ملاحظة', 'Comment')}<textarea name="comment" rows="2" maxlength="2000"></textarea></label><button class="btn primary small" type="submit">${L('حفظ التقييم (لا يمكن تعديله لاحقًا)', 'Save evaluation (immutable)')}</button></form></details></article>`;
    }).join('');
  }
  let auditRows = null;
  function wsAudit() {
    if (!auditRows) { api('/api/audit').then(r => { auditRows = r.audit; render(); }).catch(e => toast(e.message)); return `<p>${L('جارٍ التحميل…', 'Loading…')}</p>`; }
    return `<p class="muted">${L('سجل غير قابل للتعديل أو الحذف (append-only).', 'Append-only log (cannot be edited or deleted).')}</p>` + (auditRows.length ? `<table class="mini"><tbody>${auditRows.map(a => `<tr><td>${fmtTime(a.at)}</td><td>${esc(a.actorType)}</td><td class="mono">${esc(a.action)}</td><td>${esc(a.targetType || '')}</td></tr>`).join('')}</tbody></table>` : empty('—'));
  }
  function wsCosts() {
    const u = d().usage;
    return `<div class="office-stats"><div><small>${L('الإنفاق منذ', 'Spend since')} ${esc(u.since.slice(0, 10))}</small><strong>${usd(u.totalUsd)}</strong></div><div><small>${L('ميزانية الشهر', 'Monthly budget')}</small><strong>$${u.budgetUsd}</strong></div><div><small>${L('مزودون LIVE', 'Live providers')}</small><strong>${Object.entries(d().liveProviders).filter(([, v]) => v).map(([k]) => k).join(', ') || '0'}</strong></div></div>
      <form class="inline-form" data-form="monthly"><label>${L('ميزانية الشهر $', 'Monthly budget $')}<input name="monthly" type="number" min="0" max="100" step="0.5" value="${u.budgetUsd}"></label><button class="btn small" type="submit">${L('حفظ', 'Save')}</button></form>
      ${u.rows.length ? `<table class="mini"><thead><tr><th>role</th><th>provider</th><th>model</th><th>calls</th><th>in</th><th>out</th><th>USD</th></tr></thead><tbody>${u.rows.map(r => `<tr><td>${esc(r.role)}</td><td>${esc(r.provider)}</td><td>${esc(r.model)}</td><td>${r.calls}</td><td>${r.tokensIn}</td><td>${r.tokensOut}</td><td>${usd(r.costUsd)}</td></tr>`).join('')}</tbody></table>` : empty(L('لا استهلاك مدفوع. في وضع DEMO لا تُستدعى أي واجهة مدفوعة.', 'No paid usage. DEMO mode calls no paid API.'))}
      <p class="muted">${L('الأسعار المستخدمة للتقدير موثقة في docs/COSTS.md (تحقق منها في 2026-11-21).', 'Prices used for estimates are documented in docs/COSTS.md (verified 2026-11-21).')}</p>`;
  }
  function taskDetail() {
    const v = taskView; if (!v) return '';
    if (!v.data) return `<p>${L('جارٍ التحميل…', 'Loading…')}</p>`;
    const {task, deliverables, runs} = v.data;
    return `<button class="btn small ghost" data-act="back">← ${L('رجوع', 'Back')}</button>
      <h3>${esc(task.title)} ${taskChip(task.status)}</h3><p>${esc(task.description)}</p>${list(task.acceptanceCriteria, 'criteria')}
      <div class="section-header"><h3>${L('التسليمات والأدلة', 'Deliverables & evidence')}</h3></div><div class="feed">${deliverables.map(x => x.kind === 'qa_report' ? qaReportCard(x) : deliverableRow(x)).join('') || empty('—')}</div>
      ${deliverables.some(x => x.kind === 'pull_request') ? `<div class="section-header"><h3>Diff</h3><button class="btn small" data-act="diff" data-id="${esc(task.id)}">${L('عرض التغييرات', 'Show diff')}</button></div><pre class="diff" id="diffBox">${v.diff ? esc(v.diff) : ''}</pre>` : ''}
      <div class="section-header"><h3>${L('التشغيلات والأدوات المنفذة', 'Runs & tool executions')}</h3></div>
      ${runs.map(r => `<details class="run"><summary>${esc(r.kind)} · <span class="run-${esc(r.status)}">${esc(r.status)}</span> · ${esc(r.mode)} · ${r.steps} ${L('خطوة', 'steps')} · ${usd(r.costUsd)}${r.error ? ' · ' + esc(r.error.slice(0, 120)) : ''}</summary>
        <table class="mini"><tbody>${r.tools.map(x => `<tr><td>${esc(x.tool)}</td><td class="tool-${esc(x.status)}">${esc(x.status)}</td><td class="mono">${esc(x.summary).slice(0, 160)}</td><td>${x.durationMs}ms</td></tr>`).join('')}</tbody></table></details>`).join('')}`;
  }
  async function openTask(id) {
    if (current !== 'ceo') { open('ceo'); }
    taskView = {id, data: null}; render();
    try { taskView.data = await api(`/api/tasks/${id}`); } catch (e) { toast(e.message); taskView = null; }
    render();
  }

  // ------------------------------------------------------------------ actions (event delegation)
  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); await store.refresh(); if (taskView?.id) taskView.data = await api(`/api/tasks/${taskView.id}`).catch(() => taskView.data); render(); } catch (e) { toast(e.message); } };
  $('panelBody').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, yes = b.dataset.approve === '1';
    switch (b.dataset.act) {
      case 'tab': wsTab = id; taskView = null; if (id === 'audit') auditRows = null; render(); break;
      case 'back': taskView = null; render(); break;
      case 'task': openTask(id); break;
      case 'plan': act(() => api(`/api/projects/${id}/plan`, {}), L('بدأ المدير إعداد الخطة', 'The Manager started planning')); break;
      case 'approve-plan': act(() => api(`/api/projects/${id}/decide-plan`, {approve: true}), L('اعتُمدت الخطة', 'Plan approved')); break;
      case 'reject-plan': act(() => api(`/api/projects/${id}/decide-plan`, {approve: false}), L('رُفضت الخطة', 'Plan rejected')); break;
      case 'review': act(() => api(`/api/decisions/${id}/review`, {}), L('أُحيل القرار إلى المدير التقني', 'Sent to the Technical Director')); break;
      case 'decide': act(() => api(`/api/decisions/${id}/decide`, {approve: yes}), yes ? L('اعتُمد القرار', 'Decision approved') : L('رُفض القرار', 'Decision rejected')); break;
      case 'approve-task': act(() => api(`/api/tasks/${id}/approve`, {approve: true}), L('اعتُمدت المهمة', 'Task approved')); break;
      case 'reject-task': act(() => api(`/api/tasks/${id}/approve`, {approve: false})); break;
      case 'execute': act(() => api(`/api/tasks/${id}/execute`, {}), L('بدأ المطور التنفيذ في الـsandbox', 'Developer started in the sandbox')); break;
      case 'approval': act(() => api(`/api/approvals/${id}/decide`, {approve: yes, reason: yes ? '' : (prompt_reason() || 'CEO requested changes')}), yes ? L('تمت الموافقة', 'Approved') : L('أُعيدت للتطوير', 'Sent back')); break;
      case 'stop': act(() => api('/api/agents/stop', {}), L('تم إيقاف كل الوكلاء', 'All agents stopped')); break;
      case 'resume': act(() => api('/api/agents/resume', {}), L('استؤنف الوكلاء', 'Agents resumed')); break;
      case 'diff': api(`/api/tasks/${id}/diff`).then(r => { taskView.diff = r.diff || '(empty)'; render(); }).catch(err => toast(err.message)); break;
    }
  });
  const prompt_reason = () => $('panelBody').querySelector('[data-reason]')?.value || '';
  $('panelBody').addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    const v = Object.fromEntries(new FormData(f)); const kind = f.dataset.form;
    document.activeElement?.blur?.();
    if (kind === 'project') act(async () => { const r = await api('/api/projects', {name: v.name, objective: v.objective}); await api(`/api/projects/${r.project.id}/plan`, {}); }, L('أُسند المشروع وبدأ المدير التخطيط', 'Project assigned; Manager is planning'));
    if (kind === 'budget') act(() => api('/api/settings/budget', {employeeId: f.dataset.id, dailyBudgetUsd: Number(v.daily)}), L('حُفظ', 'Saved'));
    if (kind === 'monthly') act(() => api('/api/settings/budget', {monthlyBudgetUsd: Number(v.monthly)}), L('حُفظ', 'Saved'));
    if (kind === 'evaluate') {
      const scores = Object.fromEntries(['quality', 'compliance', 'tests', 'decisions', 'time', 'rework', 'reliability', 'cost'].filter(k => v[k]).map(k => [k, Number(v[k])]));
      act(() => api('/api/evaluations', {employeeId: f.dataset.id, taskId: v.taskId || undefined, scores, comment: v.comment}), L('حُفظ التقييم', 'Evaluation saved'));
    }
  });

  return {open, close, isOpen, openTask, get current() { return current; }, lang: getLang};
}

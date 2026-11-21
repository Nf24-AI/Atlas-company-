// Company management UI: office meeting panel, Operations board, toasts and mode badge.
import {api} from '../net/api-client.js';
import {createVoice} from '../voice/voice.js';

const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const CONSENT_KEY = 'atlas-voice-consent-v1';
const consentGiven = () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch { return false; } };

export function createCompanyUI({offices, onOpen, onClose}) {
  let data = {projects: [], tasks: [], decisions: [], runs: [], config: {manager: false, director: false}};
  let activeOffice = 'manager', lastRun = null, busy = false, toastTimer;

  const toast = s => { const el = $('toast'); el.textContent = s; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); };
  const voice = createVoice({
    onListening: on => { $('voiceOrb').classList.toggle('listening', on); if (on) $('voiceState').textContent = 'أستمع إليك...'; },
    onSpeaking: on => $('voiceOrb').classList.toggle('speaking', on),
    onResult: text => { $('utterance').value = text; toast('تم التعرف على الصوت؛ يجري إرسال الطلب'); sendTurn(activeOffice, text); },
    onError: err => { toast('تعذر التعرف على الصوت: ' + err); $('voiceState').textContent = 'استخدم الإدخال النصي إن لزم'; },
  });

  const isOpen = () => !$('overlay').hidden;
  function open(role) {
    activeOffice = role; const o = offices[role];
    $('overlay').hidden = false; document.body.classList.add('overlay-open');
    $('panelTitle').textContent = role === 'board' ? 'مركز العمليات' : o.arabic;
    $('panelSubtitle').textContent = role === 'board' ? 'المهام، القرارات، وموافقات الإدارة' : 'تفاعل صوتيًا، اتخذ قرارًا، أو اطلب توجيهًا عمليًا.';
    $('panelKicker').textContent = role === 'board' ? 'COMPANY OPERATIONS' : role.toUpperCase() + ' OFFICE';
    $('officeView').hidden = role === 'board'; $('boardView').hidden = role !== 'board';
    if (role === 'board') renderBoard();
    else {
      $('employeeLetter').textContent = o.letter; $('employeeLetter').style.background = role === 'manager' ? '#2d7168' : '#80613b';
      $('employeeName').textContent = o.label; $('employeeDesc').textContent = o.arabic;
      $('utterance').value = ''; $('agentOutcome').hidden = true; renderRecent();
    }
    renderStats(); $('closePanel').focus(); onOpen?.(role);
  }
  function close() { if (!isOpen()) return; $('overlay').hidden = true; document.body.classList.remove('overlay-open'); voice.stop(); onClose?.(); }
  $('closePanel').onclick = close;
  $('overlay').addEventListener('click', e => { if (e.target === $('overlay')) close(); });

  async function refresh() {
    try {
      data = await api('/api/state'); renderStats();
      if (activeOffice === 'board' && isOpen()) renderBoard();
      const a = data.config.manager, b = data.config.director;
      $('modeBadge').textContent = data.staticDemo ? 'STATIC DEMO' : a && b ? 'AI LIVE' : a || b ? 'HYBRID' : 'DEMO';
      $('modeHelp').textContent = data.staticDemo ? 'نسخة ثابتة على GitHub Pages: ردود محاكاة فقط، لا خادم ولا ذكاء اصطناعي.' : a || b ? 'النماذج المتصلة تعمل مباشرة؛ النماذج الأخرى في وضع عرض ثابت.' : 'عرض محلي ثابت حتى تضيف مفاتيح API للخادم.';
    } catch (e) { toast('تعذر الاتصال بالخادم: ' + e.message); }
  }
  function renderStats() {
    $('statsProjects').textContent = String(data.projects?.length || 0).padStart(2, '0');
    $('statsTasks').textContent = String((data.tasks || []).filter(t => t.status !== 'done').length).padStart(2, '0');
    $('statsDecisions').textContent = String((data.decisions || []).filter(t => t.status === 'pending').length).padStart(2, '0');
  }
  function renderRecent() {
    const a = (data.runs || []).filter(r => r.role === activeOffice).slice(0, 3);
    $('recentRuns').innerHTML = a.length ? a.map(r => `<article class="feed-item"><header><b>${r.role === 'manager' ? 'مدير المشاريع' : 'المدير التقني'}</b><small>${r.mode === 'demo' ? 'عرض تجريبي' : 'AI مباشر'}</small></header><p>${esc(r.output.speech)}</p><small>${new Date(r.at).toLocaleString('ar-SA')}</small></article>`).join('') : '<div class="feed-empty">لم تُعقد أي جلسات بعد. ابدأ أول اجتماع.</div>';
  }
  function renderBoard() {
    const tasks = data.tasks || [], d = data.decisions || [];
    $('boardSummary').innerHTML = `<strong>${esc(data.projects?.[0]?.name || 'لا يوجد مشروع')}</strong>مركز إدارة التشغيل — كل مهمة أو قرار هنا مرتبط بإجراء محفوظ داخل النظام.`;
    $('taskCount').textContent = tasks.length; $('decisionsCount').textContent = d.length;
    $('tasksList').innerHTML = tasks.length ? tasks.map(t => `<article class="feed-item"><header><b>${esc(t.title)}</b><small>${t.status === 'todo' ? 'جديدة' : t.status === 'in_progress' ? 'قيد التنفيذ' : 'مسلمة للمراجعة'}</small></header><p>${esc(t.description)}</p><p><strong>معيار القبول:</strong> ${esc(t.acceptanceCriteria)}</p><footer>${t.status === 'todo' ? `<button class="btn small" data-task="${esc(t.id)}" data-state="in_progress">بدء المهمة</button>` : ''}${t.status === 'in_progress' ? `<button class="btn small" data-task="${esc(t.id)}" data-state="submitted">تسليم للمراجعة</button>` : ''}</footer></article>`).join('') : '<div class="feed-empty">لا توجد مهام معتمدة. اطلب مهمة من مدير المشاريع ثم اعتمدها.</div>';
    $('decisionsList').innerHTML = d.length ? d.map(o => `<article class="feed-item"><header><b>${esc(o.title)}</b><small>${o.status === 'pending' ? 'بانتظار موافقتك' : o.status === 'approved' ? 'معتمد' : 'مرفوض'}</small></header><p>${esc(o.description)}</p>${o.acceptanceCriteria ? `<p>معيار القبول: ${esc(o.acceptanceCriteria)}</p>` : ''}<footer>${o.status === 'pending' ? `<button class="btn primary small" data-approve="${esc(o.id)}" data-status="approved">اعتماد</button><button class="btn small" data-approve="${esc(o.id)}" data-status="rejected">رفض</button>` : ''}</footer></article>`).join('') : '<div class="feed-empty">لا توجد قرارات معلقة حاليًا.</div>';
    for (const el of document.querySelectorAll('[data-approve]')) el.onclick = () => approve(el.dataset.approve, el.dataset.status);
    for (const el of document.querySelectorAll('[data-task]')) el.onclick = () => taskStatus(el.dataset.task, el.dataset.state);
  }
  async function approve(id, status) { try { await api('/api/approval', {id, status}); await refresh(); toast(status === 'approved' ? 'تم الاعتماد وحفظ الإجراء' : 'تم رفض الاقتراح'); } catch (e) { toast(e.message); } }
  async function taskStatus(id, status) { try { await api('/api/task-status', {id, status}); await refresh(); toast('تم تحديث حالة المهمة'); } catch (e) { toast(e.message); } }
  async function sendTurn(role, text, route = '/api/agent', payload = null) {
    if (busy) return; busy = true; $('sendBtn').disabled = true; $('voiceState').textContent = 'المدير يراجع طلبك الآن...';
    try {
      const result = await api(route, payload || {role, text}); lastRun = result.runId;
      await refresh(); renderRecent(); renderOutcome(result.output, result.mode);
      $('voiceState').textContent = 'اكتملت المراجعة'; voice.speak(result.output.speech);
    } catch (e) { $('voiceState').textContent = 'تعذر الاتصال'; toast(e.message); } finally { busy = false; $('sendBtn').disabled = false; }
  }
  $('sendBtn').onclick = () => { const text = $('utterance').value.trim(); if (!text) { toast('تحدث أو أدخل وصفًا أولًا'); return; } sendTurn(activeOffice, text); };
  function renderOutcome(o, mode) {
    const panel = $('agentOutcome'); panel.hidden = false;
    const verdict = {approve: 'موافقة مبدئية', challenge: 'اعتراض مهني', clarify: 'مزيد من التوضيح'}[o.verdict] || 'مراجعة';
    panel.innerHTML = `<span class="tag ${o.verdict === 'challenge' ? 'warning' : ''}">${esc(verdict)} · ${mode === 'demo' ? 'محاكاة — ليس AI' : 'رد AI حقيقي'}</span><h4>قرار المدير</h4><p>${esc(o.speech)}</p><p class="rationale">${esc(o.rationale)}</p><div class="action-row">${o.pendingId ? `<button type="button" class="btn primary" id="acceptCurrent">اعتماد: ${esc(o.proposal?.title || 'الاقتراح')}</button><button type="button" class="btn ghost" id="rejectCurrent">رفض</button>` : ''}${activeOffice === 'manager' ? '<button type="button" class="btn ghost" id="escalateCurrent">مراجعة Director ↗</button>' : ''}<button type="button" class="btn ghost" id="openOps">فتح مركز العمليات</button></div>`;
    if ($('acceptCurrent')) $('acceptCurrent').onclick = async () => { await approve(o.pendingId, 'approved'); panel.querySelector('.action-row').innerHTML = '<span class="tag">تم الاعتماد — راجع مركز العمليات</span><button class="btn ghost" id="openOps2">فتح العمليات</button>'; $('openOps2').onclick = () => open('board'); };
    if ($('rejectCurrent')) $('rejectCurrent').onclick = async () => { await approve(o.pendingId, 'rejected'); open('board'); };
    if ($('escalateCurrent')) $('escalateCurrent').onclick = () => { if (!lastRun) { toast('لا يوجد رد من Manager لتصعيده'); return; } const managerRun = lastRun; open('director'); $('voiceState').textContent = 'جارٍ تصعيد قرار المدير...'; sendTurn('director', '', '/api/escalate', {runId: managerRun}); };
    $('openOps').onclick = () => open('board');
  }

  // Voice: consent before the first recording, because browser recognition may use a cloud service.
  if (!voice.canListen) { $('speechSupport').textContent = 'TEXT FALLBACK'; $('micBtn').disabled = true; $('micBtn').textContent = 'التعرف الصوتي غير مدعوم'; }
  else $('speechSupport').textContent = 'VOICE AVAILABLE';
  const startListening = () => { try { voice.listen(); } catch (e) { toast('تعذر تشغيل الميكروفون: ' + e.message); } };
  $('micBtn').onclick = () => { if (!voice.canListen) return; if (consentGiven()) return startListening(); $('voiceConsent').hidden = false; };
  $('consentYes').onclick = () => { try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch { /* ignore */ } $('voiceConsent').hidden = true; startListening(); };
  $('consentNo').onclick = () => { $('voiceConsent').hidden = true; $('utterance').focus(); };
  $('stopVoiceBtn').onclick = () => { voice.stop(); $('voiceState').textContent = 'تم إيقاف الصوت'; };

  return {open, close, isOpen, refresh, toast, get data() { return data; }};
}

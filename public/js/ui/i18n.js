// Arabic-first UI strings with an optional English interface. Agent-generated content is shown
// as produced; only the interface chrome is translated.
const DICT = {
  ar: {
    move: 'للحركة', interact: 'للتفاعل', explore: 'تجوّل واقترب من أحد الموظفين', approach: 'اقترب من أحد المكاتب', enter: 'الدخول · E',
    location: 'الموقع', orbit: 'كاميرا حرة', recenter: 'إعادة التمركز', lang: 'English', close: 'إغلاق', send: 'إرسال إلى', speak: 'ابدأ التحدث', stopVoice: 'إيقاف',
    listening: 'أستمع إليك…', speaking: 'يتحدث…', thinking: 'يراجع طلبك…', ready: 'جاهز للاستماع', textFallback: 'كتابة بدل الصوت',
    status: {available: 'متاح', planning: 'يخطط', in_meeting: 'في اجتماع', executing: 'ينفّذ', reviewing: 'يراجع', blocked: 'متوقف', awaiting_approval: 'بانتظار موافقتك', completed: 'أنجز', human: 'أنت'},
    task: {proposed: 'مقترحة', todo: 'معتمدة', in_progress: 'قيد التطوير', in_qa: 'قيد الاختبار', rework: 'إعادة عمل', awaiting_ceo: 'بانتظار CEO', done: 'منجزة', rejected: 'مرفوضة', blocked: 'متعثرة'},
    project: {draft: 'مسودة', planning: 'قيد التخطيط', awaiting_approval: 'بانتظار اعتماد الخطة', active: 'نشط', completed: 'مكتمل', cancelled: 'ملغى'},
    demo: 'DEMO — محاكاة مكتوبة مسبقًا، ليست ذكاءً اصطناعيًا', live: 'LIVE — نموذج ذكاء اصطناعي حقيقي',
    login: 'تسجيل الدخول', setup: 'إنشاء حساب الرئيس التنفيذي', email: 'البريد الإلكتروني', password: 'كلمة المرور (10 أحرف على الأقل)', name: 'اسمك', company: 'اسم الشركة',
    stop: 'إيقاف طارئ لكل الوكلاء', resume: 'استئناف الوكلاء', halted: 'الوكلاء موقوفون بأمر CEO',
  },
  en: {
    move: 'move', interact: 'interact', explore: 'Walk around and approach an employee', approach: 'Approach an office', enter: 'Enter · E',
    location: 'Location', orbit: 'Free camera', recenter: 'Recenter', lang: 'العربية', close: 'Close', send: 'Send to', speak: 'Start talking', stopVoice: 'Stop',
    listening: 'Listening…', speaking: 'Speaking…', thinking: 'Reviewing your request…', ready: 'Ready to listen', textFallback: 'Type instead',
    status: {available: 'Available', planning: 'Planning', in_meeting: 'In meeting', executing: 'Executing', reviewing: 'Reviewing', blocked: 'Blocked', awaiting_approval: 'Awaiting approval', completed: 'Completed', human: 'You'},
    task: {proposed: 'Proposed', todo: 'Approved', in_progress: 'In development', in_qa: 'In QA', rework: 'Rework', awaiting_ceo: 'Awaiting CEO', done: 'Done', rejected: 'Rejected', blocked: 'Blocked'},
    project: {draft: 'Draft', planning: 'Planning', awaiting_approval: 'Plan awaiting approval', active: 'Active', completed: 'Completed', cancelled: 'Cancelled'},
    demo: 'DEMO — pre-written simulation, not AI', live: 'LIVE — real AI model',
    login: 'Sign in', setup: 'Create the CEO account', email: 'Email', password: 'Password (min 10 characters)', name: 'Your name', company: 'Company name',
    stop: 'Emergency stop all agents', resume: 'Resume agents', halted: 'Agents halted by the CEO',
  },
};
let lang = (() => { try { return localStorage.getItem('atlas-lang') || 'ar'; } catch { return 'ar'; } })();
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'ar';
  try { localStorage.setItem('atlas-lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
export function t(path) {
  const get = d => path.split('.').reduce((o, k) => (o == null ? o : o[k]), d);
  return get(DICT[lang]) ?? get(DICT.ar) ?? path;
}
/** Pick the localized field: {ar, en} objects or label pairs. */
export const L = (ar, en) => (lang === 'en' ? en ?? ar : ar);
setLang(lang);

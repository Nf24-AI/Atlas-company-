// Deterministic DEMO replies, shared by the Node server (no API key) and the static
// GitHub Pages demo. These are scripted examples, NOT model reasoning; every caller
// labels them DEMO.
export function demoReply(role, input) {
  if (role === 'director') return {
    speech: 'أوصي بعدم اعتماد الموعد أو المعمارية قبل توثيق القيود والمخاطر. أريد تقديرًا، معايير قبول، وخيارًا بديلًا ثم سأعيد التقييم.',
    verdict: 'challenge', rationale: 'هذا رد تجريبي ثابت؛ لم يُستدعَ نموذج DeepSeek.',
    proposal: {type: 'decision', title: 'اعتماد خطة تنفيذ قابلة للقياس', description: 'قرار مقترح: لا يُعتمد النطاق قبل تحديد الأولويات والمخاطر.'}, escalate: false,
  };
  const risky = /أسبوع|يوم واحد|بدون اختبار|مباشرة الإنتاج|فورًا|بدون خطة/.test(input);
  return {
    speech: risky ? 'أعترض على التنفيذ بهذه الطريقة؛ الموعد أو تجاوز الاختبارات غير مبرر. حدّد النطاق والموارد والتبعيات ثم قيّم المخاطر قبل الالتزام.' : 'سنبدأ بمهمة محددة: وثّق هدف مشروعك والمستخدم المستهدف وثلاثة متطلبات أساسية. لا نبدأ البرمجة قبل مراجعة ذلك.',
    verdict: risky ? 'challenge' : 'clarify',
    rationale: 'هذا مثال محلي ثابت لعرض دورة العمل، وليس استدلال نموذج AI.',
    proposal: {type: 'task', title: 'إعداد تعريف ونطاق المشروع', description: 'وثّق المشكلة التي يحلها المشروع والجمهور المستهدف والحدود الأساسية.', acceptanceCriteria: 'هدف قابل للقياس، 3 متطلبات أساسية، 3 عناصر خارج النطاق.'},
    escalate: risky,
  };
}

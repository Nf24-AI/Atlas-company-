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

// Scripted plan and Technical Director review (DEMO). Shared with the server.
export function demoPlan(project) {
  const rushed = /أسبوع|يوم|بدون اختبار|فورًا|without tests/i.test(project.objective);
  return {
    summary: `خطة تجريبية لمشروع «${project.name}»: إضافة فلتر المهام المتأخرة إلى مكتبة Task Tracker مع اختبارات آلية ومراجعة QA مستقلة.`,
    challenge: rushed ? 'أعترض على أي التزام بالإطلاق دون اختبارات؛ الخطة تتضمن اختبارات إلزامية ومراجعة QA قبل الدمج.' : '',
    scope: {in: ['دالة overdueTasks في src/tasks.js', 'اختبارات وحدة', 'تحديث README'], out: ['واجهة مستخدم', 'تخزين دائم', 'إشعارات']},
    risks: ['التعامل الخاطئ مع المهام المكتملة', 'اختلاف المناطق الزمنية في مقارنة التواريخ'],
    tasks: [{
      title: 'إضافة overdueTasks(tasks, now) إلى مكتبة المهام',
      description: 'أضف دالة overdueTasks(tasks, now) في src/tasks.js تُرجع المهام المتأخرة، مع اختبارات وحدة وتوثيق في README.',
      acceptanceCriteria: [
        'تُرجع المهام المفتوحة التي تاريخ استحقاقها قبل now',
        'تستبعد المهام المكتملة حتى لو كان تاريخها قديمًا',
        'تستبعد المهام التي ليس لها تاريخ استحقاق',
        'جميع الاختبارات الآلية تنجح',
      ],
      assigneeRole: 'developer', priority: 'high',
    }],
    escalations: [{title: 'تمثيل التواريخ: نصوص ISO مقابل كائنات Date', question: 'هل نعتمد مقارنة نصوص ISO بتوقيت UTC أم تحويلها إلى Date؟ ما المخاطر؟'}],
  };
}

export function demoReview() {
  return {
    verdict: 'approve',
    summary: 'أوافق على تخزين التواريخ كنصوص ISO وتحويلها إلى Date.parse عند المقارنة، بشرط اختبار المهام المكتملة والمهام بلا تاريخ.',
    risks: ['مقارنة النصوص مباشرة تفشل مع اختلاف صيغ المناطق الزمنية'],
    recommendation: 'استخدم Date.parse للمقارنة الرقمية وأضف اختبار حدّي للمهمة المستحقة في نفس اللحظة.',
    alternatives: ['استخدام timestamps رقمية في النموذج'],
    evidence: ['createTask يتحقق من due عبر Date.parse في الكود الحالي'],
  };
}


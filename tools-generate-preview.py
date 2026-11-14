from pathlib import Path
import json
root=Path(__file__).parent
pub=root/'public'
html=(pub/'index.html').read_text(encoding='utf-8')
css=(pub/'styles.css').read_text(encoding='utf-8')
js=(pub/'app.js').read_text(encoding='utf-8')
fb=(pub/'fallback.js').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="/styles.css">','<style>'+css+'</style>')
html=html.replace('<script src="/app.js" defer></script>', '<script>'+js+'</script>')
html=html.replace('<script src="/fallback.js" defer></script>', '<script>'+fb+'</script>')
shim=r'''<script>
/* Offline-only demo: localStorage + deterministic response simulation. NEVER calls a live model. */
(function(){
 const STORE='atlas-standalone-demo-v1';
 const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
 const stateDefault=()=>({company:{name:'ATLAS DEMO'},projects:[{id:'p-demo',name:'تأسيس الشركة الرقمية',status:'active',description:'مشروع توضيحي'}],tasks:[],decisions:[],runs:[],meetings:[],audit:[]});
 let state;
 try{state=JSON.parse(localStorage.getItem(STORE)||'null')||stateDefault()}catch{state=stateDefault()}
 const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state))}catch{}};
 const reply=(role,text)=>role==='director'?{speech:'هذه مراجعة تجريبية ثابتة: لا أعتمد الخطة قبل وجود تقدير قابل للتحقق وتحديد المخاطر والبدائل.',verdict:'challenge',rationale:'عرض دون اتصال بنموذج DeepSeek',proposal:{type:'decision',title:'توثيق المخاطر قبل اعتماد الخطة',description:'إعداد مخاطر وتقديرات واقعية للقرار التقني'},escalate:false}:({speech:/أسبوع|بدون اختبار/.test(text)?'أعترض على الإطلاق دون اختبار. سنحدد الحد الأدنى القابل للتشغيل، ونجري اختبارات القبول أولًا.':'سنبدأ بتحديد نطاق المشروع والمتطلبات الأساسية ومعايير القبول قبل البرمجة.',verdict:'challenge',rationale:'محاكاة ثابتة دون اتصال بنموذج Groq',proposal:{type:'task',title:'تحديد نطاق النسخة الأولى',description:'حدد المشكلة والجمهور والنطاق.' ,acceptanceCriteria:'هدف واضح وثلاثة متطلبات أساسية ونطاق مستبعد'},escalate:/أسبوع|بدون اختبار/.test(text)});
 const wrapped={ok:true,status:200,json:async()=>({})};
 window.fetch=async function(url,opt={}){
  let path=String(url),b={};try{b=JSON.parse(opt.body||'{}')}catch{};
  let output,status=200;
  if(path==='/api/health')output={ok:true,models:{manager:'demo',director:'demo'}};
  else if(path==='/api/state')output={...state,config:{manager:false,director:false},models:{manager:'demo',director:'demo'}};
  else if(path==='/api/agent'||path==='/api/escalate'){
   let role=path==='/api/escalate'?'director':b.role;
   let input=path==='/api/escalate'?((state.runs.find(x=>x.id===b.runId)||{}).input||'مراجعة قرار المدير'):b.text;
   if(!input){output={error:'Empty input'};status=400}
   else{const answer=reply(role,input),runId=uid();state.runs.unshift({id:runId,role,input,output:answer,mode:'demo',at:new Date().toISOString()});state.meetings.unshift({id:uid(),role,at:new Date().toISOString(),summary:answer.speech,mode:'demo'});if(answer.proposal){const pendingId=uid();state.decisions.unshift({id:pendingId,role,kind:answer.proposal.type,title:answer.proposal.title,description:answer.proposal.description,acceptanceCriteria:answer.proposal.acceptanceCriteria||'',createdAt:new Date().toISOString(),status:'pending',runId});answer.pendingId=pendingId;}save();output={output:answer,mode:'demo',runId};}
  }
  else if(path==='/api/approval'){
   const proposal=state.decisions.find(x=>x.id===b.id&&x.status==='pending');
   if(!proposal){status=409;output={error:'Proposal is no longer pending'}}
   else{proposal.status=b.status;proposal.reviewedAt=new Date().toISOString();if(b.status==='approved'&&proposal.kind==='task')state.tasks.unshift({id:uid(),title:proposal.title,description:proposal.description,acceptanceCriteria:proposal.acceptanceCriteria,status:'todo',proposalId:proposal.id,createdAt:new Date().toISOString()});save();output={ok:true,proposal};}
  }
  else if(path==='/api/task-status'){
   const t=state.tasks.find(x=>x.id===b.id);if(t){t.status=b.status;save();output={ok:true,task:t}}else{status=404;output={error:'Task not found'}}
  }
  else{status=404;output={error:'Demo endpoint not found'}}
  return {ok:status>=200&&status<300,status,json:async()=>output};
 };
})();
</script>
'''
html=html.replace('<script>'+js+'</script>',shim+'<script>'+js+'</script>')
html=html.replace('</body>','<div style="position:fixed;top:94px;left:50%;transform:translateX(-50%);z-index:9;background:#f2c276;color:#263b3d;border-radius:0 0 11px 11px;padding:6px 16px;font:700 10px system-ui;letter-spacing:1px">OFFLINE DEMO — جميع ردود الموظفين تجريبية</div></body>')
(root/'ATLAS-PLAYABLE-DEMO.html').write_text(html,encoding='utf-8')
print('Saved',root/'ATLAS-PLAYABLE-DEMO.html',len(html))
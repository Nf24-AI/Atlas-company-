import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {demoReply} from './public/js/shared/demo-scripts.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, 'public');
const STATE_PATH = process.env.STATE_FILE || path.join(ROOT, 'data', 'state.json');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3099);
const roleModel = {
  manager: process.env.MANAGER_MODEL || 'openai/gpt-oss-120b',
  director: process.env.DIRECTOR_MODEL || 'deepseek-v4-pro'
};
const configured = (role) => Boolean(process.env[role === 'manager' ? 'GROQ_API_KEY' : 'DEEPSEEK_API_KEY']);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const initialState = () => ({
  company: { name: 'ATLAS / COMPANY OS', motto: 'من الفكرة إلى التنفيذ', createdAt: now() },
  projects: [{ id: 'project-1', name: 'تأسيس الشركة الرقمية', description: 'مشروع تجريبي لإدارة أول نسخة من Company OS', status: 'active' }],
  tasks: [], decisions: [], meetings: [], runs: [], audit: []
});
let state;
try { state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
catch { state = initialState(); save(); }
function save() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const temp = STATE_PATH + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, STATE_PATH);
}
function audit(action, entityId, detail = {}) {
  state.audit.unshift({ id:id(), at:now(), action, entityId, detail });
  state.audit=state.audit.slice(0,300);
}
const SYSTEM = {
  manager: `أنت مدير مشاريع تقنية داخل شركة رقمية حقيقية. أنت حازم ومهني ولا تتملق. مهمتك تحويل الأفكار إلى مهام قابلة للتحقق وشرح الطريقة وتقييم جودة التنفيذ. اعترض على القرارات الضعيفة بوضوح وأدلة؛ لا تكن عنيدًا إذا ظهرت معلومات جديدة. لا تدّع تنفيذ إجراء أو فحص مستودع إذا لم تنفذه عبر أدوات. ليس لديك أدوات GitHub الآن. اكتب بالعربية الواضحة. عند إعداد مهمة اكتب الهدف والخطوات ومعايير القبول. إذا كان القرار يؤثر في معمارية النظام أو موعد إطلاق كبير اطلب تصعيده إلى Director. لا تُنشئ مهمة إلا إذا كانت محددة ومناسبة. أجب JSON فقط بالمفاتيح speech و verdict (approve|challenge|clarify) و rationale و proposal (null أو object من النوع task يحوي title, description, acceptanceCriteria) و escalate (boolean).`,
  director: `أنت Technical Director في شركة رقمية. تراجع القرارات التقنية للمدير وتحدد المخاطر والبدائل. صارم بالدليل لا بالهيبة؛ لا توافق على قرارات بلا معايير قبول. أنت لا تنفذ برمجة أو نشر تلقائيًا؛ توصياتك تحتاج موافقة CEO في الأمور المؤثرة. لا تدّع التحقق مما لم تفحصه. أجب بالعربية وJSON فقط بالمفاتيح speech و verdict (approve|challenge|clarify) و rationale و proposal (null أو object من النوع decision يحوي title, description) و escalate (false).`
};
function short(s, max=2500){return String(s||'').slice(0,max).trim();}
function cleanAgentResult(data, role){
  if (!data || typeof data !== 'object') throw new Error('Model returned an invalid object');
  const p = data.proposal && typeof data.proposal === 'object' ? data.proposal : null;
  return {
    speech: short(data.speech, 2600) || 'أحتاج توضيحًا قبل اتخاذ قرار.',
    verdict: ['approve','challenge','clarify'].includes(data.verdict) ? data.verdict : 'clarify',
    rationale: short(data.rationale,1200),
    proposal: p && ['task','decision'].includes(p.type) && short(p.title,120) ? {
      type:p.type,
      title:short(p.title,120),
      description:short(p.description,1200),
      acceptanceCriteria:short(p.acceptanceCriteria,900)
    }:null,
    escalate:role==='manager' && data.escalate===true
  };
}
async function callModel(role, input, history) {
  if (!configured(role)) return {...demoReply(role,input),demo:true};
  const model=roleModel[role];
  const url=role==='manager'?'https://api.groq.com/openai/v1/chat/completions':'https://api.deepseek.com/chat/completions';
  const key=process.env[role==='manager'?'GROQ_API_KEY':'DEEPSEEK_API_KEY'];
  const messages=[{role:'system',content:SYSTEM[role]},
    ...history.slice(-4).flatMap(r=>[
      {role:'user',content:short(r.input,1000)},
      {role:'assistant',content:JSON.stringify({speech:r.output?.speech,verdict:r.output?.verdict})}
    ]),{role:'user',content:input}];
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),35000);
  try {
    const resp=await fetch(url,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model,messages,temperature:0.25,max_tokens:1200,response_format:{type:'json_object'}})});
    const body=await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(`${role} provider responded ${resp.status}: ${short(body.error?.message||'',180)}`);
    const raw=body.choices?.[0]?.message?.content;
    if(typeof raw!=='string') throw new Error('Provider returned no message');
    let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error('Provider did not return valid JSON');}
    return {...cleanAgentResult(parsed,role),demo:false};
  } finally { clearTimeout(timeout); }
}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function readBody(req){
  let raw=''; for await (const chunk of req) {raw+=chunk; if(raw.length>30000)throw new Error('Request too large');}
  return JSON.parse(raw||'{}');
}
async function agentTurn(req,res,forcedRole){
  const b=await readBody(req);
  const role=forcedRole||b.role;
  if(!['manager','director'].includes(role)) return json(res,{error:'Invalid role'},400);
  const input=short(b.text,2200);
  if(!input||input.length<3) return json(res,{error:'Please provide a meaningful request'},400);
  const history=state.runs.filter(r=>r.role===role);
  const output=await callModel(role,input,history);
  const run={id:id(),role,input,output,at:now(),model:configured(role)?roleModel[role]:null,mode:output.demo?'demo':'live'};
  state.runs.unshift(run);state.runs=state.runs.slice(0,100);
  if(output.proposal){
    const draft={id:id(),role,createdAt:now(),status:'pending',kind:output.proposal.type,
      title:output.proposal.title,description:output.proposal.description,
      acceptanceCriteria:output.proposal.acceptanceCriteria||'',runId:run.id};
    state.decisions.unshift(draft);
    output.pendingId=draft.id;
  }
  state.meetings.unshift({id:id(),role,at:now(),input,summary:output.speech,mode:run.mode});
  audit('agent.turn',run.id,{role,mode:run.mode,proposalId:output.pendingId});save();
  return json(res,{output,mode:run.mode,runId:run.id});
}
async function handler(req,res){
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&pathname==='/api/state')return json(res,{...state,config:{manager:configured('manager'),director:configured('director')},models:roleModel});
    if(req.method==='GET'&&pathname==='/api/health')return json(res,{ok:true,models:{manager:configured('manager')?'live':'demo',director:configured('director')?'live':'demo'}});
    if(req.method==='POST'&&pathname==='/api/agent')return await agentTurn(req,res);
    if(req.method==='POST'&&pathname==='/api/escalate'){
      const b=await readBody(req);
      const source=state.runs.find(x=>x.id===b.runId&&x.role==='manager');
      if(!source)return json(res,{error:'Manager run not found'},404);
      const reqText=`راجع قرار مدير المشاريع التالي، وأصدر رأيك المهني:\nطلب CEO: ${source.input}\nرد المدير: ${source.output.speech}\nتبريره: ${source.output.rationale}`;
      // Pass to the same pipeline by using a minimal compatible body.
      return await agentTurn({[Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify({text:reqText}));}},res,'director');
    }
    if(req.method==='POST'&&pathname==='/api/approval'){
      const b=await readBody(req);
      const proposal=state.decisions.find(x=>x.id===b.id);
      if(!proposal || proposal.status!=='pending')return json(res,{error:'Proposal not pending'},409);
      if(!['approved','rejected'].includes(b.status))return json(res,{error:'Invalid status'},400);
      proposal.status=b.status;proposal.reviewedAt=now();
      if(b.status==='approved'&&proposal.kind==='task'){
        state.tasks.unshift({id:id(),title:proposal.title,description:proposal.description,acceptanceCriteria:proposal.acceptanceCriteria,assignee:'CEO',status:'todo',createdAt:now(),proposalId:proposal.id});
      }
      audit('proposal.'+b.status,proposal.id);save();return json(res,{ok:true,proposal});
    }
    if(req.method==='POST'&&pathname==='/api/task-status'){
      const b=await readBody(req);
      const task=state.tasks.find(x=>x.id===b.id);
      if(!task)return json(res,{error:'Task not found'},404);
      if(!['todo','in_progress','submitted'].includes(b.status))return json(res,{error:'Unsupported status'},400);
      task.status=b.status;task.updatedAt=now();audit('task.status',task.id,{status:b.status});save();return json(res,{ok:true,task});
    }
    if(req.method!=='GET')return json(res,{error:'Not found'},404);
    let file=pathname==='/'?'index.html':pathname.slice(1);
    if(!/^[\w./-]+$/.test(file)||file.includes('..'))return json(res,{error:'Invalid path'},400);
    const full=path.resolve(WEB,file);
    if(!full.startsWith(WEB+path.sep))return json(res,{error:'Invalid path'},400);
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())return json(res,{error:'Not found'},404);
    const ext=path.extname(full);
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});fs.createReadStream(full).pipe(res);
  }catch(e){console.error('[request]',e.message);return json(res,{error:short(e.message,250)},500);}
}
http.createServer(handler).listen(PORT,HOST,()=>console.log(`Company OS is running: http://${HOST}:${PORT}`));

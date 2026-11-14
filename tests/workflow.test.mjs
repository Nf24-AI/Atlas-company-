import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
const PORT=3100+Math.floor(Math.random()*1000),URL=`http://127.0.0.1:${PORT}`;
let child;
async function ready(){for(let i=0;i<70;i++){try{const r=await fetch(URL+'/api/health');if(r.ok)return;}catch{} await new Promise(r=>setTimeout(r,60))}throw Error('server not ready')}
test('serves game and persists approved agent task', async t=>{
 const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'company-os-test-'));
 t.after(()=>fs.rmSync(tempDir,{recursive:true,force:true}));
 child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',STATE_FILE:path.join(tempDir,'state.json'),GROQ_API_KEY:'',DEEPSEEK_API_KEY:''},stdio:'ignore'});
 t.after(()=>child.kill());await ready();
 const html=await fetch(URL+'/');assert.equal(html.status,200);assert.match(await html.text(),/id="world"/);
 let state=await(await fetch(URL+'/api/state')).json();assert.ok(state.projects.length>0);
 let reply=await(await fetch(URL+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'manager',text:'أريد مشروعًا قابلًا للإدارة'})})).json();assert.equal(reply.mode,'demo');assert.ok(reply.output.pendingId);
 const approval=await fetch(URL+'/api/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:reply.output.pendingId,status:'approved'})});assert.equal(approval.status,200);
 state=await(await fetch(URL+'/api/state')).json();assert.ok(state.tasks.find(x=>x.proposalId===reply.output.pendingId));
 const escalation=await(await fetch(URL+'/api/escalate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:reply.runId})})).json();assert.equal(escalation.mode,'demo');assert.equal(escalation.output.escalate,false);
 const bad=await fetch(URL+'/api/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:reply.output.pendingId,status:'approved'})});assert.equal(bad.status,409);
});

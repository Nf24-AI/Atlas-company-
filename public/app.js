'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const offices={manager:{x:-10,z:-4,label:'Project Manager',arabic:'مدير المشاريع التقنية',letter:'M'},director:{x:10,z:-4,label:'Technical Director',arabic:'المدير التقني',letter:'D'},board:{x:0,z:-8.2,label:'Operations Center',arabic:'مركز العمليات',letter:'O'}};
let data={projects:[],tasks:[],decisions:[],runs:[],config:{manager:false,director:false}};
let activeOffice='manager',nearby=null, lastRun=null, busy=false,toastTimer;
const canvas=$('world');const gl=canvas.getContext('webgl',{antialias:true,alpha:true,powerPreference:'high-performance'});
if(!gl){$('sceneTitle').innerHTML='<div class="eyebrow">COMPATIBILITY MODE</div><h2>مقر الشركة التفاعلي</h2><p>عرض إيزومتري بديل للأجهزة دون WebGL</p>';}
const Core=window.AtlasCore;
const player={x:0,z:7,heading:0,bob:0,moving:false};const camera={x:10,y:17,z:24};
// Camera: easy isometric follow by default; orbit/zoom only after the CEO opts in (button or C key).
let orbitMode=false;const view={...Core.DEFAULT_CAMERA};let viewTarget={...Core.DEFAULT_CAMERA};const keys=new Set();const temp={model:[], labels:{}};
const VERT=`attribute vec3 a_position;attribute vec3 a_normal;attribute vec3 a_color;uniform mat4 u_viewProjection;varying vec3 v_color;varying float v_light;void main(){gl_Position=u_viewProjection*vec4(a_position,1.0);v_color=a_color;vec3 light=normalize(vec3(-0.55,0.86,0.52));v_light=0.55+max(dot(a_normal,light),0.0)*0.42;}`;
const FRAG=`precision mediump float;varying vec3 v_color;varying float v_light;void main(){gl_FragColor=vec4(v_color*v_light,1.0);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program,locs,buffer;
if(gl){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(program));gl.useProgram(program);locs={pos:gl.getAttribLocation(program,'a_position'),normal:gl.getAttribLocation(program,'a_normal'),color:gl.getAttribLocation(program,'a_color'),vp:gl.getUniformLocation(program,'u_viewProjection')};buffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);}
const C={ground:'#ecebe0',floor:'#d9ded3',plaster:'#e2e8e1',wall:'#5c7f83',partition:'#93b7b2',navy:'#244550',mat:'#a6c2b6',gold:'#e7b777',table:'#b88c67',screen:'#214450',glass:'#8ac6bd',plant:'#3f856b',white:'#f8f5ee',trim:'#284c50',steel:'#718a87',brown:'#8d6f56',chair:'#466c70',carpet:'#d3beb0',light:'#bde2b1'};
function rgb(hex){const v=parseInt(hex.slice(1),16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}
let verts=[];
function tri(a,b,c,n,col){const r=rgb(col);for(const p of [a,b,c])verts.push(...p,...n,...r);}
function quad(a,b,c,d,n,col){tri(a,b,c,n,col);tri(a,c,d,n,col);}
function box(x,y,z,w,h,d,col){const X=x-w/2,Y=y-h/2,Z=z-d/2,x2=x+w/2,y2=y+h/2,z2=z+d/2;quad([X,y2,Z],[X,y2,z2],[x2,y2,z2],[x2,y2,Z],[0,1,0],col);quad([X,Y,z2],[X,Y,Z],[x2,Y,Z],[x2,Y,z2],[0,-1,0],col);quad([X,Y,Z],[X,y2,Z],[x2,y2,Z],[x2,Y,Z],[0,0,-1],col);quad([x2,Y,z2],[x2,y2,z2],[X,y2,z2],[X,Y,z2],[0,0,1],col);quad([X,Y,z2],[X,y2,z2],[X,y2,Z],[X,Y,Z],[-1,0,0],col);quad([x2,Y,Z],[x2,y2,Z],[x2,y2,z2],[x2,Y,z2],[1,0,0],col);}
function cyl(x,y,z,r,h,col,seg=10){const yy=y-h/2,yt=y+h/2;for(let i=0;i<seg;i++){const a=i/seg*2*Math.PI,b=(i+1)/seg*2*Math.PI,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);tri([x,yt,z],[x+r*ca,yt,z+r*sa],[x+r*cb,yt,z+r*sb],[0,1,0],col);tri([x,yy,z],[x+r*cb,yy,z+r*sb],[x+r*ca,yy,z+r*sa],[0,-1,0],col);const normal=[(ca+cb)/2,0,(sa+sb)/2];quad([x+r*ca,yy,z+r*sa],[x+r*ca,yt,z+r*sa],[x+r*cb,yt,z+r*sb],[x+r*cb,yy,z+r*sb],normal,col);}}
function sphere(x,y,z,r,col){let rings=7,seg=10;for(let j=0;j<rings;j++){let a=-Math.PI/2+j*Math.PI/rings,b=-Math.PI/2+(j+1)*Math.PI/rings;for(let i=0;i<seg;i++){let t=i*2*Math.PI/seg,u=(i+1)*2*Math.PI/seg;const p=(e,q)=>[x+r*Math.cos(e)*Math.cos(q),y+r*Math.sin(e),z+r*Math.cos(e)*Math.sin(q)];const A=p(a,t),B=p(b,t),C1=p(b,u),D=p(a,u);let n=[Math.cos((a+b)/2)*Math.cos((t+u)/2),Math.sin((a+b)/2),Math.cos((a+b)/2)*Math.sin((t+u)/2)];quad(A,B,C1,D,n,col);}}}
function chair(x,z,facing=0){box(x,.42,z,.78,.22,.7,C.chair);box(x,.85,z+(facing?-.34:.34),.80,.75,.13,C.chair);for(let dx of [-.26,.26])for(let dz of [-.22,.22])box(x+dx,.19,z+dz,.08,.34,.08,C.steel);}
function desk(x,z,accent=C.table){box(x,.76,z,2.65,.15,1.16,accent);for(let dx of [-1.05,1.05])for(let dz of [-.39,.39])box(x+dx,.37,z+dz,.13,.65,.13,C.brown);box(x,1.24,z-.16,.88,.68,.10,C.screen);box(x,1.33,z-.08,.7,.45,.03,'#6ba6a5');box(x,.98,z-.1,.07,.2,.07,C.steel);box(x,.87,z+.29,.93,.03,.30,'#384f56');chair(x,z+1.2);}
function plant(x,z,s=1){cyl(x,.32*s,z,.3*s,.6*s,C.brown);cyl(x,.65*s,z,.07*s,.55*s,C.plant);sphere(x,1.10*s,z,.55*s,C.plant);sphere(x-.25*s,1.31*s,z,.32*s,'#6f9f77');}
function avatar(x,z,coat,accent,time,person=false){const walk=person?Math.abs(Math.sin(time*9))*.055:0;box(x,.07,z,.82,.04,.82,'#9caea3');cyl(x,.31+walk,z,.28,.56,'#314c5c');cyl(x-.17,.45+walk,z,.12,.52,'#344f60');cyl(x+.17,.45+walk,z,.12,.52,'#344f60');box(x,.97+walk,z,.62,.88,.40,coat);box(x-.40,1.01+walk,z,.19,.78,.28,coat);box(x+.40,1.01+walk,z,.19,.78,.28,coat);sphere(x,1.66+walk,z,.33,'#d5a982');box(x,1.85+walk,z-.045,.53,.14,.48,accent);}
// Walls and furniture below have matching colliders in game-core.js (OBSTACLES); update both together.
function emitScene(t){verts=[];
 box(0,-.20,0,35,.3,26,C.floor);box(0,-.012,3,8,.025,17,C.white);box(0,-.015,-7,11,.026,6,C.mat);
 box(0,.14,0,33,.025,.12,'#b7c8bd');
 // External partial walls and window apertures
 box(0,1.0,-12.7,34,2.0,.22,C.wall);box(-17,1,0,.2,2.0,25,C.wall);box(17,1,0,.2,2.0,25,C.wall);
 for(let x=-14;x<=14;x+=3.3){box(x,1.10,-12.53,2.4,1.42,.08,'#8fb6b7');box(x,1.75,-12.44,2.42,.07,.09,C.trim);}
 // Room partitions keep doorways open at front
 box(-8.6,.82,-.90,15,.14,.15,C.trim);box(8.6,.82,-.90,15,.14,.15,C.trim);
 box(-16.0,.72,-.9,.20,1.45,8,C.partition);box(-.85,.72,-.9,.2,1.45,8,C.partition);box(16,.72,-.9,.2,1.45,8,C.partition);box(.85,.72,-.9,.2,1.45,8,C.partition);
 box(-11.9,.54,2.8,7.8,.9,.13,C.partition);box(-4.6,.54,2.8,3.0,.9,.13,C.partition);
 box(4.6,.54,2.8,3.0,.9,.13,C.partition);box(11.9,.54,2.8,7.8,.9,.13,C.partition);
 for(const x of [-14.9,-12.6,-10.3,-8,-5.7,-3.4,3.4,5.7,8,10.3,12.6,14.9])box(x,1.10,2.8,.065,1.0,.09,C.steel);
 box(-10,-.045,-4,10,.035,10,'#d7e8dc');box(10,-.045,-4,10,.035,10,'#f0e3d4');
 box(-10,-.025,-4,8.5,.026,7.7,'#e7eae2');box(10,-.025,-4,8.5,.026,7.7,'#eae6df');
 box(-10,.007,-5.3,5,.016,3.5,'#d2ded6');box(10,.007,-5.3,5,.016,3.5,'#ead4bb');
 // Manager office furnishing
 desk(-10.3,-5.4);box(-12.8,.5,-8.3,1.65,1.0,.60,'#aac4b7');box(-12.8,1.12,-8.3,1.5,.07,.6,C.table);plant(-14,-2.0);plant(-4,-9.2,.78);
 // Director office furnishings
 desk(10,-5.4,'#9b765a');box(13.9,.65,-8.2,.65,1.3,3.2,'#c9b8a3');box(13.87,1.36,-8.2,.7,.1,3.2,'#917558');plant(14.5,-2.2);plant(5.2,-9.5,.86);
 // Meeting / operations board
 box(0,.035,-8.5,8,.045,4.9,'#b9cebd');box(0,1.15,-11.9,6.5,2.05,.14,C.trim);box(0,1.25,-11.74,5.95,1.5,.06,'#436e70');
 for(let i=0;i<5;i++)box(-2.3+i*1.15,1.30,-11.69,.8,.06+.16*((i*7)%4),.03,i===3?C.gold:C.glass);
 for(let x of [-2.5,2.5])box(x,.43,-6.9,1.4,.76,.9,C.brown);
 // Arrival lobby details
 box(0,.05,7,5.6,.06,3.5,'#c2dad1');for(let i=0;i<5;i++){box(-2.1+i*1.06,.055,7.95,.40,.02,.09,'#ebeee4')}
 plant(-4.5,7.8,1.15);plant(4.5,7.8,1.15);cyl(0,.14,3.85,.9,.12,C.gold);
 // Wall and room wayfinding
 box(-10,1.67,2.66,2.9,.44,.12,C.trim);box(10,1.67,2.66,2.9,.44,.12,C.trim);
 // Agent avatars stationary
 avatar(-10,-3.25,'#2a665f','#213f43',t,false);avatar(10,-3.25,'#6d5a49','#344452',t,false);
 // player moving
 avatar(player.x,player.z,'#1d5163','#344753',t,player.moving);
}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,target,up=[0,1,0]){let z=eye.map((v,i)=>v-target[i]);let zl=Math.hypot(...z);z=z.map(v=>v/zl);let x=[up[1]*z[2]-up[2]*z[1],up[2]*z[0]-up[0]*z[2],up[0]*z[1]-up[1]*z[0]];let xl=Math.hypot(...x);x=x.map(v=>v/xl);const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1];}
function mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function project(p,m,w,h){const x=p[0],y=p[1],z=p[2];const v=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[3]*x+m[7]*y+m[11]*z+m[15]];return [(v[0]/v[2]*.5+.5)*w,(1-(v[1]/v[2]*.5+.5))*h];}
let lastTime=performance.now();let lastLabelAt=0;let matrix=[];
const lbl=$('labels');lbl.innerHTML=Object.entries(offices).map(([k,v])=>`<div class="world-label" id="label-${k}"><b>${v.label}</b><small>${v.arabic}</small></div>`).join('');
function frame(stamp){if(!gl)return;const delta=Math.min(.05,(stamp-lastTime)/1000);lastTime=stamp;
 player.moving=false;
 if(!$('overlay').hidden){keys.clear();} else {const input=Core.inputVector(keys);if(input.x||input.z){const dir=Core.worldDirection(input,view.yaw);const next=Core.moveWithCollisions(player.x,player.z,dir.x*Core.WALK_SPEED*delta,dir.z*Core.WALK_SPEED*delta);player.moving=Math.hypot(next.x-player.x,next.z-player.z)>1e-4;player.x=next.x;player.z=next.z;player.heading=Math.atan2(dir.x,-dir.z);}}
 // Smoothly ease the orbit state toward its target, then follow the player with the same gentle rate as before.
 const ease=Core.damp(6,delta);view.yaw+=Core.angleDelta(view.yaw,viewTarget.yaw)*ease;view.pitch+=(viewTarget.pitch-view.pitch)*ease;view.distance+=(viewTarget.distance-view.distance)*ease;
 const off=Core.cameraOffset(view),follow=Core.damp(3,delta);const target={x:player.x+off.x,y:off.y,z:player.z+off.z};camera.x+=(target.x-camera.x)*follow;camera.y+=(target.y-camera.y)*follow;camera.z+=(target.z-camera.z)*follow;
 const rect=canvas.getBoundingClientRect();const width=Math.max(1,Math.floor(rect.width*devicePixelRatio)),height=Math.max(1,Math.floor(rect.height*devicePixelRatio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
 matrix=mul(perspective(Math.PI/4,width/height,.1,150),lookAt([camera.x,camera.y,camera.z],[player.x,0,player.z]));
 emitScene(stamp/1000);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);const stride=9*4;for(const [loc,off] of [[locs.pos,0],[locs.normal,12],[locs.color,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,stride,off)}gl.uniformMatrix4fv(locs.vp,false,new Float32Array(matrix));gl.drawArrays(gl.TRIANGLES,0,verts.length/9);
 const nearest=Object.entries(offices).map(([key,o])=>({key,distance:Math.hypot(player.x-o.x,player.z-o.z)})).sort((a,b)=>a.distance-b.distance)[0];nearby=nearest.distance<4.0?nearest.key:null;
 if(stamp-lastLabelAt>120){for(const [key,o] of Object.entries(offices)){const p=project([o.x,2.6,o.z],matrix,rect.width,rect.height),el=$('label-'+key);el.style.left=p[0]+'px';el.style.top=p[1]+'px';el.classList.toggle('near',nearby===key);}const mapX=50+(player.x/35)*100,mapY=50+(player.z/26)*100;$('mapPlayer').style.left=Math.min(96,Math.max(3,mapX))+'%';$('mapPlayer').style.top=Math.min(94,Math.max(3,mapY))+'%';$('nearbyText').textContent=nearby?'الموقع: '+offices[nearby].arabic:'تجوّل واقترب من أحد الموظفين';$('interactBtn').disabled=!nearby;$('interactBtn').textContent=nearby?'الدخول · E':'اقترب من أحد المكاتب';lastLabelAt=stamp;}
 requestAnimationFrame(frame);
}
if(gl)requestAnimationFrame(frame);
window.addEventListener('keydown',e=>{if(e.key==='Escape')return closePanel();if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(k)){keys.add(k);e.preventDefault();}if(k==='e'&&$('overlay').hidden&&nearby)openPanel(nearby);if(k==='c'&&!e.ctrlKey&&!e.metaKey&&$('overlay').hidden)setOrbit(!orbitMode);});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',()=>keys.clear());
for(const b of document.querySelectorAll('[data-move]')){const k=b.dataset.move;b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(k);b.setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(k));}
function placePlayer(x,z){const p=Core.resolvePosition(x,z);player.x=p.x;player.z=p.z;}
function travel(role){const o=offices[role];placePlayer(o.x,o.z+(role==='board'?2.3:2.9));toast('تم الانتقال إلى '+o.arabic+' — اضغط E أو زر الدخول');}
for(const b of document.querySelectorAll('[data-go]')){b.addEventListener('click',()=>travel(b.dataset.go));b.addEventListener('keydown',e=>{if(e.key==='Enter')travel(b.dataset.go)})}
$('interactBtn').addEventListener('click',()=>nearby&&openPanel(nearby));$('viewBtn').addEventListener('click',()=>{placePlayer(0,7);viewTarget={...Core.DEFAULT_CAMERA};toast('تمت إعادة التمركز')});
function setOrbit(on){orbitMode=on;if(!on)viewTarget={...Core.DEFAULT_CAMERA};document.body.classList.toggle('orbit-on',on);const b=$('orbitBtn');b.setAttribute('aria-pressed',String(on));$('orbitIcon').textContent=on?'✓':'⟲';toast(on?'الكاميرا الحرة مفعلة: اسحب للتدوير، وعجلة الفأرة للتقريب · C للإيقاف':'عادت الكاميرا إلى المتابعة التلقائية');}
$('orbitBtn').addEventListener('click',()=>setOrbit(!orbitMode));
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(!orbitMode||(e.pointerType==='mouse'&&e.button!==0))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;viewTarget=Core.applyDrag(viewTarget,e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{drag=null;canvas.classList.remove('dragging');});
canvas.addEventListener('wheel',e=>{if(!orbitMode)return;e.preventDefault();viewTarget=Core.applyZoom(viewTarget,e.deltaMode===1?e.deltaY*16:e.deltaY);},{passive:false});
function openPanel(role){activeOffice=role;const o=offices[role];$('overlay').hidden=false;document.body.classList.add('overlay-open');keys.clear();$('panelTitle').textContent=role==='board'?'مركز العمليات':o.arabic;$('panelSubtitle').textContent=role==='board'?'المهام، القرارات، وموافقات الإدارة':'تفاعل صوتيًا، اتخذ قرارًا، أو اطلب توجيهًا عمليًا.';$('panelKicker').textContent=role==='board'?'COMPANY OPERATIONS':role.toUpperCase()+' OFFICE';$('officeView').hidden=role==='board';$('boardView').hidden=role!=='board';if(role==='board')renderBoard();else {const letter=role==='manager'?'M':'D';$('employeeLetter').textContent=letter;$('employeeLetter').style.background=role==='manager'?'#2d7168':'#80613b';$('employeeName').textContent=o.label;$('employeeDesc').textContent=o.arabic;$('utterance').value='';$('agentOutcome').hidden=true;renderRecent();}renderStats();$('closePanel').focus();}
function closePanel(){$('overlay').hidden=true;document.body.classList.remove('overlay-open');stopAudio();keys.clear();}
$('closePanel').onclick=closePanel;$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closePanel()});
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500)}
async function api(route,body){const res=await fetch(route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await res.json();if(!res.ok)throw Error(j.error||`HTTP ${res.status}`);return j;}
async function refresh(){try{data=await api('/api/state');renderStats();if(activeOffice==='board'&&!$('overlay').hidden)renderBoard();const a=data.config.manager,b=data.config.director;$('modeBadge').textContent=a&&b?'AI LIVE':a||b?'HYBRID':'DEMO';$('modeHelp').textContent=a||b?'النماذج المتصلة تعمل مباشرة؛ النماذج الأخرى في وضع عرض ثابت.':'عرض محلي ثابت حتى تضيف مفاتيح API للخادم.';}catch(e){toast('تعذر الاتصال بالخادم: '+e.message)}}
function renderStats(){$('statsProjects').textContent=String(data.projects?.length||0).padStart(2,'0');$('statsTasks').textContent=String((data.tasks||[]).filter(t=>t.status!=='done').length).padStart(2,'0');$('statsDecisions').textContent=String((data.decisions||[]).filter(t=>t.status==='pending').length).padStart(2,'0')}
function renderRecent(){const a=(data.runs||[]).filter(r=>r.role===activeOffice).slice(0,3);$('recentRuns').innerHTML=a.length?a.map(r=>`<article class="feed-item"><header><b>${r.role==='manager'?'مدير المشاريع':'المدير التقني'}</b><small>${r.mode==='demo'?'عرض تجريبي':'AI مباشر'}</small></header><p>${esc(r.output.speech)}</p><small>${new Date(r.at).toLocaleString('ar-SA')}</small></article>`).join(''):'<div class="feed-empty">لم تُعقد أي جلسات بعد. ابدأ أول اجتماع.</div>'}
function renderBoard(){const tasks=data.tasks||[],d=data.decisions||[];$('boardSummary').innerHTML=`<strong>${esc(data.projects?.[0]?.name||'لا يوجد مشروع')}</strong>مركز إدارة التشغيل — كل مهمة أو قرار هنا مرتبط بإجراء محفوظ داخل النظام.`;$('taskCount').textContent=tasks.length;$('decisionsCount').textContent=d.length;
 $('tasksList').innerHTML=tasks.length?tasks.map(t=>`<article class="feed-item"><header><b>${esc(t.title)}</b><small>${t.status==='todo'?'جديدة':t.status==='in_progress'?'قيد التنفيذ':'مسلمة للمراجعة'}</small></header><p>${esc(t.description)}</p><p><strong>معيار القبول:</strong> ${esc(t.acceptanceCriteria)}</p><footer>${t.status==='todo'?`<button class="btn small" data-task="${t.id}" data-state="in_progress">بدء المهمة</button>`:''}${t.status==='in_progress'?`<button class="btn small" data-task="${t.id}" data-state="submitted">تسليم للمراجعة</button>`:''}</footer></article>`).join(''):'<div class="feed-empty">لا توجد مهام معتمدة. اطلب مهمة من مدير المشاريع ثم اعتمدها.</div>';
 $('decisionsList').innerHTML=d.length?d.map(o=>`<article class="feed-item"><header><b>${esc(o.title)}</b><small>${o.status==='pending'?'بانتظار موافقتك':o.status==='approved'?'معتمد':'مرفوض'}</small></header><p>${esc(o.description)}</p>${o.acceptanceCriteria?`<p>معيار القبول: ${esc(o.acceptanceCriteria)}</p>`:''}<footer>${o.status==='pending'?`<button class="btn primary small" data-approve="${o.id}" data-status="approved">اعتماد</button><button class="btn small" data-approve="${o.id}" data-status="rejected">رفض</button>`:''}</footer></article>`).join(''):'<div class="feed-empty">لا توجد قرارات معلقة حاليًا.</div>';
 for(const el of document.querySelectorAll('[data-approve]'))el.onclick=()=>approve(el.dataset.approve,el.dataset.status);
 for(const el of document.querySelectorAll('[data-task]'))el.onclick=()=>taskStatus(el.dataset.task,el.dataset.state);
}
async function approve(id,status){try{await api('/api/approval',{id,status});await refresh();toast(status==='approved'?'تم الاعتماد وحفظ الإجراء':'تم رفض الاقتراح')}catch(e){toast(e.message)}}
async function taskStatus(id,status){try{await api('/api/task-status',{id,status});await refresh();toast('تم تحديث حالة المهمة')}catch(e){toast(e.message)}}
async function sendTurn(role,text,route='/api/agent',payload=null){if(busy)return;busy=true;$('sendBtn').disabled=true;$('voiceState').textContent='المدير يراجع طلبك الآن...';try{const result=await api(route,payload||{role,text});lastRun=result.runId;const o=result.output;await refresh();renderRecent();renderOutcome(o,result.mode);$('voiceState').textContent='اكتملت المراجعة';speak(o.speech);}catch(e){$('voiceState').textContent='تعذر الاتصال';toast(e.message)}finally{busy=false;$('sendBtn').disabled=false}}
$('sendBtn').onclick=()=>{const text=$('utterance').value.trim();if(!text){toast('تحدث أو أدخل وصفًا أولًا');return;}sendTurn(activeOffice,text)};
function renderOutcome(o,mode){const panel=$('agentOutcome');panel.hidden=false;const verdict={approve:'موافقة مبدئية',challenge:'اعتراض مهني',clarify:'مزيد من التوضيح'}[o.verdict]||'مراجعة';panel.innerHTML=`<span class="tag ${o.verdict==='challenge'?'warning':''}">${esc(verdict)} · ${mode==='demo'?'محاكاة — ليس AI':'رد AI حقيقي'}</span><h4>قرار المدير</h4><p>${esc(o.speech)}</p><p class="rationale">${esc(o.rationale)}</p><div class="action-row">${o.pendingId?`<button type="button" class="btn primary" id="acceptCurrent">اعتماد: ${esc(o.proposal?.title||'الاقتراح')}</button><button type="button" class="btn ghost" id="rejectCurrent">رفض</button>`:''}${activeOffice==='manager'?`<button type="button" class="btn ghost" id="escalateCurrent">مراجعة Director ↗</button>`:''}<button type="button" class="btn ghost" id="openOps">فتح مركز العمليات</button></div>`;
 if($('acceptCurrent'))$('acceptCurrent').onclick=async()=>{await approve(o.pendingId,'approved');panel.querySelector('.action-row').innerHTML='<span class="tag">تم الاعتماد — راجع مركز العمليات</span><button class="btn ghost" id="openOps2">فتح العمليات</button>';$('openOps2').onclick=()=>openPanel('board')};
 if($('rejectCurrent'))$('rejectCurrent').onclick=async()=>{await approve(o.pendingId,'rejected');openPanel('board')};
 if($('escalateCurrent'))$('escalateCurrent').onclick=()=>{if(!lastRun){toast('لا يوجد رد من Manager لتصعيده');return;}const managerRun=lastRun;openPanel('director');$('voiceState').textContent='جارٍ تصعيد قرار المدير...';sendTurn('director','','/api/escalate',{runId:managerRun})};
 if($('openOps'))$('openOps').onclick=()=>openPanel('board');
}
// Browser voice: recognition support varies by browser. Only activates on user action.
let recognizer=null;const recognitionCtor=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!recognitionCtor){$('speechSupport').textContent='TEXT FALLBACK';$('micBtn').disabled=true;$('micBtn').textContent='التعرف الصوتي غير مدعوم';}
else {$('speechSupport').textContent='VOICE AVAILABLE';}
$('micBtn').onclick=()=>{if(!recognitionCtor)return;stopAudio();try{recognizer=new recognitionCtor();recognizer.lang='ar-SA';recognizer.interimResults=false;recognizer.maxAlternatives=1;recognizer.onstart=()=>{$('voiceOrb').classList.add('listening');$('voiceState').textContent='أستمع إليك...'};recognizer.onresult=e=>{const text=e.results[0][0].transcript;$('utterance').value=text;toast('تم التعرف على الصوت؛ يجري إرسال الطلب');sendTurn(activeOffice,text)};recognizer.onerror=e=>{toast('تعذر التعرف على الصوت: '+e.error);$('voiceState').textContent='استخدم الإدخال النصي إن لزم'};recognizer.onend=()=>{$('voiceOrb').classList.remove('listening')};recognizer.start();}catch(e){toast('تعذر تشغيل الميكروفون: '+e.message)}};
function speak(text){if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ar-SA';u.rate=.97;u.pitch=.95;u.onstart=()=>{$('voiceOrb').classList.add('speaking')};u.onend=()=>{$('voiceOrb').classList.remove('speaking')};u.onerror=()=>{$('voiceOrb').classList.remove('speaking')};window.speechSynthesis.speak(u);}
function stopAudio(){if(recognizer){try{recognizer.abort()}catch{ }recognizer=null}if('speechSynthesis' in window)window.speechSynthesis.cancel();$('voiceOrb').classList.remove('listening','speaking')}
$('stopVoiceBtn').onclick=()=>{stopAudio();$('voiceState').textContent='تم إيقاف الصوت'};
refresh();

'use strict';
// Native Canvas2D isometric office if GPU/WebGL is blocked. Native WebGL remains the default renderer.
if (!gl) {
  const ctx=canvas.getContext('2d');
  const pal={ground:'#e6ebe4',floor:'#e9f0e9',shadow:'#8ca6a4',tile:'#dbe5db',manager:'#d2e6df',director:'#eadfd2',wall:'#75959a',glass:'#a9c7bd',wood:'#b99472',screen:'#30505b',leaf:'#548775',navy:'#35555f',line:'#bdccc2',warm:'#edbc7b',white:'#fcf8ed'};
  let ox=0,oy=0,scale=1,last=performance.now(),time=0;
  const pt=(x,z,h=0)=>[ox+(x-z)*17*scale,oy+(x+z)*7.8*scale-h*16*scale];
  function poly(coords,fill,stroke=null){ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=1.1*scale;ctx.strokeStyle=stroke;ctx.stroke();}}
  function isoRect(x,z,w,d,fill,stroke=null,h=.0){poly([pt(x-w/2,z-d/2,h),pt(x+w/2,z-d/2,h),pt(x+w/2,z+d/2,h),pt(x-w/2,z+d/2,h)],fill,stroke);}
  function prism(x,z,w,d,h,color,dark='#779b96',side='#a2b5b0',y=0){const tl=pt(x-w/2,z-d/2,y+h),tr=pt(x+w/2,z-d/2,y+h),br=pt(x+w/2,z+d/2,y+h),bl=pt(x-w/2,z+d/2,y+h);const blb=pt(x-w/2,z+d/2,y),brb=pt(x+w/2,z+d/2,y),trb=pt(x+w/2,z-d/2,y);poly([tl,tr,br,bl],color);poly([bl,br,brb,blb],dark);poly([tr,br,brb,trb],side);}
  function text3d(x,z,y,text,color='#ffffff',size=10){const p=pt(x,z,y);ctx.fillStyle=color;ctx.font=`bold ${size*scale}px system-ui`;ctx.textAlign='center';ctx.fillText(text,p[0],p[1]);}
  function person(x,z,primary,head='#dfb791',t=0){const p=pt(x,z);ctx.fillStyle='rgba(21,42,49,.15)';ctx.beginPath();ctx.ellipse(p[0],p[1]+1,12*scale,5*scale,0,0,2*Math.PI);ctx.fill();prism(x,z,.5,.34,1.05,primary,'#243e47','#3e6d67');const h=pt(x,z,1.53);ctx.beginPath();ctx.arc(h[0],h[1],6.5*scale,0,2*Math.PI);ctx.fillStyle=head;ctx.fill();prism(x,z-.06,.40,.29,.1,'#394e4d','#394e4d','#52605c',1.7)}
  function desk(x,z,wood=pal.wood){prism(x,z,3,1.22,.72,wood,'#947253','#cda583');prism(x,z-.22,.9,.12,.72,pal.screen,'#14333d','#4e7e7f',.75);prism(x,z+.9,.8,.8,.42,'#466b72','#38575a','#5b8385')}
  function plant(x,z,s=1){prism(x,z,.6*s,.6*s,.52,'#ae8a70','#846d55','#b59b83');const p=pt(x,z,.95*s);ctx.fillStyle='#43816d';ctx.beginPath();ctx.arc(p[0],p[1],9*s*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#78ad8b';ctx.beginPath();ctx.arc(p[0]-4*s*scale,p[1]-3*s*scale,5*s*scale,0,Math.PI*2);ctx.fill()}
  function resize(){const r=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*devicePixelRatio));canvas.height=Math.max(1,Math.round(r.height*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);const w=r.width,h=r.height;scale=Math.min(1.12,Math.max(.47,Math.min(w/1450,h/850)));ox=w*.51;oy=h*.46;}
  function render(now){const d=Math.min(.05,(now-last)/1000);last=now;time=now/1000;const r=canvas.getBoundingClientRect();ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,r.width,r.height);
    if($('overlay').hidden){let dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0);let dz=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);let length=Math.hypot(dx,dz);if(length){player.x=Math.max(-15,Math.min(15,player.x+dx/length*6*d));player.z=Math.max(-11,Math.min(11,player.z+dz/length*6*d));}}
    const gradient=ctx.createLinearGradient(0,0,r.width,r.height);gradient.addColorStop(0,'#b4d0d1');gradient.addColorStop(.55,'#e7e6d9');gradient.addColorStop(1,'#b3d1c6');ctx.fillStyle=gradient;ctx.fillRect(0,0,r.width,r.height);
    ctx.fillStyle='rgba(42,78,81,.16)';ctx.beginPath();ctx.ellipse(ox,oy+155*scale,520*scale,185*scale,0,0,Math.PI*2);ctx.fill();
    prism(0,0,35,26,.38,pal.floor,'#8a9f9b','#b4c5be');
    isoRect(-10,-4,14,15,pal.manager,'#aac6bd',.4);isoRect(10,-4,14,15,pal.director,'#cdbeb0',.4);isoRect(0,7,9,9,'#e3eee5',null,.42);isoRect(0,-8,10,7,'#b9d8cb',null,.42);
    // Floor tile accents and corridor
    for(let a=-12;a<=12;a+=2.6){isoRect(a,9,.035,4.2,'#cdded4',null,.44)}
    for(let a=-9;a<10;a+=1.4){isoRect(0,a,5,.024,'#c4d7cc',null,.43)}
    // Office partitions deliberately lowered to make work visible.
    prism(-10.1,2.7,13.4,.14,.82,'#9dbdb3','#77918b','#adc9bf',.40);
    prism(10.1,2.7,13.4,.14,.82,'#9dbdb3','#77918b','#adc9bf',.40);
    prism(-16.2,-4,.12,15,.93,'#a4bcb2','#74938a','#c9d6c9',.42);
    prism(16.2,-4,.12,15,.93,'#a4bcb2','#74938a','#c9d6c9',.42);
    prism(0,-12.4,32.4,.12,1.8,pal.wall,'#4d7077','#adc7bf',.4);
    for(let i=-14;i<=14;i+=3.1){prism(i,-12.25,2.45,.10,1.18,'#86b2b1','#497d7d','#a6d3cb',.52)}
    // Furnishings
    isoRect(-10,-4.3,7,7.4,'#ecf2e8',null,.47);isoRect(10,-4.3,7,7.4,'#f2e7da',null,.47);
    desk(-10,-5.25);desk(10,-5.25,'#a88163');
    prism(-14,-8,1.55,.7,.85,'#b6cfc1','#91b0a5','#c7ded1',.43);prism(14,-8,1.5,.7,.9,'#bca38e','#9d866f','#d4bca8',.43);
    for(let z of [-8,-6])prism(0,z,2.9,.9,.7,'#d3af90','#ab8a6e','#e8cbb0',.44);
    prism(0,-11.4,6.2,.12,1.95,'#254b54','#1e3e47','#406a70',.46);
    for(let i=0;i<5;i++)prism(-2.2+i*1.1,-11.2,.55,.055,.3+.1*((i*3)%4),i===3?'#e9b875':'#64aca5','#408482','#a0d7c7',1.4);
    plant(-14,-2);plant(-5,-9);plant(14,-2);plant(5,-9);plant(-5,7,1.15);plant(5,8,1.15);
    // people and focal markers
    person(-10,-3.3,'#245e59');person(10,-3.3,'#775c42');person(player.x,player.z,'#2a596c','#f1c6a0',time);
    const nearest=Object.entries(offices).map(([key,o])=>({key,distance:Math.hypot(player.x-o.x,player.z-o.z)})).sort((a,b)=>a.distance-b.distance)[0];nearby=nearest.distance<4?nearest.key:null;
    for(const [key,o] of Object.entries(offices)){const p=pt(o.x,o.z,2.55);const el=$('label-'+key);el.style.left=p[0]+'px';el.style.top=p[1]+'px';el.classList.toggle('near',nearby===key)}
    const mapX=50+player.x/35*100,mapY=50+player.z/26*100;$('mapPlayer').style.left=Math.min(96,Math.max(3,mapX))+'%';$('mapPlayer').style.top=Math.min(94,Math.max(3,mapY))+'%';$('nearbyText').textContent=nearby?'الموقع: '+offices[nearby].arabic:'تجوّل واقترب من أحد الموظفين';$('interactBtn').disabled=!nearby;$('interactBtn').textContent=nearby?'الدخول · E':'اقترب من أحد المكاتب';
    requestAnimationFrame(render);
  }
  resize();window.addEventListener('resize',resize);requestAnimationFrame(render);
}

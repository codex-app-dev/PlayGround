import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas=document.querySelector('#game'), map=document.querySelector('#map'), mctx=map.getContext('2d');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#09151b');scene.fog=new THREE.FogExp2('#09151b',.0038);
const camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,.1,900);
scene.add(new THREE.HemisphereLight('#a9c5d0','#14211d',1.85));
const moon=new THREE.DirectionalLight('#c4d9e3',2.2);moon.position.set(-80,120,40);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-90;moon.shadow.camera.right=90;moon.shadow.camera.top=90;moon.shadow.camera.bottom=-90;scene.add(moon);
const city=new THREE.Group();scene.add(city);
function box(parent,x,y,z,sx,sy,sz,color,opts={}){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color,roughness:opts.roughness??.86,metalness:opts.metalness??0,emissive:opts.emissive||0,emissiveIntensity:opts.ei||0}));m.position.set(x,y,z);m.castShadow=opts.shadow??false;m.receiveShadow=true;parent.add(m);return m}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(720,720),new THREE.MeshStandardMaterial({color:'#182523',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;city.add(ground);
// An orderly grid of streets, glowing lane paint, sidewalks and compact skyline blocks.
for(let n=-4;n<=4;n++){
 const p=n*80;
 box(city,p,.005,0,18,.04,640,'#202a2d');box(city,0,.005,p,640,.04,18,'#202a2d');
 for(let k=-300;k<=300;k+=24){box(city,p,.035,k, .16,.025,9,'#a5a58b');box(city,k,.035,p,9,.025,.16,'#a5a58b')}
 for(const side of [-1,1]){box(city,p+side*10.25,.04,0,2,.08,640,'#656b63');box(city,0,.04,p+side*10.25,640,.08,2,'#656b63')}
}
const bldgMats=['#35494b','#405356','#485352','#394c54','#514e45','#40545a'];
const windowInstances=[];
for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<=3;gz++){
 const cx=gx*80+40,cz=gz*80+40;
 // A small plaza/garden in a few blocks breaks up the city rhythm.
 if((gx===-1&&gz===1)||(gx===2&&gz===-2)){
  box(city,cx,.08,cz,49,.16,48,'#25352e');
  for(let i=0;i<8;i++){const tx=cx+(Math.random()-.5)*38,tz=cz+(Math.random()-.5)*38;box(city,tx,1.2,tz,1.1,2.4,1.1,'#655943');const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.15,1),new THREE.MeshStandardMaterial({color:'#315b47',roughness:1}));crown.position.set(tx,3.8,tz);city.add(crown)}
  continue;
 }
 const count=1+(Math.random()>.45?1:0);
 for(let i=0;i<count;i++){
  const w=17+Math.random()*18,d=17+Math.random()*18,h=13+Math.random()*50;
  const x=cx+(i===0?-12:12)+(Math.random()-.5)*5,z=cz+(Math.random()-.5)*22;
  const base=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:bldgMats[(Math.random()*bldgMats.length)|0],roughness:.88,emissive:'#142023',emissiveIntensity:.42}));base.position.set(x,h/2,z);base.castShadow=true;base.receiveShadow=true;city.add(base);
  box(city,x,h+.25,z,w+.5,.5,d+.5,'#202c30');
  // Repeated warm/cool lit windows on two facades.
  for(let floor=2;floor<h-2;floor+=3.4)for(let col=-w/2+2;col<w/2-1;col+=3.4){
   const lit=Math.random()>.54,color=lit?(Math.random()>.18?'#f2bd70':'#8bd6d1'):'#26363a';
   box(city,x+col,h-floor,z-d/2-.025,1.15,1.45,.07,color,{emissive:lit?color:0,ei:lit?.38:0});
   if(col < -w/2+3)box(city,x+w/2+.025,h-floor,z+col,.07,1.45,1.15,color,{emissive:lit?color:0,ei:lit?.38:0});
  }
  if(Math.random()>.72){const sign=box(city,x,h*.55,z-d/2-.2,w*.38,1.8,.22,Math.random()>.5?'#e4b947':'#db7356',{emissive:Math.random()>.5?'#c79324':'#b84739',ei:.75});}
 }
}
// Street lamps make the streets readable at night.
for(let n=-4;n<=4;n++)for(let k=-3;k<=3;k++)for(const side of [-1,1]){
 const x=n*80+side*12,z=k*80+12;
 box(city,x,3.2,z,.2,6.4,.2,'#59645e');box(city,x+1,6.2,z,.2,.18,2,'#59645e');
 if(side===1&&n%2===0&&k%2===0){const lamp=new THREE.PointLight('#ffd994',.72,24,2);lamp.position.set(x+1,5.9,z);scene.add(lamp);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),new THREE.MeshBasicMaterial({color:'#ffd994'}));glow.position.copy(lamp.position);scene.add(glow)}
}
// Taxi: hand-built low-poly yellow cab with glass, roof sign and bright lamps.
const taxi=new THREE.Group();scene.add(taxi);
const yellow=new THREE.MeshStandardMaterial({color:'#e4b72f',roughness:.48,metalness:.18}),black=new THREE.MeshStandardMaterial({color:'#12191b',roughness:.52}),glass=new THREE.MeshStandardMaterial({color:'#78a3a1',roughness:.2,metalness:.35,transparent:true,opacity:.83}),tire=new THREE.MeshStandardMaterial({color:'#101416',roughness:.95});
function cabbox(parent,sx,sy,sz,x,y,z,mat){const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
cabbox(taxi,2.05,.65,4.1,0,.78,0,yellow);cabbox(taxi,1.55,.72,2.1,0,1.42,.12,yellow);cabbox(taxi,1.46,.53,1.8,0,1.48,.13,glass);cabbox(taxi,.76,.18,.48,0,1.92,-.05,yellow);
cabbox(taxi,.7,.25,.24,0,2.12,-.08,new THREE.MeshStandardMaterial({color:'#fff1ab',emissive:'#ffde6b',emissiveIntensity:1.6}));
for(const x of [-.88,.88])for(const z of [-1.35,1.35]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.25,16),tire);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.43,z);wheel.castShadow=true;taxi.add(wheel)}
for(const x of [-.72,.72]){cabbox(taxi,.22,.2,.08,x,.87,-2.055,new THREE.MeshStandardMaterial({color:'#fff2d1',emissive:'#fff0c1',emissiveIntensity:2}));cabbox(taxi,.28,.18,.08,x,.85,2.055,new THREE.MeshStandardMaterial({color:'#dc4538',emissive:'#a9261f',emissiveIntensity:1.3}))}
const taxiSign=cabbox(taxi,.7,.22,.25,0,2.12,.18,new THREE.MeshStandardMaterial({color:'#d8ff58',emissive:'#94bb27',emissiveIntensity:1}));
taxi.position.set(0,0,0);taxi.rotation.y=0;
// A soft headlight wash points down the road ahead.
for(const x of [-.65,.65]){const l=new THREE.SpotLight('#fff0c8',90,48,Math.PI/6,.45,1.4);l.position.set(x,.8,-1.7);l.target.position.set(x,0,-16);taxi.add(l,l.target)}
// Light cross-town traffic gives the streets a little life.
const streets=[-240,-160,-80,0,80,160,240];
const traffic=[];const trafficColors=['#417b79','#b54f43','#c2a259','#657184','#d5d9d2'];
for(let i=0;i<9;i++){const car=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color:trafficColors[i%trafficColors.length],roughness:.48,metalness:.18});
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.65,.58,3.35),paint);body.position.y=.57;body.castShadow=true;car.add(body);
 const top=new THREE.Mesh(new THREE.BoxGeometry(1.28,.53,1.65),glass);top.position.set(0,1.05,.08);car.add(top);
 for(const x of [-.72,.72])for(const z of [-1.02,1.02]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.2,12),tire);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.34,z);car.add(wheel)}
 const lampMat=new THREE.MeshBasicMaterial({color:'#fff1c5'});for(const x of [-.53,.53]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.3,.18,.06),lampMat);lamp.position.set(x,.65,-1.7);car.add(lamp)}
 const axis=Math.random()<.5?'z':'x',dir=Math.random()<.5?1:-1,line=streets[(Math.random()*streets.length)|0];
 car.position.set(axis==='x'?Math.random()*560-280:line+(dir>0?3:-3),0,axis==='z'?Math.random()*560-280:line+(dir>0?3:-3));car.rotation.y=axis==='x'?(dir>0?-Math.PI/2:Math.PI/2):(dir>0?0:Math.PI);scene.add(car);traffic.push({car,axis,dir,speed:5+Math.random()*7})}
// Animated fare beacon.
const beacon=new THREE.Group();scene.add(beacon);const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.12,8,40),new THREE.MeshBasicMaterial({color:'#d8ff58'}));ring.rotation.x=Math.PI/2;beacon.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.55,4,12,1,true),new THREE.MeshBasicMaterial({color:'#d8ff58',transparent:true,opacity:.18,side:THREE.DoubleSide}));beam.position.y=2;beacon.add(beam);const beaconDot=new THREE.Mesh(new THREE.SphereGeometry(.45,12,10),new THREE.MeshBasicMaterial({color:'#f5ffb0'}));beaconDot.position.y=4.2;beacon.add(beaconDot);

const state={pos:new THREE.Vector3(0,0,0),yaw:0,speed:0,money:245,fares:0,rating:5,job:'pickup',target:new THREE.Vector3(),pickup:new THREE.Vector3(),drop:new THREE.Vector3(),fare:0,jobTime:0,near:false,toast:0};
function pointOnRoad(){const line=streets[(Math.random()*streets.length)|0];if(Math.random()<.5)return new THREE.Vector3(line,0,(Math.random()-.5)*500);return new THREE.Vector3((Math.random()-.5)*500,0,line)}
function newJob(){state.pickup=pointOnRoad();if(state.pickup.distanceTo(state.pos)<75)state.pickup=pointOnRoad();do{state.drop=pointOnRoad()}while(state.drop.distanceTo(state.pickup)<145);state.target.copy(state.pickup);state.job='pickup';state.jobTime=0;state.fare=Math.round(24+state.pickup.distanceTo(state.drop)*.62);beacon.position.set(state.target.x,0,state.target.z);updateUI()}
newJob();
const keys={};window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='e')interact();});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll('.touch button').forEach(b=>{const k=b.dataset.key;const on=e=>{e.preventDefault();keys[k]=true};const off=e=>{e.preventDefault();keys[k]=false;if(k==='e')interact()};b.addEventListener('pointerdown',on);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,off))});
function interact(){if(!state.near)return;if(state.job==='pickup'){state.job='drop';state.target.copy(state.drop);state.jobTime=0;state.toast=2.3;showToast('PASSENGER ON BOARD · TAKE THEM HOME');}else if(state.job==='drop'){const bonus=Math.round(Math.max(0,55-state.jobTime*.3));const earned=state.fare+bonus;state.money+=earned;state.fares++;state.rating=Math.min(5,Math.round((state.rating*9+4.8)*10)/100);state.toast=2.3;showToast(`FARE COMPLETE · +$${earned} · NICE DRIVING`);newJob();}updateUI()}
function showToast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2100)}
function el(id){return document.getElementById(id)}function updateUI(){if(state.job==='pickup'){el('missionTitle').textContent='Your next fare is waiting.';el('missionCopy').textContent='Pick up a passenger and take them across town. Clean driving earns a better tip.';el('missionState').textContent='● SEEK PASSENGER';el('fare').textContent=`$${state.fare} EST.`;el('routeSub').textContent='PICK UP THE PASSENGER';}else{el('missionTitle').textContent='Passenger on board.';el('missionCopy').textContent='Keep it smooth and get them to their destination before the night gets away.';el('missionState').textContent='● FARE IN PROGRESS';el('fare').textContent=`$${state.fare} + TIP`;el('routeSub').textContent='DROP OFF YOUR FARE';}el('wallet').innerHTML=`$${state.money}<em>.00</em>`;el('fares').textContent=String(state.fares).padStart(2,'0');el('rating').textContent=`★ ${state.rating.toFixed(1)}`;}
function toggleNear(){const d=state.pos.distanceTo(state.target);state.near=d<11;const h=el('hint');if(state.near){h.innerHTML=`<span class="key">E</span> ${state.job==='pickup'?'PICK UP PASSENGER':'COMPLETE FARE'}`;h.style.opacity=1}else{h.innerHTML='<span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> DRIVE &nbsp; <span class="key">SPACE</span> BRAKE &nbsp; <span class="key">E</span> PICK UP / DROP';h.style.opacity=1}if(d>4){el('distance').textContent=`${Math.max(1,Math.round(d))} M TO ${state.job==='pickup'?'PICKUP':'DROPOFF'}`;const dx=state.target.x-state.pos.x,dz=state.target.z-state.pos.z,bearing=Math.atan2(dx,-dz)-state.yaw;el('arrow').style.transform=`rotate(${bearing}rad)`}else{el('distance').textContent='ARRIVED · PRESS E'}}
function collides(x,z){for(const b of buildings){if(Math.abs(x-b.x)<b.w/2+1.25&&Math.abs(z-b.z)<b.d/2+1.7)return true}return Math.abs(x)>310||Math.abs(z)>310}
const buildings=[];city.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.position.y>10&&o.position.y<70){const p=o.position;const s=o.geometry.parameters;if(s.height>10)buildings.push({x:p.x,z:p.z,w:s.width,d:s.depth})}});

function drawMap(){const w=map.width,h=map.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#132124';mctx.fillRect(0,0,w,h);const sc=w/640;mctx.strokeStyle='#43504c';mctx.lineWidth=18*sc;for(let n=-4;n<=4;n++){const q=w/2+n*80*sc;mctx.beginPath();mctx.moveTo(q,0);mctx.lineTo(q,h);mctx.stroke();mctx.beginPath();mctx.moveTo(0,q);mctx.lineTo(w,q);mctx.stroke()}mctx.fillStyle='#536057';for(let x=-280;x<300;x+=80)for(let z=-280;z<300;z+=80)mctx.fillRect(w/2+(x+18)*sc,h/2+(z+18)*sc,44*sc,44*sc);const tx=w/2+state.target.x*sc,tz=h/2+state.target.z*sc;mctx.beginPath();mctx.arc(tx,tz,4.7,0,Math.PI*2);mctx.fillStyle='#d8ff58';mctx.fill();mctx.strokeStyle='#d8ff58';mctx.lineWidth=1;mctx.beginPath();mctx.arc(tx,tz,8,0,Math.PI*2);mctx.stroke();const px=w/2+state.pos.x*sc,pz=h/2+state.pos.z*sc;mctx.save();mctx.translate(px,pz);mctx.rotate(state.yaw);mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(0,-6);mctx.lineTo(4,5);mctx.lineTo(0,3);mctx.lineTo(-4,5);mctx.closePath();mctx.fill();mctx.restore()}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-last)/1000||0);last=now;
 const forward=keys.w||keys.arrowup,back=keys.s||keys.arrowdown,left=keys.a||keys.arrowleft,right=keys.d||keys.arrowright,brake=keys[' '];
 if(forward)state.speed=Math.min(31,state.speed+19*dt);else if(back)state.speed=Math.max(-9,state.speed-16*dt);else state.speed*=Math.pow(.985,dt*60);
 if(brake)state.speed*=Math.pow(.91,dt*60);
 const steering=(right?1:0)-(left?1:0);if(Math.abs(state.speed)>.3)state.yaw-=steering*1.65*dt*Math.sign(state.speed)*Math.min(1,Math.abs(state.speed)/5);
 const dx=-Math.sin(state.yaw)*state.speed*dt,dz=-Math.cos(state.yaw)*state.speed*dt;
 if(!collides(state.pos.x+dx,state.pos.z)){state.pos.x+=dx}else state.speed*=-.23;
 if(!collides(state.pos.x,state.pos.z+dz)){state.pos.z+=dz}else state.speed*=-.23;
 for(const t of traffic){if(t.axis==='x'){t.car.position.x+=t.speed*t.dir*dt;if(t.car.position.x>310)t.car.position.x=-310;if(t.car.position.x< -310)t.car.position.x=310}else{t.car.position.z+=t.speed*t.dir*dt;if(t.car.position.z>310)t.car.position.z=-310;if(t.car.position.z< -310)t.car.position.z=310}}
 taxi.position.copy(state.pos);taxi.rotation.y=state.yaw;
 const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));const wanted=state.pos.clone().addScaledVector(fwd,-9);wanted.y=5.1;camera.position.lerp(wanted,1-Math.pow(.001,dt));camera.lookAt(state.pos.clone().addScaledVector(fwd,4).add(new THREE.Vector3(0,1.3,0)));
 beacon.position.x=state.target.x;beacon.position.z=state.target.z;beacon.position.y=.12+Math.sin(now*.002)*.14;beacon.rotation.y=now*.0005;const pulse=1+Math.sin(now*.003)*.08;ring.scale.setScalar(pulse);
 state.jobTime+=state.job==='drop'?dt:0;toggleNear();el('speed').textContent=String(Math.round(Math.abs(state.speed)*3.25)).padStart(3,'0');el('gear').textContent=state.speed<-.5?'REVERSE · TAXI 04':Math.abs(state.speed)<.5?'PARKED · TAXI 04':'DRIVE · TAXI 04';drawMap();renderer.render(scene,camera)}
let last=performance.now();requestAnimationFrame(frame);
function resize(){renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();document.body.classList.toggle('mobile',innerWidth<760||matchMedia('(pointer:coarse)').matches)}window.addEventListener('resize',resize);resize();

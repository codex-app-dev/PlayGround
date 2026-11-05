import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas=document.querySelector('#scene'),mapCanvas=document.querySelector('#map'),mapCtx=mapCanvas.getContext('2d');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x09131d);scene.fog=new THREE.FogExp2(0x09131d,.00165);
const camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,.1,1500);
scene.add(new THREE.HemisphereLight(0x9db4c5,0x303239,2.1));
const moon=new THREE.DirectionalLight(0xc0d8eb,2.4);moon.position.set(-100,150,80);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-120;moon.shadow.camera.right=120;moon.shadow.camera.top=120;moon.shadow.camera.bottom=-120;scene.add(moon);
const warm=new THREE.PointLight(0xffbd63,48,120,2);warm.position.set(-20,25,-20);scene.add(warm);
const mat=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const groundMat=mat(0x27343a),roadMat=mat(0x30363a),sideMat=mat(0x50575a),lineMat=new THREE.MeshBasicMaterial({color:0xc2aa6d}),windowMat=new THREE.MeshStandardMaterial({color:0xa8d8dc,emissive:0x376b72,emissiveIntensity:1.8,roughness:.4}),darkWindow=new THREE.MeshStandardMaterial({color:0x172b33,emissive:0x0b181d,roughness:.35});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),groundMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
const WORLD=660,SP=120,ROAD=27;const boxGeo=new THREE.BoxGeometry(1,1,1);
function cube(parent,geo,material,x,y,z,sx,sy,sz){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
// Asphalt avenues and golden broken lane lines
for(let i=-5;i<=5;i++){
 let p=i*SP;
 const rx=new THREE.Mesh(new THREE.PlaneGeometry(1500,ROAD),roadMat);rx.rotation.x=-Math.PI/2;rx.position.set(0,.005,p);rx.receiveShadow=true;scene.add(rx);
 const rz=new THREE.Mesh(new THREE.PlaneGeometry(ROAD,1500),roadMat);rz.rotation.x=-Math.PI/2;rz.position.set(p,.006,0);rz.receiveShadow=true;scene.add(rz);
  // Clear center lanes and readable intersections; lane guidance comes from the street lamps.
 // sidewalks framing road
 for(const side of [-1,1]){const sx=new THREE.Mesh(new THREE.BoxGeometry(1500,.4,3),sideMat);sx.position.set(0,.02,p+side*16);scene.add(sx);const sz=new THREE.Mesh(new THREE.BoxGeometry(3,.4,1500),sideMat);sz.position.set(p+side*16,.02,0);scene.add(sz)}
}
// Repeated lane dashes are instanced so the whole city remains smooth on phones.
const dashCount=1000,dashMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(8,.045,.28),lineMat,dashCount),dummy=new THREE.Object3D();let dashIndex=0;
for(let i=-5;i<=5;i++){const p=i*SP;for(let t=-660;t<=660;t+=46){if(Math.abs(t/SP-Math.round(t/SP))<.24)continue;for(const side of [-1,1]){dummy.position.set(t,.05,p+side*5.5);dummy.rotation.set(0,0,0);dummy.updateMatrix();dashMesh.setMatrixAt(dashIndex++,dummy.matrix);dummy.position.set(p+side*5.5,.05,t);dummy.rotation.set(0,Math.PI/2,0);dummy.updateMatrix();dashMesh.setMatrixAt(dashIndex++,dummy.matrix)}}}
dashMesh.count=dashIndex;dashMesh.frustumCulled=false;scene.add(dashMesh);
const buildings=[];
const palette=[0x3c5057,0x4c575c,0x55595a,0x3b5055,0x62615b,0x46565c,0x635e52];
for(let ix=-5;ix<5;ix++)for(let iz=-5;iz<5;iz++){
 const cx=(ix+.5)*SP,cz=(iz+.5)*SP;
 // A block has two different low-poly buildings and a courtyard
 for(let n=0;n<2;n++){
  const x=cx+(n?24:-23)+(Math.random()-.5)*8,z=cz+(Math.random()-.5)*22;
  const w=30+Math.random()*20,d=32+Math.random()*20,h=18+Math.random()*65;
  const color=palette[Math.floor(Math.random()*palette.length)];const b=cube(scene,boxGeo,mat(color,.9),x,h/2,z,w,h,d);buildings.push({x,z,w,d});
  // Roof machinery and facade window strips add city detail
  cube(scene,boxGeo,mat(0x171f23),x,h+.7,z,w*.76,1.4,d*.78);
  for(let f=0;f<2;f++){
   const yy=4+f*Math.max(5,(h-9)/2); if(yy>h-2)continue;
   for(let side of [-1,1]){
    const winmat=Math.random()<.54?windowMat:darkWindow;
    const strip=cube(scene,boxGeo,winmat,x+side*(w/2+.03),yy,z,w*.64,.7,.08);strip.castShadow=false;
   }
   for(let side of [-1,1]){const strip=cube(scene,boxGeo,Math.random()<.3?windowMat:darkWindow,x,yy,z+side*(d/2+.03),.08,.7,d*.64);strip.castShadow=false;}
  }
  if(Math.random()<.25){const sign=cube(scene,boxGeo,mat(0xe4a84e,.45,.2),x,h*.58,z+d/2+.25,w*.6,2,.5);sign.material.emissive=new THREE.Color(0x7d3514);sign.material.emissiveIntensity=.45;}
 }
}
// Decorative street lamps at corners of every other block
const lampMat=new THREE.MeshStandardMaterial({color:0xffd48a,emissive:0xffa53e,emissiveIntensity:2});
for(let x=-5;x<=5;x+=2)for(let z=-5;z<=5;z+=2){for(const s of [-1,1]){const lx=x*SP+s*10,lz=z*SP+s*10;cube(scene,boxGeo,mat(0x303b40),lx,4,lz,.35,8,.35);const bulb=cube(scene,new THREE.SphereGeometry(.55,8,6),lampMat,lx,8,lz,.9,.9,.9);bulb.castShadow=false;}}
// distant skyline silhouettes and stars
const starGeo=new THREE.BufferGeometry(),starPos=[];for(let i=0;i<500;i++){starPos.push((Math.random()-.5)*1200,100+Math.random()*220,(Math.random()-.5)*1200)}starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x8ba7c2,size:.8,transparent:true,opacity:.8})));
// Taxi: sculpted little yellow cab with glass, lamps and four rotating wheels
const taxi=new THREE.Group();scene.add(taxi);const taxiYellow=mat(0xe2ac30,.38,.3),black=mat(0x11181c,.5,.1),glass=new THREE.MeshStandardMaterial({color:0x8db6bc,metalness:.28,roughness:.2,transparent:true,opacity:.8}),rubber=mat(0x101316,.9),lamp=new THREE.MeshStandardMaterial({color:0xffe6a3,emissive:0xffc247,emissiveIntensity:3});
cube(taxi,boxGeo,taxiYellow,0,.72,0,2.4,.75,4.4);cube(taxi,boxGeo,taxiYellow,0,1.22,-.18,1.8,.85,2.2);cube(taxi,boxGeo,glass,0,1.28,-.18,1.62,.65,2.02);cube(taxi,boxGeo,mat(0x181e20),0,1.67,-.2,1.1,.2,.65);cube(taxi,boxGeo,mat(0xffd765),0,1.8,-.2,.72,.08,.28);
for(const x of [-1,1]){cube(taxi,boxGeo,lamp,x*.91,.72,2.23,.42,.25,.08);cube(taxi,boxGeo,mat(0xb72d20),x*.91,.72,-2.23,.35,.2,.08)}
const wheels=[];for(const x of [-1.22,1.22])for(const z of [-1.35,1.35]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.28,12),rubber);w.rotation.z=Math.PI/2;w.position.set(x,.43,z);w.castShadow=true;taxi.add(w);wheels.push(w)}
const headlight1=new THREE.SpotLight(0xffe4ad,100,95,.38,.6,1.6);headlight1.position.set(-.7,1,2.1);headlight1.target.position.set(-.7,0,15);taxi.add(headlight1,headlight1.target);const headlight2=headlight1.clone();headlight2.position.x=.7;headlight2.target.position.x=.7;taxi.add(headlight2,headlight2.target);
const state={x:8,z:6,angle:0,speed:0,cash:0,rides:0,phase:'pickup',target:null,previous:null,missionTime:0};
taxi.position.set(state.x,0,state.z);
// Destination markers
const marker=new THREE.Group();scene.add(marker);const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.22,8,36),new THREE.MeshBasicMaterial({color:0xf6cb59}));ring.rotation.x=Math.PI/2;ring.position.y=.2;marker.add(ring);const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,10,12,1,true),new THREE.MeshBasicMaterial({color:0xf6cb59,transparent:true,opacity:.18,side:THREE.DoubleSide}));beacon.position.y=5;marker.add(beacon);const pin=new THREE.Mesh(new THREE.SphereGeometry(.55,12,10),new THREE.MeshBasicMaterial({color:0xffe198}));pin.position.y=10.4;marker.add(pin);
const cityNames=['ФИНАНСОВЫЙ КВАРТАЛ','СТАРЫЙ ПОРТ','НЕОНОВЫЙ РЯД','МАЛЕНЬКАЯ ТОКИО','ВОКЗАЛЬНЫЙ','МИДТАУН','НАБЕРЕЖНАЯ','НИЖНИЙ ГОРОД'];
function roadPoint(){let axis=Math.random()<.5?'x':'z';let lane=(Math.floor(Math.random()*11)-5)*SP+(Math.random()<.5?-6:6);let travel=(Math.random()*10-5)*SP+ (Math.random()<.5?-6:6);let p=axis==='x'?new THREE.Vector3(travel,0,lane):new THREE.Vector3(lane,0,travel);return p}
function pickTarget(){let p;for(let i=0;i<20;i++){p=roadPoint();if(!state.previous||p.distanceTo(state.previous)>210)break}state.target=p;marker.position.copy(p);marker.visible=true;}
pickTarget();
const pressed=new Set();window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();pressed.add(k);if(k==='r')resetCar()});window.addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>pressed.clear());
document.querySelectorAll('.pad').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();pressed.add(k);b.setPointerCapture(e.pointerId)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>pressed.delete(k))});
function has(...keys){return keys.some(k=>pressed.has(k))}
function resetCar(){state.x=8;state.z=6;state.angle=0;state.speed=0;taxi.position.set(state.x,0,state.z);taxi.rotation.y=0;state.missionTime=0;toast('СМЕНА ПРОДОЛЖАЕТСЯ','Маршрут обновлён');}
function toast(title,copy){document.querySelector('#toast-title').textContent=title;document.querySelector('#toast-copy').textContent=copy;const t=document.querySelector('#toast');t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function collides(x,z){for(const b of buildings){if(Math.abs(x-b.x)<b.w/2+1.35&&Math.abs(z-b.z)<b.d/2+1.8)return true}return Math.abs(x)>WORLD||Math.abs(z)>WORLD}
const clock=new THREE.Clock();let uiTick=0;
function update(dt){
 const throttle=has('w','arrowup')?1:0,reverse=has('s','arrowdown')?1:0,steer=(has('a','arrowleft')?1:0)-(has('d','arrowright')?1:0),brake=has(' ');
 const accelerating=throttle||reverse;
 if(throttle)state.speed=Math.min(35,state.speed+22*dt);else if(reverse)state.speed=Math.max(-12,state.speed-18*dt);else state.speed*=Math.exp(-1.25*dt);
 if(brake)state.speed*=Math.exp(-5*dt);
 if(Math.abs(state.speed)<.035)state.speed=0;
 const turnFactor=Math.min(1,Math.abs(state.speed)/5);state.angle-=steer*1.65*turnFactor*dt*Math.sign(state.speed||1);
 const nx=state.x+Math.sin(state.angle)*state.speed*dt,nz=state.z+Math.cos(state.angle)*state.speed*dt;
 if(!collides(nx,nz)){state.x=nx;state.z=nz}else{state.speed*=-.23;state.x+=Math.sin(state.angle)*state.speed*dt;state.z+=Math.cos(state.angle)*state.speed*dt}
 taxi.position.set(state.x,0, state.z);taxi.rotation.y=state.angle;
 wheels.forEach(w=>w.rotation.x-=state.speed*dt*1.8);
 // Headlights become visible at night and follow the car
 headlight1.intensity=headlight2.intensity=state.speed===0?65:100;
 if(state.target){const d=Math.hypot(state.x-state.target.x,state.z-state.target.z);marker.rotation.y+=dt*.8;marker.children[1].material.opacity=.12+.08*Math.sin(performance.now()*.003);if(d<9){
   if(state.phase==='pickup'){state.phase='dropoff';state.previous=state.target.clone();pickTarget();state.missionTime=0;setMission('ПАССАЖИР В САЛОНЕ','До места назначения',`Доставь клиента — не теряй время. Примерная поездка: ${Math.max(25,Math.round(d/4))} сек.`);toast('КЛИЕНТ НАЙДЕН','Заказ принят • доставь в точку');}
   else{const secs=Math.floor(state.missionTime),bonus=Math.max(0,Math.round(160-state.missionTime*1.15));const earned=220+bonus;state.cash+=earned;state.rides++;state.phase='pickup';state.previous=state.target.clone();pickTarget();setMission('СВОБОДНАЯ СМЕНА','Ищем пассажира','Новый клиент отмечен на карте. Подъедь к золотому маркеру, чтобы принять заказ.');toast('ПОЕЗДКА ЗАВЕРШЕНА',`+$${earned} • ${secs} сек • новый заказ`);}
 }}
 if(state.phase==='dropoff'){state.missionTime+=dt;if(state.missionTime>100){state.phase='pickup';state.previous=state.target.clone();pickTarget();setMission('КЛИЕНТ УЕХАЛ','Новый заказ','Время вышло — следующий пассажир уже ждёт.');toast('ЗАКАЗ ОТМЕНЁН','Следующий пассажир отмечен на карте')}}
 // Camera trails the cab with a little velocity-dependent look-ahead
 const forwardX=Math.sin(state.angle),forwardZ=Math.cos(state.angle),camDist=24+Math.min(8,Math.abs(state.speed)*.18);
 const desired=new THREE.Vector3(state.x-forwardX*camDist,15+Math.min(3,Math.abs(state.speed)*.08),state.z-forwardZ*camDist);
 camera.position.lerp(desired,1-Math.exp(-3.2*dt));camera.lookAt(state.x+forwardX*7,1.3,state.z+forwardZ*7);
 const mph=Math.round(Math.abs(state.speed)*3.6);document.querySelector('#speed').textContent=String(mph).padStart(3,'0');
 const heading=((Math.round((Math.atan2(forwardX,forwardZ)*180/Math.PI+360)%360)+360)%360);const dirs=['N','NE','E','SE','S','SW','W','NW'];document.querySelector('#bearing').textContent=`${dirs[Math.round(heading/45)%8]} • ${cityNames[Math.floor((state.x+WORLD)/(WORLD*2)*cityNames.length)]||'ЦЕНТР'}`;
 uiTick+=dt;if(uiTick>.12){uiTick=0;document.querySelector('#cash').textContent='$ '+state.cash.toLocaleString('en-US');document.querySelector('#rides').textContent=String(state.rides).padStart(2,'0');if(state.phase==='dropoff'){const left=Math.max(0,100-Math.floor(state.missionTime));document.querySelector('#mission-tag').textContent=`ПОЕЗДКА • ${left} СЕК`;}}
 drawMap();
}
function setMission(tag,title,copy){document.querySelector('#mission-tag').textContent=tag;document.querySelector('#mission-title').textContent=title;document.querySelector('#mission-copy').textContent=copy}
function drawMap(){const c=mapCtx,w=324,h=324,r=385,scale=w/(2*r);c.clearRect(0,0,w,h);c.fillStyle='#111d23';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(scale,scale);c.translate(-state.x,-state.z);
 c.fillStyle='#263138';for(let i=-5;i<=5;i++){const p=i*SP;c.fillRect(-800,p-ROAD/2,1600,ROAD);c.fillRect(p-ROAD/2,-800,ROAD,1600)}
 c.fillStyle='#46504e';for(const b of buildings)c.fillRect(b.x-b.w/2,b.z-b.d/2,b.w,b.d);
 if(state.target){c.beginPath();c.arc(state.target.x,state.target.z,7,0,Math.PI*2);c.fillStyle='#f6cb59';c.fill();c.beginPath();c.arc(state.target.x,state.target.z,13+Math.sin(performance.now()*.005)*2,0,Math.PI*2);c.strokeStyle='#f6cb5970';c.lineWidth=2;c.stroke()}
 c.translate(state.x,state.z);c.rotate(-state.angle);c.beginPath();c.moveTo(0,10);c.lineTo(-6,-6);c.lineTo(0,-3);c.lineTo(6,-6);c.closePath();c.fillStyle='#fff0ba';c.fill();c.strokeStyle='#111';c.lineWidth=1.5;c.stroke();c.restore();
}
function frame(){requestAnimationFrame(frame);const dt=Math.min(.04,clock.getDelta());update(dt);renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8))}window.addEventListener('resize',resize);
setMission('СВОБОДНАЯ СМЕНА','Ищем пассажира','Следуй к золотому маркеру. Подбери клиента и отвези его в точку назначения.');frame();

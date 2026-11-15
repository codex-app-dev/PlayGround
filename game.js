(() => {
  'use strict';
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { blue: $('blueScore'), orange: $('orangeScore'), clock: $('clock'), speed: $('speed'), boost: $('boostValue'), fill: $('boostFill'), ready: $('boostReady'), start: $('startOverlay'), pause: $('pauseOverlay'), end: $('endOverlay'), banner: $('eventBanner'), toast: $('toast'), pickup: $('pickupHint') };
  let W = 0, H = 0, dpr = 1, last = performance.now(), running = false, paused = false, ended = false, ballCam = true, soundOn = true, timeLeft = 300, scores = [0, 0], toastTimer = 0, bannerTimer = 0, goalPause = 0, audioCtx = null, engineOsc = null, engineGain = null;
  const keys = new Set();
  const arena = { halfW: 26, halfL: 40, wallH: 7, goalHalf: 7.2, goalH: 5.2 };
  const car = { x: 0, y: 13, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, boost: 100, grounded: true, jumpLock: false, color: '#38baff', accent: '#a3f1ff', team: 0, wheel: 0 };
  const bot = { x: 0, y: -15, z: 0, yaw: Math.PI, vx: 0, vy: 0, vz: 0, boost: 75, grounded: true, color: '#ff8648', accent: '#ffd0a5', team: 1, wheel: 0, think: 0 };
  const ball = { x: 0, y: 0, z: 1.7, vx: 0, vy: 0, vz: 0, r: 1.65, spin: 0, lastTouch: -1 };
  const pads = [];
  for (const x of [-21, -11, 0, 11, 21]) for (const y of [-30, -15, 15, 30]) pads.push({x,y,amount:(Math.abs(x)===21&&Math.abs(y)===30)?100:12,active:true,respawn:0,phase:Math.random()*6});
  const particles = [];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hypot = Math.hypot;
  const angleDiff = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
  function resize(){ dpr=Math.min(devicePixelRatio||1,2); W=innerWidth;H=innerHeight;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0); }
  addEventListener('resize',resize); resize();
  function startAudio(){ if(!soundOn)return; try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume(); if(!engineOsc){engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineOsc.type='sawtooth';engineOsc.frequency.value=55;engineGain.gain.value=.0001;engineOsc.connect(engineGain);engineGain.connect(audioCtx.destination);engineOsc.start();} }catch(e){} }
  function beep(freq=180,duration=.12,volume=.05){ if(!soundOn||!audioCtx)return; try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch(e){} }
  function showToast(text,duration=1.6){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=duration;}
  function showBanner(text,duration=1.15){ui.banner.innerHTML=`<span>${text}</span>`;ui.banner.classList.add('show');bannerTimer=duration;}
  function resetKickoff(){Object.assign(car,{x:0,y:13,z:0,yaw:0,vx:0,vy:0,vz:0,grounded:true});Object.assign(bot,{x:0,y:-15,z:0,yaw:Math.PI,vx:0,vy:0,vz:0,grounded:true});Object.assign(ball,{x:0,y:0,z:ball.r,vx:0,vy:0,vz:0,lastTouch:-1});goalPause=0;}
  function begin(){running=true;paused=false;ended=false;timeLeft=300;scores=[0,0];ui.blue.textContent='0';ui.orange.textContent='0';ui.start.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');resetKickoff();showBanner('GO!');startAudio();last=performance.now();}
  function togglePause(){if(!running||ended)return;paused=!paused;ui.pause.classList.toggle('hidden',!paused);if(!paused)last=performance.now();}
  $('playButton').addEventListener('click',begin);$('resumeButton').addEventListener('click',togglePause);$('pauseButton').addEventListener('click',togglePause);$('restartButton').addEventListener('click',begin);$('rematchButton').addEventListener('click',begin);
  $('ballCamToggle').addEventListener('click',()=>{ballCam=!ballCam;$('ballCamLabel').textContent=ballCam?'ON':'OFF';showToast(ballCam?'BALL CAM ON':'BALL CAM OFF',1)});
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundButton').querySelector('span:last-child').textContent=soundOn?'SOUND ON':'SOUND OFF';$('soundButton').querySelector('.sound-icon').textContent=soundOn?'♪':'×';if(soundOn)startAudio();else if(engineGain&&audioCtx)engineGain.gain.setTargetAtTime(.0001,audioCtx.currentTime,.04)});
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Shift'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key==='Escape'){togglePause();}if(e.key.toLowerCase()==='v'&&!e.repeat){ballCam=!ballCam;$('ballCamLabel').textContent=ballCam?'ON':'OFF';}if(e.key.toLowerCase()==='r'&&!e.repeat&&running){resetKickoff();showToast('KICKOFF RESET');}});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  const pressed=(...k)=>k.some(x=>keys.has(x));
  function carForward(o){return {x:Math.sin(o.yaw),y:-Math.cos(o.yaw)}}
  function drive(o,dt,isBot=false){
    const f=carForward(o); const speed=o.vx*f.x+o.vy*f.y;
    if(!isBot){
      const throttle=(pressed('w','arrowup')?1:0)-(pressed('s','arrowdown')?1:0);
      const steer=(pressed('d','arrowright')?1:0)-(pressed('a','arrowleft')?1:0);
      const boosting=pressed('shift')&&o.boost>0&&throttle>=0;
      if(throttle){const accel=boosting?37:22;o.vx+=f.x*accel*throttle*dt;o.vy+=f.y*accel*throttle*dt;}
      if(boosting){o.boost=Math.max(0,o.boost-35*dt);o.vx+=f.x*26*dt;o.vy+=f.y*26*dt;if(Math.random()<.7)emit(o.x-f.x*1.7,o.y-f.y*1.7,.35, o.color);}
      const grip=clamp(Math.abs(speed)/7,.17,1);o.yaw+=steer*2.35*grip*Math.sign(speed||1)*dt;
    }else{
      o.think-=dt;if(o.think<=0){o.think=.18+Math.random()*.15;const targetY=ball.y+Math.sign(0-ball.y)*2.4;const targetX=ball.x+(ball.x-o.x)*.18;const desired=Math.atan2(targetX-o.x,-(targetY-o.y));o.targetYaw=desired;}
      const diff=angleDiff(o.yaw,o.targetYaw||Math.PI),speedNow=hypot(o.vx,o.vy);o.yaw+=clamp(diff,-2.05*dt,2.05*dt);
      const facing=Math.cos(diff);const go=facing<-.25?-0.35:1;const ff=carForward(o);o.vx+=ff.x*20*go*dt;o.vy+=ff.y*20*go*dt;
      if(hypot(ball.x-o.x,ball.y-o.y)<9&&o.boost>4&&Math.abs(diff)<.45){o.vx+=ff.x*24*dt;o.vy+=ff.y*24*dt;o.boost-=18*dt;}
    }
    const max=isBot?23: (pressed('shift')&&o.boost>0?33:26);let s=hypot(o.vx,o.vy);if(s>max){o.vx*=max/s;o.vy*=max/s;}
    const drag=Math.pow(isBot?.987:.99,dt*60);o.vx*=drag;o.vy*=drag;
    if(!isBot&&!pressed('w','arrowup','s','arrowdown')){o.vx*=Math.pow(.972,dt*60);o.vy*=Math.pow(.972,dt*60);}
    o.x+=o.vx*dt;o.y+=o.vy*dt;
    o.wheel+=s*dt;
    if(o.z>0){o.vz-=19*dt;o.z+=o.vz*dt;if(o.z<=0){o.z=0;o.vz=0;o.grounded=true;}}
    const jump=!isBot&&pressed(' ');if(jump&&o.grounded&&!o.jumpLock){o.vz=8.5;o.z=.01;o.grounded=false;o.jumpLock=true;beep(260,.08,.018);}if(!jump)o.jumpLock=false;
    if(o.x>arena.halfW-1.6){o.x=arena.halfW-1.6;o.vx=-Math.abs(o.vx)*.3;}if(o.x< -arena.halfW+1.6){o.x=-arena.halfW+1.6;o.vx=Math.abs(o.vx)*.3;}
    if(o.y>arena.halfL-1.8){o.y=arena.halfL-1.8;o.vy=-Math.abs(o.vy)*.3;}if(o.y< -arena.halfL+1.8){o.y=-arena.halfL+1.8;o.vy=Math.abs(o.vy)*.3;}
  }
  function emit(x,y,z,color){particles.push({x,y,z,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,vz:Math.random()*2,life:.45+Math.random()*.35,max:.8,color});}
  function updateBall(dt){
    ball.vz-=15*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.z+=ball.vz*dt;ball.spin+=hypot(ball.vx,ball.vy)*dt*.12;
    const drag=Math.pow(.997,dt*60);ball.vx*=drag;ball.vy*=drag;
    if(ball.z<ball.r){ball.z=ball.r;if(ball.vz< -1.1){ball.vz=-ball.vz*.62;ball.vx*=.96;ball.vy*=.96;}else ball.vz=0;}
    if(Math.abs(ball.x)>arena.halfW-ball.r){ball.x=Math.sign(ball.x)*(arena.halfW-ball.r);ball.vx=-ball.vx*.78;ball.vy*=.94;beep(130,.04,.008);}
    if(Math.abs(ball.y)>arena.halfL-ball.r){
      const inGoal=Math.abs(ball.x)<arena.goalHalf-ball.r*.35&&ball.z<arena.goalH;
      if(inGoal){score(ball.y<0?0:1);return;}
      ball.y=Math.sign(ball.y)*(arena.halfL-ball.r);ball.vy=-ball.vy*.78;ball.vx*=.94;
    }
    for(const o of [car,bot]){
      const dx=ball.x-o.x,dy=ball.y-o.y,dist=hypot(dx,dy),min=ball.r+1.65;
      if(dist<min&&ball.z<o.z+2.35&&ball.z+ball.r>o.z){const nx=dx/(dist||1),ny=dy/(dist||1);const overlap=min-dist;ball.x+=nx*overlap;ball.y+=ny*overlap;const rvx=ball.vx-o.vx*.42,rvy=ball.vy-o.vy*.42;const impact=Math.max(0,rvx*nx+rvy*ny);ball.vx+=nx*(4.5+impact*.92)+o.vx*.32;ball.vy+=ny*(4.5+impact*.92)+o.vy*.32;ball.vz=Math.max(ball.vz,2.1+Math.min(5,hypot(o.vx,o.vy)*.13)+(o.z>0?2:0));ball.lastTouch=o.team;beep(220+Math.random()*80,.08,.045);for(let i=0;i<8;i++)emit(ball.x,ball.y,ball.z,'#eafaff');}
    }
    for(const p of pads){if(!p.active){p.respawn-=dt;if(p.respawn<=0)p.active=true;continue;}if(hypot(car.x-p.x,car.y-p.y)<2.1){car.boost=Math.min(100,car.boost+p.amount);p.active=false;p.respawn=p.amount===100?10:4.7;ui.pickup.classList.add('show');setTimeout(()=>ui.pickup.classList.remove('show'),650);beep(500,.12,.028);}
      if(isBotClose(p,bot)){bot.boost=Math.min(100,bot.boost+p.amount*.5);p.active=false;p.respawn=p.amount===100?10:4.7;}}
  }
  function isBotClose(p,o){return hypot(o.x-p.x,o.y-p.y)<1.9;}
  function score(team){scores[team]++;ui.blue.textContent=scores[0];ui.orange.textContent=scores[1];showBanner('GOAL!',1.7);beep(620,.35,.08);goalPause=2.2;resetPositionsAfterGoal();}
  function resetPositionsAfterGoal(){Object.assign(car,{x:0,y:13,z:0,yaw:0,vx:0,vy:0,vz:0,grounded:true});Object.assign(bot,{x:0,y:-15,z:0,yaw:Math.PI,vx:0,vy:0,vz:0,grounded:true});Object.assign(ball,{x:0,y:0,z:ball.r,vx:0,vy:0,vz:0});}
  function physics(dt){if(!running||paused||ended)return;if(goalPause>0){goalPause-=dt;if(goalPause<=0)showBanner('GO!',.9);return;}timeLeft=Math.max(0,timeLeft-dt);if(timeLeft===0){ended=true;ui.end.classList.remove('hidden');$('finalScore').textContent=`ORBITAL ${scores[0]} — ${scores[1]} SOLARIS`;const title=scores[0]===scores[1]?'A DEAD<br><em>HEAT.</em>':scores[0]>scores[1]?'VICTORY<br><em>IS YOURS.</em>':'THEY GOT<br><em>AWAY.</em>';$('finalTitle').innerHTML=title;}
    drive(car,dt);drive(bot,dt,true);updateBall(dt);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=4*dt;if(p.life<=0)particles.splice(i,1);}
    if(engineOsc&&audioCtx){const speed=hypot(car.vx,car.vy);engineOsc.frequency.setTargetAtTime(52+speed*3.4,audioCtx.currentTime,.08);engineGain.gain.setTargetAtTime(soundOn?(speed>.5?.012:.0001):.0001,audioCtx.currentTime,.12);}
    ui.speed.textContent=String(Math.round(hypot(car.vx,car.vy)*9)).padStart(3,'0');ui.boost.textContent=Math.round(car.boost);ui.fill.style.width=car.boost+'%';ui.ready.classList.toggle('empty',car.boost<10);ui.ready.textContent=car.boost>=10?'● BOOST READY':'○ RECHARGING';
  }
  function project(x,y,z,camera){const dx=x-camera.x,dy=y-camera.y;const lateral=dx*camera.rx+dy*camera.ry;const forward=dx*camera.fx+dy*camera.fy;const depth=forward*camera.cp+(z-camera.z)*camera.sp;if(depth<.18)return null;const vert=-forward*camera.sp+(z-camera.z)*camera.cp;const focal=Math.min(W,H)*.92;return {x:W*.5+lateral*focal/depth,y:H*.53-vert*focal/depth,scale:focal/depth,depth};}
  function cameraState(){let yaw=car.yaw;if(ballCam){const want=Math.atan2(ball.x-car.x,-(ball.y-car.y));yaw+=angleDiff(yaw,want)*.16;}const fx=Math.sin(yaw),fy=-Math.cos(yaw),rx=Math.cos(yaw),ry=Math.sin(yaw);const camera={x:car.x-fx*10.8,y:car.y-fy*10.8,z:7.7,fx,fy,rx,ry,pitch:Math.atan2(7.7,16.5)};camera.cp=Math.cos(camera.pitch);camera.sp=Math.sin(camera.pitch);return camera;}
  function poly(points,fill,stroke=null,width=1){ctx.beginPath();let started=false;for(const p of points){if(!p){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function line3(a,b,camera,color,width=1){const p=project(a[0],a[1],a[2]||0,camera),q=project(b[0],b[1],b[2]||0,camera);if(!p||!q)return;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function ellipseGround(x,y,rx,ry,color,camera){const a=project(x-rx,y,0,camera),b=project(x+rx,y,0,camera),c=project(x,y-ry,0,camera),d=project(x,y+ry,0,camera);if(!a||!b||!c||!d)return;ctx.beginPath();ctx.ellipse((a.x+b.x+c.x+d.x)/4,(a.y+b.y+c.y+d.y)/4,Math.max(1,(b.x-a.x)/2),Math.max(1,(d.y-c.y)/2),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function drawBackground(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#071522');g.addColorStop(.38,'#123247');g.addColorStop(.66,'#345466');g.addColorStop(1,'#18303b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(W*.5,H*.33,8,W*.5,H*.36,H*.68);glow.addColorStop(0,'rgba(76,179,220,.2)');glow.addColorStop(1,'rgba(5,15,23,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    const horizon=H*.37;ctx.fillStyle='#06131c';ctx.fillRect(0,horizon,W,H*.2);
    for(let i=0;i<150;i++){const x=((i*97.3)%W),y=horizon+((i*37.7)%Math.max(40,H*.19));const r=1+(i%3)*.35;ctx.fillStyle=['#29c8ff','#ff9e54','#dafbff','#4398b4'][i%4];ctx.globalAlpha=.25+(i%5)*.07;ctx.fillRect(x,y,r*2,r); }ctx.globalAlpha=1;
    for(let i=0;i<9;i++){let x=i*W/8;ctx.strokeStyle='rgba(104,203,235,.12)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,H*.03);ctx.lineTo(W*.5+(x-W*.5)*.54,horizon+12);ctx.stroke();}
    ctx.strokeStyle='rgba(102,202,234,.23)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,horizon+5);ctx.lineTo(W,horizon+5);ctx.stroke();
    const lampY=H*.30;for(const side of [0,W]){ctx.fillStyle='rgba(189,241,255,.7)';ctx.shadowColor='#69dfff';ctx.shadowBlur=22;ctx.fillRect(side===0?W*.08:W*.91,lampY,side===0?3:-3,3);ctx.shadowBlur=0;}
  }
  function drawField(camera){
    const corners=[[-arena.halfW,-arena.halfL,0],[arena.halfW,-arena.halfL,0],[arena.halfW,arena.halfL,0],[-arena.halfW,arena.halfL,0]].map(p=>project(...p,camera));poly(corners,'#183c3d');
    for(let i=0;i<16;i++){const ya=-arena.halfL+i*5, yb=ya+5;const color=i%2?'#245448':'#285d4c';poly([[-arena.halfW,ya,0],[arena.halfW,ya,0],[arena.halfW,yb,0],[-arena.halfW,yb,0]].map(p=>project(...p,camera)),color);}
    // side and end walls
    for(const x of [-arena.halfW,arena.halfW]){poly([[x,-arena.halfL,0],[x,arena.halfL,0],[x,arena.halfL,arena.wallH],[x,-arena.halfL,arena.wallH]].map(p=>project(...p,camera)),'rgba(44,150,178,.12)','rgba(119,222,247,.35)',1.2);}
    for(const y of [-arena.halfL,arena.halfL]){poly([[-arena.halfW,y,0],[arena.halfW,y,0],[arena.halfW,y,arena.wallH],[-arena.halfW,y,arena.wallH]].map(p=>project(...p,camera)),'rgba(44,150,178,.13)','rgba(119,222,247,.34)',1.2);}
    // walls' glass lattice and led strips
    for(let x=-24;x<=24;x+=4){for(const y of [-arena.halfL,arena.halfL])line3([x,y,0],[x,y,arena.wallH],camera,'rgba(146,229,255,.35)',1);}
    for(let y=-36;y<=36;y+=4){for(const x of [-arena.halfW,arena.halfW])line3([x,y,0],[x,y,arena.wallH],camera,'rgba(146,229,255,.28)',1);}
    line3([-arena.halfW,-arena.halfL,5.7],[arena.halfW,-arena.halfL,5.7],camera,'rgba(74,204,255,.68)',2);line3([-arena.halfW,arena.halfL,5.7],[arena.halfW,arena.halfL,5.7],camera,'rgba(255,144,74,.68)',2);
    // pitch markings
    const white='rgba(225,255,255,.74)',faint='rgba(195,241,244,.28)';
    line3([-arena.halfW+1,0,0],[arena.halfW-1,0,0],camera,white,2);
    line3([-arena.halfW+2,-arena.halfL+3,0],[arena.halfW-2,-arena.halfL+3,0],camera,faint,1.4);line3([-arena.halfW+2,arena.halfL-3,0],[arena.halfW-2,arena.halfL-3,0],camera,faint,1.4);
    line3([-arena.halfW+2,-arena.halfL+3,0],[-arena.halfW+2,arena.halfL-3,0],camera,faint,1.4);line3([arena.halfW-2,-arena.halfL+3,0],[arena.halfW-2,arena.halfL-3,0],camera,faint,1.4);
    circleLine(0,0,8,camera,white);circleLine(0,0,1.2,camera,white);
    for(const y of [-27,27]){line3([-9,y,0],[9,y,0],camera,faint,1.5);line3([-9,y,0],[-9,y+Math.sign(-y)*5,0],camera,faint,1.5);line3([9,y,0],[9,y+Math.sign(-y)*5,0],camera,faint,1.5);}
    // goal mouths with frames and luminous nets
    for(const sy of [-1,1]){const gy=sy*arena.halfL;const col=sy<0?'#55d8ff':'#ff995d';const back=sy*(arena.halfL+5);poly([[-arena.goalHalf,gy,0],[arena.goalHalf,gy,0],[arena.goalHalf,gy,arena.goalH],[-arena.goalHalf,gy,arena.goalH]].map(p=>project(...p,camera)),'rgba(103,218,255,.10)',col,3);
      line3([-arena.goalHalf,gy,0],[-arena.goalHalf,back,0],camera,col,2);line3([arena.goalHalf,gy,0],[arena.goalHalf,back,0],camera,col,2);line3([-arena.goalHalf,gy,arena.goalH],[-arena.goalHalf,back,arena.goalH],camera,col,1);line3([arena.goalHalf,gy,arena.goalH],[arena.goalHalf,back,arena.goalH],camera,col,1);line3([-arena.goalHalf,back,0],[arena.goalHalf,back,0],camera,col,1.5);line3([-arena.goalHalf,back,arena.goalH],[arena.goalHalf,back,arena.goalH],camera,col,1.5);
      for(let x=-6;x<=6;x+=3)line3([x,gy,0],[x,back,arena.goalH],camera,'rgba(180,240,255,.19)',.8);for(let z=1;z<5;z+=1)line3([-arena.goalHalf,gy+sy*1,z],[arena.goalHalf,gy+sy*1,z],camera,'rgba(180,240,255,.18)',.8);
    }
  }
  function circleLine(cx,cy,r,camera,color){let prev=null;for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;const p=[cx+Math.cos(a)*r,cy+Math.sin(a)*r,0];if(prev)line3(prev,p,camera,color,1.5);prev=p;}}
  function drawPads(camera,t){for(const p of pads){const base=project(p.x,p.y,.03,camera);if(!base)continue;const s=base.scale;ellipseGround(p.x,p.y,1.12,1.12,p.active?'rgba(0,0,0,.33)':'rgba(0,0,0,.14)',camera);if(!p.active)continue;const bob=.12+Math.sin(t*2+p.phase)*.12;const q=project(p.x,p.y,bob,camera);const r=Math.max(2,s*(p.amount===100?1.05:.56));ctx.save();ctx.translate(q.x,q.y);ctx.rotate(t*.35+p.phase);ctx.shadowColor=p.amount===100?'#ffbf57':'#48dfff';ctx.shadowBlur=r*2;ctx.strokeStyle=p.amount===100?'#ffbf62':'#6deaff';ctx.lineWidth=Math.max(1,r*.14);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle=p.amount===100?'rgba(255,170,54,.36)':'rgba(42,200,255,.25)';ctx.beginPath();ctx.arc(0,0,r*.65,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-r*.34,0);ctx.lineTo(0,-r*.4);ctx.lineTo(r*.34,0);ctx.lineTo(0,r*.4);ctx.closePath();ctx.fillStyle='#e7fcff';ctx.fill();ctx.restore();}}
  function drawCar(o,camera,t,isBot=false){const f=carForward(o),r={x:Math.cos(o.yaw),y:Math.sin(o.yaw)};const z=o.z||0;ellipseGround(o.x,o.y,2.1,2.7,'rgba(0,0,0,.4)',camera);
    // tires
    for(const side of [-1,1])for(const front of [-1,1]){const wx=o.x+r.x*side*1.02+f.x*front*1.05,wy=o.y+r.y*side*1.02+f.y*front*1.05;const pts=[[-.34,-.57],[.34,-.57],[.34,.57],[-.34,.57]].map(([a,b])=>project(wx+r.x*a+f.x*b,wy+r.y*a+f.y*b,z+.28,camera));poly(pts,'#07121b','#617985',.7);}
    const point=(side,along,height)=>project(o.x+r.x*side+f.x*along,o.y+r.y*side+f.y*along,z+height,camera);
    const body=[point(-1.06,-1.75,.52),point(1.06,-1.75,.52),point(1.15,.85,.58),point(.8,1.75,.52),point(-.8,1.75,.52),point(-1.15,.85,.58)];
    const shade=ctx.createLinearGradient(body[0]?.x||0,body[0]?.y||0,body[3]?.x||0,body[3]?.y||0);shade.addColorStop(0,o.color);shade.addColorStop(.55,isBot?'#ed6636':'#1884d3');shade.addColorStop(1,isBot?'#963a2e':'#135178');poly(body,shade,'rgba(230,250,255,.68)',1.1);
    poly([point(-.73,.63,.64),point(.73,.63,.64),point(.57,-.72,1.22),point(-.57,-.72,1.22)],isBot?'#ffe0c5':'#c6f6ff','rgba(255,255,255,.55)',.8);
    poly([point(-.62,-.72,1.23),point(.62,-.72,1.23),point(.72,-1.2,.88),point(-.72,-1.2,.88)],isBot?'#553c3a':'#10334d');
    // hood stripes and lights
    line3([o.x-r.x*.22+f.x*.1,o.y-r.y*.22+f.y*.1,z+.63],[o.x-r.x*.22+f.x*1.42,o.y-r.y*.22+f.y*1.42,z+.56],camera,o.accent,2);
    line3([o.x+r.x*.22+f.x*.1,o.y+r.y*.22+f.y*.1,z+.63],[o.x+r.x*.22+f.x*1.42,o.y+r.y*.22+f.y*1.42,z+.56],camera,o.accent,2);
    for(const side of [-1,1]){const p=point(side*.76,1.53,.61);if(p){ctx.fillStyle=isBot?'#ffe3bd':'#dfffff';ctx.shadowColor=isBot?'#ff9b50':'#53dfff';ctx.shadowBlur=10;ctx.fillRect(p.x-4,p.y-2,8,3);ctx.shadowBlur=0;}}
    if(pressed('shift')&&!isBot&&o.boost>0){for(const side of [-.42,.42]){const p=point(side,-1.9,.45);if(p){const grad=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,16);grad.addColorStop(0,'#fff');grad.addColorStop(.25,'#68eaff');grad.addColorStop(1,'rgba(25,150,255,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(p.x,p.y+5,7+Math.random()*4,16+Math.random()*7,0,0,Math.PI*2);ctx.fill();}}}
    // team accent chevron
    const tag=project(o.x,o.y,z+2.3,camera);if(tag&&tag.depth<46){ctx.fillStyle=isBot?'#ffab70':'#71e7ff';ctx.font='700 9px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(isBot?'SOLARIS':'YOU',tag.x,tag.y-8);}
  }
  function drawBall(camera){ellipseGround(ball.x,ball.y,2.1,2.1,'rgba(0,0,0,.42)',camera);const p=project(ball.x,ball.y,ball.z,camera);if(!p)return;const r=Math.max(3,ball.r*p.scale);const grad=ctx.createRadialGradient(p.x-r*.3,p.y-r*.4,r*.05,p.x,p.y,r);grad.addColorStop(0,'#fff');grad.addColorStop(.34,'#e7edf0');grad.addColorStop(.74,'#9aa9ae');grad.addColorStop(1,'#53636a');ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.clip();ctx.fillStyle=grad;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    // rotating dark pentagon-esque panels
    ctx.translate(p.x,p.y);ctx.rotate(ball.spin);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();for(let j=0;j<5;j++){const aa=a+j*Math.PI*2/5;const rr=r*(j%2?.39:.53);if(j===0)ctx.moveTo(Math.cos(aa)*rr,Math.sin(aa)*rr);else ctx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr);}ctx.closePath();ctx.fillStyle=i%2?'rgba(39,53,60,.75)':'rgba(63,77,82,.6)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=Math.max(.5,r*.025);ctx.stroke();}ctx.restore();ctx.beginPath();ctx.arc(p.x-r*.28,p.y-r*.34,r*.12,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fill();ctx.restore();
  }
  function drawParticles(camera){for(const p of particles){const q=project(p.x,p.y,p.z,camera);if(!q)continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,q.scale*.15),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.globalAlpha=1;}
  function render(now){const t=now/1000;drawBackground();const camera=cameraState();drawField(camera);drawPads(camera,t);
    // Depth sort props for convincing overlap
    const actors=[{obj:car,bot:false,y:car.y},{obj:bot,bot:true,y:bot.y}].sort((a,b)=>b.y-a.y);for(const a of actors)drawCar(a.obj,camera,t,a.bot);drawBall(camera);drawParticles(camera);
    // subtle floating ball cam reticle
    const target=project(ball.x,ball.y,ball.z+ball.r+1.4,camera);if(target&&target.depth<55){ctx.strokeStyle='rgba(211,250,255,.43)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(target.x,target.y,Math.max(5,7*target.scale),0,Math.PI*2);ctx.stroke();}
    if(running&&!ended){const mins=Math.floor(timeLeft/60),secs=Math.floor(timeLeft%60);ui.clock.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;}else if(!running)ui.clock.textContent='05:00';
  }
  function frame(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if(bannerTimer>0){bannerTimer-=dt;if(bannerTimer<=0)ui.banner.classList.remove('show');}if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}physics(dt);render(now);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();

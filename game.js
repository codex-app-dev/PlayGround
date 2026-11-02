(() => {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { score:$('score'), timer:$('timer'), cores:$('cores'), distance:$('distanceFill'), pips:$('healthPips'), phase:$('phaseFill'), phaseText:$('phaseText'), start:$('startOverlay'), end:$('endOverlay'), surge:$('surgeBanner'), surgeMessage:$('surgeMessage'), toast:$('toast'), finalScore:$('finalScore'), finalCores:$('finalCores'), endTitle:$('endTitle'), endCopy:$('endCopy'), endKicker:$('endKicker') };
  const C = { cyan:'#68f2f5', orange:'#ff875d', violet:'#b38aff', dark:'#09111e' };
  let W=0,H=0,dpr=1,last=0,stars=[],state='intro',player,objects,shots,particles,gameTime,spawnClock,shotClock,surgeClock,surgeActive,surgeLane,score,cores,health,phaseCooldown,phaseTime,invulnerable,toastTime,shake,best=0,soundOn=false,audio;
  function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);stars=Array.from({length:Math.floor(W*H/7000)},()=>({x:Math.random()*W,y:Math.random()*H*.48,r:Math.random()*1.4+.25,a:Math.random()*.65+.12,tw:Math.random()*4+1}));}
  window.addEventListener('resize',resize);resize();
  function reset(){player={lane:1,visualLane:1};objects=[];shots=[];particles=[];gameTime=0;spawnClock=.8;shotClock=0;surgeClock=7;surgeActive=false;surgeLane=0;score=0;cores=0;health=3;phaseCooldown=0;phaseTime=0;invulnerable=0;toastTime=0;shake=0;updateHud();}
  function updateHud(){ui.score.textContent=Math.floor(score).toString().padStart(6,'0');ui.timer.textContent=Math.max(0,Math.ceil(60-gameTime));ui.cores.textContent=String(cores).padStart(2,'0');ui.distance.style.transform=`scaleX(${Math.max(0,1-gameTime/60)})`;[...ui.pips.children].forEach((p,i)=>p.classList.toggle('empty',i>=health));let ready=phaseCooldown<=0;ui.phase.style.transform=`scaleX(${ready?1:Math.max(.02,1-phaseCooldown/2.7)})`;ui.phaseText.textContent=phaseTime>0?'PHASING':ready?'READY':'CHARGING';ui.phaseText.style.color=phaseTime>0?'#ff875d':ready?'#68f2f5':'#8292a5';}
  function start(){reset();state='playing';ui.start.classList.add('hidden');ui.end.classList.add('hidden');last=performance.now();}
  function finish(win){if(state!=='playing')return;state=win?'won':'lost';ui.endTitle.innerHTML=win?'EXTRACTION<br><em>SECURED.</em>':'RUN<br><em>TERMINATED.</em>';ui.endCopy.textContent=win?'You carved a path through the Shardline. The frontier is still yours.':'The rift claimed this run. Recalibrate and take another shot.';ui.endKicker.textContent=win?'MISSION COMPLETE':'SIGNAL LOST';ui.finalScore.textContent=Math.floor(score).toString().padStart(6,'0');ui.finalCores.textContent=String(cores).padStart(2,'0');ui.end.classList.remove('hidden');}
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTime=1.05;}
  function move(dir){if(state!=='playing')return;player.lane=Math.max(0,Math.min(2,player.lane+dir));sound('move');}
  function phase(){if(state!=='playing'||phaseCooldown>0)return;phaseCooldown=2.7;phaseTime=.52;invulnerable=Math.max(invulnerable,.58);burst(player.visualLane,.82,C.cyan,13);showToast('PHASE SHIFT // ACTIVE');sound('phase');}
  function action(e){const a=e.currentTarget.dataset.action;if(a==='left')move(-1);else if(a==='right')move(1);else phase();}
  document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();action(e);});});
  $('startBtn').addEventListener('click',start);$('restartBtn').addEventListener('click',start);
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundIcon').textContent=soundOn?'♫':'♪';if(soundOn)sound('move');});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift'].includes(e.key))e.preventDefault();if(e.repeat)return;if(state==='intro'&&(e.key==='Enter'||e.key===' ')){start();return;}if((state==='won'||state==='lost')&&e.key==='Enter'){start();return;}if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')move(-1);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')move(1);if(e.key==='Shift'||e.key===' ')phase();});
  function sound(kind){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type='sine';let t=audio.currentTime,f=kind==='phase'?180:kind==='hit'?90:kind==='core'?680:330;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(kind==='hit'?.5:1.55),t+.09);g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.13);o.start(t);o.stop(t+.14);}catch(_){}}

  function laneX(lane,z){let spread=W*(.055+.42*Math.pow(z,1.3));return W/2+(lane-1)*spread;}
  function project(lane,z){let y=H*(.28+.67*Math.pow(z,1.45));return {x:laneX(lane,z),y,scale:.22+1.08*z};}
  function poly(points,fill,stroke,alpha=1){ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}ctx.globalAlpha=1;}
  function line(x1,y1,x2,y2,color,width=1,alpha=1){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.globalAlpha=1;}
  function glow(color,blur){ctx.shadowColor=color;ctx.shadowBlur=blur;}
  function background(dt){let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#080d19');g.addColorStop(.44,'#142238');g.addColorStop(.72,'#111a29');g.addColorStop(1,'#080c14');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    let sx=W*.5,sy=H*.28,rad=Math.min(W,H)*.17;let halo=ctx.createRadialGradient(sx,sy,2,sx,sy,rad);halo.addColorStop(0,'#56e7ee35');halo.addColorStop(.25,'#4fc3e51b');halo.addColorStop(1,'#18335000');ctx.fillStyle=halo;ctx.fillRect(sx-rad,sy-rad,rad*2,rad*2);
    ctx.save();ctx.translate(sx,sy);ctx.strokeStyle='#6be8f325';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(0,0,rad*(.45+i*.14),rad*(.13+i*.035),0,0,Math.PI*2);ctx.stroke();}ctx.restore();
    stars.forEach(s=>{ctx.globalAlpha=s.a*(.72+.28*Math.sin(gameTime*s.tw+s.x));ctx.fillStyle='#c0efff';ctx.fillRect(s.x,s.y,s.r,s.r);});ctx.globalAlpha=1;
    // Distant voxel skyline
    for(let i=0;i<17;i++){let x=i*W/16+(i%2?7:-5),bh=H*(.035+(Math.sin(i*17.3)*.5+.5)*.11),bw=W*.025;ctx.fillStyle=i%3?'#111d2b':'#14283a';ctx.fillRect(x,sy+rad*.18-bh,bw,bh);ctx.fillStyle='#5ddce522';ctx.fillRect(x+bw*.35,sy+rad*.18-bh*.72,2,Math.max(2,bh*.12));}
  }
  function drawTrack(){let h=H*.28,bottom=H*.99,topW=W*.09,botW=W*.49;poly([[W/2-topW,h],[W/2+topW,h],[W/2+botW,bottom],[W/2-botW,bottom]],'#111c29','#55cbd22a');
    // lane surface panels, perspective grid
    for(let lane=0;lane<3;lane++){let z=.03+((gameTime*.22)%0.18);for(;z<1.02;z+=.18){let y=H*(.28+.67*Math.pow(z,1.45)),ww=W*(.06+.39*Math.pow(z,1.3));let x=W/2+(lane-1)*W*(.055+.42*Math.pow(z,1.3));poly([[x-ww/3,y],[x+ww/3,y],[x+ww/3+W*.012*z,y+H*.026*z],[x-ww/3-W*.012*z,y+H*.026*z]],(Math.floor(z*10)%2?'#253546':'#1a2a3a'),null,.26);}}
    for(let laneEdge of [-1,0,1]){let x1=W/2+laneEdge*topW,x2=W/2+laneEdge*botW;line(x1,h,x2,bottom,laneEdge===0?'#72dce344':'#7fcbd122',laneEdge===0?1.3:1);}
    for(let i=0;i<19;i++){let z=((i/18+gameTime*.22)%1),y=H*(.28+.67*Math.pow(z,1.45)),width=W*(.09+.4*Math.pow(z,1.3));line(W/2-width,y,W/2+width,y,'#85dfe81d',1,Math.min(.6,z+.12));}
    if(surgeActive){let z=.02+((gameTime*.48)%1),y=H*(.28+.67*Math.pow(z,1.45)),width=W*(.07+.4*Math.pow(z,1.3)),x=laneX(surgeLane,z);poly([[x-width/3,y-H*.02*z],[x+width/3,y-H*.02*z],[x+width/3,y+H*.05*z],[x-width/3,y+H*.05*z]],'#ff533b18','#ff765155',.9);}
    // edge beacons
    for(let side of [-1,1]){for(let i=0;i<6;i++){let z=((i/6+gameTime*.18)%1),p=project(1,z),x=W/2+side*(W*(.12+.43*Math.pow(z,1.25)));let size=2+z*7;ctx.fillStyle=i%2?'#ff815966':'#60edf277';glow(i%2?C.orange:C.cyan,7*z);ctx.fillRect(x-size/2,p.y-size/2,size,size);ctx.shadowBlur=0;}}
  }
  function drawCube(x,y,size,color,depth=0){let s=size,dx=s*.52,dy=s*.3;poly([[x,y-s],[x+dx,y-s+dy],[x+dx,y+dy],[x,y]],color,'#ffffff2c');poly([[x,y-s],[x-dx,y-s+dy],[x-dx,y+dy],[x,y]],'#172538','#ffffff20');poly([[x,y],[x+dx,y+dy],[x,y+s*.42],[x-dx,y+dy]],'#0a1321','#ffffff20');ctx.fillStyle=color;ctx.globalAlpha=.22;ctx.fillRect(x-s*.08,y-s*.72,s*.15,s*.55);ctx.globalAlpha=1;}
  function drawObject(o){let p=project(o.lane,o.z),x=p.x,y=p.y,s=Math.max(3,Math.min(W,H)*.1*p.scale);ctx.save();
    if(o.type==='block'){glow(C.orange,11*p.scale);drawCube(x,y-s*.06,s*.65,'#d26550');ctx.shadowBlur=0;poly([[x-s*.65,y-s*.22],[x,y-s*.65],[x+s*.65,y-s*.22],[x,y+s*.12]],'#ff885c','#ffc2a477');line(x-s*.32,y-s*.18,x+s*.3,y-s*.18,'#ffb090',Math.max(1,s*.035));}
    else if(o.type==='enemy'){glow(C.orange,9*p.scale);poly([[x,y-s*.72],[x+s*.8,y-s*.04],[x+s*.5,y+s*.12],[x,y+s*.32],[x-s*.5,y+s*.12],[x-s*.8,y-s*.04]],'#9e4352','#ff9c75');poly([[x,y-s*.48],[x+s*.35,y-s*.04],[x,y+s*.05],[x-s*.35,y-s*.04]],'#ffb274','#fff0b0');drawCube(x-s*.5,y+s*.1,s*.28,'#6a3549');drawCube(x+s*.5,y+s*.1,s*.28,'#6a3549');ctx.fillStyle='#ffae73';ctx.fillRect(x-s*.08,y-s*.1,s*.16,s*.12);ctx.shadowBlur=0;}
    else if(o.type==='core'){let a=gameTime*2.7+o.spin;ctx.translate(x,y-s*.28);ctx.rotate(a);glow(C.violet,14*p.scale);let q=s*.35;poly([[0,-q],[q*.72,0],[0,q],[ -q*.72,0]],'#a88aff','#e9d8ff');ctx.fillStyle='#e7d8ff';ctx.fillRect(-q*.16,-q*.16,q*.32,q*.32);ctx.shadowBlur=0;ctx.rotate(-a);ctx.strokeStyle='#b594ff88';ctx.beginPath();ctx.ellipse(0,0,s*.56,s*.18,Math.sin(a)*.5,0,Math.PI*2);ctx.stroke();}
    ctx.restore();}
  function drawPlayer(){let p=project(player.visualLane,.83),x=p.x,y=H*.81+Math.sin(gameTime*15)*2,s=Math.min(W,H)*.075;let flashing=invulnerable>0&&Math.floor(gameTime*18)%2===0;if(flashing)return;ctx.save();if(phaseTime>0){ctx.strokeStyle='#68f2f5aa';ctx.lineWidth=2;glow(C.cyan,18);ctx.beginPath();ctx.ellipse(x,y-s*.14,s*.68,s*.95,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    let flame=14+Math.sin(gameTime*26)*5;poly([[x-s*.24,y+s*.3],[x-s*.12,y+s*.3],[x,y+flame],[x+s*.12,y+s*.3],[x+s*.24,y+s*.3]],'#ff875d88');poly([[x-s*.1,y+s*.3],[x,y+s*.3],[x,y+flame*.7]],'#d9ffff');
    glow(C.cyan,12);poly([[x,y-s*.58],[x+s*.56,y+s*.16],[x+s*.2,y+s*.27],[x,y+s*.08],[x-s*.2,y+s*.27],[x-s*.56,y+s*.16]],'#75dce8','#d2ffff');poly([[x,y-s*.39],[x+s*.18,y+s*.05],[x,y+s*.15],[x-s*.18,y+s*.05]],'#174253','#a5fbff');poly([[x-s*.53,y+s*.12],[x-s*.8,y+s*.28],[x-s*.25,y+s*.25]],'#376a7d','#86e6f4');poly([[x+s*.53,y+s*.12],[x+s*.8,y+s*.28],[x+s*.25,y+s*.25]],'#376a7d','#86e6f4');ctx.shadowBlur=0;line(x,y-s*.55,x,y-s*.04,'#f3ffff',1.5);ctx.restore();}
  function drawShots(){shots.forEach(s=>{let p=project(s.lane,s.z);ctx.save();ctx.globalAlpha=Math.min(1,.4+s.z);glow(C.cyan,11);ctx.fillStyle='#bdfdff';ctx.fillRect(p.x-2,p.y-12*p.scale,4,19*p.scale);ctx.restore();});}
  function burst(lane,z,color,n){let p=project(lane,z);for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,v=25+Math.random()*110;particles.push({x:p.x,y:p.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+Math.random()*.55,max:.9,color,size:1+Math.random()*3});}}
  function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;glow(p.color,7);ctx.fillRect(p.x,p.y,p.size,p.size);ctx.shadowBlur=0;}ctx.globalAlpha=1;}
  function spawn(){let lane=Math.floor(Math.random()*3),r=Math.random(),type=r<.44?'block':r<.79?'enemy':'core';if(type==='core'&&cores>=12&&Math.random()<.7)type='block';objects.push({type,lane,z:.02,hp:type==='enemy'?1:0,spin:Math.random()*6,done:false});
    // occasional paired obstacles leave one clean line
    if(type==='block'&&Math.random()<.2){let other=(lane+1+Math.floor(Math.random()*2))%3;objects.push({type:'block',lane:other,z:-.12,hp:0,done:false});}}
  function collision(o){if(o.done||o.z<.805||o.z>.94||Math.abs(player.visualLane-o.lane)>.34)return;o.done=true;if(o.type==='core'){cores=Math.min(12,cores+1);score+=350;burst(o.lane,o.z,C.violet,17);showToast('SHARD CORE +350');sound('core');return;}if(o.type==='enemy'){damage(1);return;}if(phaseTime>0){score+=80;burst(o.lane,o.z,C.cyan,10);showToast('PHASE // CLEAN BREAK');}else damage(1);}
  function damage(amount){if(invulnerable>0)return;health=Math.max(0,health-amount);invulnerable=1.05;shake=.35;burst(player.visualLane,.82,C.orange,20);sound('hit');updateHud();if(health<=0)finish(false);}
  function update(dt){if(state!=='playing')return;gameTime+=dt;if(gameTime>=60){score+=cores*100;finish(true);updateHud();return;}player.visualLane+=(player.lane-player.visualLane)*Math.min(1,dt*13);phaseCooldown=Math.max(0,phaseCooldown-dt);phaseTime=Math.max(0,phaseTime-dt);invulnerable=Math.max(0,invulnerable-dt);shake=Math.max(0,shake-dt);if(toastTime>0){toastTime-=dt;if(toastTime<=0)ui.toast.classList.remove('show');}
    surgeClock-=dt;if(surgeClock<=0){surgeClock=15;surgeActive=true;surgeLane=Math.floor(Math.random()*3);ui.surgeMessage.textContent=`LANE ${['01','02','03'][surgeLane]} // PHASE OR EVADE`;ui.surge.classList.add('show');setTimeout(()=>ui.surge.classList.remove('show'),3400);showToast('CORRUPTION SPIKE DETECTED');}if(surgeActive&&surgeClock<11.2)surgeActive=false;
    spawnClock-=dt;if(spawnClock<=0){spawn();spawnClock=Math.max(.56,1.02-gameTime*.004)+Math.random()*.28;}
    // Auto-cannons prioritize the nearest hostile in the pilot's lane.
    shotClock-=dt;if(shotClock<=0){let target=objects.filter(o=>o.type==='enemy'&&!o.done&&o.lane===Math.round(player.visualLane)&&o.z<.77).sort((a,b)=>b.z-a.z)[0];if(target){shots.push({lane:target.lane,z:.77});shotClock=.24;sound('shot');}}
    shots.forEach(s=>{s.z-=dt*.94;for(let o of objects){if(o.type==='enemy'&&!o.done&&o.lane===s.lane&&Math.abs(o.z-s.z)<.065){o.done=true;s.hit=true;score+=180;burst(o.lane,o.z,C.orange,14);showToast('SENTRY DOWN +180');break;}}});shots=shots.filter(s=>s.z>-.02&&!s.hit);
    objects.forEach(o=>{o.z+=dt*(.19+gameTime*.00045);collision(o);});objects=objects.filter(o=>o.z<1.04&&!o.done);
    if(surgeActive&&surgeClock>11.2&&player.lane===surgeLane&&gameTime%0.8<dt&&phaseTime<=0)damage(1);
    score+=dt*12;updateHud();}
  function render(now){let dt=Math.min(.04,(now-last)/1000||0);last=now;if(state==='playing')update(dt);ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake*18,(Math.random()-.5)*shake*12);background(dt);drawTrack();
    // High-speed tunnel streaks
    if(state==='playing'){for(let i=0;i<12;i++){let z=((i/12+gameTime*.31)%1),p=project(i%3,z);let len=(4+z*28);line(p.x+(i%2?1:-1)*10*z,p.y,p.x+(i%2?1:-1)*(10*z+len*.24),p.y+len,'#72dfe91f',1,z*.7);}}
    objects.slice().sort((a,b)=>a.z-b.z).forEach(drawObject);drawShots();drawPlayer();drawParticles(dt);
    // Instrument reticle and edge vignette
    let retY=H*.805;ctx.strokeStyle='#84e7ee44';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W/2-9,retY);ctx.lineTo(W/2-4,retY);ctx.moveTo(W/2+4,retY);ctx.lineTo(W/2+9,retY);ctx.moveTo(W/2,retY-9);ctx.lineTo(W/2,retY-4);ctx.moveTo(W/2,retY+4);ctx.lineTo(W/2,retY+9);ctx.stroke();
    let vg=ctx.createRadialGradient(W/2,H*.48,Math.min(W,H)*.18,W/2,H*.48,Math.max(W,H)*.73);vg.addColorStop(0,'#00000000');vg.addColorStop(1,'#02050bcc');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
    ctx.restore();requestAnimationFrame(render);}
  reset();requestAnimationFrame(t=>{last=t;render(t);});
})();


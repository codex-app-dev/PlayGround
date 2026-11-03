(()=>{
const c=document.querySelector('#game'),ctx=c.getContext('2d'),TW=48,COLS=20,ROWS=13;
const $=s=>document.querySelector(s),rooms=[];
const make=(n)=>{let a=Array.from({length:ROWS},()=>Array(COLS).fill(0));for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!x||!y||x===COLS-1||y===ROWS-1)a[y][x]=1;
// doorway thresholds
for(const x of [0,COLS-1])a[6][x]=0;
if(n===0){for(let x=1;x<19;x++){a[5][x]=1;a[7][x]=1}a[6][10]=2;}
if(n===1){for(let y=1;y<12;y++)a[y][10]=1;a[6][10]=2;}
return a};
for(let i=0;i<3;i++)rooms.push({map:make(i),enemies:i===2?[{x:14.5,y:5.5,axis:'y',lo:4,hi:8,dir:1,hp:2},{x:7.5,y:8,axis:'x',lo:5,hi:8,dir:-1,hp:1}]:[]});
let room=0,player={x:2.5*TW,y:6.5*TW,dx:1,dy:0},bombs=[],blasts=[],particles=[],started=false,won=false,lost=false,hasKey=false,health=3,keys={},last=0,sword=0,invuln=0,toast=0,toastText='';
const reset=()=>{room=0;player={x:2.5*TW,y:6.5*TW,dx:1,dy:0};bombs=[];blasts=[];particles=[];hasKey=false;health=3;won=lost=false;started=true;sword=invuln=0;rooms.forEach((r,i)=>{r.map=make(i);r.enemies=i===2?[{x:14.5,y:5.5,axis:'y',lo:4,hi:8,dir:1,hp:2},{x:7.5,y:8,axis:'x',lo:5,hi:8,dir:-1,hp:1}]:[]});$('#intro').classList.add('hidden');$('#ending').classList.add('hidden');updateHud();setHint('A brittle seam lies ahead.');};
const setHint=t=>{toastText=t;toast=2.2;$('#hint').textContent=t};
const tile=(x,y)=>{if(x<0||y<0||x>=COLS*TW||y>=ROWS*TW)return 1;return rooms[room].map[Math.floor(y/TW)][Math.floor(x/TW)]};
const solid=(x,y)=>{let t=tile(x,y);return t===1||t===2};
function canMove(x,y){let r=12;return !solid(x-r,y-r)&&!solid(x+r,y-r)&&!solid(x-r,y+r)&&!solid(x+r,y+r)}
function updateHud(){const labels=['01 · THE ENTRY','02 · SUNKEN HALL','03 · EMBER VAULT'];$('#roomLabel').textContent=labels[room];$('#hearts').textContent=Array.from({length:3},(_,i)=>i<health?'♥':'♡').join(' ');$('#keyStatus').textContent=hasKey?'✦ SUN KEY: FOUND':'◇ SUN KEY: —';}
function transition(){if(room===0&&player.x>18.35*TW&&tile(18*TW,6*TW)!==2){room=1;player.x=1.5*TW;player.y=6.5*TW;setHint('The Sun Key waits beyond the seal.');}
else if(room===1&&player.x>18.35*TW){if(hasKey){room=2;player.x=1.5*TW;player.y=6.5*TW;setHint('The vault keeper has awakened!');}else{player.x=18.25*TW;setHint('The sun seal needs its key.');}}
else if(room===1&&player.x<.6*TW){room=0;player.x=18.4*TW;player.y=6.5*TW;}
else if(room===2&&player.x<.6*TW){room=1;player.x=18.35*TW;player.y=6.5*TW;}
}
function dropBomb(){if(!started||won||lost||bombs.length)return;let tx=Math.floor(player.x/TW)+player.dx,ty=Math.floor(player.y/TW)+player.dy;if(tx<1||tx>18||ty<1||ty>11)return;bombs.push({x:(tx+.5)*TW,y:(ty+.5)*TW,t:1.55,done:false});sound(90,.06,'square');}
function explode(b){
 b.done=true;
 const base=[Math.floor(b.x/TW),Math.floor(b.y/TW)],blast={cells:[[Math.floor(b.x/TW),Math.floor(b.y/TW)]],t:.42};
 blasts.push(blast);
 const breakCrack=(x,y)=>{
  rooms[room].map[y][x]=0;
  for(let i=0;i<12;i++)particles.push({x:(x+.5)*TW,y:(y+.5)*TW,vx:(Math.random()-.5)*140,vy:(Math.random()-.8)*150,t:.65,col:i%2?'#b9a17a':'#716854'});
  sound(145,.14,'triangle');
 };
 // A bomb placed directly beside a sealed seam explodes in that tile, so
 // check the center as well as the outward blast rays for brittle masonry.
 if(tile(base[0]*TW,base[1]*TW)===2)breakCrack(base[0],base[1]);
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(const[dX,dY]of dirs)for(let k=1;k<=2;k++){
  let x=base[0]+dX*k,y=base[1]+dY*k,t=tile(x*TW,y*TW);
  if(t===1)break;
  blast.cells.push([x,y]);
  if(t===2){breakCrack(x,y);break}
 }
 for(const e of rooms[room].enemies){if(blast.cells.some(([x,y])=>Math.floor(e.x)===x&&Math.floor(e.y)===y)){e.hp--;e.hurt=.5;if(e.hp<=0)e.dead=true}}
 if(blast.cells.some(([x,y])=>Math.floor(player.x/TW)===x&&Math.floor(player.y/TW)===y))hurt();
 sound(55,.15,'sawtooth');
}
function hurt(){if(invuln>0)return;health--;invuln=1.2;setHint('Ouch! Find some breathing room.');updateHud();if(health<=0){lost=true;showEnd(false)}}
function strike(){if(sword>0||!started)return;sword=.35;sound(290,.07,'triangle');for(const e of rooms[room].enemies){let dx=e.x*TW-player.x,dy=e.y*TW-player.y;if(Math.hypot(dx,dy)<76&&dx*player.dx+dy*player.dy>0){e.hp--;e.hurt=.32;if(e.hp<=0)e.dead=true}}}
function showEnd(win){$('#endTitle').textContent=win?'The vault is yours.':'The ember fades.';$('#endCopy').textContent=win?'You found the Sun Key and brought its light home. The old dungeon sleeps again.':'The vault keeper has won this round. Take a breath, then try again.';$('#ending').classList.remove('hidden')}
function sound(f,d,type){try{let a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d)}catch{}}
function update(dt){if(!started||won||lost)return;let mx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),my=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);if(mx||my){let l=Math.hypot(mx,my);mx/=l;my/=l;player.dx=Math.abs(mx)>Math.abs(my)?Math.sign(mx):0;player.dy=Math.abs(my)>=Math.abs(mx)?Math.sign(my):0;let nx=player.x+mx*155*dt,ny=player.y+my*155*dt;if(canMove(nx,player.y))player.x=nx;if(canMove(player.x,ny))player.y=ny;}
transition();for(const b of bombs){b.t-=dt;if(b.t<=0&&!b.done)explode(b)}bombs=bombs.filter(b=>!b.done||blasts.some(a=>a.t>.2));for(const a of blasts)a.t-=dt;blasts=blasts.filter(a=>a.t>0);
const r=rooms[room];for(const e of r.enemies){if(e.dead)continue;e.hurt=Math.max(0,(e.hurt||0)-dt);e[e.axis]+=e.dir*dt*.65;if(e[e.axis]>e.hi||e[e.axis]<e.lo)e.dir*=-1;if(Math.hypot(e.x*TW-player.x,e.y*TW-player.y)<27)hurt()}
r.enemies=r.enemies.filter(e=>!e.dead);if(room===1&&!hasKey&&Math.floor(player.x/TW)===15&&Math.floor(player.y/TW)===6){hasKey=true;setHint('The Sun Key is yours. The vault lies east.');updateHud();sound(700,.2,'sine')}
if(room===2&&Math.floor(player.x/TW)===17&&Math.floor(player.y/TW)===6&&r.enemies.length===0){won=true;showEnd(true)}
sword=Math.max(0,sword-dt);invuln=Math.max(0,invuln-dt);if(toast>0)toast-=dt;for(const p of particles){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=230*dt}particles=particles.filter(p=>p.t>0);}
// draw helpers
const rect=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(x,y,w,h)};
function drawFloor(x,y){let n=(x*31+y*73)%17;rect(x*TW,y*TW,TW,TW,'#333b30');rect(x*TW+1,y*TW+1,46,46,n%3?'#3b4436':'#404838');rect(x*TW+3,y*TW+3,42,1,'#59604a55');if(n===2||n===8){rect(x*TW+11+n,y*TW+19,2,2,'#74765a');rect(x*TW+31,y*TW+34,1,1,'#74765a')}if(n===5){rect(x*TW+20,y*TW+10,1,4,'#2d352d');rect(x*TW+22,y*TW+14,4,1,'#2d352d')}}
function drawWall(x,y){let px=x*TW,py=y*TW;rect(px,py,TW,TW,'#202820');rect(px+2,py+2,44,43,'#69705b');rect(px+3,py+3,42,39,'#535d4c');rect(px+4,py+4,40,4,'#858570');rect(px+4,py+8,40,1,'#343c32');rect(px+5,py+10,38,27,'#59624e');rect(px+5,py+37,40,4,'#434b3e');rect(px+8,py+15,2,2,'#76806a');rect(px+36,py+31,3,2,'#394337');}
function drawCrack(x,y){let px=x*TW,py=y*TW;rect(px,py,TW,TW,'#443e31');rect(px+3,py+3,42,42,'#78674b');rect(px+5,py+5,38,37,'#665a43');rect(px+4,py+4,40,3,'#a08a60');rect(px+9,py+12,26,2,'#897957');ctx.strokeStyle='#302e27';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+25,py+7);ctx.lineTo(px+20,py+19);ctx.lineTo(px+28,py+24);ctx.lineTo(px+18,py+39);ctx.stroke();rect(px+10,py+34,5,4,'#887654');}
function drawDoor(x,y){let px=x*TW,py=y*TW;rect(px+6,py+3,36,45,'#171c17');rect(px+10,py+5,28,40,'#8a7049');rect(px+13,py+8,22,37,'#242720');ctx.fillStyle='#edbd62';ctx.beginPath();ctx.arc(px+24,py+17,2,0,Math.PI*2);ctx.fill();}
function draw(){ctx.clearRect(0,0,960,624);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){let t=tile(x*TW,y*TW);drawFloor(x,y);if(t===1)drawWall(x,y);else if(t===2)drawCrack(x,y)}
// thresholds and destination
if(room===0)drawDoor(19,6);if(room===1){drawDoor(19,6); // golden key in hall
if(!hasKey){let x=15*TW+24,y=6*TW+24,pulse=Math.sin(performance.now()/220)*3;ctx.shadowColor='#f2c65e';ctx.shadowBlur=18;ctx.fillStyle='#f0c66b';ctx.beginPath();ctx.arc(x,y-5+pulse,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;rect(x-2,y-2+pulse,4,14,'#e1ad4e');rect(x+1,y+5+pulse,8,3,'#e1ad4e');ctx.fillStyle='#fff0bb';ctx.beginPath();ctx.arc(x-2,y-7+pulse,2,0,Math.PI*2);ctx.fill();}}
if(room===2){drawDoor(0,6);let t=performance.now()/450;ctx.fillStyle='#f1c46d';ctx.shadowColor='#f1a94e';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(17*TW+24,6*TW+22,9+Math.sin(t)*2,0,7);ctx.fill();ctx.shadowBlur=0;rect(17*TW+19,6*TW+29,10,8,'#84623d');}
// atmospheric pools of torch light
for(const x of [3,16]){ctx.globalAlpha=.08;let g=ctx.createRadialGradient(x*TW,2.7*TW,2,x*TW,2.7*TW,90);g.addColorStop(0,'#e8ae54');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x*TW-90,2.7*TW-90,180,180);ctx.globalAlpha=1}
for(const e of rooms[room].enemies)drawEnemy(e);for(const b of bombs){let flick=Math.random()*2;ctx.fillStyle='#171916';ctx.beginPath();ctx.ellipse(b.x,b.y+11,13,6,0,0,7);ctx.fill();ctx.fillStyle='#272924';ctx.beginPath();ctx.arc(b.x,b.y,11,0,7);ctx.fill();ctx.strokeStyle='#b79863';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+3,b.y-8);ctx.quadraticCurveTo(b.x+9,b.y-16,b.x+6,b.y-18);ctx.stroke();ctx.fillStyle=Math.sin(performance.now()/65)>0?'#ffe89a':'#e56b3d';ctx.beginPath();ctx.arc(b.x+6,b.y-18-flick,3,0,7);ctx.fill();}
for(const a of blasts){for(const[x,y]of a.cells){let k=Math.min(1,a.t*3);ctx.globalAlpha=k;ctx.fillStyle='#f7d270';ctx.fillRect(x*TW+3,y*TW+3,42,42);ctx.fillStyle='#f38b43';ctx.fillRect(x*TW+9,y*TW+9,30,30);ctx.fillStyle='#fff0a5';ctx.fillRect(x*TW+17,y*TW+13,14,23);ctx.globalAlpha=1}}
for(const p of particles){ctx.globalAlpha=Math.max(0,p.t);rect(p.x,p.y,4,4,p.col)}ctx.globalAlpha=1;drawPlayer();if(sword>0)drawSword();
// subtle vignette
let vg=ctx.createRadialGradient(480,300,190,480,300,620);vg.addColorStop(0,'transparent');vg.addColorStop(1,'#080c0a99');ctx.fillStyle=vg;ctx.fillRect(0,0,960,624);
if(toast>0&&started&&!won&&!lost){ctx.globalAlpha=Math.min(1,toast*2);ctx.fillStyle='#101612dc';ctx.fillRect(302,565,356,34);ctx.strokeStyle='#697153';ctx.strokeRect(302,565,356,34);ctx.fillStyle='#e7d6a8';ctx.textAlign='center';ctx.font='13px monospace';ctx.fillText(toastText,480,587);ctx.globalAlpha=1}}
function drawPlayer(){let x=player.x,y=player.y;if(invuln>0&&Math.floor(performance.now()/85)%2)return;ctx.fillStyle='#171c17';ctx.beginPath();ctx.ellipse(x,y+15,14,6,0,0,7);ctx.fill();rect(x-8,y+1,6,9,'#694631');rect(x+2,y+1,6,9,'#694631');rect(x-9,y-7,18,14,'#6d9b66');rect(x-7,y-14,14,11,'#e2bd78');rect(x-8,y-18,16,6,'#a8c277');rect(x-8,y-19,13,3,'#739460');rect(x+2,y-12,2,2,'#30342a');rect(x+5,y-12,2,2,'#30342a');rect(x-2,y-6,4,4,'#9b5540');rect(x-10,y+5,20,3,'#49714b');}
function drawSword(){let x=player.x+player.dx*20,y=player.y+player.dy*20;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(player.dy,player.dx));ctx.strokeStyle='#f4e3ae';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,27,-.8,.8);ctx.stroke();ctx.strokeStyle='#fff5cf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(6,-6);ctx.lineTo(32,-6);ctx.stroke();ctx.restore()}
function drawEnemy(e){let x=e.x*TW,y=e.y*TW;ctx.fillStyle='#161b16';ctx.beginPath();ctx.ellipse(x,y+12,15,7,0,0,7);ctx.fill();ctx.fillStyle=e.hurt>0?'#f1bc72':'#a35b50';ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fill();ctx.fillStyle='#c98568';ctx.fillRect(x-9,y-10,18,6);ctx.fillStyle='#efcf8e';ctx.fillRect(x-7,y-2,4,4);ctx.fillRect(x+3,y-2,4,4);ctx.fillStyle='#342b26';ctx.fillRect(x-5,y-1,2,3);ctx.fillRect(x+4,y-1,2,3);ctx.fillStyle='#443d32';ctx.fillRect(x-6,y+9,4,6);ctx.fillRect(x+3,y+9,4,6)}
function frame(t){let dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
window.addEventListener('keydown',e=>{let k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[k]=true;if(e.key===' '||k==='x')dropBomb();if(k==='z'||k==='Enter')strike();if(k==='Escape')$('#help').classList.toggle('open');if(!started&&e.key==='Enter')reset()});window.addEventListener('keyup',e=>{let k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false});
$('#startBtn').onclick=reset;$('#againBtn').onclick=reset;$('#resetBtn').onclick=()=>{if(started)reset();else{$('#intro').classList.remove('hidden')}};$('#helpBtn').onclick=()=>$('#help').classList.add('open');$('#closeHelp').onclick=$('#gotIt').onclick=()=>$('#help').classList.remove('open');
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key,down=e=>{e.preventDefault();keys[k]=true},up=e=>{e.preventDefault();keys[k]=false};b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,up))});document.querySelector('[data-action="bomb"]').addEventListener('pointerdown',e=>{e.preventDefault();dropBomb()});document.querySelector('[data-action="sword"]').addEventListener('pointerdown',e=>{e.preventDefault();strike()});
updateHud();draw();
})();

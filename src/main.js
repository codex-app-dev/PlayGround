import * as THREE from 'three';
import { CAR_SPECS, buildCar } from './car.js';
import { World } from './world.js';
import { Vehicle } from './vehicle.js';
import { Effects } from './effects.js';
import { ChaseCamera } from './camera.js';
import { AudioEngine } from './audio.js';
import { clamp, damp, lerp, rand, formatTime, formatNum, smoothstep, makeCanvas, TAU } from './util.js';

/* ============================= setup renderer ============================= */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9c3c9);
scene.fog = new THREE.FogExp2(0xd9cfbb, 0.0009);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2600);

/* ============================= sky & light ============================= */
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.55).normalize();

let skyMat = null;
function buildSky() {
  const geo = new THREE.SphereGeometry(1900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 uSun; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
      }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=vnoise(p)*a; p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 zenith = vec3(0.30, 0.54, 0.82);
        vec3 horizon = vec3(0.96, 0.82, 0.64);
        vec3 ground = vec3(0.42, 0.36, 0.27);
        vec3 col = mix(horizon, zenith, smoothstep(-0.01, 0.62, h));
        col = mix(col, ground, smoothstep(-0.02, -0.22, h));
        float sd = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.64, 0.32) * pow(sd, 220.0) * 2.2;
        col += vec3(1.0, 0.55, 0.26) * pow(sd, 9.0) * 0.16;
        float haze = exp(-abs(h) * 12.0) * 0.10;
        col += vec3(1.0, 0.72, 0.45) * haze;
        vec2 uv = d.xz / (max(d.y, 0.045) + 0.32) * 0.8 + vec2(uTime * 0.0035, 0.0);
        float cl = fbm(uv * 2.2 + 7.0);
        cl = smoothstep(0.5, 0.76, cl) * smoothstep(0.0, 0.22, d.y);
        col = mix(col, vec3(1.0, 0.98, 0.94), cl * 0.62);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  skyMat = mat;
  return sky;
}
buildSky();

function cloudTexture() {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = rand(30, 226), y = rand(40, 92), r = rand(18, 46);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,248,238,0.30)');
    grd.addColorStop(1, 'rgba(255,248,238,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hemi = new THREE.HemisphereLight(0xc6dcef, 0x7d6c50, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b6, 3.5);
sun.position.copy(SUN_DIR).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 420;
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.075;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight(0x9fc2e6, 0.6);
fill.position.set(60, 40, -80);
scene.add(fill);

/* environment reflections */
{
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#6f97bd');
  grd.addColorStop(0.45, '#cfd2cb');
  grd.addColorStop(0.52, '#b0a18a');
  grd.addColorStop(1, '#514a3e');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  const sg = g.createRadialGradient(120, 100, 0, 120, 100, 90);
  sg.addColorStop(0, 'rgba(255,240,210,1)');
  sg.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = sg; g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
}

/* ============================= game objects ============================= */
const world = new World(scene);
scene.userData.world = world;
const effects = new Effects(scene);
const audio = new AudioEngine();
const chase = new ChaseCamera(camera);

world.onPropHit = (prop, speed) => {
  if (state.mode !== 'playing') return;
  const pts = Math.round(speed * 9 + 30);
  state.score += pts;
  effects.dustPuff(prop.pos.clone().setY(Math.max(0.4, prop.pos.y)), new THREE.Color(0.62, 0.54, 0.4));
  if (state.shakeOn && speed > 8) chase.addShake(clamp(speed * 0.008, 0.04, 0.25));
  audio.crash(Math.min(10, speed), true);
  if (speed > 5) impactPopup(`+${pts} SMASH`, projectToScreen(prop.pos));
};

const state = {
  mode: 'title',           // title | playing | paused
  missionId: 'free',
  mission: null,
  timeScale: 1,
  slowmo: false,
  score: 0,
  combo: 0,
  comboTimer: 0,
  hudOn: true,
  shakeOn: true,
  startedAt: 0,
  vehicle: null,
  bests: {},
  pausedAt: 0,
};

try { state.bests = JSON.parse(localStorage.getItem('beamdrive.bests') || '{}'); } catch (e) { state.bests = {}; }
function saveBests() { try { localStorage.setItem('beamdrive.bests', JSON.stringify(state.bests)); } catch (e) {} }

const MISSIONS = [
  {
    id: 'free', name: 'Free Roam', tag: 'SANDBOX', short: 'The whole map. No rules.',
    desc: 'Explore the gridmap and highway loop. Smash props, jump ramps, bend sheet metal.',
    spawn: { x: 0, z: 66 }, yaw: Math.PI, type: 'free',
    bestKey: null,
  },
  {
    id: 'crash', name: 'Crash Test', tag: 'CHALLENGE', short: 'Full send into the impact wall.',
    desc: 'Hit the concrete wall as hard as you can. Damage dealt becomes your score.',
    spawn: { x: 0, z: 66 }, yaw: Math.PI, type: 'crash',
    bestKey: 'crash',
  },
  {
    id: 'jump', name: 'Ramp Jump', tag: 'CHALLENGE', short: 'Big air off the 3m kicker.',
    desc: 'Approach the ramp at full throttle. Longest jump distance wins.',
    spawn: { x: 64, z: 90 }, yaw: Math.PI, type: 'jump',
    bestKey: 'jump',
  },
  {
    id: 'trial', name: 'Highway Trial', tag: 'CHALLENGE', short: '8 gates. One clean lap.',
    desc: 'Pass all eight checkpoint gates around the highway loop. Fastest lap wins.',
    spawn: { x: 16, z: 152 }, yaw: -Math.PI / 2, type: 'trial',
    bestKey: 'trial',
  },
];

/* ============================= audio unlock ============================= */
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.start();
}
window.addEventListener('pointerdown', unlockAudio, { once: false });
window.addEventListener('keydown', unlockAudio, { once: false });

/* ============================= showcase (title screen) ============================= */
let showcase = null;
let showcaseSpec = CAR_SPECS[1];
let showcaseT = 0;
const showcasePos = new THREE.Vector3(0, 0, 54);
const modeIndex = { value: 0 };

function buildShowcase(spec) {
  if (showcase) {
    scene.remove(showcase.carGroup);
    showcase.dispose();
  }
  showcase = buildCar(spec);
  showcase.carGroup.position.copy(showcasePos);
  showcase.carGroup.rotation.y = -1.02;
  for (const w of showcase.wheels) {
    w.pivot.position.set(w.local.x, spec.wheelR, w.local.z);
  }
  scene.add(showcase.carGroup);
  const label = document.getElementById('titleCarLabel');
  label.innerHTML = `<div class="big">${spec.name}</div><div class="small">${spec.cls} · ${spec.colorName.toUpperCase()}</div>`;
}
buildShowcase(showcaseSpec);

/* ============================= car cards ============================= */
const carCards = document.getElementById('carCards');
CAR_SPECS.forEach((spec, i) => {
  const b = document.createElement('button');
  b.className = 'car-card' + (i === 1 ? ' active' : '');
  b.dataset.index = i;
  b.innerHTML = `
    <span class="cc-swatch" style="background:#${spec.color.toString(16).padStart(6, '0')}"></span>
    <div class="cc-class">${spec.cls}</div>
    <div class="cc-name">${spec.name}</div>
    <div class="cc-sub">${spec.sub} · ${spec.mass} kg</div>
    <div class="cc-stats">
      <div class="cc-stat"><span>SPD</span><i><b style="width:${spec.stats.speed * 100}%"></b></i></div>
      <div class="cc-stat"><span>PWR</span><i><b style="width:${spec.stats.power * 100}%"></b></i></div>
      <div class="cc-stat"><span>GRIP</span><i><b style="width:${spec.stats.grip * 100}%"></b></i></div>
    </div>`;
  b.addEventListener('click', () => {
    audio.start();
    CAR_SPECS.forEach((_, j) => carCards.children[j].classList.toggle('active', i === j));
    showcaseSpec = spec;
    buildShowcase(spec);
    showcaseT = 0;
  });
  carCards.appendChild(b);
});
document.getElementById('carCount').textContent = String(CAR_SPECS.length).padStart(2, '0');

/* ============================= mission menu ============================= */
const missionGrid = document.getElementById('missionGrid');
function renderMissions() {
  missionGrid.innerHTML = '';
  for (const m of MISSIONS) {
    const div = document.createElement('button');
    div.className = 'mission-card' + (m.id === state.missionId ? ' active' : '');
    div.innerHTML = `<h3>${m.name}</h3><p>${m.short}</p>
      <div class="best">${bestTextFor(m)}</div>`;
    div.addEventListener('click', () => {
      closeMenu();
      startMission(m.id);
    });
    missionGrid.appendChild(div);
  }
}
function bestTextFor(m) {
  if (!m.bestKey) return 'NO RECORD';
  const b = state.bests[m.bestKey];
  if (!b) return 'BEST · —';
  if (m.id === 'crash') return `BEST · ${formatNum(b.points)} PTS`;
  if (m.id === 'jump') return `BEST · ${Math.round(b.distance)} M`;
  if (m.id === 'trial') return `BEST · ${formatTime(b.time)}`;
  return '';
}
renderMissions();

/* ============================= UI helpers ============================= */
const $ = (id) => document.getElementById(id);
const hud = $('hud');
const titleScreen = $('titleScreen');
const menu = $('menu');
const toastEl = $('toast');
const impactEl = $('impactTag');
let toastTimer = null;
function toast(t1, t2, t3 = '', dur = 2600) {
  toastEl.innerHTML = `<div class="t1">${t1}</div><div class="t2">${t2}</div>${t3 ? `<div class="t3">${t3}</div>` : ''}`;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  if (dur > 0) toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}
let impactTimer = null;
function impactPopup(text, screenPos) {
  impactEl.textContent = text;
  if (screenPos) {
    impactEl.style.left = `${screenPos.x}px`;
    impactEl.style.top = `${screenPos.y}px`;
    impactEl.style.transform = 'translate(-50%, 0)';
  } else {
    impactEl.style.left = '50%'; impactEl.style.top = '36%';
    impactEl.style.transform = 'translate(-50%, 0)';
  }
  impactEl.classList.add('show');
  clearTimeout(impactTimer);
  impactTimer = setTimeout(() => impactEl.classList.remove('show'), 900);
}
let flashTimer = null;
const flashEl = $('damageFlash');
function flash() {
  flashEl.classList.add('on');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => flashEl.classList.remove('on'), 90);
}

function showHUD(v) { hud.classList.toggle('hidden', !v); }

function updateHUDStatic() {
  const m = state.mission;
  if (!m) return;
  $('missionTag').textContent = m.tag;
  $('missionTitle').textContent = m.name;
  $('missionDesc').textContent = m.desc;
  $('carName').textContent = showcaseSpec.name.toUpperCase();
}

/* ============================= speedometer ============================= */
const speedoCanvas = $('speedo');
const sctx = speedoCanvas.getContext('2d');
const SPEEDO_SIZE = 260;
const speedoDpr = Math.min(window.devicePixelRatio || 1, 2);
speedoCanvas.width = SPEEDO_SIZE * speedoDpr;
speedoCanvas.height = SPEEDO_SIZE * speedoDpr;

function drawSpeedo(vehicle) {
  if (!vehicle) return;
  const s = vehicle.status();
  const ctx = sctx;
  const W = SPEEDO_SIZE;
  ctx.setTransform(speedoDpr, 0, 0, speedoDpr, 0, 0);
  ctx.clearRect(0, 0, W, W);
  const cx = W / 2, cy = W / 2, R = 96;
  const maxSpeed = Math.ceil(vehicle.spec.topSpeed * 3.6 / 20) * 20;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const speed = clamp(s.speed, 0, maxSpeed);
  const t = speed / maxSpeed;

  // dial plate
  ctx.beginPath();
  ctx.arc(cx, cy, R + 18, 0, TAU);
  ctx.fillStyle = 'rgba(8,11,14,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // rpm arc (outer thin)
  const rp = clamp(vehicle.rpm / 7200, 0, 1);
  ctx.beginPath();
  ctx.arc(cx, cy, R + 12, a0, a0 + (a1 - a0) * rp);
  ctx.strokeStyle = rp > 0.86 ? '#ff5a3c' : 'rgba(255,157,61,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // track
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 9;
  ctx.stroke();

  // speed arc
  const grad = ctx.createLinearGradient(0, W, W, 0);
  grad.addColorStop(0, '#ffb15c');
  grad.addColorStop(1, '#ff5e2c');
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * t);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.stroke();

  // ticks + labels
  const steps = maxSpeed / 20;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const major = i % 2 === 0;
    const r1 = R - 12, r2 = R - (major ? 25 : 19);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.strokeStyle = major ? 'rgba(240,245,250,0.8)' : 'rgba(240,245,250,0.32)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.stroke();
    if (major) {
      const rl = R - 38;
      ctx.fillStyle = 'rgba(220,228,235,0.72)';
      ctx.font = '600 9.5px "SFMono-Regular", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i * 20), cx + Math.cos(a) * rl, cy + Math.sin(a) * rl);
    }
  }

  // needle
  const na = a0 + (a1 - a0) * t;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(na);
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(R - 24, -3.2);
  ctx.lineTo(R - 24, 3.2);
  ctx.closePath();
  ctx.fillStyle = '#ff8a3d';
  ctx.shadowColor = 'rgba(255,120,40,.8)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, TAU);
  ctx.fillStyle = '#1a1f25';
  ctx.fill();
  ctx.strokeStyle = '#ff9d3d';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // digital speed
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f7fa';
  ctx.font = '800 44px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(Math.round(s.speed)), cx, cy + 52);
  ctx.fillStyle = 'rgba(190,201,211,0.85)';
  ctx.font = '600 9px "SFMono-Regular", monospace';
  ctx.fillText('KM/H', cx, cy + 66);

  // gear readout under the speed
  ctx.fillStyle = 'rgba(255,157,61,0.9)';
  ctx.font = '700 9px "SFMono-Regular", monospace';
  ctx.fillText(`${s.gear} GEAR`, cx, cy + 82);

  if (vehicle.inputs.handbrake) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = '700 8px "SFMono-Regular", monospace';
    ctx.fillText('HANDBRAKE', cx, cy - 76);
  } else if (s.airborne && s.speed > 20) {
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '700 8px "SFMono-Regular", monospace';
    ctx.fillText('AIRBORNE', cx, cy - 76);
  }
}

/* ============================= minimap ============================= */
const mapCanvas = $('minimap');
const mctx = mapCanvas.getContext('2d');
const MAP_SIZE = 200;
const mapDpr = Math.min(window.devicePixelRatio || 1, 2);
mapCanvas.width = MAP_SIZE * mapDpr;
mapCanvas.height = MAP_SIZE * mapDpr;
const mapBg = (() => {
  const c = makeCanvas(MAP_SIZE * mapDpr, MAP_SIZE * mapDpr);
  const g = c.getContext('2d');
  g.scale(mapDpr, mapDpr);
  const S = MAP_SIZE;
  const scale = S / 560;
  const px = (x) => S / 2 + x * scale;
  const pz = (z) => S / 2 + z * scale;
  g.fillStyle = 'rgba(12,16,20,0.9)';
  g.fillRect(0, 0, S, S);

  // grass ring
  g.beginPath();
  g.arc(S / 2, S / 2, 230 * scale, 0, TAU);
  g.fillStyle = 'rgba(55,72,52,0.35)';
  g.fill();

  // gridmap
  g.fillStyle = 'rgba(74,80,86,0.9)';
  g.fillRect(px(-93), pz(-93), 186 * scale, 186 * scale);
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.lineWidth = 1;
  g.strokeRect(px(-93), pz(-93), 186 * scale, 186 * scale);

  // highway ellipse
  g.beginPath();
  g.ellipse(S / 2, S / 2, 205 * scale, 152 * scale, 0, 0, TAU);
  g.strokeStyle = 'rgba(120,129,138,0.95)';
  g.lineWidth = 20 * scale;
  g.stroke();
  g.beginPath();
  g.ellipse(S / 2, S / 2, 205 * scale, 152 * scale, 0, 0, TAU);
  g.strokeStyle = 'rgba(230,220,180,0.35)';
  g.lineWidth = 1;
  g.stroke();

  // connectors
  g.strokeStyle = 'rgba(120,129,138,0.95)';
  g.lineWidth = 18 * scale;
  g.beginPath(); g.moveTo(px(0), pz(-93)); g.lineTo(px(0), pz(-152)); g.stroke();
  g.beginPath(); g.moveTo(px(0), pz(93)); g.lineTo(px(0), pz(152)); g.stroke();
  g.beginPath(); g.moveTo(px(93), pz(0)); g.lineTo(px(205), pz(0)); g.stroke();
  g.beginPath(); g.moveTo(px(-93), pz(0)); g.lineTo(px(-205), pz(0)); g.stroke();

  // crash wall
  g.strokeStyle = '#ff6a3d';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(px(-19), pz(-74)); g.lineTo(px(19), pz(-74)); g.stroke();

  // ramps
  g.fillStyle = 'rgba(255,190,90,0.5)';
  for (const r of world.ramps) {
    g.save(); g.translate(px(r.x), pz(r.z)); g.rotate(-r.angle);
    g.fillRect(-r.width / 2 * scale, -r.length / 2 * scale, r.width * scale, r.length * scale);
    g.restore();
  }

  // north
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.font = '600 8px monospace';
  g.fillText('N', S - 14, 14);
  return c;
})();

function drawMinimap(vehicle) {
  const g = mctx;
  const S = MAP_SIZE;
  g.setTransform(mapDpr, 0, 0, mapDpr, 0, 0);
  g.clearRect(0, 0, S, S);
  g.drawImage(mapBg, 0, 0, S, S);
  const scale = S / 560;
  const px = (x) => S / 2 + x * scale;
  const pz = (z) => S / 2 + z * scale;

  // checkpoints
  if (state.mission && state.mission.type === 'trial') {
    for (const cp of world.checkpoints) {
      const active = cp.index === state.mission.nextCp || (state.mission.nextCp === 0 && cp.index === 0);
      g.beginPath();
      g.arc(px(cp.x), pz(cp.z), active ? 4.4 : 2.4, 0, TAU);
      g.fillStyle = active ? '#ff9d3d' : 'rgba(255,255,255,0.35)';
      g.fill();
      if (active) {
        g.beginPath();
        g.arc(px(cp.x), pz(cp.z), 8, 0, TAU);
        g.strokeStyle = 'rgba(255,157,61,0.55)';
        g.lineWidth = 1;
        g.stroke();
      }
    }
  }

  if (!vehicle) return;
  const p = vehicle.body.pos;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.body.quat);
  const ang = Math.atan2(fwd.z, fwd.x) + Math.PI / 2;
  g.save();
  g.translate(px(p.x), pz(p.z));
  g.rotate(-ang);
  g.beginPath();
  g.moveTo(0, -7); g.lineTo(4.6, 5); g.lineTo(0, 2.6); g.lineTo(-4.6, 5); g.closePath();
  g.fillStyle = '#ff9d3d';
  g.shadowColor = 'rgba(255,157,61,.9)';
  g.shadowBlur = 6;
  g.fill();
  g.restore();

  // camera view cone? skip
}

/* ============================= vehicle lifecycle ============================= */
function spawnVehicle() {
  if (state.vehicle) {
    state.vehicle.dispose();
    state.vehicle = null;
  }
  const v = new Vehicle(scene, showcaseSpec, {
    onImpact: onVehicleImpact,
    onLand: onVehicleLand,
    onSkid: () => {},
  });
  state.vehicle = v;
  chase.init = false;
  chase._camInit = false;
  chase.yaw = Math.PI;
  return v;
}

function onVehicleImpact(e) {
  if (!state.vehicle) return;
  const v = state.vehicle;
  const power = e.speed;
  if (power < 5) return;
  effects.impactSparks(e.worldPoint, e.normal, Math.min(30, power));
  if (power > 8) {
    audio.crash(power, power < 12);
    if (state.shakeOn) chase.addShake(clamp(power * 0.03, 0.12, 1.1));
    if (power > 14) flash();
  }
  state.score += e.points;
  const screen = projectToScreen(e.worldPoint);
  const label = power > 30 ? 'MASSIVE' : power > 18 ? 'HEAVY' : 'IMPACT';
  impactPopup(`+${formatNum(e.points)}  ${label} ${Math.round(power * 3.6)} KM/H`, screen);
  if (state.comboTimer > 0) state.combo = Math.min(9, state.combo + 1);
  else state.combo = 1;
  state.comboTimer = 3.2;

  if (state.mission && state.mission.type === 'crash' && e.tag === 'wall' && !state.mission.finished) {
    if (!state.mission.pendingCrash) {
      state.mission.pendingCrash = true;
      state.mission.pendingTime = 0;
      state.mission.impactSpeed = Math.round(power * 3.6);
    }
  }
}

function onVehicleLand(e) {
  if (!state.vehicle) return;
  if (e.airTime > 0.4) {
    effects.dustPuff(state.vehicle.body.pos.clone().setY(state.vehicle.body.pos.y - state.vehicle.spec.comY + 0.2));
    if (state.shakeOn) chase.addShake(clamp(e.speed * 0.012, 0.05, 0.5));
    audio.crash(6, true);
  }
  if (state.mission && state.mission.type === 'jump' && state.mission.inJump && !state.mission.finished) {
    finishJump();
  }
}

function projectToScreen(v) {
  const p = v.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * window.innerWidth,
    y: (-p.y * 0.5 + 0.5) * window.innerHeight,
  };
}

/* ============================= missions ============================= */
function startMission(id) {
  const m = MISSIONS.find(x => x.id === id) || MISSIONS[0];
  state.missionId = id;
  state.mode = 'playing';
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.slowmo = false;
  state.timeScale = 1;
  $('slowmoTag').classList.add('hidden');

  if (showcase) {
    scene.remove(showcase.carGroup);
    showcase.dispose();
    showcase = null;
  }
  const v = spawnVehicle();
  v.reset(new THREE.Vector3(m.spawn.x, 0, m.spawn.z), m.yaw);
  v.body.pos.y = world.surfaceHeight(m.spawn.x, m.spawn.z) + v.spec.comY + 0.1;
  chase.update(0.016, v, world);
  chase.pos.copy(camera.position);

  const cpPositions = world.checkpoints.map(c => new THREE.Vector3(c.x, 0, c.z));
  state.mission = {
    ...m,
    elapsed: 0,
    running: false,
    finished: false,
    nextCp: 1,
    lap: 0,
    inJump: false,
    launchPos: null,
    maxAir: 0,
    bestAir: 0,
    impactSpeed: 0,
    resultText: '',
    gatePulse: 0,
  };
  for (const cp of world.checkpoints) {
    cp.group.visible = m.type === 'trial';
    cp.group.scale.setScalar(1);
  }
  if (m.type === 'trial') {
    world.checkpoints[0].group.visible = true;
  }

  titleScreen.classList.add('fade');
  setTimeout(() => titleScreen.classList.add('hidden'), 650);
  showHUD(true);
  updateHUDStatic();
  $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
  renderMissions();
  toast(m.tag, m.name, m.short, 2400);
  audio.start();
  state.startedAt = performance.now();
  updateMissionHints();
}

function updateMissionHints() {
  const m = state.mission;
  if (!m) return;
  if (m.type === 'crash') {
    $('missionDesc').textContent = m.finished
      ? `Wall hit at ${m.impactSpeed} km/h. ${m.resultText} Press R to run it again.`
      : 'Full throttle toward the IMPACT ZONE wall. R resets the run.';
  } else if (m.type === 'jump') {
    $('missionDesc').textContent = m.finished
      ? `${m.resultText} Press R to jump again.`
      : 'Hit the big ramp at speed. Distance is measured from the lip to touchdown.';
  } else if (m.type === 'trial') {
    $('missionDesc').textContent = m.finished
      ? `${m.resultText} Press R to race again.`
      : 'Pass every glowing gate around the loop. Race starts when you move.';
  } else {
    $('missionDesc').textContent = m.desc;
  }
}

function finishCrash(powerKmh) {
  const m = state.mission;
  m.finished = true;
  m.impactSpeed = Math.round(powerKmh * 3.6);
  const damage = Math.round(state.vehicle.damage);
  const pts = Math.round(state.score + damage * 40 + powerKmh * 30);
  state.score = pts;
  state.vehicle.score = 0;
  m.resultText = `Damage ${damage}% · +${formatNum(pts)} pts.`;
  const prev = state.bests.crash;
  if (!prev || pts > prev.points) {
    state.bests.crash = { points: pts, kmh: m.impactSpeed, damage };
    saveBests();
    toast('NEW RECORD', `${m.impactSpeed} KM/H`, `${damage}% structural damage · ${formatNum(pts)} pts`, 4200);
  } else {
    toast('CRASH LOGGED', `${m.impactSpeed} KM/H`, `${damage}% damage · ${formatNum(pts)} pts`, 3200);
  }
  audio.crash(30, false);
  updateMissionHints();
  $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
}

function finishJump() {
  const m = state.mission;
  m.inJump = false;
  m.finished = true;
  const v = state.vehicle;
  const dist = Math.hypot(v.body.pos.x - m.launchPos.x, v.body.pos.z - m.launchPos.z);
  const air = m.bestAir;
  const pts = Math.round(dist * 40 + air * 300);
  state.score = pts;
  v.score = 0;
  m.resultText = `${dist.toFixed(1)} m · ${air.toFixed(2)} s air · ${formatNum(pts)} pts.`;
  const prev = state.bests.jump;
  if (!prev || dist > prev.distance) {
    state.bests.jump = { distance: dist, air };
    saveBests();
    toast('NEW RECORD', `${dist.toFixed(1)} M`, `airtime ${air.toFixed(2)} s · +${formatNum(pts)} pts`, 4200);
  } else {
    toast('JUMP LOGGED', `${dist.toFixed(1)} M`, `airtime ${air.toFixed(2)} s · +${formatNum(pts)} pts`, 3200);
  }
  updateMissionHints();
  $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
}

function finishTrial() {
  const m = state.mission;
  m.finished = true;
  const time = m.elapsed;
  const pts = Math.max(0, Math.round(26000 - time * 240));
  state.score = pts;
  state.vehicle.score = 0;
  m.resultText = `Lap ${formatTime(time)} · ${formatNum(pts)} pts.`;
  const prev = state.bests.trial;
  if (!prev || time < prev.time) {
    state.bests.trial = { time };
    saveBests();
    toast('NEW RECORD', formatTime(time), 'clean lap chalked', 4200);
  } else {
    toast('LAP COMPLETE', formatTime(time), `best ${formatTime(prev.time)}`, 3200);
  }
  updateMissionHints();
  $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
  for (const cp of world.checkpoints) cp.group.visible = true;
}

/* ============================= mission update ============================= */
function updateMission(dt) {
  const m = state.mission;
  const v = state.vehicle;
  if (!m || !v) return;

  if (!m.running && !m.finished) {
    if (Math.abs(v.forwardSpeed) > 1.5) m.running = true;
  }
  if (m.running) m.elapsed += dt;

  if (m.type === 'jump' && !m.finished) {
    if (!v.airborne && v.forwardSpeed > 4 && v.body.pos.z < 44 && v.body.pos.z > 20) {
      // approaching
    }
    if (v.airborne && !m.inJump && v.body.pos.y > world.surfaceHeight(v.body.pos.x, v.body.pos.z) + 1.6 && v.forwardSpeed > 8 && v.body.pos.z < 36 && v.body.pos.z > -5) {
      m.inJump = true;
      m.launchPos = v.body.pos.clone();
      m.bestAir = 0;
      m.running = true;
    }
    if (m.inJump) {
      m.bestAir = Math.max(m.bestAir, v.airTime);
      m.gatePulse += dt;
    }
    // fell off the map or stopped, let reset handle it
  }

  if (m.type === 'trial' && !m.finished) {
    const p = v.body.pos;
    const cp = world.checkpoints[m.nextCp];
    if (cp) {
      const d = Math.hypot(p.x - cp.x, p.z - cp.z);
      if (d < 15) {
        if (m.nextCp === 0) {
          finishTrial();
        } else {
          m.nextCp = (m.nextCp + 1) % 8;
          m.gatePulse = 1;
          audio.crash(4, true);
          $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
        }
      }
      cp.group.scale.setScalar(1 + Math.max(0, m.gatePulse) * 0.02);
      m.gatePulse = Math.max(0, m.gatePulse - dt * 2);
    }
  }

  if (m.type === 'crash' && !m.finished && m.pendingCrash) {
    m.pendingTime += dt;
    if (m.pendingTime > 1.15) finishCrash(m.impactSpeed / 3.6);
  }
}

/* ============================= input ============================= */
const keys = new Map();
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', (e) => {
  if (BLOCK.has(e.code)) e.preventDefault();
  keys.set(e.code, true);
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (state.mode === 'playing') openMenu();
    else if (state.mode === 'paused') closeMenu();
  }
  if (state.mode !== 'playing') return;
  if (e.code === 'KeyC') {
    const name = chase.setMode(chase.mode + 1);
    toast('CAMERA', name, '', 1200);
  }
  if (e.code === 'KeyT') {
    state.slowmo = !state.slowmo;
    state.timeScale = state.slowmo ? 0.32 : 1;
    $('slowmoTag').classList.toggle('hidden', !state.slowmo);
  }
  if (e.code === 'KeyR') {
    resetMission();
  }
  if (e.code === 'KeyM') {
    audio.setEnabled(!audio.enabled);
    toast('AUDIO', audio.enabled ? 'ON' : 'MUTED', '', 1000);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing' || e.button !== 0) return;
  chase.dragging = true;
  canvas.setPointerCapture(e.pointerId);
  chase._lastX = e.clientX;
  chase._lastY = e.clientY;
});
canvas.addEventListener('pointermove', (e) => {
  if (!chase.dragging) return;
  const dx = e.clientX - chase._lastX;
  const dy = e.clientY - chase._lastY;
  chase.orbitYaw = clamp(chase.orbitYaw - dx * 0.006, -2.8, 2.8);
  chase.orbitPitch = clamp(chase.orbitPitch + dy * 0.003, -0.25, 0.5);
  chase._lastX = e.clientX;
  chase._lastY = e.clientY;
});
window.addEventListener('pointerup', () => { chase.dragging = false; });

function readInputs() {
  const up = keys.get('KeyW') || keys.get('ArrowUp');
  const down = keys.get('KeyS') || keys.get('ArrowDown');
  const left = keys.get('KeyA') || keys.get('ArrowLeft');
  const right = keys.get('KeyD') || keys.get('ArrowRight');
  const handbrake = keys.get('Space') || false;
  return { up: !!up, down: !!down, left: !!left, right: !!right, handbrake };
}

function resetMission() {
  if (!state.mission) return;
  const m = state.mission;
  const v = state.vehicle;
  v.repair();
  v.reset(new THREE.Vector3(m.spawn.x, 0, m.spawn.z), m.yaw);
  v.body.pos.y = world.surfaceHeight(m.spawn.x, m.spawn.z) + v.spec.comY + 0.1;
  state.score = 0;
  m.elapsed = 0;
  m.running = false;
  m.finished = false;
  m.nextCp = 1;
  m.inJump = false;
  m.launchPos = null;
  m.bestAir = 0;
  m.impactSpeed = 0;
  m.resultText = '';
  for (const cp of world.checkpoints) cp.group.visible = m.type === 'trial';
  chase.init = false;
  chase.yaw = m.yaw;
  updateMissionHints();
  $('statBest').textContent = bestTextFor(m).replace('BEST · ', '');
  toast('RESET', m.name, 'vehicle repaired', 1500);
}

/* ============================= menu ============================= */
function openMenu() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  state.pausedAt = performance.now();
  renderMissions();
  menu.classList.remove('hidden');
  audio.idle();
}
function closeMenu() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  menu.classList.add('hidden');
  audio.start();
}
$('closeMenu').addEventListener('click', closeMenu);
$('repairBtn').addEventListener('click', () => {
  if (!state.vehicle) return;
  state.vehicle.repair();
  state.score = 0;
  toast('REPAIRED', 'Good as new', 'for now', 1600);
  closeMenu();
});
$('resetBtn').addEventListener('click', () => { closeMenu(); resetMission(); });
$('quitBtn').addEventListener('click', () => {
  menu.classList.add('hidden');
  showHUD(false);
  state.mode = 'title';
  if (state.vehicle) { state.vehicle.dispose(); state.vehicle = null; }
  state.mission = null;
  audio.idle();
  titleScreen.classList.remove('hidden');
  requestAnimationFrame(() => titleScreen.classList.remove('fade'));
  buildShowcase(showcaseSpec);
  renderMissions();
});
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-body').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
  });
});
$('shadowToggle').addEventListener('click', (e) => {
  renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
  e.target.textContent = renderer.shadowMap.enabled ? 'ON' : 'OFF';
  e.target.classList.toggle('on', renderer.shadowMap.enabled);
  scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
});
$('shakeToggle').addEventListener('click', (e) => {
  state.shakeOn = !state.shakeOn;
  e.target.textContent = state.shakeOn ? 'ON' : 'OFF';
  e.target.classList.toggle('on', state.shakeOn);
});
$('soundToggle').addEventListener('click', (e) => {
  audio.setEnabled(!audio.enabled);
  e.target.textContent = audio.enabled ? 'ON' : 'OFF';
  e.target.classList.toggle('on', audio.enabled);
});
$('clearRecords').addEventListener('click', () => {
  state.bests = {};
  saveBests();
  renderMissions();
  toast('RECORDS', 'CLEARED', 'fresh slate', 1400);
});
$('hudToggle').addEventListener('click', (e) => {
  state.hudOn = !state.hudOn;
  e.target.textContent = state.hudOn ? 'ON' : 'OFF';
  e.target.classList.toggle('on', state.hudOn);
  document.querySelector('.speedo-wrap').style.visibility = state.hudOn ? 'visible' : 'hidden';
});
['shadowToggle', 'shakeToggle', 'soundToggle', 'hudToggle'].forEach(id => document.getElementById(id)?.classList.add('on'));

$('startBtn').addEventListener('click', () => {
  unlockAudio();
  startMission('free');
});

/* ============================= HUD text ============================= */
let hudAcc = 0;
function updateHUDText(dt) {
  const v = state.vehicle;
  const m = state.mission;
  if (!v || !m) return;
  hudAcc += dt;
  if (hudAcc < 0.09) return;
  hudAcc = 0;
  const s = v.status();
  $('statTime').textContent = formatTime(m.elapsed);
  $('statScore').textContent = formatNum(state.score + v.score);
  $('damageVal').textContent = `${Math.round(v.damage)}%`;
  $('engineVal').textContent = `${Math.round(v.engineHealth)}%`;
  $('damageBar').style.width = `${100 - v.damage}%`;
  $('engineBar').style.width = `${v.engineHealth}%`;
  const prog = document.getElementById('missionProgress');
  if (m.type === 'trial') {
    prog.classList.remove('hidden');
    prog.querySelector('.fill').style.width = `${(m.nextCp === 0 ? 8 : m.nextCp) / 8 * 100}%`;
  } else if (m.type === 'crash') {
    prog.classList.remove('hidden');
    prog.querySelector('.fill').style.width = `${clamp(s.speed / (v.spec.topSpeed * 3.6) * 100, 0, 100)}%`;
  } else if (m.type === 'jump' && m.inJump) {
    prog.classList.remove('hidden');
    prog.querySelector('.fill').style.width = `${clamp(m.bestAir * 50, 0, 100)}%`;
  } else {
    prog.classList.add('hidden');
  }
  // mission timer best
  if (!m.finished) {
    let best = bestTextFor(m).replace('BEST · ', '');
    $('statBest').textContent = best;
  }
}

/* ============================= effects during play ============================= */
let smokeAcc = 0;
function gameplayEffects(dt) {
  const v = state.vehicle;
  if (!v) return;
  effects.wheelSmoke(v, dt, world);
  effects.updateSkids(v, world);
  smokeAcc += dt;
  const eng = v.engineHealth;
  if (eng < 62 && smokeAcc > 0.05) {
    smokeAcc = 0;
    const p = v.visual.carGroup.localToWorld(new THREE.Vector3(0, v.spec.beltline + 0.1, v.spec.length / 2 - 0.8));
    const dark = eng < 35;
    effects.smoke.emit(p, new THREE.Vector3(rand(-0.4, 0.4), rand(1, 2.2), rand(-0.4, 0.4)), {
      color: dark ? new THREE.Color(0.16, 0.16, 0.17) : new THREE.Color(0.55, 0.57, 0.6),
      size: rand(0.7, 1.1), life: rand(1.2, 2.4), grow: 2.6, drag: 0.9, gravity: 0.5, alpha: 0.4,
    });
  }
  if (v.lateralSlip > 5 && Math.random() < dt * 14) audio.skidTick();
}

/* ============================= main loop ============================= */
let last = performance.now();
let frameCount = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let rawDt = (now - last) / 1000;
  last = now;
  rawDt = Math.min(rawDt, 0.06);
  const dt = rawDt;

  if (state.mode === 'title') {
    showcaseT += dt;
    if (showcase) {
      showcase.carGroup.rotation.y = -1.02 + Math.sin(showcaseT * 0.22) * 0.18;
      showcase.carGroup.position.y = Math.sin(showcaseT * 0.5) * 0.006;
    }
    const camA = -0.5 + Math.sin(showcaseT * 0.15) * 0.1;
    camera.position.set(showcasePos.x + Math.sin(camA) * 12.8, 3.0, showcasePos.z + Math.cos(camA) * 12.8);
    camera.lookAt(showcasePos.x - 1.9, 0.55, showcasePos.z);
    camera.fov = 33;
    camera.updateProjectionMatrix();
    // subtle sun shadow follows showcase
    sun.position.copy(SUN_DIR).multiplyScalar(160).add(showcasePos);
    sun.target.position.copy(showcasePos);
    sun.target.updateMatrixWorld();
    for (const cp of world.checkpoints) cp.group.visible = false;
  } else {
    const v = state.vehicle;
    if (state.mode === 'playing') {
      const simDt = dt * state.timeScale;
      v.setInputs(readInputs());
      v.update(simDt, world, audio);
      updateMission(simDt);
      gameplayEffects(simDt);
      effects.update(simDt);
      world.updateDynamicProps(simDt, v);
      chase.update(dt, v, world);
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      sun.position.copy(SUN_DIR).multiplyScalar(160).add(v.body.pos);
      sun.target.position.copy(v.body.pos);
      sun.target.updateMatrixWorld();
      updateHUDText(dt);
      drawSpeedo(v);
      drawMinimap(v);
    } else {
      // paused: keep slow camera drift
      chase.update(dt * 0.12, v, world);
    }
  }

  if (skyMat) skyMat.uniforms.uTime.value = performance.now() * 0.001;
  renderer.render(scene, camera);
  frameCount++;
  if (frameCount === 2) {
    document.getElementById('loading').classList.add('fade');
    setTimeout(() => document.getElementById('loading').classList.add('hidden'), 500);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
});

/* pause when tab hidden */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') openMenu();
});

chase.pos.set(0, 6, 70);
requestAnimationFrame(frame);

/* debug hooks for automated checks */
window.__game = { state, world, chase, renderer, camera, scene, startMission, get vehicle() { return state.vehicle; } };

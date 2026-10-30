import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world.js';
import { Ship } from './ship.js';
import { Effects } from './effects.js';
import { CombatSystem } from './combat.js';
import { AudioEngine } from './audio.js';
import {
  BOSS_TRIGGER, SECTORS, TRACK_LENGTH, clamp, damp, halfWidth, pathSlope,
  pathX, sectorAt, trackForward, trackYaw
} from './track.js';

const $ = (id) => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');

const canvas = $('game');

/* ------------------------------------------------------------------ */
/* boot / renderer                                                     */
/* ------------------------------------------------------------------ */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance',
    alpha: false, stencil: false, depth: true
  });
} catch (error) {
  $('boot-status').textContent = 'WEBGL2 IS REQUIRED TO FLY THIS CANYON';
  throw error;
}
renderer.setClearColor('#070510', 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const maxDPR = isTouch ? 1.6 : 1.85;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, .1, 4200);
camera.position.set(0, 14, 0);

const world = createWorld(scene);
const ship = new Ship(scene);
const effects = new Effects(scene, camera);
const audio = new AudioEngine();
const combat = new CombatSystem(scene, effects, audio);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), isTouch ? .68 : .82, .58, .68);
bloom.enabled = true;
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(outputPass);

const setSize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w * .5, h * .5);
};
setSize();
window.addEventListener('resize', setSize);
window.addEventListener('orientationchange', () => setTimeout(() => { setSize(); recenterTilt(true); }, 320));

/* ------------------------------------------------------------------ */
/* persistence / state                                                 */
/* ------------------------------------------------------------------ */

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('co.' + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('co.' + key, JSON.stringify(value)); } catch {}
  }
};

const settings = {
  sensitivity: store.get('sensitivity', 100),
  invertTilt: store.get('invertTilt', false),
  shake: store.get('shake', true),
  quality: store.get('quality', 'auto'),
  muted: store.get('muted', false),
  tiltWanted: store.get('tiltWanted', false),
};

const best = {
  score: store.get('bestScore', 0),
  distance: store.get('bestDistance', 0),
  kills: store.get('bestKills', 0),
};

const player = {
  s: 0, xRel: 0, y: 13.2, vx: 0, vy: 0, speed: 184,
  pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), vel: new THREE.Vector3(),
  hull: 100, boost: 100, boostActive: false, invulnerable: 0, rollT: 0, rollCd: 0,
  alive: true, sector: 0, wallTimer: 0
};

const state = {
  phase: 'boot', time: 0, score: 0, combo: 1, comboTimer: 0, kills: 0, elapsed: 0,
  bossTriggered: false, damageFlash: 0, endTimer: 0, endType: '', attractS: 130,
  calloutTimer: null, toastTimer: null, lastHud: {}, fps: 60, frames: 0, fpsTime: 0,
  missileFlash: 0, scorePop: 0, cameraSnap: true, bossIntro: 0
};

const input = {
  stickX: 0, stickY: 0, keysX: 0, keysY: 0, boostKey: false, pointerBoost: false,
  stickPointer: null, fire: true
};

const tilt = {
  enabled: false, supported: 'DeviceOrientationEvent' in window,
  calibrated: false, baseX: 0, baseY: 0, rawX: 0, rawY: 0,
  targetX: 0, targetY: 0, x: 0, y: 0, gotEvent: false, lastEvent: 0, waiting: false
};

/* ------------------------------------------------------------------ */
/* ui helpers                                                          */
/* ------------------------------------------------------------------ */

const screens = {
  manual: $('screen-manual'), settings: $('screen-settings'),
  pause: $('screen-pause'), over: $('screen-over')
};

function showModal(name) {
  for (const [k, el] of Object.entries(screens)) {
    if (k === 'pause' || k === 'over') continue;
    el.hidden = k !== name;
  }
}
function hideModals() {
  screens.manual.hidden = true;
  screens.settings.hidden = true;
}

function showSignals(kicker, title, detail, duration = 2600) {
  const el = $('callout');
  $('callout-kicker').textContent = kicker;
  $('callout-title').textContent = title;
  $('callout-detail').textContent = detail;
  el.classList.add('show');
  clearTimeout(state.calloutTimer);
  state.calloutTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function toast(message, warn = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('warn', warn);
  el.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function comboPop(text) {
  const el = $('combo-pop');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(state.scorePopTimer);
  state.scorePopTimer = setTimeout(() => el.classList.remove('show'), 550);
}

const fmt = (n) => Math.floor(n).toString().padStart(6, '0');
const fmtKm = (n) => (n / 1000).toFixed(2);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function updateBestUI() {
  $('best-score').textContent = fmt(best.score);
  $('best-distance').textContent = fmtKm(best.distance) + ' KM';
  $('best-kills').textContent = best.kills + ' KILLS';
  $('over-best').textContent = fmt(best.score);
}

function applySettingsUI() {
  $('sensitivity').value = settings.sensitivity;
  $('sensitivity').style.setProperty('--range', `${((settings.sensitivity - 50) / 130) * 100}%`);
  $('sensitivity-value').textContent = settings.sensitivity + '%';
  setToggle($('btn-invert-tilt'), settings.invertTilt);
  setToggle($('btn-shake'), settings.shake);
  setToggle($('btn-settings-tilt'), tilt.enabled);
  $('quality').value = settings.quality;
  $('btn-mute').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON';
  $('btn-mute').setAttribute('aria-pressed', settings.muted ? 'true' : 'false');
  $('motion-note').textContent = tilt.supported
    ? 'Motion sensors need HTTPS. iPhone and iPad ask for permission the first time you enable tilt.'
    : 'This browser does not expose motion sensors. Touch and keyboard controls still work.';
  setTiltVisual(tilt.enabled);
}

function setToggle(el, on) {
  el.setAttribute('aria-checked', on ? 'true' : 'false');
  el.classList.toggle('on', on);
}

function setTiltVisual(on) {
  $('btn-tilt').classList.toggle('on', on);
  $('btn-tilt').setAttribute('aria-checked', on ? 'true' : 'false');
  setToggle($('btn-settings-tilt'), on);
  $('stick-zone').style.display = on ? 'none' : '';
  $('tilt-chip').hidden = !on;
  document.body.classList.toggle('tilt-on', on);
  $('tilt-help').textContent = on
    ? 'Motion steering active. Hold level and tap RECENTER.'
    : 'Optional. Tap to enable on this device.';
  if (on) {
    $('hud-controls').textContent = 'TILT TO STEER · AUTO-CANNONS';
  } else {
    $('hud-controls').textContent = isTouch ? 'DRAG TO STEER · AUTO-CANNONS' : 'WASD / ARROWS TO STEER · AUTO-CANNONS';
  }
}

/* ------------------------------------------------------------------ */
/* tilt                                                                */
/* ------------------------------------------------------------------ */

function mapOrientation(beta, gamma) {
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const a = ((Number(angle) % 360) + 360) % 360;
  if (a === 90) return [beta, -gamma];
  if (a === 180) return [-gamma, -beta];
  if (a === 270) return [-beta, gamma];
  return [gamma, beta];
}

function onOrientation(e) {
  if (e.beta === null && e.gamma === null) return;
  const [gx, gy] = mapOrientation(e.beta || 0, e.gamma || 0);
  tilt.rawX = gx;
  tilt.rawY = gy;
  tilt.gotEvent = true;
  tilt.lastEvent = performance.now();
  if (!tilt.calibrated) {
    tilt.baseX = gx;
    tilt.baseY = gy;
    tilt.calibrated = true;
  }
  const dead = .8;
  let nx = (gx - tilt.baseX) / 20;
  let ny = (gy - tilt.baseY) / 17;
  if (Math.abs(nx) < .045) nx = 0;
  if (Math.abs(ny) < .045) ny = 0;
  if (settings.invertTilt) ny = -ny;
  tilt.targetX = clamp(nx, -1, 1);
  tilt.targetY = clamp(ny, -1, 1);
}

function recenterTilt(silent = false) {
  tilt.baseX = tilt.rawX;
  tilt.baseY = tilt.rawY;
  tilt.calibrated = true;
  tilt.targetX = 0;
  tilt.targetY = 0;
  if (!silent) toast('TILT RECENTERED — HOLD YOUR DEVICE LEVEL');
}

async function enableTilt(fromSettings = false) {
  if (tilt.enabled) {
    disableTilt();
    return;
  }
  if (!tilt.supported) {
    toast('MOTION SENSORS ARE NOT AVAILABLE IN THIS BROWSER', true);
    return;
  }
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        toast('MOTION PERMISSION WAS NOT GRANTED — USE TOUCH STEERING', true);
        settings.tiltWanted = false;
        store.set('tiltWanted', false);
        setTiltVisual(false);
        return;
      }
    }
  } catch (error) {
    toast('MOTION PERMISSION FAILED — SERVE OVER HTTPS AND TRY AGAIN', true);
    return;
  }
  window.addEventListener('deviceorientation', onOrientation, true);
  tilt.enabled = true;
  tilt.waiting = true;
  tilt.calibrated = false;
  settings.tiltWanted = true;
  store.set('tiltWanted', true);
  setTiltVisual(true);
  if (!fromSettings) toast('TILT ENABLED — HOLD YOUR DEVICE LEVEL');
  setTimeout(() => {
    tilt.waiting = false;
    if (!tilt.gotEvent) {
      toast('NO MOTION DATA YET — CHECK BROWSER PERMISSIONS', true);
    } else if (tilt.enabled) {
      toast('TILT READY — TAP RECENTER IF YOU DRIFT');
    }
  }, 1400);
}

function disableTilt() {
  window.removeEventListener('deviceorientation', onOrientation, true);
  tilt.enabled = false;
  tilt.targetX = tilt.targetY = tilt.x = tilt.y = 0;
  settings.tiltWanted = false;
  store.set('tiltWanted', false);
  setTiltVisual(false);
  toast('TILT DISABLED — TOUCH STEERING ACTIVE');
}

/* ------------------------------------------------------------------ */
/* audio control                                                       */
/* ------------------------------------------------------------------ */

function ensureAudio() {
  audio.init();
  audio.setMuted(settings.muted);
  audio.setMusicOn(true);
}

function toggleMute() {
  settings.muted = !settings.muted;
  store.set('muted', settings.muted);
  if (!audio.ctx) ensureAudio();
  audio.setMuted(settings.muted);
  $('btn-mute').textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON';
  $('btn-mute').setAttribute('aria-pressed', settings.muted ? 'true' : 'false');
  if (!settings.muted) toast('AUDIO ONLINE');
}

/* ------------------------------------------------------------------ */
/* game flow                                                           */
/* ------------------------------------------------------------------ */

function resetGame() {
  player.s = 0;
  player.xRel = 0;
  player.y = 13.2;
  player.vx = 0;
  player.vy = 0;
  player.speed = 184;
  player.hull = 100;
  player.boost = 100;
  player.boostActive = false;
  player.invulnerable = 0;
  player.rollT = 0;
  player.rollCd = 0;
  player.alive = true;
  player.sector = 0;
  player.wallTimer = 0;
  player.pos.set(pathX(0), 13.2, 0);
  player.prevPos.copy(player.pos);
  player.vel.set(0, 0, -184);

  state.score = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.kills = 0;
  state.elapsed = 0;
  state.bossTriggered = false;
  state.damageFlash = 0;
  state.endTimer = 0;
  state.endType = '';
  state.cameraSnap = true;
  state.bossIntro = 0;
  state.lastHud = {};
  input.stickX = input.stickY = 0;
  input.keysX = input.keysY = 0;
  input.boostKey = false;
  input.pointerBoost = false;
  input.stickPointer = null;

  combat.reset();
  effects.clear();
  ship.setVisible(true);
  setStick(0, 0, false);
  ship.root.position.copy(player.pos);
  ship.root.rotation.set(0, 0, 0);
  updateHud(0, true);
  $('boss-hud').hidden = true;
  $('btn-missile').disabled = false;
  $('btn-roll').disabled = false;
}

function startGame() {
  ensureAudio();
  audio.startMusic();
  hideModals();
  screens.over.hidden = true;
  screens.pause.hidden = true;
  document.body.classList.remove('paused', 'over');
  document.body.classList.add('playing');
  setTiltVisual(tilt.enabled);
  $('screen-title').classList.remove('leaving');
  resetGame();
  state.phase = 'playing';
  if (settings.tiltWanted && !tilt.enabled) enableTilt(true);
  audio.ui();
  showSignals('SECTOR 01', 'OPEN BADLANDS', 'Stay low. The canyon is watching.', 2500);
  recenterTilt(true);
}

function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  document.body.classList.add('paused');
  screens.pause.hidden = false;
  $('pause-score').textContent = fmt(state.score);
  $('pause-distance').textContent = fmtKm(player.s);
  $('pause-kills').textContent = state.kills;
  audio.update(0, 0, false, false);
}

function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  document.body.classList.remove('paused');
  screens.pause.hidden = true;
  hideModals();
  recenterTilt(true);
  audio.ui();
}

function toTitle() {
  state.phase = 'title';
  document.body.classList.remove('playing', 'paused', 'over', 'tilt-on');
  screens.over.hidden = true;
  screens.pause.hidden = true;
  hideModals();
  ship.setVisible(true);
  audio.stopMusic();
  updateBestUI();
  state.attractS = 130;
  state.cameraSnap = true;
}

function playerDie(cause) {
  if (!player.alive) return;
  player.alive = false;
  state.phase = 'dying';
  state.endType = 'death';
  state.endTimer = 0;
  document.body.classList.remove('paused');
  effects.burst(player.pos, '#ff8a5b', 55, 30, .9, 1.3, { drag: 1.1 });
  effects.burst(player.pos, '#ffe7c4', 30, 18, .6, .9, { drag: 1.4 });
  effects.ring(player.pos, '#ffb347', 16, .8);
  effects.shake(1.5);
  audio.explosion(1.8);
  ship.setVisible(false);
  state.deathCause = cause || 'SIGNAL LOST';
}

function playerVictory() {
  if (state.phase !== 'playing') return;
  state.phase = 'victory';
  state.endType = 'victory';
  state.endTimer = 0;
  state.finalScore = state.score;
  effects.shake(.8);
  showSignals('BLOCKADE BROKEN', 'THE FLEET IS FREE', 'Every generator is down. The canyon is yours.', 4200);
  audio.alarm();
}

function finishRun(victory) {
  const prevPhase = state.phase;
  state.phase = 'over';
  document.body.classList.remove('paused');
  document.body.classList.add('over');
  $('hud').classList.remove('active');
  audio.stopMusic();
  if (state.score > best.score) { best.score = Math.floor(state.score); store.set('bestScore', best.score); }
  if (player.s > best.distance) { best.distance = player.s; store.set('bestDistance', best.distance); }
  if (state.kills > best.kills) { best.kills = state.kills; store.set('bestKills', state.kills); }
  updateBestUI();

  const rank = state.score > 30000 ? 'S' : state.score > 20000 ? 'A' : state.score > 11000 ? 'B' : state.score > 5000 ? 'C' : 'D';
  $('over-kicker').textContent = victory ? 'BLOCKADE BROKEN' : 'SIGNAL LOST';
  $('over-title').textContent = victory ? 'The fleet is free.' : 'Down in the dust.';
  $('over-detail').textContent = victory
    ? 'Every generator is down. The canyon is yours.'
    : (state.deathCause || 'The canyon keeps what it catches.');
  $('over-score').textContent = fmt(state.score);
  $('over-distance').textContent = fmtKm(player.s);
  $('over-kills').textContent = state.kills;
  $('over-time').textContent = mmss(state.elapsed);
  $('over-rank').textContent = rank;
  $('btn-retry').querySelector('.primary-label').textContent = victory ? 'FLY IT AGAIN' : 'FLY AGAIN';
  screens.over.hidden = false;
  if (prevPhase === 'victory') audio.ui();
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */

const keys = new Set();
const keyMap = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1]
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state.phase === 'title') { startGame(); e.preventDefault(); return; }
    if (state.phase === 'over') { startGame(); e.preventDefault(); return; }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state.phase === 'playing') { pauseGame(); e.preventDefault(); }
    else if (state.phase === 'paused') { resumeGame(); e.preventDefault(); }
    return;
  }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (state.phase !== 'playing') return;
  if (keyMap[e.code]) {
    keys.add(e.code);
    updateKeyboardAxes();
    e.preventDefault();
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { input.boostKey = true; e.preventDefault(); }
  if (e.code === 'KeyZ' || e.code === 'Slash') { fireMissile(); e.preventDefault(); }
  if (e.code === 'KeyX' || e.code === 'Period') { barrelRoll(); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  updateKeyboardAxes();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.boostKey = false;
});
function updateKeyboardAxes() {
  let x = 0, y = 0;
  for (const code of keys) {
    const v = keyMap[code];
    if (v) { x += v[0]; y += v[1]; }
  }
  input.keysX = clamp(x, -1, 1);
  input.keysY = clamp(y, -1, 1);
}

/* touch joystick */
const stickZone = $('stick-zone');
const stickRing = $('stick-ring');
const stickKnob = $('stick-knob');
let stickCenter = { x: 0, y: 0 };
let stickRadius = 52;

function ringCenter() {
  const rect = stickRing.getBoundingClientRect();
  stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  stickRadius = rect.width * .42;
  return stickCenter;
}
function setStick(nx, ny, active) {
  input.stickX = nx;
  input.stickY = ny;
  stickRing.classList.toggle('active', active);
  const r = stickRadius;
  stickKnob.style.transform = `translate(${nx * r}px, ${-ny * r}px)`;
}
stickZone.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'playing' || tilt.enabled) return;
  e.preventDefault();
  if (input.stickPointer !== null) return;
  input.stickPointer = e.pointerId;
  ringCenter();
  try { stickZone.setPointerCapture(e.pointerId); } catch { /* synthetic or unsupported pointer */ }
  const dx = (e.clientX - stickCenter.x) / stickRadius;
  const dy = (e.clientY - stickCenter.y) / stickRadius;
  applyStick(dx, dy);
}, { passive: false });
stickZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.stickPointer) return;
  applyStick((e.clientX - stickCenter.x) / stickRadius, (e.clientY - stickCenter.y) / stickRadius);
}, { passive: false });
function endStick(e) {
  if (e.pointerId !== input.stickPointer) return;
  input.stickPointer = null;
  setStick(0, 0, false);
}
stickZone.addEventListener('pointerup', endStick);
stickZone.addEventListener('pointercancel', endStick);
stickZone.addEventListener('lostpointercapture', endStick);
function applyStick(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  setStick(dx, dy, true);
}

/* action buttons */
function bindHold(btn, onDown, onUp) {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('active');
    try { btn.setPointerCapture?.(e.pointerId); } catch { /* synthetic or unsupported pointer */ }
    onDown();
  });
  const up = (e) => {
    btn.classList.remove('active');
    onUp?.();
  };
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}
bindHold($('btn-boost'), () => { input.pointerBoost = true; }, () => { input.pointerBoost = false; });
$('btn-missile').addEventListener('pointerdown', (e) => { e.preventDefault(); fireMissile(); });
$('btn-roll').addEventListener('pointerdown', (e) => { e.preventDefault(); barrelRoll(); });

function fireMissile() {
  if (state.phase !== 'playing' || !player.alive) return;
  if (combat.missileCharges <= 0) {
    toast('MISSILES RECHARGING', true);
    return;
  }
  const forward = shipForward();
  if (combat.fireMissiles(player.pos, forward)) {
    state.missileFlash = .35;
    $('btn-missile').disabled = combat.missileCharges <= 0;
  }
}

function barrelRoll() {
  if (state.phase !== 'playing' || !player.alive || player.rollCd > 0) return;
  player.rollT = .82;
  player.rollCd = 2.75;
  player.invulnerable = Math.max(player.invulnerable, .95);
  effects.ring(player.pos, '#9e8bff', 6, .45);
  audio.roll();
}

function shipForward(out = new THREE.Vector3()) {
  out.set(0, 0, -1).applyQuaternion(ship.root.quaternion);
  return out;
}

/* ------------------------------------------------------------------ */
/* simulation                                                          */
/* ------------------------------------------------------------------ */

function currentInput() {
  let x = clamp(input.stickX + input.keysX, -1, 1);
  let y = clamp(input.stickY + input.keysY, -1, 1);
  if (tilt.enabled) {
    x = tilt.x;
    y = tilt.y;
  }
  return { x, y };
}

function updatePlayer(dt) {
  const sens = settings.sensitivity / 100;
  const { x: ix, y: iy } = currentInput();

  player.vx = damp(player.vx, ix * 54 * sens, 5.6, dt);
  player.vy = damp(player.vy, iy * 38 * sens, 5.6, dt);

  player.prevPos.copy(player.pos);
  const oldS = player.s;
  player.xRel += player.vx * dt;
  player.y += player.vy * dt;

  const width = halfWidth(player.s);
  const limit = width - 3.1;
  player.wallTimer = Math.max(0, player.wallTimer - dt);
  if (Math.abs(player.xRel) > limit) {
    const side = Math.sign(player.xRel);
    player.xRel = side * limit;
    player.vx *= -.18;
    if (player.wallTimer <= 0) {
      player.wallTimer = .42;
      onPlayerHit(7, player.pos, true);
      const sparkPos = player.pos.clone();
      sparkPos.x += side * 2.2;
      effects.burst(sparkPos, '#ffb347', 18, 20, .5, .5, { drag: 2.2, gravity: -6 });
      effects.shake(.28);
    }
  }
  const floor = 4.2, ceiling = 36;
  if (player.y < floor) {
    player.y = floor;
    player.vy = Math.abs(player.vy) * .25;
    if (player.wallTimer <= 0) {
      player.wallTimer = .42;
      onPlayerHit(7, player.pos, true);
      const p = player.pos.clone(); p.y -= 2;
      effects.burst(p, '#ffb347', 18, 18, .5, .5, { drag: 2, gravity: -5 });
    }
  } else if (player.y > ceiling) {
    player.y = ceiling;
    player.vy *= -.2;
    if (player.wallTimer <= 0) {
      player.wallTimer = .42;
      onPlayerHit(5, player.pos, true);
    }
  }

  const sector = sectorAt(player.s);
  player.sector = sector;
  const boostOn = (input.boostKey || input.pointerBoost || $('btn-boost').classList.contains('active')) && player.boost > .5 && player.alive;
  player.boostActive = boostOn;
  if (boostOn) {
    player.boost = Math.max(0, player.boost - 31 * dt);
    if (player.boost <= 0) player.boostActive = false;
  } else {
    player.boost = Math.min(100, player.boost + 13.5 * dt);
  }

  const base = sector >= 3 ? 196 : 176 + sector * 13;
  const targetSpeed = base * (player.boostActive ? 1.42 : 1);
  player.speed = damp(player.speed, targetSpeed, 2.4, dt);

  // during the blockade, hold position in the arena while the dreadnought holds station
  if (state.bossTriggered && player.s > BOSS_TRIGGER + 330) {
    player.s = BOSS_TRIGGER + 330;
  } else {
    player.s += player.speed * dt;
  }
  if (player.s > TRACK_LENGTH - 180) player.s = TRACK_LENGTH - 180;
  player.s = Math.max(0, player.s);
  state.elapsed += dt;

  const center = pathX(player.s);
  player.pos.set(center + player.xRel, player.y, -player.s);
  const slope = pathSlope(player.s);
  player.vel.set(slope * player.speed + player.vx, player.vy, -player.speed);

  // timers
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.rollT > 0) player.rollT = Math.max(0, player.rollT - dt);
  if (player.rollCd > 0) player.rollCd = Math.max(0, player.rollCd - dt);

  // ship transform & visuals
  const yaw = Math.atan2(-(slope * player.speed + player.vx), player.speed);
  const pitch = Math.atan2(player.vy, player.speed);
  ship.root.position.copy(player.pos);
  ship.root.rotation.y = yaw;
  ship.root.rotation.x = pitch;
  const rollAngle = player.rollT > 0 ? (1 - player.rollT / .82) * Math.PI * 2 : 0;
  ship.update(dt, {
    speed: player.speed, boost: player.boostActive ? 1 : 0,
    steerX: ix, steerY: iy, invulnerable: player.invulnerable, rollAngle
  });

  // engine trails
  state.trailTimer = (state.trailTimer || 0) - dt;
  if (state.trailTimer <= 0 && player.alive) {
    state.trailTimer = .018;
    for (let i = 0; i < 2; i++) {
      const p = ship.getEngineWorld(i);
      effects.trail(p, player.boostActive ? '#b9fbff' : '#5defff', player.vel.x * -.05, 0, player.speed * .12, 1.2, .34);
    }
  }

  // combo decay
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;
  }

  // passive score
  state.score += dt * player.speed * .33;

  // boss trigger
  if (!state.bossTriggered && player.s >= BOSS_TRIGGER) {
    state.bossTriggered = true;
    combat.startBoss(player.s);
    state.bossIntro = 3.6;
    showSignals('FINAL SECTOR', 'THE ANVIL', 'Three generators. One reactor. Break the blockade.', 4200);
    audio.alarm();
  }

  updateCamera(dt, ix, iy);
  world.update(dt, camera, player.s, player.speed);
  effects.update(dt);

  // combat
  const forward = shipForward();
  const target = combat.findTarget(player.pos, forward, 680, .23);
  const ctx = {
    player, playerPos: player.pos, sector, forward, target, firing: player.alive,
    invulnerable: player.invulnerable,
    muzzleSide: state.muzzleSide || 1,
    muzzleSideRef: { value: state.muzzleSide || 1 }
  };
  combat.update(dt, ctx);
  state.muzzleSide = ctx.muzzleSide;

  updateHud(dt);
}

function updateCamera(dt, ix = 0, iy = 0) {
  const fwd = trackForward(player.s);
  const boost = player.boostActive ? 1 : 0;
  const desired = new THREE.Vector3(
    player.pos.x - fwd.x * 10.8,
    player.pos.y + 4.15 + (player.rollT > 0 ? Math.sin((1 - player.rollT / .82) * Math.PI) * 1.2 : 0),
    player.pos.z - fwd.z * 10.8
  );
  if (state.cameraSnap) {
    camera.position.copy(desired);
    state.cameraSnap = false;
    state.lookAt = new THREE.Vector3();
    state.lookAt.copy(player.pos).addScaledVector(fwd, 28);
    state.lookAt.y += 1.1;
  }
  const posLerp = 1 - Math.exp(-9.5 * dt);
  camera.position.lerp(desired, posLerp);

  const lookTarget = new THREE.Vector3(
    player.pos.x + fwd.x * 30,
    player.pos.y + 1.25 + iy * .6,
    player.pos.z + fwd.z * 30
  );
  state.lookAt.lerp(lookTarget, 1 - Math.exp(-12 * dt));
  camera.lookAt(state.lookAt);
  const shake = effects.shakeOffset();
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  camera.position.z += shake.z;
  camera.rotation.z += -ship.bank * .11;

  const targetFov = 64 + boost * 4.5 + Math.min(3, player.speed / 110) + effects.shakeAmount * 1.2;
  camera.fov = damp(camera.fov, targetFov, 3.5, dt);
  camera.updateProjectionMatrix();

  const dmg = player.invulnerable <= 0 ? 0 : 1;
  $('fx-speed').classList.toggle('on', boost > .2);
  $('fx-damage').classList.toggle('hit', state.damageFlash > 0);
}

function onPlayerHit(amount, pos, wall = false) {
  if (!player.alive || state.phase !== 'playing') return;
  if (!wall && player.invulnerable > 0) return;
  player.hull = Math.max(0, player.hull - amount);
  state.combo = 1;
  state.comboTimer = 0;
  state.damageFlash = .22;
  audio.hit();
  effects.shake(amount > 15 ? .65 : .35);
  effects.burst(pos || player.pos, '#ff5f7f', amount > 15 ? 16 : 8, 12, .35, .4, { drag: 2.5 });
  if (player.hull <= 0) {
    playerDie('HULL BREACH — THE CANYON CLAIMS ANOTHER PILOT');
  }
}

combat.callbacks = {
  onKill: (enemy) => {
    state.kills++;
    const pts = Math.round((enemy.score || 100) * state.combo);
    state.score += pts;
    state.comboTimer = 4.6;
    state.combo = Math.min(8, state.combo + (enemy.kind === 'heavy' ? 2 : 1));
    comboPop(`+${pts}  ×${state.combo}`);
    if (enemy.kind === 'heavy' || enemy.score >= 250) effects.shake(.08);
  },
  onBossNode: (node) => {
    const down = combat.boss ? combat.boss.nodes.filter(n => n.down).length : 0;
    if (node.name === 'CORE EXPOSED') {
      showSignals('SHIELDS DOWN', 'CORE EXPOSED', 'Put everything into the reactor.', 2800);
      $('boss-phase').textContent = 'CORE EXPOSED';
      audio.lock();
    } else {
      showSignals('GENERATOR DESTROYED', `${down} / 3 DOWN`, down >= 3 ? 'The core is exposed.' : 'Keep hitting the blockade.', 2200);
      $('boss-phase').textContent = `SHIELDS ${3 - down}/3`;
    }
    state.score += 900;
    effects.shake(.4);
  },
  onBossDefeated: () => {
    playerVictory();
  },
  onPlayerHit: (dmg, pos) => onPlayerHit(dmg, pos, false),
  onPickup: (kind) => {
    if (kind === 'health') {
      player.hull = Math.min(100, player.hull + 22);
      toast('HULL REPAIRED +22');
    } else {
      combat.missileCharges = Math.min(3, combat.missileCharges + 1);
      toast('MISSILE RELOADED');
    }
  }
};

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

function updateHud(dt, force = false) {
  const last = state.lastHud;
  const set = (key, el, value) => {
    if (last[key] === value && !force) return;
    last[key] = value;
    el.textContent = value;
  };
  set('score', $('hud-score'), fmt(state.score));
  set('combo', $('hud-combo'), state.combo > 1 ? `×${state.combo}` : '');
  set('hull', $('hud-hull'), Math.ceil(player.hull));
  $('hud-hull-fill').style.width = `${clamp(player.hull, 0, 100)}%`;
  set('boostLabel', $('hud-boost-label'), player.boostActive ? 'BURN' : player.boost > 98 ? 'READY' : 'CHARGING');
  $('hud-boost-fill').style.width = `${clamp(player.boost, 0, 100)}%`;
  set('speed', $('hud-speed'), String(Math.round(player.speed * 3.6)));
  set('distance', $('hud-distance'), fmtKm(player.s));

  const sector = SECTORS[player.sector];
  set('sector', $('hud-sector'), `${sector.code} / ${sector.name}`);
  set('wave', $('hud-wave'), `WAVE ${String(combat.wave).padStart(2, '0')}`);
  const progress = clamp((player.s - sector.start) / Math.max(1, sector.end - sector.start), 0, 1);
  $('hud-progress').style.width = `${(state.bossTriggered ? 1 : progress) * 100}%`;

  const pips = $('hud-missiles').children;
  for (let i = 0; i < 3; i++) pips[i].classList.toggle('on', i < combat.missileCharges);
  set('missileLabel', $('hud-missile-label'), `${combat.missileCharges} / 3`);
  set('missileCount', $('missile-count'), String(combat.missileCharges));
  $('btn-missile').classList.toggle('empty', combat.missileCharges <= 0);
  $('btn-missile').disabled = combat.missileCharges <= 0;
  $('btn-roll').disabled = player.rollCd > 0;

  const locked = !!combat.findTarget(player.pos, shipForward(), 680, .23);
  $('reticle').classList.toggle('lock', locked);
  $('hud-lock').classList.toggle('on', locked);

  const boss = combat.boss;
  if (state.bossTriggered && boss) {
    $('boss-hud').hidden = false;
    if (boss.coreExposed) {
      $('boss-fill').style.width = `${clamp(boss.coreHp / boss.coreMaxHp, 0, 1) * 100}%`;
      $('boss-phase').textContent = 'CORE EXPOSED';
      set('objective', $('hud-objective'), 'DESTROY THE REACTOR CORE');
    } else {
      const total = boss.nodes.reduce((n, x) => n + Math.max(0, x.hp), 0);
      $('boss-fill').style.width = `${clamp(total / 30, 0, 1) * 100}%`;
      const down = boss.nodes.filter(n => n.down).length;
      $('boss-phase').textContent = `SHIELDS ${3 - down}/3`;
      set('objective', $('hud-objective'), `DESTROY GENERATORS ${down}/3`);
    }
    const nodes = $('boss-nodes').children;
    boss.nodes.forEach((n, i) => nodes[i].classList.toggle('down', n.down));
  } else {
    $('boss-hud').hidden = true;
    set('objective', $('hud-objective'), player.s > 2500 ? 'CLEAR THE CANYON' : 'STAY LOW · CLEAR THE CANYON');
  }

  const fps = Math.round(state.fps);
  if (last.fps !== fps) { last.fps = fps; $('hud-fps').textContent = String(fps); }
}

/* ------------------------------------------------------------------ */
/* title attract mode / camera                                         */
/* ------------------------------------------------------------------ */

function updateAttract(dt) {
  state.attractS += dt * 33;
  if (state.attractS > 6000) state.attractS = 130;
  const s = state.attractS;
  const cx = pathX(s);
  const fwd = trackForward(s);
  const camPos = new THREE.Vector3(cx, 13.2 + Math.sin(state.time * .25) * 1.2, -s);
  if (state.cameraSnap) { camera.position.copy(camPos); state.cameraSnap = false; state.attractLook = new THREE.Vector3(); state.attractLook.copy(camPos); }
  camera.position.lerp(camPos, 1 - Math.exp(-3 * dt));
  const look = new THREE.Vector3(pathX(s + 90) + 2, 18 + Math.sin(state.time * .18) * 1.5, -(s + 90));
  if (!state.attractLook) state.attractLook = look.clone();
  state.attractLook.lerp(look, 1 - Math.exp(-2.2 * dt));
  camera.lookAt(state.attractLook);
  camera.rotation.z = Math.sin(state.time * .16) * .035;
  camera.fov = damp(camera.fov, 58, 2, dt);
  camera.updateProjectionMatrix();

  const shipS = s + 17;
  const shipX = pathX(shipS) + 8.2;
  ship.root.position.set(shipX, 12.7 + Math.sin(state.time * .55) * .35, -shipS);
  ship.root.rotation.set(0, trackYaw(shipS) + Math.sin(state.time * .35) * .06, 0);
  ship.update(dt, {
    speed: 185, boost: .1 + Math.sin(state.time * .8) * .08,
    steerX: Math.sin(state.time * .42) * .35, steerY: Math.sin(state.time * .3) * .15,
    invulnerable: 0, rollAngle: 0
  });
  state.trailTimer = (state.trailTimer || 0) - dt;
  if (state.trailTimer <= 0) {
    state.trailTimer = .028;
    for (let i = 0; i < 2; i++) {
      const p = ship.getEngineWorld(i);
      effects.trail(p, '#5defff', 0, 0, 4, .8, .3);
    }
  }
  world.update(dt, camera, s, 180);
  effects.update(dt);
}

/* ------------------------------------------------------------------ */
/* end sequences                                                       */
/* ------------------------------------------------------------------ */

function updateEnding(dt) {
  state.endTimer += dt;
  // let the wreck / victory drift settle while the canyon keeps moving
  if (state.endType === 'death') {
    world.update(dt, camera, player.s, player.speed * .45);
    effects.update(dt);
    camera.position.y += dt * .8;
    camera.lookAt(player.pos.x, player.pos.y + 2, player.pos.z - 40);
    if (state.endTimer > 1.55 && screens.over.hidden) finishRun(false);
  } else {
    // victory: pull back to watch the blockade fall
    player.s += player.speed * dt * .25;
    const fwd = trackForward(player.s);
    const desired = new THREE.Vector3(
      player.pos.x - fwd.x * 19,
      player.pos.y + 7.5,
      player.pos.z - fwd.z * 19
    );
    camera.position.lerp(desired, 1 - Math.exp(-2.5 * dt));
    camera.lookAt(pathX(player.s + 120), 22, -(player.s + 120));
    ship.root.position.copy(player.pos);
    ship.update(dt, { speed: player.speed, boost: 0, steerX: 0, steerY: 0, invulnerable: 0, rollAngle: 0 });
    world.update(dt, camera, player.s, player.speed * .25);
    effects.update(dt);
    if (combat.boss && state.endTimer < 2.4 && Math.random() < dt * 5) {
      const p = combat.boss.root.position.clone().add(new THREE.Vector3((Math.random() - .5) * 40, (Math.random() - .5) * 16, (Math.random() - .5) * 8));
      effects.burst(p, Math.random() < .5 ? '#ff8a3d' : '#ff2f92', 26, 26, .8, 1, { drag: 1.1 });
      effects.ring(p, '#ffb347', 13, .8);
      audio.explosion(1.3);
      effects.shake(.25);
    }
    if (state.endTimer > 3 && screens.over.hidden) finishRun(true);
  }
}

/* ------------------------------------------------------------------ */
/* frame loop                                                          */
/* ------------------------------------------------------------------ */

let lastTime = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = clamp(raw, .001, .05);
  state.time += dt;

  state.frames++;
  state.fpsTime += dt;
  if (state.fpsTime > .5) {
    state.fps = state.frames / state.fpsTime;
    state.frames = 0;
    state.fpsTime = 0;
  }
  if (state.damageFlash > 0) state.damageFlash = Math.max(0, state.damageFlash - dt);
  if (state.phase === 'playing' && player.alive) {
    if (tilt.enabled) {
      tilt.x = damp(tilt.x, tilt.targetX, 7.5, dt);
      tilt.y = damp(tilt.y, tilt.targetY, 7.5, dt);
    }
    updatePlayer(dt);
    audio.update(dt, player.speed, player.boostActive, true);
  } else if (state.phase === 'title' || state.phase === 'boot') {
    updateAttract(dt);
    audio.update(dt, 120, false, false);
  } else if (state.phase === 'dying' || state.phase === 'victory') {
    updateEnding(dt);
    audio.update(dt, 0, false, false);
  } else if (state.phase === 'over') {
    world.update(dt * .35, camera, player.s, 0);
    effects.update(dt);
    audio.update(dt, 0, false, false);
  } else if (state.phase === 'paused') {
    effects.update(dt * .15);
    audio.update(dt, 0, false, false);
  }

  composer.render();
}

requestAnimationFrame(frame);

/* ------------------------------------------------------------------ */
/* buttons / settings                                                  */
/* ------------------------------------------------------------------ */

function stop(e) { e.preventDefault(); e.stopPropagation(); }

$('btn-start').addEventListener('click', (e) => { stop(e); startGame(); });
$('btn-manual').addEventListener('click', () => { audio.ui(); showModal('manual'); });
$('btn-manual-close').addEventListener('click', hideModals);
$('btn-manual-done').addEventListener('click', hideModals);
$('btn-settings').addEventListener('click', () => { audio.ui(); showModal('settings'); });
$('btn-settings-close').addEventListener('click', hideModals);
$('btn-settings-done').addEventListener('click', hideModals);
$('btn-pause-settings').addEventListener('click', () => { audio.ui(); showModal('settings'); });
$('btn-pause').addEventListener('click', (e) => { stop(e); pauseGame(); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-restart').addEventListener('click', () => { audio.ui(); startGame(); });
$('btn-quit').addEventListener('click', () => { audio.ui(); toTitle(); });
$('btn-retry').addEventListener('click', startGame);
$('btn-title').addEventListener('click', () => { audio.ui(); toTitle(); });
$('btn-mute').addEventListener('click', toggleMute);

const tiltButtons = [$('btn-tilt'), $('btn-settings-tilt')];
for (const b of tiltButtons) {
  b.addEventListener('click', async () => {
    ensureAudio();
    audio.ui();
    await enableTilt(b === $('btn-settings-tilt'));
  });
}
$('btn-recenter').addEventListener('click', (e) => { stop(e); recenterTilt(); });

$('btn-invert-tilt').addEventListener('click', () => {
  settings.invertTilt = !settings.invertTilt;
  store.set('invertTilt', settings.invertTilt);
  setToggle($('btn-invert-tilt'), settings.invertTilt);
});
$('btn-shake').addEventListener('click', () => {
  settings.shake = !settings.shake;
  effects.settings.shake = settings.shake;
  store.set('shake', settings.shake);
  setToggle($('btn-shake'), settings.shake);
});
$('sensitivity').addEventListener('input', (e) => {
  settings.sensitivity = Number(e.target.value);
  store.set('sensitivity', settings.sensitivity);
  $('sensitivity-value').textContent = settings.sensitivity + '%';
  e.target.style.setProperty('--range', `${((settings.sensitivity - 50) / 130) * 100}%`);
});
$('quality').addEventListener('change', (e) => {
  settings.quality = e.target.value;
  store.set('quality', settings.quality);
  applyQuality();
});

function applyQuality() {
  const q = settings.quality;
  const low = q === 'low';
  bloom.enabled = !low;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.15 : maxDPR));
  setSize();
}

window.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing') pauseGame();
});

window.addEventListener('blur', () => {
  input.keysX = input.keysY = 0;
  input.boostKey = false;
  keys.clear();
});

/* misc DOM text */
$('hud-fps').textContent = '60';
updateBestUI();
effects.settings.shake = settings.shake;
applySettingsUI();
applyQuality();
setTiltVisual(false);

if (settings.tiltWanted) {
  $('tilt-help').textContent = 'Saved preference. Tap to enable motion on this device.';
}

/* ------------------------------------------------------------------ */
/* test / debug hooks (harmless in production)                         */
/* ------------------------------------------------------------------ */

window.__canyon = {
  state, player, combat, tilt, input, world, ship, effects, camera,
  startGame, pauseGame, resumeGame, toTitle,
  fireMissile, barrelRoll,
  jump(s = 0) {
    player.s = clamp(s, 0, TRACK_LENGTH - 200);
    player.xRel = 0;
    player.y = 13.2;
    player.vx = player.vy = 0;
    player.pos.set(pathX(player.s), player.y, -player.s);
    player.prevPos.copy(player.pos);
    ship.root.position.copy(player.pos);
    state.cameraSnap = true;
    world.update(0, camera, player.s, player.speed);
  },
  triggerBoss() {
    if (!state.bossTriggered) {
      state.bossTriggered = true;
      state.bossIntro = 3.6;
      this.jump(BOSS_TRIGGER + 120);
      combat.startBoss(player.s);
    }
    return combat.boss;
  },
  spawnEnemy(kind) {
    return combat.spawnRaider(player.s, player.sector, kind);
  },
  bossState() {
    const b = combat.boss;
    if (!b) return null;
    return {
      active: combat.bossActive, defeated: combat.bossDefeated,
      coreExposed: b.coreExposed, coreHp: b.coreHp, coreMaxHp: b.coreMaxHp,
      nodes: b.nodes.map(n => ({ name: n.name, hp: n.hp, down: n.down }))
    };
  },
  hurtBoss(amount = 12) {
    const b = combat.boss;
    if (!b || b.defeated) return null;
    const targets = combat.bossTargets();
    const t = targets.find(x => x.kind === 'node') || targets.find(x => x.kind === 'core');
    if (!t) return null;
    combat.damageBossTarget(t, amount, t.pos.clone());
    return this.bossState();
  },
  heal() {
    player.hull = 100;
    player.alive = true;
    player.invulnerable = 1;
  },
  advance(seconds, step = 1 / 60) {
    const n = Math.max(1, Math.ceil(seconds / step));
    for (let i = 0; i < n; i++) {
      if (state.phase === 'playing' && player.alive) updatePlayer(step);
      else if (state.phase === 'dying' || state.phase === 'victory') updateEnding(step);
      else if (state.phase === 'over') {
        world.update(step * .35, camera, player.s, 0);
        effects.update(step);
      }
      if (state.phase === 'over') break;
    }
    return { phase: state.phase, endTimer: state.endTimer, score: Math.floor(state.score) };
  }
};

/* boot sequence */
const bootStatus = $('boot-status');
const bootFill = $('boot-fill');
const bootMessages = [
  [14, 'LOADING CANYON GEOMETRY'],
  [38, 'CHARGING ION CANNONS'],
  [63, 'CALIBRATING NEON ARRAY'],
  [84, 'LINKING FLIGHT SYSTEMS'],
  [100, 'CLEARED FOR LAUNCH'],
];
let bootIndex = 0;
bootFill.style.width = '8%';
const bootTick = setInterval(() => {
  const [pct, msg] = bootMessages[bootIndex];
  bootFill.style.width = pct + '%';
  bootStatus.textContent = msg;
  bootIndex++;
  if (bootIndex >= bootMessages.length) {
    clearInterval(bootTick);
    setTimeout(() => {
      const bootEl = $('boot');
      if (bootEl) {
        bootEl.classList.add('done');
        setTimeout(() => bootEl.remove(), 900);
      }
      if (state.phase === 'boot') {
        state.phase = 'title';
        $('screen-title').classList.remove('leaving');
        audio.startMusic();
      }
    }, 420);
  }
}, 230);

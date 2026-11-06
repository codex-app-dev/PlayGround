import { clamp } from './config.js';
import { state } from './state.js';
import { audio } from './audio.js';
import { startRun, restartRun, togglePause } from './game.js';
import { updateGame, updateEffects } from './update.js';
import { initRender, resizeRender, render } from './render.js';
import * as ui from './ui.js';

const canvas = ui.dom.canvas;
const ctx = canvas.getContext('2d', { alpha: false });
let W = 1;
let H = 1;
let DPR = 1;

function makeRain() {
  const count = Math.round(clamp((W * H) / 10500, 40, 150));
  state.rain = [];
  for (let i = 0; i < count; i++) {
    state.rain.push({
      x: Math.random() * (W + 80),
      y: Math.random() * H,
      length: 8 + Math.random() * 16,
      speed: 380 + Math.random() * 520
    });
  }
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(W * DPR));
  canvas.height = Math.max(1, Math.round(H * DPR));
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  state.baseZoom = W < 620 ? 0.79 : W < 1050 ? 0.91 : W < 1320 ? 1.0 : 1.04;
  if (!state.over) state.cam.zoom = state.baseZoom;

  initRender(ctx, W, H, DPR);
  resizeRender(W, H, DPR);
  makeRain();
}

function ensureAudio() {
  if (!audio.ctx) {
    if (audio.init()) ui.updateSoundButton();
  } else {
    audio.resume();
  }
}

function toggleSound() {
  ensureAudio();
  audio.setMuted(audio.enabled);
  ui.updateSoundButton();
}

function bindHold(button, property) {
  const press = (event) => {
    event.preventDefault();
    ensureAudio();
    state.input[property] = true;
    button.classList.add('pressed');
    try { button.setPointerCapture(event.pointerId); } catch {}
  };
  const release = (event) => {
    event.preventDefault();
    state.input[property] = false;
    button.classList.remove('pressed');
  };
  button.addEventListener('pointerdown', press);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, release);
  }
}

function clearInput() {
  state.input.left = false;
  state.input.right = false;
  state.input.brake = false;
  state.input.accel = false;
  ui.dom.leftBtn.classList.remove('pressed');
  ui.dom.rightBtn.classList.remove('pressed');
  ui.dom.brakeBtn.classList.remove('pressed');
}

ui.dom.pauseBtn.addEventListener('click', () => {
  ensureAudio();
  togglePause();
  ui.dom.pauseBtn.blur();
});

ui.dom.resumeBtn.addEventListener('click', () => {
  ensureAudio();
  togglePause(false);
});

ui.dom.restartBtn.addEventListener('click', () => {
  ensureAudio();
  restartRun();
  audio.resume();
  document.activeElement?.blur?.();
});

ui.dom.soundBtn.addEventListener('click', () => {
  toggleSound();
  ui.dom.soundBtn.blur();
});

bindHold(ui.dom.leftBtn, 'left');
bindHold(ui.dom.rightBtn, 'right');
bindHold(ui.dom.brakeBtn, 'brake');

const gameKeys = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'
]);

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (gameKeys.has(code)) event.preventDefault();
  ensureAudio();

  if (code === 'KeyP' || code === 'Escape') {
    if (!event.repeat) togglePause();
    return;
  }

  if (code === 'KeyM') {
    if (!event.repeat) toggleSound();
    return;
  }

  if (state.over || state.overShown) {
    if ((code === 'KeyR' || code === 'Enter') && !event.repeat) {
      restartRun();
      audio.resume();
      document.activeElement?.blur?.();
    }
    return;
  }

  if (state.paused) {
    if ((code === 'Space' || code === 'Enter') && !event.repeat) togglePause(false);
    return;
  }

  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      state.input.left = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      state.input.right = true;
      break;
    case 'ArrowUp':
    case 'KeyW':
      state.input.accel = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
    case 'Space':
      state.input.brake = true;
      break;
    default:
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowLeft':
    case 'KeyA':
      state.input.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      state.input.right = false;
      break;
    case 'ArrowUp':
    case 'KeyW':
      state.input.accel = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
    case 'Space':
      state.input.brake = false;
      break;
    default:
      break;
  }
});

window.addEventListener('blur', clearInput);
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInput();
    if (!state.paused && !state.over) togglePause(true);
  }
});
document.addEventListener('contextmenu', (event) => {
  if (event.target === canvas) event.preventDefault();
});
document.addEventListener('pointerdown', ensureAudio, { passive: true });

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.045, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!state.paused) {
    if (!state.over) updateGame(dt, now);
    else updateEffects(dt);
  }

  ui.updateHud();
  render(now, state.paused ? 0 : dt);
  requestAnimationFrame(loop);
}

resize();
ui.updateSoundButton();
ui.updateHud(true);
startRun(false);
requestAnimationFrame(loop);

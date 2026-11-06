import { fmt, clamp } from './config.js';
import { state, hud } from './state.js';
import { audio } from './audio.js';

export const dom = {
  canvas: document.getElementById('game'),
  score: document.getElementById('scoreValue'),
  best: document.getElementById('bestValue'),
  bestChip: document.querySelector('.best-chip'),
  multiplier: document.getElementById('multiplier'),
  comboFill: document.getElementById('comboFill'),
  heatStars: document.getElementById('heatStars'),
  healthFill: document.getElementById('healthFill'),
  healthValue: document.getElementById('healthValue'),
  speed: document.getElementById('speedValue'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
  pauseBtn: document.getElementById('pauseBtn'),
  pauseLabel: document.getElementById('pauseLabel'),
  pauseOverlay: document.getElementById('pauseOverlay'),
  pauseBest: document.getElementById('pauseBest'),
  resumeBtn: document.getElementById('resumeBtn'),
  overOverlay: document.getElementById('overOverlay'),
  finalScore: document.getElementById('finalScore'),
  finalBest: document.getElementById('finalBest'),
  finalDistance: document.getElementById('finalDistance'),
  newRecord: document.getElementById('newRecord'),
  restartBtn: document.getElementById('restartBtn'),
  soundBtn: document.getElementById('soundBtn'),
  leftBtn: document.getElementById('leftBtn'),
  rightBtn: document.getElementById('rightBtn'),
  brakeBtn: document.getElementById('brakeBtn'),
  speedBars: [...document.querySelectorAll('.speed-bars i')]
};

export const stars = [];
for (let i = 0; i < 5; i++) {
  const star = document.createElement('i');
  dom.heatStars.appendChild(star);
  stars.push(star);
}

let toastTimeout = 0;
let hintTimeout = 0;

export function updateHud(force = false) {
  const score = Math.floor(state.score);
  if (force || score !== hud.score) {
    dom.score.textContent = fmt(score);
    hud.score = score;
  }

  if (force || state.best !== hud.best) {
    dom.best.textContent = fmt(state.best);
    dom.pauseBest.textContent = fmt(state.best);
    dom.finalBest.textContent = fmt(state.best);
    hud.best = state.best;
  }

  if (force || state.multiplier !== hud.multiplier) {
    dom.multiplier.textContent = `×${state.multiplier}`;
    dom.multiplier.classList.toggle('hot', state.multiplier >= 4);
    hud.multiplier = state.multiplier;
  }

  dom.comboFill.style.transform = `scaleX(${clamp(state.comboTimer / 8, 0, 1)})`;

  const health = Math.max(0, Math.round(state.health));
  if (force || health !== hud.health) {
    dom.healthValue.textContent = String(health);
    dom.healthFill.style.transform = `scaleX(${health / 100})`;
    dom.healthFill.style.background = health <= 30
      ? 'linear-gradient(90deg, #ff2e5f, #ff8a6a)'
      : health <= 60
        ? 'linear-gradient(90deg, #ffb15c, #ffe29a)'
        : 'linear-gradient(90deg, #20d6a8, #79ffd5)';
    document.body.classList.toggle('critical', health <= 30);
    hud.health = health;
  }

  const speed = Math.round(Math.hypot(state.player.vx, state.player.vy) * 0.32);
  if (force || speed !== hud.speed) {
    dom.speed.textContent = String(speed);
    const lit = Math.ceil(clamp(speed / 215, 0, 1) * dom.speedBars.length);
    dom.speedBars.forEach((bar, index) => bar.classList.toggle('on', index < lit));
    hud.speed = speed;
  }

  if (force || state.heat !== hud.heat) {
    stars.forEach((star, index) => {
      star.classList.toggle('on', index < state.heat);
      star.classList.toggle('pulse', index === state.heat - 1 && state.heat >= 3);
    });
    hud.heat = state.heat;
  }

  if (force || state.recordBeaten !== hud.record) {
    dom.bestChip.classList.toggle('beat', state.recordBeaten);
    hud.record = state.recordBeaten;
  }
}

export function showToast(text, kind = '') {
  dom.toast.textContent = text;
  dom.toast.className = `toast show${kind ? ` ${kind}` : ''}`;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 1450);
}

export function hideToast() {
  window.clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
}

export function setPausedUI(paused) {
  document.body.classList.toggle('paused', paused);
  dom.pauseOverlay.hidden = !paused;
  dom.pauseBtn.setAttribute('aria-pressed', String(paused));
  dom.pauseBtn.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  dom.pauseLabel.textContent = paused ? 'RESUME' : 'PAUSE';
  dom.pauseBest.textContent = fmt(state.best);
  if (paused) {
    window.setTimeout(() => {
      if (state.paused) dom.resumeBtn.focus({ preventScroll: true });
    }, 80);
  } else {
    dom.pauseBtn.blur();
  }
}

export function hideOverlays() {
  dom.pauseOverlay.hidden = true;
  dom.overOverlay.hidden = true;
  document.body.classList.remove('paused');
  dom.pauseBtn.setAttribute('aria-pressed', 'false');
  dom.pauseBtn.setAttribute('aria-label', 'Pause game');
  dom.pauseLabel.textContent = 'PAUSE';
}

export function showGameOver(score, isNewRecord) {
  state.overShown = true;
  dom.finalScore.textContent = fmt(score);
  dom.finalBest.textContent = fmt(state.best);
  dom.finalDistance.textContent = fmt(Math.floor(state.distance / 10));
  dom.newRecord.hidden = !isNewRecord;
  dom.overOverlay.hidden = false;
  window.setTimeout(() => {
    if (state.overShown) dom.restartBtn.focus({ preventScroll: true });
  }, 100);
}

export function hideHint() {
  dom.hint.classList.add('fade');
}

export function showHint() {
  window.clearTimeout(hintTimeout);
  dom.hint.classList.remove('fade');
  hintTimeout = window.setTimeout(() => dom.hint.classList.add('fade'), 8500);
}

export function resetHintTimer() {
  window.clearTimeout(hintTimeout);
  hintTimeout = window.setTimeout(() => dom.hint.classList.add('fade'), 8500);
}

export function updateSoundButton() {
  document.body.classList.toggle('muted', !audio.enabled);
  dom.soundBtn.setAttribute('aria-pressed', String(!audio.enabled));
  dom.soundBtn.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
}

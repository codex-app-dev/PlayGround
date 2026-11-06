import { BLOCK, ROAD, TAU, MAX_TRAFFIC, MAX_PICKUPS, TRAFFIC_COLORS, clamp, saveBest } from './config.js';
import { state, resetWorld } from './state.js';
import { pointBlocked } from './city.js';
import { audio } from './audio.js';
import * as ui from './ui.js';

export function addParticle(x, y, vx, vy, life, size, color, type = 'spark', alpha = 1) {
  if (state.particles.length > 460) state.particles.shift();
  state.particles.push({ x, y, vx, vy, life, max: life, size, color, type, alpha });
}

export function addFloater(x, y, text, color, size = 12) {
  if (state.floaters.length > 16) state.floaters.shift();
  state.floaters.push({ x, y, text, color, size, life: 1.15, max: 1.15 });
}

export function burst(x, y, color, count = 16, speed = 190) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const velocity = speed * (0.35 + Math.random() * 0.8);
    addParticle(
      x, y,
      Math.cos(angle) * velocity,
      Math.sin(angle) * velocity,
      0.28 + Math.random() * 0.42,
      1.2 + Math.random() * 2,
      color,
      'spark',
      0.9
    );
  }
}

function smoke(x, y, count = 5) {
  for (let i = 0; i < count; i++) {
    addParticle(
      x + (Math.random() - 0.5) * 20,
      y + (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 44,
      (Math.random() - 0.5) * 44 - 14,
      0.7 + Math.random() * 0.8,
      5 + Math.random() * 8,
      '#56657f',
      'smoke',
      0.7
    );
  }
}

function roadSpot(minDistance, maxDistance, avoidRadius, ahead, forPickup) {
  const p = state.player;
  for (let attempt = 0; attempt < 44; attempt++) {
    const angle = ahead
      ? p.angle + (Math.random() - 0.5) * 2.35
      : Math.random() * TAU;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    let x = p.x + Math.cos(angle) * distance;
    let y = p.y + Math.sin(angle) * distance;

    const roadX = Math.round(x / BLOCK) * BLOCK;
    const roadY = Math.round(y / BLOCK) * BLOCK;
    let heading = -Math.PI / 2;
    const vertical = Math.abs(x - roadX) <= Math.abs(y - roadY);
    if (vertical) {
      if (forPickup) {
        x = roadX + (Math.random() < 0.5 ? -1 : 1) * ROAD * 0.19;
      } else {
        const up = Math.random() < 0.5;
        heading = up ? -Math.PI / 2 : Math.PI / 2;
        x = roadX + (up ? 1 : -1) * ROAD * 0.21;
      }
    } else if (forPickup) {
      y = roadY + (Math.random() < 0.5 ? -1 : 1) * ROAD * 0.19;
    } else {
      const right = Math.random() < 0.5;
      heading = right ? 0 : Math.PI;
      y = roadY + (right ? 1 : -1) * ROAD * 0.21;
    }

    if (Math.hypot(x - p.x, y - p.y) < avoidRadius) continue;
    if (pointBlocked(x, y, 26)) continue;
    return { x, y, angle: heading };
  }
  return null;
}

export function spawnTraffic(initial = false) {
  if (state.traffic.length >= MAX_TRAFFIC) return;
  const spot = roadSpot(initial ? 280 : 640, initial ? 1180 : 1420, 250, false, false);
  if (!spot) return;
  if (state.traffic.some((car) => Math.hypot(car.x - spot.x, car.y - spot.y) < 72)) return;
  const colors = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
  state.traffic.push({
    x: spot.x,
    y: spot.y,
    angle: spot.angle,
    speed: 96 + Math.random() * 94,
    color: colors[0],
    dark: colors[1],
    near: false,
    seed: Math.random() * 1000
  });
}

export function spawnPickup(initial = false) {
  if (state.pickups.length >= MAX_PICKUPS) return;
  const spot = roadSpot(initial ? 330 : 360, initial ? 1050 : 920, 180, true, true);
  if (!spot) return;
  if (state.pickups.some((pickup) => Math.hypot(pickup.x - spot.x, pickup.y - spot.y) < 95)) return;
  state.pickups.push({
    x: spot.x,
    y: spot.y,
    phase: Math.random() * TAU,
    seed: Math.random() * 100
  });
}

export function spawnPolice(initial = false) {
  const p = state.player;
  let x;
  let y;
  let angle = -Math.PI / 2;
  if (initial) {
    x = p.x;
    y = p.y + 270;
  } else {
    const side = Math.random() * TAU;
    const distance = 700 + Math.random() * 280;
    x = p.x + Math.cos(side) * distance;
    y = p.y + Math.sin(side) * distance;
    angle = -Math.PI / 2 + (Math.random() - 0.5);
  }
  state.police.push({
    x,
    y,
    angle,
    speed: initial ? 285 : 250,
    maxSpeed: 302 + state.heat * 18 + Math.random() * 20,
    seed: Math.random() * TAU
  });
}

export function startRun(isRestart = false) {
  state.runId++;
  state.paused = false;
  state.over = false;
  state.overShown = false;
  state.time = 0;
  state.score = 0;
  state.distance = 0;
  state.health = 100;
  state.heat = 1;
  state.multiplier = 1;
  state.comboTimer = 0;
  state.recordBeaten = false;
  state.damageCooldown = 0;
  state.flash = 0;
  state.spawnTimer = 0.9;
  state.policeSpawnTimer = 4;
  state.sirenTimer = 2.5;

  resetWorld();
  for (let i = 0; i < 14; i++) spawnTraffic(true);
  for (let i = 0; i < MAX_PICKUPS; i++) spawnPickup(true);
  spawnPolice(true);

  ui.hideOverlays();
  ui.hideToast();
  ui.updateHud(true);
  if (isRestart) ui.hideHint();
  else ui.showHint();
  audio.update(0, true);
}

export function restartRun() {
  startRun(true);
}

export function togglePause(force) {
  if (state.over) return;
  const next = typeof force === 'boolean' ? force : !state.paused;
  if (next === state.paused) return;
  state.paused = next;
  ui.setPausedUI(next);
  if (next) {
    audio.update(0, false);
  } else {
    audio.resume();
  }
}

export function endRun() {
  if (state.over) return;
  state.over = true;
  state.paused = false;
  state.health = 0;
  state.player.vx = 0;
  state.player.vy = 0;
  state.multiplier = 1;
  state.comboTimer = 0;

  const x = state.player.x;
  const y = state.player.y;
  burst(x, y, '#ffd166', 34, 300);
  burst(x, y, '#ff4f77', 26, 240);
  smoke(x, y, 14);
  state.cam.shake = 32;
  state.flash = 0.95;
  audio.crash();
  ui.hideHint();

  const score = Math.floor(state.score);
  const isNewRecord = score > state.best && score > 0;
  if (isNewRecord) {
    state.best = score;
    state.recordBeaten = true;
    saveBest(score);
  }
  ui.updateHud(true);

  const runId = state.runId;
  window.setTimeout(() => {
    if (state.runId === runId && state.over) ui.showGameOver(score, isNewRecord);
  }, 720);
}

export { smoke };

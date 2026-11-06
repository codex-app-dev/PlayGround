import { MAX_MULTIPLIER, TAU, clamp, damp, angleDiff } from './config.js';
import { state } from './state.js';
import { findBuildingPush } from './city.js';
import { audio } from './audio.js';
import * as ui from './ui.js';
import {
  addParticle, addFloater, burst, smoke, spawnTraffic, spawnPickup, spawnPolice, endRun
} from './game.js';

export function updateGame(dt, now) {
  state.time += dt;
  state.damageCooldown = Math.max(0, state.damageCooldown - dt);

  updatePlayer(dt, now);
  updateTraffic(dt);
  updatePolice(dt, now);
  updatePickups(dt);
  updateSpawner(dt);

  if (state.over) {
    updateEffects(dt);
    audio.update(0, false);
    return;
  }

  updateCamera(dt);
  updateEffects(dt);

  const speed = Math.hypot(state.player.vx, state.player.vy);
  state.distance += speed * dt;
  state.score += speed * dt * 0.078 * state.multiplier;

  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0 && state.multiplier > 1) {
      state.multiplier = 1;
      state.comboTimer = 0;
      addFloater(state.player.x, state.player.y - 42, 'COMBO LOST', '#ff7186', 12);
    }
  }

  const targetHeat = clamp(1 + Math.floor(state.time / 22), 1, 5);
  if (targetHeat > state.heat) {
    state.heat = targetHeat;
    ui.showToast(`WANTED LEVEL ${targetHeat}`, 'bad');
    audio.levelUp();
  }

  if (!state.recordBeaten && state.best > 0 && Math.floor(state.score) > state.best) {
    state.recordBeaten = true;
    ui.showToast('NEW RECORD', 'gold');
  }

  audio.update(speed, true);

  state.sirenTimer -= dt;
  if (state.sirenTimer <= 0) {
    const close = state.police.some((car) => Math.hypot(car.x - state.player.x, car.y - state.player.y) < 640);
    if (close) {
      audio.siren();
      state.sirenTimer = 3.1 + Math.random() * 1.1;
    } else {
      state.sirenTimer = 1.4;
    }
  }
}

function updatePlayer(dt, now) {
  const p = state.player;
  const input = state.input;
  const braking = input.brake;

  p.steer = damp(p.steer, (input.right ? 1 : 0) - (input.left ? 1 : 0), 11, dt);

  const startFx = Math.cos(p.angle);
  const startFy = Math.sin(p.angle);
  const startForward = p.vx * startFx + p.vy * startFy;
  const turnScale = clamp(Math.abs(startForward) / 230, 0, 1);
  const direction = startForward < -5 ? -1 : 1;
  p.angle += p.steer * 3.25 * (braking ? 1.34 : 1) * turnScale * dt * direction;

  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const sideX = -fy;
  const sideY = fx;

  let forwardSpeed = p.vx * fx + p.vy * fy;
  let sideSpeed = p.vx * sideX + p.vy * sideY;

  const targetSpeed = input.accel ? 690 : braking ? 120 : 385;
  const engine = clamp((targetSpeed - forwardSpeed) * 2.5, -1200, 940);

  forwardSpeed = clamp(forwardSpeed + engine * dt, -190, 710);
  sideSpeed *= Math.exp(-(braking ? 4.0 : 7.4) * dt);
  if (Math.abs(sideSpeed) > 70) {
    state.cam.shake = Math.max(state.cam.shake, Math.min(2.6, Math.abs(sideSpeed) * 0.012));
  }

  p.vx = fx * forwardSpeed + sideX * sideSpeed;
  p.vy = fy * forwardSpeed + sideY * sideSpeed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  p.trailTimer -= dt;
  const speed = Math.hypot(p.vx, p.vy);
  if (p.trailTimer <= 0 && speed > 40) {
    p.trailTimer = speed > 500 ? 0.019 : 0.031;
    const rearX = p.x - fx * 27;
    const rearY = p.y - fy * 27;
    addParticle(
      rearX + sideX * (Math.random() - 0.5) * 8,
      rearY + sideY * (Math.random() - 0.5) * 8,
      -fx * (18 + Math.random() * 22) + (Math.random() - 0.5) * 26,
      -fy * (18 + Math.random() * 22) + (Math.random() - 0.5) * 26,
      0.26 + Math.random() * 0.22,
      2.5 + Math.random() * 2.5,
      Math.random() < 0.22 ? '#ff4d94' : '#43f4ff',
      'trail',
      0.8
    );
  }

  p.skidTimer -= dt;
  if (p.skidTimer <= 0 && speed > 235 && (Math.abs(p.steer) > 0.48 || Math.abs(sideSpeed) > 88)) {
    p.skidTimer = 0.028;
    for (const side of [-1, 1]) {
      const rx = p.x - fx * 19 + sideX * 8 * side;
      const ry = p.y - fy * 19 + sideY * 8 * side;
      state.skids.push({
        x1: rx, y1: ry,
        x2: rx - fx * 11, y2: ry - fy * 11,
        life: 6, max: 6
      });
    }
    if (state.skids.length > 340) state.skids.splice(0, state.skids.length - 340);
  }

  for (const offset of [18, 0, -18]) {
    const probeX = p.x + fx * offset;
    const probeY = p.y + fy * offset;
    const hit = findBuildingPush(probeX, probeY, 14);
    if (!hit) continue;
    p.x += hit.nx * hit.depth;
    p.y += hit.ny * hit.depth;
    const into = p.vx * hit.nx + p.vy * hit.ny;
    if (into < 0) {
      p.vx -= into * 1.24 * hit.nx;
      p.vy -= into * 1.24 * hit.ny;
    }
    p.vx *= 0.72;
    p.vy *= 0.72;
    burst(probeX, probeY, '#ffc857', 6, 140);
    state.cam.shake = Math.min(20, state.cam.shake + 5);
    damagePlayer(7 + Math.hypot(p.vx, p.vy) * 0.012);
    break;
  }
}

export function damagePlayer(amount) {
  if (state.damageCooldown > 0 || state.over) return;
  state.damageCooldown = 0.72;
  state.health = Math.max(0, state.health - amount);
  state.multiplier = 1;
  state.comboTimer = 0;
  state.flash = Math.min(1, state.flash + 0.45);
  state.cam.shake = Math.min(28, state.cam.shake + 11);
  audio.crash();
  addFloater(state.player.x, state.player.y - 36, `-${Math.round(amount)}`, '#ff7186', 13);
  burst(state.player.x, state.player.y, '#ff5c7a', 10, 150);
  if (state.health <= 0) endRun();
}

function updateTraffic(dt) {
  const p = state.player;
  for (let i = state.traffic.length - 1; i >= 0; i--) {
    const car = state.traffic[i];
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    const distance = Math.hypot(car.x - p.x, car.y - p.y);
    if (distance > 1780) {
      state.traffic.splice(i, 1);
      continue;
    }

    if (distance < 42) {
      burst(car.x, car.y, car.color, 18, 230);
      burst(car.x, car.y, '#ffc857', 8, 150);
      smoke(car.x, car.y, 6);
      state.traffic.splice(i, 1);
      damagePlayer(14);
      continue;
    }

    if (distance < 66 && !car.near) {
      car.near = true;
      const points = Math.round(35 * state.multiplier);
      state.score += points;
      addFloater(car.x, car.y, `NEAR MISS +${points}`, '#83ffe3', 11);
      audio.nearMiss();
    } else if (distance > 138 && car.near) {
      car.near = false;
    }
  }

  if (state.over) return;
}

function updatePolice(dt, now) {
  const p = state.player;
  for (const car of state.police) {
    let dx = p.x - car.x;
    let dy = p.y - car.y;
    let distance = Math.hypot(dx, dy);

    if (distance > 1700) {
      const behind = p.angle + Math.PI + (Math.random() - 0.5) * 0.7;
      car.x = p.x + Math.cos(behind) * 760;
      car.y = p.y + Math.sin(behind) * 760;
      car.speed = 120;
      dx = p.x - car.x;
      dy = p.y - car.y;
      distance = Math.hypot(dx, dy);
    }

    const desired = Math.atan2(dy, dx);
    car.angle += angleDiff(car.angle, desired) * (1 - Math.exp(-2.05 * dt));
    const targetSpeed = car.maxSpeed * (distance < 140 ? 0.82 : 1);
    car.speed = damp(car.speed, targetSpeed, 1.75, dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x += Math.cos(car.angle + Math.PI / 2) * Math.sin(now * 0.0018 + car.seed) * 6 * dt;

    dx = p.x - car.x;
    dy = p.y - car.y;
    distance = Math.hypot(dx, dy);
    if (distance < 44) {
      const nx = dx / (distance || 1);
      const ny = dy / (distance || 1);
      p.x += nx * 22;
      p.y += ny * 22;
      car.x -= nx * 48;
      car.y -= ny * 48;
      car.speed *= 0.62;
      burst((p.x + car.x) / 2, (p.y + car.y) / 2, '#ff315c', 12, 200);
      damagePlayer(18 + state.heat * 2);
    }
  }
}

function updatePickups(dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    const distance = Math.hypot(pickup.x - p.x, pickup.y - p.y);
    if (distance > 34) continue;

    state.pickups.splice(i, 1);
    state.multiplier = Math.min(MAX_MULTIPLIER, state.multiplier + 1);
    state.comboTimer = 8;
    const points = 120 * state.multiplier;
    state.score += points;
    state.health = Math.min(100, state.health + 4);

    for (let k = 0; k < 18; k++) {
      const angle = Math.random() * TAU;
      const speed = 70 + Math.random() * 190;
      addParticle(
        pickup.x, pickup.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        0.36 + Math.random() * 0.4, 1.5 + Math.random() * 2.2,
        Math.random() < 0.4 ? '#fff3c4' : '#ffc857',
        'spark', 0.9
      );
    }
    addFloater(pickup.x, pickup.y - 12, `+${points}`, '#ffd66e', 14);
    audio.pickup();
    if (state.multiplier === 5 || state.multiplier === 8) {
      ui.showToast(`OVERDRIVE ×${state.multiplier}`, 'gold');
    }
    spawnPickup(false);
  }
}

function updateSpawner(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 0.62 + Math.random() * 0.55;
    if (state.traffic.length < 18) spawnTraffic(false);
  }

  let refill = 0;
  while (state.pickups.length < 12 && refill < 2) {
    spawnPickup(false);
    refill++;
  }

  if (state.police.length < state.heat) {
    state.policeSpawnTimer -= dt;
    if (state.policeSpawnTimer <= 0) {
      spawnPolice(false);
      state.policeSpawnTimer = 4.2;
    }
  } else {
    state.policeSpawnTimer = Math.max(state.policeSpawnTimer, 2);
  }
}

function updateCamera(dt) {
  const p = state.player;
  const speed = Math.hypot(p.vx, p.vy);
  const lead = 82 + speed * 0.12;
  const targetX = p.x + Math.cos(p.angle) * lead;
  const targetY = p.y + Math.sin(p.angle) * lead;

  state.cam.x = damp(state.cam.x, targetX, 4.2, dt);
  state.cam.y = damp(state.cam.y, targetY, 4.2, dt);
  state.cam.angle += angleDiff(state.cam.angle, p.angle) * (1 - Math.exp(-3.2 * dt));

  const targetZoom = state.baseZoom - clamp(speed / 720, 0, 1) * 0.075;
  state.cam.zoom = damp(state.cam.zoom, targetZoom, 2.4, dt);
}

export function updateEffects(dt) {
  const particles = state.particles;
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    const drag = particle.type === 'smoke' ? 0.55 : 2.6;
    const factor = Math.exp(-drag * dt);
    particle.vx *= factor;
    particle.vy *= factor;
    if (particle.type === 'smoke') particle.vy -= 8 * dt;
  }

  const floaters = state.floaters;
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].life -= dt;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }

  const skids = state.skids;
  for (let i = skids.length - 1; i >= 0; i--) {
    skids[i].life -= dt;
    if (skids[i].life <= 0) skids.splice(i, 1);
  }

  state.cam.shake = Math.max(0, state.cam.shake - 38 * dt);
  state.flash = Math.max(0, state.flash - 2.4 * dt);
}

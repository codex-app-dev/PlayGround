import * as THREE from 'three';
import './style.css';
import { createWorld, BASE_POSITIONS, TEAM_COLORS, groundHeight } from './world.js';
import { Player } from './player.js';
import { BotManager } from './bots.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { initTouchControls } from './touch.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 2400);
scene.add(camera);

const world = createWorld(scene);
const effects = new Effects(scene);
const audio = new AudioEngine();
const hud = new HUD();

const state = {
  mode: 'menu',
  elapsed: 0,
  scores: { blue: 0, red: 0 },
  scoreLimit: 5,
  matchDuration: 540,
  timeLeft: 540,
  pointerLocked: false,
  lastCaptureWarning: 0,
  matchEnded: false,
};

let player;
let bots;
let combat;

const playerSpawn = new THREE.Vector3(BASE_POSITIONS.blue.x + 39, 0, 1.5);

player = new Player(camera, scene, effects, audio, {
  onFire: (payload) => combat.spawn(payload),
  onDamage: () => hud.damage(),
  onDeath: (source) => handlePlayerDeath(source),
});
player.weaponGroup.visible = false;
player.position.copy(playerSpawn);
player.position.y = groundHeight(playerSpawn.x, playerSpawn.z);
player.alive = false;

combat = new Combat(scene, effects, audio);

bots = new BotManager(scene, camera, world, effects, audio, {
  onHit: () => hud.hitmarker(),
  onBotKilled: (bot, attacker) => handleBotKilled(bot, attacker),
  onBotFire: (payload) => combat.spawn(payload),
  onBotCapture: (bot) => handleCapture(bot.team, bot),
});

bots.setPlayer(player);

combat.setCallbacks({
  bots: () => bots.bots,
  player: () => player,
  onBotDamage: (bot, amount, attacker) => bots.damageBot(bot, amount, attacker),
  onExplosion: (position, projectile) => {
    if (projectile.owner === 'player') {
      hud.hitmarker();
    }
  },
});

const actions = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  ski: false,
  fire: false,
  zoom: false,
  reloadPressed: false,
};

const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'ski', ShiftRight: 'ski', ControlLeft: 'ski', ControlRight: 'ski',
};

const touchControls = initTouchControls({
  getPlayer: () => player,
  actions,
  state,
});
const isTouch = touchControls.touch;
if (isTouch) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    if (event.code === 'KeyR') event.preventDefault();
    return;
  }
  const mapped = keyMap[event.code];
  if (mapped) {
    actions[mapped] = true;
    event.preventDefault();
  }
  if (event.code === 'KeyR') {
    actions.reloadPressed = true;
    event.preventDefault();
  }
  if (event.code === 'KeyM') {
    audio.enabled = !audio.enabled;
    if (audio.master) audio.master.gain.value = audio.enabled ? 0.62 : 0;
  }
});

window.addEventListener('keyup', (event) => {
  const mapped = keyMap[event.code];
  if (mapped) {
    actions[mapped] = false;
    event.preventDefault();
  }
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(actions)) actions[key] = false;
});

window.addEventListener('mousedown', (event) => {
  if (isTouch || state.mode !== 'playing') return;
  if (event.button === 0) actions.fire = true;
  if (event.button === 2) actions.zoom = true;
});

window.addEventListener('mouseup', (event) => {
  if (isTouch) return;
  if (event.button === 0) actions.fire = false;
  if (event.button === 2) actions.zoom = false;
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('mousemove', (event) => {
  if (state.mode !== 'playing' || !state.pointerLocked) return;
  player.applyLook(event.movementX || 0, event.movementY || 0);
});

document.addEventListener('pointerlockchange', () => {
  state.pointerLocked = document.pointerLockElement === canvas;
  hud.setPointerLocked(state.pointerLocked, state.mode === 'playing');
});

canvas.addEventListener('click', () => {
  if (isTouch) return;
  if (state.mode === 'playing' && !state.pointerLocked) requestPointerLock();
});

document.getElementById('play-button').addEventListener('click', () => {
  startPlaying();
});

document.getElementById('rematch-button').addEventListener('click', () => {
  audio.ui();
  resetMatch();
  hud.hideMatch();
  state.mode = 'playing';
  state.matchEnded = false;
  player.respawn(playerSpawn, -Math.PI / 2);
  player.weaponGroup.visible = true;
  requestPointerLock();
});

function requestPointerLock() {
  if (isTouch) return;
  try {
    const promise = canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (promise?.catch) promise.catch(() => canvas.requestPointerLock?.());
  } catch {
    canvas.requestPointerLock?.();
  }
}

function startPlaying() {
  if (state.mode === 'playing') return;
  audio.unlock();
  audio.ui();
  resetMatch();
  state.mode = 'playing';
  state.matchEnded = false;
  const menu = document.getElementById('menu');
  menu.classList.add('closing');
  setTimeout(() => menu.classList.add('hidden'), 480);
  hud.show();
  hud.setPointerLocked(false, true);
  player.respawn(playerSpawn, -Math.PI / 2);
  player.weaponGroup.visible = true;
  requestPointerLock();
}

function resetMatch() {
  state.scores.blue = 0;
  state.scores.red = 0;
  state.timeLeft = state.matchDuration;
  state.lastCaptureWarning = 0;
  for (const team of ['blue', 'red']) {
    const flag = world.flags[team];
    flag.carrier = null;
    flag.dropped = false;
    flag.returnTimer = 0;
    flag.group.position.copy(flag.home);
    flag.group.rotation.set(0, 0, 0);
  }
  for (const bot of bots.bots) {
    bot.carrierFlag = null;
    bot.reset();
  }
  if (player) {
    player.carriedFlag = null;
    player.health = player.maxHealth;
    player.energy = player.maxEnergy;
    player.ammo = player.maxAmmo;
    player.reloading = false;
    player.reloadTimer = 0;
    player.alive = true;
    player.deathTimer = 0;
    player.kills = 0;
    player.deaths = 0;
    player.position.copy(playerSpawn);
    player.position.y = groundHeight(playerSpawn.x, playerSpawn.z);
    player.velocity.set(0, 0, 0);
    player.yaw = -Math.PI / 2;
    player.pitch = 0;
    player.speed = 0;
    player.onGround = true;
    player.weaponGroup.visible = true;
    player.fireCooldown = 0;
  }
  hud.hideDeath();
  hud.hideMatch();
}

function spawnPlayer() {
  const spawn = playerSpawn.clone();
  spawn.z += (Math.random() - 0.5) * 8;
  player.respawn(spawn, -Math.PI / 2);
  player.weaponGroup.visible = true;
  hud.hideDeath();
}

function dropFlag(flag, position) {
  if (!flag) return;
  flag.carrier = null;
  flag.dropped = true;
  flag.returnTimer = 20;
  const y = groundHeight(position.x, position.z);
  flag.group.position.set(position.x, y + 0.1, position.z);
  flag.group.rotation.set(0, (Math.random() - 0.5) * 0.8, 0.12);
}

function returnFlag(flag, announce = true) {
  flag.carrier = null;
  flag.dropped = false;
  flag.returnTimer = 0;
  flag.group.position.copy(flag.home);
  flag.group.rotation.set(0, 0, 0);
  if (announce) {
    const teamName = flag.team === 'blue' ? 'BLUE' : 'RED';
    hud.showBanner(`${teamName} FLAG RETURNED`, 'HOME STAND SECURED', 1800);
  }
}

function handleBotKilled(bot, attacker) {
  if (bot.carrierFlag) {
    dropFlag(bot.carrierFlag, bot.position.clone());
    bot.carrierFlag = null;
  }
  let killer = { name: 'WORLD', team: 'neutral' };
  if (attacker?.type === 'player') {
    killer = { name: 'YOU', team: 'blue' };
    player.kills++;
  } else if (attacker?.name) {
    killer = { name: attacker.name, team: attacker.team };
  }
  hud.killfeedMessage(killer, { name: bot.name, team: bot.team });
  if (attacker?.type === 'player') {
    audio.kill();
    hud.showBanner(`FRAGGED ${bot.name}`, '+1 CONFIRMED', 1100);
  }
}

function handlePlayerDeath(source) {
  if (player.carriedFlag) {
    dropFlag(player.carriedFlag, player.position.clone());
    player.carriedFlag = null;
    hud.showBanner('ENEMY FLAG DROPPED', 'RECOVER IT BEFORE IT RETURNS', 2200);
    audio.flagLost();
  }
  hud.showDeath(source, player.deathTimer);
  if (source?.name && source.name !== 'THE GROUND') {
    hud.killfeedMessage(
      { name: source.name, team: source.team === 'blue' ? 'blue' : 'red' },
      { name: 'YOU', team: 'blue' }
    );
  }
  audio.setJet(false);
  audio.setSki(false);
}

function handleCapture(team, carrier) {
  if (state.mode !== 'playing') return;
  const enemyTeam = team === 'blue' ? 'red' : 'blue';
  const flag = world.flags[enemyTeam];
  if (carrier === 'player') player.carriedFlag = null;
  if (carrier && carrier.carrierFlag) carrier.carrierFlag = null;
  returnFlag(flag, false);
  state.scores[team]++;
  const teamColor = team === 'blue' ? 0x54e8ff : 0xff6a47;
  effects.explosion(new THREE.Vector3(BASE_POSITIONS[team].x, BASE_POSITIONS[team].y + 3, BASE_POSITIONS[team].z), teamColor, 1.6);
  effects.ring(new THREE.Vector3(BASE_POSITIONS[team].x, BASE_POSITIONS[team].y + 2.4, BASE_POSITIONS[team].z), teamColor, { start: 4, end: 32, life: 1.1 });
  audio.capture();
  const label = team === 'blue' ? 'BLUE TEAM CAPTURED THE FLAG' : 'RED TEAM CAPTURED THE FLAG';
  hud.showBanner(label, `${state.scores[team]} / ${state.scoreLimit} CAPTURES`, 2800);
  if (state.scores[team] >= state.scoreLimit) endMatch(team);
}

function endMatch(winner) {
  if (state.matchEnded) return;
  state.matchEnded = true;
  state.mode = 'matchover';
  actions.fire = false;
  actions.zoom = false;
  document.exitPointerLock?.();
  const blueWon = winner === 'blue';
  hud.showMatch(blueWon, state.scores.blue, state.scores.red);
  audio.setJet(false);
  audio.setSki(false);
}

function updateFlags(dt) {
  for (const team of ['blue', 'red']) {
    const flag = world.flags[team];
    if (flag.carrier === 'player') {
      flag.group.position.set(player.position.x, player.position.y + 1.35, player.position.z);
      flag.group.rotation.set(0, player.yaw + Math.PI / 2, 0.05);
    } else if (flag.carrier && flag.carrier.alive !== false && flag.carrier.position) {
      flag.group.position.set(
        flag.carrier.position.x,
        flag.carrier.position.y + 1.5,
        flag.carrier.position.z
      );
      flag.group.rotation.set(0, flag.carrier.yaw + Math.PI / 2, 0.05);
    } else if (flag.dropped) {
      flag.returnTimer -= dt;
      if (flag.returnTimer <= 0) returnFlag(flag, true);
      flag.glow.material.opacity = 0.25 + Math.sin(state.elapsed * 6) * 0.18;
    }
  }

  for (const team of ['blue', 'red']) {
    const flag = world.flags[team];
    if (flag.carrier) continue;

    if (team === 'red' && player.alive && !player.carriedFlag) {
      const d = player.position.distanceTo(flag.group.position);
      if (d < 3.3) {
        flag.carrier = 'player';
        flag.dropped = false;
        flag.returnTimer = 0;
        player.carriedFlag = flag;
        audio.pickup();
        hud.showBanner('ENEMY FLAG SECURED', 'RETURN TO YOUR BASE TO CAPTURE', 2400);
      }
    }

    if (team === 'blue' && flag.dropped && player.alive) {
      const d = player.position.distanceTo(flag.group.position);
      if (d < 3.2) {
        returnFlag(flag, false);
        hud.showBanner('BLUE FLAG RECOVERED', 'DEFENSE RESTORED', 1700);
        audio.pickup();
      }
    }

    for (const bot of bots.bots) {
      if (!bot.alive) continue;
      const d = bot.position.distanceTo(flag.group.position);
      if (bot.team !== team && !bot.carrierFlag && d < 3.2) {
        flag.carrier = bot;
        flag.dropped = false;
        flag.returnTimer = 0;
        bot.carrierFlag = flag;
        hud.showBanner(
          team === 'blue' ? 'BLUE FLAG TAKEN' : 'RED FLAG TAKEN',
          `${bot.name} HAS THE FLAG`,
          2300
        );
        audio.flagLost();
      } else if (bot.team === team && flag.dropped && d < 3.2) {
        returnFlag(flag, false);
        hud.showBanner(`${team.toUpperCase()} FLAG RECOVERED`, 'DEFENSE RESTORED', 1700);
      }
    }
  }

  if (player.alive && player.carriedFlag) {
    const ownBase = new THREE.Vector3(BASE_POSITIONS.blue.x, 0, BASE_POSITIONS.blue.z);
    const ownFlag = world.flags.blue;
    const distance = Math.hypot(player.position.x - ownBase.x, player.position.z - ownBase.z);
    if (distance < 6.4) {
      if (ownFlag.carrier || ownFlag.dropped) {
        if (state.elapsed - state.lastCaptureWarning > 3) {
          state.lastCaptureWarning = state.elapsed;
          hud.showBanner('YOUR FLAG IS NOT HOME', 'RECOVER THE BLUE FLAG FIRST', 2000);
        }
      } else {
        handleCapture('blue', 'player');
      }
    }
  }

  for (const bot of bots.bots) {
    if (!bot.alive || !bot.carrierFlag) continue;
    const base = BASE_POSITIONS[bot.team];
    const distance = Math.hypot(bot.position.x - base.x, bot.position.z - base.z);
    const ownFlag = world.flags[bot.team];
    if (distance < 6 && !ownFlag.carrier && !ownFlag.dropped) {
      handleCapture(bot.team, bot);
      break;
    }
  }
}

function updateMatch(dt) {
  if (state.mode !== 'playing') return;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    if (state.scores.blue === state.scores.red) {
      state.timeLeft = 90;
      hud.showBanner('OVERTIME', 'NEXT CAPTURE WINS', 2600);
    } else {
      endMatch(state.scores.blue > state.scores.red ? 'blue' : 'red');
    }
  }
}

let last = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  state.elapsed += dt;

  if (state.mode === 'menu') {
    const orbit = state.elapsed * 0.11;
    const base = BASE_POSITIONS.blue;
    camera.position.set(
      base.x - 40 + Math.sin(orbit) * 12,
      base.y + 23,
      72 + Math.cos(orbit) * 10
    );
    camera.lookAt(base.x + 95, base.y + 9, -18);
    camera.fov += (62 - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
    world.update(dt, state.elapsed, camera.position);
  } else if (state.mode === 'playing') {
    player.update(dt, actions);
    actions.reloadPressed = false;
    bots.update(dt, state.elapsed);
    combat.update(dt);
    updateFlags(dt);
    updateMatch(dt);
    world.update(dt, state.elapsed, camera.position);
    hud.update(dt, {
      player,
      bots: bots.bots,
      flags: world.flags,
      scores: state.scores,
      timeLeft: state.timeLeft,
      matchDuration: state.matchDuration,
      scoreLimit: state.scoreLimit,
      cameraYaw: player.yaw,
    });
    if (!player.alive) {
      if (player.deathTimer <= 0) {
        spawnPlayer();
      } else {
        hud.updateDeath(player.deathTimer);
      }
    }
  } else {
    world.update(dt, state.elapsed, camera.position);
    combat.update(dt);
  }

  effects.update(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
});

resetMatch();
player.alive = false;
player.weaponGroup.visible = false;
requestAnimationFrame(animate);

window.__tribes = {
  state,
  actions,
  renderer,
  scene,
  camera,
  get player() { return player; },
  get bots() { return bots; },
  get combat() { return combat; },
  world,
};

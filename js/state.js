import { loadBest } from './config.js';

export const state = {
  runId: 0,
  time: 0,
  score: 0,
  best: loadBest(),
  distance: 0,
  health: 100,
  heat: 1,
  multiplier: 1,
  comboTimer: 0,
  recordBeaten: false,
  paused: false,
  over: false,
  overShown: false,
  damageCooldown: 0,
  flash: 0,
  spawnTimer: 0.8,
  policeSpawnTimer: 4,
  sirenTimer: 2.5,
  baseZoom: 1.04,
  cam: {
    x: 0,
    y: 260,
    angle: -Math.PI / 2,
    zoom: 1.04,
    shake: 0
  },
  player: {
    x: 0,
    y: 260,
    angle: -Math.PI / 2,
    vx: 0,
    vy: -260,
    steer: 0,
    trailTimer: 0,
    skidTimer: 0
  },
  input: {
    left: false,
    right: false,
    brake: false,
    accel: false
  },
  police: [],
  traffic: [],
  pickups: [],
  particles: [],
  skids: [],
  floaters: [],
  rain: []
};

export const hud = {
  score: -1,
  best: -1,
  multiplier: -1,
  health: -1,
  speed: -1,
  heat: -1,
  record: false,
  timer: 0
};

export function resetWorld() {
  const p = state.player;
  p.x = 0;
  p.y = 260;
  p.angle = -Math.PI / 2;
  p.vx = 0;
  p.vy = -260;
  p.steer = 0;
  p.trailTimer = 0;
  p.skidTimer = 0;

  state.cam.x = 0;
  state.cam.y = 170;
  state.cam.angle = -Math.PI / 2;
  state.cam.zoom = state.baseZoom;
  state.cam.shake = 0;

  state.police.length = 0;
  state.traffic.length = 0;
  state.pickups.length = 0;
  state.particles.length = 0;
  state.skids.length = 0;
  state.floaters.length = 0;
}

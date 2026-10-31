import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Track } from './track.js';
import { World } from './world.js';
import { Pickups } from './pickups.js';
import { createKart, updateKartVisual } from './kart.js';
import { Particles } from './effects.js';
import { AudioEngine } from './audio.js';
import {
  TAU,
  clamp,
  damp,
  formatTime,
  lerp,
  ordinal,
  quaternionFromFrame,
  shortestDelta,
  wrap,
} from './utils.js';

const AI_DEFS = [
  { name: 'NOVA', color: 0x3b9cff, accent: 0xb7f2ff, suit: 0x193b69 },
  { name: 'JET', color: 0x38e37b, accent: 0xe4ffb7, suit: 0x184a3a },
  { name: 'SUNNY', color: 0xffcf3d, accent: 0xfff2c0, suit: 0x654417 },
  { name: 'VIOLET', color: 0xa06bff, accent: 0xf0d8ff, suit: 0x3a1d6b },
  { name: 'MAGMA', color: 0xff7a3d, accent: 0xffd7b0, suit: 0x612416 },
  { name: 'BUBBLE', color: 0xff65b0, accent: 0xffd5e8, suit: 0x64183f },
  { name: 'GLITCH', color: 0x2ce6c4, accent: 0xc4fff7, suit: 0x124d50 },
];

const PLAYER_DEF = { name: 'YOU', color: 0xff3b5c, accent: 0xffd166, suit: 0xfff0e2 };

const ITEM_DEFS = {
  turbo: { name: 'TURBO', glyph: '➤', tone: 'gold' },
  star: { name: 'STAR', glyph: '★', tone: 'gold' },
  shield: { name: 'SHIELD', glyph: '⬡', tone: 'cyan' },
  pulse: { name: 'PULSE', glyph: '◎', tone: 'magenta' },
};

const GRID = [
  { u: 0.996, lat: -3.15 },
  { u: 0.996, lat: 3.15 },
  { u: 0.9895, lat: -3.15 },
  { u: 0.9895, lat: 3.15 },
  { u: 0.983, lat: -3.15 },
  { u: 0.983, lat: 3.15 },
  { u: 0.9765, lat: -3.15 },
  { u: 0.9765, lat: 3.15 },
];

const PLAYER_GRID_INDEX = 5;

const $ = (id) => document.getElementById(id);

class Racer {
  constructor(def, index, isPlayer, scene, track) {
    this.def = def;
    this.index = index;
    this.isPlayer = isPlayer;
    this.track = track;
    this.mesh = createKart({
      color: def.color,
      accent: def.accent,
      suit: def.suit,
      number: index + 1,
      isPlayer,
    });
    this.mesh.scale.setScalar(isPlayer ? 1.04 : 1);
    scene.add(this.mesh);
    this.aura = null;
    this.shield = null;
    this.reset(GRID[index]);
  }

  reset(slot) {
    this.u = slot.u;
    this.startU = slot.u;
    this.lateral = slot.lat;
    this.lateralVel = 0;
    this.speed = 0;
    this.maxSpeed = this.isPlayer ? 65 : 59 + (this.index % 4) * 2.1;
    this.cruiseSpeed = this.isPlayer ? 57 : this.maxSpeed;
    this.lap = 0;
    this.finished = false;
    this.finishTime = null;
    this.bestLap = null;
    this.lastLap = null;
    this.lapStartTime = 0;
    this.boostTime = 0;
    this.starTime = 0;
    this.shieldTime = 0;
    this.spinOutTime = 0;
    this.padCooldown = 0;
    this.collisionCooldown = 0;
    this.item = null;
    this.itemLock = 0;
    this.coins = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.topSpeed = 0;
    this.aiTimer = 0;
    this.aiBoostTimer = 0;
    this.targetLateral = slot.lat;
    this.steerVisual = 0;
    this.wheelSpin = 0;
    this.mesh.visible = true;
    this.mesh.userData.body.rotation.set(0, 0, 0);
    this.updateTransform(0, true);
  }

  get progress() {
    return this.lap + this.u;
  }

  updateTransform(dt, instant = false) {
    const f = this.track.getFrame(this.u);
    const speed = Math.max(20, this.speed);
    const yaw = clamp((this.lateralVel / speed) * 0.92, -0.52, 0.52) + (this.drifting ? this.driftDir * 0.2 : 0);
    const forward = f.tangent
      .clone()
      .multiplyScalar(Math.cos(yaw))
      .addScaledVector(f.right, Math.sin(yaw))
      .normalize();
    const right = new THREE.Vector3().crossVectors(forward, f.up).normalize();
    const quat = quaternionFromFrame(right, f.up, forward);
    this.mesh.position.copy(f.pos).addScaledVector(f.right, this.lateral).addScaledVector(f.up, 0.08);
    if (instant) this.mesh.quaternion.copy(quat);
    else this.mesh.quaternion.slerp(quat, 1 - Math.exp(-dt * 22));
    this.wheelSpin = this.speed;
  }

  addBoost(seconds) {
    this.boostTime = Math.max(this.boostTime, seconds);
  }
}

class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = false;
    this.lowPower = this.detectLowPower();
    if (this.lowPower) this.renderer.setPixelRatio(0.58);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x2b1749, 0.0016);
    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 1800);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'menu';
    this.stateBeforePause = 'racing';
    this.raceTime = 0;
    this.countdownTime = 0;
    this.lastCountdownNumber = 0;
    this.resultsDelay = 0;
    this.resultsShown = false;
    this.menuAngle = Math.PI - 0.45;
    this.shake = 0;
    this.shakeTime = 0;
    this.wasInGravity = false;
    this.boostFxOn = false;
    this.lastLapDisplay = 1;
    this.lastPosition = 0;
    this.driftSpawn = 0;
    this.boostSpawn = 0;
    this.starSpawn = 0;
    this.finishConfetti = 0;
    this.padFlash = 0;
    this.itemsRolled = null;
    this.minimapAccum = 0;

    this.input = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      itemQueued: false,
      autoThrottle: true,
    };
    this.keys = new Set();
    this.touch = { left: false, right: false, drift: false };

    this.ui = this.cacheUI();
    this.audio = new AudioEngine();
    this.setupLights();
    this.world = new World(this.scene, this.renderer);
    this.track = new Track(this.scene);
    this.pickups = new Pickups(this.scene, this.track);
    this.particles = new Particles(this.scene, 1900);
    this.racers = this.createRacers();
    this.player = this.racers.find((r) => r.isPlayer);
    this.shockwaves = [];
    this.setupPostprocessing();
    this.setupPlayerAuras();
    this.bindEvents();
    this.setupMinimap();
    this.resetUI();
    this.initialCamera();
    this.renderer.setAnimationLoop(() => this.loop());
    this.hideLoadingSoon();
    this.exposeDebug();
    if (new URLSearchParams(window.location.search).has('play')) {
      window.setTimeout(() => this.startRace(), 420);
    }
  }

  detectLowPower() {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/llvmpipe|swiftshader|software|basic render/i.test(name)) return true;
    } catch {
      /* ignore */
    }
    return new URLSearchParams(window.location.search).get('quality') === 'low';
  }

  cacheUI() {
    return {
      hud: $('hud'),
      menu: $('menu'),
      loading: $('loading'),
      results: $('results'),
      pause: $('pause'),
      position: $('position'),
      positionSuffix: $('position-suffix'),
      lap: $('lap'),
      raceTime: $('race-time'),
      gravityChip: $('gravity-chip'),
      gravityLabel: $('gravity-label'),
      banner: $('banner'),
      bannerKicker: $('banner-kicker'),
      bannerText: $('banner-text'),
      bannerSub: $('banner-sub'),
      countdown: $('countdown'),
      itemSlot: $('item-slot'),
      itemIcon: $('item-icon'),
      itemName: $('item-name'),
      coinCount: $('coin-count'),
      speedValue: $('speed-value'),
      speedo: $('speedo'),
      driftBars: [...document.querySelectorAll('.drift-bars i')],
      boostFx: $('boost-fx'),
      flash: $('flash'),
      soundBtn: $('sound-btn'),
      soundIcon: $('sound-icon'),
      resultsTitle: $('results-title'),
      resultsSub: $('results-sub'),
      resultTime: $('result-time'),
      resultBest: $('result-best'),
      resultSpeed: $('result-speed'),
      standings: $('standings'),
      minimap: $('minimap'),
      pauseBtn: $('pause-btn'),
    };
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xa58cff, 0xff8b67, 1.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe2bd, 2.65);
    sun.position.set(-120, 180, 80);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x63f8ff, 0.9);
    fill.position.set(100, 70, -150);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff3f9a, 0.55);
    rim.position.set(60, 25, 140);
    this.scene.add(rim);
  }

  setupPostprocessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.46,
      0.38,
      0.82
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    if (this.lowPower) this.bloom.enabled = false;
  }

  setupPlayerAuras() {
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(2.15, 12, 9), auraMat);
    aura.position.y = 1.1;
    aura.visible = false;
    this.player.mesh.add(aura);
    this.player.aura = aura;

    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x54f7ff,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      metalness: 0.2,
      transmission: 0.4,
      thickness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(2.35, 2), shieldMat);
    shield.position.y = 1.05;
    shield.visible = false;
    this.player.mesh.add(shield);
    this.player.shield = shield;
  }

  createRacers() {
    const racers = [];
    let ai = 0;
    for (let i = 0; i < GRID.length; i++) {
      const isPlayer = i === PLAYER_GRID_INDEX;
      const def = isPlayer ? PLAYER_DEF : AI_DEFS[ai++];
      racers.push(new Racer(def, i, isPlayer, this.scene, this.track));
    }
    return racers;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    $('start-btn').addEventListener('click', () => {
      this.audio.init();
      this.startRace();
    });
    $('restart-btn').addEventListener('click', () => {
      this.audio.init();
      this.startRace();
    });
    $('resume-btn').addEventListener('click', () => this.togglePause());
    $('quit-btn').addEventListener('click', () => {
      this.hidePause();
      this.startRace();
    });
    $('pause-btn').addEventListener('click', () => this.togglePause());
    this.ui.soundBtn.addEventListener('click', () => this.toggleSound());

    const unlock = () => {
      this.audio.init();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });

    for (const btn of document.querySelectorAll('[data-control]')) {
      const control = btn.dataset.control;
      const press = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.init();
        btn.classList.add('pressed');
        if (control === 'left' || control === 'right') this.touch[control] = true;
        if (control === 'drift') this.touch.drift = true;
        if (control === 'item') this.input.itemQueued = true;
        if (btn.setPointerCapture) {
          try {
            btn.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (control === 'left' || control === 'right') this.touch[control] = false;
        if (control === 'drift') this.touch.drift = false;
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    }

    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.touch-controls') || e.target === this.canvas) e.preventDefault();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'racing' || this.state === 'countdown')) this.togglePause();
    });
  }

  onKeyDown(e) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();

    if (this.state === 'menu') {
      if (code === 'Enter' || code === 'Space') {
        this.audio.init();
        this.startRace();
      }
      return;
    }

    if (code === 'KeyM') {
      this.toggleSound();
      return;
    }

    if ((code === 'KeyP' || code === 'Escape') && (this.state === 'racing' || this.state === 'countdown' || this.state === 'paused')) {
      this.togglePause();
      return;
    }

    if (this.state === 'finished' && code === 'KeyR') {
      this.startRace();
      return;
    }

    if (this.state === 'paused') return;

    if (code === 'ArrowUp' || code === 'KeyW') this.input.throttle = true;
    if (code === 'ArrowDown' || code === 'KeyS') this.input.brake = true;
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') this.input.right = true;
    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') this.input.drift = true;
    if (code === 'KeyE' || code === 'KeyX') this.input.itemQueued = true;
    this.keys.add(code);
  }

  onKeyUp(e) {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') this.input.throttle = false;
    if (code === 'ArrowDown' || code === 'KeyS') this.input.brake = false;
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') this.input.right = false;
    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') this.input.drift = false;
    this.keys.delete(code);
  }

  toggleSound() {
    this.audio.init();
    this.audio.setMuted(!this.audio.muted);
    this.ui.soundBtn.classList.toggle('muted', this.audio.muted);
    this.ui.soundIcon.textContent = this.audio.muted ? '⊘' : '♪';
  }

  startRace() {
    this.state = 'countdown';
    this.raceTime = 0;
    this.countdownTime = 3.35;
    this.countdownEnd = performance.now() + 3350;
    this.lastCountdownNumber = 4;
    this.resultsDelay = 0;
    this.resultsShown = false;
    this.wasInGravity = false;
    this.shake = 0;
    this.finishConfetti = 0;
    this.itemsRolled = null;
    this.lastPosition = 0;
    this.lastLapDisplay = 1;
    this.pickups.reset();
    for (const r of this.racers) r.reset(GRID[r.index]);
    for (const r of this.racers) {
      if (r.aura) r.aura.visible = false;
      if (r.shield) r.shield.visible = false;
    }
    this.clearShockwaves();
    this.ui.menu.classList.add('hidden');
    this.ui.results.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.results.classList.remove('hidden');
    this.ui.results.classList.add('hidden');
    this.ui.countdown.textContent = '';
    this.ui.countdown.classList.remove('pop', 'go');
    this.ui.boostFx.classList.remove('on');
    this.boostFxOn = false;
    this.setItemUI(null);
    this.updateHUD(true);
    this.setGravityChip(false);
    this.audio.init();
    this.audio.startMusic();
    this.audio.countdown(false);
    this.showStartPods(0);
  }

  showStartPods(count) {
    if (!this.track.startPods) return;
    for (let i = 0; i < this.track.startPods.length; i++) {
      const pod = this.track.startPods[i];
      const active = i < count;
      pod.material.color.setHex(active ? 0x54f7ff : 0x25173f);
      pod.scale.setScalar(active ? 1.25 : 1);
    }
  }

  finishRace() {
    if (this.state === 'finished') return;
    this.state = 'finished';
    this.resultsDelay = 1.6;
    this.resultsShown = false;
    this.finishConfetti = 1.2;
    this.audio.stopMusic();
    this.audio.finish(this.playerPosition() === 1);
    this.shake = 0.35;
    this.flash();
    this.ui.boostFx.classList.remove('on');
    this.showBanner(
      this.playerPosition() === 1 ? 'VICTORY' : 'FINISH',
      'RACE COMPLETE',
      `${ordinal(this.playerPosition())} PLACE · ${formatTime(this.player.finishTime)}`,
      this.playerPosition() === 1 ? 'gold' : 'magenta'
    );
    for (let i = 0; i < 5; i++) {
      const pos = this.player.mesh.position.clone();
      pos.y += 1;
      this.particles.burst(pos, {
        count: 28,
        colors: [0xffd166, 0x54f7ff, 0xff2d7e, 0xffffff, 0xa8ffde],
        speed: 12,
        spread: 2,
        life: 1.6,
        size: 1.4,
        gravity: -8,
      });
    }
  }

  flash() {
    this.ui.flash.classList.remove('fire');
    void this.ui.flash.offsetWidth;
    this.ui.flash.classList.add('fire');
  }

  togglePause() {
    if (this.state === 'paused') {
      if (this.stateBeforePause === 'countdown') this.countdownEnd += performance.now() - this.pauseStart;
      this.state = this.stateBeforePause;
      this.ui.pause.classList.add('hidden');
      this.ui.hud.classList.remove('hidden');
      this.audio.startMusic();
      this.audio.updateEngine(0, 1, false, false);
    } else if (this.state === 'racing' || this.state === 'countdown') {
      this.stateBeforePause = this.state;
      this.state = 'paused';
      this.pauseStart = performance.now();
      this.ui.pause.classList.remove('hidden');
      this.audio.stopMusic();
      this.audio.updateEngine(0, 1, false, false);
    }
  }

  hidePause() {
    this.ui.pause.classList.add('hidden');
  }

  resetUI() {
    this.ui.hud.classList.add('hidden');
    this.ui.results.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.menu.classList.remove('hidden');
    this.ui.soundIcon.textContent = '♪';
    this.setItemUI(null);
    this.updateHUD(true);
  }

  hideLoadingSoon() {
    window.setTimeout(() => {
      this.ui.loading.classList.add('hidden');
    }, 450);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.lowPower ? 0.58 : Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.particles.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  get viewScale() {
    const aspect = this.camera.aspect || 1;
    return clamp(1 / Math.max(0.42, aspect), 1, 2);
  }

  initialCamera() {
    const vs = this.viewScale;
    const pos = new THREE.Vector3(-6, 16 + (vs - 1) * 7, 101 + (vs - 1) * 34);
    this.camera.position.copy(pos);
    this.camera.lookAt(new THREE.Vector3(-6, 6.5 + (vs - 1) * 1.6, 56));
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), this.lowPower ? 0.12 : 0.05);
    this.time += dt;
    this.update(dt);
    if (this.lowPower) this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }

  update(dt) {
    const elapsed = this.time;
    this.world.update(dt, elapsed);
    this.particles.update(dt);
    this.pickups.update(dt, elapsed);

    if (this.state === 'paused') {
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'menu') {
      this.updateMenu(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'countdown') {
      this.countdownTime = Math.max(0, (this.countdownEnd - performance.now()) / 1000);
      const n = Math.ceil(this.countdownTime);
      if (n !== this.lastCountdownNumber && n >= 0 && n <= 3) {
        this.lastCountdownNumber = n;
        this.showCountdown(n);
        this.audio.countdown(n === 0);
        this.showStartPods(3 - Math.max(0, n));
        if (n === 0) {
          this.state = 'racing';
          this.raceTime = 0;
          for (const r of this.racers) r.lapStartTime = 0;
          this.showStartPods(3);
          this.flash();
          this.audio.startMusic();
        }
      }
      this.updateKartsVisual(dt, elapsed);
      this.updateCamera(dt);
      this.updateHUD(true);
      this.updateEffectsForPlayer(dt);
      return;
    }

    if (this.state === 'racing') {
      this.raceTime += dt;
      this.updatePlayer(dt);
      this.updateAI(dt);
      this.checkCollisions(dt);
      this.checkPlayerPickups();
      this.checkBoostPads(dt);
      this.checkGravityZone();
      this.updateRacers(dt, elapsed);
      this.updateShockwaves(dt);
      this.updateCamera(dt);
      this.updateHUD();
      this.updateEffectsForPlayer(dt);
      this.updateAudio();
      return;
    }

    if (this.state === 'finished') {
      this.resultsDelay -= dt;
      this.finishConfetti -= dt;
      if (this.finishConfetti > 0 && Math.random() < 0.35) {
        const pos = this.player.mesh.position.clone();
        pos.y += 1.5;
        this.particles.burst(pos, {
          count: 12,
          colors: [0xffd166, 0x54f7ff, 0xff2d7e, 0xffffff],
          speed: 9,
          spread: 3,
          life: 1.5,
          size: 1.1,
          gravity: -7,
        });
      }
      this.updateKartsVisual(dt, elapsed);
      this.updateCamera(dt);
      this.updateShockwaves(dt);
      if (this.resultsDelay <= 0 && !this.resultsShown) {
        this.resultsShown = true;
        this.showResults();
      }
    }
  }

  updateMenu(dt) {
    this.menuAngle += dt * 0.055;
    const vs = this.viewScale;
    const target = new THREE.Vector3(
      -6 + Math.sin(this.menuAngle * 0.8) * 1.6,
      16 + (vs - 1) * 7 + Math.sin(this.time * 0.3) * 0.5,
      101 + (vs - 1) * 34
    );
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 1.2));
    const look = new THREE.Matrix4().lookAt(this.camera.position, new THREE.Vector3(-6, 6.5 + (vs - 1) * 1.6, 56), new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(look);
    this.camera.quaternion.slerp(q, 1 - Math.exp(-dt * 1.6));
    this.camera.fov = damp(this.camera.fov, 59, 2, dt);
    this.camera.updateProjectionMatrix();
    for (const r of this.racers) {
      updateKartVisual(r.mesh, {
        steer: 0,
        speed: 0,
        drifting: false,
        boosting: false,
        dt,
        time: this.time,
        spinSpeed: 0,
        isPlayer: r.isPlayer,
      });
    }
    for (const ring of this.track.rings) {
      const pulse = 1 + Math.sin(this.time * 1.5 + ring.u * 20) * 0.012;
      ring.group.scale.setScalar(pulse);
      ring.inner.material.opacity = 0.24 + Math.sin(this.time * 2 + ring.u * 20) * 0.12;
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.finished) return;
    p.padCooldown = Math.max(0, p.padCooldown - dt);
    p.collisionCooldown = Math.max(0, p.collisionCooldown - dt);
    p.itemLock = Math.max(0, p.itemLock - dt);
    p.boostTime = Math.max(0, p.boostTime - dt);
    p.starTime = Math.max(0, p.starTime - dt);
    p.shieldTime = Math.max(0, p.shieldTime - dt);
    p.spinOutTime = Math.max(0, p.spinOutTime - dt);

    const steerInput = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const touchSteer = (this.touch.right ? 1 : 0) - (this.touch.left ? 1 : 0);
    let steer = touchSteer || steerInput;
    if (p.spinOutTime > 0) steer = 0;

    const wantsDrift = this.input.drift || this.touch.drift;
    const boosting = p.boostTime > 0;
    const star = p.starTime > 0;
    const throttle = this.input.throttle || this.input.autoThrottle;
    const brake = this.input.brake;

    let targetMax = (throttle ? p.maxSpeed : p.cruiseSpeed) + p.coins * 0.55;
    if (boosting) targetMax += 17;
    if (star) targetMax += 11;
    if (p.spinOutTime > 0) targetMax *= 0.55;

    if (brake) {
      p.speed -= 52 * dt;
    } else if (p.speed < targetMax) {
      const accel = boosting ? 95 : star ? 70 : throttle ? 43 : 26;
      p.speed += accel * dt;
    } else {
      p.speed -= 9 * dt;
    }
    p.speed = clamp(p.speed, 0, targetMax + 4);
    p.topSpeed = Math.max(p.topSpeed, p.speed);

    if (p.spinOutTime > 0) {
      p.speed *= Math.exp(-1.6 * dt);
      p.lateralVel *= Math.exp(-2.5 * dt);
    } else {
      const driftTurn = p.drifting ? 1.6 : 1;
      const steerPower = (26 + p.speed * 0.28) * driftTurn;
      p.lateralVel += steer * steerPower * dt;
      const grip = p.drifting ? 1.5 : 4.6;
      p.lateralVel *= Math.exp(-grip * dt);
      p.lateralVel = clamp(p.lateralVel, -16.5, 16.5);
      p.lateral += p.lateralVel * dt;
      const limit = this.track.roadHalf - 0.8;
      if (Math.abs(p.lateral) > limit) {
        p.lateral = Math.sign(p.lateral) * limit;
        if (Math.abs(p.lateralVel) > 5) {
          p.shake = Math.max(this.shake, 0.18);
          this.audio.hit();
        }
        p.lateralVel *= -0.28;
        p.speed *= 0.93;
      }
    }

    if (wantsDrift && p.speed > 17 && Math.abs(steer) > 0.2 && p.spinOutTime <= 0) {
      if (!p.drifting) {
        p.drifting = true;
        p.driftDir = Math.sign(steer);
        p.driftCharge = 0;
        p.shake = Math.max(this.shake, 0.08);
      } else {
        p.driftCharge = Math.min(2.8, p.driftCharge + dt * (0.85 + Math.abs(steer) * 0.45));
      }
    } else if (p.drifting) {
      const level = p.driftCharge > 2.0 ? 3 : p.driftCharge > 1.2 ? 2 : p.driftCharge > 0.55 ? 1 : 0;
      if (level > 0) {
        p.addBoost(0.35 + level * 0.3);
        this.audio.driftRelease(level);
        this.shake = Math.max(this.shake, 0.1 + level * 0.04);
        this.showBanner(
          level === 3 ? 'ULTRA DRIFT' : level === 2 ? 'SUPER DRIFT' : 'MINI TURBO',
          'DRIFT BOOST',
          level === 3 ? '+1.3s BOOST' : level === 2 ? '+0.9s BOOST' : '+0.6s BOOST',
          level === 3 ? 'magenta' : level === 2 ? 'gold' : ''
        );
        const pos = p.mesh.position.clone();
        this.particles.burst(pos, {
          count: 18 + level * 8,
          colors: level === 3 ? [0xff2d7e, 0xff8bd0, 0xffffff] : level === 2 ? [0xffd166, 0xff9f43, 0xffffff] : [0x54f7ff, 0xffffff],
          speed: 7 + level * 2,
          spread: 1,
          life: 0.7,
          size: 1.1,
          gravity: -5,
        });
      }
      p.drifting = false;
      p.driftCharge = 0;
    }

    if (p.drifting) {
      // Keep the kart from ploughing straight into the rail.
      p.lateralVel += p.driftDir * 3.2 * dt;
    }

    p.steerVisual = damp(p.steerVisual, steer, 9, dt);
    this.advanceRacer(p, dt, true);
    if (this.input.itemQueued) {
      this.input.itemQueued = false;
      this.useItem();
    }
    if (p.itemLock <= 0 && this.itemsRolled) {
      this.itemsRolled = null;
      this.setItemUI(p.item);
    }
  }

  updateAI(dt) {
    for (const r of this.racers) {
      if (r.isPlayer || r.finished) continue;
      r.padCooldown = Math.max(0, r.padCooldown - dt);
      r.boostTime = Math.max(0, r.boostTime - dt);
      r.spinOutTime = Math.max(0, r.spinOutTime - dt);
      r.aiTimer -= dt;
      r.aiBoostTimer = Math.max(0, r.aiBoostTimer - dt);

      if (r.aiTimer <= 0) {
        r.aiTimer = 1.4 + Math.random() * 2.2;
        const wave = Math.sin(r.index * 1.7 + this.raceTime * 0.25);
        r.targetLateral = clamp(wave * 4.2 + (Math.random() - 0.5) * 2.6, -5.4, 5.4);
      }

      if (r.spinOutTime > 0) {
        r.speed *= Math.exp(-1.7 * dt);
        r.lateralVel *= Math.exp(-3 * dt);
      } else {
        const desired = clamp(r.targetLateral - r.lateral, -1, 1);
        r.lateralVel += desired * (20 + r.speed * 0.25) * dt;
        r.lateralVel *= Math.exp(-3.4 * dt);
        r.lateral += r.lateralVel * dt;
        const limit = this.track.roadHalf - 1;
        if (Math.abs(r.lateral) > limit) {
          r.lateral = Math.sign(r.lateral) * limit;
          r.lateralVel *= -0.25;
        }
        const diff = this.player.progress - r.progress;
        let targetSpeed = r.maxSpeed + clamp(diff * 34, -6, 9);
        if (r.aiBoostTimer > 0) targetSpeed += 14;
        if (r.boostTime > 0) targetSpeed += 12;
        if (r.speed < targetSpeed) r.speed += 34 * dt;
        else r.speed -= 14 * dt;
        r.speed = clamp(r.speed, 0, 80);
        if (Math.random() < dt * 0.045 && r.speed > 30) {
          r.aiBoostTimer = 0.8 + Math.random() * 0.9;
          r.addBoost(0.9);
          const pos = r.mesh.position.clone();
          this.particles.burst(pos, {
            count: 5,
            colors: [r.def.accent, 0x54f7ff],
            speed: 4,
            spread: 0.6,
            life: 0.4,
            size: 0.8,
            gravity: -4,
          });
        }
      }
      r.steerVisual = damp(r.steerVisual, clamp((r.targetLateral - r.lateral) * 0.3, -1, 1), 5, dt);
      this.advanceRacer(r, dt, false);
    }
  }

  advanceRacer(r, dt, isPlayer) {
    if (r.finished) return;
    const prevU = r.u;
    r.u = wrap(r.u + (r.speed * dt) / this.track.length);
    if (prevU > 0.72 && r.u < 0.28) {
      this.handleLap(r, isPlayer);
    }
  }

  handleLap(r, isPlayer) {
    r.lap += 1;
    const lapTime = this.raceTime - r.lapStartTime;
    if (r.lap >= 2) {
      r.lastLap = lapTime;
      if (r.bestLap === null || lapTime < r.bestLap) r.bestLap = lapTime;
    }
    r.lapStartTime = this.raceTime;

    if (isPlayer) {
      if (r.lap === 2) {
        this.showBanner('LAP 2', 'KEEP THE LINE', 'THE SKY IS YOURS');
        this.audio.lap();
      } else if (r.lap === 3) {
        this.showBanner('LAP 3', 'HALFWAY THERE', 'HOLD THE LINE');
        this.audio.lap();
      } else if (r.lap === 4) {
        this.showBanner('FINAL LAP', 'ONE MORE ORBIT', 'NO MERCY');
        this.audio.lap();
      }
    }

    if (r.lap >= 5) {
      r.finished = true;
      r.finishTime = this.raceTime;
      r.speed = 0;
      if (isPlayer) this.finishRace();
    }
  }

  updateRacers(dt, elapsed) {
    this.updateKartsVisual(dt, elapsed);
  }

  updateKartsVisual(dt, elapsed) {
    for (const r of this.racers) {
      r.updateTransform(dt);
      const f = this.track.getFrame(r.u);
      const steer = r.isPlayer
        ? r.steerVisual
        : r.steerVisual;
      const boosting = r.boostTime > 0;
      updateKartVisual(r.mesh, {
        steer,
        speed: r.speed,
        drifting: r.drifting,
        boosting,
        dt,
        time: elapsed,
        spinSpeed: r.speed * 1.4,
        isPlayer: r.isPlayer,
      });
      if (r.spinOutTime > 0) {
        r.mesh.userData.body.rotation.y += dt * 9;
      } else {
        r.mesh.userData.body.rotation.y = damp(r.mesh.userData.body.rotation.y % TAU, 0, 5, dt);
      }
      if (r.isPlayer) {
        if (r.aura) {
          r.aura.visible = r.starTime > 0;
          r.aura.rotation.y += dt * 2.2;
          r.aura.rotation.x += dt * 0.8;
          r.aura.material.opacity = 0.1 + Math.sin(elapsed * 8) * 0.04;
        }
        if (r.shield) {
          r.shield.visible = r.shieldTime > 0;
          r.shield.rotation.y += dt * 0.9;
          r.shield.material.opacity = 0.12 + Math.sin(elapsed * 4) * 0.035;
        }
      }
      // Keep karts hovering just off the surface.
      r.mesh.position.addScaledVector(f.up, Math.sin(elapsed * 11 + r.index) * 0.012);
    }
  }

  checkGravityZone() {
    const inZone = this.track.inGravityZone(this.player.u);
    if (inZone !== this.wasInGravity) {
      this.wasInGravity = inZone;
      if (inZone) {
        this.showBanner('GRAVITY FLIP', 'ANTI-GRAVITY SECTOR', 'STICK TO THE RIBBON', 'magenta');
        this.audio.shield();
        this.shake = Math.max(this.shake, 0.12);
      }
    }
    this.setGravityChip(inZone);
  }

  checkPlayerPickups() {
    const collected = this.pickups.check(this.player);
    for (const c of collected) {
      if (c.type === 'coin') {
        this.player.coins = Math.min(10, this.player.coins + 1);
        this.audio.coin();
        this.particles.burst(c.group.position, {
          count: 10,
          colors: [0xffd166, 0xfff4c2, 0xff9f43],
          speed: 5,
          spread: 0.5,
          life: 0.5,
          size: 0.9,
          gravity: -5,
        });
        this.ui.coinCount.textContent = this.player.coins;
      } else if (c.type === 'item') {
        this.grantItem(c.group.position);
      }
    }
  }

  grantItem(position) {
    if (this.player.item || this.player.itemLock > 0) {
      this.player.coins = Math.min(10, this.player.coins + 1);
      this.ui.coinCount.textContent = this.player.coins;
      this.audio.coin();
      return;
    }
    const roll = Math.random();
    const item = roll < 0.38 ? 'turbo' : roll < 0.62 ? 'shield' : roll < 0.82 ? 'star' : 'pulse';
    this.player.item = item;
    this.player.itemLock = 0.85;
    this.itemsRolled = item;
    this.audio.pickup();
    this.ui.itemSlot.classList.add('rolling');
    this.ui.itemSlot.classList.remove('empty');
    this.ui.itemSlot.classList.add('filled');
    this.ui.itemIcon.textContent = '?';
    this.ui.itemName.textContent = 'ROLLING';
    this.particles.burst(position, {
      count: 22,
      colors: [0x54f7ff, 0xff2d7e, 0xffd166, 0xffffff],
      speed: 7,
      spread: 1.4,
      life: 0.7,
      size: 1,
      gravity: -4,
    });
    window.setTimeout(() => {
      if (this.player.item === item) {
        this.ui.itemSlot.classList.remove('rolling');
        this.setItemUI(item);
      }
    }, 860);
  }

  useItem() {
    const p = this.player;
    if (!p.item || p.itemLock > 0 || this.state !== 'racing') return;
    const item = p.item;
    p.item = null;
    this.setItemUI(null);
    this.audio.item();
    this.flash();
    this.shake = Math.max(this.shake, 0.18);

    if (item === 'turbo') {
      p.addBoost(1.8);
      p.speed = Math.max(p.speed, p.maxSpeed + 8);
      this.showBanner('TURBO', 'FULL THROTTLE', 'BURN THE SKY', 'gold');
      const pos = p.mesh.position.clone();
      this.particles.burst(pos, {
        count: 30,
        colors: [0x54f7ff, 0xffd166, 0xffffff],
        speed: 10,
        spread: 1.2,
        life: 0.9,
        size: 1.2,
        gravity: -2,
      });
    } else if (item === 'star') {
      p.starTime = 5.2;
      p.addBoost(0.8);
      this.showBanner('STAR POWER', 'INVINCIBLE', 'NOTHING CAN TOUCH YOU', 'gold');
      this.audio.shield();
    } else if (item === 'shield') {
      p.shieldTime = 6.5;
      this.showBanner('SHIELD UP', 'DEFENSE MODE', 'BOUNCE BACK', '');
      this.audio.shield();
    } else if (item === 'pulse') {
      this.triggerPulse();
      this.showBanner('GRAVITY PULSE', 'SHOCKWAVE', 'RIPPLE THE ORBIT', 'magenta');
    }
  }

  triggerPulse() {
    const p = this.player;
    const f = this.track.getFrame(p.u);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.16, 6, 80),
      new THREE.MeshBasicMaterial({
        color: 0xff2d7e,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    ring.position.copy(f.pos).addScaledVector(f.up, 1.1);
    ring.quaternion.copy(f.quat);
    ring.rotateX(Math.PI / 2);
    this.scene.add(ring);
    this.shockwaves.push({ mesh: ring, age: 0, duration: 0.9 });

    for (const r of this.racers) {
      if (r === p || r.finished) continue;
      const diff = r.progress - p.progress;
      if (diff > 0 && diff < 0.24) {
        if (r.shieldTime > 0 || r.starTime > 0) continue;
        r.spinOutTime = 1.15;
        r.speed *= 0.5;
        const pos = r.mesh.position.clone();
        this.particles.burst(pos, {
          count: 22,
          colors: [0xff2d7e, 0xffd166, 0xffffff],
          speed: 8,
          spread: 1,
          life: 0.8,
          size: 1.1,
          gravity: -4,
        });
      }
    }
    this.particles.burst(ring.position, {
      count: 40,
      colors: [0xff2d7e, 0xff8bd0, 0xffffff],
      speed: 13,
      spread: 1,
      life: 1,
      size: 1.4,
      gravity: 0,
    });
  }

  updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.age += dt;
      const t = s.age / s.duration;
      s.mesh.scale.setScalar(1 + t * 24);
      s.mesh.material.opacity = (1 - t) * 0.9;
      if (t >= 1) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  clearShockwaves() {
    for (const s of this.shockwaves) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.shockwaves = [];
  }

  checkBoostPads(dt) {
    for (const r of this.racers) {
      if (r.finished) continue;
      if (r.padCooldown > 0) continue;
      for (const pad of this.track.boostPads) {
        if (Math.abs(shortestDelta(r.u, pad.u)) < 0.0055 && Math.abs(r.lateral - pad.lat) < pad.width * 0.5 + 0.9) {
          r.padCooldown = 0.7;
          r.addBoost(1.15);
          if (r.isPlayer) {
            this.audio.boost();
            this.shake = Math.max(this.shake, 0.14);
            const pos = r.mesh.position.clone();
            this.particles.burst(pos, {
              count: 22,
              colors: [0x54f7ff, 0xff2d7e, 0xffffff],
              speed: 8,
              spread: 1.2,
              life: 0.6,
              size: 1.1,
              gravity: -2,
            });
          }
          break;
        }
      }
    }
  }

  checkCollisions(dt) {
    const p = this.player;
    if (p.collisionCooldown > 0) return;
    for (const r of this.racers) {
      if (r === p || r.finished) continue;
      if (Math.abs(shortestDelta(p.u, r.u)) < 0.0026 && Math.abs(p.lateral - r.lateral) < 2.05) {
        const push = Math.sign(p.lateral - r.lateral) || 1;
        p.lateralVel += push * 7;
        r.lateralVel -= push * 4;
        p.speed *= 0.94;
        r.speed *= 0.97;
        p.collisionCooldown = 0.45;
        r.collisionCooldown = 0.45;
        this.shake = Math.max(this.shake, 0.24);
        this.audio.hit();
        const pos = p.mesh.position.clone();
        this.particles.burst(pos, {
          count: 14,
          colors: [0xffffff, 0xffd166, 0xff2d7e],
          speed: 7,
          spread: 0.8,
          life: 0.45,
          size: 0.9,
          gravity: -6,
        });
        break;
      }
    }
  }

  updateEffectsForPlayer(dt) {
    const p = this.player;
    if (!p) return;
    const boosting = p.boostTime > 0;
    if (boosting !== this.boostFxOn) {
      this.boostFxOn = boosting;
      this.ui.boostFx.classList.toggle('on', boosting);
    }
    if (boosting) {
      this.boostSpawn += dt;
      if (this.boostSpawn > 0.024) {
        this.boostSpawn = 0;
        const f = this.track.getFrame(p.u);
        const pos = p.mesh.position.clone().addScaledVector(f.tangent, -2.4).addScaledVector(f.up, 0.8);
        this.particles.trail(pos, Math.random() > 0.5 ? 0x54f7ff : 0xff2d7e, f.tangent, 2, 1.1);
      }
    }
    if (p.drifting && p.speed > 15) {
      this.driftSpawn += dt;
      if (this.driftSpawn > 0.035) {
        this.driftSpawn = 0;
        const f = this.track.getFrame(p.u);
        const level = p.driftCharge > 2.0 ? 2 : p.driftCharge > 1.2 ? 1 : 0;
        const color = level === 2 ? 0xff2d7e : level === 1 ? 0xffd166 : 0x54f7ff;
        for (const side of [-1, 1]) {
          const pos = p.mesh.position
            .clone()
            .addScaledVector(f.right, side * 1.05)
            .addScaledVector(f.tangent, 1.2)
            .addScaledVector(f.up, 0.2);
          this.particles.spark(pos, color, f.tangent, 2);
        }
      }
    }
    if (p.starTime > 0) {
      this.starSpawn += dt;
      if (this.starSpawn > 0.06) {
        this.starSpawn = 0;
        const pos = p.mesh.position.clone();
        pos.x += (Math.random() - 0.5) * 3;
        pos.y += (Math.random() - 0.5) * 2.5;
        pos.z += (Math.random() - 0.5) * 3;
        this.particles.spawn(pos.x, pos.y, pos.z, {
          vx: 0,
          vy: 1.5,
          vz: 0,
          color: Math.random() > 0.5 ? 0xffd166 : 0xff2d7e,
          life: 0.45,
          size: 0.8,
          gravity: 0,
          drag: 0.97,
        });
      }
    }
  }

  updateAudio() {
    const p = this.player;
    this.audio.updateEngine(p.speed, p.maxSpeed, p.boostTime > 0, true);
  }

  playerPosition() {
    const p = this.player;
    const pp = p.progress;
    let pos = 1;
    for (const r of this.racers) {
      if (r === p) continue;
      if (r.progress > pp) pos++;
    }
    return pos;
  }

  updateHUD(force = false) {
    const p = this.player;
    const position = this.playerPosition();
    if (force || position !== this.lastPosition) {
      this.lastPosition = position;
      this.ui.position.textContent = position;
      this.ui.positionSuffix.textContent = ordinal(position);
    }
    const lapDisplay = clamp(p.lap, 1, 4);
    if (force || lapDisplay !== this.lastLapDisplay) {
      this.lastLapDisplay = lapDisplay;
      this.ui.lap.textContent = lapDisplay;
    }
    this.ui.raceTime.textContent = formatTime(this.raceTime);
    const speedKmh = Math.round(p.speed * 3.25);
    this.ui.speedValue.textContent = speedKmh;
    this.ui.speedo.style.setProperty('--speed', clamp(speedKmh / 2.6, 0, 100));

    const driftLevel = p.driftCharge > 2.0 ? 3 : p.driftCharge > 1.2 ? 2 : p.driftCharge > 0.55 ? 1 : 0;
    this.ui.driftBars.forEach((bar, i) => bar.classList.toggle('on', i < driftLevel));
    this.ui.coinCount.textContent = p.coins;
    if (p.itemLock <= 0 && p.item && !this.itemsRolled) {
      this.setItemUI(p.item);
    }
    if (!p.item && !this.itemsRolled) {
      this.ui.itemSlot.classList.remove('filled');
      this.ui.itemSlot.classList.add('empty');
    }
    this.drawMinimap();
  }

  setItemUI(item) {
    const slot = this.ui.itemSlot;
    if (!item) {
      slot.classList.remove('filled', 'rolling');
      slot.classList.add('empty');
      slot.dataset.item = '';
      this.ui.itemIcon.textContent = '?';
      this.ui.itemName.textContent = 'EMPTY';
      return;
    }
    const def = ITEM_DEFS[item];
    slot.classList.remove('empty', 'rolling');
    slot.classList.add('filled');
    slot.dataset.item = item;
    this.ui.itemIcon.textContent = def.glyph;
    this.ui.itemName.textContent = def.name;
  }

  setGravityChip(active) {
    this.ui.gravityChip.classList.toggle('flip', active);
    this.ui.gravityLabel.textContent = active ? 'GRAVITY FLIP' : 'GRAVITY LOCK';
  }

  showBanner(text, kicker = '', sub = '', tone = '') {
    const b = this.ui.banner;
    b.classList.remove('show', 'magenta', 'gold');
    if (tone) b.classList.add(tone);
    this.ui.bannerText.textContent = text;
    this.ui.bannerKicker.textContent = kicker;
    this.ui.bannerSub.textContent = sub;
    void b.offsetWidth;
    b.classList.add('show');
  }

  showCountdown(n) {
    const el = this.ui.countdown;
    el.classList.remove('pop', 'go');
    el.textContent = n === 0 ? 'GO!' : String(n);
    if (n === 0) el.classList.add('go');
    void el.offsetWidth;
    el.classList.add('pop');
    if (n === 0) this.showBanner('GO!', 'LAP 1 / 4', 'HIT THE BOOST PADS', 'gold');
  }

  updateCamera(dt) {
    let targetPos = new THREE.Vector3();
    let lookAt = new THREE.Vector3();
    let up = new THREE.Vector3(0, 1, 0);
    let fov = 64;

    if (this.state === 'menu') {
      return;
    }

    if (this.state === 'finished') {
      const f = this.track.getFrame(this.player.u);
      const center = this.player.mesh.position.clone();
      const angle = this.time * 0.35;
      const vs = this.viewScale;
      targetPos.copy(center).add(new THREE.Vector3(Math.sin(angle) * 11 * vs, 5.4 * (1 + (vs - 1) * 0.5), Math.cos(angle) * 11 * vs));
      lookAt.copy(center).addScaledVector(f.up, 1.1);
      up.copy(f.up);
      fov = 58 + (vs - 1) * 6;
    } else {
      const p = this.player;
      const f = this.track.getFrame(p.u);
      const speedRatio = clamp(p.speed / 70, 0, 1.2);
      const vs = this.viewScale;
      const back = (8.1 + speedRatio * 1.5) * (1 + (vs - 1) * 0.62);
      const height = (3.25 + speedRatio * 0.6) * (1 + (vs - 1) * 0.36);
      targetPos.copy(p.mesh.position).addScaledVector(f.tangent, -back).addScaledVector(f.up, height);
      lookAt
        .copy(p.mesh.position)
        .addScaledVector(f.tangent, 8.2)
        .addScaledVector(f.up, 1.1 + (vs - 1) * 0.35);
      up.copy(f.up);
      fov = 63 + speedRatio * 4 + (vs - 1) * 6 + (p.boostTime > 0 ? 7 : 0);
    }

    const posLambda = this.state === 'countdown' ? 3.2 : 9.5;
    this.camera.position.lerp(targetPos, 1 - Math.exp(-posLambda * dt));

    if (this.shake > 0.001) {
      this.shake *= Math.exp(-6 * dt);
      this.shakeTime += dt * 70;
      const amp = this.shake * 0.55;
      this.camera.position.x += Math.sin(this.shakeTime * 1.7) * amp;
      this.camera.position.y += Math.cos(this.shakeTime * 2.3) * amp;
      this.camera.position.z += Math.sin(this.shakeTime * 2.9) * amp * 0.6;
    }

    const lookMatrix = new THREE.Matrix4().lookAt(this.camera.position, lookAt, up);
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
    const quatLambda = this.state === 'countdown' ? 3.6 : 8.5;
    this.camera.quaternion.slerp(lookQuat, 1 - Math.exp(-quatLambda * dt));
    this.camera.fov = damp(this.camera.fov, fov, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  setupMinimap() {
    this.mapCtx = this.ui.minimap.getContext('2d');
    this.mapScale = 1;
    this.mapOffset = { x: 0, y: 0 };
    this.updateMinimapTransform();
  }

  updateMinimapTransform() {
    const w = this.ui.minimap.width;
    const h = this.ui.minimap.height;
    const b = this.track.mapBounds;
    const pad = 18;
    const scale = Math.min((w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxZ - b.minZ));
    this.mapScale = scale;
    this.mapOffset.x = (w - (b.maxX - b.minX) * scale) / 2 - b.minX * scale;
    this.mapOffset.y = (h - (b.maxZ - b.minZ) * scale) / 2 - b.minZ * scale;
  }

  mapPoint(x, z) {
    return [x * this.mapScale + this.mapOffset.x, z * this.mapScale + this.mapOffset.y];
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    const w = this.ui.minimap.width;
    const h = this.ui.minimap.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(84,247,255,.06)');
    grad.addColorStop(1, 'rgba(84,247,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const pts = this.track.mapPoints;
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = this.mapPoint(pts[i][0], pts[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    path();
    ctx.strokeStyle = 'rgba(255,45,126,.18)';
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.stroke();

    path();
    ctx.strokeStyle = 'rgba(84,247,255,.55)';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    path();
    ctx.strokeStyle = 'rgba(255,244,223,.9)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const [a, b] of this.track.gravityMapZones) {
      const start = Math.floor(a * pts.length);
      const end = Math.ceil(b * pts.length);
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const p = pts[i % pts.length];
        const [x, y] = this.mapPoint(p[0], p[1]);
        if (i === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,45,126,.9)';
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }

    // Start line.
    const start = this.track.mapPoints[0];
    const [sx, sy] = this.mapPoint(start[0], start[1]);
    ctx.fillStyle = '#fff4df';
    ctx.fillRect(sx - 3, sy - 3, 6, 6);

    for (const r of this.racers) {
      const f = this.track.getFrame(r.u);
      const [x, y] = this.mapPoint(f.pos.x, f.pos.z);
      const isPlayer = r.isPlayer;
      ctx.beginPath();
      ctx.arc(x, y, isPlayer ? 5.2 : 3.4, 0, TAU);
      ctx.fillStyle = `#${r.def.color.toString(16).padStart(6, '0')}`;
      ctx.fill();
      if (isPlayer) {
        ctx.strokeStyle = '#fff4df';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 8.5, 0, TAU);
        ctx.strokeStyle = 'rgba(84,247,255,.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  showResults() {
    const position = this.playerPosition();
    const titles = {
      1: 'ORBIT CHAMPION',
      2: 'SILVER ORBIT',
      3: 'PODIUM FINISH',
    };
    this.ui.resultsTitle.textContent = titles[position] || 'KEEP PUSHING';
    this.ui.resultsSub.textContent =
      position === 1
        ? 'You bent gravity to your will.'
        : position <= 3
          ? 'The sky is already asking for a rematch.'
          : 'The next orbit is yours for the taking.';
    this.ui.resultTime.textContent = formatTime(this.player.finishTime ?? this.raceTime);
    this.ui.resultBest.textContent = this.player.bestLap ? formatTime(this.player.bestLap) : '--:--.--';
    this.ui.resultSpeed.textContent = `${Math.round(this.player.topSpeed * 3.25)} KM/H`;

    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });

    this.ui.standings.innerHTML = '';
    sorted.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = `standing-row${r.isPlayer ? ' player' : ''}`;
      let time;
      if (r.finished) time = formatTime(r.finishTime);
      else {
        const remaining = Math.max(0.05, 5 - r.progress);
        time = formatTime(this.raceTime + (remaining * this.track.length) / Math.max(30, r.speed));
      }
      row.innerHTML = `<span class="rank">${i + 1}</span><span class="name">${r.def.name}${r.isPlayer ? ' · YOU' : ''}</span><span class="time">${time}</span>`;
      this.ui.standings.appendChild(row);
    });

    this.ui.results.classList.remove('hidden');
    this.ui.hud.classList.add('hidden');
  }

  exposeDebug() {
    window.__gravityGame = {
      start: () => this.startRace(),
      state: () => this.state,
      player: () => this.player,
      racers: () => this.racers,
      track: () => this.track,
      bloom: (v) => { this.bloom.enabled = v; if (v) this.lowPower = false; },
      quality: () => (this.lowPower ? 'low' : 'high'),
      renderInfo: () => ({ ...this.renderer.info.render }),
      game: this,
      teleport: (u, lap = 1) => { const p = this.player; p.u = u; p.lap = lap; p.speed = 0; p.updateTransform(0, true); },
      simulate: (seconds = 60) => {
        this.state = 'racing';
        this.raceTime = 0;
        for (const r of this.racers) { r.reset(GRID[r.index]); r.finished = false; r.lapStartTime = 0; }
        const dt = 1 / 60;
        const steps = Math.min(Math.round(seconds * 60), 12000);
        for (let i = 0; i < steps && this.state === 'racing'; i++) {
          this.time += dt;
          this.update(dt);
        }
        return { state: this.state, raceTime: +this.raceTime.toFixed(1), position: this.position, racers: this.racers.map((r) => ({ name: r.def.name, u: +r.u.toFixed(3), lap: r.lap, speed: +r.speed.toFixed(1), finished: r.finished })) };
      },
      setTime: (t) => {
        this.raceTime = t;
      },
    };
  }
}

new Game();

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { BotManager } from './bots.js';
import { Zone } from './zone.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isTouchDevice = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

function raySphere(origin, dir, cx, cy, cz, radius) {
  const ox = origin.x - cx;
  const oy = origin.y - cy;
  const oz = origin.z - cz;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  let t = -b - root;
  if (t < 0) t = -b + root;
  return t >= 0 ? t : null;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.isTouch = isTouchDevice();
    this.state = 'boot';
    this.elapsed = 0;
    this.matchTime = 0;
    this.menuAngle = 0.7;
    this.menuOrbit = 210;
    this.killedBy = null;
    this.pendingResult = false;
    this.baseColliders = 0;
    this.baseSurfaces = 0;
    this.baseLootCount = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isTouch,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.65 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.07;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a7bfca');
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(185, 112, 172);
    this.camera.lookAt(0, 10, 0);

    this.lastFrame = performance.now();
    this.audio = new AudioEngine();
    this.effects = new Effects(this.scene);

    this.keys = new Set();
    this.input = {
      mouseFire: false,
      mouseAim: false,
      touchFire: false,
      touchAim: false,
      dragLook: false,
    };
    this.joy = { x: 0, y: 0, active: false, pointerId: null };
    this.lookPointer = null;

    this.boundAnimate = this.animate.bind(this);
    this.resize = this.resize.bind(this);

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 120));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'playing' || this.state === 'dropping')) this.pauseGame(true);
    });
  }

  async boot() {
    const status = document.getElementById('boot-status');
    const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    await frame();
    await frame();
    if (status) status.textContent = 'BUILDING ISLA VERDE…';

    try {
      this.world = new World(this.scene, 20261031);
      if (this.isTouch && this.world.sun) {
        this.world.sun.shadow.mapSize.set(1024, 1024);
      }
      this.baseColliders = this.world.colliders.length;
      this.baseSurfaces = this.world.surfaces.length;
      this.baseLootCount = this.world.loot.length;

      this.botManager = new BotManager(this.scene, this.world, this);
      this.zone = new Zone(this.scene, this.world, this);
      this.player = new Player(this.scene, this.world, this);
      this.player.group.visible = false;
      this.ui = new UI(this);

      this.bindEvents();
      this.bindTouchControls();
      this.resize();

      this.camera.position.set(
        Math.cos(this.menuAngle) * this.menuOrbit,
        112,
        Math.sin(this.menuAngle) * this.menuOrbit,
      );
      this.camera.lookAt(0, 12, 0);

      this.state = 'menu';
      this.ui.showMenu();
      this.ui.bootDone();
      if (status) status.textContent = 'ALL SYSTEMS NOMINAL';
      this.lastFrame = performance.now();
      requestAnimationFrame(this.boundAnimate);
    } catch (err) {
      console.error('[LAST CIRCLE] boot failed', err);
      if (status) status.textContent = 'BOOT FAILED — CHECK CONSOLE';
    }
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.65 : 2));
    this.renderer.setSize(w, h, true);
  }

  bindEvents() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

    on('deploy', () => this.startMatch());
    on('redeploy', () => this.startMatch());
    on('resume', () => this.resumeGame());
    on('quit', () => this.abandonToMenu());
    on('result-menu', () => this.abandonToMenu());
    on('pause-map', () => this.ui.toggleMap());

    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => this.onKeyUp(e));
    window.addEventListener('blur', () => this.clearHoldInput());

    document.addEventListener('mousemove', e => this.onMouseMove(e));
    document.addEventListener('mousedown', e => this.onMouseDown(e));
    document.addEventListener('mouseup', e => this.onMouseUp(e));
    document.addEventListener('contextmenu', e => {
      if (this.state === 'playing' || this.state === 'dropping') e.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    this.canvas.addEventListener('click', () => {
      if ((this.state === 'playing' || this.state === 'dropping') && !this.ui?.mapOpen && !this.isTouch) {
        this.requestPointerLock();
      }
    });
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.ui?.mapOpen) {
        this.ui.closeMap();
      } else if (this.state === 'paused') {
        this.resumeGame();
      } else if (this.state === 'playing' || this.state === 'dropping') {
        this.pauseGame();
      }
      return;
    }

    if (e.code === 'KeyM') {
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'dropping') {
        e.preventDefault();
        this.ui.toggleMap();
      }
      return;
    }

    if (this.ui?.mapOpen || (this.state !== 'playing' && this.state !== 'dropping')) return;

    this.keys.add(e.code);

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.player.requestJump();
      return;
    }
    if (e.repeat) return;

    switch (e.code) {
      case 'KeyB':
        this.player.toggleBuild(this);
        break;
      case 'KeyR':
        this.player.onReload(this);
        break;
      case 'KeyF':
        this.player.startHeal(this);
        break;
      case 'Digit1':
        if (this.player.buildMode) this.player.setBuildType('wall', this);
        else this.player.switchWeapon(0, this);
        break;
      case 'Digit2':
        if (this.player.buildMode) this.player.setBuildType('floor', this);
        else this.player.switchWeapon(1, this);
        break;
      case 'Digit3':
        if (this.player.buildMode) this.player.setBuildType('ramp', this);
        break;
      default:
        break;
    }
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  onMouseDown(e) {
    if (!this.ui) return;
    if (e.target.closest?.('button, .minimap-wrap, .screen, .touch-ui')) return;
    if (this.ui.mapOpen || (this.state !== 'playing' && this.state !== 'dropping')) return;

    if (e.button === 0) {
      this.input.mouseFire = true;
      if (!this.isTouch) this.requestPointerLock();
    } else if (e.button === 2) {
      this.input.mouseAim = true;
      this.input.dragLook = true;
      if (!document.pointerLockElement) e.preventDefault();
    }
  }

  onMouseUp(e) {
    if (e.button === 0) this.input.mouseFire = false;
    if (e.button === 2) {
      this.input.mouseAim = false;
      this.input.dragLook = false;
    }
  }

  onMouseMove(e) {
    if (!this.player || this.ui?.mapOpen) return;
    if (this.state !== 'playing' && this.state !== 'dropping') return;
    const locked = document.pointerLockElement === this.canvas;
    if (!locked && !this.input.dragLook) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    if (!dx && !dy) return;
    this.player.look(dx, dy, locked ? 0.00215 : 0.0032);
  }

  onPointerLockChange() {
    if (document.pointerLockElement === this.canvas) {
      this.lockLostAt = 0;
      return;
    }
    // Losing the lock mid-match (usually Esc) should hold the game.
    if (this.state === 'playing' || this.state === 'dropping') {
      if (!this.ui?.mapOpen && !this.isTouch) this.pauseGame();
    }
  }

  bindTouchControls() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('stick-knob');

    const updateJoy = (e) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / (rect.width * 0.42);
      let dy = (e.clientY - cy) / (rect.height * 0.42);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.joy.x = dx;
      this.joy.y = dy;
      this.joy.active = true;
      if (knob) knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };

    const resetJoy = () => {
      this.joy.active = false;
      this.joy.x = 0;
      this.joy.y = 0;
      this.joy.pointerId = null;
      if (knob) knob.style.transform = 'translate(0px, 0px)';
    };

    joy?.addEventListener('pointerdown', e => {
      if (this.state !== 'playing' && this.state !== 'dropping') return;
      e.preventDefault();
      e.stopPropagation();
      this.joy.pointerId = e.pointerId;
      joy.setPointerCapture?.(e.pointerId);
      updateJoy(e);
    }, { passive: false });

    window.addEventListener('pointermove', e => {
      if (this.joy.pointerId === e.pointerId) {
        e.preventDefault();
        updateJoy(e);
      }
    }, { passive: false });

    const endJoy = e => {
      if (this.joy.pointerId === e.pointerId) resetJoy();
    };
    window.addEventListener('pointerup', endJoy);
    window.addEventListener('pointercancel', endJoy);

    this.bindHold('touch-fire', down => {
      if (down) {
        if (this.state === 'playing' || this.state === 'dropping') this.input.touchFire = true;
      } else {
        this.input.touchFire = false;
      }
    });

    this.bindTap('touch-jump', () => this.player?.requestJump());
    this.bindTap('touch-build', () => this.player?.toggleBuild(this));
    this.bindTap('touch-heal', () => this.player?.startHeal(this));
    this.bindTap('touch-reload', () => this.player?.onReload(this));
    this.bindTap('touch-swap', () => this.cycleWeapon());
    this.bindTap('touch-pause', () => this.pauseGame());

    // One-finger drag anywhere outside the controls looks around.
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (this.state !== 'playing' && this.state !== 'dropping') return;
      if (this.ui?.mapOpen || this.joy.pointerId === e.pointerId) return;
      if (e.target.closest?.('button, .joystick, .screen, .minimap-wrap, #map-close')) return;
      if (this.lookPointer) return;
      this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }, { passive: true });

    window.addEventListener('pointermove', e => {
      if (!this.lookPointer || this.lookPointer.id !== e.pointerId) return;
      const dx = e.clientX - this.lookPointer.x;
      const dy = e.clientY - this.lookPointer.y;
      this.lookPointer.x = e.clientX;
      this.lookPointer.y = e.clientY;
      if (dx || dy) this.player?.look(dx * 1.35, dy * 1.35, 0.0041);
    }, { passive: true });

    const clearLook = e => {
      if (this.lookPointer?.id === e.pointerId) this.lookPointer = null;
    };
    window.addEventListener('pointerup', clearLook);
    window.addEventListener('pointercancel', clearLook);
  }

  bindTap(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }, { passive: false });
  }

  bindHold(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    let active = false;
    const up = e => {
      if (!active) return;
      active = false;
      fn(false);
      if (e) e.preventDefault?.();
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      active = true;
      el.setPointerCapture?.(e.pointerId);
      fn(true);
    }, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    window.addEventListener('pointerup', e => {
      if (active && e.target !== el) up(e);
    });
  }

  cycleWeapon() {
    const p = this.player;
    if (!p || p.buildMode) return;
    for (let i = 1; i <= 2; i++) {
      const slot = (p.currentSlot + i) % 2;
      if (p.weapons[slot]) {
        p.switchWeapon(slot, this);
        return;
      }
    }
  }

  clearHoldInput() {
    this.keys.clear();
    this.input.mouseFire = false;
    this.input.mouseAim = false;
    this.input.touchFire = false;
    this.input.touchAim = false;
    this.input.dragLook = false;
    this.joy.active = false;
    this.joy.pointerId = null;
    this.lookPointer = null;
  }

  requestPointerLock() {
    if (this.isTouch || !this.canvas) return;
    if (document.pointerLockElement === this.canvas) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p?.catch) p.catch(() => {});
    } catch {
      /* pointer lock unavailable */
    }
  }

  releasePointerLock() {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch { /* ignore */ }
    }
  }

  startMatch() {
    if (!this.player || !this.world) return;
    this.clearHoldInput();
    this.pendingResult = false;
    this.killedBy = null;
    this.resetMatchState();
    this.audio.init();
    this.audio.deploy();

    this.ui.closeMap();
    this.ui.hidePause();
    this.ui.result.classList.add('hidden');
    this.ui.startGame();

    this.player.resetForDeploy();
    const angle = Math.random() * Math.PI * 2;
    const dist = 38 + Math.random() * 82;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    this.player.startDrop(x, z);
    this.state = 'dropping';
    this.matchTime = 0;
    this.elapsed = 0;
    this.lastFrame = performance.now();
    this.ui.toast('DEPLOYMENT', 'STEER THE DESCENT', 'gold');
    this.requestPointerLock();
  }

  resetMatchState() {
    if (!this.world) return;

    for (const piece of this.world.builtPieces) {
      piece.group.removeFromParent();
    }
    this.world.dynamicGroup.clear();
    this.world.builtPieces.length = 0;
    this.world.colliders.length = this.baseColliders;
    this.world.surfaces.length = this.baseSurfaces;

    for (let i = this.baseLootCount; i < this.world.loot.length; i++) {
      this.world.loot[i].group.removeFromParent();
    }
    this.world.loot.length = this.baseLootCount;
    for (const item of this.world.loot) {
      item.taken = false;
      item.group.visible = true;
    }

    if (this.botManager) {
      for (const bot of this.botManager.bots) bot.group.removeFromParent();
    }
    this.botManager = new BotManager(this.scene, this.world, this);

    this.zone?.reset();
    this.effects.reset();
    this.player.buildMode = false;
    this.player.weaponMount.visible = true;
    this.player.updateWeaponVisual();
    this.ui?.setBuildMode(false);
    this.ui?.closeMap();
    this.ui?.hidePause();
    this.ui?.result.classList.add('hidden');
    if (this.ui) {
      this.ui.killfeedEl.innerHTML = '';
      this.ui.toastStack.innerHTML = '';
      this.ui.scope.classList.remove('active');
      this.ui.refreshMap();
    }
    this.player.group.visible = false;
    this.clearHoldInput();
  }

  onLanded() {
    this.state = 'playing';
    this.player.group.visible = true;
    this.botManager.spawnAll({ x: this.player.pos.x, z: this.player.pos.z });
    this.zone.start();
    this.matchTime = 0;
    this.killedBy = null;
    this.pendingResult = false;
    this.ui.toast('BOOTS ON GROUND', `${this.botManager.aliveCount + 1} OPERATORS · 4S DROP SHIELD`, 'gold');
    this.ui.zonePhase('THE CIRCLE IS CLOSING', 'PHASE 01 · 155M RADIUS');
    this.audio.zonePhase();
    this.requestPointerLock();
  }

  syncInput() {
    if (!this.player) return;
    const p = this.player;
    const key = code => (this.keys.has(code) ? 1 : 0);
    let f = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown');
    let r = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft');

    if (this.joy.active) {
      f += -this.joy.y;
      r += this.joy.x;
    }
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }

    p.input.moveF = clamp(f, -1, 1);
    p.input.moveR = clamp(r, -1, 1);
    p.input.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ||
      (this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.92);
    p.input.crouch = this.keys.has('ControlLeft') || this.keys.has('KeyC');
    p.input.aim = this.input.mouseAim || this.input.touchAim;
    p.input.fire = this.input.mouseFire || this.input.touchFire;
  }

  updateHudEffects() {
    const p = this.player;
    const sniperAim = p.mode === 'playing' && !p.dead && p.aiming && !p.buildMode && p.activeDef?.id === 'sniper';
    this.ui.scope.classList.toggle('active', sniperAim);
    this.ui.healVignette.classList.toggle('active', p.healTimer > 0);
  }

  onMapOpened() {
    this.clearHoldInput();
    if (!this.isTouch) this.releasePointerLock();
  }

  onMapClosed() {
    if (this.state === 'playing' || this.state === 'dropping') {
      this.lastFrame = performance.now();
      this.requestPointerLock();
    }
  }

  pauseGame(fromVisibility = false) {
    if (this.state !== 'playing' && this.state !== 'dropping') return;
    this.stateBeforePause = this.state;
    this.state = 'paused';
    this.clearHoldInput();
    this.releasePointerLock();
    this.ui.showPause();
    this.audio.click();
    if (!fromVisibility) this.audio.setMuted(this.audio.muted);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.audio.init();
    this.ui.hidePause();
    this.ui.closeMap();
    this.state = this.stateBeforePause || 'playing';
    this.lastFrame = performance.now();
    this.requestPointerLock();
  }

  abandonToMenu() {
    clearTimeout(this._winTimer);
    clearTimeout(this._deathTimer);
    this.pendingResult = false;
    this.releasePointerLock();
    this.clearHoldInput();
    this.resetMatchState();
    this.player.group.visible = false;
    this.player.mode = 'menu';
    this.state = 'menu';
    this.ui.showMenu();
    this.ui.setBuildMode(false);
    this.ui.scope.classList.remove('active');
    this.camera.position.set(
      Math.cos(this.menuAngle) * this.menuOrbit,
      112,
      Math.sin(this.menuAngle) * this.menuOrbit,
    );
    this.camera.lookAt(0, 12, 0);
    this.lastFrame = performance.now();
  }

  hitscan(origin, dir, range, shooter) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
    let best = null;

    const staticHit = this.world.raycast(origin, d, range);
    if (staticHit) {
      best = {
        distance: staticHit.distance,
        point: new THREE.Vector3(staticHit.point.x, staticHit.point.y, staticHit.point.z),
        kind: staticHit.kind || 'static',
      };
    }

    const consider = (t, extra) => {
      if (t === null || t < 0.05 || t > range) return;
      if (best && t >= best.distance) return;
      best = {
        distance: t,
        point: new THREE.Vector3(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t),
        ...extra,
      };
    };

    for (const bot of this.botManager.bots) {
      if (!bot.alive || bot === shooter) continue;
      const headT = raySphere(origin, d, bot.pos.x, bot.pos.y + 1.78, bot.pos.z, 0.24);
      const bodyT = raySphere(origin, d, bot.pos.x, bot.pos.y + 1.02, bot.pos.z, 0.52);
      const legT = raySphere(origin, d, bot.pos.x, bot.pos.y + 0.48, bot.pos.z, 0.3);
      let t = null;
      let head = false;

      if (headT !== null && (t === null || headT < t)) { t = headT; head = true; }
      if (bodyT !== null && (t === null || bodyT - 0.03 < t)) { t = bodyT; head = false; }
      if (legT !== null && (t === null || legT + 0.06 < t)) { t = legT; head = false; }
      if (t !== null) consider(t, { bot, head, kind: 'bot' });
    }

    if (shooter !== this.player && !this.player.dead) {
      const p = this.player;
      const headT = raySphere(origin, d, p.pos.x, p.pos.y + 1.68, p.pos.z, 0.26);
      const bodyT = raySphere(origin, d, p.pos.x, p.pos.y + 1.02, p.pos.z, 0.5);
      const legT = raySphere(origin, d, p.pos.x, p.pos.y + 0.48, p.pos.z, 0.3);
      let t = null;
      let head = false;
      if (headT !== null && (t === null || headT < t)) { t = headT; head = true; }
      if (bodyT !== null && (t === null || bodyT - 0.03 < t)) { t = bodyT; head = false; }
      if (legT !== null && (t === null || legT + 0.06 < t)) { t = legT; head = false; }
      if (t !== null) consider(t, { player: p, head, kind: 'player' });
    }

    return best;
  }

  onBotKilled(bot, attacker, def, head) {
    const byPlayer = attacker === this.player;
    this.ui.killfeed({
      killer: byPlayer ? 'YOU' : attacker?.name || 'ZONE',
      victim: bot.name,
      weapon: byPlayer && def ? def.name : def?.name || 'ZONE',
    });

    if (byPlayer) {
      this.player.kills++;
      this.audio.kill();
      this.ui.toast(head ? 'HEADSHOT ELIMINATION' : 'ELIMINATED', bot.name, 'gold');
      this.player.shake = Math.max(this.player.shake, 0.07);
    }

    const r = Math.random();
    const dropX = bot.pos.x + (Math.random() - 0.5) * 1.4;
    const dropZ = bot.pos.z + (Math.random() - 0.5) * 1.4;
    if (r < 0.5) {
      this.world.placeLoot('ammo', null, dropX, dropZ, bot.pos.y + 0.02);
    } else if (r < 0.78) {
      this.world.placeLoot('weapon', bot.weaponId, dropX, dropZ, bot.pos.y + 0.02);
    } else if (r < 0.9) {
      this.world.placeLoot('med', null, dropX, dropZ, bot.pos.y + 0.02);
    }

    if (this.state === 'playing' && !this.player.dead && this.botManager.aliveCount === 0) {
      clearTimeout(this._winTimer);
      this._winTimer = setTimeout(() => {
        if (this.state === 'playing' && !this.player.dead) this.endMatch(true);
      }, 1100);
    }
  }

  onPlayerDeath(attacker) {
    if (this.state === 'over' || this.pendingResult) return;
    this.pendingResult = true;
    this.killedBy = attacker?.name || null;
    this.audio.death();
    this.clearHoldInput();
    this.releasePointerLock();
    this.ui.toast('OPERATOR DOWN', attacker ? `ELIMINATED BY ${attacker.name}` : 'LOST TO THE STORM', 'red');
    this.player.shake = 0.42;
    clearTimeout(this._deathTimer);
    this._deathTimer = setTimeout(() => this.endMatch(false), 1500);
  }

  endMatch(win) {
    if (this.state === 'over' || !this.ui) return;
    clearTimeout(this._winTimer);
    clearTimeout(this._deathTimer);
    this.state = 'over';
    this.pendingResult = false;
    this.clearHoldInput();
    this.releasePointerLock();
    this.ui.closeMap();
    this.ui.hidePause();
    this.ui.scope.classList.remove('active');
    this.ui.setBuildMode(false);

    const placement = win ? 1 : 1 + this.botManager.aliveCount;
    this.ui.showResult(win, {
      placement,
      kills: this.player.kills,
      damage: Math.max(0, Math.round(this.player.damageDealt)),
      time: this.matchTime,
      killedBy: this.killedBy,
    });
    if (win) {
      this.audio.win();
    } else {
      this.audio.death();
    }
  }

  updateMenu(dt) {
    this.menuAngle += dt * 0.035;
    this.camera.position.set(
      Math.cos(this.menuAngle) * this.menuOrbit,
      110 + Math.sin(this.menuAngle * 1.3) * 5,
      Math.sin(this.menuAngle) * this.menuOrbit,
    );
    this.camera.lookAt(0, 12, 0);
    this.world?.update(dt, this.elapsed, null, this.camera);
    this.effects.update(dt);
  }

  animate() {
    requestAnimationFrame(this.boundAnimate);
    if (!this.world) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += dt;

    if (this.state === 'menu' || this.state === 'boot') {
      this.updateMenu(dt);
    } else if (this.ui?.mapOpen) {
      this.world.update(dt, this.elapsed, this.player.pos, this.camera);
      this.effects.update(dt);
    } else if (this.state === 'playing' || this.state === 'dropping') {
      this.syncInput();
      this.player.update(dt, this);
      if (this.state === 'playing') {
        this.matchTime += dt;
        this.botManager.update(dt);
        this.zone.update(dt);
      }
      this.world.update(dt, this.elapsed, this.player.pos, this.camera);
      this.effects.update(dt);
      this.updateHudEffects();
      this.ui.update(this);
    } else if (this.state === 'paused') {
      this.world.update(dt, this.elapsed, this.player.pos, this.camera);
      this.effects.update(dt);
    } else {
      this.world.update(dt, this.elapsed, this.player.pos, this.camera);
      this.effects.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
window.__lastCircle = game;
game.boot();

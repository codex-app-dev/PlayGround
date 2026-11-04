import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Arena, ARENA, createEnvironment } from './arena.js';
import { Ball } from './ball.js';
import { Car } from './car.js';
import { AIController } from './ai.js';
import { Effects } from './effects.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040b14, 0.0022);

    this.renderer = new THREE.WebGLRenderer({
      canvas: $('game'),
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Keep the environment map off the whole scene: applying it only to car
    // materials saves a large amount of fragment work on integrated GPUs.
    this.environment = createEnvironment(this.renderer);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 550);
    this.camera.position.set(0, 24, 48);
    this.camera.lookAt(0, 4, 0);

    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.52, 0.62, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.arena = new Arena(this.scene, this.renderer);
    this.effects = new Effects(this.scene, this.renderer);
    this.ball = new Ball(this.scene);
    this.audio = new AudioEngine();
    this.input = new Input();

    this.player = new Car(this.scene, { team: 'blue', isPlayer: true, name: 'YOU', index: 0 });
    this.blueMate = new Car(this.scene, { team: 'blue', isPlayer: false, name: 'NOVA', index: 1 });
    this.orangeA = new Car(this.scene, { team: 'orange', isPlayer: false, name: 'EMBER', index: 2 });
    this.orangeB = new Car(this.scene, { team: 'orange', isPlayer: false, name: 'RAZOR', index: 3 });
    this.cars = [this.player, this.blueMate, this.orangeA, this.orangeB];
    this._applyCarEnvironment();
    this.aiMap = new Map();

    this.state = 'menu';
    this.mode = '2v2';
    this.difficulty = 'pro';
    this.cinematic = false;
    this.ballCam = true;
    this.time = 180;
    this.overtime = false;
    this.overtimeElapsed = 0;
    this.score = { blue: 0, orange: 0 };
    this.countdown = 3;
    this.lastCountdown = 99;
    this.goalTimer = 0;
    this.endTimer = 0;
    this.shake = 0;
    this.elapsed = 0;
    this.menuAngle = 0.8;
    this.goalCamAngle = 0;
    this.goalSide = 1;
    this.snapCamera = true;
    this.camPos = new THREE.Vector3(0, 24, 48);
    this.camLook = new THREE.Vector3(0, 4, 0);
    this.fov = 62;
    this.playerControls = null;
    this.stats = this._freshStats();
    this.shotCooldown = 0;
    this.saveCooldown = 0;
    this.touchEnabled = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.ui = this._uiRefs();

    this._bindHooks();
    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ['playing', 'countdown', 'goal'].includes(this.state)) this.pauseGame();
    });

    this.input.bindTouchControls({
      stickZone: $('stick-zone'),
      knob: $('stick-knob'),
      jumpBtn: $('touch-jump'),
      boostBtn: $('touch-boost'),
    });

    this.returnToMenu(true);
    this._hideLoadingSoon();

    this.last = performance.now();
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);

    window.__RL3D__ = {
      game: this,
      start: (mode = this.mode, difficulty = this.difficulty) => this.startMatch(mode, difficulty, false),
      cinematic: () => this.startMatch(this.mode, this.difficulty, true),
      menu: () => this.returnToMenu(),
      forceGoal: (side = 1) => {
        this.ball.position.set(side * (ARENA.halfLength - 1), 4, 0);
        this.ball.velocity.set(side * 20, 0, 0);
      },
      state: () => this.state,
    };
  }

  _freshStats() {
    return { goals: 0, shots: 0, saves: 0, boostUsed: 0, topSpeed: 0 };
  }

  _applyCarEnvironment() {
    for (const car of this.cars) {
      car.root.traverse((obj) => {
        if (!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.envMap = this.environment;
            mat.needsUpdate = true;
          }
        }
      });
    }
  }

  _uiRefs() {
    return {
      hud: $('hud'),
      menu: $('menu'),
      help: $('help'),
      pause: $('pause'),
      results: $('results'),
      touch: $('touch'),
      scoreBlue: $('score-blue'),
      scoreOrange: $('score-orange'),
      clock: $('clock'),
      clockLabel: $('clock-label'),
      clockFill: $('clock-fill'),
      boostValue: $('boost-value'),
      boostArc: $('boost-arc'),
      boostHud: $('boost-hud'),
      speed: $('speed'),
      sustaining: $('sustaining'),
      countdown: $('countdown'),
      announce: $('announce'),
      hint: $('hint'),
      toast: $('toast'),
      flash: $('flash'),
      minimap: $('minimap'),
      btnCam: $('btn-cam'),
      btnSound: $('btn-sound'),
      btnSoundMenu: $('btn-sound-menu'),
      resultTitle: $('result-title'),
      resultKicker: $('result-kicker'),
      resultBlue: $('result-blue'),
      resultOrange: $('result-orange'),
      resultStats: $('result-stats'),
      playBtn: $('btn-play'),
      loading: $('loading'),
    };
  }

  _bindHooks() {
    for (const car of this.cars) {
      car.hooks.onBallHit = (who, strength, ball) => {
        ball.lastTouch = who;
        ball.lastTouchAt = this.elapsed;
        this.effects.hit(ball.position, who.team === 'blue' ? 0x54ddff : 0xffa24d, strength);
        this.audio.hit(Math.min(1.8, strength), who.team === 'blue' ? 1.12 : 0.92);
        const dist = who.position.distanceTo(this.player.position);
        if (who === this.player) this.shake = Math.max(this.shake, Math.min(0.55, strength * 0.42));
        else if (dist < 18) this.shake = Math.max(this.shake, Math.min(0.2, strength * 0.12));
        if (who === this.player) {
          this.input.vibrate(14 + Math.round(strength * 20));
          this._trackPlayerTouch(ball);
        }
      };
      car.hooks.onLand = (who, speed) => {
        if (who.position.y <= ARENA.carBaseY + 0.05 && speed > 8) {
          this.effects.burst(
            new THREE.Vector3(who.position.x, 0.15, who.position.z),
            0xa6d9ee, Math.min(14, Math.round(speed / 4)), 3.5, 0.55, 0.5, 4
          );
          if (who === this.player) this.shake = Math.max(this.shake, Math.min(0.18, speed / 300));
        }
      };
      car.hooks.onJump = (who) => {
        this.audio.jump();
      };
      car.hooks.onFlip = (who) => {
        this.effects.burst(who.position, 0xffffff, 8, 4, 0.4, 0.35, 0);
      };
    }

    this.ball.onImpact = (strength, pos) => {
      this.effects.hit(pos, 0x9feaff, Math.min(1.2, strength));
      this.audio.hit(strength * 0.6, 1.35);
      if (strength > 0.55) this.shake = Math.max(this.shake, Math.min(0.22, strength * 0.18));
    };

    this.ball.onGoal = (side, pos) => this.onGoal(side, pos);
  }

  _bindUI() {
    const click = (fn) => (e) => { e.preventDefault(); this.audio.init(); this.audio.click(); fn(); };

    $('btn-play').addEventListener('click', click(() => this.startMatch(this.mode, this.difficulty, false)));
    $('btn-spectate').addEventListener('click', click(() => this.startMatch(this.mode, this.difficulty, true)));
    $('btn-help').addEventListener('click', click(() => this._showHelp(true)));
    $('btn-help-close').addEventListener('click', click(() => this._showHelp(false)));
    $('btn-help-play').addEventListener('click', click(() => { this._showHelp(false); this.startMatch(this.mode, this.difficulty, false); }));

    $('btn-sound').addEventListener('click', click(() => this.toggleSound()));
    $('btn-sound-menu').addEventListener('click', click(() => this.toggleSound()));
    $('btn-cam').addEventListener('click', click(() => this.toggleBallCam()));
    $('btn-pause')?.addEventListener('click', click(() => this.pauseGame()));

    $('btn-resume').addEventListener('click', click(() => this.resumeGame()));
    $('btn-restart').addEventListener('click', click(() => this.startMatch(this.mode, this.difficulty, this.cinematic)));
    $('btn-quit').addEventListener('click', click(() => this.returnToMenu()));

    $('btn-again').addEventListener('click', click(() => this.startMatch(this.mode, this.difficulty, this.cinematic)));
    $('btn-menu').addEventListener('click', click(() => this.returnToMenu()));

    for (const btn of document.querySelectorAll('#mode-select .seg')) {
      btn.addEventListener('click', click(() => {
        this.mode = btn.dataset.mode;
        for (const b of document.querySelectorAll('#mode-select .seg')) b.classList.toggle('active', b === btn);
        this._updatePlayLabel();
      }));
    }
    for (const btn of document.querySelectorAll('#diff-select .seg')) {
      btn.addEventListener('click', click(() => {
        this.difficulty = btn.dataset.diff;
        for (const b of document.querySelectorAll('#diff-select .seg')) b.classList.toggle('active', b === btn);
      }));
    }

    $('stick-zone').addEventListener('pointerdown', () => this.audio.init(), { passive: true });
    document.addEventListener('pointerdown', () => this.audio.init(), { once: true });
  }

  _updatePlayLabel() {
    const small = this.ui.playBtn?.querySelector('.play-text small');
    if (small) small.textContent = `${this.mode.toUpperCase()} · ${this.difficulty === 'allstar' ? 'ALL-STAR' : this.difficulty.toUpperCase()}`;
  }

  _showHelp(show) {
    this.ui.help.classList.toggle('hidden', !show);
    if (show) this.ui.menu.classList.add('hidden');
    else if (this.state === 'menu') this.ui.menu.classList.remove('hidden');
  }

  toggleSound() {
    this.audio.init();
    this.audio.setEnabled(!this.audio.enabled);
    const on = this.audio.enabled;
    for (const btn of [this.ui.btnSound, this.ui.btnSoundMenu]) {
      if (btn) btn.classList.toggle('muted', !on);
    }
    this._toast(on ? 'SOUND ON' : 'SOUND OFF');
  }

  toggleBallCam() {
    this.ballCam = !this.ballCam;
    this.ui.btnCam.classList.toggle('on', this.ballCam);
    this._toast(this.ballCam ? 'BALL CAM ON' : 'BALL CAM OFF');
  }

  _toast(text, duration = 1.4) {
    const el = this.ui.toast;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('on'), duration * 1000);
  }

  _hideLoadingSoon() {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.ui.loading.classList.add('done');
      setTimeout(() => this.ui.loading.remove(), 550);
    };
    setTimeout(finish, 900);
    if (document.fonts?.ready) document.fonts.ready.then(() => setTimeout(finish, 120)).catch(() => {});
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = w / h < 0.82;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, portrait ? 1.15 : 1.25));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = portrait ? 72 : 62;
    this.camera.updateProjectionMatrix();
    this.effects.points.material.uniforms.uPixelRatio.value = Math.min(2, this.renderer.getPixelRatio());
  }

  returnToMenu(initial = false) {
    this.state = 'menu';
    this.cinematic = false;
    this.ui.menu.classList.remove('hidden');
    this.ui.help.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.results.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.touch.classList.add('hidden');
    this.ui.countdown.classList.add('hidden');
    this.ui.announce.classList.add('hidden');
    this.ui.btnCam.classList.toggle('on', this.ballCam);
    this.audio.setScene('menu');
    this.effects.reset();
    this.ball.reset(0, ARENA.ballRadius, 0);
    this.ball.mesh.visible = true;
    this.ball.glow.visible = true;

    const preview = [
      [-21, 9, 0.05], [-31, -10, 0.28], [21, -9, Math.PI + 0.06], [31, 10, Math.PI - 0.25],
    ];
    this.cars.forEach((car, i) => {
      car.active = true;
      car.root.visible = true;
      car.groundGlow.visible = true;
      if (car.marker) car.marker.visible = true;
      car.reset(preview[i][0], preview[i][1], preview[i][2]);
      car.boost = 33;
    });
    this.snapCamera = true;
    this.menuAngle = initial ? 0.85 : 0.6;
    document.body.dataset.state = 'menu';
    this._updatePlayLabel();
  }

  startMatch(mode = this.mode, difficulty = this.difficulty, cinematic = false) {
    this.audio.init();
    this.audio.setScene('game');
    this.mode = mode;
    this.difficulty = difficulty;
    this.cinematic = cinematic;
    this.state = 'countdown';
    this.time = 180;
    this.overtime = false;
    this.overtimeElapsed = 0;
    this.score = { blue: 0, orange: 0 };
    this.countdown = 3.15;
    this.lastCountdown = 99;
    this.goalTimer = 0;
    this.endTimer = 0;
    this.shake = 0;
    this.stats = this._freshStats();
    this.shotCooldown = 0;
    this.saveCooldown = 0;
    this.ball.scoredAgainst = 0;
    this.effects.reset();

    this.ui.menu.classList.add('hidden');
    this.ui.help.classList.add('hidden');
    this.ui.results.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.hint.style.opacity = '1';
    this.ui.hint.classList.remove('hidden');
    this.ui.countdown.classList.add('hidden');
    this.ui.announce.classList.add('hidden');
    this.ui.btnCam.classList.toggle('on', this.ballCam);
    this.ui.touch.classList.toggle('hidden', !this.touchEnabled || cinematic);
    document.body.dataset.state = 'playing';

    const active = mode === '2v2' ? this.cars : [this.player, this.orangeA];
    for (const car of this.cars) {
      const on = active.includes(car);
      car.active = on;
      car.root.visible = on;
      car.groundGlow.visible = on;
      if (car.marker) car.marker.visible = on;
    }

    this._buildAIs(active);
    this.resetKickoff();
    this._updatePlayLabel();
    this._updateScoreboard(true);
    this.snapCamera = true;
    if (cinematic) {
      this._toast('CINEMATIC · ESC TO EXIT', 2.4);
    }
  }

  _buildAIs(active) {
    this.aiMap.clear();
    const mk = (car, slot) => new AIController(car, { team: car.team, difficulty: this.difficulty, slot });
    for (const car of active) {
      if (car.isPlayer) continue;
      this.aiMap.set(car, mk(car, car.index));
    }
    if (this.cinematic) this.playerAI = new AIController(this.player, { team: 'blue', difficulty: this.difficulty, slot: 0 });
    else this.playerAI = null;
  }

  resetKickoff() {
    this.ball.reset(0, ARENA.ballRadius, 0, true);
    this.ball.scoredAgainst = 0;
    if (this.mode === '1v1') {
      this.player.reset(-30, 0, 0);
      this.orangeA.reset(30, 0, Math.PI);
    } else {
      this.player.reset(-30, 0, 0);
      this.blueMate.reset(-39, -12, 0.08);
      this.orangeA.reset(30, 0, Math.PI);
      this.orangeB.reset(39, 12, Math.PI - 0.08);
    }
    for (const ai of this.aiMap.values()) ai.reset();
    this.playerAI?.reset();
    this.goalCamAngle = 0;
    this.snapCamera = true;
  }

  pauseGame() {
    if (!['playing', 'countdown', 'goal', 'ending'].includes(this.state)) return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.ui.pause.classList.remove('hidden');
    this.ui.touch.classList.add('hidden');
    document.body.dataset.state = 'paused';
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.ui.pause.classList.add('hidden');
    this.ui.touch.classList.toggle('hidden', !this.touchEnabled || this.cinematic);
    document.body.dataset.state = 'playing';
    this.last = performance.now();
  }

  onGoal(side, pos) {
    if (this.state !== 'playing') return;
    const scoring = side > 0 ? 'blue' : 'orange';
    this.score[scoring]++;
    this.state = 'goal';
    this.goalTimer = 3.1;
    this.goalSide = side;
    this.goalCamAngle = 0;
    this.shake = 1.25;
    this.snapCamera = false;

    const teamColor = scoring === 'blue' ? 0x2ed2ff : 0xff8a2e;
    this.effects.goalExplosion(new THREE.Vector3(side * (ARENA.halfLength + 3), 6.5, 0), teamColor);
    this.arena.goalFlash(side, 1);
    this.audio.goal();
    this.input.vibrate(220);
    this._flash();

    const last = this.ball.lastTouch;
    if (scoring === 'blue' && last === this.player) this.stats.goals++;
    this.ball.lastTouch = null;

    const kicks = ['BACK OF THE NET', 'TOP SHELF', 'ABSOLUTE ROCKET', 'WHAT A STRIKE', 'UNSTOPPABLE'];
    this._showAnnounce(kicks[Math.floor(Math.random() * kicks.length)], `${scoring.toUpperCase()} SCORES`, `${this.score.blue}  —  ${this.score.orange}`, scoring, 3.1);
    this._updateScoreboard(true);
    this.ui.hint.classList.add('hidden');
    this._updateScoreboard(true);
  }

  afterGoal() {
    if (this.overtime) {
      this.endMatch();
      return;
    }
    if (this.time <= 0) {
      this.endMatch();
      return;
    }
    this.resetKickoff();
    this.state = 'countdown';
    this.countdown = 2.7;
    this.lastCountdown = 99;
    this.ball.scoredAgainst = 0;
    this.ui.announce.classList.add('hidden');
    this.ui.hint.classList.add('hidden');
  }

  startOvertime() {
    this.overtime = true;
    this.time = 0;
    this.overtimeElapsed = 0;
    this.resetKickoff();
    this.state = 'countdown';
    this.countdown = 3.15;
    this.lastCountdown = 99;
    this._showAnnounce('SUDDEN DEATH', 'OVERTIME', 'NEXT GOAL WINS', 'gold', 2.6);
    this.audio.whistle();
  }

  beginEnding() {
    this.state = 'ending';
    this.endTimer = 1.25;
    this.ui.countdown.classList.add('hidden');
    this._showAnnounce('FULL TIME', 'MATCH COMPLETE', '', '', 1.3);
    this.audio.whistle();
  }

  endMatch() {
    this.state = 'ended';
    this.ui.announce.classList.add('hidden');
    this.ui.countdown.classList.add('hidden');
    this.ui.touch.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.results.classList.remove('hidden');
    this.audio.setScene('menu');
    const blueWins = this.score.blue > this.score.orange;
    const tie = this.score.blue === this.score.orange;
    this.ui.resultKicker.textContent = this.overtime ? 'OVERTIME WINNER' : 'FULL TIME';
    this.ui.resultTitle.textContent = tie ? 'DRAW' : blueWins ? 'BLUE WINS' : 'ORANGE WINS';
    this.ui.resultTitle.classList.toggle('lose', !blueWins && !tie);
    this.ui.resultBlue.textContent = this.score.blue;
    this.ui.resultOrange.textContent = this.score.orange;
    const s = this.stats;
    this.ui.resultStats.innerHTML = [
      [s.goals, 'YOUR GOALS'],
      [s.shots, 'SHOTS'],
      [s.saves, 'SAVES'],
      [Math.round(s.topSpeed), 'TOP KM/H'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    document.body.dataset.state = 'ended';
    this._updateScoreboard(true);
  }

  _trackPlayerTouch(ball) {
    // shot on goal?
    if (this.shotCooldown <= 0 && ball.velocity.x > 22 && ball.position.x > -34) {
      this.stats.shots++;
      this.shotCooldown = 0.5;
    }
    // goal-line clearance
    if (this.saveCooldown <= 0 && ball.position.x < -38 && ball.velocity.x > 6) {
      this.stats.saves++;
      this.saveCooldown = 1.2;
      this._toast('SAVE!');
    }
  }

  _flash() {
    this.ui.flash.classList.add('on');
    setTimeout(() => this.ui.flash.classList.remove('on'), 40);
  }

  _showAnnounce(kicker, main, sub, cls = '', duration = 2.2) {
    const el = this.ui.announce;
    el.className = `announce ${cls}`;
    el.querySelector('.announce-kicker').textContent = kicker;
    const mainEl = el.querySelector('.announce-main');
    mainEl.textContent = main;
    mainEl.style.animation = 'none';
    void mainEl.offsetWidth;
    mainEl.style.animation = '';
    el.querySelector('.announce-sub').textContent = sub;
    el.classList.remove('hidden');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => el.classList.add('hidden'), duration * 1000);
  }

  _showCountdown(text, go = false) {
    const el = this.ui.countdown;
    el.classList.remove('hidden');
    el.classList.toggle('go', go);
    const span = el.querySelector('span');
    span.textContent = text;
    span.style.animation = 'none';
    void span.offsetWidth;
    span.style.animation = '';
    clearTimeout(this._countdownTimer);
    this._countdownTimer = setTimeout(() => el.classList.add('hidden'), go ? 950 : 1000);
  }

  _updateScoreboard(force = false) {
    const b = this.score.blue, o = this.score.orange;
    this.ui.scoreBlue.textContent = b;
    this.ui.scoreOrange.textContent = o;
    const label = this.overtime ? 'OVERTIME' : 'REGULATION';
    const clock = this.overtime ? formatClock(this.overtimeElapsed) : formatClock(this.time);
    this.ui.clock.textContent = clock;
    this.ui.clockLabel.textContent = label;
    this.ui.clock.classList.toggle('urgent', !this.overtime && this.time <= 15.2 && this.state === 'playing');
    const fill = this.overtime ? 100 : clamp((this.time / 180) * 100, 0, 100);
    this.ui.clockFill.style.width = `${fill}%`;
    this.arena.setScore(b, o, clock, label);
  }

  _updateHUD(dt) {
    if (this.state === 'menu') return;
    this._updateScoreboard();
    const car = this.player;
    const boost = Math.round(car.boost);
    this.ui.boostValue.textContent = boost;
    const arc = 264;
    this.ui.boostArc.style.strokeDashoffset = String(arc * (1 - clamp(boost, 0, 100) / 100));
    this.ui.boostHud.classList.toggle('low', boost < 20);
    const displaySpeed = Math.round(car.speed * 4.05);
    this.ui.speed.textContent = String(displaySpeed).padStart(3, '0');
    this.ui.sustaining.classList.toggle('on', car.speed > 49);
    this._drawMinimap();
  }

  _drawMinimap() {
    const cv = this.ui.minimap;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(4, 16, 29, 0.72)';
    ctx.fillRect(0, 0, W, H);
    const pad = 12;
    const mapX = (x) => pad + ((x + ARENA.halfLength) / ARENA.length) * (W - pad * 2);
    const mapZ = (z) => pad + ((z + ARENA.halfWidth) / ARENA.width) * (H - pad * 2);

    // pitch
    ctx.fillStyle = 'rgba(15, 61, 58, 0.7)';
    ctx.fillRect(mapX(-54), mapZ(-35), mapX(54) - mapX(-54), mapZ(35) - mapZ(-35));
    ctx.strokeStyle = 'rgba(160, 245, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX(-54), mapZ(-35), mapX(54) - mapX(-54), mapZ(35) - mapZ(-35));
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapZ(-35));
    ctx.lineTo(mapX(0), mapZ(35));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mapX(0), mapZ(0), 13, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160, 245, 255, 0.24)';
    ctx.stroke();

    // goals
    const gh = mapZ(13) - mapZ(-13);
    ctx.fillStyle = 'rgba(35, 200, 255, 0.5)';
    ctx.fillRect(mapX(-60) - 2, mapZ(-13), 4, gh);
    ctx.fillStyle = 'rgba(255, 122, 24, 0.5)';
    ctx.fillRect(mapX(60) - 2, mapZ(-13), 4, gh);

    // boost pads
    for (const p of this.arena.pads) {
      if (!p.active) continue;
      ctx.fillStyle = p.big ? 'rgba(255, 190, 40, 0.95)' : 'rgba(255, 220, 100, 0.6)';
      ctx.beginPath();
      ctx.arc(mapX(p.x), mapZ(p.z), p.big ? 3.2 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // cars
    for (const car of this.cars) {
      if (!car.active) continue;
      if (car === this.player) continue;
      const x = mapX(car.position.x), y = mapZ(car.position.z);
      ctx.fillStyle = car.team === 'blue' ? 'rgba(60, 210, 255, 0.85)' : 'rgba(255, 135, 40, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ball
    const bx = mapX(this.ball.position.x), by = mapZ(this.ball.position.z);
    ctx.shadowColor = '#8ef2ff';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#e8fdff';
    ctx.beginPath();
    ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // player arrow
    const px = mapX(this.player.position.x), py = mapZ(this.player.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.player.yaw);
    ctx.fillStyle = '#ffe17a';
    ctx.shadowColor = '#ffd257';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(7.5, 0);
    ctx.lineTo(-4.5, 5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4.5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _updateCars(dt, idle = false) {
    const world = { ball: this.ball, cars: this.cars.filter(c => c.active), pads: this.arena.pads };
    const playerAi = this.cinematic || idle ? this.playerAI : null;
    for (const car of this.cars) {
      if (!car.active) continue;
      let controls;
      if (car.isPlayer) {
        if (this.cinematic && this.playerAI) controls = this.playerAI.update(dt, world);
        else if (idle) controls = this.aiMap.get(car)?.idle() || { throttle: 0, steer: 0, jump: false, jumpPressed: false, boost: false, roll: 0 };
        else controls = this.playerControls || { throttle: 0, steer: 0, jump: false, jumpPressed: false, boost: false, roll: 0 };
      } else {
        const ai = this.aiMap.get(car);
        controls = idle ? ai.idle() : ai.update(dt, world);
      }
      car.update(dt, controls, world);
    }
    if (!idle) this._collectPads();
  }

  _collectPads() {
    for (const car of this.cars) {
      if (!car.active || car.position.y > 4) continue;
      for (const pad of this.arena.pads) {
        if (!pad.active) continue;
        const d = Math.hypot(car.position.x - pad.x, car.position.z - pad.z);
        if (d < pad.radius) {
          const amount = this.arena.takePad(pad);
          car.addBoost(amount);
          this.audio.boostPad(pad.big);
          this.effects.burst(
            new THREE.Vector3(pad.x, 1.1, pad.z),
            pad.big ? 0xffb01e : 0xffe27a,
            pad.big ? 24 : 9, 8, 0.7, 0.6, 4
          );
          if (car === this.player && pad.big) this.input.vibrate(18);
        }
      }
    }
  }

  _resolveCarCollisions() {
    const active = this.cars.filter(c => c.active);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dist = Math.hypot(dx, dz);
        const min = 2.55;
        if (dist > 0.0001 && dist < min) {
          const nx = dx / dist, nz = dz / dist;
          const overlap = min - dist;
          a.position.x += nx * overlap * 0.5;
          a.position.z += nz * overlap * 0.5;
          b.position.x -= nx * overlap * 0.5;
          b.position.z -= nz * overlap * 0.5;
          const rel = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz;
          if (rel < 0) {
            const impulse = Math.min(11, -rel * 0.62);
            a.velocity.x += nx * impulse;
            a.velocity.z += nz * impulse;
            b.velocity.x -= nx * impulse;
            b.velocity.z -= nz * impulse;
            const contact = new THREE.Vector3((a.position.x + b.position.x) / 2, 1.0, (a.position.z + b.position.z) / 2);
            this.effects.hit(contact, 0xffe0a8, Math.min(1.4, -rel / 16));
            if (a === this.player || b === this.player) {
              this.shake = Math.max(this.shake, Math.min(0.3, -rel / 90));
              this.input.vibrate(24);
            }
            this.audio.hit(Math.min(1.2, -rel / 30), 0.7);
          }
        }
      }
    }
  }

  _updateMatch(dt) {
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.saveCooldown = Math.max(0, this.saveCooldown - dt);

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n > 0 && n !== this.lastCountdown) {
        this.lastCountdown = n;
        this._showCountdown(String(n));
        this.audio.beep(n === 1);
      }
      this.ball.update(dt, this.effects);
      if (this.countdown <= 0) {
        this.state = 'playing';
        this._showCountdown('GO!', true);
        this.audio.beep(true);
        this._updateScoreboard(true);
      }
      return;
    }

    if (this.state === 'playing') {
      this._updateCars(dt, false);
      this.ball.update(dt, this.effects);
      this._resolveCarCollisions();
      if (this.state === 'playing') {
        if (this.overtime) this.overtimeElapsed += dt;
        else this.time = Math.max(0, this.time - dt);
        if (!this.overtime && this.time <= 0) {
          if (this.score.blue === this.score.orange) this.startOvertime();
          else this.beginEnding();
        }
      } else if (this.state === 'goal') {
        if (this.overtime) this.overtimeElapsed += dt;
        else this.time = Math.max(0, this.time - dt);
      }
      if (this.player.boosting) this.stats.boostUsed += 33 * dt;
      this.stats.topSpeed = Math.max(this.stats.topSpeed, this.player.speed * 4.05);
      return;
    }

    if (this.state === 'goal') {
      this._updateCars(dt, true);
      this.ball.update(dt, this.effects);
      this._resolveCarCollisions();
      if (this.overtime) this.overtimeElapsed += dt;
      else this.time = Math.max(0, this.time - dt);
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) this.afterGoal();
      return;
    }

    if (this.state === 'ending') {
      this.ball.update(dt, this.effects);
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.endMatch();
    }
  }

  _updateMenu(dt) {
    this.ball.update(dt, null);
    // cars are parked, but their suspension and boost glow still breathe
    for (const car of this.cars) car._syncVisuals(dt, 0);
    this.menuAngle += dt * 0.055;
  }

  _updateCamera(dt) {
    const cam = this.camera;
    let targetFov = window.innerWidth / window.innerHeight < 0.82 ? 72 : 62;
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();

    if (this.state === 'menu') {
      const a = this.menuAngle;
      desiredPos.set(Math.cos(a) * 48, 22 + Math.sin(a * 0.7) * 3.5, Math.sin(a) * 48);
      desiredLook.set(0, 5.2, 0);
    } else if (this.cinematic && !['goal', 'ended'].includes(this.state)) {
      this.menuAngle += dt * 0.14;
      const a = this.menuAngle;
      const center = this.ball.position;
      desiredPos.set(center.x * 0.35 + Math.cos(a) * 41, 18 + Math.sin(a * 0.8) * 4, center.z * 0.4 + Math.sin(a) * 41);
      desiredLook.copy(center).lerp(this.player.position, 0.18);
      desiredLook.y += 2;
    } else if (this.state === 'goal' || (this.state === 'ended' && this.score.blue === this.score.orange)) {
      this.goalCamAngle += dt * 0.4;
      const side = this.goalSide || 1;
      const a = this.goalCamAngle;
      desiredPos.set(side * 36 + Math.cos(a) * 4.5, 10.6 + Math.sin(a * 0.7) * 1.4, Math.sin(a) * 13);
      desiredLook.set(side * (ARENA.halfLength + 2), 5.8, 0);
    } else if (this.state === 'ended') {
      this.menuAngle += dt * 0.1;
      desiredPos.set(Math.cos(this.menuAngle) * 46, 21, Math.sin(this.menuAngle) * 46);
      desiredLook.set(0, 5, 0);
    } else {
      const car = this.player;
      const ball = this.ball.position;
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(car.quaternion);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.01) fwd.set(1, 0, 0);
      fwd.normalize();
      const toBall = new THREE.Vector3(ball.x - car.position.x, 0, ball.z - car.position.z);
      const ballDist = toBall.length();
      const dir = ballDist > 2 ? toBall.normalize() : fwd.clone();
      const speed = car.speed;
      if (this.ballCam) {
        const back = 15.2 + Math.min(6.5, speed * 0.11) + (car.boosting ? 1.6 : 0);
        desiredPos.copy(car.position).addScaledVector(dir, -back);
        desiredPos.y = 7.2 + Math.min(4.5, Math.max(0, ball.y - 2) * 0.18) + (car.boosting ? 0.6 : 0);
        desiredLook.copy(car.position).addScaledVector(dir, 5.5);
        desiredLook.y += 1.9;
        const ballLook = new THREE.Vector3(ball.x, ball.y * 0.6 + 2.1, ball.z);
        desiredLook.lerp(ballLook, 0.46);
        targetFov += Math.min(11, speed * 0.18) + (car.boosting ? 4.5 : 0);
      } else {
        desiredPos.copy(car.position).addScaledVector(fwd, -17.5);
        desiredPos.y = 7.6;
        desiredLook.copy(car.position).addScaledVector(fwd, 8);
        desiredLook.y += 2.2;
        targetFov += Math.min(9, speed * 0.14);
      }
    }

    desiredPos.x = clamp(desiredPos.x, -57.6, 57.6);
    desiredPos.z = clamp(desiredPos.z, -37.6, 37.6);
    desiredPos.y = clamp(desiredPos.y, 2.1, 27.5);

    if (this.snapCamera) {
      this.camPos.copy(desiredPos);
      this.camLook.copy(desiredLook);
      this.snapCamera = false;
    } else {
      const posL = this.state === 'menu' ? 2.1 : 7.5;
      const lookL = this.state === 'menu' ? 2.8 : 9.5;
      this.camPos.x = damp(this.camPos.x, desiredPos.x, posL, dt);
      this.camPos.y = damp(this.camPos.y, desiredPos.y, posL, dt);
      this.camPos.z = damp(this.camPos.z, desiredPos.z, posL, dt);
      this.camLook.x = damp(this.camLook.x, desiredLook.x, lookL, dt);
      this.camLook.y = damp(this.camLook.y, desiredLook.y, lookL, dt);
      this.camLook.z = damp(this.camLook.z, desiredLook.z, lookL, dt);
    }

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shake = this.shake * this.shake;
    const sx = (Math.random() - 0.5) * shake * 0.9;
    const sy = (Math.random() - 0.5) * shake * 0.7;
    const sz = (Math.random() - 0.5) * shake * 0.9;
    cam.position.copy(this.camPos);
    cam.position.x += sx;
    cam.position.y += sy;
    cam.position.z += sz;
    cam.lookAt(this.camLook.x + sx * 0.4, this.camLook.y + sy * 0.4, this.camLook.z + sz * 0.4);

    this.fov = damp(this.fov, targetFov, 4, dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    this.effects.setCameraQuat(cam.quaternion);
  }

  _tick(now) {
    requestAnimationFrame(this._tick);
    const raw = clamp((now - this.last) / 1000 || 0.016, 0.001, 0.26);
    this.last = now;
    this.elapsed += raw;

    const frameControls = this.input.poll();
    this.playerControls = frameControls;

    if (this.input.wasPressed('sound')) this.toggleSound();
    if (this.input.wasPressed('ballcam')) this.toggleBallCam();
    if (this.input.wasPressed('pause')) {
      if (this.state === 'paused') this.resumeGame();
      else if (['playing', 'countdown', 'goal', 'ending'].includes(this.state)) this.pauseGame();
      else if (this.state === 'menu') this._showHelp(false);
      else if (this.state === 'ended') this.returnToMenu();
    }

    if (this.state === 'menu') {
      this._updateMenu(raw);
    } else if (this.state === 'paused') {
      // keep the world still, but idle camera breathing is fine
    } else {
      // Physics runs on fixed steps so the match keeps real-time pace even
      // when the renderer is under load (for example, software WebGL).
      const step = 1 / 60;
      this.accumulator = (this.accumulator || 0) + raw;
      let iterations = 0;
      let first = true;
      while (this.accumulator >= step && iterations < 16) {
        this.playerControls = first ? frameControls : { ...frameControls, jumpPressed: false, jump: false };
        this._updateMatch(step);
        this.accumulator -= step;
        iterations++;
        first = false;
      }
      if (iterations === 16) this.accumulator = 0;
      this.playerControls = frameControls;
    }

    this.arena.update(raw, this.elapsed, this.ball.position);
    this.effects.update(raw);
    this._updateCamera(raw);
    this._updateHUD(raw);
    this.audio.update(raw, {
      speed: this.player.speed,
      throttle: this.player.throttleVisual,
      boosting: this.player.boosting,
      grounded: this.player.grounded,
      paused: !['playing', 'countdown', 'goal', 'ending'].includes(this.state),
    });

    // fade the control hint after the first few seconds of a match
    if (['playing', 'goal'].includes(this.state) && this.elapsed > 9 && this.ui.hint.style.opacity !== '0') {
      this.ui.hint.style.opacity = '0';
    }

    this.composer.render();
    this.input.endFrame();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new Game();
    window.__RL_READY__ = true;
    document.body.dataset.ready = '1';
  } catch (error) {
    console.error(error);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `<div class="loading-text" style="max-width:420px;text-align:center;line-height:1.8">ARENA FAILED TO LOAD<br><span style="font-family:Rajdhani;font-size:11px;letter-spacing:.5px;color:#7096ab">${String(error.message || error)}</span></div>`;
    }
  }
});

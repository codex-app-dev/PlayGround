import * as THREE from 'three';

const PHASES = [
  { wait: 32, shrink: 30, radius: 155, damage: 2 },
  { wait: 26, shrink: 24, radius: 98, damage: 4 },
  { wait: 22, shrink: 20, radius: 60, damage: 7 },
  { wait: 18, shrink: 18, radius: 32, damage: 11 },
  { wait: 15, shrink: 14, radius: 12, damage: 16 },
  { wait: 10, shrink: 10, radius: 2, damage: 25 },
];

const smooth = t => t * t * (3 - 2 * t);

export class Zone {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.active = false;
    this.phase = 0;
    this.state = 'idle';
    this.center = { x: 0, z: 0 };
    this.radius = 235;
    this.nextCenter = { x: 0, z: 0 };
    this.nextRadius = 155;
    this.timer = 0;
    this.duration = 1;
    this.damage = 0;
    this.damageTick = 0;
    this.startCenter = { x: 0, z: 0 };
    this.startRadius = 235;
    this.finished = false;

    const geo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#59c4f0') } },
      vertexShader: `
        varying vec3 vLocal;
        varying vec3 vWorld;
        void main() {
          vLocal = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vLocal;
        varying vec3 vWorld;
        void main() {
          float h = clamp(vLocal.y + 0.5, 0.0, 1.0);
          float base = pow(1.0 - h, 1.35) * 0.36 + 0.035;
          float scan = 0.72 + 0.28 * sin(vWorld.y * 0.52 - uTime * 5.0);
          float bands = 0.85 + 0.15 * sin(vWorld.y * 2.0 + uTime * 1.2);
          gl_FragColor = vec4(uColor, base * scan * bands);
        }
      `,
    });
    this.wall = new THREE.Mesh(geo, mat);
    this.wall.visible = false;
    this.wall.renderOrder = 3;
    scene.add(this.wall);
    this.material = mat;

    const ringGeo = new THREE.RingGeometry(0.994, 1, 160);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe9e2d0, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false,
    });
    this.nextRing = new THREE.Mesh(ringGeo, ringMat);
    this.nextRing.visible = false;
    this.nextRing.renderOrder = 2;
    scene.add(this.nextRing);
  }

  start() {
    this.active = true;
    this.state = 'wait';
    this.phase = 0;
    this.center = { x: 0, z: 0 };
    this.radius = 235;
    this.damage = 0;
    this.damageTick = 0;
    this.finished = false;
    this.pickNext();
    this.timer = PHASES[0].wait;
    this.duration = PHASES[0].wait;
    this.wall.visible = true;
    this.nextRing.visible = true;
    this.updateVisual();
    this.game.ui?.zoneUpdate(this);
  }

  reset() {
    this.active = false;
    this.phase = 0;
    this.state = 'idle';
    this.center = { x: 0, z: 0 };
    this.radius = 235;
    this.nextCenter = { x: 0, z: 0 };
    this.nextRadius = 155;
    this.timer = 0;
    this.duration = 1;
    this.damage = 0;
    this.damageTick = 0;
    this.finished = false;
    this.wall.visible = false;
    this.nextRing.visible = false;
  }

  pickNext() {
    const phase = PHASES[Math.min(this.phase, PHASES.length - 1)];
    this.nextRadius = phase.radius;
    const maxOffset = Math.max(0, this.radius - this.nextRadius * 1.08);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxOffset * 0.82;
    let cx = this.center.x + Math.cos(a) * r;
    let cz = this.center.z + Math.sin(a) * r;
    const limit = 186;
    const d = Math.hypot(cx, cz);
    if (d > limit) { cx *= limit / d; cz *= limit / d; }
    this.nextCenter = { x: cx, z: cz };
  }

  contains(x, z) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }

  timeLeft() {
    return Math.max(0, this.timer);
  }

  update(dt) {
    if (!this.active) return;
    this.material.uniforms.uTime.value += dt;
    this.timer -= dt;

    if (this.state === 'wait') {
      if (this.timer <= 0) {
        this.state = 'shrink';
        this.timer = PHASES[Math.min(this.phase, PHASES.length - 1)].shrink;
        this.duration = this.timer;
        this.startCenter = { ...this.center };
        this.startRadius = this.radius;
        this.damage = PHASES[Math.min(this.phase, PHASES.length - 1)].damage;
        this.game.ui?.zonePhase('ZONE CLOSING', `PHASE ${String(this.phase + 1).padStart(2, '0')} · ${Math.round(this.nextRadius)}M RADIUS`);
        this.game.audio.zonePhase();
      }
    } else if (this.state === 'shrink') {
      const t = Math.min(1, 1 - this.timer / this.duration);
      const e = smooth(t);
      this.center.x = this.startCenter.x + (this.nextCenter.x - this.startCenter.x) * e;
      this.center.z = this.startCenter.z + (this.nextCenter.z - this.startCenter.z) * e;
      this.radius = this.startRadius + (this.nextRadius - this.startRadius) * e;
      if (this.timer <= 0) {
        this.center = { ...this.nextCenter };
        this.radius = this.nextRadius;
        this.phase++;
        if (this.phase >= PHASES.length) {
          this.state = 'final';
          this.timer = 0;
          this.damage = 30;
          this.radius = 0;
          this.game.ui?.zonePhase('FINAL CIRCLE', 'NO SAFE GROUND REMAINS');
          this.game.audio.zoneWarn();
        } else {
          this.state = 'wait';
          this.timer = PHASES[this.phase].wait;
          this.duration = this.timer;
          this.pickNext();
          this.game.ui?.zonePhase('NEXT CIRCLE REVEALED', `SHRINKS IN ${Math.ceil(this.timer)}S`);
          this.game.audio.zonePhase();
        }
      }
    }

    this.updateVisual();
    this.applyDamage(dt);
  }

  updateVisual() {
    const height = 150;
    this.wall.position.set(this.center.x, height * 0.5 - 6, this.center.z);
    this.wall.scale.set(Math.max(0.01, this.radius), height, Math.max(0.01, this.radius));
    this.nextRing.position.set(this.nextCenter.x, 0.4, this.nextCenter.z);
    this.nextRing.scale.setScalar(Math.max(0.01, this.nextRadius));
    this.nextRing.visible = this.state !== 'final';
  }

  applyDamage(dt) {
    if (this.damage <= 0) { this.game.ui?.setOutside(false, 0); return; }
    const player = this.game.player;
    const outside = player.mode === 'playing' && !player.dead && !this.contains(player.pos.x, player.pos.z);
    this.game.ui?.setOutside(outside, this.damage);
    if (player.mode !== 'playing' || player.dead) return;

    this.damageTick += dt;
    if (this.damageTick >= 1) {
      this.damageTick -= 1;
      if (outside) player.damage(this.damage, null, this.game, true);
      for (const bot of this.game.botManager.bots) {
        if (!bot.alive) continue;
        if (!this.contains(bot.pos.x, bot.pos.z)) {
          bot.damage(this.damage, this.game, null, null, false);
        }
      }
    }
  }
}

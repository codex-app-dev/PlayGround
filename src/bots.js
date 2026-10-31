import * as THREE from 'three';
import { WEAPONS, weaponFor, getFlashTexture } from './weapons.js';

const NAMES = [
  'VIPER', 'ROOK', 'NOMAD', 'SPECTER', 'KESTREL', 'JACKAL', 'ORION', 'MACE',
  'TALON', 'SABLE', 'HAVOC', 'ECHO', 'RAVEN', 'CINDER', 'ATLAS', 'FROST',
  'GHOST', 'LYNX', 'ONYX', 'WRAITH', 'BRICK', 'DRIFT', 'CROW', 'EMBER',
];

const BOT_COUNT = 23;
const VEST_COLORS = [0x5c654a, 0x6e5a44, 0x455c60, 0x6b4c3d, 0x59614e, 0x4d4f5f, 0x746647, 0x48594a];
const SHIRT_COLORS = [0x394236, 0x4d4332, 0x343f42, 0x4f3c32, 0x3d4437, 0x3a3c47, 0x544b37, 0x3a463b];

const GEO = {
  torso: new THREE.BoxGeometry(0.6, 0.66, 0.33),
  vest: new THREE.BoxGeometry(0.67, 0.5, 0.4),
  head: new THREE.BoxGeometry(0.27, 0.29, 0.27),
  helmet: new THREE.BoxGeometry(0.33, 0.13, 0.33),
  visor: new THREE.BoxGeometry(0.32, 0.045, 0.1),
  leg: new THREE.BoxGeometry(0.19, 0.58, 0.23),
  boot: new THREE.BoxGeometry(0.21, 0.2, 0.32),
  arm: new THREE.BoxGeometry(0.13, 0.54, 0.16),
  hand: new THREE.BoxGeometry(0.12, 0.13, 0.14),
  backpack: new THREE.BoxGeometry(0.4, 0.5, 0.22),
  belt: new THREE.BoxGeometry(0.64, 0.1, 0.36),
  gunBody: new THREE.BoxGeometry(0.11, 0.15, 0.78),
  gunBarrel: new THREE.CylinderGeometry(0.026, 0.026, 0.42, 6),
  gunMag: new THREE.BoxGeometry(0.08, 0.2, 0.11),
};

const skinMat = new THREE.MeshStandardMaterial({ color: 0xa97858, roughness: 0.84 });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3d423b, roughness: 0.9 });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 0.88 });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x252b27, roughness: 0.55, metalness: 0.35 });
const flashTexture = getFlashTexture();

const damp = (a, b, l, dt) => b + (a - b) * Math.exp(-l * dt);
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function mesh(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class Bot {
  constructor(manager, index, name) {
    this.manager = manager;
    this.world = manager.world;
    this.game = manager.game;
    this.index = index;
    this.name = name;
    this.alive = true;
    this.health = 100;
    this.maxHealth = 100;
    this.radius = 0.39;
    this.height = 1.75;
    this.pos = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.weaponId = ['ar', 'ar', 'ar', 'shotgun', 'sniper'][Math.floor(Math.random() * 5)];
    this.def = weaponFor(this.weaponId);

    this.walkPhase = Math.random() * Math.PI * 2;
    this.moveSpeed = 0;
    this.target = null;
    this.targetKind = null;
    this.lastSeen = null;
    this.aiTimer = Math.random() * 0.6;
    this.fireTimer = 0.8 + Math.random();
    this.aimTimer = 0.4;
    this.los = false;
    this.waypoint = null;
    this.waypointTimer = 0;
    this.stuckTimer = 0;
    this.flashTimer = 0;
    this.deathTimer = 0;
    this.strafe = Math.random() > 0.5 ? 1 : -1;
    this.skill = 0.75 + Math.random() * 0.55;

    this.shirtMat = new THREE.MeshStandardMaterial({
      color: SHIRT_COLORS[index % SHIRT_COLORS.length], roughness: 0.86,
    });
    this.vestMat = new THREE.MeshStandardMaterial({
      color: VEST_COLORS[index % VEST_COLORS.length], roughness: 0.72, metalness: 0.06,
      emissive: 0x000000, emissiveIntensity: 0,
    });
    this.accentMat = new THREE.MeshStandardMaterial({ color: 0xc4553f, roughness: 0.65 });
    this.buildModel();
    this.manager.scene.add(this.group);
    this.group.visible = false;
  }

  buildModel() {
    const model = this.model;
    this.torso = new THREE.Group();
    mesh(this.torso, GEO.torso, this.shirtMat, 0, 1.18, 0);
    mesh(this.torso, GEO.vest, this.vestMat, 0, 1.2, -0.01);
    mesh(this.torso, GEO.belt, pantsMat, 0, 0.86, 0);
    mesh(this.torso, GEO.backpack, gunMat, 0, 1.22, 0.27);
    mesh(this.torso, GEO.helmet, this.accentMat, 0.38, 1.31, 0);
    model.add(this.torso);

    this.head = new THREE.Group();
    mesh(this.head, GEO.head, skinMat, 0, 1.72, 0);
    mesh(this.head, GEO.helmet, this.vestMat, 0, 1.9, 0);
    mesh(this.head, GEO.visor, gunMat, 0, 1.8, 0.13);
    model.add(this.head);

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.15, 0.88, 0);
    mesh(this.leftLeg, GEO.leg, pantsMat, 0, -0.27, 0);
    mesh(this.leftLeg, GEO.boot, bootMat, 0, -0.62, -0.03);
    model.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.15, 0.88, 0);
    mesh(this.rightLeg, GEO.leg, pantsMat, 0, -0.27, 0);
    mesh(this.rightLeg, GEO.boot, bootMat, 0, -0.62, -0.03);
    model.add(this.rightLeg);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.37, 1.4, 0);
    mesh(this.leftArm, GEO.arm, this.shirtMat, 0, -0.24, 0);
    mesh(this.leftArm, GEO.hand, skinMat, 0, -0.53, 0);
    model.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.37, 1.4, 0);
    mesh(this.rightArm, GEO.arm, this.shirtMat, 0, -0.24, 0);
    mesh(this.rightArm, GEO.hand, skinMat, 0, -0.53, 0);
    model.add(this.rightArm);

    this.gun = new THREE.Group();
    mesh(this.gun, GEO.gunBody, gunMat, 0, 1.26, -0.42);
    const barrel = new THREE.Mesh(GEO.gunBarrel, gunMat);
    barrel.position.set(0, 1.29, -0.86);
    barrel.rotation.x = Math.PI / 2;
    this.gun.add(barrel);
    mesh(this.gun, GEO.gunMag, gunMat, 0, 1.13, -0.34);
    this.rightArm.rotation.x = -1.15;
    this.leftArm.rotation.x = -1.32;
    this.leftArm.rotation.z = -0.18;
    this.rightArm.rotation.z = -0.12;
    model.add(this.gun);

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture, color: 0xffd28a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.95,
    }));
    this.flash.position.set(0, 1.3, -1.05);
    this.flash.scale.setScalar(0.7);
    this.flash.visible = false;
    model.add(this.flash);
  }

  spawn(x, z) {
    const y = this.world.terrainHeight(x, z);
    this.pos.set(x, y, z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.visible = true;
    this.alive = true;
    this.health = this.maxHealth;
    this.waypoint = null;
  }

  eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.5, this.pos.z);
  }

  targetEye(target, kind) {
    const p = kind === 'player' ? target.pos : target.pos;
    const h = kind === 'player' ? 1.45 : 1.45;
    return new THREE.Vector3(p.x, p.y + h, p.z);
  }

  selectTarget() {
    const game = this.game;
    const candidates = [];
    if (game.player && !game.player.dead && game.player.mode === 'playing') {
      const d = this.pos.distanceTo(game.player.pos);
      if (d < 76) candidates.push({ ent: game.player, kind: 'player', dist: d });
    }
    for (const bot of this.manager.bots) {
      if (bot === this || !bot.alive) continue;
      const d = this.pos.distanceTo(bot.pos);
      if (d < 62) candidates.push({ ent: bot, kind: 'bot', dist: d });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const eye = this.eye();
    for (let i = 0; i < Math.min(4, candidates.length); i++) {
      const c = candidates[i];
      const te = this.targetEye(c.ent, c.kind);
      if (!this.world.lineBlocked(eye, te)) {
        if (this.target !== c.ent) this.aimTimer = 0.55 + Math.random() * 0.75;
        this.target = c.ent;
        this.targetKind = c.kind;
        this.los = true;
        this.lastSeen = c.ent.pos.clone();
        return;
      }
    }
    if (this.target && (this.target.dead || (this.targetKind === 'bot' && !this.target.alive))) {
      this.target = null;
      this.targetKind = null;
    }
    this.los = false;
    if (!this.target) this.targetKind = null;
  }

  update(dt, game) {
    if (!this.alive) {
      this.deathTimer += dt;
      if (this.deathTimer > 0.8) {
        this.model.rotation.x = damp(this.model.rotation.x, -Math.PI / 2, 9, dt);
        this.model.position.y = damp(this.model.position.y, 0.4, 9, dt);
      }
      return;
    }
    if (game.state !== 'playing') {
      this.animate(dt, 0);
      return;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.vestMat.emissive.setHex(0x7e1a10);
      this.vestMat.emissiveIntensity = Math.max(0, this.flashTimer * 12);
      if (this.flashTimer <= 0) {
        this.vestMat.emissive.setHex(0x000000);
        this.vestMat.emissiveIntensity = 0;
      }
    }
    if (this.flash.visible) {
      this.flash.visible = false;
    }

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.42 + Math.random() * 0.3;
      this.selectTarget();
      if (!this.target || !this.los) this.pickWaypoint(game);
    }

    this.updateMovement(dt, game);
    this.updateCombat(dt, game);
    this.animate(dt, this.moveSpeed);
  }

  pickWaypoint(game) {
    const zone = game.zone;
    if (zone && !zone.contains(this.pos.x, this.pos.z)) {
      const a = Math.random() * Math.PI * 2;
      const r = zone.radius * (0.35 + Math.random() * 0.35);
      this.waypoint = { x: zone.center.x + Math.cos(a) * r, z: zone.center.z + Math.sin(a) * r };
      this.waypointTimer = 7;
      return;
    }
    if (this.lastSeen && Math.random() < 0.55) {
      this.waypoint = { x: this.lastSeen.x + (Math.random() - 0.5) * 12, z: this.lastSeen.z + (Math.random() - 0.5) * 12 };
      this.waypointTimer = 5;
      return;
    }
    if (zone) {
      const a = Math.random() * Math.PI * 2;
      const r = zone.radius * (0.15 + Math.random() * 0.65);
      this.waypoint = { x: zone.center.x + Math.cos(a) * r, z: zone.center.z + Math.sin(a) * r };
    } else {
      const a = Math.random() * Math.PI * 2;
      this.waypoint = { x: this.pos.x + Math.cos(a) * 24, z: this.pos.z + Math.sin(a) * 24 };
    }
    this.waypointTimer = 8;
  }

  updateMovement(dt, game) {
    const zone = game.zone;
    let tx = null, tz = null, speed = 3.1;

    if (zone && !zone.contains(this.pos.x, this.pos.z)) {
      const dx = zone.center.x - this.pos.x;
      const dz = zone.center.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = zone.center.x + (dx / d) * zone.radius * 0.45;
      tz = zone.center.z + (dz / d) * zone.radius * 0.45;
      speed = 4.2;
    } else if (this.target && this.los) {
      const target = this.target;
      const dx = target.pos.x - this.pos.x;
      const dz = target.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      if (d > 33) {
        tx = this.pos.x + ux * 12;
        tz = this.pos.z + uz * 12;
        speed = 3.5;
      } else if (d < 11) {
        tx = this.pos.x - ux * 10;
        tz = this.pos.z - uz * 10;
        speed = 3.4;
      } else {
        tx = this.pos.x - uz * this.strafe * 9 + ux * 1.5;
        tz = this.pos.z + ux * this.strafe * 9 + uz * 1.5;
        speed = 2.5;
        if (Math.random() < 0.006) this.strafe *= -1;
      }
    } else {
      this.waypointTimer -= dt;
      if (!this.waypoint || this.waypointTimer <= 0) this.pickWaypoint(game);
      if (this.waypoint) {
        tx = this.waypoint.x;
        tz = this.waypoint.z;
        speed = 2.7;
      }
    }

    if (tx !== null) {
      let dx = tx - this.pos.x;
      let dz = tz - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.4) {
        this.waypoint = null;
      } else {
        dx /= d; dz /= d;
        let sepX = 0, sepZ = 0;
        for (const other of this.manager.bots) {
          if (other === this || !other.alive) continue;
          const ox = this.pos.x - other.pos.x;
          const oz = this.pos.z - other.pos.z;
          const od = ox * ox + oz * oz;
          if (od < 6.25 && od > 0.01) {
            const inv = 1 / Math.sqrt(od);
            sepX += ox * inv;
            sepZ += oz * inv;
          }
        }
        dx = dx * 0.8 + sepX * 0.55;
        dz = dz * 0.8 + sepZ * 0.55;
        const nd = Math.hypot(dx, dz) || 1;
        dx /= nd; dz /= nd;

        const beforeX = this.pos.x, beforeZ = this.pos.z;
        const step = speed * dt;
        this.pos.x += dx * step;
        this.pos.z += dz * step;
        this.world.resolveCircle(this.pos, this.radius, this.height);
        const moved = Math.hypot(this.pos.x - beforeX, this.pos.z - beforeZ);
        if (moved < step * 0.35) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 0.9) {
            this.stuckTimer = 0;
            this.strafe *= -1;
            this.waypoint = null;
            this.pos.x += -dz * 1.2;
            this.pos.z += dx * 1.2;
          }
        } else {
          this.stuckTimer = 0;
        }
        this.moveSpeed = moved / Math.max(dt, 0.001);
      }
      const gy = this.world.terrainHeight(this.pos.x, this.pos.z);
      if (gy < 0.35) {
        this.pos.x *= 0.985;
        this.pos.z *= 0.985;
        this.waypoint = null;
      }
      this.pos.y = damp(this.pos.y, this.world.terrainHeight(this.pos.x, this.pos.z), 18, dt);
    } else {
      this.moveSpeed = damp(this.moveSpeed, 0, 6, dt);
    }

    const face = this.target && this.los
      ? Math.atan2(-(this.target.pos.x - this.pos.x), -(this.target.pos.z - this.pos.z))
      : (this.waypoint ? Math.atan2(-(tx - this.pos.x), -(tz - this.pos.z)) : this.yaw);
    if (Number.isFinite(face)) this.yaw = lerpAngle(this.yaw, face, 1 - Math.exp(-7 * dt));
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  updateCombat(dt, game) {
    if (!this.target || !this.los) return;
    const target = this.target;
    if (target.dead || (this.targetKind === 'bot' && !target.alive)) {
      this.target = null;
      return;
    }
    this.aimTimer -= dt;
    if (this.aimTimer > 0) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;

    const dist = this.pos.distanceTo(target.pos);
    if (dist > this.def.range) return;

    const origin = this.eye().add(new THREE.Vector3(0, -0.06, 0));
    const targetPos = this.targetEye(target, this.targetKind);
    const miss = (0.22 + dist * 0.0075) / this.skill;
    const perpX = -Math.sin(this.yaw);
    const perpZ = -Math.cos(this.yaw);
    targetPos.x += (Math.random() - 0.5) * miss * 2 * perpX + (Math.random() - 0.5) * miss;
    targetPos.z += (Math.random() - 0.5) * miss * 2 * perpZ + (Math.random() - 0.5) * miss;
    targetPos.y += (Math.random() - 0.5) * miss * 1.4;

    const dir = targetPos.clone().sub(origin);
    const range = this.def.range;
    dir.normalize();
    const hit = game.hitscan(origin, dir, range, this);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, range);
    game.effects.tracer(origin, end, 0xff9f55, 0.6);
    if (hit) {
      if (hit.bot) {
        hit.bot.damage(Math.min(22, this.def.damage * 0.42), game, this, this.def, false);
      } else if (hit.player) {
        hit.player.damage(Math.min(20, this.def.damage * 0.38), this, game);
      } else {
        game.effects.impact(hit.point, hit.kind);
      }
    }

    this.flash.visible = true;
    if (this.flash.material) this.flash.material.rotation = Math.random() * Math.PI * 2;
    this.flash.scale.setScalar(0.55 + Math.random() * 0.35);
    this._flashTimeout = 0.05;

    const { dist: d, pan } = game.audio.spatial(origin, game.player.pos, game.player.yaw);
    if (d < 150) game.audio.shot(this.def.sound, d, pan, 0.85);
    this.fireTimer = this.def.id === 'sniper'
      ? 2.2 + Math.random() * 1.1
      : this.def.id === 'shotgun'
        ? 1.05 + Math.random() * 0.65
        : 0.44 + Math.random() * 0.34;
  }

  damage(amount, game, attacker, def, head) {
    if (!this.alive) return;
    this.health -= amount;
    this.flashTimer = 0.14;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deathTimer = 0;
      this.group.rotation.y = this.yaw;
      this.target = null;
      this.los = false;
      this.flash.visible = false;
      game.onBotKilled(this, attacker, def, head);
    } else {
      if (attacker === game.player) this.aimTimer = Math.max(this.aimTimer, 0.12);
      this.lastAttacker = attacker;
    }
  }

  animate(dt, speed) {
    if (!this.alive) return;
    const target = this.target && this.los;
    if (speed > 0.2) {
      this.walkPhase += dt * (5 + speed * 1.2);
      const swing = Math.min(0.8, 0.28 + speed * 0.08);
      this.leftLeg.rotation.x = Math.sin(this.walkPhase) * swing;
      this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * swing;
      this.leftArm.rotation.x = -1.32 + Math.sin(this.walkPhase) * 0.08;
      this.rightArm.rotation.x = -1.15 + Math.sin(this.walkPhase) * 0.08;
    } else {
      this.walkPhase += dt * 1.2;
      this.leftLeg.rotation.x = damp(this.leftLeg.rotation.x, 0, 8, dt);
      this.rightLeg.rotation.x = damp(this.rightLeg.rotation.x, 0, 8, dt);
      this.leftArm.rotation.x = damp(this.leftArm.rotation.x, -1.32, 8, dt);
      this.rightArm.rotation.x = damp(this.rightArm.rotation.x, -1.15, 8, dt);
    }
    if (target) {
      this.rightArm.rotation.x = -1.35;
      this.leftArm.rotation.x = -1.48;
    }
    if (this.flash.visible) {
      this._flashTimeout -= dt;
      if (this._flashTimeout <= 0) this.flash.visible = false;
    }
  }
}

export class BotManager {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.bots = [];
    this.spawned = false;
  }

  get aliveCount() {
    let n = 0;
    for (const bot of this.bots) if (bot.alive) n++;
    return n;
  }

  isFree(x, z, others) {
    const h = this.world.terrainHeight(x, z);
    if (h < 1.0) return false;
    for (const box of this.world.colliders) {
      if (x > box.minX - 0.7 && x < box.maxX + 0.7 && z > box.minZ - 0.7 && z < box.maxZ + 0.7 && h + 1.6 > box.minY && h < box.maxY) return false;
    }
    for (const o of others) {
      if (Math.hypot(x - o.x, z - o.z) < 4.2) return false;
    }
    return true;
  }

  spawnAll(playerDropCenter = { x: -28, z: -14 }) {
    if (this.spawned) return;
    this.spawned = true;
    const used = [];
    const spawnPoints = [];

    for (let i = 0; i < 8; i++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r = 28 + Math.random() * 68;
        const x = playerDropCenter.x + Math.cos(a) * r;
        const z = playerDropCenter.z + Math.sin(a) * r;
        if (this.isFree(x, z, used)) {
          spawnPoints.push({ x, z });
          used.push({ x, z });
          break;
        }
      }
    }

    const fallback = this.world.botSpawns.slice().sort(() => Math.random() - 0.5);
    for (const s of fallback) {
      if (spawnPoints.length >= BOT_COUNT) break;
      if (this.isFree(s.x, s.z, used)) {
        spawnPoints.push({ x: s.x, z: s.z });
        used.push({ x: s.x, z: s.z });
      }
    }
    let guard = 0;
    while (spawnPoints.length < BOT_COUNT && guard < 200) {
      guard++;
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 170;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.isFree(x, z, used)) {
        spawnPoints.push({ x, z });
        used.push({ x, z });
      }
    }

    const names = NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(BOT_COUNT, spawnPoints.length); i++) {
      const bot = new Bot(this, i, names[i]);
      bot.spawn(spawnPoints[i].x, spawnPoints[i].z);
      this.bots.push(bot);
    }
  }

  update(dt) {
    for (const bot of this.bots) bot.update(dt, this.game);
  }
}

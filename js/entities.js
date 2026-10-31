import * as THREE from '../vendor/three.module.js';
import { unitDef, buildingDef } from './data.js';

let NEXT_ID = 1;

export class Entity {
  constructor(game, opts) {
    this.game = game;
    this.id = NEXT_ID++;
    this.kind = opts.kind;
    this.team = opts.team ?? -1;
    this.race = opts.race ?? null;
    this.role = opts.role ?? null;
    this.pos = new THREE.Vector3(opts.x, 0, opts.z);
    this.facing = opts.facing ?? 0;
    this.hp = opts.hp ?? 1;
    this.maxHp = opts.hp ?? 1;
    this.radius = opts.radius ?? 0.5;
    this.dead = false;
    this.removeT = 0;
    this.teamColor = opts.teamColor ?? 0xd8b45a;
    this.barHeight = opts.barHeight ?? 1.5;
    this.selected = false;
  }
  distanceTo(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
  distanceToEntity(e) {
    return Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
  }
  faceTo(x, z) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) this.facing = Math.atan2(dx, dz);
  }
}

export class Unit extends Entity {
  constructor(game, team, role, x, z, opts = {}) {
    const def = unitDef(team.race, role);
    super(game, {
      kind: 'unit', team: team.id, race: team.race, role,
      x, z, hp: def.hp, radius: def.radius, teamColor: team.color3d,
      facing: opts.facing ?? 0,
    });
    this.def = def;
    this.speed = def.speed;
    this.damage = def.damage;
    this.armor = def.armor;
    this.range = def.range;
    this.attackSpeed = def.attackSpeed;
    this.projectile = def.projectile || null;
    this.heal = def.heal || 0;
    this.healRange = def.healRange || 0;
    this.healCooldown = def.healCooldown || 6;
    this.supply = def.supply;
    this.state = 'idle';
    this.path = [];
    this.dest = null;
    this.target = null;
    this.attackMoveDest = null;
    this.gatherNode = null;
    this.gatherType = null;
    this.carry = 0;
    this.carryType = null;
    this.buildTarget = null;
    this.cooldown = Math.random() * 0.3;
    this.think = Math.random() * 0.4;
    this.repath = 0;
    this.healTimer = Math.random() * 2;
    this.attackAnim = 0;
    this.working = false;
    this.moving = false;
    this.lastAttacker = null;
    this.orderOrigin = null;
    this.barHeight = def.role === 'heavy' ? 2.6 : 2.1;
    this.spawnT = game.time;
  }

  setPathTo(x, z) {
    const p = this.game.nav.findPath(this.pos.x, this.pos.z, x, z);
    this.path = p;
    if (!p.length) {
      const free = this.game.nav.nearestFreePoint(x, z, 30);
      this.path = [{ x: free.x, z: free.z }];
    }
  }

  clearOrder() {
    this.state = 'idle';
    this.path = [];
    this.dest = null;
    this.target = null;
    this.attackMoveDest = null;
    this.gatherNode = null;
    this.gatherType = null;
    this.buildTarget = null;
    this.working = false;
    this.moving = false;
    this.carry = 0;
    this.carryType = null;
    this.orderOrigin = null;
  }

  moveAlongPath(dt, speedMul = 1) {
    if (!this.path.length) {
      this.moving = false;
      return true;
    }
    let point = this.path[0];
    let dx = point.x - this.pos.x;
    let dz = point.z - this.pos.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.42) {
      this.path.shift();
      if (!this.path.length) {
        this.moving = false;
        return true;
      }
      point = this.path[0];
      dx = point.x - this.pos.x;
      dz = point.z - this.pos.z;
      dist = Math.hypot(dx, dz);
    }
    if (dist < 0.001) return false;
    this.faceTo(point.x, point.z);
    const step = Math.min(dist, this.speed * speedMul * dt);
    const nx = this.pos.x + (dx / dist) * step;
    const nz = this.pos.z + (dz / dist) * step;
    const nav = this.game.nav;
    if (!nav.isBlockedWorld(nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (!nav.isBlockedWorld(nx, this.pos.z)) {
      this.pos.x = nx;
    } else if (!nav.isBlockedWorld(this.pos.x, nz)) {
      this.pos.z = nz;
    } else {
      this.path = [];
      this.moving = false;
      return true;
    }
    this.moving = true;
    return false;
  }

  gatherSpot(node) {
    const jitter = ((this.id % 7) - 3) * 0.18;
    const base = Math.atan2(this.pos.z - node.pos.z, this.pos.x - node.pos.x) + jitter;
    const r = node.radius + 1.05;
    let x = node.pos.x + Math.cos(base) * r;
    let z = node.pos.z + Math.sin(base) * r;
    if (this.game.nav.isBlockedWorld(x, z)) {
      const p = this.game.nav.nearestFreePoint(x, z, 12);
      x = p.x; z = p.z;
    }
    return { x, z };
  }

  dropoffSpot(building) {
    const angle = Math.atan2(this.pos.z - building.pos.z, this.pos.x - building.pos.x) + ((this.id % 5) - 2) * 0.2;
    const r = building.size * 0.9 + 1.15;
    let x = building.pos.x + Math.cos(angle) * r;
    let z = building.pos.z + Math.sin(angle) * r;
    if (this.game.nav.isBlockedWorld(x, z)) {
      const p = this.game.nav.nearestFreePoint(x, z, 14);
      x = p.x; z = p.z;
    }
    return { x, z };
  }

  nearEntity(e, extra = 0) {
    return this.distanceToEntity(e) <= e.radius + extra;
  }
}

export class Building extends Entity {
  constructor(game, team, role, x, z, opts = {}) {
    const def = buildingDef(team.race, role);
    super(game, {
      kind: 'building', team: team.id, race: team.race, role,
      x, z, hp: opts.complete === false ? def.hp * 0.18 : def.hp,
      radius: def.size * 0.9, teamColor: team.color3d,
      facing: opts.facing ?? 0,
    });
    this.def = def;
    this.size = def.size;
    this.maxHp = def.hp;
    this.construction = opts.complete === false ? 0 : 1;
    this.completed = this.construction >= 1;
    this.queue = [];
    this.rally = new THREE.Vector2(x, z);
    this.rallyResource = null;
    this.cooldown = Math.random() * 0.5;
    this.target = null;
    this.think = Math.random() * 0.4;
    this.barHeight = def.size * 2;
    this.underAttackT = 0;
    this.builderCount = 0;
    if (opts.rally) this.rally.set(opts.rally.x, opts.rally.z);
  }

  get isHall() { return this.role === 'hall'; }
  get isProduction() { return !!(this.def.trains && this.def.trains.length); }

  addSupply() {
    if (this.completed && this.def.supply) this.game.teamOf(this.team).supplyCap += this.def.supply;
  }
}

export class Resource extends Entity {
  constructor(game, type, x, z, opts = {}) {
    super(game, {
      kind: 'resource', team: -1, race: null, role: type,
      x, z, hp: opts.amount ?? 1, radius: opts.radius ?? 1,
      teamColor: 0xd8b45a, facing: opts.rot ?? 0,
      barHeight: opts.barHeight ?? 2,
    });
    this.resourceType = type;
    this.amount = opts.amount ?? Infinity;
    this.maxAmount = this.amount;
    this.variant = opts.variant ?? 0;
    this.scale = opts.scale ?? 1;
    this.navRadius = opts.navRadius ?? this.radius;
    this.exhausted = false;
    this.rich = !!opts.rich;
    this.phase = Math.random() * Math.PI * 2;
  }
}

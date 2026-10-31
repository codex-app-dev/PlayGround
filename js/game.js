import * as THREE from '../vendor/three.module.js';
import { RACES, unitDef, buildingDef, TEAM_COLORS, DIFFICULTY } from './data.js';
import { MAP, generateLayout } from './map.js';
import { NavGrid, buildStaticBlockers } from './nav.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Unit, Building, Resource } from './entities.js';
import { createView } from './render.js';
import { createRock } from './models.js';
import { AIController } from './ai.js';
import { updateUnit, updateBuilding, updateFountain } from './combat.js';

export class Game {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.playerRace = options.playerRace || 'human';
    this.aiRace = options.aiRace || 'orc';
    this.difficulty = DIFFICULTY[options.difficulty] || DIFFICULTY.normal;
    this.time = 0;
    this.over = false;
    this.paused = false;
    this.winner = null;
    this.layout = generateLayout();
    this.world = new World(scene, this.layout);
    this.effects = new Effects(scene, this);
    this.nav = new NavGrid(150, 2);
    buildStaticBlockers(this.nav, this.layout);
    this.entities = [];
    this.units = [];
    this.buildings = [];
    this.resources = [];
    this.selection = [];
    this.factory = {};
    this.onSelectionChanged = null;
    this.onNotify = null;
    this.onFloatText = null;
    this.onGameOver = null;
    this.onStats = null;
    this.notifyCooldowns = new Map();
    this.recalcT = 0;
    this.pingT = 0;
    this.teams = [
      this.makeTeam(0, this.playerRace, false),
      this.makeTeam(1, this.aiRace, true),
    ];
    this.createRallyMarker();
    this.populateMap();
    this.createStartBase(this.teams[0]);
    this.createStartBase(this.teams[1]);
    this.recalcSupply();
    this.startWorkers();
    this.ai = new AIController(this, 1, this.difficulty);
    this.updateRallyMarker();
  }

  makeTeam(id, race, isAI) {
    return {
      id, race, isAI,
      color: id === 0 ? TEAM_COLORS.player : TEAM_COLORS.enemy,
      color3d: id === 0 ? TEAM_COLORS.player3d : TEAM_COLORS.enemy3d,
      gold: 520,
      lumber: 260,
      supplyCap: 0,
      supplyUsed: 0,
      alive: true,
      stats: { goldGathered: 0, lumberGathered: 0, trained: 0, killed: 0, lost: 0, buildingsBuilt: 0 },
    };
  }

  teamOf(id) {
    return this.teams[id];
  }

  otherTeam(id) {
    return id === 0 ? 1 : 0;
  }

  notify(text, type = 'info', cooldown = 0) {
    if (!this.onNotify) return;
    if (cooldown) {
      const last = this.notifyCooldowns.get(text) || -999;
      if (this.time - last < cooldown) return;
      this.notifyCooldowns.set(text, this.time);
    }
    this.onNotify(text, type);
  }

  floatText(pos, text, color = '#ffd166') {
    if (this.onFloatText) this.onFloatText(pos, text, color);
  }

  // -------------------------------------------------------------------------
  // Map population
  // -------------------------------------------------------------------------
  populateMap() {
    for (const t of this.layout.trees) {
      this.spawnResource('lumber', t.x, t.z, {
        amount: 120, radius: 0.62 * t.scale + 0.28, navRadius: 0.52 * t.scale + 0.35,
        variant: t.variant, scale: t.scale, rot: t.rot, barHeight: 4 * t.scale,
        addNav: false,
      });
    }
    for (const r of this.layout.rocks) {
      const model = createRock(r.scale, r.variant);
      model.position.set(r.x, 0, r.z);
      model.rotation.y = r.rot;
      this.scene.add(model);
    }
    for (let i = 0; i < MAP.mines.length; i++) {
      const m = MAP.mines[i];
      this.spawnResource('gold', m.x, m.z, {
        amount: m.amount, radius: 2.5, navRadius: 2.5, barHeight: 2.2,
        variant: i, rich: m.rich,
      });
    }
    this.spawnResource('fountain', MAP.fountain.x, MAP.fountain.z, {
      amount: Infinity, radius: 4.2, navRadius: 4.4, barHeight: 3,
    });
  }

  spawnResource(type, x, z, opts = {}) {
    const r = new Resource(this, type, x, z, opts);
    this.resources.push(r);
    this.entities.push(r);
    if (opts.addNav !== false && type !== 'lumber') {
      this.nav.addCircle(x, z, r.navRadius);
    }
    r.view = createView(this, r);
    r.view.root.rotation.y = r.facing;
    r.barHeight = r.view.height;
    return r;
  }

  createRallyMarker() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }));
    pole.position.y = 0.8;
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: this.teams[0].color3d, side: THREE.DoubleSide }));
    flag.position.set(0.35, 1.35, 0);
    g.add(flag);
    this.rallyFlag = flag;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), new THREE.MeshBasicMaterial({ color: this.teams[0].color3d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    g.visible = false;
    this.rallyMarker = g;
    this.scene.add(g);
  }

  createStartBase(team) {
    const base = team.id === 0 ? MAP.playerBase : MAP.enemyBase;
    const toward = team.id === 0 ? MAP.enemyBase : MAP.playerBase;
    const facing = Math.atan2(toward.x - base.x, toward.z - base.z);
    const hall = this.spawnBuilding(team, 'hall', base.x, base.z, { complete: true, facing });
    const mine = this.findNearestResource(team, 'gold', base.x, base.z);
    if (mine) {
      hall.rally.set(mine.pos.x, mine.pos.z);
      hall.rallyResource = mine;
    }
    // Starting army.
    const angleToCenter = Math.atan2(-base.z, -base.x);
    for (let i = 0; i < 4; i++) {
      const a = angleToCenter + (i - 1.5) * 0.32;
      const x = base.x + Math.cos(a) * 7.4;
      const z = base.z + Math.sin(a) * 7.4;
      this.spawnUnit(team, 'worker', x, z, { facing: facing + Math.PI });
    }
    for (let i = 0; i < 2; i++) {
      const a = angleToCenter + 1.8 + i * 0.32;
      const x = base.x + Math.cos(a) * 7.2;
      const z = base.z + Math.sin(a) * 7.2;
      const u = this.spawnUnit(team, 'melee', x, z, { facing: facing + Math.PI });
      u.homePos = { x, z };
    }
    this.recalcSupply();
    return hall;
  }

  startWorkers() {
    for (const team of this.teams) {
      const workers = this.unitsOf(team.id).filter(u => u.role === 'worker');
      const mines = this.resources.filter(r => r.resourceType === 'gold' && r.amount > 0);
      const trees = this.resources.filter(r => r.resourceType === 'lumber' && r.amount > 0);
      workers.forEach((w, i) => {
        if (i < 2) {
          const node = this.nearestFrom(w, mines);
          if (node) this.assignGather(w, node);
        } else {
          const node = this.nearestFrom(w, trees);
          if (node) this.assignGather(w, node);
        }
      });
    }
  }

  nearestFrom(unit, list) {
    let best = null;
    let bestD = Infinity;
    for (const e of list) {
      if (e.dead || e.amount <= 0) continue;
      const d = unit.distanceToEntity(e);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  spawnUnit(team, role, x, z, opts = {}) {
    if (this.nav.isBlockedWorld(x, z)) {
      const p = this.nav.nearestFreePoint(x, z, 20);
      x = p.x; z = p.z;
    }
    const u = new Unit(this, team, role, x, z, opts);
    this.units.push(u);
    this.entities.push(u);
    u.view = createView(this, u);
    u.barHeight = u.view.height;
    u.view.root.rotation.y = u.facing;
    if (opts.homePos) u.homePos = opts.homePos;
    this.recalcSupply();
    return u;
  }

  spawnBuilding(team, role, x, z, opts = {}) {
    const def = buildingDef(team.race, role);
    const b = new Building(this, team, role, x, z, opts);
    this.buildings.push(b);
    this.entities.push(b);
    this.nav.addRect(x, z, def.size * 0.86, def.size * 0.86);
    b.view = createView(this, b);
    b.barHeight = b.view.height;
    b.view.root.rotation.y = b.facing;
    if (b.completed) this.recalcSupply();
    return b;
  }

  canPlaceAt(x, z, size) {
    const half = size * 0.88;
    if (Math.abs(x) + half > MAP.playable - 1 || Math.abs(z) + half > MAP.playable - 1) return false;
    const nav = this.nav;
    const minX = Math.floor((x - half - nav.min) / nav.cell);
    const maxX = Math.floor((x + half - nav.min) / nav.cell);
    const minZ = Math.floor((z - half - nav.min) / nav.cell);
    const maxZ = Math.floor((z + half - nav.min) / nav.cell);
    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (!nav.inBounds(ix, iz)) return false;
        if (nav.counts[ix + iz * nav.n] > 0) return false;
      }
    }
    // Do not let a building sit right on top of a unit.
    for (const u of this.units) {
      if (u.dead) continue;
      if (Math.hypot(u.pos.x - x, u.pos.z - z) < half + 0.65) return false;
    }
    return true;
  }

  startBuilding(team, role, x, z, worker = null) {
    const def = buildingDef(team.race, role);
    if (!this.canAfford(team, def.cost)) {
      if (!team.isAI) this.notify(`Не хватает ресурсов: ${this.costMissing(team, def.cost)}`, 'warn');
      return { ok: false, reason: 'resources' };
    }
    if (!this.canPlaceAt(x, z, def.size)) {
      if (!team.isAI) this.notify('Здесь нельзя строить', 'warn');
      return { ok: false, reason: 'blocked' };
    }
    this.pay(team, def.cost);
    const b = this.spawnBuilding(team, role, x, z, { complete: false });
    if (worker) this.orderBuild([worker], b);
    if (!team.isAI) this.notify(`${def.name}: заложен фундамент`, 'info');
    return { ok: true, building: b };
  }

  canAfford(team, cost) {
    return (team.gold >= (cost.gold || 0)) && (team.lumber >= (cost.lumber || 0));
  }

  costMissing(team, cost) {
    const parts = [];
    if (team.gold < (cost.gold || 0)) parts.push(`${(cost.gold || 0) - team.gold} зол.`);
    if (team.lumber < (cost.lumber || 0)) parts.push(`${(cost.lumber || 0) - team.lumber} древ.`);
    return parts.join(', ');
  }

  pay(team, cost) {
    team.gold -= cost.gold || 0;
    team.lumber -= cost.lumber || 0;
  }

  refund(team, cost) {
    team.gold += cost.gold || 0;
    team.lumber += cost.lumber || 0;
  }

  findBuildSpot(team, size, minR = 6.5, maxR = 15) {
    const hall = this.getHall(team.id);
    if (!hall) return null;
    const rnd = Math.random() * Math.PI * 2;
    for (let r = minR; r <= maxR; r += 1.1) {
      for (let i = 0; i < 18; i++) {
        const a = rnd + (i / 18) * Math.PI * 2 + r * 0.15;
        const x = hall.pos.x + Math.cos(a) * r;
        const z = hall.pos.z + Math.sin(a) * r;
        if (Math.hypot(x, z) > MAP.playable - 3) continue;
        if (this.canPlaceAt(x, z, size)) return { x, z };
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Unit production
  // -------------------------------------------------------------------------
  totalQueuedSupply(teamId) {
    let sum = 0;
    for (const b of this.buildings) {
      if (b.team !== teamId || b.dead) continue;
      for (const q of b.queue) sum += q.supply;
    }
    return sum;
  }

  enqueueUnit(building, role, silent = false) {
    if (!building || building.dead || building.construction < 1) return false;
    if (building.queue.length >= 5) {
      if (!silent) this.notify('Очередь обучения заполнена', 'warn', 2);
      return false;
    }
    const team = this.teams[building.team];
    const def = unitDef(team.race, role);
    if (!this.canAfford(team, def.cost)) {
      if (!silent) this.notify(`Не хватает ресурсов: ${this.costMissing(team, def.cost)}`, 'warn', 2);
      return false;
    }
    const reserved = team.supplyUsed + this.totalQueuedSupply(team.id) + def.supply;
    if (reserved > team.supplyCap) {
      if (!silent) this.notify('Нужно больше снабжения — постройте ферму', 'warn', 3);
      return false;
    }
    this.pay(team, def.cost);
    building.queue.push({ role, time: 0, total: def.train, cost: { ...def.cost }, supply: def.supply });
    if (!silent && !team.isAI) this.notify(`${def.name}: обучение начато`, 'info');
    return true;
  }

  cancelQueue(building, index) {
    if (index < 0 || index >= building.queue.length) return;
    const team = this.teams[building.team];
    const q = building.queue[index];
    this.refund(team, q.cost);
    building.queue.splice(index, 1);
    if (!team.isAI) this.notify('Обучение отменено, ресурсы возвращены', 'info');
  }

  spawnFromBuilding(building) {
    const team = this.teams[building.team];
    const q = building.queue[0];
    if (!q) return;
    const def = unitDef(team.race, q.role);
    if (team.supplyUsed + def.supply > team.supplyCap) {
      if (!team.isAI) this.notify('Нужно больше снабжения — постройте ферму', 'warn', 4);
      return;
    }
    const rally = building.rally;
    let dx = rally.x - building.pos.x;
    let dz = rally.y - building.pos.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.1) { dx = 0; dz = 1; len = 1; }
    const spawnR = building.size * 0.95 + 1.15;
    const baseAngle = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.8;
    let x = building.pos.x + Math.cos(baseAngle) * spawnR;
    let z = building.pos.z + Math.sin(baseAngle) * spawnR;
    if (this.nav.isBlockedWorld(x, z)) {
      const p = this.nav.nearestFreePoint(x, z, 16);
      x = p.x; z = p.z;
    }
    const unit = this.spawnUnit(team, q.role, x, z, { facing: Math.atan2(dx, dz) });
    unit.homePos = { x, z };
    building.queue.shift();
    team.stats.trained++;
    team.supplyUsed += def.supply;
    this.recalcSupply();
    if (unit.role === 'worker' && building.rallyResource && !building.rallyResource.dead && building.rallyResource.amount > 0) {
      this.assignGather(unit, building.rallyResource);
    } else if (Math.hypot(rally.x - unit.pos.x, rally.y - unit.pos.z) > 2) {
      this.orderMove([unit], { x: rally.x, z: rally.y }, { formation: false });
    }
    this.effects.dust(x, z, 0xd8c9a5, 5, 0.7);
    this.effects.ring(x, z, team.color3d, 1.4, 0.6, 0.55);
    if (!team.isAI) this.notify(`${def.name} готов к бою`, 'success');
  }

  completeBuilding(b) {
    if (!b || b.dead || b.completed) return;
    b.construction = 1;
    b.completed = true;
    b.hp = b.maxHp;
    this.teams[b.team].stats.buildingsBuilt++;
    this.recalcSupply();
    this.effects.buildComplete(b.pos.x, b.pos.z, this.teams[b.team].color3d);
    if (!this.teams[b.team].isAI) {
      this.notify(`${b.def.name} готова!`, 'success');
    }
    for (const u of this.units) {
      if (u.buildTarget === b) {
        u.buildTarget = null;
        u.state = 'idle';
        u.working = false;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  ownUnitsSelected() {    return this.selection.filter(e => !e.dead && e.kind === 'unit' && e.team === 0);
  }

  orderMove(units, point, opts = {}) {
    if (!units.length) return;
    const formation = opts.formation !== false;
    const spots = formation ? this.formationSpots(units, point) : units.map(() => ({ x: point.x, z: point.z }));
    units.forEach((u, i) => {
      if (u.dead) return;
      u.clearOrder();
      u.state = opts.attackMove ? 'attackMove' : 'move';
      const free = this.nav.isBlockedWorld(spots[i].x, spots[i].z) ? this.nav.nearestFreePoint(spots[i].x, spots[i].z, 20) : spots[i];
      u.dest = { x: free.x, z: free.z };
      u.attackMoveDest = opts.attackMove ? { x: point.x, z: point.z } : null;
      u.orderOrigin = { x: u.pos.x, z: u.pos.z };
      u.setPathTo(free.x, free.z);
    });
    this.effects.ring(point.x, point.z, opts.attackMove ? 0xff8a5c : 0x8fc2ff, 1.5, 0.55, 0.7);
  }

  formationSpots(units, point) {
    if (units.length === 1) return [{ x: point.x, z: point.z }];
    const n = units.length;
    const cols = Math.ceil(Math.sqrt(n));
    const spacing = 1.7;
    const rows = Math.ceil(n / cols);
    // Face the formation towards its movement direction.
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.pos.x; cz += u.pos.z; }
    cx /= n; cz /= n;
    const ang = Math.atan2(point.x - cx, point.z - cz);
    const cos = Math.cos(ang), sin = Math.sin(ang);
    // Rows are perpendicular to the direction of travel.
    const spots = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const lateral = (col - (cols - 1) / 2) * spacing;
      const forward = -row * spacing;
      spots.push({
        x: point.x + lateral * cos + forward * sin,
        z: point.z - lateral * sin + forward * cos,
      });
    }
    return spots;
  }

  orderAttack(units, target) {
    if (!units.length || !target || target.dead) return;
    for (const u of units) {
      if (u.dead) continue;
      u.clearOrder();
      u.state = 'attack';
      u.target = target;
      u.orderOrigin = { x: u.pos.x, z: u.pos.z };
      u.repath = 0;
      const spot = this.targetApproach(u, target);
      u.setPathTo(spot.x, spot.z);
    }
    this.effects.ring(target.pos.x, target.pos.z, 0xff5a4a, Math.max(1.5, target.radius), 0.6, 0.8);
  }

  targetApproach(u, target) {
    const r = target.radius + Math.max(0.5, u.def.range * 0.65);
    const a = Math.atan2(u.pos.z - target.pos.z, u.pos.x - target.pos.x);
    let x = target.pos.x + Math.cos(a) * r;
    let z = target.pos.z + Math.sin(a) * r;
    if (this.nav.isBlockedWorld(x, z)) {
      const p = this.nav.nearestFreePoint(x, z, 16);
      x = p.x; z = p.z;
    }
    return { x, z };
  }

  assignGather(worker, node) {
    if (!worker || worker.dead || worker.role !== 'worker' || !node || node.dead || node.amount <= 0) return;
    worker.clearOrder();
    worker.state = 'toResource';
    worker.gatherNode = node;
    worker.gatherType = node.resourceType;
    worker.orderOrigin = { x: worker.pos.x, z: worker.pos.z };
    const spot = worker.gatherSpot(node);
    worker.dest = spot;
    worker.setPathTo(spot.x, spot.z);
    worker.faceTo(node.pos.x, node.pos.z);
  }

  orderGather(workers, node) {
    const list = workers.filter(w => w.role === 'worker' && !w.dead);
    if (!list.length) {
      this.notify('Для добычи нужен рабочий', 'warn', 2);
      return;
    }
    list.forEach(w => this.assignGather(w, node));
    this.effects.ring(node.pos.x, node.pos.z, node.resourceType === 'gold' ? 0xffd166 : 0x8fd06a, 1.8, 0.55, 0.7);
  }

  orderBuild(workers, building) {
    if (!building || building.dead) return;
    for (const w of workers) {
      if (w.dead || w.role !== 'worker') continue;
      w.clearOrder();
      w.state = 'build';
      w.buildTarget = building;
      w.orderOrigin = { x: w.pos.x, z: w.pos.z };
      const spot = w.dropoffSpot(building);
      w.dest = spot;
      w.setPathTo(spot.x, spot.z);
    }
  }

  orderStop(units) {
    for (const u of units) {
      if (u.dead) continue;
      u.clearOrder();
      u.state = 'idle';
    }
    this.notify('Отряд остановлен', 'info', 1);
  }

  setRally(building, point, node = null) {
    building.rally.set(point.x, point.z);
    building.rallyResource = node;
    if (node) {
      this.notify(`Точка сбора: ${node.resourceType === 'gold' ? 'золотая шахта' : 'лес'}`, 'info');
    } else {
      this.notify('Точка сбора установлена', 'info');
    }
    this.updateRallyMarker();
  }

  findNearestResource(team, type, x, z) {
    let best = null;
    let bestD = Infinity;
    for (const r of this.resources) {
      if (r.dead || r.amount <= 0 || r.resourceType !== type) continue;
      const d = Math.hypot(r.pos.x - x, r.pos.z - z);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  findNearestDropoff(team, x, z) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.dead || b.team !== team.id || !b.completed || !b.def.dropoff) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  clearOrderForTarget(entity) {
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.target === entity) { u.target = null; if (u.state === 'attack') u.state = u.attackMoveDest ? 'attackMove' : 'idle'; }
      if (u.gatherNode === entity) { u.gatherNode = null; u.state = 'idle'; u.path = []; }
      if (u.buildTarget === entity) { u.buildTarget = null; u.state = 'idle'; u.path = []; }
    }
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------
  setSelection(list) {
    const filtered = [];
    for (const e of list) {
      if (!e || e.dead) continue;
      if (!filtered.includes(e)) filtered.push(e);
    }
    for (const e of this.selection) {
      e.selected = false;
      e.view?.setSelected(false);
    }
    this.selection = filtered;
    for (const e of filtered) {
      e.selected = true;
      e.view?.setSelected(true);
    }
    this.updateRallyMarker();
    if (this.onSelectionChanged) this.onSelectionChanged(filtered);
  }

  deselect() {
    this.setSelection([]);
  }

  primary() {
    return this.selection[0] || null;
  }

  updateRallyMarker() {
    if (!this.rallyMarker) return;
    const b = this.selection.length === 1 ? this.selection[0] : null;
    if (!b || b.kind !== 'building' || b.team !== 0 || b.dead) {
      this.rallyMarker.visible = false;
      return;
    }
    this.rallyMarker.visible = true;
    this.rallyMarker.position.set(b.rally.x, 0, b.rally.y);
    this.rallyFlag.material.color.setHex(this.teams[0].color3d);
    this.rallyMarker.children[2].material.color.setHex(this.teams[0].color3d);
    const s = 0.9 + Math.sin(this.time * 3) * 0.06;
    this.rallyFlag.scale.set(s, 1, 1);
    this.rallyFlag.rotation.y = Math.sin(this.time * 2.4) * 0.3;
  }

  // -------------------------------------------------------------------------
  // Damage and death
  // -------------------------------------------------------------------------
  dealDamage(source, target, amount, type = 'physical') {
    if (!target || target.dead || target.kind === 'resource') return 0;
    const magic = type === 'holy' || type === 'shadow' || type === 'lightning';
    const armor = target.armor || 0;
    let dmg = amount - armor * (magic ? 0.35 : 0.7);
    dmg = Math.max(1, dmg);
    target.hp -= dmg;
    target.lastAttacker = source;
    if (target.kind === 'building') target.underAttackT = 4;
    this.effects.hit(target, magic ? 0x9fffe0 : 0xffd18a, magic ? 1.1 : 0.9);
    if (target.kind === 'unit' && target.role !== 'worker' && target.state === 'idle' && source && source.team !== target.team) {
      if (target.distanceToEntity(source) < 14) {
        target.state = 'attack';
        target.target = source;
        target.orderOrigin = { x: target.pos.x, z: target.pos.z };
      }
    }
    if (source && source.team !== undefined && source.team >= 0) {
      const st = this.teams[source.team]?.stats;
      if (st) st.damage = (st.damage || 0) + dmg;
    }
    if (target.hp <= 0) this.killEntity(target, source);
    return dmg;
  }

  killEntity(e, source = null) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    e.removeT = 0;
    if (e.kind === 'unit') {
      this.effects.dust(e.pos.x, e.pos.z, 0xb9a884, 7, 0.5);
      this.effects.burst(e.pos.x, 1.0, e.pos.z, e.team === 0 ? 0x8fb9ff : 0xff8a7a, 6, 1.4);
      this.teams[e.team].stats.lost++;
      if (source && source.team !== undefined && source.team >= 0) this.teams[source.team].stats.killed++;
      if (e.selected) this.setSelection(this.selection.filter(s => s !== e));
      this.recalcSupply();
    } else if (e.kind === 'building') {
      this.effects.dust(e.pos.x, e.pos.z, 0xcabf9e, 20, e.size * 0.8);
      this.effects.burst(e.pos.x, 1.4, e.pos.z, e.team === 0 ? 0x8fb9ff : 0xff8a7a, 18, 2.6);
      this.nav.removeRect(e.pos.x, e.pos.z, e.def.size * 0.86, e.def.size * 0.86);
      this.clearOrderForTarget(e);
      if (e.selected) this.setSelection(this.selection.filter(s => s !== e));
      if (e.team >= 0) {
        this.teams[e.team].stats.lost++;
        if (source && source.team !== undefined && source.team >= 0) this.teams[source.team].stats.killed++;
      }
      this.recalcSupply();
      const teamName = RACES[e.race].name;
      if (!this.teams[e.team]?.isAI) this.notify(`${e.def.name} уничтожен!`, 'danger');
      else this.notify(`Вражеское здание уничтожено: ${e.def.name}`, 'success');
      this.checkVictory(e.team);
    } else if (e.kind === 'resource') {
      this.nav.removeCircle(e.pos.x, e.pos.z, e.navRadius);
      this.effects.dust(e.pos.x, e.pos.z, 0x8a6b3a, 10, 1.2);
    }
  }

  removeEntity(e) {
    const vi = this.selection.indexOf(e);
    if (vi >= 0) {
      this.selection.splice(vi, 1);
      if (this.onSelectionChanged) this.onSelectionChanged(this.selection);
    }
    e.view?.remove();
    const ei = this.entities.indexOf(e);
    if (ei >= 0) this.entities.splice(ei, 1);
    const ui = this.units.indexOf(e);
    if (ui >= 0) this.units.splice(ui, 1);
    const bi = this.buildings.indexOf(e);
    if (bi >= 0) this.buildings.splice(bi, 1);
    const ri = this.resources.indexOf(e);
    if (ri >= 0) this.resources.splice(ri, 1);
  }

  exhaustResource(node) {
    if (node.resourceType === 'lumber') {
      this.killEntity(node, null);
      node.removeT = 99;
      this.removeEntity(node);
    } else {
      node.exhausted = true;
      node.amount = 0;
      if (node.view) node.view.root.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) o.material.emissiveIntensity = 0;
      });
    }
  }

  checkVictory(lostTeam) {
    if (this.over) return;
    const halls = this.buildings.filter(b => b.team === lostTeam && b.role === 'hall' && !b.dead);
    if (halls.length === 0) {
      this.teams[lostTeam].alive = false;
      this.endGame(this.otherTeam(lostTeam));
    }
  }

  endGame(winner) {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    this.effects.clear();
    if (this.onGameOver) this.onGameOver(winner, this.teams, this.time);
  }

  // -------------------------------------------------------------------------
  // Supply and helpers
  // -------------------------------------------------------------------------
  recalcSupply() {
    for (const team of this.teams) {
      let cap = 0;
      let used = 0;
      for (const b of this.buildings) {
        if (b.team === team.id && !b.dead && b.completed && b.def.supply) cap += b.def.supply;
      }
      for (const u of this.units) {
        if (u.team === team.id && !u.dead) used += u.supply;
      }
      team.supplyCap = Math.min(60, cap);
      team.supplyUsed = used;
    }
  }

  getHall(teamId) {
    return this.buildings.find(b => b.team === teamId && !b.dead && b.role === 'hall');
  }

  unitsOf(teamId) {
    return this.units.filter(u => u.team === teamId && !u.dead);
  }

  buildingsOf(teamId) {
    return this.buildings.filter(b => b.team === teamId && !b.dead);
  }

  enemiesNear(teamId, x, z, radius) {
    const out = [];
    for (const u of this.units) {
      if (u.dead || u.team === teamId) continue;
      if (Math.hypot(u.pos.x - x, u.pos.z - z) <= radius) out.push(u);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.world.update(dt);
    if (!this.paused && !this.over) {
      for (const u of [...this.units]) if (!u.dead) updateUnit(this, u, dt);
      for (const b of [...this.buildings]) if (!b.dead) updateBuilding(this, b, dt);
      updateFountain(this, dt);
      this.ai.update(dt);
      this.resolveCollisions(dt);
      this.recalcT -= dt;
      if (this.recalcT <= 0) { this.recalcT = 0.4; this.recalcSupply(); }
      this.updateRallyMarker();
      this.pingT += dt;
    }
    for (const e of this.entities) {
      if (e.view) e.view.update(dt);
    }
    this.effects.update(dt);
    for (const e of [...this.entities]) {
      if (!e.dead) continue;
      e.removeT = (e.removeT || 0) + dt;
      const limit = e.kind === 'building' ? 3.4 : e.kind === 'resource' ? 0.1 : 2.3;
      if (e.removeT >= limit) this.removeEntity(e);
    }
  }

  resolveCollisions(dt) {
    const list = this.units;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        let dx = b.pos.x - a.pos.x;
        let dz = b.pos.z - a.pos.z;
        let d = Math.hypot(dx, dz);
        const min = (a.radius + b.radius) * 0.92;
        if (d >= min || d < 0.0001) continue;
        const push = (min - d) * 0.5;
        dx /= d; dz /= d;
        const ax = a.pos.x - dx * push;
        const az = a.pos.z - dz * push;
        const bx = b.pos.x + dx * push;
        const bz = b.pos.z + dz * push;
        if (!this.nav.isBlockedWorld(ax, az)) { a.pos.x = ax; a.pos.z = az; }
        if (!this.nav.isBlockedWorld(bx, bz)) { b.pos.x = bx; b.pos.z = bz; }
      }
    }
  }
}

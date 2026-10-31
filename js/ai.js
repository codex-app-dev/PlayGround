import { MAP } from './map.js';
import { unitDef, buildingDef } from './data.js';

// A compact macro-oriented AI: it keeps workers busy, maintains supply,
// builds a composition, defends its hall and sends growing attack waves.
export class AIController {
  constructor(game, teamId, difficulty) {
    this.game = game;
    this.teamId = teamId;
    this.diff = difficulty;
    this.timer = 1.5;
    this.lastAttack = -20;
    this.wave = 0;
    this.attackRally = null;
    this.trigger = difficulty.aiArmy;
    this.baseUnderAttack = 0;
    this.notifyDefense = 0;
  }

  update(dt) {
    if (this.game.over) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.diff.aiThink;
    try { this.think(); } catch (err) { console.error('AI error', err); }
  }

  think() {
    const game = this.game;
    const team = game.teams[this.teamId];
    const hall = game.getHall(this.teamId);
    if (!hall) return;
    const workers = game.unitsOf(this.teamId).filter(u => u.role === 'worker');
    const army = game.unitsOf(this.teamId).filter(u => u.role !== 'worker');
    const buildings = game.buildingsOf(this.teamId);

    this.defend(hall, army);

    this.manageWorkers(hall, workers);
    this.manageBuildings(hall, buildings, workers);
    this.manageArmy(buildings, team);
    this.manageAttack(hall, army);
  }

  defend(hall, army) {
    const game = this.game;
    const threats = game.enemiesNear(this.teamId, hall.pos.x, hall.pos.z, 26);
    if (!threats.length) {
      this.baseUnderAttack = 0;
      return;
    }
    this.baseUnderAttack = game.time;
    if (!army.length) return;
    let nearest = threats[0];
    let best = Infinity;
    for (const t of threats) {
      const d = Math.hypot(t.pos.x - hall.pos.x, t.pos.z - hall.pos.z);
      if (d < best) { best = d; nearest = t; }
    }
    // Only re-issue orders occasionally, so defending units can finish fights.
    if (!this.defendTarget || this.defendTarget.dead || this.defendTarget !== nearest) {
      this.defendTarget = nearest;
      game.orderAttack(army, nearest);
    }
  }

  manageWorkers(hall, workers) {
    const game = this.game;
    const team = game.teams[this.teamId];
    const queuedWorkers = hall.queue.filter(q => q.role === 'worker').length;
    if (workers.length + queuedWorkers < this.diff.aiWorkers) {
      const needSupply = team.supplyUsed + game.totalQueuedSupply(this.teamId) + 1 > team.supplyCap;
      if (!needSupply) game.enqueueUnit(hall, 'worker', true);
    }
    const golders = workers.filter(w =>
      w.gatherType === 'gold' && (w.state === 'toResource' || w.state === 'gathering' || w.state === 'toDropoff')).length;
    const lumberers = workers.filter(w =>
      w.gatherType === 'lumber' && (w.state === 'toResource' || w.state === 'gathering' || w.state === 'toDropoff')).length;
    const targetLumber = Math.max(2, Math.round(workers.length * 0.42));
    const targetGold = Math.max(2, workers.length - targetLumber);
    const free = workers.filter(w => w.state === 'idle' || (!w.gatherType && w.state !== 'build'));
    for (const w of free) {
      let type = 'gold';
      if (lumberers < targetLumber) type = 'lumber';
      else if (golders >= targetGold) type = 'lumber';
      const node = game.findNearestResource(team, type, w.pos.x, w.pos.z)
        || game.findNearestResource(team, type === 'gold' ? 'lumber' : 'gold', w.pos.x, w.pos.z);
      if (node) game.assignGather(w, node);
    }
  }

  manageBuildings(hall, buildings, workers) {
    const game = this.game;
    const team = game.teams[this.teamId];
    const count = (role) => buildings.filter(b => b.role === role).length;
    const constructing = buildings.filter(b => !b.completed);
    const farms = count('farm');
    const barracks = count('barracks');
    const special = count('special');
    const towers = count('tower');
    const desiredFarms = Math.min(7, 2 + Math.floor(game.time / 150));
    const supplyGap = team.supplyCap - team.supplyUsed - game.totalQueuedSupply(this.teamId);

    let role = null;
    if (barracks === 0) role = 'barracks';
    else if (supplyGap <= 7 && farms < desiredFarms) role = 'farm';
    else if (farms < 1) role = 'farm';
    else if (special === 0 && game.time > 105) role = 'special';
    else if (towers < 1 && game.time > 130) role = 'tower';
    else if (farms < desiredFarms && supplyGap <= 14) role = 'farm';
    else if (towers < 2 && game.time > 260 && count('barracks') > 0) role = 'tower';
    else if (farms < desiredFarms - 1 && game.time > 320) role = 'farm';
    if (!role) return;
    if (constructing.length >= (role === 'farm' ? 2 : 1)) return;

    const def = buildingDef(team.race, role);
    if (!def) return;
    if (!game.canAfford(team, def.cost)) return;
    const spot = game.findBuildSpot(team, def.size, 6.2, 14.5);
    if (!spot) return;
    // Keep one spare worker near the hall for construction.
    const builder = workers
      .filter(w => w.state !== 'build')
      .sort((a, b) => {
        const da = Math.hypot(a.pos.x - hall.pos.x, a.pos.z - hall.pos.z);
        const db = Math.hypot(b.pos.x - hall.pos.x, b.pos.z - hall.pos.z);
        return da - db;
      })[0];
    if (!builder) return;
    game.startBuilding(team, role, spot.x, spot.z, builder);
  }

  manageArmy(buildings, team) {
    const game = this.game;
    const prod = buildings.filter(b => b.completed && b.def.trains && b.def.trains.some(r => r !== 'worker'));
    for (const b of prod) {
      if (b.queue.length >= 2) continue;
      let role;
      if (b.role === 'special') {
        role = (this.wave + b.queue.length) % 2 === 0 ? 'heavy' : 'caster';
      } else {
        const r = Math.random();
        role = r < 0.58 ? 'melee' : 'ranged';
      }
      const def = unitDef(team.race, role);
      if (team.gold < (def.cost.gold || 0) + 25) continue;
      if (team.lumber < (def.cost.lumber || 0)) continue;
      if (team.supplyUsed + game.totalQueuedSupply(this.teamId) + def.supply > team.supplyCap) continue;
      game.enqueueUnit(b, role, true);
    }
  }

  manageAttack(hall, army) {
    const game = this.game;
    if (this.defendTarget && !this.defendTarget.dead && game.time - this.baseUnderAttack < 8) return;
    if (army.length < this.trigger) return;
    if (game.time - this.lastAttack < this.diff.aiAttackDelay) return;
    const playerHall = game.getHall(0);
    const target = playerHall || game.buildingsOf(0)[0];
    if (!target) return;
    const combat = army.filter(u => u.role !== 'worker');
    if (!combat.length) return;
    this.lastAttack = game.time;
    this.wave++;
    this.trigger = this.diff.aiArmy + Math.min(8, this.wave * 2);
    game.orderMove(combat, { x: target.pos.x, z: target.pos.z }, { attackMove: true });
    // New units gather at the front, then follow the wave.
    const p = { x: target.pos.x, z: target.pos.z };
    for (const b of game.buildingsOf(this.teamId)) {
      if (b.role === 'barracks' || b.role === 'special') {
        b.rally.set(p.x, p.z);
        b.rallyResource = null;
      }
    }
    game.notify(`${game.teams[this.teamId].race === 'orc' ? 'Орда' : game.teams[this.teamId].race === 'undead' ? 'Плеть' : 'Альянс'} начинает наступление!`, 'danger');
  }
}

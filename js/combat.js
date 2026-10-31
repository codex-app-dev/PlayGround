import { unitDef } from './data.js';

function findEnemy(game, unit, radius) {
  let best = null;
  let bestD = radius;
  for (const e of game.entities) {
    if (e.dead || e.kind === 'resource' || e.team === unit.team || e.team < 0) continue;
    const d = Math.hypot(e.pos.x - unit.pos.x, e.pos.z - unit.pos.z) - e.radius * 0.5;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function inAttackRange(unit, target) {
  const d = Math.hypot(target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
  return d <= unit.range + target.radius + 0.25;
}

function tryAttack(game, unit, target) {
  if (!target || target.dead) return;
  unit.faceTo(target.pos.x, target.pos.z);
  unit.moving = false;
  if (!inAttackRange(unit, target)) return;
  if (unit.cooldown > 0) return;
  unit.cooldown = unit.attackSpeed;
  unit.attackAnim = 0.32;
  if (unit.projectile) {
    game.effects.projectile(unit, target, unit.projectile, unit.damage);
  } else {
    game.dealDamage(unit, target, unit.damage, 'physical');
  }
}

function chase(game, unit, target, dt) {
  unit.repath -= dt;
  const dist = Math.hypot(target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
  if (unit.repath <= 0 || unit.path.length === 0) {
    unit.repath = 0.65 + Math.random() * 0.35;
    const spot = game.targetApproach(unit, target);
    unit.path = [];
    unit.setPathTo(spot.x, spot.z);
  }
  unit.moveAlongPath(dt);
}

function handleIdle(game, unit, dt) {
  unit.moving = false;
  unit.working = false;
  if (unit.role === 'worker') return;
  unit.think -= dt;
  if (unit.think <= 0) {
    unit.think = 0.4 + Math.random() * 0.3;
    const target = findEnemy(game, unit, 8.2);
    if (target) {
      unit.state = 'attack';
      unit.target = target;
      unit.autoAcquired = true;
      unit.orderOrigin = { x: unit.pos.x, z: unit.pos.z };
      unit.repath = 0;
    }
  }
}

function handleAttack(game, unit, dt) {
  const target = unit.target;
  if (!target || target.dead) {
    unit.target = null;
    if (unit.attackMoveDest) {
      unit.state = 'attackMove';
      unit.repath = 0;
    } else {
      unit.state = 'idle';
    }
    return;
  }
  if (unit.autoAcquired && unit.orderOrigin) {
    const d = Math.hypot(unit.pos.x - unit.orderOrigin.x, unit.pos.z - unit.orderOrigin.z);
    if (d > 17) {
      unit.target = null;
      unit.state = 'idle';
      return;
    }
  }
  if (inAttackRange(unit, target)) {
    unit.moving = false;
    unit.path = [];
    tryAttack(game, unit, target);
  } else {
    chase(game, unit, target, dt);
  }
}

function handleAttackMove(game, unit, dt) {
  unit.think -= dt;
  if (unit.target && unit.target.dead) unit.target = null;
  if (!unit.target && unit.think <= 0) {
    unit.think = 0.45;
    const target = findEnemy(game, unit, 9.2);
    if (target) {
      unit.target = target;
      unit.autoAcquired = false;
      unit.repath = 0;
    }
  }
  if (unit.target) {
    handleAttack(game, unit, dt);
    return;
  }
  const dest = unit.attackMoveDest;
  if (!dest) { unit.state = 'idle'; return; }
  if (unit.path.length === 0) {
    const d = Math.hypot(unit.pos.x - dest.x, unit.pos.z - dest.z);
    if (d < 2.4) {
      unit.state = 'idle';
      unit.attackMoveDest = null;
      unit.moving = false;
      const target = findEnemy(game, unit, 9.5);
      if (target) {
        unit.state = 'attack';
        unit.target = target;
        unit.autoAcquired = true;
        unit.orderOrigin = { x: unit.pos.x, z: unit.pos.z };
      }
      return;
    }
    unit.setPathTo(dest.x, dest.z);
  }
  unit.moveAlongPath(dt);
}

function handleMove(unit, dt) {
  if (unit.path.length === 0) {
    unit.state = 'idle';
    unit.moving = false;
    return;
  }
  unit.moveAlongPath(dt);
}

function dropCarry(game, unit) {
  const team = game.teams[unit.team];
  if (!unit.carry) return;
  if (unit.carryType === 'gold') {
    team.gold += unit.carry;
    team.stats.goldGathered += unit.carry;
    game.floatText({ x: unit.pos.x, z: unit.pos.z, y: 2.1 }, `+${unit.carry}`, '#ffd166');
  } else {
    team.lumber += unit.carry;
    team.stats.lumberGathered += unit.carry;
    game.floatText({ x: unit.pos.x, z: unit.pos.z, y: 2.1 }, `+${unit.carry}`, '#b6e07a');
  }
  unit.carry = 0;
  unit.carryType = null;
}

function handleGather(game, unit, dt) {
  if (unit.state === 'toResource') {
    let node = unit.gatherNode;
    if (!node || node.dead || node.amount <= 0) {
      node = game.findNearestResource(game.teams[unit.team], unit.gatherType || 'gold', unit.pos.x, unit.pos.z);
      if (!node) { unit.state = 'idle'; return; }
      unit.gatherNode = node;
      unit.gatherType = node.resourceType;
      const spot = unit.gatherSpot(node);
      unit.dest = spot;
      unit.setPathTo(spot.x, spot.z);
      return;
    }
    const d = unit.distanceToEntity(node);
    if (d <= node.radius + 1.55) {
      unit.state = 'gathering';
      unit.workT = 0;
      unit.moving = false;
      unit.working = true;
      unit.path = [];
      return;
    }
    if (unit.moveAlongPath(dt) || unit.path.length === 0) {
      const spot = unit.gatherSpot(node);
      unit.setPathTo(spot.x, spot.z);
    }
    return;
  }
  if (unit.state === 'gathering') {
    const node = unit.gatherNode;
    unit.moving = false;
    unit.working = true;
    if (!node || node.dead || node.amount <= 0) {
      node && game.exhaustResource(node);
      unit.gatherNode = null;
      unit.state = 'idle';
      return;
    }
    unit.faceTo(node.pos.x, node.pos.z);
    unit.workT = (unit.workT || 0) + dt;
    unit.gatherFx = (unit.gatherFx || 0) + dt;
    if (unit.gatherFx > 0.55) {
      unit.gatherFx = 0;
      game.effects.dust(node.pos.x, node.pos.z, node.resourceType === 'gold' ? 0xffd166 : 0x9c6d3e, 2, 0.7);
    }
    if (unit.workT >= (node.resourceType === 'gold' ? 2.1 : 2.35)) {
      unit.workT = 0;
      const take = Math.min(12, node.amount);
      node.amount -= take;
      unit.carry = take;
      unit.carryType = node.resourceType;
      if (node.amount <= 0) game.exhaustResource(node);
      const hall = game.findNearestDropoff(game.teams[unit.team], unit.pos.x, unit.pos.z);
      if (!hall) {
        unit.state = 'idle';
        unit.working = false;
        return;
      }
      unit.state = 'toDropoff';
      unit.dropoff = hall;
      unit.working = false;
      const spot = unit.dropoffSpot(hall);
      unit.dest = spot;
      unit.setPathTo(spot.x, spot.z);
    }
    return;
  }
  if (unit.state === 'toDropoff') {
    let hall = unit.dropoff;
    if (!hall || hall.dead) {
      hall = game.findNearestDropoff(game.teams[unit.team], unit.pos.x, unit.pos.z);
      if (!hall) { unit.state = 'idle'; return; }
      unit.dropoff = hall;
      const spot = unit.dropoffSpot(hall);
      unit.dest = spot;
      unit.setPathTo(spot.x, spot.z);
    }
    const d = unit.distanceToEntity(hall);
    if (d <= hall.size * 0.9 + 2.1) {
      dropCarry(game, unit);
      game.effects.ring(hall.pos.x, hall.pos.z, 0xffe19a, hall.size * 0.9, 0.4, 0.5);
      unit.state = 'toResource';
      let node = unit.gatherNode;
      if (!node || node.dead || node.amount <= 0) {
        node = game.findNearestResource(game.teams[unit.team], unit.gatherType || 'gold', unit.pos.x, unit.pos.z);
        unit.gatherNode = node;
      }
      if (node) {
        unit.gatherType = node.resourceType;
        const spot = unit.gatherSpot(node);
        unit.dest = spot;
        unit.setPathTo(spot.x, spot.z);
      } else {
        unit.state = 'idle';
      }
      return;
    }
    if (unit.moveAlongPath(dt) || unit.path.length === 0) {
      const spot = unit.dropoffSpot(hall);
      unit.setPathTo(spot.x, spot.z);
    }
    return;
  }
}

function handleBuild(game, unit, dt) {
  const b = unit.buildTarget;
  if (!b || b.dead || b.completed) {
    unit.buildTarget = null;
    unit.state = 'idle';
    unit.working = false;
    return;
  }
  const d = unit.distanceToEntity(b);
  if (d > b.size * 0.9 + 2.0) {
    unit.working = false;
    if (unit.moveAlongPath(dt) || unit.path.length === 0) {
      const spot = unit.dropoffSpot(b);
      unit.setPathTo(spot.x, spot.z);
    }
  } else {
    unit.moving = false;
    unit.working = true;
    unit.path = [];
    unit.faceTo(b.pos.x, b.pos.z);
    unit.buildFx = (unit.buildFx || 0) + dt;
    if (unit.buildFx > 0.8) {
      unit.buildFx = 0;
      game.effects.dust(b.pos.x + (Math.random() - 0.5) * b.size, b.pos.z + (Math.random() - 0.5) * b.size, 0xcabf9e, 2, 0.7);
    }
  }
}

function healAllies(game, unit, dt) {
  if (!unit.heal) return;
  unit.healTimer -= dt;
  if (unit.healTimer > 0) return;
  let best = null;
  let bestRatio = 0.86;
  for (const e of game.units) {
    if (e.dead || e.team !== unit.team) continue;
    const d = unit.distanceToEntity(e);
    if (d > unit.healRange) continue;
    const ratio = e.hp / e.maxHp;
    if (ratio < bestRatio) { bestRatio = ratio; best = e; }
  }
  if (best) {
    best.hp = Math.min(best.maxHp, best.hp + unit.heal);
    unit.healTimer = unit.healCooldown;
    game.effects.heal(best);
  } else {
    unit.healTimer = 0.8;
  }
}

export function updateUnit(game, unit, dt) {
  if (unit.dead) return;
  unit.cooldown = Math.max(0, unit.cooldown - dt);
  unit.attackAnim = Math.max(0, unit.attackAnim - dt);
  healAllies(game, unit, dt);

  switch (unit.state) {
    case 'move': handleMove(unit, dt); break;
    case 'attack': handleAttack(game, unit, dt); break;
    case 'attackMove': handleAttackMove(game, unit, dt); break;
    case 'toResource':
    case 'gathering':
    case 'toDropoff': handleGather(game, unit, dt); break;
    case 'build': handleBuild(game, unit, dt); break;
    default: handleIdle(game, unit, dt); break;
  }
}

export function updateBuilding(game, building, dt) {
  if (building.dead) return;
  if (building.underAttackT > 0) building.underAttackT -= dt;
  if (building.construction < 1) {
    let builders = 0;
    for (const u of game.units) {
      if (u.dead || u.team !== building.team || u.role !== 'worker' || u.buildTarget !== building) continue;
      if (u.distanceToEntity(building) <= building.size * 0.9 + 2.3) builders++;
    }
    building.builderCount = builders;
    if (builders > 0) {
      const rate = (1 / building.def.build) * (1 + (builders - 1) * 0.55);
      building.construction = Math.min(1, building.construction + rate * dt);
      building.hp = Math.max(building.hp, building.maxHp * (0.18 + 0.82 * building.construction));
      if (building.construction >= 1) game.completeBuilding(building);
    }
    return;
  }
  if (building.def.trains && building.queue.length) {
    const q = building.queue[0];
    q.time = Math.min(q.total, q.time + dt);
    if (q.time >= q.total) {
      game.spawnFromBuilding(building);
    }
  }
  if (building.def.attack) {
    building.think -= dt;
    if (building.think <= 0) {
      building.think = 0.3;
      let best = null;
      let bestD = building.def.attack.range + 1;
      for (const e of game.entities) {
        if (e.dead || e.kind === 'resource' || e.team === building.team || e.team < 0) continue;
        const d = Math.hypot(e.pos.x - building.pos.x, e.pos.z - building.pos.z) - e.radius * 0.4;
        if (d < bestD) { bestD = d; best = e; }
      }
      building.target = best;
    }
    if (building.target && building.target.dead) building.target = null;
    if (building.target) {
      const t = building.target;
      building.faceTo(t.pos.x, t.pos.z);
      building.cooldown = Math.max(0, building.cooldown - dt);
      if (building.cooldown <= 0) {
        const dist = Math.hypot(t.pos.x - building.pos.x, t.pos.z - building.pos.z);
        if (dist <= building.def.attack.range + t.radius) {
          building.cooldown = building.def.attack.cooldown;
          if (building.def.attack.projectile) game.effects.projectile(building, t, building.def.attack.projectile, building.def.attack.damage);
          else game.dealDamage(building, t, building.def.attack.damage);
        }
      }
    }
  }
}

export function updateFountain(game, dt) {
  const fountain = game.resources.find(r => r.resourceType === 'fountain');
  if (!fountain) return;
  game.fountainFx = (game.fountainFx || 0) + dt;
  const doFx = game.fountainFx > 1.4;
  if (doFx) game.fountainFx = 0;
  for (const u of game.units) {
    if (u.dead) continue;
    const d = Math.hypot(u.pos.x - fountain.pos.x, u.pos.z - fountain.pos.z);
    if (d <= fountain.radius + 3.0 && u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + 5.5 * dt);
      if (doFx) game.effects.heal(u, 0x8ff5e0);
    }
  }
}

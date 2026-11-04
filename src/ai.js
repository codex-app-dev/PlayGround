import * as THREE from 'three';
import { ARENA } from './arena.js';

const DIFF = {
  rookie: { reaction: 0.3, error: 5.5, boostChance: 0.24, lead: 0.24, jump: 0.55, maxThrottle: 0.82 },
  pro: { reaction: 0.13, error: 2.4, boostChance: 0.58, lead: 0.4, jump: 0.78, maxThrottle: 0.96 },
  allstar: { reaction: 0.055, error: 0.85, boostChance: 0.85, lead: 0.52, jump: 0.94, maxThrottle: 1 },
};

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class AIController {
  constructor(car, { team, difficulty = 'pro', slot = 0 } = {}) {
    this.car = car;
    this.team = team;
    this.diff = DIFF[difficulty] || DIFF.pro;
    this.slot = slot;
    this.attackDir = team === 'blue' ? 1 : -1;
    this.ownGoal = new THREE.Vector3(team === 'blue' ? -ARENA.halfLength : ARENA.halfLength, 0, 0);
    this.atkGoal = new THREE.Vector3(team === 'blue' ? ARENA.halfLength : -ARENA.halfLength, 0, 0);
    this.target = new THREE.Vector3(0, 0, 0);
    this.thinkTimer = Math.random() * this.diff.reaction;
    this.jumpQueued = false;
    this.noiseSeed = Math.random() * 100;
    this.boostHeld = false;
    this.boostHoldTime = 0;
    this.padTarget = null;
    this.role = slot === 0 ? 'attack' : 'support';
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.predicted = new THREE.Vector3();
    this.revTimer = 0;
  }

  reset() {
    this.thinkTimer = 0;
    this.jumpQueued = false;
    this.boostHeld = false;
    this.padTarget = null;
    this.stuckTimer = 0;
    this.role = this.slot === 0 ? 'attack' : 'support';
  }

  predictBall(ball, lead = 0.2) {
    const p = this.predicted.copy(ball.position);
    const t = Math.min(1.15, lead);
    p.addScaledVector(ball.velocity, t * 0.78);
    // account for gravity if the ball is airborne
    if (ball.position.y > ARENA.ballRadius + 0.4) {
      p.y += ball.velocity.y * t - 0.5 * 29 * t * t;
      p.y = Math.max(ARENA.ballRadius, p.y);
    }
    p.x = THREE.MathUtils.clamp(p.x, -ARENA.halfLength + 3, ARENA.halfLength - 3);
    p.z = THREE.MathUtils.clamp(p.z, -ARENA.halfWidth + 3, ARENA.halfWidth - 3);
    return p;
  }

  update(dt, world) {
    const car = this.car;
    this.thinkTimer -= dt;
    this.boostHoldTime = Math.max(0, this.boostHoldTime - dt);
    this.revTimer = Math.max(0, this.revTimer - dt);

    const ball = world.ball;
    const teamCars = world.cars.filter(c => c.team === this.team);
    const distToBall = car.position.distanceTo(ball.position);

    // work out whether this AI should attack or hang back
    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.diff.reaction * (0.75 + Math.random() * 0.5);
      const distances = teamCars.map(c => ({ car: c, d: c.position.distanceTo(ball.position) }));
      distances.sort((a, b) => a.d - b.d);
      const myRank = distances.findIndex(o => o.car === car);
      const ballInOwnThird = this.attackDir > 0
        ? ball.position.x < -18
        : ball.position.x > 18;
      const teammateCloser = myRank > 0 && distances[0].d < distToBall - 6;

      if (ballInOwnThird) this.role = 'defend';
      else if (myRank === 0) this.role = 'attack';
      else this.role = teammateCloser ? 'support' : 'attack';

      // choose a boost pad when low and not needed in the play
      if (car.boost < 22 && this.role !== 'attack' && world.pads) {
        let best = null, bestD = 1e9;
        for (const pad of world.pads) {
          if (!pad.active) continue;
          const d = Math.hypot(pad.x - car.position.x, pad.z - car.position.z);
          if (d < bestD && d < 38) { bestD = d; best = pad; }
        }
        if (best && Math.random() < 0.8) this.padTarget = best;
      }
      if (this.padTarget && (!this.padTarget.active || car.boost > 68)) this.padTarget = null;
    }

    const leadT = this.diff.lead * (0.4 + Math.min(1, distToBall / 55));
    const projected = this.predictBall(ball, leadT);

    let tx, tz;
    const goalDir = new THREE.Vector3().subVectors(this.atkGoal, projected).setY(0).normalize();
    const behindDist = 6.3 + Math.min(4, Math.abs(ball.velocity.x) * 0.18);
    const behind = projected.clone().addScaledVector(goalDir, -behindDist);

    if (this.role === 'attack') {
      // line up behind the ball, with a lateral bias to avoid perfect straight lines
      const sideBias = Math.sin(performance.now() * 0.0007 + this.noiseSeed) * 1.8;
      behind.z += sideBias;
      tx = behind.x;
      tz = behind.z;

      // if the ball is high and landing far ahead, meet it at the landing spot
      if (ball.position.y > 5.2 && ball.velocity.y < 1) {
        const vy = ball.velocity.y;
        const dy = ball.position.y - ARENA.ballRadius;
        const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * 29 * dy))) / 29;
        if (t < 2.2) {
          tx = ball.position.x + ball.velocity.x * t;
          tz = ball.position.z + ball.velocity.z * t;
          tx = THREE.MathUtils.clamp(tx, -ARENA.halfLength + 4, ARENA.halfLength - 4);
          tz = THREE.MathUtils.clamp(tz, -ARENA.halfWidth + 4, ARENA.halfWidth - 4);
        }
      }
    } else if (this.role === 'defend') {
      // guard the goal: sit on the line between the ball and the net
      const toBall = projected.clone().sub(this.ownGoal).setY(0);
      const d = toBall.length();
      toBall.normalize();
      const depth = Math.min(22, Math.max(8, d * 0.42));
      tx = this.ownGoal.x + toBall.x * depth;
      tz = this.ownGoal.z + toBall.z * depth;
      // near-post shading
      tz += Math.sign(ball.position.z || 1) * 1.2;
    } else {
      // support: stay behind the attacker, ready for a pass or rebound
      tx = behind.x - this.attackDir * 10;
      tz = behind.z + (this.slot % 2 === 0 ? -9 : 9);
    }

    if (this.padTarget) {
      tx = this.padTarget.x;
      tz = this.padTarget.z;
    }

    // add human-like error
    const wobble = performance.now() * 0.0011 + this.noiseSeed;
    tx += Math.sin(wobble * 1.7) * this.diff.error * 0.7;
    tz += Math.cos(wobble * 1.3) * this.diff.error * 0.7;
    tx = THREE.MathUtils.clamp(tx, -ARENA.halfLength + 4, ARENA.halfLength - 4);
    tz = THREE.MathUtils.clamp(tz, -ARENA.halfWidth + 4, ARENA.halfWidth - 4);
    this.target.set(tx, 0, tz);

    const dx = tx - car.position.x;
    const dz = tz - car.position.z;
    const dist = Math.hypot(dx, dz);
    let desiredYaw = Math.atan2(dz, dx);
    let diff = angleDiff(desiredYaw, car.yaw);

    // reverse out of a wall / stuck spot
    const nearWall = Math.abs(car.position.z) > ARENA.halfWidth - 4 || Math.abs(car.position.x) > ARENA.halfLength - 5;
    if (Math.abs(car.speed) < 2.4 && dist > 7) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    if (this.stuckTimer > 0.75) {
      this.revTimer = 0.65;
      this.stuckTimer = 0;
    }

    let throttle = 1;
    if (Math.abs(diff) > 1.15) throttle = 0.35;
    else if (Math.abs(diff) > 0.55) throttle = 0.7;
    if (dist < 2.2) throttle = 0.15;
    if (this.revTimer > 0) { throttle = -0.7; diff = -diff; }
    throttle *= this.diff.maxThrottle;

    let steer = THREE.MathUtils.clamp(diff * 2.1, -1, 1);
    if (this.revTimer > 0) steer = THREE.MathUtils.clamp(-diff * 2.1, -1, 1);

    // boost management
    const aligned = Math.abs(diff) < 0.22;
    const wantBoost =
      aligned &&
      car.boost > 6 &&
      throttle > 0.5 &&
      (dist > 16 || (this.role === 'attack' && distToBall < 16)) &&
      Math.random() < this.diff.boostChance * dt * 9;
    if (wantBoost) this.boostHoldTime = 0.14 + Math.random() * 0.2;
    let boost = this.boostHoldTime > 0 && car.boost > 1;
    if (!car.grounded && car.boost > 12 && this.role === 'attack' && distToBall < 10) boost = true;

    // jumping at the ball
    this.jumpQueued = false;
    const ballAbove = ball.position.y > 2.8;
    const canReach = distToBall < 8.5;
    if (car.grounded && ballAbove && canReach && Math.random() < this.diff.jump * dt * 6.5) {
      this.jumpQueued = true;
    }
    if (car.grounded && Math.abs(diff) < 0.4 && distToBall < 3.2 && ball.position.y > 4.2) {
      this.jumpQueued = true;
    }
    // double jump toward a high ball
    if (!car.grounded && car.jumps === 1 && car.velocity.y < 2.5 && distToBall < 9 && ball.position.y > car.position.y + 2.2 && Math.random() < this.diff.jump * dt * 4.5) {
      this.jumpQueued = true;
    }

    // air attitude: point roughly at the ball while airborne
    if (!car.grounded) {
      const dy = ball.position.y - car.position.y;
      throttle = THREE.MathUtils.clamp(-dy * 0.08, -1, 1);
      steer = THREE.MathUtils.clamp(diff * 1.5, -1, 1) * 0.7;
      boost = car.boost > 8 && dy > -1;
    }

    if (car.stun > 0) { throttle = 0; steer = 0; boost = false; }

    return {
      throttle,
      steer,
      jump: this.jumpQueued || (!car.grounded && car.jumps === 0),
      jumpPressed: this.jumpQueued,
      boost,
      roll: 0,
      drift: false,
    };
  }

  idle() {
    return { throttle: 0, steer: 0, jump: false, jumpPressed: false, boost: false, roll: 0 };
  }
}

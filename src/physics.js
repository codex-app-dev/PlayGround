// Soft-body physics: XPBD particle/beam lattice with plastic deformation,
// ground/box/cylinder/ramp contacts, plus a raycast-style tire model.
export const GRAVITY = -9.81;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class SoftBody {
  constructor(name = 'body') {
    this.name = name;
    this.nodes = [];
    this.beams = [];
    this.mass = 0;
    this.restitution = 0.02;
  }

  addNode(x, y, z, mass, tag = 0) {
    const n = {
      x, y, z, px: x, py: y, pz: z,
      vx: 0, vy: 0, vz: 0,
      fx: 0, fy: 0, fz: 0,
      invMass: mass > 0 ? 1 / mass : 0,
      mass, tag,
      grounded: 0, contact: 0,
    };
    this.nodes.push(n);
    this.mass += mass;
    return this.nodes.length - 1;
  }

  addBeam(a, b, opts = {}) {
    const A = this.nodes[a], B = this.nodes[b];
    const rest = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
    if (rest < 1e-5) return;
    const beam = {
      a, b, rest, rest0: rest,
      compliance: opts.compliance ?? 3.2e-8,
      yield: opts.yield ?? 0.030,
      maxStrain: opts.maxStrain ?? 0.55,
      plastic: 0,        // accumulated plastic strain (damage)
      broken: false,
      lambda: 0,
      group: opts.group ?? 0,
      mu: 1,
    };
    this.beams.push(beam);
    return beam;
  }

  aabb() {
    let minx = 1e9, miny = 1e9, minz = 1e9, maxx = -1e9, maxy = -1e9, maxz = -1e9;
    for (const n of this.nodes) {
      if (n.x < minx) minx = n.x; if (n.x > maxx) maxx = n.x;
      if (n.y < miny) miny = n.y; if (n.y > maxy) maxy = n.y;
      if (n.z < minz) minz = n.z; if (n.z > maxz) maxz = n.z;
    }
    return { minx, miny, minz, maxx, maxy, maxz };
  }

  center() {
    let cx = 0, cy = 0, cz = 0, m = 0;
    for (const n of this.nodes) { cx += n.x * n.mass; cy += n.y * n.mass; cz += n.z * n.mass; m += n.mass; }
    return { x: cx / m, y: cy / m, z: cz / m };
  }

  velocity() {
    let vx = 0, vy = 0, vz = 0, m = 0;
    for (const n of this.nodes) { vx += n.vx * n.mass; vy += n.vy * n.mass; vz += n.vz * n.mass; m += n.mass; }
    return { x: vx / m, y: vy / m, z: vz / m, speed: Math.hypot(vx / m, vy / m, vz / m) };
  }

  damage() {
    let dmg = 0, weight = 0, broken = 0;
    for (const beam of this.beams) {
      const w = beam.rest;
      weight += w;
      dmg += Math.min(1, beam.plastic / 0.22) * w;
      if (beam.broken) broken++;
    }
    return { body: weight ? dmg / weight : 0, broken };
  }

  translate(dx, dy, dz) {
    for (const n of this.nodes) {
      n.x += dx; n.y += dy; n.z += dz;
      n.px = n.x; n.py = n.y; n.pz = n.z;
      n.vx = n.vy = n.vz = 0;
    }
    for (const b of this.beams) b.lambda = 0;
  }

  resetVelocities() { for (const n of this.nodes) { n.vx = n.vy = n.vz = 0; } }
}

// ---------------------------------------------------------------------------
// Static collision shapes
// ---------------------------------------------------------------------------
export class ColliderWorld {
  constructor(ground) {
    this.ground = ground;
    this.boxes = [];
    this.cylinders = [];
    this.ramps = [];
    this.spheres = [];
    this.events = [];     // {x,y,z,impact,speed,kind}
    this.tmpEvents = [];
  }

  addBox(cx, cy, cz, hx, hy, hz, yaw = 0, opts = {}) {
    const c = { t: 'box', x: cx, y: cy, z: cz, hx, hy, hz, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), mu: opts.mu ?? 0.55, soft: opts.soft ?? 0, name: opts.name || 'solid' };
    this.boxes.push(c);
    return c;
  }

  addCylinder(x, z, r, y0, y1, opts = {}) {
    const c = { t: 'cyl', x, z, r, y0, y1, mu: opts.mu ?? 0.5, name: opts.name || 'pole' };
    this.cylinders.push(c);
    return c;
  }

  addRamp(x, z, width, length, height, yaw, opts = {}) {
    const c = { t: 'ramp', x, z, w: width, l: length, h: height, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), mu: opts.mu ?? 0.7, angle: Math.atan2(height, length) };
    this.ramps.push(c);
    return c;
  }

  addSphere(x, y, z, r, opts = {}) {
    const c = { t: 'sph', x, y, z, r, mu: opts.mu ?? 0.6, name: opts.name || 'rock' };
    this.spheres.push(c);
    return c;
  }

  // local -> world for yawed colliders
  toLocal(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    return { u: dx * c.cos + dz * c.sin, v: -dx * c.sin + dz * c.cos, dx, dz };
  }

  // height of any hard surface at (x,z) (ground only, used for wheel rays)
  surfaceHeight(x, z, below = 1e9) {
    let h = this.ground.height(x, z);
    for (const c of this.boxes) {
      if (c.soft) continue;
      const { u, v } = this.toLocal(c, x, z);
      if (Math.abs(u) <= c.hx && Math.abs(v) <= c.hz) {
        const top = c.y + c.hy;
        if (top <= below && top > h) h = top;
      }
    }
    for (const c of this.ramps) {
      const { u, v } = this.toLocal(c, x, z);
      const hw = c.w / 2;
      if (Math.abs(v) <= hw) {
        const along = u + c.l / 2;
        if (along >= 0 && along <= c.l) {
          const top = c.h * (along / c.l) + this.ground.height(x, z);
          if (top <= below && top > h) h = top;
        }
      }
    }
    return h;
  }

  surfaceNormal(x, z, out) {
    // prefer ramp plane normal
    for (const c of this.ramps) {
      const { u, v } = this.toLocal(c, x, z);
      if (Math.abs(v) <= c.w / 2 && u + c.l / 2 >= 0 && u + c.l / 2 <= c.l) {
        out.x = -Math.sin(c.yaw) * Math.sin(c.angle);
        out.y = Math.cos(c.angle);
        out.z = -Math.cos(c.yaw) * Math.sin(c.angle);
        return out;
      }
    }
    return this.ground.normal(x, z, out);
  }

  // Push a particle out of static shapes. Position based, with Coulomb friction.
  resolveNode(n, h) {
    let bestImpact = 0;
    // ground
    const gh = this.ground.height(n.x, n.z);
    if (n.y < gh) {
      const nrm = this.ground.normal(n.x, n.z, _nrm);
      const pen = (gh - n.y) * Math.max(0.2, nrm.y);
      bestImpact = Math.max(bestImpact, this._pushOut(n, nrm, pen, 0.72));
      n.grounded = 1;
    }
    // boxes
    for (const c of this.boxes) {
      const { u, v } = this.toLocal(c, n.x, n.z);
      if (Math.abs(u) > c.hx || Math.abs(v) > c.hz) continue;
      const dy = n.y - c.y;
      if (Math.abs(dy) > c.hy) continue;
      const pu = c.hx - Math.abs(u), pv = c.hz - Math.abs(v), py = c.hy - Math.abs(dy);
      let nx = 0, ny = 0, nz = 0, pen = py;
      if (pu < pen) { pen = pu; nx = Math.sign(u) * c.cos; nz = -Math.sign(u) * c.sin; ny = 0; }
      if (pv < pen) { pen = pv; nx = Math.sign(v) * c.sin; nz = Math.sign(v) * c.cos; ny = 0; }
      if (ny !== 0) { ny = Math.sign(dy); nx = nz = 0; }
      _nrm.x = nx; _nrm.y = ny; _nrm.z = nz;
      bestImpact = Math.max(bestImpact, this._pushOut(n, _nrm, pen, c.mu));
      n.contact = 1;
    }
    // cylinders
    for (const c of this.cylinders) {
      if (n.y > c.y1 || n.y < c.y0 - 0.05) continue;
      const dx = n.x - c.x, dz = n.z - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > c.r * c.r) continue;
      const d = Math.sqrt(d2) || 1e-6;
      _nrm.x = dx / d; _nrm.y = 0; _nrm.z = dz / d;
      bestImpact = Math.max(bestImpact, this._pushOut(n, _nrm, c.r - d, c.mu));
      n.contact = 1;
    }
    // spheres
    for (const c of this.spheres) {
      const dx = n.x - c.x, dy = n.y - c.y, dz = n.z - c.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > c.r * c.r) continue;
      const d = Math.sqrt(d2) || 1e-6;
      _nrm.x = dx / d; _nrm.y = dy / d; _nrm.z = dz / d;
      bestImpact = Math.max(bestImpact, this._pushOut(n, _nrm, c.r - d, c.mu));
      n.contact = 1;
    }
    // ramps (wedge height field)
    for (const c of this.ramps) {
      const { u, v } = this.toLocal(c, n.x, n.z);
      if (Math.abs(v) > c.w / 2) continue;
      const along = u + c.l / 2;
      if (along < 0 || along > c.l) continue;
      const surf = this.ground.height(n.x, n.z) + c.h * (along / c.l);
      if (n.y >= surf) continue;
      const pen = (surf - n.y) * 0.98;
      this.surfaceNormal(n.x, n.z, _nrm);
      bestImpact = Math.max(bestImpact, this._pushOut(n, _nrm, pen, c.mu));
      n.contact = 1;
    }
    return bestImpact;
  }

  _pushOut(n, nrm, pen, mu) {
    const speedIn = -(n.vx * nrm.x + n.vy * nrm.y + n.vz * nrm.z);
    n.x += nrm.x * (pen + 0.0004);
    n.y += nrm.y * (pen + 0.0004);
    n.z += nrm.z * (pen + 0.0004);
    this._tangentDamp(n, nrm, pen, mu);
    return speedIn;
  }

  _tangentDamp(n, nrm, pen, mu) {
    let dx = n.x - n.px, dy = n.y - n.py, dz = n.z - n.pz;
    const dn = dx * nrm.x + dy * nrm.y + dz * nrm.z;
    dx -= dn * nrm.x; dy -= dn * nrm.y; dz -= dn * nrm.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) return;
    // Coulomb budget: friction can cancel displacement up to mu * penetration
    const lim = mu * Math.max(pen, 0.0004) * 2.2;
    if (len > lim) {
      const k = 1 - lim / len;
      n.x -= dx * k; n.y -= dy * k; n.z -= dz * k;
    }
  }
}

const _nrm = { x: 0, y: 1, z: 0 };

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------
export class PhysicsSolver {
  constructor(body, colliders) {
    this.body = body;
    this.colliders = colliders;
    this.h = 1 / 240;
    this.iterations = 4;
    this.airDrag = 0.0;
    this.impactSpeed = 0;
    this.maxPenetration = 0;
    this.time = 0;
  }

  step(substeps = 1) {
    const body = this.body;
    const h = this.h;
    const invH2 = 1 / (h * h);
    this.impactSpeed = 0;
    for (let s = 0; s < substeps; s++) {
      this.time += h;
      // integrate
      for (const n of body.nodes) {
        n.px = n.x; n.py = n.y; n.pz = n.z;
        if (n.invMass === 0) continue;
        n.vx += (n.fx * n.invMass) * h;
        n.vy += (GRAVITY + n.fy * n.invMass) * h;
        n.vz += (n.fz * n.invMass) * h;
        // gentle numerical damping
        n.vx *= 0.9998; n.vy *= 0.9998; n.vz *= 0.9998;
        n.x += n.vx * h; n.y += n.vy * h; n.z += n.vz * h;
        n.fx = n.fy = n.fz = 0;
        n.grounded = 0; n.contact = 0;
      }
      // constraints
      for (const b of body.beams) b.lambda = 0;
      for (let it = 0; it < this.iterations; it++) {
        this.solveBeams(invH2);
      }
      // static collisions
      for (const n of body.nodes) {
        const imp = this.colliders.resolveNode(n, h);
        if (imp > this.impactSpeed) this.impactSpeed = imp;
      }
      // plastic yield (once per substep, after constraints)
      this.yieldBeams();
      // velocity update
      const invH = 1 / h;
      for (const n of body.nodes) {
        if (n.invMass === 0) { n.vx = n.vy = n.vz = 0; continue; }
        n.vx = (n.x - n.px) * invH;
        n.vy = (n.y - n.py) * invH;
        n.vz = (n.z - n.pz) * invH;
        // clamp insane velocities for stability
        const sp = Math.hypot(n.vx, n.vy, n.vz);
        const MAX = 160;
        if (sp > MAX) { const k = MAX / sp; n.vx *= k; n.vy *= k; n.vz *= k; }
      }
      // beam axis damping (removes ringing)
      this.dampBeams(h);
    }
  }

  solveBeams(invH2) {
    const nodes = this.body.nodes, beams = this.body.beams;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (b.broken) continue;
      const A = nodes[b.a], B = nodes[b.b];
      const w = A.invMass + B.invMass;
      if (w === 0) continue;
      let dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-8) continue;
      const C = len - b.rest;
      const alpha = b.compliance * invH2;
      const dl = (-C - alpha * b.lambda) / (w + alpha);
      b.lambda += dl;
      const k = dl / len;
      const ax = dx * k, ay = dy * k, az = dz * k;
      if (A.invMass) { A.x -= ax * A.invMass; A.y -= ay * A.invMass; A.z -= az * A.invMass; }
      if (B.invMass) { B.x += ax * B.invMass; B.y += ay * B.invMass; B.z += az * B.invMass; }
    }
  }

  yieldBeams() {
    for (const b of this.body.beams) {
      if (b.broken) continue;
      const A = this.body.nodes[b.a], B = this.body.nodes[b.b];
      const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const strain = (len - b.rest) / b.rest;
      if (Math.abs(strain) > b.yield) {
        const excess = (Math.abs(strain) - b.yield) * Math.sign(strain);
        // plastic flow: rest length chases current length
        const flow = excess * 0.055;
        b.rest += b.rest * flow;
        b.plastic += Math.abs(flow);
        // broken beams: fully separate the shell
        if (Math.abs(strain) > b.maxStrain) {
          b.broken = true;
        }
      }
      if (b.plastic > 0.9) b.broken = true;
    }
  }

  dampBeams(h) {
    const nodes = this.body.nodes;
    for (const b of this.body.beams) {
      if (b.broken) continue;
      const A = nodes[b.a], B = nodes[b.b];
      let dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      dx /= len; dy /= len; dz /= len;
      const rel = (B.vx - A.vx) * dx + (B.vy - A.vy) * dy + (B.vz - A.vz) * dz;
      const damp = clamp(rel * 2.2, -3, 3) * h * 40;
      const wa = A.invMass, wb = B.invMass, w = wa + wb || 1;
      A.vx += dx * damp * (wa / w); A.vy += dy * damp * (wa / w); A.vz += dz * damp * (wa / w);
      B.vx -= dx * damp * (wb / w); B.vy -= dy * damp * (wb / w); B.vz -= dz * damp * (wb / w);
    }
  }
}

// ---------------------------------------------------------------------------
// Tire model helpers
// ---------------------------------------------------------------------------
export function tireLongitudinal(slip, peak = 0.13, mu = 1) {
  // returns normalised force (-1..1) with a peak then falloff
  const a = Math.abs(slip);
  let f;
  if (a < peak) f = a / peak;
  else f = 1 - 0.34 * Math.min(1, (a - peak) / 0.55);
  return Math.sign(slip) * f * mu;
}

export function tireLateral(alpha, peak = 0.16, mu = 1) {
  const a = Math.abs(alpha);
  let f;
  if (a < peak) f = a / peak;
  else f = 1 - 0.22 * Math.min(1, (a - peak) / 0.5);
  return -Math.sign(alpha) * f * mu;
}

export { clamp };

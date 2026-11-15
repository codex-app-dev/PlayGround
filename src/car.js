import { SoftBody, PhysicsSolver, clamp, tireLongitudinal, tireLateral } from './physics.js';

const LOOPS = 19;
const RING = 10;

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Build a car silhouette from a small parameter set. Returns station list.
function generatorStations(o) {
  const {
    half = 2.2, width = 1.88, roof = 1.36, belt = 0.96, floor = 0.30,
    hood = 0.88, cabinFront = 0.55, cabinRear = -0.75, noseDrop = 0.14,
    tailDrop = 0.04,
  } = o;

  const stations = [];
  const N = 21;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);            // 0 rear -> 1 front
    const z = (u * 2 - 1) * half;
    const zn = u * 2 - 1;             // -1..1
    // cabin mask: 1 inside greenhouse
    const frontMask = smoothstep(cabinFront + 0.24, cabinFront - 0.12, zn);
    const rearMask = smoothstep(cabinRear - 0.22, cabinRear + 0.10, zn);
    const cab = frontMask * rearMask;
    // hood/deck baseline height (front and rear are lower than the belt)
    const baseTop = lerp(hood, hood - noseDrop, smoothstep(0.2, 1, zn));
    const rearTop = lerp(hood, hood - tailDrop, smoothstep(-0.2, -1, zn));
    const lowTop = zn > 0 ? baseTop : rearTop;
    const crown = 0.035 * Math.sin(Math.PI * clamp((zn - cabinRear) / (cabinFront - cabinRear), 0, 1));
    const roofY = lowTop + (roof - lowTop) * cab + crown * cab;
    const beltY = belt - 0.10 * Math.pow(Math.abs(zn), 2.6) - 0.04 * (1 - cab) * 0;
    const floorY = floor + 0.10 * Math.pow(Math.abs(zn), 3.2) + 0.02;
    const rockerY = floorY + 0.115;
    const bw = width * 0.5 * (0.94 - 0.055 * zn * zn);
    const rw = bw * 0.815;
    const fw = bw * 0.66;
    const gw = bw * (0.6 + 0.36 * (1 - cab));
    stations.push({
      z, floor: floorY, rocker: rockerY, belt: Math.max(beltY, floorY + 0.28),
      roof: Math.max(roofY, beltY + 0.06), fw, rw, bw, gw,
    });
  }
  return stations;
}

// Resample stations down to LOOPS control rings, keeping ends exact.
function resample(stations, count) {
  const out = [];
  const keys = ['z', 'floor', 'rocker', 'belt', 'roof', 'fw', 'rw', 'bw', 'gw'];
  const n = stations.length;
  for (let i = 0; i < count; i++) {
    const s = (i / (count - 1)) * (n - 1);
    const i1 = Math.floor(s);
    const i2 = Math.min(n - 1, i1 + 1);
    const t = s - i1;
    const i0 = Math.max(0, i1 - 1), i3 = Math.min(n - 1, i2 + 1);
    const st = {};
    for (const k of keys) st[k] = catmull(stations[i0][k], stations[i1][k], stations[i2][k], stations[i3][k], t);
    out.push(st);
  }
  return out;
}

export const VEHICLES = [
  {
    id: 'vantor', name: 'Vantor GT', sub: 'SPORT COUPE · AWD · 2.6L TURBO',
    color: 0xd8342c, colorName: '#d8342c', accent: '#ff8a5c',
    mass: 1380, power: 320, torque: 430, redline: 7200, idle: 850,
    drive: 'AWD', gears: [3.45, 2.10, 1.48, 1.12, 0.90, 0.74], final: 3.55,
    aero: 0.62, downforce: 0.06, grip: 1.12, latGrip: 1.14, brake: 3200,
    shape: { half: 2.18, width: 1.9, roof: 1.34, belt: 0.95, floor: 0.29, hood: 0.86, cabinFront: 0.52, cabinRear: -0.78 },
    wheel: { radius: 0.345, width: 0.26, track: 0.80, frontZ: 1.32, rearZ: -1.30 },
    spring: 46000, damper: 4300, arb: 15000, travel: 0.26,
  },
  {
    id: 'kestrel', name: 'Kestrel V8', sub: 'MUSCLE · RWD · 6.4L V8',
    color: 0x1f6fb2, colorName: '#1f6fb2', accent: '#ffcf6b',
    mass: 1560, power: 465, torque: 610, redline: 6400, idle: 700,
    drive: 'RWD', gears: [3.10, 1.98, 1.42, 1.08, 0.86, 0.70], final: 3.70,
    aero: 0.78, downforce: 0.02, grip: 1.02, latGrip: 0.98, brake: 3000,
    shape: { half: 2.38, width: 1.98, roof: 1.30, belt: 0.99, floor: 0.32, hood: 0.95, cabinFront: 0.28, cabinRear: -0.92, noseDrop: 0.06 },
    wheel: { radius: 0.37, width: 0.30, track: 0.845, frontZ: 1.40, rearZ: -1.36 },
    spring: 42000, damper: 3900, arb: 11000, travel: 0.28,
  },
  {
    id: 'terra', name: 'Terra X4', sub: 'SUV · AWD · 3.0L DIESEL',
    color: 0x3f6b4a, colorName: '#3f6b4a', accent: '#a8d977',
    mass: 2020, power: 275, torque: 560, redline: 5200, idle: 720,
    drive: 'AWD', gears: [4.10, 2.42, 1.60, 1.20, 0.96, 0.80], final: 3.90,
    aero: 1.05, downforce: 0.0, grip: 1.06, latGrip: 0.94, brake: 3400,
    shape: { half: 2.32, width: 2.02, roof: 1.78, belt: 1.12, floor: 0.52, hood: 1.10, cabinFront: 0.62, cabinRear: -1.02, noseDrop: 0.10 },
    wheel: { radius: 0.44, width: 0.32, track: 0.855, frontZ: 1.36, rearZ: -1.38 },
    spring: 52000, damper: 5200, arb: 17000, travel: 0.34,
    tall: true,
  },
  {
    id: 'milo', name: 'Milo RS', sub: 'HOT HATCH · FWD · 2.0L TURBO',
    color: 0xf0b429, colorName: '#f0b429', accent: '#ffe08a',
    mass: 1140, power: 225, torque: 340, redline: 7400, idle: 900,
    drive: 'FWD', gears: [3.55, 2.14, 1.52, 1.18, 0.94, 0.78], final: 3.85,
    aero: 0.55, downforce: 0.03, grip: 1.08, latGrip: 1.10, brake: 2900,
    shape: { half: 1.94, width: 1.82, roof: 1.48, belt: 0.99, floor: 0.30, hood: 0.94, cabinFront: 0.66, cabinRear: -0.86 },
    wheel: { radius: 0.325, width: 0.24, track: 0.775, frontZ: 1.16, rearZ: -1.14 },
    spring: 40000, damper: 3800, arb: 13000, travel: 0.25,
  },
];

function torqueCurve(rpm, redline, peak) {
  const x = clamp(rpm / redline, 0, 1.05);
  const table = [
    [0.00, 0.40], [0.14, 0.58], [0.30, 0.80], [0.52, 0.97],
    [0.68, 1.00], [0.82, 0.94], [0.94, 0.83], [1.02, 0.70],
  ];
  for (let i = 0; i < table.length - 1; i++) {
    if (x <= table[i + 1][0]) {
      const t = (x - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return peak * lerp(table[i][1], table[i + 1][1], t);
    }
  }
  return peak * 0.7;
}

export class Vehicle {
  constructor(spec) {
    this.spec = spec;
    this.body = new SoftBody(spec.id);
    this.solver = null;
    this.colliders = null;
    this.grid = [];
    this.spine = [];
    this.rings = [];
    this.wheels = [];
    this.engine = {
      rpm: spec.idle, gear: 1, targetGear: 1, shiftTimer: 0, boost: 0,
      throttle: 0, brake: 0, clutch: 1, running: true, damage: 0, stall: 0,
      load: 0, torqueOut: 0, driveTorque: 0, wheelspin: 0, shiftFlash: 0,
    };
    this.damage = { body: 0, engine: 0, wheels: 0, chassis: 0, overall: 0 };
    this.steer = 0;
    this.frame = { fwd: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
    this.gforce = { x: 0, y: 0, z: 0, peak: 0 };
    this._prevVel = { x: 0, y: 0, z: 0 };
    this._accelSmooth = { x: 0, y: 0, z: 0 };
    this.speed = 0;
    this.speedKph = 0;
    this.forwardSpeed = 0;
    this.airTime = 0;
    this.grounded = 0;
    this.impactCooldown = 0;
    this.crashScore = 0;
    this.scrapeTimer = 0;
    this.wheelDamageAccum = 0;
    this.spawned = false;
    this.lap = { airStart: 0, airY: 0, jumping: false, jumpStartZ: 0, jumpStartX: 0 };
    this.events = [];
    this.build();
  }

  build() {
    const spec = this.spec;
    const stations = resample(generatorStations({ ...spec.shape, mass: spec.mass }), LOOPS);
    this.stations = stations;
    const body = this.body;
    const nodeMassBase = spec.mass;

    // 1. nodes
    for (let i = 0; i < LOOPS; i++) {
      const st = stations[i];
      const ring = [];
      const top = (st.roof + st.belt) * 0.5;
      for (let j = 0; j < RING; j++) {
        let x, y;
        switch (j) {
          case 0: x = -st.gw * 0.44; y = st.roof; break;
          case 1: x = -st.gw; y = st.roof - 0.075; break;
          case 2: x = -st.bw; y = st.belt; break;
          case 3: x = -st.rw; y = st.rocker; break;
          case 4: x = -st.fw; y = st.floor; break;
          case 5: x = st.fw; y = st.floor; break;
          case 6: x = st.rw; y = st.rocker; break;
          case 7: x = st.bw; y = st.belt; break;
          case 8: x = st.gw; y = st.roof - 0.075; break;
          default: x = st.gw * 0.44; y = st.roof; break;
        }
        // structural weight: roof light, floor/sills heavy
        let w = 1.0;
        if (y > top) w = 0.52;
        else if (y > st.belt - 0.05) w = 0.9;
        else if (y < st.rocker + 0.02) w = 1.15;
        ring.push({ idx: -1, w, x, y, z: st.z });
      }
      this.rings.push(ring);
      this.grid.push(ring.map(() => -1));
    }
    // mass normalisation
    let wsum = 0;
    for (const ring of this.rings) for (const p of ring) wsum += p.w;
    const spineW = LOOPS * 1.6;
    wsum += spineW;
    const unit = nodeMassBase / wsum;

    for (let i = 0; i < LOOPS; i++) {
      const ring = this.rings[i];
      for (let j = 0; j < RING; j++) {
        const p = ring[j];
        const idx = body.addNode(p.x, p.y, p.z, p.w * unit, 1);
        this.grid[i][j] = idx;
        p.idx = idx;
      }
      const st = stations[i];
      const sidx = body.addNode(0, st.floor + 0.14, st.z, 1.6 * unit, 2);
      this.spine.push(sidx);
    }

    // 2. beams
    const half = spec.shape.half;
    const frontZ = spec.wheel.frontZ;
    const rearZ = spec.wheel.rearZ;
    const zoneOf = (z) => (z > frontZ - 0.30 ? 'front' : z < rearZ + 0.30 ? 'rear' : 'cabin');
    const cfg = (zone, kind) => {
      if (zone === 'front' || zone === 'rear') {
        return { compliance: 5.5e-8, yield: 0.016, maxStrain: 0.34 };
      }
      if (kind === 'roof') return { compliance: 4.2e-8, yield: 0.024, maxStrain: 0.62 };
      return { compliance: 2.4e-8, yield: 0.030, maxStrain: 0.85 };
    };

    for (let i = 0; i < LOOPS; i++) {
      const ring = this.rings[i];
      const zone = zoneOf(stations[i].z);
      // perimeter
      for (let j = 0; j < RING; j++) {
        const a = ring[j].idx, b = ring[(j + 1) % RING].idx;
        const isTop = j === 0 || j === 8 || j === 9;
        const c = cfg(zone, isTop ? 'roof' : 'side');
        const bm = body.addBeam(a, b, { ...c, group: zone });
        bm.zone = zone;
      }
      // spine ties
      for (let j = 0; j < RING; j++) {
        if (j === 4 || j === 5 || j === 3 || j === 6) {
          const c = cfg(zone, 'floor');
          const bm = body.addBeam(ring[j].idx, this.spine[i], { ...c, group: zone, compliance: c.compliance * 0.8 });
          bm.zone = zone;
        }
      }
    }
    for (let i = 0; i < LOOPS - 1; i++) {
      const A = this.rings[i], B = this.rings[i + 1];
      const zone = zoneOf((stations[i].z + stations[i + 1].z) * 0.5);
      for (let j = 0; j < RING; j++) {
        const isTop = j === 0 || j === 1 || j === 8 || j === 9;
        const c = cfg(zone, isTop ? 'roof' : 'side');
        const bm = body.addBeam(A[j].idx, B[j].idx, { ...c, group: zone });
        bm.zone = zone;
      }
      // diagonals alternate
      for (let j = 0; j < RING; j++) {
        const jn = (j + 1) % RING;
        const c = cfg(zone, 'diag');
        const bm = (i + j) % 2 === 0
          ? body.addBeam(A[j].idx, B[jn].idx, { ...c, compliance: c.compliance * 1.5, group: zone })
          : body.addBeam(A[jn].idx, B[j].idx, { ...c, compliance: c.compliance * 1.5, group: zone });
        bm.zone = zone;
      }
      const sbm = body.addBeam(this.spine[i], this.spine[i + 1], { ...cfg(zone, 'side'), group: zone });
      sbm.zone = zone;
    }
    // floor X bracing at every other ring for torsional stiffness
    for (let i = 0; i < LOOPS - 1; i += 1) {
      const A = this.rings[i], B = this.rings[i + 1];
      const zone = zoneOf((stations[i].z + stations[i + 1].z) * 0.5);
      const c = cfg(zone, 'floor');
      body.addBeam(A[4].idx, B[5].idx, { ...c, compliance: c.compliance * 2.0, group: zone });
      body.addBeam(A[5].idx, B[4].idx, { ...c, compliance: c.compliance * 2.0, group: zone });
    }

    // 3. wheels
    const spec2 = spec.wheel;
    const defs = [
      { name: 'FL', x: -spec2.track, z: spec2.frontZ, steer: true, driveShare: spec.drive === 'RWD' ? 0 : spec.drive === 'FWD' ? 0.5 : 0.25 },
      { name: 'FR', x: spec2.track, z: spec2.frontZ, steer: true, driveShare: spec.drive === 'RWD' ? 0 : spec.drive === 'FWD' ? 0.5 : 0.25 },
      { name: 'RL', x: -spec2.track, z: spec2.rearZ, steer: false, driveShare: spec.drive === 'FWD' ? 0 : spec.drive === 'RWD' ? 0.5 : 0.25 },
      { name: 'RR', x: spec2.track, z: spec2.rearZ, steer: false, driveShare: spec.drive === 'FWD' ? 0 : spec.drive === 'RWD' ? 0.5 : 0.25 },
    ];
    for (const def of defs) {
      const attach = this.findAttach(def.x, def.z, 9);
      const anchor = this.centroid(attach);
      const wheel = {
        ...def, attach,
        anchorLocal: { x: anchor.x, y: anchor.y, z: anchor.z },
        ax: anchor.x, ay: anchor.y, az: anchor.z,
        cx: anchor.x, cz: anchor.z,
        radius: spec2.radius, width: spec2.width,
        omega: 0, spin: 0, steerAngle: 0, compression: 0, prevCompression: 0,
        contact: false, contactY: 0, load: 0, slip: 0, longSlip: 0, latSlip: 0,
        damage: 0, hubY: 0, hubX: 0, hubZ: 0, spinVel: 0, restLen: 0.6, maxTravel: spec.travel,
        lastImpact: 0, dirt: 0, locked: false,
      };
      this.wheels.push(wheel);
    }

    this.solver = new PhysicsSolver(body, null);
    this.solver.h = 1 / 240;
    this.solver.iterations = 4;
  }

  findAttach(lx, lz, count) {
    const st = this.stations;
    // nearest nodes in the plane, weighted by distance
    const cand = [];
    for (let i = 0; i < LOOPS; i++) {
      for (let j = 0; j < RING; j++) {
        const p = this.rings[i][j];
        const dist = Math.hypot(p.x - lx, p.y - 0.72, p.z - lz);
        cand.push({ idx: p.idx, d: dist });
      }
      const s = this.spine[i];
      void s;
    }
    cand.sort((a, b) => a.d - b.d);
    const top = cand.slice(0, count);
    let wsum = 0;
    for (const c of top) { c.w = 1 / (c.d + 0.12) ** 2; wsum += c.w; }
    return top.map((c) => ({ i: c.idx, w: c.w / wsum }));
  }

  centroid(attach) {
    let x = 0, y = 0, z = 0;
    for (const a of attach) {
      const n = this.body.nodes[a.i];
      x += n.x * a.w; y += n.y * a.w; z += n.z * a.w;
    }
    return { x, y, z };
  }

  // ------------------------------------------------------------------
  place(x, z, yaw, getGroundY) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const nodes = this.body.nodes;
    for (const ring of this.rings) {
      for (const p of ring) {
        const n = nodes[p.idx];
        const gy = getGroundY(x + p.x * cos + p.z * sin, z - p.x * sin + p.z * cos);
        n.x = x + p.x * cos + p.z * sin;
        n.y = gy + p.y + 0.06;
        n.z = z - p.x * sin + p.z * cos;
        n.px = n.x; n.py = n.y; n.pz = n.z;
        n.vx = n.vy = n.vz = 0;
      }
      const s = nodes[this.spine[ring === this.rings[this.rings.length - 1] ? LOOPS - 1 : 0]];
      void s;
    }
    for (let i = 0; i < LOOPS; i++) {
      const st = this.stations[i];
      const n = nodes[this.spine[i]];
      const wx = x + 0 * cos + st.z * sin;
      const wz = z - 0 * sin + st.z * cos;
      n.x = wx; n.z = wz;
      n.y = getGroundY(wx, wz) + st.floor + 0.14 + 0.06;
      n.px = n.x; n.py = n.y; n.pz = n.z;
      n.vx = n.vy = n.vz = 0;
    }
    for (const beam of this.body.beams) { beam.rest = beam.rest0; beam.plastic = 0; beam.broken = false; beam.lambda = 0; }
    this.spawnPos = { x, z, yaw };
    this.damage = { body: 0, engine: 0, wheels: 0, chassis: 0, overall: 0 };
    for (const w of this.wheels) {
      w.omega = 0; w.spin = 0; w.damage = 0; w.compression = 0; w.prevCompression = 0; w.locked = false;
    }
    this.engine.gear = 1; this.engine.targetGear = 1; this.engine.rpm = this.spec.idle;
    this.engine.damage = 0; this.engine.running = true; this.engine.stall = 0; this.engine.shiftTimer = 0;
    this.engine.boost = 0;
    this.crashScore = 0;
    this.steer = 0;
    this.spawned = true;
    this.airTime = 0;
    this.gforce.peak = 0;
    this.calibrateSuspension(getGroundY);
  }

  calibrateSuspension(getGroundY) {
    const gy = getGroundY(this.spawnPos.x, this.spawnPos.z);
    for (const w of this.wheels) {
      const a = this.centroid(w.attach);
      w.anchorLocal = { x: a.x, y: a.y, z: a.z };
      const gap = a.y - (gy + w.radius);
      w.restLen = gap + 0.11;
      w.hubY = gy + w.radius;
    }
  }

  setColliders(colliders) {
    this.colliders = colliders;
    this.solver.colliders = colliders;
  }

  // ------------------------------------------------------------------
  computeFrame() {
    const nodes = this.body.nodes;
    const g = this.grid;
    const iF = Math.min(LOOPS - 1, 15);
    const iR = 3;
    const fl = nodes[g[iF][2]], fr = nodes[g[iF][7]];
    const rl = nodes[g[iR][2]], rr = nodes[g[iR][7]];
    const fcx = (fl.x + fr.x) * 0.5, fcy = (fl.y + fr.y) * 0.5, fcz = (fl.z + fr.z) * 0.5;
    const rcx = (rl.x + rr.x) * 0.5, rcy = (rl.y + rr.y) * 0.5, rcz = (rl.z + rr.z) * 0.5;
    let fx = fcx - rcx, fy = fcy - rcy, fz = fcz - rcz;
    let len = Math.hypot(fx, fy, fz) || 1;
    fx /= len; fy /= len; fz /= len;
    let rx = fr.x - fl.x, ry = fr.y - fl.y, rz = fr.z - fl.z;
    len = Math.hypot(rx, ry, rz) || 1;
    rx /= len; ry /= len; rz /= len;
    // up = fwd x right
    let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
    len = Math.hypot(ux, uy, uz) || 1;
    ux /= len; uy /= len; uz /= len;
    // re-orthogonalise right
    rx = uy * fz - uz * fy; ry = uz * fx - ux * fz; rz = ux * fy - uy * fx;
    len = Math.hypot(rx, ry, rz) || 1;
    rx /= len; ry /= len; rz /= len;
    this.frame.fwd = { x: fx, y: fy, z: fz };
    this.frame.right = { x: rx, y: ry, z: rz };
    this.frame.up = { x: ux, y: uy, z: uz };
  }

  forwardSpeedKph() {
    const v = this.body.velocity();
    const f = this.frame.fwd;
    return (v.x * f.x + v.z * f.z) * 3.6;
  }

  // main per-substep control + wheel force application
  applyControls(h, input) {
    if (!this.spawned) return;
    this.computeFrame();
    const spec = this.spec;
    const nodes = this.body.nodes;
    const eng = this.engine;
    const vel = this.body.velocity();
    const fwdSpeed = vel.x * this.frame.fwd.x + vel.z * this.frame.fwd.z;
    const speed = vel.speed;
    this.speed = speed;
    this.forwardSpeed = fwdSpeed;

    // steering
    const steerMax = lerp(0.61, 0.115, clamp(Math.abs(fwdSpeed) / 46, 0, 1));
    const target = input.steer * steerMax;
    this.steer += (target - this.steer) * Math.min(1, h * 9.0);
    this.steer = clamp(this.steer, -steerMax, steerMax);

    // pedals
    const throttle = input.throttle;
    const brake = input.brake;
    const handbrake = input.handbrake;

    // ---- engine ----
    eng.throttle += (throttle - eng.throttle) * Math.min(1, h * 14);
    const gear = eng.gear;
    const gearRatio = gear === 0 ? 0 : gear > 0 ? spec.gears[gear - 1] : 3.4;
    const totalRatio = gearRatio * spec.final;
    const driven = this.wheels.filter((w) => w.driveShare > 0);
    let wheelOmega = 0;
    if (driven.length) {
      for (const w of driven) wheelOmega += w.omega * w.driveShare;
      wheelOmega /= driven.reduce((a, w) => a + w.driveShare, 0);
    }
    const rpmFromWheels = Math.abs(wheelOmega) * Math.abs(totalRatio) * 60 / (2 * Math.PI);
    if (eng.shiftTimer > 0) eng.shiftTimer -= h;
    if (eng.stall > 0) eng.stall -= h;

    let rpmTarget;
    if (gear === 0) rpmTarget = spec.idle + eng.throttle * (spec.redline - spec.idle) * 0.92;
    else if (gear < 0) rpmTarget = spec.idle + Math.abs(fwdSpeed) * 90 * 0.35 + eng.throttle * 900;
    else rpmTarget = Math.max(spec.idle + eng.throttle * 700, Math.min(rpmFromWheels, spec.redline * 1.02));
    if (Math.abs(fwdSpeed) < 1.0 && gear > 0) rpmTarget = Math.max(rpmTarget, spec.idle + eng.throttle * 2400);
    eng.rpm += (rpmTarget - eng.rpm) * Math.min(1, h * 8.5);
    eng.rpm = clamp(eng.rpm, 0, spec.redline * 1.06);

    // turbo lag
    const boostTarget = eng.throttle * clamp((eng.rpm - 1600) / 2200, 0, 1);
    eng.boost += (boostTarget - eng.boost) * Math.min(1, h * (boostTarget > eng.boost ? 2.6 : 6.5));
    const boostMul = 1 + eng.boost * 0.45;

    let torque = torqueCurve(eng.rpm, spec.redline, spec.torque) * eng.throttle * boostMul;
    if (eng.shiftTimer > 0) torque = 0;
    if (eng.shiftFlash > 0) eng.shiftFlash -= h;

    // engine braking + rev limiter
    if (eng.rpm > spec.redline * 1.005) torque = -spec.torque * 0.06;
    if (eng.throttle < 0.05 && Math.abs(fwdSpeed) > 1 && gear > 0) torque -= spec.torque * 0.055 * clamp(eng.rpm / spec.redline, 0, 1);

    eng.damage = this.damage.engine;
    if (eng.damage > 0.92) { eng.running = false; }
    if (!eng.running) { torque = 0; }
    torque *= 1 - eng.damage * 0.85;

    // automatic gearbox
    if (gear > 0 && eng.shiftTimer <= 0) {
      const upRpm = spec.redline * 0.93;
      if (eng.rpm > upRpm && gear < spec.gears.length) this.shift(1, h);
      else if (eng.rpm < spec.redline * 0.32 && gear > 1) this.shift(-1, h);
    }
    // reverse / drive selection
    if (gear <= 0) {
      if (throttle > 0.15 && fwdSpeed > -0.6) { eng.gear = 1; eng.shiftTimer = 0.25; }
      if (gear < 0 && fwdSpeed > 1.0) eng.gear = 1;
    } else if (brake > 0.5 && fwdSpeed < 0.55 && fwdSpeed > -1.5 && throttle < 0.1) {
      // brake held at standstill -> reverse
      if (eng.stillTimer === undefined) eng.stillTimer = 0;
      eng.stillTimer += h;
      if (eng.stillTimer > 0.35) { eng.gear = -1; eng.shiftTimer = 0.2; eng.stillTimer = 0; }
    } else eng.stillTimer = 0;
    if (gear === -1 && throttle > 0.05) {
      // reverse throttle drives backwards
    }

    eng.torqueOut = torque;
    const dir = gear < 0 ? -1 : 1;
    const axleTorque = torque * Math.abs(totalRatio) * 0.9 * dir;
    eng.driveTorque = axleTorque;

    // brake torque
    const brakeTorque = brake * spec.brake * (gear < 0 ? 0.7 : 1) + (handbrake ? spec.brake * 0.85 : 0);

    // ---- wheels ----
    const throttleCut = eng.shiftTimer > 0 ? 0 : 1;
    for (const w of this.wheels) {
      // anchor from attached nodes
      const c = this.centroid(w.attach);
      w.ax = c.x; w.ay = c.y; w.az = c.z;
      w.cx = c.x; w.cz = c.z;

      const up = this.frame.up;
      // vertical gap to ground
      const gy = this.colliders ? this.colliders.surfaceHeight(c.x, c.z, w.ay + 0.05) : 0;
      let L = w.ay - gy - w.radius;
      const airborne = L > w.restLen;
      const comp = airborne ? 0 : clamp(w.restLen - L, 0, w.maxTravel);
      w.compression = comp;
      const compVel = (comp - w.prevCompression) / h;
      w.prevCompression = comp;

      // suspension force
      const gripFactor = 1 - w.damage * 0.45;
      let springF = comp * spec.spring * gripFactor;
      // bump stop
      if (comp >= w.maxTravel - 0.005) springF += (comp - w.maxTravel + 0.005) * spec.spring * 7;
      let dampF = compVel * spec.damper;
      dampF = clamp(dampF, -spec.spring * 0.9, spec.spring * 0.9);
      let N = Math.max(0, springF + dampF);
      N = Math.min(N, spec.mass * 26);
      w.load = N;
      w.contact = !airborne && comp > 0.001;
      w.hubY = w.contact ? gy + w.radius : w.ay - w.restLen;
      w.hubX = c.x; w.hubZ = c.z;
      w.contactY = gy;

      if (w.contact) {
        // apply spring along body up at the arch
        for (const a of w.attach) {
          const n = nodes[a.i];
          n.fx += up.x * N * a.w;
          n.fy += up.y * N * a.w;
          n.fz += up.z * N * a.w;
        }
        // lateral grip / slip
        const f = this.frame.fwd, r = this.frame.right;
        const steerA = w.steer ? this.steer * (w.x < 0 ? 1.0 : 1.0) : 0;
        w.steerAngle = steerA;
        const cs = Math.cos(steerA), sn = Math.sin(steerA);
        const wfx = f.x * cs + r.x * sn, wfz = f.z * cs + r.z * sn;
        const wrx = r.x * cs - f.x * sn, wrz = r.z * cs - f.z * sn;
        // chassis velocity at the wheel
        let cvx = 0, cvz = 0;
        for (const a of w.attach) {
          const n = nodes[a.i];
          cvx += n.vx * a.w; cvz += n.vz * a.w;
        }
        const vlong = cvx * wfx + cvz * wfz;
        const vlat = cvx * wrx + cvz * wrz;
        const denom = Math.max(Math.abs(vlong), 2.0);
        const slipRatio = (w.omega * w.radius - vlong) / denom;
        w.longSlip = slipRatio;
        const alpha = Math.atan2(vlat, Math.max(Math.abs(vlong), 1.0));
        w.latSlip = alpha;
        const grip = spec.grip * gripFactor;
        const gripLat = spec.latGrip * gripFactor * (handbrake && !w.steer ? 0.62 : 1) * (w.contact ? 1 : 0);
        // surface grip modifier from world (dirt/asphalt)
        const surfGrip = this.colliders && this.colliders.ground.gripAt ? this.colliders.ground.gripAt(c.x, c.z) : 1;
        const loadN = N;
        let fx = tireLongitudinal(slipRatio, 0.14, grip * surfGrip) * loadN;
        let fy = tireLateral(alpha, 0.155, gripLat * surfGrip) * loadN;
        // combined friction clamp
        const maxF = loadN * grip * surfGrip * 1.02;
        const mag = Math.hypot(fx, fy);
        if (mag > maxF) { const k = maxF / mag; fx *= k; fy *= k; }
        // rolling resistance
        const roll = 0.014 * loadN * Math.sign(w.omega || 1);
        // apply at contact point (with vertical moment couple)
        this.applyWheelForce(w, wfx * fx + wrx * fy, 0, wfz * fx + wrz * fy, gy);
        w.slip = Math.hypot(slipRatio * 0.7, alpha * 1.5);
        // wheel angular integration
        const gearAshare = w.driveShare * throttleCut;
        let driveT = axleTorque * gearAshare;
        const I = 1.25 + 0.055 * Math.pow(totalRatio * w.driveShare * 2, 2) * 0.35;
        let brk = brakeTorque * (w.steer ? 0.62 : 0.5);
        brk += w.damage * 900;
        let netT = driveT - fx * w.radius - roll - brk * Math.tanh(w.omega * 3.2);
        w.omega += (netT / I) * h;
        if (Math.abs(w.omega) < 0.6 && brake > 0.1) w.omega *= 0.96;
        // abs-ish clamp so wheels don't spin infinitely
        w.omega = clamp(w.omega, -220, 220);
        // wheel damage from impacts is handled in post()
      } else {
        // free spin down
        w.omega *= (1 - 0.6 * h);
        w.longSlip = 0; w.latSlip = 0; w.slip = 0;
        // slight gravity droop handled visually
      }
      w.spin += w.omega * h;
    }
    // anti-roll bars
    for (let axle = 0; axle < 2; axle++) {
      const l = this.wheels[axle * 2], r = this.wheels[axle * 2 + 1];
      const diff = l.compression - r.compression;
      const f = -diff * spec.arb;
      if (l.contact) for (const a of l.attach) { const n = nodes[a.i]; n.fy += f * a.w; }
      if (r.contact) for (const a of r.attach) { const n = nodes[a.i]; n.fy -= f * a.w; }
    }

    // aero drag + downforce
    const v = this.body.velocity();
    const dragK = 0.5 * 1.2 * spec.aero;
    const dragF = -dragK * v.speed * v.speed;
    const vn = v.speed || 1;
    for (const n of nodes) {
      n.fx += (v.x / vn) * dragF * n.mass / this.body.mass;
      n.fz += (v.z / vn) * dragF * n.mass / this.body.mass;
      // downforce
      const down = -dragK * spec.downforce * v.speed * v.speed * 40;
      n.fy += down * n.mass / this.body.mass;
    }

    // engine damage -> torque cut
    this.engine.load = eng.throttle;
  }

  shift(dir, h) {
    const eng = this.engine;
    const gears = this.spec.gears.length;
    const next = clamp(eng.gear + dir, 1, gears);
    if (next === eng.gear) return;
    eng.gear = next;
    eng.shiftTimer = dir > 0 ? 0.22 : 0.16;
    eng.shiftFlash = 0.3;
    void h;
  }

  applyWheelForce(w, fx, fy, fz, groundY) {
    const nodes = this.body.nodes;
    for (const a of w.attach) {
      const n = nodes[a.i];
      n.fx += fx * a.w; n.fy += fy * a.w; n.fz += fz * a.w;
    }
    // load-transfer couple: force is applied at the contact patch, below the arch
    const L = clamp(w.ay - groundY, -0.1, 1.2);
    const Mx = -L * fz;      // pitch
    const Mz = L * fx;       // yaw
    let denom = 0;
    for (const a of w.attach) {
      const n = nodes[a.i];
      const dz = n.z - w.cz, dx = n.x - w.cx;
      denom += dz * dz + dx * dx;
    }
    if (denom < 1e-3) return;
    for (const a of w.attach) {
      const n = nodes[a.i];
      const dz = n.z - w.cz, dx = n.x - w.cx;
      const fyn = (Mx * -dz + Mz * dx) / denom;
      n.fy += clamp(fyn, -9000, 9000);
    }
  }

  post(h) {
    if (!this.spawned) return;
    // damage
    const dmg = this.body.damage();
    this.damage.body = clamp(dmg.body * 1.5, 0, 1);
    // engine: beams in front third
    let frontPlastic = 0, frontWeight = 0, cabinPlastic = 0, cabinWeight = 0;
    for (const beam of this.body.beams) {
      const A = this.body.nodes[beam.a], B = this.body.nodes[beam.b];
      const z = (A.z + B.z) * 0.5;
      const dzMid = z - this.centerZ();
      if (dzMid > 0.7) { frontPlastic += beam.plastic * beam.rest; frontWeight += beam.rest; }
      if (Math.abs(dzMid) < 0.7) { cabinPlastic += beam.plastic * beam.rest; cabinWeight += beam.rest; }
    }
    const frontDmg = frontWeight ? frontPlastic / frontWeight : 0;
    this.damage.engine = clamp(frontDmg * 3.4, 0, 1);
    this.damage.chassis = clamp((cabinWeight ? cabinPlastic / cabinWeight : 0) * 2.6 + dmg.broken * 0.012, 0, 1);
    let wd = 0;
    for (const w of this.wheels) wd += w.damage;
    this.damage.wheels = wd / 4;
    this.damage.overall = clamp(this.damage.body * 0.45 + this.damage.engine * 0.25 + this.damage.wheels * 0.2 + this.damage.chassis * 0.1, 0, 1);

    // speed & g-force
    const v = this.body.velocity();
    const dvx = (v.x - this._prevVel.x) / h, dvy = (v.y - this._prevVel.y) / h, dvz = (v.z - this._prevVel.z) / h;
    this._prevVel = { x: v.x, y: v.y, z: v.z };
    const k = Math.min(1, h * 12);
    this._accelSmooth.x += (dvx - this._accelSmooth.x) * k;
    this._accelSmooth.y += (dvy - this._accelSmooth.y) * k;
    this._accelSmooth.z += (dvz - this._accelSmooth.z) * k;
    const f = this.frame.fwd, r = this.frame.right;
    const gl = (this._accelSmooth.x * f.x + this._accelSmooth.z * f.z) / 9.81;
    const gLat = (this._accelSmooth.x * r.x + this._accelSmooth.z * r.z) / 9.81;
    this.gforce.x += (gLat - this.gforce.x) * Math.min(1, h * 10);
    this.gforce.z += (gl - this.gforce.z) * Math.min(1, h * 10);
    const gmag = Math.hypot(this.gforce.x, this.gforce.z);
    if (gmag > this.gforce.peak) this.gforce.peak = gmag;
    this.speedKph = Math.abs(this.forwardSpeedKph());

    // grounding / air time
    let contactCount = 0;
    for (const w of this.wheels) if (w.contact) contactCount++;
    this.grounded = contactCount;
    if (contactCount === 0) this.airTime += h; else this.airTime = 0;

    // impact handling
    if (this.solver.impactSpeed > 3.2 && this.impactCooldown <= 0) {
      this.registerImpact(this.solver.impactSpeed);
      this.impactCooldown = 0.22;
    }
    if (this.impactCooldown > 0) this.impactCooldown -= h;

    // wheel damage on landings
    for (const w of this.wheels) {
      if (w.contact && w.load > 0) {
        const hard = Math.max(0, (w.load / this.spec.mass / 9.81) - 2.3);
        if (hard > 0) w.damage = clamp(w.damage + hard * h * 0.05, 0, 1);
      }
    }
  }

  registerImpact(speed) {
    const imp = speed;
    this.lastImpact = imp;
    this.events.push({ type: 'impact', speed: imp, pos: this.body.center() });
    if (imp > 4.5) {
      const pts = Math.min(2400, Math.pow(imp - 3.0, 2.1) * 1.6);
      this.crashScore += pts;
      this.gforce.peak = Math.max(this.gforce.peak, imp / 9.81 * 0.9);
    }
  }

  centerZ() {
    // rough longitudinal centre of the body
    let z = 0;
    for (const n of this.body.nodes) z += n.z;
    return z / this.body.nodes.length;
  }

  repair() {
    const g = this.spawnPos;
    const pick = this.colliders && this.colliders.ground;
    this.place(g.x, g.z, g.yaw, (x, z) => (pick ? pick.height(x, z) : 0));
  }
}

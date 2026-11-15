import * as THREE from 'three';
import { clamp, smoothstep, lerp, TAU, rand } from './util.js';

/* ============================================================
   CAR DEFINITIONS
   local space: +Z forward, +X right, +Y up, origin at ground centre
   ============================================================ */

export const CAR_SPECS = [
  {
    id: 'sedan',
    name: 'Gavril Grand',
    cls: 'SEDAN · BALANCED',
    sub: '2.0T I4 · AWD',
    color: 0x2f6fd0,
    colorName: 'Cobalt Blue',
    length: 4.62, width: 1.86, height: 1.46, wheelbase: 2.72, track: 1.58,
    wheelR: 0.35, wheelW: 0.25,
    mass: 1420, comY: 0.60,
    power: 168, topSpeed: 59, grip: 1.06, steerMax: 0.62,
    suspK: 31000, suspC: 2700, dampR: 0.34,
    awd: true, brake: 0.9,
    beltline: 0.98, cabinRear: -1.28, cabinFront: 1.18,
    stats: { speed: 0.68, power: 0.55, grip: 0.66, weight: 0.36 },
    stations: [
      { z: -2.32, w: 0.72, y0: 0.44, y1: 0.92, taper: 0.8, n: 3.0 },
      { z: -2.10, w: 0.87, y0: 0.34, y1: 1.00, taper: 0.5, n: 3.2 },
      { z: -1.85, w: 0.925, y0: 0.30, y1: 1.02, taper: 0.2, n: 3.4 },
      { z: -1.45, w: 0.93, y0: 0.30, y1: 1.06, taper: 0.12, n: 3.6 },
      { z: -1.28, w: 0.93, y0: 0.30, y1: 1.24, taper: 0.14, n: 3.8 },
      { z: -1.05, w: 0.93, y0: 0.30, y1: 1.40, taper: 0.2, n: 4.0 },
      { z: -0.55, w: 0.93, y0: 0.30, y1: 1.445, taper: 0.22, n: 4.0 },
      { z: 0.25, w: 0.93, y0: 0.30, y1: 1.45, taper: 0.22, n: 4.0 },
      { z: 0.62, w: 0.925, y0: 0.30, y1: 1.435, taper: 0.2, n: 3.9 },
      { z: 0.80, w: 0.925, y0: 0.31, y1: 1.34, taper: 0.16, n: 3.8 },
      { z: 1.02, w: 0.92, y0: 0.31, y1: 1.14, taper: 0.1, n: 3.5 },
      { z: 1.18, w: 0.915, y0: 0.32, y1: 1.00, taper: 0.05, n: 3.3 },
      { z: 1.55, w: 0.90, y0: 0.33, y1: 0.975, taper: 0.03, n: 3.2 },
      { z: 1.95, w: 0.875, y0: 0.34, y1: 0.955, taper: 0.02, n: 3.2 },
      { z: 2.15, w: 0.84, y0: 0.37, y1: 0.93, taper: 0.04, n: 3.1 },
      { z: 2.28, w: 0.74, y0: 0.42, y1: 0.86, taper: 0.12, n: 2.9 },
      { z: 2.33, w: 0.60, y0: 0.46, y1: 0.80, taper: 0.2, n: 2.8 },
    ],
    detail: { spoiler: false, roofRack: false, grille: 1, lightY: 0.71, exhaust: 2, twoTone: false },
  },
  {
    id: 'sport',
    name: 'Civetta Bolide',
    cls: 'SPORTS · RWD',
    sub: '4.2 V8 · ITB',
    color: 0xd8342a,
    colorName: 'Rosso Corso',
    length: 4.42, width: 1.94, height: 1.20, wheelbase: 2.62, track: 1.66,
    wheelR: 0.355, wheelW: 0.28,
    mass: 1280, comY: 0.50,
    power: 342, topSpeed: 74, grip: 1.22, steerMax: 0.58,
    suspK: 34000, suspC: 3000, dampR: 0.30,
    awd: false, brake: 1.05,
    beltline: 0.83, cabinRear: -1.12, cabinFront: 0.98,
    stats: { speed: 0.94, power: 0.92, grip: 0.85, weight: 0.52 },
    stations: [
      { z: -2.22, w: 0.78, y0: 0.36, y1: 0.78, taper: 0.5, n: 2.8 },
      { z: -2.02, w: 0.90, y0: 0.28, y1: 0.86, taper: 0.25, n: 3.0 },
      { z: -1.68, w: 0.95, y0: 0.25, y1: 0.88, taper: 0.1, n: 3.2 },
      { z: -1.22, w: 0.96, y0: 0.25, y1: 0.99, taper: 0.12, n: 3.3 },
      { z: -0.78, w: 0.965, y0: 0.25, y1: 1.16, taper: 0.18, n: 3.3 },
      { z: -0.25, w: 0.97, y0: 0.25, y1: 1.205, taper: 0.2, n: 3.3 },
      { z: 0.28, w: 0.965, y0: 0.25, y1: 1.19, taper: 0.2, n: 3.3 },
      { z: 0.72, w: 0.955, y0: 0.26, y1: 1.02, taper: 0.12, n: 3.2 },
      { z: 1.08, w: 0.945, y0: 0.27, y1: 0.90, taper: 0.05, n: 3.1 },
      { z: 1.55, w: 0.925, y0: 0.28, y1: 0.845, taper: 0.02, n: 3.2 },
      { z: 1.95, w: 0.89, y0: 0.32, y1: 0.80, taper: 0.02, n: 3.3 },
      { z: 2.15, w: 0.80, y0: 0.38, y1: 0.72, taper: 0.1, n: 3.0 },
      { z: 2.21, w: 0.64, y0: 0.42, y1: 0.66, taper: 0.15, n: 2.8 },
    ],
    detail: { spoiler: true, roofRack: false, grille: 0.7, lightY: 0.55, exhaust: 2, twoTone: false, low: true },
  },
  {
    id: 'van',
    name: 'Ibishu Pigeon',
    cls: 'MICRO VAN · FWD',
    sub: '0.8 I3 · TINY',
    color: 0xe4b53a,
    colorName: 'School Bus Yellow',
    length: 4.05, width: 1.76, height: 1.98, wheelbase: 2.46, track: 1.5,
    wheelR: 0.355, wheelW: 0.23,
    mass: 1010, comY: 0.82,
    power: 96, topSpeed: 47, grip: 0.96, steerMax: 0.7,
    suspK: 24000, suspC: 2300, dampR: 0.36,
    awd: false, brake: 0.85,
    beltline: 1.05, cabinRear: -1.9, cabinFront: 1.38,
    stats: { speed: 0.42, power: 0.3, grip: 0.58, weight: 0.75 },
    stations: [
      { z: -2.02, w: 0.70, y0: 0.38, y1: 1.85, taper: 0.12, n: 3.4 },
      { z: -1.90, w: 0.86, y0: 0.32, y1: 1.97, taper: 0.14, n: 3.8 },
      { z: -1.45, w: 0.88, y0: 0.30, y1: 1.99, taper: 0.15, n: 4.0 },
      { z: -0.35, w: 0.88, y0: 0.30, y1: 2.00, taper: 0.16, n: 4.0 },
      { z: 0.85, w: 0.88, y0: 0.30, y1: 1.99, taper: 0.16, n: 4.0 },
      { z: 1.28, w: 0.875, y0: 0.30, y1: 1.83, taper: 0.12, n: 3.7 },
      { z: 1.50, w: 0.86, y0: 0.31, y1: 1.42, taper: 0.06, n: 3.3 },
      { z: 1.82, w: 0.84, y0: 0.33, y1: 1.08, taper: 0.04, n: 3.2 },
      { z: 2.00, w: 0.78, y0: 0.37, y1: 0.99, taper: 0.06, n: 3.0 },
      { z: 2.06, w: 0.64, y0: 0.4, y1: 0.92, taper: 0.1, n: 2.9 },
    ],
    detail: { spoiler: false, roofRack: true, grille: 0.6, lightY: 0.72, exhaust: 1, twoTone: true },
  },
  {
    id: 'muscle',
    name: 'Bruckell Moonhawk',
    cls: 'MUSCLE · RWD',
    sub: '6.4 V8 · LOUD',
    color: 0x1f8a5b,
    colorName: 'Highland Green',
    length: 4.92, width: 1.98, height: 1.38, wheelbase: 2.86, track: 1.64,
    wheelR: 0.37, wheelW: 0.28,
    mass: 1680, comY: 0.58,
    power: 296, topSpeed: 66, grip: 1.02, steerMax: 0.6,
    suspK: 33000, suspC: 2900, dampR: 0.33,
    awd: false, brake: 0.92,
    beltline: 0.93, cabinRear: -1.25, cabinFront: 1.12,
    stats: { speed: 0.8, power: 0.85, grip: 0.7, weight: 0.3 },
    stations: [
      { z: -2.46, w: 0.8, y0: 0.40, y1: 0.95, taper: 0.5, n: 2.9 },
      { z: -2.24, w: 0.94, y0: 0.32, y1: 1.02, taper: 0.22, n: 3.1 },
      { z: -1.85, w: 0.99, y0: 0.28, y1: 1.04, taper: 0.1, n: 3.4 },
      { z: -1.35, w: 0.99, y0: 0.28, y1: 1.36, taper: 0.14, n: 3.5 },
      { z: -0.75, w: 0.99, y0: 0.28, y1: 1.40, taper: 0.16, n: 3.4 },
      { z: -0.05, w: 0.99, y0: 0.28, y1: 1.40, taper: 0.16, n: 3.4 },
      { z: 0.55, w: 0.99, y0: 0.28, y1: 1.33, taper: 0.14, n: 3.3 },
      { z: 0.95, w: 0.985, y0: 0.29, y1: 1.12, taper: 0.07, n: 3.1 },
      { z: 1.35, w: 0.98, y0: 0.30, y1: 1.00, taper: 0.03, n: 3.2 },
      { z: 1.85, w: 0.96, y0: 0.31, y1: 0.98, taper: 0.02, n: 3.3 },
      { z: 2.30, w: 0.94, y0: 0.32, y1: 0.95, taper: 0.02, n: 3.3 },
      { z: 2.44, w: 0.82, y0: 0.38, y1: 0.88, taper: 0.1, n: 3.0 },
      { z: 2.48, w: 0.68, y0: 0.43, y1: 0.82, taper: 0.15, n: 2.8 },
    ],
    detail: { spoiler: false, roofRack: false, grille: 1.2, lightY: 0.66, exhaust: 2, twoTone: false, hoodScoop: true },
  },
];

/* ============================================================
   SHELL — soft, plastically deformable skin lattice
   ============================================================ */
export class Shell {
  constructor(positions, edges, cageTest) {
    const n = positions.length / 3;
    this.nodes = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const cage = cageTest ? cageTest(p) : false;
      this.nodes.push({
        pos: p.clone(),
        home: p.clone(),
        orig: p.clone(),
        vel: new THREE.Vector3(),
        cage,
        k: cage ? 330 : 190,
        c: cage ? 15 : 8,
      });
    }
    this.edges = [];
    for (const [a, b] of edges) {
      const rest = this.nodes[a].orig.distanceTo(this.nodes[b].orig);
      this.edges.push([a, b, rest]);
    }
    this.maxDisp = 0;
    this.avgDisp = 0;
  }

  deform(center, dir, amount, radius, jitter = 0.55) {
    const c = center;
    for (const nd of this.nodes) {
      const d = nd.pos.distanceTo(c);
      if (d > radius) continue;
      const t = 1 - d / radius;
      const w = t * t * (3 - 2 * t);
      const cageScale = nd.cage ? 0.32 : 1;
      // crater centre pushes in, rim bulges out — reads as sheet-metal buckling
      const sign = d < radius * 0.62 ? 1 : -0.22;
      const push = amount * w * cageScale * sign;
      // vertical buckling: hood/roof lifts, floor drops
      const buckle = (nd.orig.y - 0.78) * 0.55 * amount * w * cageScale;
      const nx = dir.x * push + (Math.random() - 0.5) * push * jitter;
      const ny = dir.y * push + (Math.random() - 0.5) * push * jitter + buckle;
      const nz = dir.z * push + (Math.random() - 0.5) * push * jitter;
      nd.pos.x += nx * 1.6; nd.pos.y += ny * 1.6; nd.pos.z += nz * 1.6;
      nd.home.x += nx * 0.88; nd.home.y += ny * 0.88; nd.home.z += nz * 0.88;
      nd.vel.x += nx * 4; nd.vel.y += ny * 4; nd.vel.z += nz * 4;
      // home can't drift absurdly far from original
      const drift = nd.home.distanceTo(nd.orig);
      if (drift > 0.62) nd.home.sub(nd.orig).multiplyScalar(0.62 / drift).add(nd.orig);
    }
  }

  update(dt) {
    dt = Math.min(dt, 1 / 45);
    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      nd.vel.x += ((nd.home.x - nd.pos.x) * nd.k - nd.vel.x * nd.c) * dt;
      nd.vel.y += ((nd.home.y - nd.pos.y) * nd.k - nd.vel.y * nd.c) * dt;
      nd.vel.z += ((nd.home.z - nd.pos.z) * nd.k - nd.vel.z * nd.c) * dt;
      nd.pos.x += nd.vel.x * dt;
      nd.pos.y += nd.vel.y * dt;
      nd.pos.z += nd.vel.z * dt;
    }
    // distance constraints (structural)
    for (let it = 0; it < 2; it++) {
      for (let e = 0; e < this.edges.length; e++) {
        const [a, b, rest] = this.edges[e];
        const A = nodes[a], B = nodes[b];
        const dx = B.pos.x - A.pos.x, dy = B.pos.y - A.pos.y, dz = B.pos.z - A.pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5;
        const diff = (d - rest) / d * 0.42;
        const ox = dx * diff, oy = dy * diff, oz = dz * diff;
        A.pos.x += ox; A.pos.y += oy; A.pos.z += oz;
        B.pos.x -= ox; B.pos.y -= oy; B.pos.z -= oz;
      }
    }
    let maxD = 0, sumD = 0;
    for (const nd of nodes) {
      const dx = nd.pos.x - nd.orig.x, dy = nd.pos.y - nd.orig.y, dz = nd.pos.z - nd.orig.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > this.maxDisp) this.maxDisp = d;
      sumD += d;
    }
    this.avgDisp = sumD / nodes.length;
  }

  applyToGeometry(geo) {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i].pos;
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  /* displacement of a local point, weighted by 4 nearest nodes */
  displacementAt(localPos, out = new THREE.Vector3()) {
    const nodes = this.nodes;
    out.set(0, 0, 0);
    let total = 0;
    const best = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i].orig.distanceToSquared(localPos);
      if (best.length < 5) {
        best.push([d, i]);
        best.sort((a, b) => a[0] - b[0]);
      } else if (d < best[4][0]) {
        best[4] = [d, i];
        best.sort((a, b) => a[0] - b[0]);
      }
    }
    for (const [d, i] of best) {
      const w = 1 / (d + 0.02);
      const nd = nodes[i];
      out.x += (nd.pos.x - nd.orig.x) * w;
      out.y += (nd.pos.y - nd.orig.y) * w;
      out.z += (nd.pos.z - nd.orig.z) * w;
      total += w;
    }
    return out.multiplyScalar(1 / Math.max(total, 1e-5));
  }
}

/* ============================================================
   MESH BUILDER
   ============================================================ */

function sampleStations(keys, count) {
  const out = [];
  const zMin = keys[0].z, zMax = keys[keys.length - 1].z;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const z = lerp(zMin, zMax, t);
    let k = 0;
    while (k < keys.length - 2 && z > keys[k + 1].z) k++;
    const A = keys[k], B = keys[k + 1];
    let f = (z - A.z) / (B.z - A.z);
    f = f * f * (3 - 2 * f);
    out.push({
      z,
      w: lerp(A.w, B.w, f),
      y0: lerp(A.y0, B.y0, f),
      y1: lerp(A.y1, B.y1, f),
      taper: lerp(A.taper, B.taper, f),
      n: lerp(A.n, B.n, f),
    });
  }
  return out;
}

export function buildCar(spec, options = {}) {
  const paintColor = options.color ?? spec.color;
  const STATIONS = 30;
  const A = 26;
  const stations = sampleStations(spec.stations, STATIONS);
  const L = spec.length;

  const num = STATIONS * A + 2;
  const positions = new Float32Array(num * 3);
  const nodeEdges = [];

  const ringIndex = (s, a) => s * A + ((a + A) % A);
  const frontCap = STATIONS * A;
  const rearCap = STATIONS * A + 1;

  for (let s = 0; s < STATIONS; s++) {
    const st = stations[s];
    const cy = (st.y0 + st.y1) / 2;
    const ry = (st.y1 - st.y0) / 2;
    for (let a = 0; a < A; a++) {
      const ang = (a / A) * TAU;
      const co = Math.cos(ang), si = Math.sin(ang);
      const xr = Math.sign(co || 1) * Math.pow(Math.abs(co), 2 / st.n);
      const yr = Math.sign(si || 1) * Math.pow(Math.abs(si), 2 / st.n);
      const t = (yr + 1) / 2;
      const tuck = 0.66 + 0.34 * smoothstep(0.0, 0.30, t);
      const taper = (1 - st.taper * smoothstep(0.42, 1.0, t)) * tuck;
      const idx = (s * A + a) * 3;
      positions[idx] = st.w * xr * taper;
      positions[idx + 1] = cy + ry * yr;
      positions[idx + 2] = st.z;
    }
  }
  // caps
  const first = stations[0], last = stations[STATIONS - 1];
  positions[frontCap * 3] = 0;
  positions[frontCap * 3 + 1] = (last.y0 + last.y1) / 2;
  positions[frontCap * 3 + 2] = last.z;
  positions[rearCap * 3] = 0;
  positions[rearCap * 3 + 1] = (first.y0 + first.y1) / 2;
  positions[rearCap * 3 + 2] = first.z;

  // structural edges
  for (let s = 0; s < STATIONS; s++) {
    for (let a = 0; a < A; a++) {
      nodeEdges.push([ringIndex(s, a), ringIndex(s, a + 1)]);
      if (s < STATIONS - 1) nodeEdges.push([ringIndex(s, a), ringIndex(s + 1, a)]);
    }
  }
  for (let a = 0; a < A; a++) {
    nodeEdges.push([frontCap, ringIndex(STATIONS - 1, a)]);
    nodeEdges.push([rearCap, ringIndex(0, a)]);
  }

  // geometry with per-face material groups
  const verts = Array.from(positions);
  const paintIdx = [], glassIdx = [], trimIdx = [];
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const nrm = new THREE.Vector3(), cen = new THREE.Vector3();

  // glass mask per lattice vertex so window edges follow the mesh cleanly
  const glassMask = new Uint8Array(STATIONS * A);
  for (let s = 0; s < STATIONS; s++) {
    const st = stations[s];
    for (let a = 0; a < A; a++) {
      const i = s * A + a;
      const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
      if (z < spec.cabinRear || z > spec.cabinFront) continue;
      if (y < spec.beltline + 0.02) continue;
      const side = Math.abs(x) > spec.width * 0.33;
      const windshield = z > spec.cabinFront - 0.6;
      const rearGlass = z < spec.cabinRear + 0.78 && z > spec.cabinRear - 0.52;
      if (windshield || rearGlass) { if (y > spec.beltline - 0.2) glassMask[i] = 1; continue; }
      if (side && y < st.y1 - 0.09) glassMask[i] = 1;
    }
  }

  for (let s = 0; s < STATIONS - 1; s++) {
    const stA = stations[s], stB = stations[s + 1];
    const sectionCy = ((stA.y0 + stA.y1) + (stB.y0 + stB.y1)) / 4;
    for (let a = 0; a < A; a++) {
      const ia = ringIndex(s, a), ib = ringIndex(s, a + 1);
      const ic = ringIndex(s + 1, a + 1), id = ringIndex(s + 1, a);
      // choose outward winding using the quad normal vs the section centre
      v0.fromArray(verts, ia * 3); v1.fromArray(verts, ib * 3); v2.fromArray(verts, ic * 3);
      const nA = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0)).normalize();
      cen.copy(v0).add(v1).add(v2).add(new THREE.Vector3().fromArray(verts, id * 3)).multiplyScalar(0.25);
      const radial = new THREE.Vector3(cen.x, cen.y - sectionCy, 0);
      let ids;
      if (nA.dot(radial) < 0) ids = [ia, ic, ib, ia, id, ic];
      else ids = [ia, ib, ic, ia, ic, id];
      if (glassMask[ia] && glassMask[ib] && glassMask[ic] && glassMask[id]) glassIdx.push(...ids);
      else if (cen.y < spec.beltline - 0.46) trimIdx.push(...ids);
      else if ((cen.z > L / 2 - 0.2 || cen.z < -L / 2 + 0.2) && cen.y < spec.beltline - 0.16) trimIdx.push(...ids);
      else paintIdx.push(...ids);
    }
  }
  // end caps painted; fascia details sit on top
  for (let a = 0; a < A; a++) {
    paintIdx.push(frontCap, ringIndex(STATIONS - 1, a), ringIndex(STATIONS - 1, a + 1));
    paintIdx.push(rearCap, ringIndex(0, a + 1), ringIndex(0, a));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const indices = [...paintIdx, ...glassIdx, ...trimIdx];
  geo.setIndex(indices);
  const vcols = new Float32Array(num * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(vcols, 3));
  geo.addGroup(0, paintIdx.length, 0);
  geo.addGroup(paintIdx.length, glassIdx.length, 1);
  geo.addGroup(paintIdx.length + glassIdx.length, trimIdx.length, 2);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const paintBase = new THREE.Color(paintColor);
  const damagedTint = new THREE.Color(0x4a4a44);
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paintColor, metalness: 0.32, roughness: 0.36,
    clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 1.45, vertexColors: true,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070d14, metalness: 0.22, roughness: 0.1, envMapIntensity: 1.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.66, metalness: 0.32 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d6, roughness: 0.22, metalness: 1.0 });

  const bodyMesh = new THREE.Mesh(geo, [paintMat, glassMat, trimMat]);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;

  const carGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  carGroup.add(bodyGroup);
  bodyGroup.add(bodyMesh);

  // cage test: greenhouse + cabin floor are stiff
  const shell = new Shell(positions, nodeEdges, (p) => {
    const inCabin = p.z > spec.cabinRear - 0.1 && p.z < spec.cabinFront + 0.25 && p.y > spec.beltline - 0.12;
    const isRoof = p.y > spec.beltline + 0.25 && Math.abs(p.x) < spec.width * 0.34;
    return inCabin || isRoof;
  });

  /* -------- helper to make attachments that follow the crumpling shell -------- */
  const attachments = [];
  function bindWeights(base) {
    const best = [];
    for (let i = 0; i < shell.nodes.length; i++) {
      const d = shell.nodes[i].orig.distanceToSquared(base);
      if (best.length < 4) { best.push([d, i]); best.sort((a, b) => a[0] - b[0]); }
      else if (d < best[3][0]) { best[3] = [d, i]; best.sort((a, b) => a[0] - b[0]); }
    }
    const ws = best.map(([d, i]) => [i, 1 / (d + 0.05)]);
    const total = ws.reduce((a, b) => a + b[1], 0);
    return ws.map(([i, w]) => [i, w / total]);
  }
  function attach(mesh, localPos, shadows = true) {
    mesh.position.copy(localPos);
    mesh.castShadow = shadows;
    mesh.receiveShadow = false;
    bodyGroup.add(mesh);
    attachments.push({ mesh, base: localPos.clone(), weights: bindWeights(localPos) });
    return mesh;
  }

  const front = stations[STATIONS - 1].z, rear = stations[0].z;
  const trim = trimMat, chrome = chromeMat;

  /* grille */
  const grille = attach(new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.46 * (spec.detail.grille || 1), 0.2, 0.06), trim), new THREE.Vector3(0, spec.detail.lightY - 0.2, front + 0.005));
  // grille slats
  for (let i = -2; i <= 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.115, 0.02), chrome);
    slat.position.set(i * 0.055 * (spec.detail.grille || 1), 0, 0.03);
    grille.add(slat);
  }

  /* headlights */
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5f0dd, emissive: 0xffe9b8, emissiveIntensity: 0.4, roughness: 0.12, metalness: 0.2 });
  const headDim = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.4, metalness: 0.5 });
  const lights = [];
  const hx = spec.width * 0.29;
  for (const sx of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.06), headDim);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.078, 0.03), headMat);
    lens.position.set(0, 0, 0.038);
    housing.add(lens);
    housing.position.set(sx * hx, spec.detail.lightY, front + 0.005);
    housing.rotation.y = sx * 0.06;
    attach(housing, housing.position.clone());
  }

  /* taillights */
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x6d0d08, emissive: 0xff1a08, emissiveIntensity: 0.55, roughness: 0.25 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.62, 0.1, 0.04), tailMat);
  attach(tail, new THREE.Vector3(0, spec.detail.lightY + 0.02, rear - 0.03));
  const tailInner = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.28, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
  tailInner.position.set(0, -0.01, -0.03);
  tailInner.visible = false;
  tail.add(tailInner);
  // number plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.6 }));
  attach(plate, new THREE.Vector3(0, Math.max(0.35, spec.beltline - 0.44), rear - 0.025));

  /* bumpers */
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.74, 0.12, 0.09), trim);
  attach(bumperF, new THREE.Vector3(0, stations[STATIONS - 1].y0 + 0.03, front - 0.015));
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.78, 0.12, 0.09), trim);
  attach(bumperR, new THREE.Vector3(0, stations[0].y0 + 0.02, rear - 0.02));

  /* side skirts */
  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, spec.wheelbase * 0.86), trim);
    attach(skirt, new THREE.Vector3(sx * (spec.width * 0.46), 0.33, 0));
  }

  /* wheel arches */
  const archMat = new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide });
  const wheelZ = spec.wheelbase / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.RingGeometry(spec.wheelR * 1.06, spec.wheelR * 1.42, 20, 1, 0, Math.PI), archMat);
      arch.rotation.y = sx * Math.PI / 2;
      arch.rotation.z = 0;
      const pos = new THREE.Vector3(sx * (spec.width * 0.44), spec.wheelR, sz * wheelZ);
      attach(arch, pos, false);
    }
  }

  /* mirrors */
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), trim);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), glassMat);
    glass.position.x = sx * 0.06;
    arm.add(glass);
    attach(arm, new THREE.Vector3(sx * (spec.width * 0.51), spec.beltline + 0.08, spec.cabinFront - 0.3));
  }

  /* exhausts */
  for (let i = 0; i < (spec.detail.exhaust || 1); i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x6d747b, roughness: 0.35, metalness: 0.9 }));
    pipe.rotation.x = Math.PI / 2;
    const ox = (i - ((spec.detail.exhaust || 1) - 1) / 2) * 0.46;
    attach(pipe, new THREE.Vector3(ox, Math.max(0.3, spec.beltline - 0.5), rear - 0.03));
  }

  if (spec.detail.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.8, 0.04, 0.28), trim);
    const standL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.12), trim);
    const standR = standL.clone();
    standL.position.set(-spec.width * 0.3, -0.09, 0);
    standR.position.set(spec.width * 0.3, -0.09, 0);
    wing.add(standL, standR);
    attach(wing, new THREE.Vector3(0, spec.beltline + 0.12, rear + 0.18));
  }
  if (spec.detail.roofRack) {
    const rack = new THREE.Group();
    for (const sx of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.6), trim);
      bar.position.set(sx * 0.35, 0, 0);
      rack.add(bar);
    }
    for (const sz of [-1, 1]) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.035, 0.035), trim);
      cross.position.z = sz * 0.7;
      rack.add(cross);
    }
    attach(rack, new THREE.Vector3(0, spec.height - 0.04, -0.4));
  }
  if (spec.detail.hoodScoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), trim);
    attach(scoop, new THREE.Vector3(0, spec.beltline - 0.03, 1.28));
  }
  if (spec.detail.twoTone) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: 0xefe7d2, roughness: 0.45 }));
    attach(stripe, new THREE.Vector3(0, spec.beltline + 0.28, spec.cabinFront - 0.02));
  }

  /* ============ WHEELS ============ */
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0e1012, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c2c9, roughness: 0.26, metalness: 0.95 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.5, metalness: 0.7 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3c4045, roughness: 0.5, metalness: 0.6 });

  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const isFront = i < 2;
    const sx = i % 2 === 0 ? -1 : 1;
    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    pivot.add(spin);
    carGroup.add(pivot);

    const tireGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, spec.wheelW, 22, 1);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spin.add(tire);

    const rimGeo = new THREE.CylinderGeometry(spec.wheelR * 0.62, spec.wheelR * 0.62, spec.wheelW * 1.02, 18, 1);
    rimGeo.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(rimGeo, rimMat));

    // spokes
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(spec.wheelW * 1.04, spec.wheelR * 0.85, 0.035), rimDark);
      spoke.rotation.x = (k / 5) * TAU;
      spin.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheelR * 0.2, spec.wheelR * 0.2, spec.wheelW * 1.12, 12), chrome);
    hub.rotation.z = Math.PI / 2;
    spin.add(hub);

    const brake = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheelR * 0.55, spec.wheelR * 0.55, spec.wheelW * 0.5, 16), brakeMat);
    brake.rotation.z = Math.PI / 2;
    spin.add(brake);

    wheels.push({
      pivot, spin, isFront, side: sx,
      local: new THREE.Vector3(sx * (spec.track / 2), spec.wheelR, isFront ? wheelZ : -wheelZ),
      steer: 0, spinAngle: 0, ext: 0.26, spinVel: 0,
      contact: false, slip: 0, groundY: 0, normal: new THREE.Vector3(0, 1, 0),
      worldContact: new THREE.Vector3(), load: 0, broken: false,
    });
  }

  /* cleanup on destroyed */
  function dispose() {
    geo.dispose();
    [paintMat, glassMat, trimMat, chromeMat, headMat, headDim, tailMat, tireMat, rimMat, rimDark, brakeMat].forEach(m => m.dispose());
  }

  return {
    spec, carGroup, bodyGroup, bodyMesh, geo, shell, wheels, attachments, tailMat, headMat, paintMat,
    centerLocal: new THREE.Vector3(0, spec.comY, 0),
    tailInner, dispose,
    applyDamageLook(damage) {
      const d = Math.min(1, Math.max(0, damage / 100));
      paintMat.color.copy(paintBase).lerp(damagedTint, d * 0.5);
      paintMat.roughness = 0.36 + d * 0.4;
      paintMat.clearcoat = 0.85 * (1 - d * 0.75);
      glassMat.opacity = 1;
    },
    updateShell(dt) {
      shell.update(dt);
      shell.applyToGeometry(geo);
      const colArr = geo.attributes.color.array;
      for (let i = 0; i < shell.nodes.length; i++) {
        const nd = shell.nodes[i];
        const disp = nd.pos.distanceTo(nd.orig);
        let g = 1;
        if (disp > 0.035) {
          const t = Math.min(1, (disp - 0.035) / 0.3);
          const n = 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
          g = 1 - t * (0.28 + 0.34 * n);
        }
        colArr[i * 3] = g;
        colArr[i * 3 + 1] = g * 0.97;
        colArr[i * 3 + 2] = g * 0.92;
      }
      geo.attributes.color.needsUpdate = true;
      for (const at of attachments) {
        let dx = 0, dy = 0, dz = 0;
        for (const [i, w] of at.weights) {
          const nd = shell.nodes[i];
          dx += (nd.pos.x - nd.orig.x) * w;
          dy += (nd.pos.y - nd.orig.y) * w;
          dz += (nd.pos.z - nd.orig.z) * w;
        }
        at.mesh.position.set(at.base.x + dx, at.base.y + dy, at.base.z + dz);
      }
    },
  };
}

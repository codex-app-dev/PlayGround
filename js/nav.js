import { MAP } from './map.js';

class MinHeap {
  constructor() { this.a = []; }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export class NavGrid {
  constructor(worldSize = 150, cell = 2) {
    this.min = -worldSize / 2;
    this.cell = cell;
    this.n = Math.floor(worldSize / cell);
    this.counts = new Int16Array(this.n * this.n);
    this.tmpG = new Float32Array(this.n * this.n);
    this.tmpCame = new Int32Array(this.n * this.n);
    this.tmpClosed = new Uint8Array(this.n * this.n);
    this.marked = [];
  }

  idx(cx, cz) { return cz * this.n + cx; }
  inBounds(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.n && cz < this.n; }
  worldToCell(x, z) {
    return {
      cx: Math.max(0, Math.min(this.n - 1, Math.floor((x - this.min) / this.cell))),
      cz: Math.max(0, Math.min(this.n - 1, Math.floor((z - this.min) / this.cell))),
    };
  }
  cellToWorld(cx, cz) {
    return { x: this.min + (cx + 0.5) * this.cell, z: this.min + (cz + 0.5) * this.cell };
  }
  cellOf(ix, iz) { return this.counts[ix + iz * this.n] > 0; }
  isBlockedWorld(x, z) {
    const { cx, cz } = this.worldToCell(x, z);
    return !this.inBounds(cx, cz) || this.counts[this.idx(cx, cz)] > 0;
  }

  addCircle(x, z, radius) {
    const minX = Math.floor((x - radius - this.min) / this.cell);
    const maxX = Math.floor((x + radius - this.min) / this.cell);
    const minZ = Math.floor((z - radius - this.min) / this.cell);
    const maxZ = Math.floor((z + radius - this.min) / this.cell);
    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        const p = this.cellToWorld(ix, iz);
        if (Math.hypot(p.x - x, p.z - z) <= radius + this.cell * 0.18) {
          this.counts[this.idx(ix, iz)]++;
        }
      }
    }
  }

  removeCircle(x, z, radius) {
    const minX = Math.floor((x - radius - this.min) / this.cell);
    const maxX = Math.floor((x + radius - this.min) / this.cell);
    const minZ = Math.floor((z - radius - this.min) / this.cell);
    const maxZ = Math.floor((z + radius - this.min) / this.cell);
    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        const p = this.cellToWorld(ix, iz);
        if (Math.hypot(p.x - x, p.z - z) <= radius + this.cell * 0.18) {
          const i = this.idx(ix, iz);
          if (this.counts[i] > 0) this.counts[i]--;
        }
      }
    }
  }

  addRect(x, z, hw, hd) {
    const minX = Math.floor((x - hw - this.min) / this.cell);
    const maxX = Math.floor((x + hw - this.min) / this.cell);
    const minZ = Math.floor((z - hd - this.min) / this.cell);
    const maxZ = Math.floor((z + hd - this.min) / this.cell);
    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        this.counts[this.idx(ix, iz)]++;
      }
    }
  }

  removeRect(x, z, hw, hd) {
    const minX = Math.floor((x - hw - this.min) / this.cell);
    const maxX = Math.floor((x + hw - this.min) / this.cell);
    const minZ = Math.floor((z - hd - this.min) / this.cell);
    const maxZ = Math.floor((z + hd - this.min) / this.cell);
    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        const i = this.idx(ix, iz);
        if (this.counts[i] > 0) this.counts[i]--;
      }
    }
  }

  nearestFreeCell(cx, cz, maxRadius = 18) {
    if (this.inBounds(cx, cz) && this.counts[this.idx(cx, cz)] === 0) return { cx, cz };
    for (let r = 1; r <= maxRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (this.inBounds(nx, nz) && this.counts[this.idx(nx, nz)] === 0) return { cx: nx, cz: nz };
        }
      }
    }
    return { cx, cz };
  }

  nearestFreePoint(x, z, maxRadius = 30) {
    const c = this.worldToCell(x, z);
    const f = this.nearestFreeCell(c.cx, c.cz, maxRadius);
    return this.cellToWorld(f.cx, f.cz);
  }

  hasLine(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.ceil(dist / (this.cell * 0.6)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.isBlockedWorld(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  findPath(sx, sz, tx, tz) {
    const start = this.worldToCell(sx, sz);
    let end = this.worldToCell(tx, tz);
    end = this.nearestFreeCell(end.cx, end.cz);
    if (start.cx === end.cx && start.cz === end.cz) {
      const p = this.cellToWorld(end.cx, end.cz);
      return [p];
    }
    const n = this.n;
    const g = this.tmpG;
    const came = this.tmpCame;
    const closed = this.tmpClosed;
    g.fill(Infinity);
    came.fill(-1);
    closed.fill(0);
    const startIdx = start.cx + start.cz * n;
    const endIdx = end.cx + end.cz * n;
    g[startIdx] = 0;
    const heap = new MinHeap();
    heap.push({ i: startIdx, f: Math.hypot(end.cx - start.cx, end.cz - start.cz) });
    let found = false;
    let guard = 0;
    while (heap.size && guard++ < 12000) {
      const node = heap.pop();
      const i = node.i;
      if (closed[i]) continue;
      if (i === endIdx) { found = true; break; }
      closed[i] = 1;
      const cx = i % n;
      const cz = (i / n) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (!this.inBounds(nx, nz)) continue;
          if (this.counts[nx + nz * n] > 0) continue;
          if (dx && dz) {
            if (this.counts[(cx + dx) + cz * n] > 0 || this.counts[cx + (cz + dz) * n] > 0) continue;
          }
          const ni = nx + nz * n;
          if (closed[ni]) continue;
          const cost = g[i] + (dx && dz ? 1.4142 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = i;
            const h = Math.hypot(end.cx - nx, end.cz - nz);
            heap.push({ i: ni, f: cost + h * 1.05 });
          }
        }
      }
    }
    if (!found) return [];
    const cells = [];
    let cur = endIdx;
    let guard2 = 0;
    while (cur !== -1 && guard2++ < 20000) {
      cells.push(cur);
      if (cur === startIdx) break;
      cur = came[cur];
    }
    cells.reverse();
    const pts = cells.map(i => this.cellToWorld(i % n, (i / n) | 0));
    // Smooth with line-of-sight checks.
    const out = [];
    let i = 0;
    out.push({ x: sx, z: sz });
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.hasLine(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    // Remove the initial point (unit already stands there).
    if (out.length > 1) out.shift();
    // Also drop points that are extremely close to the unit.
    while (out.length > 1 && Math.hypot(out[0].x - sx, out[0].z - sz) < 1.4) out.shift();
    return out;
  }
}

export function buildStaticBlockers(nav, layout) {
  // Map border.
  for (let i = 0; i < nav.n; i++) {
    nav.counts[i] = 1;
    nav.counts[i + (nav.n - 1) * nav.n] = 1;
    nav.counts[i * nav.n] = 1;
    nav.counts[(nav.n - 1) + i * nav.n] = 1;
  }
  // Pond, fountain and the rich central mine get blocked by the game entities.
  nav.addCircle(MAP.pond.x, MAP.pond.z, MAP.pond.radius);
  for (const r of layout.rocks) nav.addCircle(r.x, r.z, 0.9 * r.scale + 0.3);
  for (const t of layout.trees) nav.addCircle(t.x, t.z, 0.52 * t.scale + 0.35);
  // Keep the very edge of the play area clear of pathing.
  const edge = MAP.playable + 1;
  for (let iz = 0; iz < nav.n; iz++) {
    for (let ix = 0; ix < nav.n; ix++) {
      const p = nav.cellToWorld(ix, iz);
      if (Math.abs(p.x) > edge || Math.abs(p.z) > edge) nav.counts[ix + iz * nav.n] = 1;
    }
  }
}

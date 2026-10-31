// Small math helpers. No three.js dependency.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a))
export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v), 0, 1)
  return t * t * (3 - 2 * t)
}
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt))
export const mod = (n, m) => ((n % m) + m) % m
export const TAU = Math.PI * 2

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randRange = (rng, a, b) => a + rng() * (b - a)
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length]

export function shuffle(rng, arr) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Deterministic 2D value noise.
function hash2i(x, y) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2i(xi, yi)
  const b = hash2i(xi + 1, yi)
  const c = hash2i(xi, yi + 1)
  const d = hash2i(xi + 1, yi + 1)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

export function fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
export const angleDelta = (a, b) => {
  let d = mod(b - a + Math.PI, TAU) - Math.PI
  return d
}
export const degToRad = (d) => (d * Math.PI) / 180

// Ray vs axis-aligned box. Box: {minX,minY,minZ,maxX,maxY,maxZ}
export function rayAABB(ox, oy, oz, dx, dy, dz, box, maxDist = Infinity) {
  let tmin = 0
  let tmax = maxDist
  const axes = [
    [ox, dx, box.minX, box.maxX],
    [oy, dy, box.minY, box.maxY],
    [oz, dz, box.minZ, box.maxZ]
  ]
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null
    } else {
      let t1 = (lo - o) / d
      let t2 = (hi - o) / d
      if (t1 > t2) [t1, t2] = [t2, t1]
      if (t1 > tmin) tmin = t1
      if (t2 < tmax) tmax = t2
      if (tmin > tmax) return null
    }
  }
  return tmin
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius, maxDist = Infinity) {
  const lx = cx - ox
  const ly = cy - oy
  const lz = cz - oz
  const tca = lx * dx + ly * dy + lz * dz
  if (tca < 0) return null
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca
  const r2 = radius * radius
  if (d2 > r2) return null
  const thc = Math.sqrt(r2 - d2)
  let t = tca - thc
  if (t < 0) t = tca + thc
  return t <= maxDist ? t : null
}

export function pointInCircle(x, z, cx, cz, radius) {
  const dx = x - cx
  const dz = z - cz
  return dx * dx + dz * dz <= radius * radius
}

// Resolve a circle against an axis-aligned box in the XZ plane.
export function resolveCircleBox(px, pz, radius, box) {
  const nearestX = clamp(px, box.minX, box.maxX)
  const nearestZ = clamp(pz, box.minZ, box.maxZ)
  let dx = px - nearestX
  let dz = pz - nearestZ
  let d2 = dx * dx + dz * dz
  if (d2 >= radius * radius) return null
  if (d2 < 1e-8) {
    // Center is inside the box: push out through the closest edge.
    const left = px - box.minX
    const right = box.maxX - px
    const back = pz - box.minZ
    const front = box.maxZ - pz
    const min = Math.min(left, right, back, front)
    if (min === left) return { x: box.minX - radius, z: pz }
    if (min === right) return { x: box.maxX + radius, z: pz }
    if (min === back) return { x: px, z: box.minZ - radius }
    return { x: px, z: box.maxZ + radius }
  }
  const d = Math.sqrt(d2)
  const push = (radius - d) / d
  return { x: px + dx * push, z: pz + dz * push }
}

// Get a smooth deterministic height from a Float32Array grid.
export function sampleGrid(grid, size, cells, x, z) {
  const half = size / 2
  const gx = ((x + half) / size) * cells
  const gz = ((z + half) / size) * cells
  const x0 = Math.floor(gx)
  const z0 = Math.floor(gz)
  const fx = gx - x0
  const fz = gz - z0
  const cx = clamp(x0, 0, cells)
  const cz = clamp(z0, 0, cells)
  const cx1 = clamp(x0 + 1, 0, cells)
  const cz1 = clamp(z0 + 1, 0, cells)
  const s = cells + 1
  const h00 = grid[cz * s + cx]
  const h10 = grid[cz * s + cx1]
  const h01 = grid[cz1 * s + cx]
  const h11 = grid[cz1 * s + cx1]
  return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz)
}

// Weighted pick for loot.
export function weightedPick(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * total
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return entries[entries.length - 1]
}

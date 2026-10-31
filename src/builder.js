import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const UP = new THREE.Vector3(0, 1, 0)
const MAT = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()

const MATERIAL_DEFS = {
  concrete: { map: 'concrete', color: 0xd9d5c8, roughness: 0.94 },
  concreteDark: { map: 'concrete', color: 0x9d9a8f, roughness: 0.96 },
  foundation: { map: 'concrete', color: 0x7c7a70, roughness: 1 },
  plaster: { map: 'plaster', color: 0xe0d8c5, roughness: 0.92 },
  plasterWarm: { map: 'plaster', color: 0xd7bf99, roughness: 0.92 },
  plasterBlue: { map: 'plaster', color: 0xa9b9b4, roughness: 0.92 },
  wood: { map: 'wood', color: 0xb28a58, roughness: 0.88 },
  woodDark: { map: 'wood', color: 0x745536, roughness: 0.9 },
  woodPale: { map: 'wood', color: 0xc9ad7d, roughness: 0.88 },
  metal: { map: 'metal', color: 0xb2babe, metalness: 0.5, roughness: 0.52 },
  metalBlue: { map: 'metal', color: 0x78909c, metalness: 0.45, roughness: 0.55 },
  rust: { map: 'metal', color: 0x9b6544, metalness: 0.32, roughness: 0.8 },
  darkMetal: { color: 0x3d4347, metalness: 0.62, roughness: 0.48 },
  roof: { map: 'roof', color: 0x8b8f8e, roughness: 0.82 },
  roofRust: { map: 'roof', color: 0x9b7654, roughness: 0.86 },
  trim: { map: 'wood', color: 0x4a3927, roughness: 0.9 },
  trimPale: { color: 0xd9d2c0, roughness: 0.8 },
  glass: { color: 0xa8cfdd, transparent: true, opacity: 0.24, metalness: 0.65, roughness: 0.08, depthWrite: false },
  glassDark: { color: 0x1d2c33, transparent: true, opacity: 0.62, metalness: 0.7, roughness: 0.14, depthWrite: false },
  crate: { map: 'crate', color: 0xb69a6c, roughness: 0.9 },
  sandbag: { map: 'sandbag', color: 0xcdbd8e, roughness: 1 },
  fabric: { map: 'sandbag', color: 0x66714b, roughness: 1 },
  fabricTan: { map: 'sandbag', color: 0xa89465, roughness: 1 },
  asphalt: { map: 'asphalt', color: 0xffffff, roughness: 0.96 },
  orange: { color: 0xc85c1e, roughness: 0.72, metalness: 0.12 },
  white: { color: 0xe4e0d4, roughness: 0.82 },
  rock: { color: 0x8e8c82, roughness: 0.98, flatShading: true },
  green: { color: 0x52603d, roughness: 0.94 },
  gablePlaster: { map: 'plaster', color: 0xded6c3, roughness: 0.92, side: THREE.DoubleSide },
  gableWood: { map: 'wood', color: 0xa27c4f, roughness: 0.9, side: THREE.DoubleSide },
  gableMetal: { map: 'metal', color: 0xa4adb2, metalness: 0.45, roughness: 0.55, side: THREE.DoubleSide }
}

export class Builder {
  constructor(textures, world) {
    this.textures = textures
    this.world = world
    this.batches = new Map()
    this.materials = {}
    this.geometryCount = 0
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1)
    this.crateGeo = new THREE.BoxGeometry(1, 1, 1)
  }

  getMaterial(key) {
    if (this.materials[key]) return this.materials[key]
    const def = MATERIAL_DEFS[key] || MATERIAL_DEFS.concrete
    const params = { color: def.color, roughness: def.roughness ?? 0.9, metalness: def.metalness ?? 0 }
    if (def.map) {
      const source = this.textures[def.map]
      const tex = source.clone()
      tex.needsUpdate = true
      params.map = tex
    }
    if (def.transparent) {
      params.transparent = true
      params.opacity = def.opacity ?? 0.5
    }
    if (def.depthWrite === false) params.depthWrite = false
    if (def.side) params.side = def.side
    if (def.flatShading) params.flatShading = true
    const mat = new THREE.MeshStandardMaterial(params)
    mat.name = key
    this.materials[key] = mat
    return mat
  }

  push(key, geo) {
    if (!this.batches.has(key)) this.batches.set(key, [])
    this.batches.get(key).push(geo)
    this.geometryCount++
  }

  _collider(key, geo, opts, matrix) {
    if (opts.collide === false) return
    geo.computeBoundingBox()
    const box = geo.boundingBox.clone()
    // A tiny skin prevents z-fighting with ground contact.
    box.min.y -= 0.02
    this.world.addObstacle(box, key)
    if (opts.platform) {
      this.world.addPlatform({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, y: box.max.y })
    }
  }

  box(key, w, h, d, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d)
    E.set(opts.rx || 0, opts.ry || 0, opts.rz || 0, 'YXZ')
    Q.setFromEuler(E)
    MAT.compose(V.set(x, y, z), Q, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(MAT)
    this.push(key, geo)
    this._collider(key, geo, opts)
    return geo
  }

  cylinder(key, radiusTop, radiusBottom, height, x, y, z, opts = {}) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, opts.segments || 10, 1, opts.open || false)
    E.set(opts.rx || 0, opts.ry || 0, opts.rz || 0, 'YXZ')
    Q.setFromEuler(E)
    MAT.compose(V.set(x, y, z), Q, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(MAT)
    this.push(key, geo)
    this._collider(key, geo, opts)
    return geo
  }

  // A beam between two world points.
  beam(key, a, b, thickness = 0.16, opts = {}) {
    const start = new THREE.Vector3(...a)
    const end = new THREE.Vector3(...b)
    const dir = end.clone().sub(start)
    const len = dir.length()
    const geo = new THREE.BoxGeometry(thickness, len, opts.depth || thickness)
    Q.setFromUnitVectors(UP, dir.normalize())
    const mid = start.clone().add(end).multiplyScalar(0.5)
    MAT.compose(mid, Q, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(MAT)
    this.push(key, geo)
    if (opts.collide) this._collider(key, geo, opts)
    return geo
  }

  tri(key, a, b, c) {
    const pa = new THREE.Vector3(...a)
    const pb = new THREE.Vector3(...b)
    const pc = new THREE.Vector3(...c)
    const normal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa)).normalize()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z], 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
    this.push(key, geo)
    return geo
  }

  disk(key, radius, x, y, z, opts = {}) {
    const geo = new THREE.CircleGeometry(radius, opts.segments || 24)
    geo.rotateX(-Math.PI / 2)
    if (opts.ry) geo.rotateY(opts.ry)
    geo.translate(x, y, z)
    this.push(key, geo)
    return geo
  }

  ring(key, inner, outer, x, y, z, opts = {}) {
    const geo = new THREE.RingGeometry(inner, outer, opts.segments || 32)
    geo.rotateX(-Math.PI / 2)
    geo.translate(x, y, z)
    this.push(key, geo)
    return geo
  }

  // Convert a point in a building's local space to world space.
  local(ctx, lx, lz) {
    const c = Math.cos(ctx.rot)
    const s = Math.sin(ctx.rot)
    return { x: ctx.x + lx * c - lz * s, z: ctx.z + lx * s + lz * c }
  }

  lbox(key, ctx, w, h, d, lx, y, lz, opts = {}) {
    const p = this.local(ctx, lx, lz)
    return this.box(key, w, h, d, p.x, y, p.z, { ...opts, ry: (opts.ry || 0) + ctx.rot })
  }

  /**
   * Build a wall with real door and window openings.
   * Runs along local X. `openings` = [{type:'door'|'window', at:0..1, width}]
   */
  wall(key, ctx, len, baseY, height, lz, openings = [], opts = {}) {
    const thickness = opts.thickness || 0.28
    const bands = [
      [0.03, Math.min(0.95, height * 0.32)],
      [Math.min(0.95, height * 0.32), Math.min(2.15, height * 0.72)],
      [Math.min(2.15, height * 0.72), height]
    ]
    const lifts = openings.map((o) => {
      const center = (o.at - 0.5) * len
      return { ...o, lo: center - o.width / 2, hi: center + o.width / 2, top: o.type === 'door' ? Math.min(2.2, height) : Math.min(2.18, height) }
    })
    for (const [lo, hi] of bands) {
      if (hi - lo < 0.03) continue
      let intervals = [[-len / 2, len / 2]]
      for (const op of lifts) {
        if (op.top <= lo || op.top < lo + 0.02) continue
        if (op.type === 'door') {
          // Door gap extends from floor to its top.
          intervals = subtract(intervals, op.lo, op.hi)
        } else if (lo >= 0.8 && hi <= 2.25) {
          intervals = subtract(intervals, op.lo, op.hi)
        }
      }
      for (const [a, b] of intervals) {
        const width = b - a
        if (width < 0.06) continue
        this.lbox(key, ctx, width, hi - lo, thickness, (a + b) / 2, baseY + (lo + hi) / 2, lz, { collide: true })
      }
    }
    // Frames, sills and glass.
    for (const op of lifts) {
      const midY = op.type === 'door' ? baseY + op.top / 2 : baseY + 1.55
      this.lbox('trim', ctx, op.width + 0.24, 0.1, thickness + 0.12, (op.lo + op.hi) / 2, baseY + op.top + 0.03, lz, { collide: false })
      this.lbox('trim', ctx, 0.12, op.top, thickness + 0.12, op.lo - 0.03, baseY + op.top / 2, lz, { collide: false })
      this.lbox('trim', ctx, 0.12, op.top, thickness + 0.12, op.hi + 0.03, baseY + op.top / 2, lz, { collide: false })
      if (op.type === 'door') {
        this.lbox('trim', ctx, op.width, 0.12, thickness + 0.14, (op.lo + op.hi) / 2, baseY + op.top, lz, { collide: false })
        // A door hanging open against the inside wall.
        this.lbox('woodDark', ctx, op.width * 0.96, op.top - 0.1, 0.08, op.lo + 0.08, baseY + op.top / 2, lz + (lz > 0 ? -0.75 : 0.75), { ry: op.lo + 0.4, collide: false })
        this.lbox('concreteDark', ctx, op.width, 0.16, thickness + 0.4, (op.lo + op.hi) / 2, baseY + 0.05, lz, { collide: false })
      } else {
        const glassY = baseY + 1.55
        this.lbox('glass', ctx, op.width - 0.05, 1.1, 0.05, (op.lo + op.hi) / 2, glassY, lz, { collide: false })
        this.lbox('trim', ctx, 0.06, 1.12, 0.09, (op.lo + op.hi) / 2, glassY, lz, { collide: false })
        this.lbox('trim', ctx, op.width, 0.06, 0.09, (op.lo + op.hi) / 2, baseY + 2.1, lz, { collide: false })
        this.lbox('trimPale', ctx, op.width + 0.2, 0.09, 0.42, (op.lo + op.hi) / 2, baseY + 0.92, lz + Math.sign(lz) * 0.08, { collide: false })
      }
    }
    // Wall cap
    this.lbox('trimPale', ctx, len + 0.06, 0.09, thickness + 0.1, 0, baseY + height + 0.02, lz, { collide: false })
  }

  gableRoof(ctx, w, d, eaveY, angle, key = 'roof', gableKey = 'gablePlaster') {
    const halfD = d / 2
    const rise = Math.tan(angle) * halfD
    const slopeLen = halfD / Math.cos(angle) + 0.55
    const roofW = w + 1.2
    // Front and back slabs
    this.lbox(key, ctx, roofW, 0.18, slopeLen, 0, eaveY + rise / 2 + 0.08, halfD / 2, { rx: angle, collide: false })
    this.lbox(key, ctx, roofW, 0.18, slopeLen, 0, eaveY + rise / 2 + 0.08, -halfD / 2, { rx: -angle, collide: false })
    // Ridge
    this.lbox('trim', ctx, roofW + 0.1, 0.22, 0.3, 0, eaveY + rise + 0.13, 0, { collide: false })
    // Gable fills
    for (const side of [-1, 1]) {
      const lx = (side * w) / 2
      const a = this.local(ctx, lx, -halfD)
      const b = this.local(ctx, lx, halfD)
      const c = this.local(ctx, lx, 0)
      this.tri(gableKey, [a.x, eaveY, a.z], [b.x, eaveY, b.z], [c.x, eaveY + rise, c.z])
      this.tri(gableKey, [b.x, eaveY, b.z], [a.x, eaveY, a.z], [c.x, eaveY + rise, c.z])
    }
    // Eave fascia
    this.lbox('trim', ctx, roofW, 0.16, 0.14, 0, eaveY + 0.04, halfD + 0.5, { collide: false })
    this.lbox('trim', ctx, roofW, 0.16, 0.14, 0, eaveY + 0.04, -halfD - 0.5, { collide: false })
  }

  flatRoof(ctx, w, d, y, key = 'roof') {
    this.lbox(key, ctx, w + 0.5, 0.24, d + 0.5, 0, y + 0.12, 0, { collide: true })
    // Parapet
    this.lbox('concreteDark', ctx, w + 0.5, 0.55, 0.22, 0, y + 0.45, d / 2 + 0.14, { collide: true })
    this.lbox('concreteDark', ctx, w + 0.5, 0.55, 0.22, 0, y + 0.45, -d / 2 - 0.14, { collide: true })
    this.lbox('concreteDark', ctx, 0.22, 0.55, d + 0.5, w / 2 + 0.14, y + 0.45, 0, { collide: true })
    this.lbox('concreteDark', ctx, 0.22, 0.55, d + 0.5, -w / 2 - 0.14, y + 0.45, 0, { collide: true })
    this.lbox('trimPale', ctx, w + 0.6, 0.06, 0.26, 0, y + 0.74, d / 2 + 0.14, { collide: false })
  }

  house(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 12
    const d = o.d || 9
    const floors = o.floors || 1
    const wallKey = o.wall || 'plaster'
    const floorY = ctx.baseY + 0.16
    const h1 = o.h1 || 3.05
    // Foundation + ground slab
    this.lbox('foundation', ctx, w + 0.7, 1.1, d + 0.7, 0, ctx.baseY - 0.5, 0, { collide: true })
    this.lbox('concreteDark', ctx, w + 0.35, 0.2, d + 0.35, 0, ctx.baseY - 0.02, 0, { collide: true })
    this.lbox(o.floorKey || 'woodPale', ctx, w - 0.28, 0.14, d - 0.28, 0, floorY - 0.07, 0, { collide: true, platform: true })
    // Ground floor walls
    const frontOpenings = [
      { type: 'door', at: o.doorAt ?? 0.5, width: 1.35 },
      { type: 'window', at: 0.16, width: 1.45 },
      { type: 'window', at: 0.84, width: 1.45 }
    ]
    const sideOpenings = [
      { type: 'window', at: 0.28, width: 1.3 },
      { type: 'window', at: 0.72, width: 1.3 }
    ]
    const backOpenings = [
      { type: 'door', at: 0.32, width: 1.2 },
      { type: 'window', at: 0.72, width: 1.4 }
    ]
    this.wall(wallKey, ctx, w, floorY, h1, d / 2, frontOpenings)
    this.wall(wallKey, ctx, w, floorY, h1, -d / 2, backOpenings)
    this.wallRotated(wallKey, ctx, d, floorY, h1, w / 2, sideOpenings)
    this.wallRotated(wallKey, ctx, d, floorY, h1, -w / 2, sideOpenings)
    this.lbox('trim', ctx, 0.3, h1, 0.34, w / 2 - 0.1, floorY + h1 / 2, d / 2 - 0.1, { collide: false })
    this.lbox('trim', ctx, 0.3, h1, 0.34, -w / 2 + 0.1, floorY + h1 / 2, d / 2 - 0.1, { collide: false })
    this.lbox('trim', ctx, 0.3, h1, 0.34, w / 2 - 0.1, floorY + h1 / 2, -d / 2 + 0.1, { collide: false })
    this.lbox('trim', ctx, 0.3, h1, 0.34, -w / 2 + 0.1, floorY + h1 / 2, -d / 2 + 0.1, { collide: false })
    // Interior partition
    const partY = floorY + h1 / 2
    this.lbox(wallKey, ctx, 0.22, h1, d - 1.6, -w * 0.18, partY, 0.1, { collide: true })
    this.lbox('trim', ctx, 0.28, 2.1, 1.2, -w * 0.18, floorY + 1.05, d * 0.18, { collide: false })
    this.lbox(wallKey, ctx, 0.22, 0.95, 1.2, -w * 0.18, floorY + 2.6, d * 0.18, { collide: false })
    // Ceiling / upper floor
    const upperY = floorY + h1
    if (floors > 1) {
      const holeX0 = -w / 2 + 0.55
      const holeX1 = holeX0 + 1.85
      const holeZ0 = -d / 2 + 0.55
      const holeZ1 = holeZ0 + 4.15
      const slabY = upperY + 0.09
      const addSlab = (x0, x1, z0, z1) => {
        const sw = x1 - x0
        const sd = z1 - z0
        if (sw < 0.1 || sd < 0.1) return
        this.lbox(o.floorKey || 'woodPale', ctx, sw, 0.18, sd, (x0 + x1) / 2, upperY, (z0 + z1) / 2, { collide: true, platform: true })
      }
      addSlab(-w / 2, w / 2, -d / 2, holeZ0)
      addSlab(-w / 2, holeX0, holeZ0, holeZ1)
      addSlab(holeX1, w / 2, holeZ0, holeZ1)
      addSlab(-w / 2, w / 2, holeZ1, d / 2)
      // Stairs up through the hole
      const steps = 10
      const stepH = (h1 - 0.05) / steps
      const stepD = 4.0 / steps
      for (let i = 0; i < steps; i++) {
        const sy = floorY + stepH * (i + 1)
        const sz = holeZ1 - stepD * (i + 0.5)
        this.lbox('woodDark', ctx, 1.75, 0.13, stepD + 0.04, (holeX0 + holeX1) / 2, sy - 0.065, sz, { collide: false, platform: true })
        this.lbox('trim', ctx, 0.12, stepH, stepD + 0.04, holeX0 + 0.08, sy - stepH / 2, sz, { collide: false })
      }
      // Railing around the opening
      const railY = upperY + 0.95
      this.lbox('woodDark', ctx, 0.1, 0.95, 0.1, holeX1, railY - 0.45, holeZ0, { collide: false })
      this.lbox('woodDark', ctx, 0.1, 0.95, 0.1, holeX1, railY - 0.45, holeZ1, { collide: false })
      this.lbox('woodDark', ctx, 0.09, 0.09, holeZ1 - holeZ0, holeX1, railY, (holeZ0 + holeZ1) / 2, { collide: false })
      this.lbox('woodDark', ctx, 0.1, 0.95, 0.1, holeX0, railY - 0.45, holeZ1, { collide: false })
      // Upper floor walls
      const h2 = o.h2 || 2.75
      const upY = upperY + 0.18
      this.wall(wallKey, ctx, w, upY, h2, d / 2, [{ type: 'window', at: 0.2, width: 1.4 }, { type: 'window', at: 0.62, width: 1.4 }])
      this.wall(wallKey, ctx, w, upY, h2, -d / 2, [{ type: 'window', at: 0.3, width: 1.5 }, { type: 'window', at: 0.76, width: 1.2 }])
      // Side walls are built as rotated runs.
      this.wallRotated(wallKey, ctx, d, upY, h2, w / 2, [{ type: 'window', at: 0.3, width: 1.3 }, { type: 'window', at: 0.7, width: 1.3 }])
      this.wallRotated(wallKey, ctx, d, upY, h2, -w / 2, [{ type: 'window', at: 0.3, width: 1.3 }, { type: 'window', at: 0.7, width: 1.3 }])
      this.lbox('trim', ctx, w, 0.18, d, 0, upperY + 0.02, 0, { collide: false })
      const roofY = upY + h2
      if (o.roof === 'flat') this.flatRoof(ctx, w, d, roofY)
      else this.gableRoof(ctx, w, d, roofY + 0.2, 0.4, o.roofKey || 'roof', o.gableKey || 'gablePlaster')
    } else {
      this.lbox('woodPale', ctx, w - 0.3, 0.16, d - 0.3, 0, upperY + 0.02, 0, { collide: true, platform: true })
      const roofY = upperY + 0.18
      if (o.roof === 'flat') this.flatRoof(ctx, w, d, roofY)
      else this.gableRoof(ctx, w, d, roofY + 0.2, 0.42, o.roofKey || 'roof', o.gableKey || 'gablePlaster')
    }
    // Porch
    if (o.porch !== false) {
      const pz = d / 2 + 1.35
      this.lbox('concreteDark', ctx, 3.6, 0.22, 2.7, 0, floorY - 0.12, pz, { collide: true, platform: true })
      for (const sx of [-1.55, 1.55]) {
        this.lbox('woodDark', ctx, 0.16, 2.5, 0.16, sx, floorY + 1.2, pz + 1.1, { collide: true })
      }
      this.lbox('roof', ctx, 4.1, 0.13, 3.0, 0, floorY + 2.55, pz, { collide: false })
      this.lbox('trim', ctx, 4.1, 0.28, 0.14, 0, floorY + 2.42, pz + 1.5, { collide: false })
      this.lbox('woodDark', ctx, 0.9, 0.12, 0.5, 0.1, floorY + 0.4, pz - 0.8, { collide: false })
    }
    // Chimney
    if (o.chimney !== false) {
      this.lbox('concreteDark', ctx, 1.05, floors > 1 ? 7.2 : 4.6, 1.05, w * 0.31, ctx.baseY + 2.7, -d * 0.28, { collide: true })
      this.lbox('concreteDark', ctx, 1.2, 0.22, 1.2, w * 0.31, ctx.baseY + (floors > 1 ? 6.3 : 3.8), -d * 0.28, { collide: false })
      const pipe = this.local(ctx, w * 0.31, -d * 0.28)
      this.box('darkMetal', 0.16, 1.1, 0.16, pipe.x, ctx.baseY + (floors > 1 ? 7.0 : 4.5), pipe.z, { collide: false })
    }
    // Porch light + step
    this.lbox('trimPale', ctx, 1.9, 0.2, 0.6, 0, ctx.baseY + 0.12, d / 2 + 0.55, { collide: false })
    return ctx
  }

  localArr(ctx, lx, lz) {
    const p = this.local(ctx, lx, lz)
    return [p.x, 0, p.z]
  }

  // Wall along local Z (rotated 90 degrees).
  wallRotated(key, ctx, len, baseY, height, lx, openings = []) {
    const runCtx = { ...ctx, x: this.local(ctx, lx, 0).x, z: this.local(ctx, lx, 0).z, rot: ctx.rot + Math.PI / 2 }
    // Pull the wall run back into its opening plane.
    const p = this.local(ctx, lx, 0)
    runCtx.x = p.x
    runCtx.z = p.z
    this.wall(key, runCtx, len, baseY, height, 0, openings)
  }

  warehouse(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 20
    const d = o.d || 11
    const h = o.h || 5.4
    const floorY = ctx.baseY + 0.14
    const wallKey = o.wall || 'metal'
    this.lbox('foundation', ctx, w + 0.8, 1.2, d + 0.8, 0, ctx.baseY - 0.52, 0, { collide: true })
    this.lbox('concrete', ctx, w + 0.3, 0.2, d + 0.3, 0, ctx.baseY - 0.02, 0, { collide: true })
    this.lbox('concreteDark', ctx, w - 0.3, 0.14, d - 0.3, 0, floorY - 0.07, 0, { collide: true, platform: true })
    // Front rolling door opening (5m)
    this.wall(wallKey, ctx, w, floorY, h, d / 2, [{ type: 'door', at: 0.5, width: 5.0 }])
    this.wall(wallKey, ctx, w, floorY, h, -d / 2, [{ type: 'door', at: 0.5, width: 3.2 }])
    this.wallRotated(wallKey, ctx, d, floorY, h, w / 2, [{ type: 'window', at: 0.3, width: 2.4 }, { type: 'window', at: 0.7, width: 2.4 }])
    this.wallRotated(wallKey, ctx, d, floorY, h, -w / 2, [{ type: 'window', at: 0.3, width: 2.4 }, { type: 'window', at: 0.7, width: 2.4 }])
    // Yellow safety stripe at door
    this.lbox('orange', ctx, 5.2, 0.18, 0.2, 0, floorY + 0.2, d / 2 + 0.2, { collide: false })
    // Interior office
    this.lbox('plaster', ctx, 4.4, 3.0, 3.2, -w / 2 + 2.5, floorY + 1.5, -d / 2 + 2.0, { collide: true })
    this.lbox('glass', ctx, 1.0, 1.0, 0.08, -w / 2 + 2.5, floorY + 1.8, -d / 2 + 3.62, { collide: false })
    this.lbox('darkMetal', ctx, 0.95, 2.15, 0.1, -w / 2 + 4.4, floorY + 1.07, -d / 2 + 3.6, { collide: false })
    // Roof + skylights
    this.flatRoof(ctx, w, d, floorY + h)
    for (const sx of [-w * 0.28, 0, w * 0.28]) {
      this.lbox('glassDark', ctx, 2.4, 0.1, 1.5, sx, floorY + h + 0.32, 0, { collide: false })
      this.lbox('trim', ctx, 2.6, 0.16, 1.7, sx, floorY + h + 0.24, 0, { collide: false })
    }
    // Roof vents
    this.lbox('metal', ctx, 1.1, 0.7, 1.1, w * 0.32, floorY + h + 0.7, d * 0.25, { collide: false })
    // Loading dock
    this.lbox('concreteDark', ctx, w * 0.7, 0.55, 3.2, 0, ctx.baseY - 0.12, d / 2 + 1.9, { collide: true, platform: true })
    for (let i = 0; i < 5; i++) {
      this.lbox('concreteDark', ctx, 2.4, 0.13, 0.5, 0, ctx.baseY - 0.35 + i * 0.11, d / 2 + 4.1 - i * 0.42, { collide: false, platform: true })
    }
    // Interior crates
    for (const [lx, lz, s] of [[-6, 2, 1.2], [-4.6, 2.6, 0.9], [5.5, -3, 1.35], [6.8, -2.4, 1.0], [3.1, 2.2, 0.8]]) {
      this.crate(ctx, lx, lz, floorY, s)
    }
    this.addLoot(ctx, 6, 1.6, floorY, 'weapon')
    this.addLoot(ctx, -5.5, 1.8, floorY, 'ammo')
    this.addLoot(ctx, 2.4, -3.0, floorY, 'armor')
    return ctx
  }

  cabin(o) {
    const ctx = this.house({
      ...o,
      w: o.w || 8,
      d: o.d || 7,
      floors: 1,
      wall: o.wall || 'wood',
      floorKey: 'woodPale',
      roof: o.roof || 'gable',
      gableKey: 'gableWood',
      doorAt: 0.5,
      chimney: o.chimney !== false
    })
    return ctx
  }

  shop(o) {
    const ctx = this.house({
      ...o,
      w: o.w || 11,
      d: o.d || 9,
      floors: 2,
      wall: 'plasterWarm',
      roof: 'flat',
      porch: true,
      doorAt: 0.5,
      chimney: false
    })
    // Awning + sign
    const p = this.local(ctx, 0, (o.d || 9) / 2 + 1.6)
    this.box('orange', 6.2, 0.28, 2.0, p.x, ctx.baseY + 3.0, p.z, { ry: ctx.rot, collide: false })
    this.box('white', 3.6, 0.52, 0.12, p.x, ctx.baseY + 3.5, p.z + 0.2, { ry: ctx.rot, collide: false })
    for (let i = 0; i < 4; i++) {
      this.box('orange', 0.18, 0.5, 0.2, p.x - 1.3 + i * 0.85, ctx.baseY + 3.4, p.z + 0.2, { ry: ctx.rot, collide: false })
    }
    return ctx
  }

  hangar(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 30
    const d = o.d || 20
    const h = 6.4
    const floorY = ctx.baseY + 0.1
    this.lbox('concrete', ctx, w + 1.2, 0.9, d + 1.2, 0, ctx.baseY - 0.4, 0, { collide: true })
    this.lbox('concreteDark', ctx, w - 0.4, 0.12, d - 0.4, 0, floorY - 0.05, 0, { collide: true, platform: true })
    // Back and sides
    this.wall('metal', ctx, w, floorY, h, -d / 2, [{ type: 'door', at: 0.5, width: 8.0 }])
    this.wallRotated('metal', ctx, d, floorY, h, w / 2, [{ type: 'window', at: 0.25, width: 3 }, { type: 'window', at: 0.7, width: 3 }])
    this.wallRotated('metal', ctx, d, floorY, h, -w / 2, [{ type: 'window', at: 0.25, width: 3 }, { type: 'window', at: 0.7, width: 3 }])
    // Front corners
    this.lbox('metal', ctx, 2.2, h, 0.35, -w / 2 + 1.1, floorY + h / 2, d / 2, { collide: true })
    this.lbox('metal', ctx, 2.2, h, 0.35, w / 2 - 1.1, floorY + h / 2, d / 2, { collide: true })
    this.lbox('metal', ctx, w, 1.2, 0.35, 0, floorY + h - 0.6, d / 2, { collide: true })
    // Curved roof from angled slabs
    const panels = 7
    for (let i = 0; i < panels; i++) {
      const t = i / (panels - 1)
      const angle = -0.62 + t * 1.24
      const zz = (t - 0.5) * (d + 1.6)
      const yy = floorY + h + 1.5 - Math.abs(t - 0.5) * 2.4
      this.lbox('roofRust', ctx, w + 1.2, 0.16, d / panels + 0.9, 0, yy, zz, { rx: angle, collide: false })
    }
    // Roof trusses
    for (const lx of [-w * 0.33, 0, w * 0.33]) {
      this.lbox('metal', ctx, 0.22, 0.22, d, lx, floorY + h + 1.45, 0, { collide: false })
      for (const lz of [-d / 2 + 1.2, d / 2 - 1.2]) {
        this.beam('metal', [this.local(ctx, lx, lz).x, floorY + h - 0.2, this.local(ctx, lx, lz).z], [this.local(ctx, lx, 0).x, floorY + h + 1.4, this.local(ctx, lx, 0).z], 0.14)
      }
    }
    // Office + crates + containers inside
    this.lbox('plasterBlue', ctx, 5, 3.1, 4, -w / 2 + 3, floorY + 1.55, -d / 2 + 2.5, { collide: true })
    this.lbox('glass', ctx, 1.2, 1.0, 0.08, -w / 2 + 3, floorY + 2.0, -d / 2 + 4.52, { collide: false })
    this.crate(ctx, 5, 3, floorY, 1.4)
    this.crate(ctx, 6.3, 2.7, floorY, 1.0)
    this.crate(ctx, 5.7, 4.2, floorY, 0.9)
    this.addLoot(ctx, 5.5, 3.2, floorY, 'weapon')
    this.addLoot(ctx, -5, 3.2, floorY, 'ammo')
    this.addLoot(ctx, 8, -2, floorY, 'medkit')
    return ctx
  }

  controlTower(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 7
    const d = o.d || 7
    const levels = [3.0, 6.0, 9.0]
    this.lbox('concreteDark', ctx, w + 1.6, 0.8, d + 1.6, 0, ctx.baseY - 0.3, 0, { collide: true })
    // Core
    this.lbox('concrete', ctx, w, 9.2, d, 0, ctx.baseY + 4.6, 0, { collide: true })
    for (const y of levels) {
      this.lbox('concreteDark', ctx, w + 1.5, 0.22, d + 1.5, 0, ctx.baseY + y, 0, { collide: true, platform: true })
      this.lbox('metal', ctx, w + 1.7, 0.85, 0.12, 0, ctx.baseY + y + 0.55, d / 2 + 0.75, { collide: true })
      this.lbox('metal', ctx, w + 1.7, 0.85, 0.12, 0, ctx.baseY + y + 0.55, -d / 2 - 0.75, { collide: true })
      this.lbox('metal', ctx, 0.12, 0.85, d + 1.7, w / 2 + 0.75, ctx.baseY + y + 0.55, 0, { collide: true })
      this.lbox('metal', ctx, 0.12, 0.85, d + 1.7, -w / 2 - 0.75, ctx.baseY + y + 0.55, 0, { collide: true })
      // Windows around the cabin
      if (y === 9.0) {
        this.lbox('glassDark', ctx, w + 1.5, 1.7, 0.1, 0, ctx.baseY + y + 1.6, d / 2 + 0.76, { collide: false })
        this.lbox('glassDark', ctx, w + 1.5, 1.7, 0.1, 0, ctx.baseY + y + 1.6, -d / 2 - 0.76, { collide: false })
        this.lbox('glassDark', ctx, 0.1, 1.7, d + 1.5, w / 2 + 0.76, ctx.baseY + y + 1.6, 0, { collide: false })
        this.lbox('glassDark', ctx, 0.1, 1.7, d + 1.5, -w / 2 - 0.76, ctx.baseY + y + 1.6, 0, { collide: false })
        this.lbox('metal', ctx, w + 2.2, 0.25, d + 2.2, 0, ctx.baseY + y + 2.6, 0, { collide: false })
        this.lbox('orange', ctx, w + 2.2, 0.06, 0.3, 0, ctx.baseY + y + 2.45, d / 2 + 1.1, { collide: false })
        // Antenna
        this.cylinder('metal', 0.06, 0.08, 5, this.local(ctx, w * 0.3, -d * 0.2).x, ctx.baseY + y + 5.1, this.local(ctx, w * 0.3, -d * 0.2).z, { collide: false })
      }
    }
    // Exterior stair tower
    for (let i = 0; i < 15; i++) {
      const sy = ctx.baseY + (i + 1) * 0.6
      this.lbox('metal', ctx, 1.4, 0.12, 0.5, w / 2 + 1.6, sy, -d / 2 + 0.6 + i * 0.5, { collide: false, platform: true })
    }
    this.addLoot(ctx, 0, 1, ctx.baseY + 9.15, 'weapon')
    return ctx
  }

  tower(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const size = o.size || 6
    const h = o.h || 10
    const half = size / 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = this.local(ctx, sx * half, sz * half)
        this.box('woodDark', 0.32, h, 0.32, p.x, ctx.baseY + h / 2, p.z, { ry: ctx.rot, collide: true })
      }
    }
    // Cross bracing
    for (const side of [-1, 1]) {
      const a = this.local(ctx, -half, side * half)
      const b = this.local(ctx, half, side * half)
      this.beam('woodDark', [a.x, ctx.baseY + 1, a.z], [b.x, ctx.baseY + h - 1, b.z], 0.12)
      this.beam('woodDark', [b.x, ctx.baseY + 1, b.z], [a.x, ctx.baseY + h - 1, a.z], 0.12)
    }
    for (const level of [h * 0.5, h]) {
      this.lbox('wood', ctx, size + 0.6, 0.2, size + 0.6, 0, ctx.baseY + level, 0, { collide: true, platform: true })
      this.lbox('woodDark', ctx, size + 0.6, 0.9, 0.1, 0, ctx.baseY + level + 0.55, half + 0.3, { collide: false })
      this.lbox('woodDark', ctx, size + 0.6, 0.9, 0.1, 0, ctx.baseY + level + 0.55, -half - 0.3, { collide: false })
      this.lbox('woodDark', ctx, 0.1, 0.9, size + 0.6, half + 0.3, ctx.baseY + level + 0.55, 0, { collide: false })
      this.lbox('woodDark', ctx, 0.1, 0.9, size + 0.6, -half - 0.3, ctx.baseY + level + 0.55, 0, { collide: false })
    }
    this.lbox('roofRust', ctx, size + 1.6, 0.16, size + 1.6, 0, ctx.baseY + h + 2.4, 0, { collide: false })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = this.local(ctx, sx * half, sz * half)
      this.box('woodDark', 0.16, 2.4, 0.16, p.x, ctx.baseY + h + 1.2, p.z, { ry: ctx.rot, collide: false })
    }
    // Ladder rungs
    for (let i = 0; i < 16; i++) {
      const p = this.local(ctx, half, -half)
      this.box('metal', 0.8, 0.06, 0.06, p.x, ctx.baseY + 0.7 + i * 0.62, p.z, { ry: ctx.rot, collide: false })
    }
    this.addLoot(ctx, 0, 0, ctx.baseY + h + 0.15, 'weapon')
    return ctx
  }

  silo(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const r = o.r || 3
    const h = o.h || 12
    this.cylinder('metal', r, r, h, ctx.x, ctx.baseY + h / 2, ctx.z, { segments: 18, collide: true })
    this.cylinder('metal', r * 0.98, r, 1.2, ctx.x, ctx.baseY + h + 0.6, ctx.z, { segments: 18, collide: false })
    this.cylinder('metal', r * 0.2, r * 0.6, 1.4, ctx.x, ctx.baseY + h + 1.6, ctx.z, { segments: 14, collide: false })
    this.cylinder('concreteDark', r + 1.1, r + 1.2, 0.8, ctx.x, ctx.baseY + 0.3, ctx.z, { segments: 18, collide: true })
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      this.box('metal', 0.1, 0.08, 0.5, ctx.x + Math.cos(a) * r, ctx.baseY + 0.9 + i * 0.62, ctx.z + Math.sin(a) * r, { ry: -a, collide: false })
    }
    return ctx
  }

  tent(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 5
    const d = o.d || 4.2
    const h = o.h || 2.5
    const rise = 1.2
    this.lbox('concreteDark', ctx, w + 0.4, 0.12, d + 0.4, 0, ctx.baseY + 0.03, 0, { collide: false, platform: true })
    this.lbox('fabric', ctx, w + 0.3, 0.1, d / 2 + 0.2, 0, ctx.baseY + h + rise * 0.35, d / 4, { rx: 0.5, collide: false })
    this.lbox('fabric', ctx, w + 0.3, 0.1, d / 2 + 0.2, 0, ctx.baseY + h + rise * 0.35, -d / 4, { rx: -0.5, collide: false })
    this.lbox('fabric', ctx, w, h, 0.12, 0, ctx.baseY + h / 2, -d / 2, { collide: true })
    this.lbox('fabric', ctx, 0.12, h, d, -w / 2, ctx.baseY + h / 2, 0, { collide: true })
    this.lbox('fabric', ctx, w, h, 0.12, 0, ctx.baseY + h / 2, d / 2, { collide: true })
    this.lbox('fabric', ctx, 0.12, h, d, w / 2, ctx.baseY + h / 2, 0, { collide: true })
    this.lbox('fabricTan', ctx, 1.6, 1.9, 0.1, 0, ctx.baseY + 0.95, d / 2 + 0.02, { collide: false })
    this.tri('fabric', ...this.triArr(ctx, -w / 2, -d / 2, d / 2, h), ...this.triArr(ctx, w / 2, -d / 2, d / 2, h))
    // Just a sloped fabric gable fill
    this.lbox('fabric', ctx, w, 1.0, 0.1, 0, ctx.baseY + h + rise * 0.4, 0, { collide: false })
    this.addLoot(ctx, 0, 0, ctx.baseY + 0.1, 'ammo')
    return ctx
  }

  triArr(ctx, x, z0, z1, h) {
    const a = this.local(ctx, x, z0)
    const b = this.local(ctx, x, z1)
    const c = this.local(ctx, x, 0)
    return [[a.x, ctx.baseY + h - h * 0.5, a.z], [b.x, ctx.baseY + h - h * 0.5, b.z], [c.x, ctx.baseY + h + 1.2 - h * 0.5, c.z]]
  }

  container(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const w = o.w || 6.1
    const d = o.d || 2.5
    const h = o.h || 2.6
    const key = o.key || (o.rust ? 'rust' : 'metalBlue')
    this.lbox(key, ctx, w, h, d, 0, ctx.baseY + h / 2 + 0.12, 0, { collide: true })
    this.lbox('darkMetal', ctx, w + 0.06, 0.16, d + 0.06, 0, ctx.baseY + h + 0.12, 0, { collide: false })
    // Corrugation ribs
    for (let i = 0; i < 12; i++) {
      this.lbox('darkMetal', ctx, 0.1, h, 0.08, -w / 2 + 0.5 + i * 0.46, ctx.baseY + h / 2 + 0.12, d / 2 + 0.03, { collide: false })
    }
    // Open doors
    this.lbox(key, ctx, 0.1, h - 0.1, d - 0.3, w / 2 + 1.0, ctx.baseY + h / 2 + 0.12, d / 2, { ry: 0.7, collide: false })
    this.lbox(key, ctx, 0.1, h - 0.1, d - 0.3, -w / 2 - 1.0, ctx.baseY + h / 2 + 0.12, d / 2, { ry: -0.7, collide: false })
    this.addLoot(ctx, 0, 0, ctx.baseY + 0.14, 'weapon')
    return ctx
  }

  sandbagWall(x, z, rot, length = 6, rows = 3) {
    const baseY = this.world.getHeight(x, z)
    const bagW = 0.9
    const bagH = 0.32
    const bagD = 0.55
    const count = Math.max(2, Math.round(length / bagW))
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < count; i++) {
        const lx = -length / 2 + bagW / 2 + i * bagW
        const off = r % 2 === 0 ? 0 : bagW * 0.25
        const lz = off
        const p = this.local({ x, z, rot }, lx, lz)
        this.box('sandbag', bagW - 0.04, bagH, bagD, p.x, baseY + bagH / 2 + r * bagH, p.z, { ry: rot, collide: false })
      }
    }
    this.box('sandbag', length, rows * bagH, bagD, x, baseY + (rows * bagH) / 2, z, { ry: rot, collide: true })
    return baseY
  }

  crate(ctx, lx, lz, floorY, size = 1.0, stacked = false) {
    const p = this.local(ctx, lx, lz)
    this.box('crate', size, size, size, p.x, floorY + size / 2, p.z, { ry: ctx.rot + 0.1, collide: true })
    this.box('trim', size + 0.02, 0.08, size + 0.02, p.x, floorY + size * 0.95, p.z, { ry: ctx.rot + 0.1, collide: false })
    if (stacked) this.box('crate', size * 0.75, size * 0.75, size * 0.75, p.x + 0.1, floorY + size + size * 0.36, p.z, { ry: ctx.rot - 0.2, collide: true })
  }

  barrel(x, z, y) {
    const h = this.world.getHeight(x, z)
    const base = y ?? h
    this.cylinder('rust', 0.36, 0.36, 0.95, x, base + 0.48, z, { segments: 10, collide: true })
    this.cylinder('darkMetal', 0.38, 0.38, 0.06, x, base + 0.28, z, { segments: 10, collide: false })
    this.cylinder('darkMetal', 0.38, 0.38, 0.06, x, base + 0.74, z, { segments: 10, collide: false })
  }

  vehicle(o) {
    const ctx = { x: o.x, z: o.z, rot: o.rot || 0, baseY: this.world.getHeight(o.x, o.z) }
    const key = o.key || 'rust'
    // Body
    this.lbox(key, ctx, 4.6, 0.8, 2.0, 0, ctx.baseY + 0.75, 0, { collide: true })
    this.lbox(key, ctx, 2.6, 0.85, 1.9, -0.2, ctx.baseY + 1.5, 0, { collide: true })
    this.lbox('glassDark', ctx, 2.2, 0.5, 1.7, -0.2, ctx.baseY + 1.75, 0, { collide: false })
    this.lbox('trim', ctx, 1.0, 0.5, 1.8, 2.0, ctx.baseY + 1.0, 0, { collide: false })
    for (const [lx, lz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
      const p = this.local(ctx, lx, lz)
      this.box('darkMetal', 0.62, 0.62, 0.3, p.x, ctx.baseY + 0.38, p.z, { ry: ctx.rot, collide: false })
    }
    this.lbox('darkMetal', ctx, 4.7, 0.16, 0.2, 0, ctx.baseY + 0.45, 1.02, { collide: false })
    return ctx
  }

  fence(x, z, rot, length, height = 1.35) {
    const baseY = this.world.getHeight(x, z)
    const posts = Math.max(2, Math.round(length / 3))
    for (let i = 0; i <= posts; i++) {
      const lx = -length / 2 + (length / posts) * i
      const p = this.local({ x, z, rot }, lx, 0)
      this.box('woodDark', 0.14, height, 0.14, p.x, baseY + height / 2, p.z, { ry: rot, collide: false })
    }
    const p = this.local({ x, z, rot }, 0, 0)
    for (const yy of [height * 0.45, height * 0.85]) {
      this.box('woodDark', length, 0.1, 0.08, p.x, baseY + yy, p.z, { ry: rot, collide: false })
    }
    this.box('woodDark', length, height, 0.08, p.x, baseY + height / 2, p.z, { ry: rot, collide: true })
  }

  dock(x, z, rot, length = 14, width = 3.6) {
    const baseY = this.world.getHeight(x, z)
    const y = Math.max(1.1, baseY + 0.35)
    const steps = Math.max(2, Math.round((y - baseY) / 0.28))
    for (let i = 0; i < steps; i++) {
      const p = this.local({ x, z, rot }, 0, -length / 2 - 0.4 - i * 0.5)
      this.box('wood', width, 0.18, 0.5, p.x, baseY + 0.14 + i * 0.18, p.z, { ry: rot, collide: false, platform: true })
    }
    const p = this.local({ x, z, rot }, 0, 0)
    this.box('wood', width, 0.16, length, p.x, y, p.z, { ry: rot, collide: true, platform: true })
    for (let i = 0; i < 5; i++) {
      for (const sx of [-1, 1]) {
        const pp = this.local({ x, z, rot }, (sx * width) / 2, -length / 2 + 1 + i * (length / 4))
        this.cylinder('woodDark', 0.14, 0.14, y + 1.2, pp.x, (y + 1.2) / 2 - 0.6, pp.z, { segments: 6, collide: false })
      }
    }
    // Railings
    for (const sx of [-1, 1]) {
      const pp = this.local({ x, z, rot }, (sx * width) / 2, 0)
      this.box('woodDark', 0.08, 0.9, length, pp.x, y + 0.55, pp.z, { ry: rot, collide: false })
    }
    return y
  }

  helipad(x, z) {
    const y = this.world.getHeight(x, z) + 0.06
    this.disk('concreteDark', 11, x, y, z, { segments: 36 })
    this.ring('white', 9.6, 10.0, x, y + 0.02, z, { segments: 40 })
    this.ring('orange', 8.6, 8.8, x, y + 0.02, z, { segments: 40 })
    // H marking
    const p1 = this.local({ x, z, rot: 0 }, -1.9, 0)
    const p2 = this.local({ x, z, rot: 0 }, 1.9, 0)
    this.box('white', 0.65, 0.03, 4.6, p1.x, y + 0.03, p1.z, { collide: false })
    this.box('white', 0.65, 0.03, 4.6, p2.x, y + 0.03, p2.z, { collide: false })
    this.box('white', 3.8, 0.03, 0.6, x, y + 0.03, z, { collide: false })
  }

  powerPole(x, z) {
    const baseY = this.world.getHeight(x, z)
    this.cylinder('woodDark', 0.16, 0.22, 8.5, x, baseY + 4.25, z, { segments: 7, collide: true })
    this.box('woodDark', 2.4, 0.14, 0.14, x, baseY + 7.9, z, { collide: false })
    this.box('woodDark', 1.4, 0.12, 0.12, x, baseY + 7.2, z, { collide: false })
    for (const off of [-1.1, 1.1]) this.box('white', 0.1, 0.4, 0.1, x + off, baseY + 8.15, z, { collide: false })
  }

  addLoot(ctx, lx, lz, y, kind, weapon) {
    const p = this.local(ctx, lx, lz)
    this.world.addLootPoint(p.x, y, p.z, kind, weapon)
  }

  flush(scene) {
    const meshes = []
    for (const [key, geos] of this.batches) {
      const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false)
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, this.getMaterial(key))
      mesh.castShadow = key !== 'glass' && key !== 'glassDark'
      mesh.receiveShadow = true
      mesh.name = `batch-${key}`
      scene.add(mesh)
      meshes.push(mesh)
      geos.forEach((g) => g.dispose())
    }
    this.batches.clear()
    return meshes
  }
}

function subtract(intervals, lo, hi) {
  const out = []
  for (const [a, b] of intervals) {
    if (hi <= a || lo >= b) {
      out.push([a, b])
      continue
    }
    if (lo > a) out.push([a, Math.max(a, lo)])
    if (hi < b) out.push([Math.min(b, hi), b])
  }
  return out
}

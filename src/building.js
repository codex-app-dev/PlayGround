import * as THREE from 'three'
import { BUILD_COSTS, BUILD_MAX_HP, MATCH } from './config.js'
import { clamp } from './utils.js'

const SNAP = MATCH.buildGrid

export class Building {
  constructor(scene, world, player, hud, audio, fx) {
    this.scene = scene
    this.world = world
    this.player = player
    this.hud = hud
    this.audio = audio
    this.fx = fx
    this.active = false
    this.piece = 'wall'
    this.structures = []
    this.maxStructures = 44
    this.rotation = 0
    this.rotationOffset = 0
    this.valid = false
    this.target = new THREE.Vector3()
    this.baseY = 0
    this.ghosts = {}
    this._buildGhosts()
    this._buildMaterials()
    this._geoCache = {}
  }

  _buildMaterials() {
    const tex = this.world.textures
    const woodMap = tex.wood.clone()
    woodMap.needsUpdate = true
    woodMap.repeat.set(2, 2)
    this.woodMat = new THREE.MeshStandardMaterial({ map: woodMap, color: 0xc39a63, roughness: 0.88 })
    this.woodDarkMat = new THREE.MeshStandardMaterial({ map: tex.wood, color: 0x6c4f31, roughness: 0.9 })
    this.metalMat = new THREE.MeshStandardMaterial({ map: tex.metal, color: 0x8b9296, metalness: 0.55, roughness: 0.55 })
    this.ghostValid = new THREE.MeshBasicMaterial({ color: 0x62ff9a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
    this.ghostInvalid = new THREE.MeshBasicMaterial({ color: 0xff5a48, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
    this.ghostLineValid = new THREE.LineBasicMaterial({ color: 0x8dffb8, transparent: true, opacity: 0.75 })
    this.ghostLineInvalid = new THREE.LineBasicMaterial({ color: 0xff7a68, transparent: true, opacity: 0.8 })
  }

  _buildGhosts() {
    const specs = {
      wall: { w: 4, h: 3, d: 0.2, y: 1.5 },
      floor: { w: 4, h: 0.18, d: 4, y: 0.09 },
      ramp: { w: 4, h: 0.16, d: 5, y: 1.5, rx: Math.atan2(3, 4) }
    }
    for (const [key, spec] of Object.entries(specs)) {
      const group = new THREE.Group()
      const geo = new THREE.BoxGeometry(spec.w, spec.h, spec.d)
      const mesh = new THREE.Mesh(geo, this.ghostValid)
      mesh.position.y = spec.y
      if (spec.rx) mesh.rotation.x = spec.rx
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.ghostLineValid)
      edges.position.y = spec.y
      if (spec.rx) edges.rotation.x = spec.rx
      group.add(mesh, edges)
      group.visible = false
      group.renderOrder = 5
      this.scene.add(group)
      this.ghosts[key] = { group, mesh, edges, spec, y: spec.y }
    }
  }

  setActive(active) {
    this.active = active
    if (!active) for (const g of Object.values(this.ghosts)) g.group.visible = false
  }

  setPiece(piece) {
    if (!this.ghosts[piece]) return
    this.piece = piece
    for (const [key, g] of Object.entries(this.ghosts)) g.group.visible = false
    this.ghosts[piece].group.visible = true
  }

  rotate() {
    this.rotationOffset = (this.rotationOffset + Math.PI / 2) % (Math.PI * 2)
  }

  update(dt) {
    if (!this.active) return
    this.updateDamage(dt)
    const p = this.player
    const yaw = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2) + this.rotationOffset
    this.rotation = yaw
    const fwdX = -Math.sin(p.yaw)
    const fwdZ = -Math.cos(p.yaw)
    const reach = this.piece === 'floor' ? 4.0 : 4.3
    let tx = p.pos.x + fwdX * reach
    let tz = p.pos.z + fwdZ * reach
    tx = Math.round(tx / SNAP) * SNAP
    tz = Math.round(tz / SNAP) * SNAP
    const ground = this.world.getHeight(tx, tz)
    let baseY = Math.max(p.pos.y, ground)
    baseY = Math.round(baseY * 20) / 20
    this.target.set(tx, 0, tz)
    this.baseY = baseY
    const ghost = this.ghosts[this.piece]
    ghost.group.position.set(tx, baseY, tz)
    ghost.group.rotation.y = yaw
    this.valid = this._validate(tx, tz, baseY, yaw)
    ghost.mesh.material = this.valid ? this.ghostValid : this.ghostInvalid
    ghost.edges.material = this.valid ? this.ghostLineValid : this.ghostLineInvalid
  }

  _validate(tx, tz, baseY, yaw) {
    if (this.structures.length >= this.maxStructures) return false
    if (this.world.getHeight(tx, tz) < 0.35) return false
    if (Math.hypot(tx - this.player.pos.x, tz - this.player.pos.z) > MATCH.buildRange + 2.5) return false
    if (this.player.wood < BUILD_COSTS[this.piece]) return false
    const box = this._boundsFor(tx, tz, baseY, yaw, this.piece)
    for (const s of this.structures) {
      if (s.hp <= 0) continue
      if (intersects(box, s.bounds, 0.15)) return false
    }
    // Do not build inside solid world geometry.
    for (const ob of this.world.obstacles) {
      if (ob.maxY - ob.minY < 1.4) continue
      if (intersects(box, ob, 0.05)) return false
    }
    return true
  }

  _boundsFor(tx, tz, baseY, yaw, piece) {
    if (piece === 'wall') {
      const along = Math.abs(Math.cos(yaw)) > 0.5
      const hw = along ? 2 : 0.16
      const hd = along ? 0.16 : 2
      return { minX: tx - hw, maxX: tx + hw, minY: baseY - 0.05, maxY: baseY + 3.1, minZ: tz - hd, maxZ: tz + hd }
    }
    if (piece === 'floor') {
      return { minX: tx - 2, maxX: tx + 2, minY: baseY - 0.05, maxY: baseY + 0.24, minZ: tz - 2, maxZ: tz + 2 }
    }
    return { minX: tx - 2, maxX: tx + 2, minY: baseY - 0.05, maxY: baseY + 3.1, minZ: tz - 2.5, maxZ: tz + 2.5 }
  }

  place() {
    if (!this.active) return false
    const p = this.player
    if (!this.valid) {
      this.hud?.toast(p.wood < BUILD_COSTS[this.piece] ? 'NOT ENOUGH WOOD' : 'CANNOT BUILD HERE', 'FIND FLAT OPEN GROUND', 1.6)
      this.audio?.click(180, 0.05, 0.08)
      return false
    }
    const cost = BUILD_COSTS[this.piece]
    p.wood -= cost
    const yaw = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2)
    const tx = this.target.x
    const tz = this.target.z
    const baseY = this.baseY
    const group = new THREE.Group()
    group.position.set(tx, baseY, tz)
    group.rotation.y = yaw
    const structure = {
      piece: this.piece,
      group,
      hp: BUILD_MAX_HP,
      maxHp: BUILD_MAX_HP,
      bounds: this._boundsFor(tx, tz, baseY, yaw, this.piece),
      materials: [],
      obstacles: [],
      platforms: [],
      flash: 0,
      dead: false
    }
    if (this.piece === 'wall') this._buildWall(group, structure)
    else if (this.piece === 'floor') this._buildFloor(group, structure)
    else this._buildRamp(group, structure)
    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.scene.add(group)
    this.structures.push(structure)
    this._registerPhysics(structure)
    this.audio?.build()
    this.fx?.dustPuff(new THREE.Vector3(tx, baseY + 0.2, tz), new THREE.Vector3(0, 1, 0), 0xb39a72, 8)
    this.valid = false
    return true
  }

  _registerPhysics(structure) {
    const b = structure.bounds
    if (structure.piece !== 'ramp') {
      structure.obstacles.push(this.world.addDynamicObstacle(
        { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ },
        structure
      ))
    }
    if (structure.piece === 'floor') {
      structure.platforms.push(this.world.addDynamicPlatform({
        minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, y: b.maxY
      }, structure))
    }
    if (structure.piece === 'ramp') {
      // Six invisible steps make the ramp walkable without a slope physics solver.
      const along = Math.abs(Math.cos(structure.group.rotation.y)) > 0.5
      for (let i = 0; i < 6; i++) {
        const t = (i + 0.5) / 6
        const y = b.minY + t * 3.0
        const zOff = (0.5 - t) * 4
        const x = along ? structure.group.position.x : structure.group.position.x + zOff
        const z = along ? structure.group.position.z + zOff : structure.group.position.z
        structure.platforms.push(this.world.addDynamicPlatform({
          minX: x - (along ? 1.9 : 0.5),
          maxX: x + (along ? 1.9 : 0.5),
          minZ: z - (along ? 0.5 : 1.9),
          maxZ: z + (along ? 0.5 : 1.9),
          y
        }, structure))
      }
    }
  }

  _buildWall(group, structure) {
    const mat = this.woodMat.clone()
    const trimMat = this.woodDarkMat.clone()
    structure.materials.push(mat, trimMat)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.18), mat)
    panel.position.y = 1.5
    group.add(panel)
    for (const x of [-1.88, 1.88]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.26), trimMat)
      post.position.set(x, 1.6, 0)
      group.add(post)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.2, 0.3), trimMat)
    top.position.y = 3.05
    group.add(top)
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.18, 0.28), trimMat)
    bottom.position.y = 0.14
    group.add(bottom)
    for (const sign of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 0.3), trimMat)
      brace.position.set(0, 1.55, 0.005)
      brace.rotation.z = sign * 0.62
      group.add(brace)
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.06), this.metalMat)
    plate.position.set(0, 1.6, 0.12)
    group.add(plate)
  }

  _buildFloor(group, structure) {
    const mat = this.woodMat.clone()
    const trimMat = this.woodDarkMat.clone()
    structure.materials.push(mat, trimMat)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 4), mat)
    deck.position.y = 0.09
    group.add(deck)
    for (const z of [-1.5, 0, 1.5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.22), trimMat)
      beam.position.set(0, -0.05, z)
      group.add(beam)
    }
    for (const x of [-2.02, 2.02]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 4.1), trimMat)
      edge.position.set(x, 0.1, 0)
      group.add(edge)
    }
  }

  _buildRamp(group, structure) {
    const mat = this.woodMat.clone()
    const trimMat = this.woodDarkMat.clone()
    structure.materials.push(mat, trimMat)
    const angle = Math.atan2(3, 4)
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 5.1), mat)
    ramp.position.y = 1.5
    ramp.rotation.x = angle
    group.add(ramp)
    for (const x of [-2.0, 2.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 5.1), trimMat)
      rail.position.set(x, 2.35, 0)
      rail.rotation.x = angle
      group.add(rail)
    }
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6
      const brace = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.14, 0.16), trimMat)
      brace.position.set(0, t * 3 + 0.1, (0.5 - t) * 4)
      group.add(brace)
    }
  }

  damage(structure, amount) {
    if (!structure || structure.dead) return
    structure.hp -= amount
    structure.flash = 0.12
    if (structure.hp <= 0) this._destroy(structure)
  }

  _destroy(structure) {
    structure.dead = true
    structure.hp = 0
    const pos = structure.group.position
    this.fx?.debris(new THREE.Vector3(pos.x, pos.y + 1.3, pos.z), 0xa07c4c, 20)
    this.audio?.destroy()
    for (const entry of structure.obstacles) this.world.removeDynamicObstacle(entry)
    for (const entry of structure.platforms) this.world.removeDynamicPlatform(entry)
    this.scene.remove(structure.group)
    structure.group.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry && !this._geoCache[o.geometry.uuid]) { o.geometry.dispose() }
      }
    })
    structure.materials.forEach((m) => m.dispose())
    const idx = this.structures.indexOf(structure)
    if (idx >= 0) this.structures.splice(idx, 1)
    if (this.hud) this.hud.toast('COVER DESTROYED', 'BUILD ANOTHER', 1.2)
  }

  updateDamage(dt) {
    for (const s of this.structures) {
      if (s.flash > 0) {
        s.flash -= dt
        const v = clamp(s.flash / 0.12, 0, 1)
        for (const m of s.materials) {
          m.emissive = m.emissive || new THREE.Color(0, 0, 0)
          m.emissive.setRGB(v * 0.8, v * 0.18, 0)
        }
      }
    }
  }

  clear() {
    for (const s of this.structures.slice()) {
      for (const entry of s.obstacles) this.world.removeDynamicObstacle(entry)
      for (const entry of s.platforms) this.world.removeDynamicPlatform(entry)
      this.scene.remove(s.group)
      s.materials.forEach((m) => m.dispose())
      s.group.traverse((o) => {
        if (o.isMesh && o.geometry) o.geometry.dispose()
      })
    }
    this.structures.length = 0
    this.setActive(false)
    this.rotationOffset = 0
    this.piece = 'wall'
    this.valid = false
  }
}

function intersects(a, b, pad = 0) {
  return a.maxX > b.minX - pad && a.minX < b.maxX + pad &&
    a.maxY > b.minY - pad && a.minY < b.maxY + pad &&
    a.maxZ > b.minZ - pad && a.minZ < b.maxZ + pad
}

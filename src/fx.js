import * as THREE from 'three'

const MAX_SPARKS = 320
const MAX_DUST = 160
const MAX_DECALS = 70

export class FX {
  constructor(scene, textures, quality = 'high') {
    this.scene = scene
    this.textures = textures
    this.tracers = []
    this.decals = []
    this.flashes = []
    this.time = 0
    this.quality = quality

    this.sparks = this._makeParticles(MAX_SPARKS, 0.075, true)
    this.dust = this._makeParticles(MAX_DUST, 0.4, false)

    this.flashPool = []
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.muzzle,
        color: 0xffd08a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true
      })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      sprite.renderOrder = 3
      scene.add(sprite)
      this.flashPool.push({ sprite, life: 0 })
    }

    this.flashLight = new THREE.PointLight(0xffb060, 0, 16, 2)
    this.flashLight.visible = false
    scene.add(this.flashLight)

    this.decalGeo = new THREE.PlaneGeometry(0.26, 0.26)
    this.decalMat = new THREE.MeshBasicMaterial({
      map: textures.hole,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    })
  }

  _makeParticles(max, size, additive) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(max * 3)
    const colors = new Float32Array(max * 3)
    for (let i = 0; i < max; i++) positions[i * 3 + 1] = -999
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
      size,
      map: this.textures.soft,
      vertexColors: true,
      transparent: true,
      opacity: additive ? 0.9 : 0.35,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.scene.add(points)
    return {
      points,
      geometry,
      positions,
      colors,
      data: Array.from({ length: max }, () => ({ vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, size: 1 })),
      cursor: 0,
      max
    }
  }

  _spawn(store, x, y, z, vx, vy, vz, life, color, spread = 1) {
    const i = store.cursor
    store.cursor = (store.cursor + 1) % store.max
    const d = store.data[i]
    d.vx = vx
    d.vy = vy
    d.vz = vz
    d.life = life
    d.max = life
    d.r = color.r
    d.g = color.g
    d.b = color.b
    store.positions[i * 3] = x
    store.positions[i * 3 + 1] = y
    store.positions[i * 3 + 2] = z
    store.colors[i * 3] = color.r
    store.colors[i * 3 + 1] = color.g
    store.colors[i * 3 + 2] = color.b
  }

  sparkBurst(position, count = 8, color = 0xffb060, speed = 6, life = 0.4) {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const b = Math.random() * Math.PI - Math.PI / 2
      const s = speed * (0.3 + Math.random() * 0.9)
      this._spawn(this.sparks, position.x, position.y, position.z,
        Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s + 1.5, Math.sin(a) * Math.cos(b) * s,
        life * (0.5 + Math.random()), c)
    }
  }

  dustPuff(position, normal, color = 0xb6aa90, count = 4) {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const s = 0.7 + Math.random() * 1.2
      this._spawn(this.dust, position.x + normal.x * 0.1, position.y + normal.y * 0.1, position.z + normal.z * 0.1,
        normal.x * s + (Math.random() - 0.5) * 1.2,
        normal.y * s + Math.random() * 1.0,
        normal.z * s + (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.5, c)
    }
  }

  tracer(from, to, color = 0xffd08a, opacity = 0.85) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to])
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    this.scene.add(line)
    this.tracers.push({ line, life: 0.08 + Math.random() * 0.03 })
  }

  impact(point, normal, kind = 'terrain') {
    this.dustPuff(point, normal, kind === 'terrain' ? 0xb9ac8a : 0xb9b4a6, kind === 'terrain' ? 5 : 3)
    this.sparkBurst(point, kind === 'build' || kind === 'metal' ? 9 : 4, 0xffc070, 5, 0.3)
    if (kind !== 'water' && this.decals.length < MAX_DECALS) {
      const mesh = new THREE.Mesh(this.decalGeo, this.decalMat)
      mesh.position.copy(point).addScaledVector(normal, 0.02)
      mesh.lookAt(point.clone().add(normal))
      mesh.rotateZ(Math.random() * Math.PI * 2)
      mesh.renderOrder = 1
      this.scene.add(mesh)
      this.decals.push({ mesh, life: 26 })
    }
  }

  muzzle(position, scale = 0.55, color = 0xffd08a) {
    const entry = this.flashPool.find((f) => f.life <= 0) || this.flashPool[0]
    entry.sprite.position.copy(position)
    entry.sprite.scale.set(scale, scale, 1)
    entry.sprite.material.rotation = Math.random() * Math.PI
    entry.sprite.material.color.set(color)
    entry.sprite.material.opacity = 0.95
    entry.sprite.visible = true
    entry.life = 0.055
    return entry
  }

  playerFlash(position, direction) {
    this.muzzle(position, 0.6)
    this.flashLight.position.copy(position)
    this.flashLight.intensity = 9
    this.flashLight.visible = true
    const d = direction || new THREE.Vector3(0, 0, -1)
    this.flashLight.position.addScaledVector(d, 0.4)
    this._flashDecay = 0.05
  }

  debris(position, color = 0x9c7a4a, count = 14) {
    this.sparkBurst(position, count, color, 5.5, 0.55)
    this.dustPuff(position, new THREE.Vector3(0, 1, 0), 0xb2a184, 8)
  }

  update(dt) {
    this.time += dt
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]
      t.life -= dt
      t.line.material.opacity = Math.max(0, t.life / 0.1) * 0.85
      if (t.life <= 0) {
        this.scene.remove(t.line)
        t.line.geometry.dispose()
        t.line.material.dispose()
        this.tracers.splice(i, 1)
      }
    }
    for (const store of [this.sparks, this.dust]) {
      let changed = false
      for (let i = 0; i < store.max; i++) {
        const d = store.data[i]
        if (d.life <= 0) continue
        d.life -= dt
        const idx = i * 3
        if (d.life <= 0) {
          store.positions[idx + 1] = -999
          changed = true
          continue
        }
        const drag = store === this.dust ? 0.035 : 0.012
        d.vx -= d.vx * drag
        d.vy -= (store === this.dust ? 2.5 : 12) * dt
        d.vz -= d.vz * drag
        store.positions[idx] += d.vx * dt
        store.positions[idx + 1] += d.vy * dt
        store.positions[idx + 2] += d.vz * dt
        const fade = d.life / d.max
        store.colors[idx] = d.r * fade
        store.colors[idx + 1] = d.g * fade
        store.colors[idx + 2] = d.b * fade
        changed = true
      }
      if (changed) {
        store.geometry.attributes.position.needsUpdate = true
        store.geometry.attributes.color.needsUpdate = true
      }
    }
    for (let i = this.flashPool.length - 1; i >= 0; i--) {
      const f = this.flashPool[i]
      if (f.life > 0) {
        f.life -= dt
        f.sprite.material.opacity = Math.max(0, f.life / 0.055)
        if (f.life <= 0) f.sprite.visible = false
      }
    }
    if (this.flashLight.visible) {
      this.flashLight.intensity *= Math.pow(0.0001, dt)
      if (this.flashLight.intensity < 0.2) {
        this.flashLight.intensity = 0
        this.flashLight.visible = false
      }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]
      d.life -= dt
      if (d.life <= 0) {
        this.scene.remove(d.mesh)
        this.decals.splice(i, 1)
      }
    }
  }
}

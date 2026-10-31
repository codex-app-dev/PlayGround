import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)
const Q = new THREE.Quaternion()
const V = new THREE.Vector3()

const PALETTE = {
  gunmetal: { color: 0x25292c, metalness: 0.82, roughness: 0.34 },
  polymer: { color: 0x34383a, metalness: 0.05, roughness: 0.78 },
  tan: { color: 0x8d7a58, metalness: 0.08, roughness: 0.7 },
  wood: { color: 0x5e4329, metalness: 0.02, roughness: 0.72 },
  glove: { color: 0x2b2d29, metalness: 0.02, roughness: 0.96 },
  sleeve: { color: 0x4c5341, metalness: 0.01, roughness: 0.98 },
  skin: { color: 0xb08360, metalness: 0.0, roughness: 0.9 },
  lens: { color: 0x2f6c86, metalness: 0.5, roughness: 0.12, emissive: 0x0b2430 },
  accent: { color: 0xc8641f, metalness: 0.4, roughness: 0.4 }
}

function box(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  parent.add(mesh)
  return mesh
}

function cyl(parent, mat, radius, length, x, y, z, axis = 'z') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat)
  mesh.position.set(x, y, z)
  if (axis === 'z') mesh.rotation.x = Math.PI / 2
  parent.add(mesh)
  return mesh
}

function limb(parent, sleeveMat, gloveMat, from, to, thickness = 0.085) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const dir = b.clone().sub(a)
  const len = dir.length()
  const geo = new THREE.BoxGeometry(thickness, len, thickness * 1.05)
  const mesh = new THREE.Mesh(geo, sleeveMat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  Q.setFromUnitVectors(UP, dir.normalize())
  mesh.quaternion.copy(Q)
  parent.add(mesh)
  const hand = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.25, 0.11, 0.16), gloveMat)
  hand.position.copy(b)
  hand.rotation.set(0.3, 0, 0)
  parent.add(hand)
  return mesh
}

export class Viewmodel {
  constructor(camera) {
    this.camera = camera
    this.root = new THREE.Group()
    this.root.position.set(0.3, -0.26, -0.54)
    this.root.rotation.set(0.02, -0.055, 0.01)
    camera.add(this.root)
    this.basePos = new THREE.Vector3(0.3, -0.26, -0.54)
    this.adsPos = new THREE.Vector3(0.0, -0.145, -0.44)
    this.baseRot = new THREE.Euler(0.02, -0.055, 0.01)
    this.adsRot = new THREE.Euler(0.0, 0.0, 0.0)
    this.kick = 0
    this.sway = new THREE.Vector2()
    this.reloadAnim = 0
    this.reloading = false
    this.bobPhase = 0
    this.ads = 0
    this.hidden = false
    this.weaponGroups = {}
    this.materials = {}
    for (const [key, def] of Object.entries(PALETTE)) {
      this.materials[key] = new THREE.MeshStandardMaterial(def)
    }
    this.light = new THREE.PointLight(0xffe8cf, 0.7, 2.6, 2)
    this.light.position.set(0.25, 0.15, 0.15)
    camera.add(this.light)
    this._buildWeapons()
    this.show('p92')
  }

  _buildWeapons() {
    this.weaponGroups.p92 = this._pistol()
    this.weaponGroups.ump45 = this._smg()
    this.weaponGroups.m416 = this._rifle()
    this.weaponGroups.s686 = this._shotgun()
    this.weaponGroups.kar98 = this._sniper()
    for (const [id, group] of Object.entries(this.weaponGroups)) {
      group.visible = false
      this.root.add(group)
      group.userData.muzzle = new THREE.Object3D()
      group.add(group.userData.muzzle)
      group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false } })
    }
    this.weaponGroups.p92.userData.muzzle.position.set(0, 0.005, -0.23)
    this.weaponGroups.ump45.userData.muzzle.position.set(0, 0.02, -0.7)
    this.weaponGroups.m416.userData.muzzle.position.set(0, 0.02, -0.92)
    this.weaponGroups.s686.userData.muzzle.position.set(0, 0.015, -0.72)
    this.weaponGroups.kar98.userData.muzzle.position.set(0, 0.02, -1.0)
  }

  _base(id) {
    const group = new THREE.Group()
    const m = this.materials
    if (id === 'p92' || id === 'ump45') {
      // shared hand placement is done per weapon below
    }
    return group
  }

  _pistol() {
    const g = this._base('p92')
    const m = this.materials
    box(g, m.gunmetal, 0.075, 0.085, 0.3, 0, 0.01, -0.04)
    box(g, m.polymer, 0.07, 0.055, 0.2, 0, -0.035, -0.03)
    box(g, m.polymer, 0.075, 0.16, 0.09, 0, -0.12, 0.07, 0.22, 0, 0)
    box(g, m.gunmetal, 0.08, 0.03, 0.06, 0, -0.02, 0.01)
    box(g, m.accent, 0.078, 0.018, 0.05, 0, 0.058, -0.08)
    cyl(g, m.gunmetal, 0.022, 0.08, 0, 0.01, -0.22)
    // suppressor-ish thread
    cyl(g, m.gunmetal, 0.027, 0.04, 0, 0.01, -0.25)
    box(g, m.gunmetal, 0.012, 0.03, 0.02, 0, 0.075, -0.16)
    limb(g, m.sleeve, m.glove, [0.27, -0.62, 0.16], [0.045, -0.14, 0.03], 0.095)
    limb(g, m.sleeve, m.glove, [-0.3, -0.64, 0.08], [-0.07, -0.17, 0.08], 0.09)
    return g
  }

  _smg() {
    const g = this._base('ump45')
    const m = this.materials
    box(g, m.polymer, 0.095, 0.11, 0.36, 0, 0, -0.12)
    box(g, m.polymer, 0.085, 0.09, 0.24, 0, 0.004, -0.38)
    cyl(g, m.gunmetal, 0.025, 0.16, 0, 0.01, -0.55)
    box(g, m.gunmetal, 0.03, 0.03, 0.18, 0, 0.065, -0.4)
    box(g, m.polymer, 0.08, 0.22, 0.11, 0, -0.16, -0.04, -0.12, 0, 0)
    box(g, m.polymer, 0.075, 0.18, 0.09, 0, -0.13, 0.1, 0.28, 0, 0)
    box(g, m.polymer, 0.07, 0.13, 0.24, 0, -0.02, 0.2)
    box(g, m.gunmetal, 0.012, 0.045, 0.05, 0, 0.07, -0.55)
    box(g, m.accent, 0.098, 0.015, 0.11, 0, -0.045, -0.2)
    limb(g, m.sleeve, m.glove, [0.28, -0.62, 0.14], [0.04, -0.15, 0.03], 0.095)
    limb(g, m.sleeve, m.glove, [-0.32, -0.62, -0.12], [-0.02, -0.09, -0.38], 0.09)
    return g
  }

  _rifle() {
    const g = this._base('m416')
    const m = this.materials
    box(g, m.gunmetal, 0.085, 0.11, 0.42, 0, 0, -0.1)
    box(g, m.tan, 0.08, 0.1, 0.32, 0, 0.005, -0.42)
    cyl(g, m.gunmetal, 0.028, 0.36, 0, 0.012, -0.73)
    cyl(g, m.gunmetal, 0.036, 0.09, 0, 0.012, -0.94)
    box(g, m.gunmetal, 0.03, 0.034, 0.22, 0, 0.07, -0.4)
    box(g, m.tan, 0.08, 0.12, 0.28, 0, -0.01, 0.24)
    box(g, m.tan, 0.08, 0.17, 0.1, 0, -0.14, 0.05, 0.2, 0, 0)
    box(g, m.gunmetal, 0.07, 0.22, 0.11, 0, -0.17, -0.08, -0.18, 0, 0)
    box(g, m.gunmetal, 0.012, 0.06, 0.06, 0, 0.115, -0.62)
    box(g, m.gunmetal, 0.03, 0.05, 0.05, 0, 0.09, -0.15)
    // Optic
    box(g, m.gunmetal, 0.06, 0.06, 0.14, 0, 0.105, -0.2)
    const lens = box(g, m.lens, 0.044, 0.044, 0.015, 0, 0.105, -0.27)
    lens.rotation.x = 0
    box(g, m.accent, 0.086, 0.016, 0.12, 0, -0.03, -0.42)
    limb(g, m.sleeve, m.glove, [0.28, -0.63, 0.16], [0.04, -0.15, 0.03], 0.1)
    limb(g, m.sleeve, m.glove, [-0.32, -0.64, -0.1], [-0.02, -0.1, -0.4], 0.095)
    return g
  }

  _shotgun() {
    const g = this._base('s686')
    const m = this.materials
    box(g, m.wood, 0.085, 0.12, 0.34, 0, -0.01, 0.19)
    box(g, m.gunmetal, 0.095, 0.1, 0.28, 0, 0, -0.1)
    box(g, m.wood, 0.085, 0.09, 0.2, 0, -0.01, -0.4)
    cyl(g, m.gunmetal, 0.028, 0.44, -0.033, 0.025, -0.55)
    cyl(g, m.gunmetal, 0.028, 0.44, 0.033, 0.025, -0.55)
    box(g, m.gunmetal, 0.012, 0.03, 0.03, 0, 0.055, -0.66)
    box(g, m.wood, 0.08, 0.16, 0.09, 0, -0.12, 0.14, 0.24, 0, 0)
    box(g, m.accent, 0.098, 0.016, 0.1, 0, -0.045, -0.22)
    limb(g, m.sleeve, m.glove, [0.28, -0.62, 0.18], [0.05, -0.15, 0.06], 0.1)
    limb(g, m.sleeve, m.glove, [-0.32, -0.63, -0.02], [-0.03, -0.1, -0.32], 0.095)
    return g
  }

  _sniper() {
    const g = this._base('kar98')
    const m = this.materials
    box(g, m.wood, 0.085, 0.12, 0.62, 0, -0.015, 0.12)
    box(g, m.wood, 0.09, 0.17, 0.1, 0, -0.13, 0.13, 0.22, 0, 0)
    box(g, m.gunmetal, 0.075, 0.09, 0.3, 0, 0.02, -0.3)
    cyl(g, m.gunmetal, 0.02, 0.68, 0, 0.03, -0.72)
    cyl(g, m.gunmetal, 0.033, 0.07, 0, 0.03, -1.06)
    box(g, m.gunmetal, 0.05, 0.05, 0.18, 0, 0.165, -0.34)
    const scope = box(g, m.gunmetal, 0.075, 0.075, 0.24, 0, 0.135, -0.28)
    scope.rotation.x = 0
    box(g, m.lens, 0.06, 0.06, 0.015, 0, 0.135, -0.4)
    box(g, m.lens, 0.055, 0.055, 0.015, 0, 0.135, -0.16)
    box(g, m.gunmetal, 0.012, 0.045, 0.04, 0, 0.065, -0.06)
    // bolt
    const bolt = box(g, m.gunmetal, 0.15, 0.018, 0.018, 0.1, 0.055, -0.05)
    bolt.rotation.z = 0.15
    box(g, m.accent, 0.088, 0.015, 0.14, 0, -0.055, -0.35)
    limb(g, m.sleeve, m.glove, [0.28, -0.64, 0.18], [0.04, -0.14, 0.05], 0.1)
    limb(g, m.sleeve, m.glove, [-0.32, -0.64, -0.08], [-0.02, -0.1, -0.36], 0.095)
    return g
  }

  show(id) {
    for (const [key, group] of Object.entries(this.weaponGroups)) {
      group.visible = key === id
    }
    this.current = id
  }

  setVisible(visible) {
    this.root.visible = visible
  }

  kickWeapon(amount = 0.8) {
    this.kick = Math.min(1.8, this.kick + amount)
  }

  startReload() { this.reloading = true }
  endReload() { this.reloading = false }

  muzzleWorld(out = new THREE.Vector3()) {
    const group = this.weaponGroups[this.current]
    if (!group) return out
    this.camera.updateMatrixWorld()
    group.userData.muzzle.getWorldPosition(out)
    return out
  }

  update(dt, state = {}) {
    const adsTarget = state.ads ? 1 : 0
    this.ads += (adsTarget - this.ads) * Math.min(1, dt * 12)
    const speed = state.speed || 0
    const moving = speed > 0.3 && state.grounded
    this.bobPhase += dt * (2.2 + speed * 0.85)
    const bobAmount = moving ? Math.min(1, speed / 5) : 0
    const swing = state.sprint ? 1.5 : 1

    const hip = this.basePos
    const targetX = (adsTarget ? this.adsPos.x : hip.x) + Math.sin(this.bobPhase) * 0.017 * bobAmount * (1 - this.ads)
    const targetY = (adsTarget ? this.adsPos.y : hip.y) + Math.abs(Math.cos(this.bobPhase)) * 0.016 * bobAmount * (1 - this.ads) - 0.03 * (state.sprint ? 1 : 0)
    const targetZ = adsTarget ? this.adsPos.z : hip.z

    this.sway.x += ((state.lookX || 0) * -0.00042 - this.sway.x) * Math.min(1, dt * 8)
    this.sway.y += ((state.lookY || 0) * 0.0004 - this.sway.y) * Math.min(1, dt * 8)
    this.kick = Math.max(0, this.kick - dt * 9)

    const reloadDip = this.reloading ? Math.sin((state.reloadProgress || 0) * Math.PI) : 0
    const targetRotX = (adsTarget ? this.adsRot.x : this.baseRot.x) + this.kick * 0.045 + reloadDip * 0.32
    const targetRotY = (adsTarget ? this.adsRot.y : this.baseRot.y) + this.sway.x * 1.4 + (state.sprint ? 0.34 : 0) + (state.build ? 0.5 : 0)
    const targetRotZ = (adsTarget ? this.adsRot.z : this.baseRot.z) + this.sway.x * 0.8 + reloadDip * 0.45 + (state.sprint ? 0.18 : 0)

    const k = 1 - Math.exp(-14 * dt)
    this.root.position.x += (targetX + this.sway.x * 0.6 - this.root.position.x) * k
    this.root.position.y += (targetY + this.sway.y * 0.4 - reloadDip * 0.1 - this.root.position.y) * k
    this.root.position.z += (targetZ + this.kick * 0.055 * (1 - this.ads) - this.root.position.z) * k
    this.root.rotation.x += (targetRotX - this.root.rotation.x) * k
    this.root.rotation.y += (targetRotY - this.root.rotation.y) * k
    this.root.rotation.z += (targetRotZ - this.root.rotation.z) * k
    this.root.visible = !this.hidden && !state.build
    this.root.scale.setScalar(adsTarget ? 0.96 : 1)

    // when switching weapons, hide non-current
    if (this.current) {
      for (const [key, group] of Object.entries(this.weaponGroups)) {
        group.visible = key === this.current
      }
    }
  }
}

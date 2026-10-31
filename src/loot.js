import * as THREE from 'three'
import { WEAPONS, LOOT_WEIGHTS, RARITY } from './config.js'
import { makeLootLabel } from './textures.js'
import { weightedPick, mulberry32, clamp } from './utils.js'

export class LootSystem {
  constructor(scene, world, textures) {
    this.scene = scene
    this.world = world
    this.textures = textures
    this.items = []
    this.rng = mulberry32((Date.now() ^ 0x9e37) >>> 0)
    this.time = 0
    this.root = new THREE.Group()
    this.root.name = 'loot'
    this.scene.add(this.root)

    this.crateGeo = new THREE.BoxGeometry(0.52, 0.5, 0.52)
    this.bandGeo = new THREE.BoxGeometry(0.56, 0.08, 0.56)
    this.beamGeo = new THREE.CylinderGeometry(0.17, 0.17, 2.2, 8, 1, true)
    this.crateMatBase = new THREE.MeshStandardMaterial({
      map: textures.crate,
      color: 0x9c8766,
      roughness: 0.85,
      metalness: 0.08
    })

    for (const point of world.lootPoints) this.add(point)
  }

  pickWeapon() {
    return weightedPick(this.rng, LOOT_WEIGHTS).id
  }

  add(point) {
    const kind = point.kind
    const weaponId = point.weapon || (kind === 'weapon' ? this.pickWeapon() : null)
    const rarity = weaponId ? (RARITY[weaponId] || RARITY.ammo) : (RARITY[kind] || RARITY.ammo)
    const name = weaponId ? WEAPONS[weaponId].name : kind === 'ammo' ? 'AMMO' : kind === 'medkit' ? 'MEDKIT' : kind === 'armor' ? 'ARMOR' : 'SUPPLY'
    const color = new THREE.Color(rarity.color)

    const group = new THREE.Group()
    group.position.set(point.x, point.y, point.z)

    const crateMat = this.crateMatBase.clone()
    crateMat.color.copy(color).multiplyScalar(0.42).add(new THREE.Color(0x5b513f))
    const crate = new THREE.Mesh(this.crateGeo, crateMat)
    crate.position.y = 0.27
    crate.rotation.y = Math.random() * Math.PI
    crate.castShadow = true
    crate.receiveShadow = true
    group.add(crate)

    const bandMat = new THREE.MeshStandardMaterial({
      color: color.clone(),
      emissive: color.clone().multiplyScalar(0.8),
      emissiveIntensity: 1.2,
      roughness: 0.4,
      metalness: 0.2
    })
    const band = new THREE.Mesh(this.bandGeo, bandMat)
    band.position.y = 0.5
    band.rotation.y = crate.rotation.y
    group.add(band)

    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const beam = new THREE.Mesh(this.beamGeo, beamMat)
    beam.position.y = 1.35
    group.add(beam)

    const labelTexture = makeLootLabel(name, rarity.label, rarity.color)
    const labelMat = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0.95
    })
    const label = new THREE.Sprite(labelMat)
    label.position.y = 1.78
    label.scale.set(1.42, 0.71, 1)
    group.add(label)

    this.root.add(group)
    const item = {
      point: { ...point, weapon: weaponId },
      group, crate, band, beam, label, color,
      baseY: point.y,
      name, kind, weaponId,
      taken: false,
      phase: Math.random() * Math.PI * 2
    }
    this.items.push(item)
    return item
  }

  addWeapon(x, y, z, weaponId) {
    return this.add({ x, y, z, kind: 'weapon', weapon: weaponId })
  }

  nearest(position, range = 3.1) {
    let best = null
    let bestDist = range
    for (const item of this.items) {
      if (item.taken) continue
      const dx = position.x - item.group.position.x
      const dz = position.z - item.group.position.z
      const dy = Math.abs(position.y + 0.6 - item.group.position.y)
      if (dy > 2.6) continue
      const d = Math.hypot(dx, dz)
      if (d < bestDist) {
        bestDist = d
        best = item
      }
    }
    return best ? { item: best, distance: bestDist } : null
  }

  take(item) {
    if (item.taken) return
    item.taken = true
    item.group.visible = false
    item.group.traverse((o) => {
      if (o.isMesh) {
        if (o.material && o.material !== this.crateMatBase) {
          if (o.material.map && o.material.map !== this.textures.crate) o.material.map.dispose()
          o.material.dispose()
        }
      }
    })
    setTimeout(() => this.root.remove(item.group), 0)
  }

  getWeaponLabel(weaponId) {
    return WEAPONS[weaponId]?.name || 'WEAPON'
  }

  reset() {
    for (const item of this.items) {
      this.root.remove(item.group)
      item.group.traverse((o) => {
        if (!o.isMesh && !o.isSprite) return
        if (o.material && o.material !== this.crateMatBase) {
          if (o.material.map && o.material.map !== this.textures.crate) o.material.map.dispose()
          o.material.dispose()
        }
      })
    }
    this.items.length = 0
    this.root.clear()
    this.time = 0
    for (const point of this.world.lootPoints) this.add(point)
  }

  update(dt, camera, playerPos) {
    this.time += dt
    const t = this.time
    for (const item of this.items) {
      if (item.taken) continue
      const g = item.group
      const dist = playerPos ? Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z) : 0
      g.visible = dist < 95
      if (!g.visible) continue
      const bob = Math.sin(t * 1.8 + item.phase) * 0.06
      item.crate.position.y = 0.27 + bob
      item.band.position.y = 0.5 + bob
      item.crate.rotation.y += dt * 0.5
      item.band.rotation.y = item.crate.rotation.y
      item.beam.material.opacity = 0.10 + Math.sin(t * 2.4 + item.phase) * 0.045
      item.beam.scale.y = 1 + Math.sin(t * 1.6 + item.phase) * 0.07
      item.label.visible = dist < 28
      if (item.label.visible) {
        item.label.position.y = 1.78 + bob * 0.7
        item.label.material.opacity = clamp(1 - (dist - 18) / 12, 0.1, 0.95)
      }
    }
  }
}

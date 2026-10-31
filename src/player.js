import * as THREE from 'three'
import { MATCH, WEAPONS, BUILD_COSTS, BUILD_LABELS } from './config.js'
import { clamp, damp, lerp } from './utils.js'

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3()
const RIGHT = new THREE.Vector3()
const SHOT_DIR = new THREE.Vector3()
const MUZZLE = new THREE.Vector3()
const HIT_POINT = new THREE.Vector3()
const TMP = new THREE.Vector3()

export class Player {
  constructor({ scene, camera, world, input, audio, fx, loot, viewmodel }) {
    this.scene = scene
    this.camera = camera
    this.world = world
    this.input = input
    this.audio = audio
    this.fx = fx
    this.loot = loot
    this.viewmodel = viewmodel
    this.hud = null
    this.bots = null
    this.building = null
    this.zone = null

    this.pos = new THREE.Vector3()
    this.vy = 0
    this.yaw = 0
    this.pitch = 0
    this.grounded = true
    this.swimming = false
    this.crouching = false
    this.eye = MATCH.eyeHeight
    this.speed = 0
    this.walkPhase = 0
    this.shake = 0
    this.stepTimer = 0

    this.health = MATCH.playerHealth
    this.maxHealth = MATCH.playerHealth
    this.armor = MATCH.playerArmor
    this.maxArmor = 100
    this.medkits = 1
    this.wood = MATCH.spawnWood
    this.healing = 0
    this.healDuration = MATCH.medkitTime

    this.slots = [null, this.makeWeapon('p92')]
    this.activeSlot = 1
    this.reloading = false
    this.reloadTimer = 0
    this.reloadDuration = 1
    this.fireCooldown = 0
    this.spread = 0.02
    this.ads = 0
    this.recoilPulse = 0
    this.muzzleTimer = 0

    this.dead = false
    this.kills = 0
    this.damageDealt = 0
    this.lastAttacker = null
    this.onDeath = null
    this.onKill = null

    this.interactTarget = null
    this.harvestTarget = null
    this.chopCooldown = 0
    this._lastLookX = 0
    this._lastLookY = 0

    this.camera.rotation.order = 'YXZ'
    this.reset()
  }

  makeWeapon(id) {
    const def = WEAPONS[id]
    return { id, mag: def.mag, reserve: def.reserve, def }
  }

  get weapon() {
    return this.slots[this.activeSlot]
  }

  get weaponDef() {
    return this.weapon ? WEAPONS[this.weapon.id] : null
  }

  get eyeHeight() {
    return this.crouching ? MATCH.crouchEyeHeight : MATCH.eyeHeight
  }

  reset() {
    const sp = this.world.playerSpawn
    this.pos.set(sp.x, this.world.groundHeight(sp.x, sp.z, 200), sp.z)
    this.vy = 0
    this.yaw = sp.yaw || 0
    this.pitch = 0
    this.grounded = true
    this.swimming = false
    this.crouching = false
    this.eye = MATCH.eyeHeight
    this.speed = 0
    this.shake = 0
    this.health = this.maxHealth
    this.armor = 0
    this.medkits = 1
    this.wood = MATCH.spawnWood
    this.healing = 0
    this.slots = [null, this.makeWeapon('p92')]
    this.activeSlot = 1
    this.reloading = false
    this.reloadTimer = 0
    this.fireCooldown = 0
    this.dead = false
    this.kills = 0
    this.damageDealt = 0
    this.lastAttacker = null
    this.interactTarget = null
    this.harvestTarget = null
    this.chopCooldown = 0
    this._lastLookX = 0
    this._lastLookY = 0
    this.viewmodel.show('p92')
    this.viewmodel.reloading = false
    this.viewmodel.setVisible(true)
    this.camera.fov = 72
    this.camera.updateProjectionMatrix()
    this.syncCamera(0)
  }

  setHud(hud) { this.hud = hud }
  setBots(bots) { this.bots = bots }
  setBuilding(building) { this.building = building }
  setZone(zone) { this.zone = zone }

  /* ------------------------------------------------------------------ */
  /* Frame update                                                        */
  /* ------------------------------------------------------------------ */

  update(dt) {
    if (this.dead) {
      this.updateCameraFall(dt)
      return
    }
    this.look(dt)
    this.handleActions(dt)
    this.move(dt)
    this.handleHarvest(dt)
    this.handleShooting(dt)
    this.updateReload(dt)
    this.updateHealing(dt)
    this.updateInteraction()
    this.syncCamera(dt)
    this.updateViewmodel(dt)
  }

  look(dt) {
    const lookX = this.input.lookX
    const lookY = this.input.lookY
    const sens = this.input.sensitivity * 0.00215
    this.yaw -= lookX * sens
    this.pitch -= lookY * sens
    this.pitch = clamp(this.pitch, -1.42, 1.38)
    this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    this._lastLookX = lookX
    this._lastLookY = lookY
  }

  handleActions(dt) {
    if (this.input.consume('build')) {
      if (this.input.isTouch && this.building?.active) this.cycleBuildPiece()
      else this.toggleBuild()
    }

    if (this.building?.active) {
      if (this.input.consume('slot1')) this.setBuildPiece('wall')
      if (this.input.consume('slot2')) this.setBuildPiece('floor')
      if (this.input.consume('slot3')) this.setBuildPiece('ramp')
      if (this.input.consume('reload')) {
        this.building.rotate()
        this.audio?.click(480, 0.05, 0.1)
      }
      if (this.input.consume('fire')) this.building.place()
      return
    }

    if (this.input.consume('slot1')) this.switchSlot(0)
    if (this.input.consume('slot2')) this.switchSlot(1)
    if (this.input.consume('slot3')) this.switchSlot(1)
    if (this.input.consume('reload')) this.startReload()
    if (this.input.consume('heal')) this.startHeal()
    if (this.input.consume('interact')) this.pickup()
    if (this.input.consume('jump')) this.jump()
  }

  toggleBuild() {
    if (!this.building) return
    const active = !this.building.active
    this.building.setActive(active)
    if (active) {
      this.building.setPiece('wall')
      this.cancelReload()
      this.cancelHeal()
      this.hud?.toast('BUILD MODE', 'WALL SELECTED · 10 WOOD', 1.2)
      this.audio?.click(520, 0.05, 0.12)
    } else {
      this.hud?.toast('BUILD MODE OFF', '', 0.8)
    }
  }

  setBuildPiece(piece) {
    if (!this.building) return
    this.building.setPiece(piece)
    this.audio?.click(620, 0.03, 0.08)
    this.hud?.toast(BUILD_LABELS[piece], `${BUILD_COSTS[piece]} WOOD`, 0.7)
  }

  cycleBuildPiece() {
    if (!this.building) return
    const order = ['wall', 'floor', 'ramp']
    const index = order.indexOf(this.building.piece)
    const next = order[index + 1]
    if (!next) {
      this.toggleBuild()
      return
    }
    this.setBuildPiece(next)
  }

  switchSlot(index) {
    if (index === this.activeSlot) return
    const next = this.slots[index]
    if (!next) {
      this.hud?.toast('SLOT EMPTY', 'FIND A PRIMARY WEAPON', 0.8)
      this.audio?.click(240, 0.05, 0.06)
      return
    }
    this.cancelReload()
    this.cancelHeal()
    this.activeSlot = index
    this.viewmodel.show(next.id)
    this.audio?.click(720, 0.04, 0.1)
    this.hud?.toast(next.def.name, next.def.class, 0.7)
  }

  /* ------------------------------------------------------------------ */
  /* Movement + camera                                                   */
  /* ------------------------------------------------------------------ */

  move(dt) {
    const forwardAmount = this.input.moveZ
    const sideAmount = this.input.moveX
    const mag = Math.hypot(forwardAmount, sideAmount)
    const sprinting = this.input.sprint && forwardAmount > 0.15 && !this.input.aiming && !this.building?.active && !this.healing
    const crouch = this.input.crouch
    this.crouching = crouch && !this.swimming

    let speed = MATCH.walkSpeed
    if (crouch) speed = MATCH.crouchSpeed
    if (sprinting) speed = MATCH.sprintSpeed
    if (this.input.aiming && !this.building?.active) speed = Math.min(speed, MATCH.adsSpeed)
    if (this.healing > 0) speed *= 0.45
    if (this.swimming) speed = 2.15
    if (this.building?.active) speed *= 0.9

    this.speed = Math.min(mag, 1) * speed
    if (mag > 0.001) {
      const yaw = this.yaw
      const fx = -Math.sin(yaw)
      const fz = -Math.cos(yaw)
      const rx = Math.cos(yaw)
      const rz = -Math.sin(yaw)
      let dx = (fx * forwardAmount + rx * sideAmount) / mag
      let dz = (fz * forwardAmount + rz * sideAmount) / mag
      if (this.swimming) {
        dx *= 0.88
        dz *= 0.88
      }
      this.pos.x += dx * this.speed * dt
      this.pos.z += dz * this.speed * dt
      this.walkPhase += dt * (this.speed * (sprinting ? 1.35 : 1.1) + 2)
    } else {
      this.walkPhase += dt * 1.4
    }

    this.world.resolveCircle(this.pos, MATCH.playerRadius, this.crouching ? 1.2 : MATCH.playerHeight)

    const terrain = this.world.getHeight(this.pos.x, this.pos.z)
    const wasSwimming = this.swimming
    this.swimming = terrain < 0.08 && this.pos.y < 0.35

    if (this.swimming) {
      this.vy = 0
      this.pos.y = damp(this.pos.y, -0.74, 7, dt)
      this.grounded = false
      this.crouching = false
    } else {
      let support = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.68)
      if (support < -8) support = terrain
      if (support > this.pos.y && support - this.pos.y <= 0.68 && this.vy <= 1.2) {
        this.pos.y = support
        this.vy = 0
        this.grounded = true
      } else {
        this.vy -= MATCH.gravity * dt
        this.pos.y += this.vy * dt
        if (this.pos.y <= support) {
          this.pos.y = support
          this.vy = 0
          this.grounded = true
        } else {
          this.grounded = false
        }
      }
    }

    if (this.grounded && this.speed > 1.1 && !this.swimming) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        this.audio?.footstep(this.speed > 6 ? 0.12 : 0.07)
        this.stepTimer = this.speed > 6 ? 0.3 : 0.46
      }
    } else {
      this.stepTimer = Math.max(0, this.stepTimer - dt * 0.4)
    }

    if (this.swimming && !wasSwimming) this.hud?.toast('SWIMMING', 'SLOWER MOVEMENT', 1.1)
    if (this.pos.y < -5.5) this.damage(12 * dt, null, { zone: true, silent: true })
  }

  jump() {
    if (this.grounded && !this.swimming && this.healing <= 0) {
      this.vy = MATCH.jumpSpeed
      this.grounded = false
      this.audio?.footstep(0.13)
    }
  }

  syncCamera(dt) {
    const crouchEye = this.eyeHeight
    this.eye = damp(this.eye, crouchEye, 15, Math.max(dt, 0.001))
    const bob = this.grounded && this.speed > 1.2 && !this.input.aiming
      ? Math.sin(this.walkPhase * 2) * Math.min(0.032, this.speed * 0.004)
      : 0
    this.shake = Math.max(0, this.shake - dt * 2.8)
    const shakeX = (Math.random() - 0.5) * this.shake * 0.009
    const shakeY = (Math.random() - 0.5) * this.shake * 0.009
    this.camera.position.set(this.pos.x, this.pos.y + this.eye + bob, this.pos.z)
    this.camera.rotation.set(this.pitch + shakeX, this.yaw + shakeY, 0, 'YXZ')

    const wantedAds = this.input.aiming && !this.building?.active && !this.swimming && this.healing <= 0
    this.ads = damp(this.ads, wantedAds ? 1 : 0, 13, Math.max(dt, 0.001))
    const def = this.weaponDef
    let targetFov = 72
    if (wantedAds && def) targetFov = def.adsFov
    else if (this.input.sprint && this.input.moveZ > 0.2 && !this.building?.active) targetFov = 76
    if (Math.abs(this.camera.fov - targetFov) > 0.02 && dt > 0) {
      this.camera.fov = damp(this.camera.fov, targetFov, 14, dt)
      this.camera.updateProjectionMatrix()
    }
  }

  updateViewmodel(dt) {
    const def = this.weaponDef
    this.viewmodel.update(dt, {
      ads: this.ads > 0.55,
      speed: this.speed,
      grounded: this.grounded,
      sprint: this.input.sprint && this.input.moveZ > 0.15 && !this.building?.active,
      lookX: this._lastLookX,
      lookY: this._lastLookY,
      reloadProgress: this.reloading ? 1 - this.reloadTimer / this.reloadDuration : 1,
      build: !!this.building?.active,
      healing: this.healing > 0
    })
    if (this.reloading) this.viewmodel.reloading = true
    if (this.dead) this.viewmodel.setVisible(false)
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt)
    this.recoilPulse = Math.max(0, this.recoilPulse - dt * 7)
  }

  updateCameraFall(dt) {
    this.eye = damp(this.eye, 0.35, 3, Math.max(dt, 0.001))
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  /* ------------------------------------------------------------------ */
  /* Combat                                                              */
  /* ------------------------------------------------------------------ */

  handleShooting(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    if (this.building?.active || this.healing > 0 || this.swimming || this.reloading) return
    const w = this.weapon
    const def = this.weaponDef
    if (!w || !def) return

    let wantsFire = false
    if (!def.auto) {
      wantsFire = this.input.consume('fire')
    } else {
      wantsFire = this.input.firing
      if (this.input.consume('fire') && !this.input.firing) wantsFire = false
    }

    if (!wantsFire || this.fireCooldown > 0) return
    if (w.mag <= 0) {
      this.audio?.dryFire()
      this.fireCooldown = 0.24
      this.hud?.toast('EMPTY MAG', 'PRESS R TO RELOAD', 1.1)
      this.startReload()
      return
    }
    this.fire(def)
    this.fireCooldown = 60 / def.rpm
    w.mag--
  }

  fire(def) {
    const w = this.weapon
    const moving = clamp(this.speed / MATCH.walkSpeed, 0, 1.5)
    const adsFactor = this.ads
    let spread = lerp(def.spread, def.adsSpread, adsFactor)
    spread += moving * 0.011 * (1 - adsFactor * 0.6)
    if (!this.grounded) spread += 0.018
    this.spread = spread

    const origin = this.camera.position
    this.camera.getWorldDirection(SHOT_DIR)
    RIGHT.set(1, 0, 0).applyQuaternion(this.camera.quaternion)
    UP.set(0, 1, 0).applyQuaternion(this.camera.quaternion)
    MUZZLE.copy(origin)
    if (this.viewmodel) this.viewmodel.muzzleWorld(MUZZLE)

    const pellets = def.pellets || 1
    const hits = new Map()
    let shotHit = false
    let anyKill = false
    let anyHead = false
    let damageTotal = 0

    for (let p = 0; p < pellets; p++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * spread * (pellets > 1 ? 1.5 : 1)
      const dir = SHOT_DIR.clone()
      dir.addScaledVector(RIGHT, Math.cos(angle) * radius)
      dir.addScaledVector(UP, Math.sin(angle) * radius)
      dir.normalize()

      const worldHit = this.world.raycast(origin, dir, 320)
      let wallDist = worldHit.point ? worldHit.distance : 320
      let botHit = this.bots ? this.bots.raycast(origin, dir, wallDist - 0.04) : null
      if (botHit && botHit.distance < wallDist) {
        HIT_POINT.copy(botHit.point)
        const falloff = damageFalloff(def, botHit.distance)
        let dmg = def.damage * falloff
        if (botHit.headshot) dmg *= def.headMult
        dmg = Math.max(1, Math.round(dmg * 10) / 10)
        const killed = this.bots.damageBot(botHit.bot, dmg, 'player', botHit.headshot, HIT_POINT, def, this)
        shotHit = true
        anyHead = anyHead || botHit.headshot
        anyKill = anyKill || killed
        damageTotal += dmg
        const key = botHit.bot
        const prev = hits.get(key)
        if (prev) { prev.dmg += dmg; prev.killed = prev.killed || killed; prev.headshot = prev.headshot || botHit.headshot }
        else hits.set(key, { dmg, killed, headshot: botHit.headshot, point: HIT_POINT.clone() })
        this.fx?.tracer(MUZZLE, HIT_POINT, def.tracer)
        this.fx?.dustPuff(HIT_POINT, new THREE.Vector3(0, 1, 0), 0x8c2118, 3)
      } else if (worldHit.point) {
        this.fx?.tracer(MUZZLE, worldHit.point, def.tracer)
        this.fx?.impact(worldHit.point, worldHit.normal, worldHit.kind)
        if (this.building && worldHit.kind === 'build' && worldHit.box?.ref) {
          this.building.damage(worldHit.box.ref, def.damage * 0.45)
        }
      } else {
        const far = MUZZLE.clone().addScaledVector(dir, 160)
        this.fx?.tracer(MUZZLE, far, def.tracer)
      }
    }

    if (hits.size) {
      this.damageDealt += damageTotal
      for (const entry of hits.values()) {
        this.hud?.damageNumber(entry.point, Math.round(entry.dmg), entry.headshot, entry.killed)
      }
      this.hud?.hitmarker(anyHead, anyKill)
      this.audio?.hit(anyHead)
    }
    if (shotHit) this.hud?.setSpread(spread)

    this.audio?.gun(w.id, 1)
    this.fx?.playerFlash(MUZZLE, SHOT_DIR)
    this.fx?.muzzle(MUZZLE, 0.5)
    this.viewmodel?.kickWeapon(def.recoil * 0.22 + 0.35)
    this.muzzleTimer = 0.06

    const recoil = def.recoil * 0.0055 * (1 - this.ads * 0.36)
    this.pitch = clamp(this.pitch + recoil, -1.42, 1.38)
    this.yaw += (Math.random() - 0.5) * def.recoilYaw * 0.0035
    this.shake = Math.min(1.2, this.shake + def.recoil * 0.08)
  }

  startReload() {
    if (!this.weapon || this.reloading || this.building?.active) return
    const w = this.weapon
    const def = w.def
    if (w.mag >= def.mag || w.reserve <= 0) {
      if (w.reserve <= 0) this.hud?.toast('NO RESERVE AMMO', 'FIND AMMO CRATES', 1.1)
      return
    }
    this.reloading = true
    this.reloadDuration = def.reload
    this.reloadTimer = def.reload
    this.viewmodel?.startReload()
    this.audio?.reloadStart()
    this.cancelHeal()
  }

  updateReload(dt) {
    if (!this.reloading) return
    this.reloadTimer -= dt
    if (this.reloadTimer > 0) return
    const w = this.weapon
    if (!w) { this.reloading = false; return }
    const need = w.def.mag - w.mag
    const take = Math.min(need, w.reserve)
    w.mag += take
    w.reserve -= take
    this.reloading = false
    this.viewmodel?.endReload()
    this.audio?.reloadEnd()
  }

  cancelReload() {
    if (!this.reloading) return
    this.reloading = false
    this.reloadTimer = 0
    this.viewmodel?.endReload()
  }

  /* ------------------------------------------------------------------ */
  /* Healing, loot and harvesting                                        */
  /* ------------------------------------------------------------------ */

  startHeal() {
    if (this.healing > 0 || this.reloading || this.building?.active) return
    if (this.medkits <= 0) {
      this.hud?.toast('NO MEDKITS', 'LOOT MEDICAL CRATES', 1.2)
      this.audio?.click(220, 0.06, 0.08)
      return
    }
    if (this.health >= this.maxHealth) {
      this.hud?.toast('HEALTH FULL', '', 0.8)
      return
    }
    this.healing = this.healDuration
    this.audio?.heal()
    this.cancelReload()
  }

  cancelHeal() {
    this.healing = 0
  }

  updateHealing(dt) {
    if (this.healing <= 0) return
    this.healing -= dt
    if (this.healing > 0) return
    this.healing = 0
    if (this.medkits > 0) {
      this.medkits--
      const before = this.health
      this.health = Math.min(this.maxHealth, this.health + MATCH.medkitHeal)
      this.hud?.toast('HEALED', `+${Math.round(this.health - before)} HEALTH`, 1.1)
      this.audio?.pickup()
    }
  }

  updateInteraction() {
    this.interactTarget = this.loot ? this.loot.nearest(this.pos, MATCH.interactRange) : null
    this.harvestTarget = null
    if (!this.interactTarget) {
      let best = MATCH.harvestRange
      for (const tree of this.world.trees) {
        if (tree.chops === 0) continue
        const d = Math.hypot(tree.x - this.pos.x, tree.z - this.pos.z)
        if (d < best && Math.abs(tree.y - this.pos.y) < 5.5) {
          best = d
          this.harvestTarget = tree
        }
      }
    }
  }

  pickup() {
    const found = this.loot?.nearest(this.pos, MATCH.interactRange)
    if (!found) {
      if (this.harvestTarget) this.chopTree(true)
      return
    }
    const item = found.item
    this.loot.take(item)
    this.audio?.pickup()
    this.cancelHeal()

    if (item.kind === 'weapon' && item.weaponId) {
      const def = WEAPONS[item.weaponId]
      const existing = this.slots.find((s) => s && s.id === item.weaponId)
      if (existing) {
        existing.reserve = Math.min(999, existing.reserve + def.mag)
        this.hud?.toast('AMMO ADDED', `${def.name} +${def.mag}`, 1.1)
      } else {
        const state = this.makeWeapon(item.weaponId)
        let slot = this.slots.findIndex((s) => !s)
        if (slot < 0) slot = this.activeSlot
        this.slots[slot] = state
        this.activeSlot = slot
        this.reloading = false
        this.viewmodel?.endReload()
        this.viewmodel?.show(item.weaponId)
        this.hud?.toast('EQUIPPED', `${def.name} · ${def.class}`, 1.5)
      }
    } else if (item.kind === 'medkit') {
      this.medkits = Math.min(6, this.medkits + 1)
      this.hud?.toast('MEDKIT ACQUIRED', `${this.medkits} IN PACK`, 1.1)
    } else if (item.kind === 'armor') {
      this.armor = Math.min(this.maxArmor, this.armor + 55)
      this.hud?.toast('ARMOR PLATED', `${Math.round(this.armor)} ARMOR`, 1.1)
    } else if (item.kind === 'ammo') {
      const active = this.weapon
      if (active) {
        active.reserve = Math.min(999, active.reserve + 45)
        this.hud?.toast('AMMO ACQUIRED', `${active.def.name} +45`, 1.1)
      } else {
        this.slots[1].reserve += 45
        this.hud?.toast('AMMO ACQUIRED', 'P92 +45', 1.1)
      }
    } else {
      this.hud?.toast('SUPPLY TAKEN', '', 0.9)
    }
  }

  handleHarvest(dt) {
    this.chopCooldown = Math.max(0, this.chopCooldown - dt)
    if (this.building?.active || this.healing > 0) return
    const pressed = this.input.consume('harvest')
    const held = this.input.keys.has('KeyF')
    if ((!pressed && !held) || this.chopCooldown > 0) return
    if (!this.harvestTarget) {
      if (pressed) this.hud?.toast('NOTHING TO HARVEST', 'MOVE CLOSER TO A TREE', 0.9)
      return
    }
    this.chopTree(pressed)
  }

  chopTree(showFeedback = false) {
    if (this.chopCooldown > 0) return
    if (!this.harvestTarget) {
      if (showFeedback) this.hud?.toast('NOTHING TO HARVEST', 'MOVE CLOSER TO A TREE', 0.9)
      return
    }
    const tree = this.harvestTarget
    this.chopCooldown = 0.42
    this.wood = Math.min(999, this.wood + 10)
    tree.chops = Math.max(0, (tree.chops ?? 8) - 1)
    this.audio?.chop()
    this.fx?.dustPuff(TMP.set(tree.x, tree.y + 1.1, tree.z), new THREE.Vector3(0, 1, 0), 0x7e5c38, 3)
    this.shake = Math.min(0.45, this.shake + 0.09)
    this.viewmodel?.kickWeapon(0.22)
    if (showFeedback && tree.chops <= 0) this.hud?.toast('TIMBER', 'TREE DEPLETED', 0.9)
  }

  /* ------------------------------------------------------------------ */
  /* Damage / death                                                      */
  /* ------------------------------------------------------------------ */

  damage(amount, fromPos = null, opts = {}) {
    if (this.dead || amount <= 0) return
    if (this.healing > 0 && !opts.zone) this.cancelHeal()
    let incoming = amount
    if (!opts.zone && this.armor > 0) {
      const absorbed = Math.min(this.armor, incoming * 0.52)
      this.armor = Math.max(0, this.armor - absorbed)
      incoming -= absorbed
    }
    this.health -= incoming
    if (!opts.silent) {
      this.hud?.damageDirection(fromPos)
      this.hud?.flashDamage(opts.zone ? 0.28 : 0.65)
      if (!opts.zone) this.audio?.hurt()
      this.shake = Math.min(1.2, this.shake + Math.min(0.7, incoming * 0.02))
    }
    if (fromPos) this.lastAttacker = fromPos
    if (this.health <= 0) {
      this.health = 0
      this.die()
    }
  }

  die() {
    if (this.dead) return
    this.dead = true
    this.cancelReload()
    this.cancelHeal()
    this.building?.setActive(false)
    this.viewmodel?.setVisible(false)
    this.audio?.hurt()
    if (this.onDeath) this.onDeath(this)
  }

  registerKill(victimName, weaponName, headshot) {
    this.kills++
    this.audio?.kill()
    this.hud?.hitmarker(false, true)
    this.hud?.addKill('YOU', victimName, weaponName, headshot, true)
    this.hud?.toast('ELIMINATED', `${victimName} · ${headshot ? 'HEADSHOT' : weaponName}`, 1.7)
    if (this.onKill) this.onKill(victimName, weaponName, headshot)
  }

  /* ------------------------------------------------------------------ */
  /* HUD-facing data                                                     */
  /* ------------------------------------------------------------------ */

  get reloadProgress() {
    return this.reloading ? 1 - this.reloadTimer / this.reloadDuration : 1
  }

  get stance() {
    if (this.building?.active) return 'BUILDING'
    if (this.swimming) return 'SWIMMING'
    if (this.crouching) return 'CROUCHED'
    return 'STANDING'
  }
}

export function damageFalloff(def, distance) {
  const [near, far] = def.falloff
  if (distance <= near) return 1
  if (distance >= far) return def.falloffMin
  const t = (distance - near) / (far - near)
  return lerp(1, def.falloffMin, t)
}

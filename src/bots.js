import * as THREE from 'three'
import { MATCH, BOT_NAMES, WEAPONS, LOOT_WEIGHTS, SITES } from './config.js'
import { clamp, damp, lerp, angleDelta, shuffle, weightedPick, raySphere, mulberry32 } from './utils.js'

const BOT_HEIGHT = 1.82
const BOT_RADIUS = 0.42
const EYE = 1.62
const ARC = Math.PI * 2

const GEOMETRY = {
  leg: new THREE.BoxGeometry(0.25, 0.82, 0.27),
  boot: new THREE.BoxGeometry(0.28, 0.18, 0.36),
  torso: new THREE.BoxGeometry(0.64, 0.72, 0.36),
  vest: new THREE.BoxGeometry(0.7, 0.44, 0.42),
  pack: new THREE.BoxGeometry(0.48, 0.5, 0.22),
  head: new THREE.BoxGeometry(0.31, 0.31, 0.3),
  helmet: new THREE.BoxGeometry(0.4, 0.2, 0.38),
  arm: new THREE.BoxGeometry(0.19, 0.6, 0.2),
  glove: new THREE.BoxGeometry(0.2, 0.14, 0.23),
  gun: new THREE.BoxGeometry(0.09, 0.12, 0.72),
  barrel: new THREE.CylinderGeometry(0.024, 0.024, 0.34, 6),
  mag: new THREE.BoxGeometry(0.07, 0.22, 0.11),
  stock: new THREE.BoxGeometry(0.08, 0.16, 0.28),
  barBg: new THREE.PlaneGeometry(1.0, 0.105),
  barFill: new THREE.PlaneGeometry(0.94, 0.05)
}

const MATS = {
  uniform: new THREE.MeshStandardMaterial({ color: 0x4a5342, roughness: 0.96, flatShading: true }),
  uniformTan: new THREE.MeshStandardMaterial({ color: 0x6f654c, roughness: 0.96, flatShading: true }),
  uniformGrey: new THREE.MeshStandardMaterial({ color: 0x4d5050, roughness: 0.98, flatShading: true }),
  pants: new THREE.MeshStandardMaterial({ color: 0x3a4037, roughness: 1, flatShading: true }),
  vest: new THREE.MeshStandardMaterial({ color: 0x2e332c, roughness: 0.88, flatShading: true }),
  skin: new THREE.MeshStandardMaterial({ color: 0xa77b5a, roughness: 0.92 }),
  skinDark: new THREE.MeshStandardMaterial({ color: 0x7a563f, roughness: 0.93 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0x343a31, roughness: 0.82, metalness: 0.08, flatShading: true }),
  boot: new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 1, flatShading: true }),
  gun: new THREE.MeshStandardMaterial({ color: 0x24282b, metalness: 0.6, roughness: 0.44, flatShading: true }),
  accent: new THREE.MeshStandardMaterial({ color: 0xc9601e, roughness: 0.7, emissive: 0x3b1605 }),
  pack: new THREE.MeshStandardMaterial({ color: 0x4b4634, roughness: 0.95, flatShading: true })
}

function part(geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function makeBotModel(index) {
  const group = new THREE.Group()
  group.name = `bot-${index}`
  const model = new THREE.Group()
  group.add(model)

  const uniform = index % 7 === 0 ? MATS.uniformTan : index % 5 === 0 ? MATS.uniformGrey : MATS.uniform
  // Legs on hip pivots so they can swing.
  const legL = new THREE.Group()
  legL.position.set(0.17, 0.88, 0)
  const legR = new THREE.Group()
  legR.position.set(-0.17, 0.88, 0)
  model.add(legL, legR)
  part(GEOMETRY.leg, MATS.pants, legL, 0, -0.4, 0)
  part(GEOMETRY.leg, MATS.pants, legR, 0, -0.4, 0)
  part(GEOMETRY.boot, MATS.boot, legL, 0, -0.82, -0.04)
  part(GEOMETRY.boot, MATS.boot, legR, 0, -0.82, -0.04)

  const torso = part(GEOMETRY.torso, uniform, model, 0, 1.27, 0)
  part(GEOMETRY.vest, MATS.vest, model, 0, 1.34, 0)
  part(GEOMETRY.pack, MATS.pack, model, 0, 1.34, 0.27)
  // Orange armband helps enemies read at distance.
  part(new THREE.BoxGeometry(0.28, 0.12, 0.37), MATS.accent, model, 0.22, 1.49, 0)

  const armL = new THREE.Group()
  armL.position.set(0.4, 1.48, 0)
  const armR = new THREE.Group()
  armR.position.set(-0.39, 1.47, 0)
  model.add(armL, armR)
  part(GEOMETRY.arm, uniform, armL, 0, -0.26, -0.04, 0.72, 0, -0.08)
  part(GEOMETRY.arm, uniform, armR, 0, -0.25, -0.12, 1.02, 0, 0.22)
  part(GEOMETRY.glove, MATS.boot, armL, 0, -0.5, -0.3)
  part(GEOMETRY.glove, MATS.boot, armR, 0, -0.47, -0.35)

  const head = new THREE.Group()
  head.position.set(0, 1.79, 0)
  model.add(head)
  part(GEOMETRY.head, index % 4 === 0 ? MATS.skinDark : MATS.skin, head, 0, 0, 0)
  part(GEOMETRY.helmet, MATS.helmet, head, 0, 0.18, 0.01)
  // Scarf / lower face.
  part(new THREE.BoxGeometry(0.34, 0.12, 0.33), MATS.vest, head, 0, -0.13, -0.02)

  const gun = new THREE.Group()
  gun.position.set(-0.13, 1.3, -0.35)
  model.add(gun)
  part(GEOMETRY.gun, MATS.gun, gun, 0, 0, -0.18)
  part(GEOMETRY.barrel, MATS.gun, gun, 0, 0.01, -0.58, Math.PI / 2, 0, 0)
  part(GEOMETRY.mag, MATS.gun, gun, 0, -0.13, -0.18)
  part(GEOMETRY.stock, MATS.gun, gun, 0, -0.01, 0.22)

  return { group, model, legL, legR, armL, armR, head, gun, torso }
}

function makeHealthBar() {
  const group = new THREE.Group()
  group.renderOrder = 6
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x07100d,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: false
  })
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x94e06c,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false
  })
  const bg = new THREE.Mesh(GEOMETRY.barBg, bgMat)
  bg.renderOrder = 6
  const fillGeo = GEOMETRY.barFill.clone()
  // Translate the fill so scaling keeps its left edge pinned.
  fillGeo.translate(0.47, 0, 0)
  const fill = new THREE.Mesh(fillGeo, fillMat)
  fill.renderOrder = 7
  fill.position.set(-0.47, 0, 0.001)
  group.add(bg, fill)
  group.visible = false
  return { group, bg, fill, fillMat }
}

export class Bots {
  constructor({ scene, camera, world, player, loot, fx, audio, hud, quality = 'high' }) {
    this.scene = scene
    this.camera = camera
    this.world = world
    this.player = player
    this.loot = loot
    this.fx = fx
    this.audio = audio
    this.hud = hud
    this.quality = quality
    this.bots = []
    this.time = 0
    this.rng = mulberry32((Date.now() ^ 0xb07) >>> 0)
    this.simTimer = 16 + Math.random() * 8
    this._tmp = new THREE.Vector3()
    this._tmp2 = new THREE.Vector3()
    this._q = new THREE.Quaternion()
    this.active = false

    const count = MATCH.botCount
    for (let i = 0; i < count; i++) {
      const model = makeBotModel(i)
      const bar = makeHealthBar()
      this.scene.add(model.group)
      this.scene.add(bar.group)
      const bot = {
        id: i,
        name: BOT_NAMES[i % BOT_NAMES.length],
        group: model.group,
        body: model.model,
        parts: model,
        bar,
        pos: new THREE.Vector3(),
        yaw: 0,
        health: 100,
        armor: 0,
        alive: true,
        dead: false,
        deathTime: 0,
        dropTimer: 0,
        dropped: false,
        weaponId: 'm416',
        weapon: WEAPONS.m416,
        accuracy: 0.5,
        skill: 0.5,
        walkPhase: Math.random() * 10,
        speed: 0,
        state: 'roam',
        waypoint: { x: 0, z: 0 },
        waypointTimer: 0,
        target: null,
        targetSeen: 0,
        thinkTimer: Math.random() * 0.8,
        scanTimer: 0,
        shotTimer: 0.5,
        burstLeft: 0,
        burstPause: 0,
        fireFlash: 0,
        recentlyFired: 0,
        zoneTick: 0,
        kills: 0,
        lastHitBy: null,
        strafe: Math.random() > 0.5 ? 1 : -1
      }
      this.bots.push(bot)
    }
  }

  reset() {
    this.time = 0
    this.active = false
    this.simTimer = 16 + Math.random() * 8
    const spawns = this._spawnPoints()
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i]
      const spawn = spawns[i]
      bot.name = BOT_NAMES[i % BOT_NAMES.length]
      bot.pos.set(spawn.x, this.world.groundHeight(spawn.x, spawn.z, 200), spawn.z)
      bot.yaw = Math.random() * ARC
      bot.health = 100
      bot.armor = Math.random() < 0.25 ? 50 : 0
      bot.alive = true
      bot.dead = false
      bot.deathTime = 0
      bot.dropTimer = 0
      bot.dropped = false
      bot.target = null
      bot.targetSeen = 0
      bot.thinkTimer = Math.random() * 0.7
      bot.scanTimer = Math.random() * 0.7
      bot.shotTimer = 0.45 + Math.random() * 0.8
      bot.burstLeft = 0
      bot.burstPause = 0
      bot.recentlyFired = 0
      bot.zoneTick = 0
      bot.kills = 0
      bot.lastHitBy = null
      bot.speed = 0
      bot.state = 'roam'
      bot.waypoint = this._pickWaypoint(bot)
      bot.waypointTimer = 5 + Math.random() * 8
      bot.dropTimer = 0
      bot.weaponId = weightedPick(this.rng, LOOT_WEIGHTS).id
      bot.weapon = WEAPONS[bot.weaponId]
      bot.accuracy = clamp(0.42 + this.rng() * 0.42, 0.35, 0.92)
      bot.skill = 0.4 + this.rng() * 0.6
      bot.group.visible = true
      bot.body.visible = true
      bot.body.rotation.set(0, 0, 0)
      bot.group.position.copy(bot.pos)
      bot.group.rotation.set(0, bot.yaw, 0)
      bot.bar.group.visible = false
      bot.bar.fill.scale.x = 1
      bot.parts.gun.position.set(-0.13, 1.3, -0.35)
    }
  }

  _spawnPoints() {
    const points = shuffle(this.rng, this.world.botSpawns).filter(
      (p) => Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) > 28
    )
    const result = []
    const used = []
    for (const p of points) {
      if (used.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < 4)) continue
      used.push(p)
      result.push(p)
      if (result.length >= this.bots.length) break
    }
    // A few wildcard spawns if the site list is short.
    let guard = 0
    while (result.length < this.bots.length && guard++ < 200) {
      const a = this.rng() * ARC
      const r = 105 + this.rng() * 190
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (this.world.getHeight(x, z) < 2.4) continue
      if (Math.hypot(x - this.player.pos.x, z - this.player.pos.z) < 28) continue
      result.push({ x, z })
    }
    while (result.length < this.bots.length) {
      guard++
      result.push({ x: (this.rng() - 0.5) * 420, z: (this.rng() - 0.5) * 420 })
    }
    return result
  }

  start() {
    this.active = true
  }

  get aliveCount() {
    let n = 0
    for (const bot of this.bots) if (bot.alive) n++
    return n
  }

  get remainingWithPlayer() {
    return this.aliveCount + (this.player.dead ? 0 : 1)
  }

  /* ------------------------------------------------------------------ */
  /* Main update                                                         */
  /* ------------------------------------------------------------------ */

  update(dt, zone) {
    this.time += dt
    for (const bot of this.bots) {
      if (!bot.alive) {
        this._updateDeath(bot, dt)
        continue
      }
      this._updateBot(bot, dt, zone)
    }
    if (this.active && zone) {
      this.simTimer -= dt
      const threshold = zone.final ? 3.6 : 7.5
      if (this.simTimer <= 0) {
        this._simulateElimination(zone)
        this.simTimer = threshold + Math.random() * (zone.final ? 2.2 : 6)
      }
    }
  }

  _updateBot(bot, dt, zone) {
    const player = this.player
    const distToPlayer = Math.hypot(bot.pos.x - player.pos.x, bot.pos.z - player.pos.z)
    bot.recentlyFired = Math.max(0, bot.recentlyFired - dt)
    bot.fireFlash = Math.max(0, bot.fireFlash - dt)

    // Zone pressure applies even to AI.
    if (zone && zone.active && zone.outside(bot.pos.x, bot.pos.z)) {
      bot.zoneTick += dt
      if (bot.zoneTick >= 0.5) {
        const dmg = zone.damagePerSecond() * bot.zoneTick
        bot.zoneTick = 0
        this.damageBot(bot, dmg, 'zone', false, null, { name: 'ZONE' }, player, null)
        if (!bot.alive) return
      }
    } else {
      bot.zoneTick = 0
    }

    // Strip stale targets.
    if (bot.target && (!bot.target.alive || (bot.target === player && player.dead))) bot.target = null
    if (bot.target) {
      bot.targetSeen -= dt
      if (bot.targetSeen <= 0) bot.target = null
    }

    bot.thinkTimer -= dt
    if (bot.thinkTimer <= 0) {
      bot.thinkTimer = 0.55 + Math.random() * 0.4
      const found = this._acquireTarget(bot)
      if (found) {
        if (found !== bot.target) {
          bot.target = found
          bot.shotTimer = Math.max(bot.shotTimer, 0.34 + Math.random() * 0.65)
          bot.strafe = Math.random() > 0.5 ? 1 : -1
        }
        bot.targetSeen = 1.4
      }
    }

    if (bot.target) {
      this._combat(bot, dt, zone)
    } else {
      this._roam(bot, dt, zone)
    }

    this._animate(bot, dt, distToPlayer)
  }

  _acquireTarget(bot) {
    const player = this.player
    const candidates = []
    if (!player.dead) {
      const d = Math.hypot(player.pos.x - bot.pos.x, player.pos.z - bot.pos.z)
      if (d < 78) candidates.push({ t: player, d, player: true })
    }
    for (const other of this.bots) {
      if (other === bot || !other.alive) continue
      const d = Math.hypot(other.pos.x - bot.pos.x, other.pos.z - bot.pos.z)
      if (d > 58) continue
      candidates.push({ t: other, d, player: false })
    }
    candidates.sort((a, b) => a.d - b.d)
    const limit = Math.min(candidates.length, 4)
    for (let i = 0; i < limit; i++) {
      const c = candidates[i]
      const target = c.t
      const visible = c.player
        ? this._canSeePlayer(bot)
        : this.world.hasLineOfSight(bot.pos.x, bot.pos.y + 1.45, bot.pos.z, target.pos.x, target.pos.y + 1.25, target.pos.z)
      if (visible) {
        // Prefer a player in front over a distant bot duel.
        if (c.player && i < 2) return player
        return target
      }
    }
    if (candidates.length && candidates[0].player && candidates[0].d < 32) return player
    return null
  }

  _canSeePlayer(bot) {
    const p = this.player
    return this.world.hasLineOfSight(bot.pos.x, bot.pos.y + 1.45, bot.pos.z, p.pos.x, p.pos.y + 1.3, p.pos.z)
  }

  _roam(bot, dt, zone) {
    bot.state = 'roam'
    bot.waypointTimer -= dt
    const wpDist = Math.hypot(bot.waypoint.x - bot.pos.x, bot.waypoint.z - bot.pos.z)
    if (bot.waypointTimer <= 0 || wpDist < 3.5) {
      bot.waypoint = this._pickWaypoint(bot, zone)
      bot.waypointTimer = 6 + Math.random() * 9
    }
    let dx = bot.waypoint.x - bot.pos.x
    let dz = bot.waypoint.z - bot.pos.z
    const dist = Math.hypot(dx, dz) || 1
    dx /= dist
    dz /= dist
    const speed = 3.4 + bot.skill * 1.6
    bot.speed = speed
    const targetYaw = Math.atan2(-dx, -dz)
    bot.yaw += angleDelta(bot.yaw, targetYaw) * Math.min(1, dt * 6)
    this._move(bot, dx * speed * dt, dz * speed * dt, dt)

    // If the next step is water, immediately re-route.
    const aheadX = bot.pos.x - Math.sin(bot.yaw) * 3
    const aheadZ = bot.pos.z - Math.cos(bot.yaw) * 3
    if (this.world.getHeight(aheadX, aheadZ) < 0.1) {
      bot.waypoint = this._pickWaypoint(bot, zone)
      bot.waypointTimer = 5
    }
  }

  _combat(bot, dt, zone) {
    const target = bot.target
    const targetIsPlayer = target === this.player
    const tx = target.pos.x
    const tz = target.pos.z
    const ty = target.pos.y + (targetIsPlayer ? 1.28 : 1.22)
    let dx = tx - bot.pos.x
    let dz = tz - bot.pos.z
    const dist = Math.hypot(dx, dz) || 0.01
    dx /= dist
    dz /= dist
    bot.state = 'combat'
    const targetYaw = Math.atan2(-dx, -dz)
    bot.yaw += angleDelta(bot.yaw, targetYaw) * Math.min(1, dt * 9)

    const sniper = bot.weaponId === 'kar98'
    const desired = sniper ? 32 : 15
    let moveX = 0
    let moveZ = 0
    let speed = 0
    if (dist > desired + 8) {
      moveX += dx
      moveZ += dz
      speed = 3.2 + bot.skill * 1.3
    } else if (dist < 6) {
      moveX -= dx
      moveZ -= dz
      speed = 3.7
    } else {
      // Strafe to make the duel readable.
      const px = -dz
      const pz = dx
      moveX += px * bot.strafe
      moveZ += pz * bot.strafe
      speed = sniper ? 0.7 : 1.8 + bot.skill * 1.2
    }
    bot.speed = speed
    if (speed > 0) this._move(bot, moveX * speed * dt, moveZ * speed * dt, dt)

    // Sight is rechecked on each shot.
    const canSee = targetIsPlayer
      ? this._canSeePlayer(bot)
      : this.world.hasLineOfSight(bot.pos.x, bot.pos.y + 1.45, bot.pos.z, tx, ty, tz)
    if (!canSee) {
      bot.targetSeen -= dt * 2.4
      if (bot.targetSeen <= 0) bot.target = null
      return
    }
    bot.targetSeen = Math.max(bot.targetSeen, 0.65)

    bot.shotTimer -= dt
    if (bot.shotTimer > 0) return
    if (bot.burstPause > 0) {
      bot.burstPause -= dt
      return
    }
    this._botShoot(bot, target, dist, ty)
    const auto = bot.weapon.auto
    if (auto) {
      bot.burstLeft--
      if (bot.burstLeft <= 0) {
        bot.burstLeft = 3 + Math.floor(Math.random() * 3)
        bot.burstPause = 0.7 + Math.random() * 1.25
      } else {
        bot.shotTimer = 60 / bot.weapon.rpm
      }
    } else {
      bot.burstLeft = 1
      bot.shotTimer = Math.max(0.65, 60 / bot.weapon.rpm * (1.5 + Math.random()))
    }
  }

  _botShoot(bot, target, dist, targetY) {
    const targetIsPlayer = target === this.player
    const origin = this._tmp.set(bot.pos.x, bot.pos.y + 1.38, bot.pos.z)
    const aim = this._tmp2.set(target.pos.x, targetY, target.pos.z)
    const weapon = bot.weapon
    const muzzle = origin.clone().add(new THREE.Vector3(-Math.sin(bot.yaw) * 0.65, 0.04, -Math.cos(bot.yaw) * 0.65))
    const baseChance = weapon.id === 'kar98' ? 0.4 : weapon.id === 's686' ? 0.46 : weapon.id === 'p92' ? 0.3 : 0.33
    const rangeFactor = clamp(1.08 - dist / 105, 0.22, 1)
    const chance = clamp(baseChance * bot.accuracy * rangeFactor * (0.8 + targetIsPlayer * 0.06), 0.025, 0.6)
    const hit = Math.random() < chance
    let dmg = 0
    let headshot = false

    if (hit) {
      headshot = Math.random() < (weapon.id === 'kar98' ? 0.19 : 0.07)
      const scale = targetIsPlayer ? 0.27 : 0.6
      dmg = weapon.damage * scale * (headshot ? weapon.headMult : 1) * (weapon.id === 's686' ? 1.15 : 1)
      if (targetIsPlayer) {
        this.player.damage(dmg, bot.pos, {})
      } else {
        this.damageBot(target, dmg, 'bot', headshot, aim.clone(), weapon, this.player, bot)
      }
    }

    const end = aim.clone()
    if (!hit) {
      end.x += (Math.random() - 0.5) * (2.2 + dist * 0.055)
      end.y += (Math.random() - 0.3) * (1.1 + dist * 0.02)
      end.z += (Math.random() - 0.5) * (2.2 + dist * 0.055)
    }
    this.fx?.tracer(muzzle, end, weapon.tracer, 0.6)
    this.fx?.muzzle(muzzle, 0.35, 0xffc27a)
    const playerDist = Math.hypot(bot.pos.x - this.player.pos.x, bot.pos.z - this.player.pos.z)
    const pan = clamp((bot.pos.x - this.player.pos.x) / 55, -0.8, 0.8)
    this.audio?.gun(bot.weaponId, 0.72, playerDist, pan)
    bot.recentlyFired = 4
    bot.fireFlash = 0.08
    bot.parts.gun.position.z = -0.32
    bot.parts.armL.rotation.x = 0.12
    if (targetIsPlayer) this.hud?.enemyShot?.(bot.pos)
  }

  _pickWaypoint(bot, zone) {
    if (zone && zone.active) {
      const r = Math.min(zone.radius * 0.72, 62)
      const a = Math.random() * ARC
      const rr = Math.sqrt(Math.random()) * r
      return {
        x: zone.center.x + Math.cos(a) * rr,
        z: zone.center.z + Math.sin(a) * rr
      }
    }
    const site = SITES[Math.floor(Math.random() * SITES.length)]
    const a = Math.random() * ARC
    const rr = 6 + Math.random() * 26
    return { x: site.x + Math.cos(a) * rr, z: site.z + Math.sin(a) * rr }
  }

  _move(bot, dx, dz, dt) {
    const oldX = bot.pos.x
    const oldZ = bot.pos.z
    const terrain = this.world.getHeight(bot.pos.x, bot.pos.z)
    if (terrain < 0.08) {
      // Bots are poor swimmers; steer back toward dry land.
      bot.pos.x += (Math.random() - 0.5) * 0.2
      bot.pos.z += (Math.random() - 0.5) * 0.2
      return
    }
    bot.pos.x += dx
    bot.pos.z += dz
    this.world.resolveCircle(bot.pos, BOT_RADIUS, BOT_HEIGHT)
    const support = this.world.groundHeight(bot.pos.x, bot.pos.z, bot.pos.y + 0.62)
    if (support > bot.pos.y && support - bot.pos.y <= 0.62) {
      bot.pos.y = support
    } else if (support > -8) {
      bot.pos.y = damp(bot.pos.y, support, 16, dt)
    }
    const moved = Math.hypot(bot.pos.x - oldX, bot.pos.z - oldZ)
    bot.walkPhase += moved * 2.1
    if (moved < 0.0005 && Math.random() < 0.2) {
      bot.waypoint = this._pickWaypoint(bot)
      bot.waypointTimer = 3
    }
  }

  _animate(bot, dt, distToPlayer) {
    const parts = bot.parts
    const group = bot.group
    group.position.copy(bot.pos)
    group.rotation.y = bot.yaw
    group.visible = distToPlayer < 145 || bot.recentlyFired > 0
    const swing = Math.sin(bot.walkPhase * 2.05) * Math.min(0.72, bot.speed * 0.14)
    parts.legL.rotation.x = damp(parts.legL.rotation.x, swing, 12, dt)
    parts.legR.rotation.x = damp(parts.legR.rotation.x, -swing, 12, dt)
    parts.armL.rotation.x = damp(parts.armL.rotation.x, bot.state === 'combat' ? 0.18 : -swing * 0.28, 10, dt)
    parts.armR.rotation.x = damp(parts.armR.rotation.x, bot.state === 'combat' ? 0.08 : swing * 0.2, 10, dt)
    parts.gun.position.z = damp(parts.gun.position.z, -0.35, 14, dt)
    parts.model.position.y = Math.abs(Math.sin(bot.walkPhase * 2.05)) * Math.min(0.035, bot.speed * 0.007)

    const bar = bot.bar
    if (distToPlayer < 62 && (bot.health < 99.5 || distToPlayer < 22)) {
      bar.group.visible = true
      bar.group.position.set(bot.pos.x, bot.pos.y + 2.12, bot.pos.z)
      bar.group.quaternion.copy(this.camera.quaternion)
      const frac = clamp(bot.health / 100, 0, 1)
      bar.fill.scale.x = frac
      bar.fillMat.color.setRGB(
        frac > 0.55 ? 0.55 + (1 - frac) * 0.4 : 0.92,
        frac > 0.55 ? 0.84 : 0.28 + frac * 0.75,
        frac > 0.55 ? 0.38 : 0.22
      )
      if (bar.group.material) bar.group.material.opacity = 1
    } else {
      bar.group.visible = false
    }
  }

  _updateDeath(bot, dt) {
    if (!bot.dead) return
    bot.deathTime += dt
    if (bot.deathTime < 1.7) {
      const t = clamp(bot.deathTime / 0.5, 0, 1)
      bot.body.rotation.z = -1.45 * (t * t * (3 - 2 * t))
      bot.body.position.y = -0.05 * t
    } else {
      bot.body.visible = false
    }
    bot.bar.group.visible = false
    if (!bot.dropped) {
      bot.dropTimer -= dt
      if (bot.dropTimer <= 0) {
        bot.dropped = true
        const y = this.world.surfaceHeight(bot.pos.x, bot.pos.z) + 0.04
        this.loot?.addWeapon(bot.pos.x, y, bot.pos.z, bot.weaponId)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Damage, kills, simulation                                           */
  /* ------------------------------------------------------------------ */

  damageBot(bot, amount, source, headshot, point, def = { name: 'M416' }, playerRef = null, sourceBot = null) {
    if (!bot.alive || amount <= 0) return false
    bot.health -= amount
    bot.lastHitBy = source
    if (bot.health <= 0) {
      this._killBot(bot, source, headshot, def, playerRef, sourceBot)
      return true
    }
    return false
  }

  _killBot(bot, source, headshot, def, playerRef, sourceBot) {
    if (!bot.alive) return
    bot.alive = false
    bot.dead = true
    bot.health = 0
    bot.deathTime = 0
    bot.dropTimer = 0.65
    bot.dropped = false
    bot.target = null
    bot.speed = 0
    bot.bar.group.visible = false
    bot.parts.body = bot.body
    if (source === 'player' && playerRef) {
      playerRef.registerKill(bot.name, def.name || 'M416', headshot)
    } else if (source === 'bot') {
      const killer = sourceBot ? sourceBot.name : 'UNKNOWN'
      if (sourceBot) sourceBot.kills++
      this.hud?.addKill(killer, bot.name, def.name || 'M416', headshot, false)
    } else if (source === 'zone') {
      this.hud?.addKill('THE PLAY ZONE', bot.name, 'ZONE', false, false)
    }
  }

  _simulateElimination(zone) {
    if (this.aliveCount <= (zone?.final ? 0 : 1)) return
    const candidates = this.bots.filter((b) => {
      if (!b.alive) return false
      const d = Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z)
      return d > 72 && b.target !== this.player
    })
    if (candidates.length < 2) {
      // Late game: the zone picks off a straggler far from the player.
      const far = this.bots.filter((b) => b.alive && Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z) > 45)
      if (far.length > 1) {
        const victim = far[Math.floor(Math.random() * far.length)]
        this._killBot(victim, 'zone', false, { name: 'ZONE' }, null, null)
      }
      return
    }
    const victim = candidates[Math.floor(Math.random() * candidates.length)]
    let killer = null
    const pool = candidates.filter((c) => c !== victim)
    if (pool.length) killer = pool[Math.floor(Math.random() * pool.length)]
    if (!killer) {
      this._killBot(victim, 'zone', false, { name: 'ZONE' }, null, null)
      return
    }
    this._killBot(victim, 'bot', Math.random() > 0.86, killer.weapon, null, killer)
  }

  /* ------------------------------------------------------------------ */
  /* Shot queries used by the player                                     */
  /* ------------------------------------------------------------------ */

  raycast(origin, dir, maxDist = 300) {
    let best = null
    for (const bot of this.bots) {
      if (!bot.alive) continue
      const chestY = bot.pos.y + 1.16
      const headY = bot.pos.y + 1.76
      const legY = bot.pos.y + 0.55
      let hit = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, bot.pos.x, headY, bot.pos.z, 0.285, maxDist)
      let headshot = true
      if (hit !== null && (!best || hit < best.distance)) {
        best = { bot, distance: hit, headshot, point: origin.clone().addScaledVector(dir, hit) }
      }
      hit = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, bot.pos.x, chestY, bot.pos.z, 0.44, maxDist)
      if (hit !== null && (!best || hit < best.distance)) {
        best = { bot, distance: hit, headshot: false, point: origin.clone().addScaledVector(dir, hit) }
      }
      hit = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, bot.pos.x, legY, bot.pos.z, 0.31, maxDist)
      if (hit !== null && (!best || hit < best.distance)) {
        best = { bot, distance: hit, headshot: false, point: origin.clone().addScaledVector(dir, hit) }
      }
    }
    return best
  }

  aliveBots() {
    return this.bots.filter((b) => b.alive)
  }
}

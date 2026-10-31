import { WEAPONS, BUILD_LABELS } from './config.js'
import { clamp, formatTime } from './utils.js'

const $ = (id) => document.getElementById(id)
const CARDINALS = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' }
]

export class HUD {
  constructor(world, camera) {
    this.world = world
    this.camera = camera
    this.root = $('hud')
    this.touch = $('touch')
    this.compassCanvas = $('compass')
    this.compassCtx = this.compassCanvas?.getContext('2d')
    this.minimapCanvas = $('minimap')
    this.minimapCtx = this.minimapCanvas?.getContext('2d')
    this.briefCanvas = $('briefMap')
    this.feed = []
    this.feedRoot = $('killfeed')
    this.toastEl = $('toast')
    this.toastTimer = 0
    this.toastTitle = ''
    this.toastSub = ''
    this.damageRoot = $('damageNumbers')
    this.damageNumbers = []
    this.flash = 0
    this.dirTimer = 0
    this.minimapTimer = 0
    this.spread = 0.02
    this.zoneOutside = false
    this.zoneBannerClass = ''
    this.cached = {}
    this.drawBriefing()
  }

  cache(id) {
    if (!(id in this.cached)) this.cached[id] = $(id)
    return this.cached[id]
  }

  show() {
    this.root?.classList.remove('hidden')
    if (this.touch) this.touch.classList.remove('hidden')
  }

  hide() {
    this.root?.classList.add('hidden')
    if (this.touch) this.touch.classList.add('hidden')
  }

  reset() {
    this.feed.forEach((f) => f.el.remove())
    this.feed.length = 0
    this.damageNumbers.forEach((d) => d.el.remove())
    this.damageNumbers.length = 0
    if (this.feedRoot) this.feedRoot.innerHTML = ''
    this.toastTimer = 0
    if (this.toastEl) this.toastEl.classList.remove('show')
    this.flash = 0
    this.dirTimer = 0
    const vignette = this.cache('damageVignette')
    if (vignette) {
      vignette.style.opacity = ''
      vignette.classList.remove('zone')
    }
    const dir = this.cache('damageDir')
    if (dir) dir.style.opacity = '0'
    const hit = this.cache('hitmarker')
    if (hit) hit.className = ''
    const end = this.cache('end')
    if (end) end.classList.add('hidden')
    const pause = this.cache('pause')
    if (pause) pause.classList.add('hidden')
    const title = this.cache('endTitle')
    if (title) title.classList.remove('win')
  }

  /* ------------------------------------------------------------------ */
  /* Main HUD update                                                     */
  /* ------------------------------------------------------------------ */

  update(dt, player, bots, zone, building) {
    if (!player) return
    this.toastTimer = Math.max(0, this.toastTimer - dt)
    if (this.toastTimer <= 0 && this.toastEl?.classList.contains('show')) {
      this.toastEl.classList.remove('show')
    }
    this.flash = Math.max(0, this.flash - dt * 1.65)
    this.dirTimer = Math.max(0, this.dirTimer - dt * 2)
    this.updateDamageFlash()

    this.updateVitals(player)
    this.updateWeapon(player)
    this.updateInteraction(player, building)
    this.updateBuild(player, building)
    this.updateZone(zone, player)
    this.updateKillfeed(dt)
    this.updateDamageNumbers(dt)
    this.updateStance(player)

    const alive = bots ? bots.aliveCount + (player.dead ? 0 : 1) : 1
    const aliveEl = this.cache('aliveCount')
    if (aliveEl) aliveEl.textContent = String(Math.max(1, alive))
    const killsEl = this.cache('killCount')
    if (killsEl) killsEl.textContent = String(player.kills)

    const compass = this.compassCanvas
    if (compass) this.drawCompass(player.yaw)
    this.minimapTimer -= dt
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.09
      this.drawMinimap(player, bots, zone)
    }

    const dir = this.cache('damageDir')
    if (dir) dir.style.opacity = String(clamp(this.dirTimer * 1.8, 0, 0.9))
  }

  updateVitals(player) {
    const health = clamp(player.health / player.maxHealth, 0, 1)
    const armor = clamp(player.armor / player.maxArmor, 0, 1)
    const healthFill = this.cache('healthFill')
    const armorFill = this.cache('armorFill')
    const healthNum = this.cache('healthNum')
    const armorNum = this.cache('armorNum')
    const medCount = this.cache('medCount')
    if (healthFill) healthFill.style.width = `${health * 100}%`
    if (armorFill) armorFill.style.width = `${armor * 100}%`
    if (healthNum) healthNum.textContent = String(Math.ceil(player.health))
    if (armorNum) armorNum.textContent = String(Math.ceil(player.armor))
    if (medCount) medCount.textContent = String(player.medkits)

    const heal = this.cache('healProgress')
    if (heal) {
      const active = player.healing > 0
      heal.classList.toggle('show', active)
      if (active) {
        const bar = heal.querySelector('.heal-track i')
        if (bar) bar.style.width = `${clamp(1 - player.healing / player.healDuration, 0, 1) * 100}%`
      }
    }
  }

  updateWeapon(player) {
    const w = player.weapon
    const def = w ? WEAPONS[w.id] : null
    const name = this.cache('weaponName')
    const mode = this.cache('weaponMode')
    const mag = this.cache('magAmmo')
    const reserve = this.cache('reserveAmmo')
    const reload = this.cache('reloadHint')
    const ammo = this.cache('magAmmo')?.parentElement
    if (name) name.textContent = def ? def.name : 'UNARMED'
    if (mode) mode.textContent = def ? (def.auto ? 'AUTO' : def.class === 'SNIPER' ? 'BOLT' : 'SEMI') : '—'
    if (mag) mag.textContent = w ? String(w.mag) : '0'
    if (reserve) reserve.textContent = w ? String(w.reserve) : '0'
    if (ammo) ammo.classList.toggle('low', !!w && w.mag <= Math.max(2, Math.ceil(def.mag * 0.2)))
    if (reload) reload.classList.toggle('show', !!w && !player.reloading && w.mag < def.mag && w.reserve > 0)

    for (let i = 0; i < 2; i++) {
      const slot = this.cache(`slot${i + 1}`)
      if (!slot) continue
      const state = player.slots[i]
      slot.classList.toggle('active', player.activeSlot === i)
      const label = slot.querySelector('span')
      if (label) label.textContent = state ? WEAPONS[state.id].name : '—'
    }
  }

  updateStance(player) {
    const stance = this.cache('stanceTag')
    if (stance) {
      stance.textContent = player.stance
      stance.classList.toggle('crouch', player.crouching)
    }
  }

  updateInteraction(player, building) {
    const prompt = this.cache('interactPrompt')
    const text = this.cache('interactText')
    const harvest = this.cache('harvestPrompt')
    const cross = this.cache('crosshair')
    if (!prompt || !harvest) return

    const touch = document.body.classList.contains('touch')
    const useKey = prompt.querySelector('kbd')
    const harvestKey = harvest.querySelector('kbd')
    if (useKey) useKey.textContent = touch ? 'USE' : 'E'
    if (harvestKey) harvestKey.textContent = touch ? 'USE' : 'F'

    const showLoot = !building?.active && !player.dead && player.interactTarget
    if (showLoot) {
      prompt.classList.add('show')
      const item = player.interactTarget.item
      let label = 'PICK UP SUPPLY'
      if (item.kind === 'weapon') label = `PICK UP ${item.name}`
      else if (item.kind === 'medkit') label = 'PICK UP MEDKIT'
      else if (item.kind === 'armor') label = 'EQUIP ARMOR'
      else if (item.kind === 'ammo') label = 'PICK UP AMMO'
      if (text) text.textContent = label
    } else {
      prompt.classList.remove('show')
    }

    const showHarvest = !building?.active && !player.dead && !showLoot && player.harvestTarget && player.chopCooldown <= 0.03
    harvest.classList.toggle('show', !!showHarvest)
    if (cross) {
      const hide = !!building?.active || player.dead
      cross.classList.toggle('hide', hide)
      cross.style.setProperty('--spread', `${Math.round(4 + this.spread * 700)}px`)
    }
  }

  updateBuild(player, building) {
    const hud = this.cache('buildHud')
    if (!hud) return
    const active = !!building?.active
    hud.classList.toggle('show', active)
    if (!active) return
    for (const piece of hud.querySelectorAll('.piece')) {
      piece.classList.toggle('active', piece.dataset.piece === building.piece)
    }
    const wood = this.cache('woodCount')
    if (wood) wood.textContent = String(player.wood)
    const title = hud.querySelector('.build-title span')
    if (title) title.textContent = `BUILD MODE · ${BUILD_LABELS[building.piece] || 'WALL'}`
  }

  updateZone(zone, player) {
    if (!zone) return
    const timer = this.cache('zoneTimer')
    const state = this.cache('zoneState')
    const banner = this.cache('zoneBanner')
    const warning = this.cache('zoneWarning')
    const vignette = this.cache('damageVignette')
    if (timer) timer.textContent = zone.countdown
    if (state) state.textContent = zone.phaseLabel
    if (banner) {
      banner.classList.toggle('danger', zone.danger > 0.66)
      banner.classList.toggle('closing', zone.state === 'shrink')
    }
    const outside = zone.active && zone.outside(player.pos.x, player.pos.z) && !player.dead
    this.zoneOutside = outside
    warning?.classList.toggle('show', outside)
    vignette?.classList.toggle('zone', outside)
  }

  /* ------------------------------------------------------------------ */
  /* Compass + minimap                                                   */
  /* ------------------------------------------------------------------ */

  drawBriefing() {
    if (!this.briefCanvas || !this.world.mapCanvas) return
    const ctx = this.briefCanvas.getContext('2d')
    ctx.clearRect(0, 0, this.briefCanvas.width, this.briefCanvas.height)
    ctx.drawImage(this.world.mapCanvas, 0, 0, this.briefCanvas.width, this.briefCanvas.height)
    ctx.fillStyle = 'rgba(4, 8, 7, 0.12)'
    ctx.fillRect(0, 0, this.briefCanvas.width, this.briefCanvas.height)
  }

  drawCompass(yaw) {
    const ctx = this.compassCtx
    const canvas = this.compassCanvas
    if (!ctx || !canvas) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const heading = ((-yaw * 180) / Math.PI + 360) % 360
    const pxPerDeg = w / 150
    const center = w / 2
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Graduations every 5 degrees; labels every 45.
    const start = Math.floor((heading - 75) / 5) * 5
    for (let a = start; a <= heading + 75; a += 5) {
      const delta = ((a - heading + 540) % 360) - 180
      if (Math.abs(delta) > 74) continue
      const x = center + delta * pxPerDeg
      const major = a % 45 === 0
      ctx.strokeStyle = major ? 'rgba(238,234,223,0.7)' : 'rgba(238,234,223,0.25)'
      ctx.lineWidth = major ? 1.5 : 1
      ctx.beginPath()
      ctx.moveTo(x, h - 4)
      ctx.lineTo(x, h - (major ? 16 : 9))
      ctx.stroke()
      if (a % 15 === 0 && !major) {
        ctx.fillStyle = 'rgba(190,196,190,0.35)'
        ctx.font = '700 9px "Rajdhani", sans-serif'
        ctx.fillText(String(((a % 360) + 360) % 360), x, h - 24)
      }
    }
    for (const c of CARDINALS) {
      const delta = ((c.deg - heading + 540) % 360) - 180
      if (Math.abs(delta) > 76) continue
      const x = center + delta * pxPerDeg
      const card = c.deg % 90 === 0
      ctx.fillStyle = card ? 'rgba(244,240,231,0.92)' : 'rgba(190,196,190,0.52)'
      ctx.font = card ? '700 15px "Barlow Condensed", sans-serif' : '600 10px "Barlow Condensed", sans-serif'
      ctx.fillText(c.label, x, 12)
    }
    // Center indicator.
    ctx.fillStyle = '#ff7a18'
    ctx.beginPath()
    ctx.moveTo(center, 2)
    ctx.lineTo(center - 4.5, 9)
    ctx.lineTo(center + 4.5, 9)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '700 9px "Rajdhani", sans-serif'
    ctx.fillText(String(Math.round(heading) % 360).padStart(3, '0'), center, h - 27)
    ctx.restore()
  }

  drawMinimap(player, bots, zone) {
    const ctx = this.minimapCtx
    const canvas = this.minimapCanvas
    const map = this.world.mapCanvas
    if (!ctx || !canvas || !map) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.globalAlpha = 0.88
    ctx.drawImage(map, 0, 0, w, h)
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(3, 9, 8, 0.14)'
    ctx.fillRect(0, 0, w, h)

    if (zone) {
      const center = this.world.mapToScreen(zone.center.x, zone.center.z, w)
      const scale = w / this.world.size
      ctx.beginPath()
      ctx.arc(center.x, center.y, Math.max(1, zone.radius * scale), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(50, 135, 235, 0.10)'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(93, 174, 255, 0.85)'
      ctx.stroke()
      const next = zone.nextCenter
      const nextR = zone.nextRadius
      if (next && nextR !== zone.radius) {
        const n = this.world.mapToScreen(next.x, next.z, w)
        ctx.beginPath()
        ctx.arc(n.x, n.y, Math.max(1, nextR * scale), 0, Math.PI * 2)
        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(235, 240, 235, 0.72)'
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Recent enemy fire shows as red pips.
    if (bots) {
      for (const bot of bots.bots) {
        if (!bot.alive || bot.recentlyFired <= 0) continue
        const d = Math.hypot(bot.pos.x - player.pos.x, bot.pos.z - player.pos.z)
        if (d > 95) continue
        const p = this.world.mapToScreen(bot.pos.x, bot.pos.z, w)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 76, 58, 0.95)'
        ctx.fill()
      }
    }

    const p = this.world.mapToScreen(player.pos.x, player.pos.z, w)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-player.yaw)
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4.4, 5)
    ctx.lineTo(0, 2.6)
    ctx.lineTo(-4.4, 5)
    ctx.closePath()
    ctx.fillStyle = '#ff7a18'
    ctx.strokeStyle = 'rgba(15, 10, 5, 0.9)'
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const t = (i / 4) * w
      ctx.beginPath()
      ctx.moveTo(t, 0)
      ctx.lineTo(t, h)
      ctx.moveTo(0, t)
      ctx.lineTo(w, t)
      ctx.stroke()
    }
    ctx.restore()
  }

  /* ------------------------------------------------------------------ */
  /* Prompts, effects and feed                                           */
  /* ------------------------------------------------------------------ */

  setSpread(value) {
    this.spread = clamp(value, 0, 0.15)
  }

  toast(title, sub = '', duration = 1.4) {
    if (!this.toastEl) return
    this.toastEl.innerHTML = ''
    const main = document.createElement('span')
    main.textContent = title
    this.toastEl.appendChild(main)
    if (sub) {
      const small = document.createElement('small')
      small.textContent = sub
      this.toastEl.appendChild(small)
    }
    this.toastEl.classList.add('show')
    this.toastTimer = duration
  }

  hitmarker(headshot = false, kill = false) {
    const el = this.cache('hitmarker')
    if (!el) return
    el.classList.remove('show', 'headshot', 'kill')
    void el.offsetWidth
    el.classList.add('show')
    if (headshot) el.classList.add('headshot')
    if (kill) el.classList.add('kill')
  }

  damageNumber(point, amount, headshot = false, kill = false) {
    if (!this.damageRoot || !this.camera) return
    this.camera.updateMatrixWorld()
    const v = point.clone().project(this.camera)
    if (v.z > 1.1 || v.z < -1) return
    const el = document.createElement('div')
    el.className = `dmg-num${headshot ? ' head' : ''}${kill ? ' kill' : ''}`
    el.textContent = kill ? `KILL +${amount}` : `${headshot ? 'HEAD ' : ''}${amount}`
    const rect = this.damageRoot.getBoundingClientRect()
    el.style.left = `${(v.x * 0.5 + 0.5) * rect.width + (Math.random() - 0.5) * 20}px`
    el.style.top = `${(-v.y * 0.5 + 0.5) * rect.height - 8 + (Math.random() - 0.5) * 10}px`
    this.damageRoot.appendChild(el)
    this.damageNumbers.push({ el, life: 0.82 })
  }

  updateDamageNumbers(dt) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i]
      d.life -= dt
      if (d.life <= 0) {
        d.el.remove()
        this.damageNumbers.splice(i, 1)
      }
    }
  }

  damageDirection(fromPos) {
    const dir = this.cache('damageDir')
    if (!dir || !fromPos) {
      this.dirTimer = Math.max(this.dirTimer, 0.5)
      return
    }
    const player = this.currentPlayer
    if (!player) return
    const dx = fromPos.x - player.pos.x
    const dz = fromPos.z - player.pos.z
    const bearing = Math.atan2(dx, -dz) * (180 / Math.PI)
    const relative = bearing + (player.yaw * 180) / Math.PI
    dir.style.transform = `rotate(${relative}deg)`
    this.dirTimer = 1
  }

  flashDamage(strength = 0.5) {
    this.flash = Math.max(this.flash, strength)
  }

  updateDamageFlash() {
    const el = this.cache('damageVignette')
    if (!el) return
    if (this.flash > 0.01) el.style.opacity = String(clamp(this.flash, 0, 0.8))
    else el.style.opacity = ''
  }

  // Kept for the bots' optional enemy-shot cue.
  enemyShot(pos) {
    this.lastEnemyShot = pos
  }

  addKill(killer, victim, weaponName, headshot = false, isPlayer = false) {
    if (!this.feedRoot) return
    const el = document.createElement('div')
    el.className = `feed-item${isPlayer ? ' player' : ''}`
    const k = document.createElement('b')
    k.textContent = killer
    const w = document.createElement('span')
    w.className = 'weapon'
    w.textContent = weaponName || 'M416'
    const v = document.createElement('b')
    v.textContent = victim
    el.append(k, w, v)
    if (headshot) {
      const hs = document.createElement('span')
      hs.className = 'hs'
      hs.textContent = 'HEADSHOT'
      el.appendChild(hs)
    }
    this.feedRoot.appendChild(el)
    this.feed.push({ el, life: 5.8, faded: false })
    while (this.feed.length > 6) {
      const old = this.feed.shift()
      old.el.remove()
    }
  }

  updateKillfeed(dt) {
    for (let i = this.feed.length - 1; i >= 0; i--) {
      const f = this.feed[i]
      f.life -= dt
      if (f.life <= 0.65 && !f.faded) {
        f.el.classList.add('fade')
        f.faded = true
      }
      if (f.life <= 0) {
        f.el.remove()
        this.feed.splice(i, 1)
      }
    }
  }

  setPlayer(player) {
    this.currentPlayer = player
  }

  showEnd({ win = false, placement = 1, kills = 0, damage = 0, time = 0, note = '' }) {
    const end = this.cache('end')
    const title = this.cache('endTitle')
    const sub = this.cache('endSub')
    const kicker = this.cache('endKicker')
    const place = this.cache('placement')
    const endKills = this.cache('endKills')
    const endDamage = this.cache('endDamage')
    const endTime = this.cache('endTime')
    const endNote = this.cache('endNote')
    if (end) end.classList.remove('hidden')
    if (title) {
      title.textContent = win ? 'WINNER WINNER' : 'YOU DIED'
      title.classList.toggle('win', win)
    }
    if (sub) sub.textContent = win ? 'Last one standing. The island is yours.' : 'The circle always wins. Go again.'
    if (kicker) kicker.innerHTML = `<span class="bar"></span> ${win ? 'VICTORY ROYALE' : 'MATCH COMPLETE'}`
    if (place) place.textContent = `#${placement}`
    if (endKills) endKills.textContent = String(kills)
    if (endDamage) endDamage.textContent = String(Math.round(damage))
    if (endTime) endTime.textContent = formatTime(time)
    if (endNote) endNote.textContent = note || (win ? 'Clean execution. Every shot counted.' : 'Smart play. Bad luck. Run it again.')
    this.hide()
  }
}

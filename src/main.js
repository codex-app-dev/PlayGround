const canvas = document.querySelector('#game')
const ctx = canvas.getContext('2d')
const $ = (id) => document.getElementById(id)
const ui = {
  objective: $('objective'), hearts: $('hearts'), key: $('keyStatus'), room: $('roomName'),
  toast: $('toast'), intro: $('intro'), end: $('endScreen'), endEyebrow: $('endEyebrow'),
  endCrest: $('endCrest'), endTitle: $('endTitle'), endSubtitle: $('endSubtitle'), endText: $('endText'),
}

const TILE = 48
const COLS = 31
const ROWS = 21
const worldW = COLS * TILE
const worldH = ROWS * TILE
const map = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) =>
  x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? 1 : 0))

// Six chambers joined by narrow, readable doorways.
for (let y = 1; y < ROWS - 1; y++) {
  if (y !== 9 && y !== 10) { map[y][10] = 1; map[y][20] = 1 }
}
for (let x = 1; x < COLS - 1; x++) {
  if (x !== 14 && x !== 15 && x !== 16) map[10][x] = 1
}
// The north exit is a gate, not a wall; it can only be opened at the end.
map[0][15] = 2

const player = { x: 3.2 * TILE, y: 3.2 * TILE, r: 13, speed: 190, faceX: 1, faceY: 0, health: 3, invuln: 0 }
const key = { x: 26.4 * TILE, y: 4.2 * TILE, found: false }
const braziers = [
  { x: 6.7 * TILE, y: 7.2 * TILE, lit: false },
  { x: 15.2 * TILE, y: 15.5 * TILE, lit: false },
  { x: 24.7 * TILE, y: 7.2 * TILE, lit: false },
]
const exit = { x: 15.5 * TILE, y: 1.15 * TILE }
const bats = [
  { x: 7.8 * TILE, y: 4.2 * TILE, vx: 0, vy: 0, phase: 1.2, alive: true, hurt: 0 },
  { x: 14.5 * TILE, y: 7.7 * TILE, vx: 0, vy: 0, phase: 3.1, alive: true, hurt: 0 },
  { x: 23.3 * TILE, y: 15.5 * TILE, vx: 0, vy: 0, phase: 5.4, alive: true, hurt: 0 },
  { x: 5.3 * TILE, y: 15.7 * TILE, vx: 0, vy: 0, phase: 2.5, alive: true, hurt: 0 },
]
const fireballs = []
const particles = []
const keys = new Set()
let running = false
let won = false
let lost = false
let time = 0
let lastShot = -1
let toastTimer
let lastInteract = 0
let touchFireHeld = false
const touch = { x: 0, y: 0 }

function toast(text, duration = 1800) {
  ui.toast.textContent = text
  ui.toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), duration)
}
function updateHud() {
  ui.hearts.textContent = '♥ '.repeat(Math.max(0, player.health)).trim() || '—'
  ui.hearts.setAttribute('aria-label', `${player.health} of 3 hearts`)
  ui.key.classList.toggle('has-key', key.found)
  ui.key.innerHTML = `${key.found ? '◆' : '◇'} <span>${key.found ? 'KEEP KEY' : 'NO KEY'}</span>`
  const lit = braziers.filter((b) => b.lit).length
  ui.objective.textContent = !key.found ? 'Find the iron key' : lit < 3 ? `Kindle the braziers · ${lit}/3` : 'Open the northern gate'
}
function tileAt(x, y) {
  const col = Math.floor(x / TILE), row = Math.floor(y / TILE)
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return 1
  return map[row][col]
}
function blocked(x, y, radius = player.r) {
  return tileAt(x - radius, y - radius) === 1 || tileAt(x + radius, y - radius) === 1 ||
    tileAt(x - radius, y + radius) === 1 || tileAt(x + radius, y + radius) === 1 ||
    (tileAt(x, y) === 2 && !(key.found && braziers.every((b) => b.lit)))
}
function moveBody(body, dx, dy, radius = body.r || 10) {
  if (!blocked(body.x + dx, body.y, radius)) body.x += dx
  if (!blocked(body.x, body.y + dy, radius)) body.y += dy
}
function roomName() {
  const col = Math.floor(player.x / TILE), row = Math.floor(player.y / TILE)
  if (row < 10) return col < 10 ? 'ENTRANCE HALL' : col < 20 ? 'EMBER CHAMBER' : 'KEY VAULT'
  return col < 10 ? 'ASH GALLERY' : col < 20 ? 'CROSSROADS' : 'CINDER HALL'
}
function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 110
    particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .35 + Math.random() * .45, max: .8, color, size: 2 + Math.random() * 3 })
  }
}
function shoot() {
  if (!running || won || lost || time - lastShot < .24) return
  lastShot = time
  const len = Math.hypot(player.faceX, player.faceY) || 1
  fireballs.push({ x: player.x + player.faceX * 18, y: player.y + player.faceY * 18, vx: player.faceX / len * 350, vy: player.faceY / len * 350, life: 1.25 })
  burst(player.x + player.faceX * 17, player.y + player.faceY * 17, '#ffc65e', 4)
}
function interact() {
  if (!running || won || lost || time - lastInteract < .25) return
  lastInteract = time
  if (!key.found && Math.hypot(player.x - key.x, player.y - key.y) < 52) {
    key.found = true; toast('IRON KEY FOUND — THE NORTH GATE AWAITS'); updateHud(); return
  }
  const nearBrazier = braziers.find((b) => Math.hypot(player.x - b.x, player.y - b.y) < 60)
  if (nearBrazier && !nearBrazier.lit) { toast('A COLD BRAZIER — IGNITE IT WITH SPACE'); return }
  if (Math.hypot(player.x - exit.x, player.y - exit.y) < 74) {
    if (!key.found) toast('THE GATE IS LOCKED — FIND THE IRON KEY')
    else if (!braziers.every((b) => b.lit)) toast(`THE RUNES ARE DARK — ${braziers.filter((b) => b.lit).length}/3 BRAZIERS LIT`)
    else finish(true)
  }
}
function finish(victory) {
  running = false; won = victory; lost = !victory
  ui.end.classList.remove('hidden')
  ui.endEyebrow.textContent = victory ? 'THE KEEP REMEMBERS' : 'THE ASHES CLAIM YOU'
  ui.endCrest.textContent = victory ? '✦' : '♨'
  ui.endTitle.textContent = victory ? 'ESCAPED' : 'FALLEN'
  ui.endSubtitle.textContent = victory ? 'THE FLAMES BURN ON' : 'EMBERFALL ENDURES'
  ui.endText.textContent = victory ? 'The ancient braziers blaze behind you as the Sunken Keep finally opens its doors.' : 'The keep has swallowed another wanderer. Gather your courage and try again.'
}
function reset() {
  player.x = 3.2 * TILE; player.y = 3.2 * TILE; player.health = 3; player.faceX = 1; player.faceY = 0; player.invuln = 0
  key.found = false; braziers.forEach((b) => b.lit = false)
  bats.forEach((b, i) => { b.alive = true; b.x = [7.8, 14.5, 23.3, 5.3][i] * TILE; b.y = [4.2, 7.7, 15.5, 15.7][i] * TILE; b.vx = b.vy = 0 })
  fireballs.length = 0; particles.length = 0; won = lost = false; time = 0
  updateHud(); ui.end.classList.add('hidden'); ui.intro.classList.remove('hidden')
}
function start() { running = true; ui.intro.classList.add('hidden'); ui.end.classList.add('hidden'); toast('FIND THE KEY · LIGHT THE BRAZIERS · ESCAPE') }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`
  ctx.imageSmoothingEnabled = false
}
function drawTile(x, y, col, row) {
  const wall = map[row][col] === 1
  if (!wall) {
    ctx.fillStyle = ((col * 13 + row * 7) % 9 === 0) ? '#333633' : '#2c302f'
    ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = 'rgba(9,12,12,.18)'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
    if ((col * 7 + row * 11) % 13 === 0) { ctx.fillStyle = '#41413b'; ctx.fillRect(x + 13, y + 12, 3, 3); ctx.fillRect(x + 29, y + 30, 2, 2) }
  } else {
    ctx.fillStyle = '#171d1c'; ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = '#45433b'; ctx.fillRect(x + 1, y + 1, TILE - 2, 8)
    ctx.fillStyle = '#343731'; ctx.fillRect(x + 2, y + 10, TILE - 4, TILE - 12)
    ctx.fillStyle = '#242a27'; ctx.fillRect(x + 4, y + TILE - 4, TILE - 8, 3)
    ctx.fillStyle = 'rgba(8,10,10,.4)'; ctx.fillRect(x + 5, y + 18, 3, 13)
  }
}
function drawBrazier(b, index) {
  const flicker = Math.sin(time * 9 + index * 2) * 2
  ctx.fillStyle = '#161a18'; ctx.fillRect(b.x - 19, b.y + 8, 38, 6)
  ctx.fillStyle = '#575249'; ctx.fillRect(b.x - 15, b.y - 5, 30, 16)
  ctx.fillStyle = '#292d2a'; ctx.fillRect(b.x - 11, b.y - 9, 22, 12)
  ctx.fillStyle = b.lit ? '#ff8b38' : '#101312'; ctx.fillRect(b.x - 8, b.y - 17, 16, 13)
  if (b.lit) {
    ctx.shadowColor = '#ff8b32'; ctx.shadowBlur = 24
    ctx.fillStyle = '#ffb64f'; ctx.fillRect(b.x - 5, b.y - 29 - flicker, 10, 19 + flicker)
    ctx.fillStyle = '#fff0a5'; ctx.fillRect(b.x - 2, b.y - 22 - flicker, 4, 10)
    ctx.shadowBlur = 0
  } else {
    ctx.fillStyle = '#68604e'; ctx.fillRect(b.x - 2, b.y - 13, 4, 3)
  }
}
function drawKey() {
  if (key.found) return
  const bob = Math.sin(time * 3) * 4
  ctx.save(); ctx.translate(key.x, key.y + bob); ctx.rotate(Math.PI / 4)
  ctx.shadowColor = '#ffe27b'; ctx.shadowBlur = 16
  ctx.fillStyle = '#ffe27b'; ctx.fillRect(-6, -6, 12, 12); ctx.fillRect(3, -2, 17, 4); ctx.fillRect(14, 1, 4, 7); ctx.fillRect(7, 1, 4, 6)
  ctx.shadowBlur = 0; ctx.restore()
  ctx.fillStyle = 'rgba(255,230,145,.7)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('KEY', key.x, key.y - 24 + bob)
}
function drawBat(b) {
  if (!b.alive) return
  const flap = Math.sin(time * 18 + b.phase) * 8
  ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.globalAlpha = b.hurt > 0 ? .55 : 1
  ctx.fillStyle = '#141719'; ctx.fillRect(-8, -6, 16, 15)
  ctx.fillStyle = '#55545b'; ctx.fillRect(-6, -9, 12, 13)
  ctx.fillStyle = '#77717a'; ctx.fillRect(-18, -5 + flap, 11, 5); ctx.fillRect(7, -5 - flap, 11, 5)
  ctx.fillStyle = '#e75d4e'; ctx.fillRect(-4, -4, 2, 2); ctx.fillRect(3, -4, 2, 2)
  ctx.fillStyle = '#aaa0a0'; ctx.fillRect(-4, 6, 2, 4); ctx.fillRect(3, 6, 2, 4)
  ctx.restore()
}
function drawPlayer() {
  ctx.save(); ctx.translate(Math.round(player.x), Math.round(player.y))
  if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = .4
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-14, 7, 28, 8)
  // Hood, tunic, boots, and a tiny pixel face.
  ctx.fillStyle = '#8b342c'; ctx.fillRect(-12, -14, 24, 21)
  ctx.fillStyle = '#c3533c'; ctx.fillRect(-10, -17, 20, 10)
  ctx.fillStyle = '#e2b875'; ctx.fillRect(-7, -12, 14, 11)
  ctx.fillStyle = '#272322'; ctx.fillRect(-6, -4, 3, 3); ctx.fillRect(4, -4, 3, 3)
  ctx.fillStyle = '#d7bd75'; ctx.fillRect(-13, 2, 26, 5)
  ctx.fillStyle = '#574238'; ctx.fillRect(-10, 7, 7, 6); ctx.fillRect(4, 7, 7, 6)
  ctx.fillStyle = '#f0d892'; ctx.fillRect(-2, 1, 5, 5)
  ctx.restore()
}
function update(dt) {
  time += dt
  const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touch.x
  const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + touch.y
  const length = Math.hypot(dx, dy)
  if (running && length > .05) {
    const mx = dx / Math.max(1, length), my = dy / Math.max(1, length)
    player.faceX = mx; player.faceY = my
    moveBody(player, mx * player.speed * dt, my * player.speed * dt)
  }
  if (running && touchFireHeld) shoot()
  if (player.invuln > 0) player.invuln -= dt
  if (running && !key.found && Math.hypot(player.x - key.x, player.y - key.y) < 26) {
    key.found = true; toast('IRON KEY FOUND'); updateHud(); burst(key.x, key.y, '#ffe27b', 18)
  }
  for (const b of bats) {
    if (!b.alive || !running) continue
    b.hurt = Math.max(0, b.hurt - dt)
    const vx = player.x - b.x, vy = player.y - b.y, dist = Math.hypot(vx, vy) || 1
    const speed = 72
    b.vx += (vx / dist * speed - b.vx) * Math.min(1, dt * 2.2)
    b.vy += (vy / dist * speed - b.vy) * Math.min(1, dt * 2.2)
    moveBody(b, b.vx * dt, b.vy * dt, 10)
    if (dist < 28 && player.invuln <= 0) {
      player.health--; player.invuln = 1.25; burst(player.x, player.y, '#ef6b51', 12); updateHud()
      toast(player.health ? 'A BAT BITES YOU' : 'THE KEEP CLAIMS YOU')
      if (player.health <= 0) finish(false)
    }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i]; f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt
    if (tileAt(f.x, f.y) === 1 || f.life <= 0) { burst(f.x, f.y, '#ff9e43', 5); fireballs.splice(i, 1); continue }
    let consumed = false
    for (const b of braziers) {
      if (!b.lit && Math.hypot(f.x - b.x, f.y - (b.y - 12)) < 24) {
        b.lit = true; consumed = true; burst(b.x, b.y - 12, '#ffc65e', 24)
        toast(`BRAZIER ${braziers.indexOf(b) + 1} KINDLED`); updateHud(); break
      }
    }
    if (!consumed) for (const b of bats) {
      if (b.alive && Math.hypot(f.x - b.x, f.y - b.y) < 20) {
        b.alive = false; consumed = true; burst(b.x, b.y, '#d6a5a0', 13); toast('ASH-BAT SCATTERED'); break
      }
    }
    if (consumed) fireballs.splice(i, 1)
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96
    if (p.life <= 0) particles.splice(i, 1)
  }
  ui.room.textContent = roomName()
}
function render() {
  const w = canvas.width / (window.devicePixelRatio || 1), h = canvas.height / (window.devicePixelRatio || 1)
  const dpr = canvas.width / Math.max(1, window.innerWidth)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#101514'; ctx.fillRect(0, 0, w, h)
  const scale = Math.min(w / (TILE * 17), h / (TILE * 13))
  const viewW = w / scale, viewH = h / scale
  const camX = Math.max(0, Math.min(worldW - viewW, player.x - viewW / 2))
  const camY = Math.max(0, Math.min(worldH - viewH, player.y - viewH / 2))
  ctx.save(); ctx.translate((w - viewW * scale) / 2, (h - viewH * scale) / 2); ctx.scale(scale, scale); ctx.translate(-camX, -camY)
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(COLS - 1, Math.ceil((camX + viewW) / TILE))
  const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(ROWS - 1, Math.ceil((camY + viewH) / TILE))
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(x * TILE, y * TILE, x, y)
  // Door lintels and the locked north portcullis.
  ctx.fillStyle = '#71634a'
  for (const [x, y] of [[10, 9], [10, 10], [20, 9], [20, 10], [14, 10], [15, 10], [16, 10]]) {
    ctx.fillRect(x * TILE + 4, y * TILE + 2, TILE - 8, 5)
  }
  ctx.fillStyle = key.found && braziers.every((b) => b.lit) ? '#b88443' : '#564638'
  ctx.fillRect(15 * TILE + 5, 0, TILE - 10, 15)
  for (let y = 1; y < 44; y += 9) ctx.fillRect(15 * TILE + 8, y, TILE - 16, 3)
  for (const [i, b] of braziers.entries()) drawBrazier(b, i)
  drawKey()
  for (const b of bats) drawBat(b)
  for (const f of fireballs) { ctx.shadowColor = '#ff8b30'; ctx.shadowBlur = 17; ctx.fillStyle = '#ffb84f'; ctx.fillRect(f.x - 6, f.y - 6, 12, 12); ctx.fillStyle = '#fff2a1'; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); ctx.shadowBlur = 0 }
  drawPlayer()
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size) }
  ctx.globalAlpha = 1
  ctx.restore()
  // Vignette and slight warm lantern glow over the pixel-art playfield.
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .7)
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
}
let prev = 0
function frame(now) {
  const dt = Math.min(.04, (now - prev) / 1000 || 0); prev = now
  update(dt); render(); requestAnimationFrame(frame)
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
  keys.add(event.code)
  if (event.repeat) return
  if (event.code === 'Space') shoot()
  if (event.code === 'KeyE') interact()
})
window.addEventListener('keyup', (event) => keys.delete(event.code))
window.addEventListener('blur', () => { keys.clear(); touchFireHeld = false; touch.x = touch.y = 0 })
$('startBtn').addEventListener('click', start)
$('restartBtn').addEventListener('click', reset)
$('touchFire').addEventListener('pointerdown', (event) => { event.preventDefault(); touchFireHeld = true; shoot() })
for (const button of document.querySelectorAll('.dpad button')) {
  const direction = button.dataset.dir
  const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction]
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); touch.x = vector[0]; touch.y = vector[1] })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => { touch.x = touch.y = 0 })
}
$('touchUse').addEventListener('pointerdown', (event) => { event.preventDefault(); interact() })
window.addEventListener('pointerup', () => { touchFireHeld = false })
window.addEventListener('resize', resize)
resize(); updateHud(); requestAnimationFrame(frame)
window.__emberfall = { player, braziers, bats, key, start, reset }

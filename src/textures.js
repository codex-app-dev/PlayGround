import * as THREE from 'three'
import { mulberry32, clamp } from './utils.js'

const SIZE = 256

function canvas(size = SIZE) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function finish(c, repeat = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function grain(ctx, w, h, rng, amount = 18, alpha = 0.16) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount
    d[i] = clamp(d[i] + n, 0, 255)
    d[i + 1] = clamp(d[i + 1] + n, 0, 255)
    d[i + 2] = clamp(d[i + 2] + n, 0, 255)
    d[i + 3] = clamp(d[i + 3] * (1 - alpha * 0.01), 0, 255)
  }
  ctx.putImageData(img, 0, 0)
}

function blotches(ctx, w, h, rng, colors, count, rMin, rMax, alpha = 0.18) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w
    const y = rng() * h
    const r = rMin + rng() * (rMax - rMin)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const color = colors[Math.floor(rng() * colors.length)]
    g.addColorStop(0, `rgba(${color},${alpha})`)
    g.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function lines(ctx, rng, count, w, h, style, width = 1) {
  ctx.strokeStyle = style
  ctx.lineWidth = width
  for (let i = 0; i < count; i++) {
    ctx.beginPath()
    let x = rng() * w
    let y = rng() * h
    ctx.moveTo(x, y)
    const segs = 2 + Math.floor(rng() * 4)
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 40
      y += (rng() - 0.5) * 40
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function makeGrass() {
  const c = canvas(512)
  const ctx = c.getContext('2d')
  const rng = mulberry32(11)
  ctx.fillStyle = '#5b6a3b'
  ctx.fillRect(0, 0, 512, 512)
  blotches(ctx, 512, 512, rng, ['70,82,43', '104,108,63', '48,60,33', '95,89,56', '122,118,75'], 90, 20, 120, 0.3)
  // dry earth patches
  blotches(ctx, 512, 512, rng, ['128,111,79', '98,84,58'], 24, 16, 60, 0.24)
  // fine blades
  for (let i = 0; i < 2600; i++) {
    const x = rng() * 512
    const y = rng() * 512
    const len = 1.5 + rng() * 5
    ctx.strokeStyle = rng() > 0.55 ? 'rgba(126,140,74,0.35)' : 'rgba(62,76,40,0.38)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - 0.5) * 2, y - len)
    ctx.stroke()
  }
  grain(ctx, 512, 512, rng, 12)
  return finish(c, 62)
}

function makeAsphalt() {
  const c = canvas(512)
  const ctx = c.getContext('2d')
  const rng = mulberry32(23)
  ctx.fillStyle = '#3c3f3e'
  ctx.fillRect(0, 0, 512, 512)
  blotches(ctx, 512, 512, rng, ['55,58,56', '43,45,44', '72,74,71'], 80, 8, 60, 0.3)
  for (let i = 0; i < 5000; i++) {
    const v = Math.floor(40 + rng() * 60)
    ctx.fillStyle = `rgba(${v},${v},${v - 2},${0.15 + rng() * 0.3})`
    ctx.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2)
  }
  lines(ctx, rng, 12, 512, 512, 'rgba(26,27,26,0.5)', 1.5)
  grain(ctx, 512, 512, rng, 8)
  return finish(c, 1)
}

function makeConcrete() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(31)
  ctx.fillStyle = '#b6b3a6'
  ctx.fillRect(0, 0, SIZE, SIZE)
  blotches(ctx, SIZE, SIZE, rng, ['138,134,122', '198,195,184', '120,118,106'], 60, 8, 55, 0.22)
  lines(ctx, rng, 8, SIZE, SIZE, 'rgba(74,72,64,0.28)', 1)
  // water stains
  for (let i = 0; i < 8; i++) {
    const x = rng() * SIZE
    const g = ctx.createLinearGradient(x, 0, x + 10, SIZE)
    g.addColorStop(0, 'rgba(90,88,70,0.14)')
    g.addColorStop(1, 'rgba(90,88,70,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 8 + rng() * 18, SIZE)
  }
  grain(ctx, SIZE, SIZE, rng, 20)
  return finish(c, 2)
}

function makePlaster() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(37)
  ctx.fillStyle = '#cfc5ae'
  ctx.fillRect(0, 0, SIZE, SIZE)
  blotches(ctx, SIZE, SIZE, rng, ['173,160,134', '225,218,201', '146,136,112', '116,108,89'], 45, 12, 60, 0.22)
  // exposed patches
  for (let i = 0; i < 4; i++) {
    const x = rng() * SIZE
    const y = rng() * SIZE
    const r = 10 + rng() * 26
    ctx.fillStyle = 'rgba(120,104,78,0.34)'
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.55, rng() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  lines(ctx, rng, 10, SIZE, SIZE, 'rgba(96,86,66,0.24)', 1)
  grain(ctx, SIZE, SIZE, rng, 15)
  return finish(c, 2)
}

function makeWood() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(41)
  ctx.fillStyle = '#8b6b44'
  ctx.fillRect(0, 0, SIZE, SIZE)
  const plank = 32
  for (let y = 0; y < SIZE; y += plank) {
    const shade = 0.9 + rng() * 0.2
    ctx.fillStyle = `rgb(${Math.floor(139 * shade)},${Math.floor(107 * shade)},${Math.floor(68 * shade)})`
    ctx.fillRect(0, y, SIZE, plank - 1)
    ctx.fillStyle = 'rgba(52,35,18,0.55)'
    ctx.fillRect(0, y + plank - 2, SIZE, 2)
    // grain streaks
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = `rgba(74,50,26,${0.08 + rng() * 0.12})`
      ctx.lineWidth = 0.7
      ctx.beginPath()
      const gy = y + 3 + rng() * (plank - 6)
      ctx.moveTo(0, gy)
      ctx.bezierCurveTo(SIZE * 0.3, gy + (rng() - 0.5) * 4, SIZE * 0.7, gy + (rng() - 0.5) * 4, SIZE, gy)
      ctx.stroke()
    }
    // knots
    if (rng() > 0.6) {
      const kx = rng() * SIZE
      const ky = y + plank * 0.5
      ctx.fillStyle = 'rgba(58,38,20,0.5)'
      ctx.beginPath()
      ctx.ellipse(kx, ky, 2.5 + rng() * 2, 1.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  grain(ctx, SIZE, SIZE, rng, 10)
  return finish(c, 2)
}

function makeMetal() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(47)
  ctx.fillStyle = '#8a9399'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let x = 0; x < SIZE; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.16)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.02)')
    g.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 16, SIZE)
  }
  // rust runs
  for (let i = 0; i < 14; i++) {
    const x = rng() * SIZE
    const y = rng() * SIZE * 0.5
    const g = ctx.createLinearGradient(x, y, x, y + 30 + rng() * 60)
    g.addColorStop(0, 'rgba(122,72,38,0.45)')
    g.addColorStop(1, 'rgba(122,72,38,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, 2 + rng() * 5, 40 + rng() * 70)
  }
  blotches(ctx, SIZE, SIZE, rng, ['96,104,108', '150,157,160', '118,80,50'], 30, 6, 34, 0.18)
  grain(ctx, SIZE, SIZE, rng, 16)
  return finish(c, 2)
}

function makeRoof() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(53)
  ctx.fillStyle = '#4c4f4f'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 22) {
    ctx.fillStyle = 'rgba(28,30,30,0.55)'
    ctx.fillRect(0, y + 19, SIZE, 3)
    for (let x = 0; x < SIZE; x += 32) {
      const v = 62 + rng() * 22
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 1},0.5)`
      ctx.fillRect(x + 1, y + 1, 30, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(x + 1, y + 1, 30, 1)
    }
  }
  blotches(ctx, SIZE, SIZE, rng, ['40,44,42', '88,80,64', '60,62,58'], 40, 6, 40, 0.24)
  grain(ctx, SIZE, SIZE, rng, 18)
  return finish(c, 2.5)
}

function makeSandbag() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(59)
  ctx.fillStyle = '#a99a71'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 26) {
    for (let x = -20; x < SIZE; x += 44) {
      const ox = (y / 26) % 2 === 0 ? 0 : 22
      ctx.fillStyle = `rgba(${150 + rng() * 30},${136 + rng() * 26},${96 + rng() * 20},0.9)`
      ctx.beginPath()
      ctx.roundRect(x + ox, y + 2, 42, 22, 6)
      ctx.fill()
      ctx.strokeStyle = 'rgba(74,63,40,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  grain(ctx, SIZE, SIZE, rng, 14)
  return finish(c, 1)
}

function makeCrate() {
  const c = canvas()
  const ctx = c.getContext('2d')
  const rng = mulberry32(61)
  ctx.fillStyle = '#6e5736'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 42) {
    ctx.fillStyle = 'rgba(48,35,18,0.5)'
    ctx.fillRect(0, y + 39, SIZE, 3)
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(40,28,14,0.16)'
      ctx.beginPath()
      ctx.moveTo(0, y + rng() * 40)
      ctx.lineTo(SIZE, y + rng() * 40)
      ctx.stroke()
    }
  }
  ctx.strokeStyle = 'rgba(35,26,15,0.8)'
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, SIZE - 10, SIZE - 10)
  ctx.strokeStyle = 'rgba(210,196,160,0.22)'
  ctx.lineWidth = 2
  ctx.strokeRect(12, 12, SIZE - 24, SIZE - 24)
  ctx.fillStyle = 'rgba(240,220,170,0.5)'
  ctx.font = 'bold 22px monospace'
  ctx.fillText('SUPPLY', 78, 136)
  grain(ctx, SIZE, SIZE, rng, 12)
  return finish(c, 1)
}

function makeGrassBlade() {
  const c = canvas(64)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 64, 64)
  const rng = mulberry32(67)
  for (let i = 0; i < 14; i++) {
    const x = 6 + rng() * 52
    const h = 22 + rng() * 38
    const lean = (rng() - 0.5) * 16
    const g = ctx.createLinearGradient(x, 64, x, 64 - h)
    g.addColorStop(0, 'rgba(58,74,36,1)')
    g.addColorStop(1, 'rgba(132,148,82,1)')
    ctx.strokeStyle = g
    ctx.lineWidth = 1.4 + rng() * 1.6
    ctx.beginPath()
    ctx.moveTo(x, 64)
    ctx.quadraticCurveTo(x + lean * 0.4, 64 - h * 0.55, x + lean, 64 - h)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeSoftCircle() {
  const c = canvas(128)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return finish(c, 1)
}

function makeMuzzle() {
  const c = canvas(128)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.15, 'rgba(255,238,180,1)')
  g.addColorStop(0.38, 'rgba(255,166,60,0.85)')
  g.addColorStop(1, 'rgba(255,90,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(255,240,190,0.9)'
  ctx.lineWidth = 3
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2
    ctx.beginPath()
    ctx.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18)
    ctx.lineTo(64 + Math.cos(a) * (34 + (i % 3) * 8), 64 + Math.sin(a) * (34 + (i % 3) * 8))
    ctx.stroke()
  }
  return finish(c, 1)
}

function makeBulletHole() {
  const c = canvas(64)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 64, 64)
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 15)
  g.addColorStop(0, 'rgba(10,9,8,0.95)')
  g.addColorStop(0.5, 'rgba(25,22,18,0.75)')
  g.addColorStop(1, 'rgba(40,35,28,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(32, 32, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(25,22,18,0.5)'
  ctx.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4
    ctx.beginPath()
    ctx.moveTo(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8)
    ctx.lineTo(32 + Math.cos(a) * (16 + (i % 2) * 6), 32 + Math.sin(a) * (16 + (i % 2) * 6))
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeLabel(text, sub, color = '#ff7a18') {
  const c = canvas(256)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 256, 128)
  ctx.fillStyle = 'rgba(6,9,10,0.82)'
  ctx.fillRect(18, 32, 220, 64)
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.strokeRect(18, 32, 220, 64)
  ctx.fillStyle = color
  ctx.fillRect(18, 32, 5, 64)
  ctx.fillStyle = '#f4f1e8'
  ctx.font = 'bold 32px "Arial Narrow", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 66)
  ctx.fillStyle = color
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillText(sub, 128, 86)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeSmoke() {
  const c = canvas(128)
  const ctx = c.getContext('2d')
  const rng = mulberry32(71)
  ctx.clearRect(0, 0, 128, 128)
  for (let i = 0; i < 18; i++) {
    const x = 30 + rng() * 68
    const y = 30 + rng() * 68
    const r = 12 + rng() * 26
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(210,206,196,${0.08 + rng() * 0.12})`)
    g.addColorStop(1, 'rgba(190,186,176,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createTextures() {
  const tex = {
    grass: makeGrass(),
    asphalt: makeAsphalt(),
    concrete: makeConcrete(),
    plaster: makePlaster(),
    wood: makeWood(),
    metal: makeMetal(),
    roof: makeRoof(),
    sandbag: makeSandbag(),
    crate: makeCrate(),
    grassBlade: makeGrassBlade(),
    soft: makeSoftCircle(),
    muzzle: makeMuzzle(),
    hole: makeBulletHole(),
    smoke: makeSmoke()
  }
  tex.labels = {}
  return tex
}

export function makeLootLabel(name, sub, color) {
  return makeLabel(name, sub, color)
}

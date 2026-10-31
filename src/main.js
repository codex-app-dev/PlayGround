import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { MATCH } from './config.js'
import { World } from './world.js'
import { Input } from './input.js'
import { AudioEngine } from './audio.js'
import { FX } from './fx.js'
import { LootSystem } from './loot.js'
import { Zone } from './zone.js'
import { Building } from './building.js'
import { Viewmodel } from './viewmodel.js'
import { Player } from './player.js'
import { Bots } from './bots.js'
import { HUD } from './hud.js'

const canvas = document.getElementById('game')
const menuEl = document.getElementById('menu')
const pauseEl = document.getElementById('pause')
const endEl = document.getElementById('end')
const startBtn = document.getElementById('startBtn')
const resumeBtn = document.getElementById('resumeBtn')
const quitBtn = document.getElementById('quitBtn')
const againBtn = document.getElementById('againBtn')
const menuBtn = document.getElementById('menuBtn')
const qualitySelect = document.getElementById('qualitySelect')
const sensRange = document.getElementById('sensRange')
const sensOut = document.getElementById('sensOut')
const soundToggle = document.getElementById('soundToggle')

function readSetting(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

function writeSetting(key, value) {
  try { localStorage.setItem(key, String(value)) } catch { /* storage may be unavailable */ }
}

const quality = readSetting('lc-quality', 'high')
let soundOn = readSetting('lc-sound', '1') !== '0'
let sensitivity = parseFloat(readSetting('lc-sens', '1')) || 1

if (qualitySelect) qualitySelect.value = quality
if (sensRange) sensRange.value = String(sensitivity)
if (sensOut) sensOut.textContent = sensitivity.toFixed(2)
if (soundToggle) soundToggle.checked = soundOn

/* ------------------------------------------------------------------ */
/* Renderer + scene                                                    */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: quality === 'high',
  powerPreference: 'high-performance',
  stencil: false
})
const maxPixelRatio = quality === 'high' ? 1.5 : quality === 'medium' ? 1.25 : 1
let renderScale = 1
const currentPixelRatio = () => Math.max(0.72, Math.min(window.devicePixelRatio || 1, maxPixelRatio) * renderScale)
renderer.setPixelRatio(currentPixelRatio())
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.shadowMap.enabled = quality !== 'low'
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.06, 2200)
camera.rotation.order = 'YXZ'
scene.add(camera)

const world = new World(scene, quality)
const hud = new HUD(world, camera)
const audio = new AudioEngine()
audio.enabled = soundOn
const fx = new FX(scene, world.textures, quality)
const loot = new LootSystem(scene, world, world.textures)
const zone = new Zone(scene, audio)
const viewmodel = new Viewmodel(camera)
const input = new Input(canvas)
input.sensitivity = sensitivity
const player = new Player({ scene, camera, world, input, audio, fx, loot, viewmodel })
const bots = new Bots({ scene, camera, world, player, loot, fx, audio, hud, quality })
const building = new Building(scene, world, player, hud, audio, fx)
bots.reset()

player.setHud(hud)
player.setBots(bots)
player.setBuilding(building)
player.setZone(zone)
hud.setPlayer(player)
viewmodel.setVisible(false)

let composer = null
let bloomPass = null
if (quality === 'high') {
  composer = new EffectComposer(renderer)
  composer.setPixelRatio(currentPixelRatio())
  composer.setSize(window.innerWidth, window.innerHeight)
  composer.addPass(new RenderPass(scene, camera))
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.36, 0.7, 0.9)
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let state = 'menu'
let elapsed = 0
let menuAngle = 0.72
let menuTime = 0
let lastWin = false
let deathHandled = false
const MENU_TARGET = new THREE.Vector3(1, world.getHeight(1, 4) + 2.6, 4)
const FOCUS = new THREE.Vector3()

function updateMenuCamera(dt) {
  menuTime += dt
  menuAngle += dt * 0.035
  const radius = 47
  const x = MENU_TARGET.x + Math.sin(menuAngle) * radius
  const z = MENU_TARGET.z + Math.cos(menuAngle) * radius
  const y = MENU_TARGET.y + 17 + Math.sin(menuTime * 0.22) * 1.6
  camera.position.set(x, y, z)
  camera.lookAt(MENU_TARGET)
  camera.fov = 55
  camera.updateProjectionMatrix()
  FOCUS.set(x, y - 6, z)
}

function startGame() {
  if (state === 'playing') return
  resetMatch()
  state = 'playing'
  elapsed = 0
  deathHandled = false
  lastWin = false
  input.enabled = true
  input.reset()
  audio.init()
  audio.setEnabled(soundOn)
  if (menuEl) menuEl.classList.add('closing')
  setTimeout(() => { if (state === 'playing') menuEl?.classList.add('hidden') }, 560)
  endEl?.classList.add('hidden')
  pauseEl?.classList.add('hidden')
  hud.show()
  hud.setPlayer(player)
  hud.toast('DEPLOYED', 'LOOT UP · THE CIRCLE IS CLOSING', 2.2)
  viewmodel.setVisible(true)
  zone.start()
  bots.start()
  if (!input.isTouch) input.lock()
  camera.fov = 72
  camera.updateProjectionMatrix()
}

function resetMatch() {
  player.reset()
  bots.reset()
  building.clear()
  loot.reset()
  zone.reset()
  hud.reset()
  hud.setPlayer(player)
  fx.clear?.()
  input.reset()
  viewmodel.show(player.weapon ? player.weapon.id : 'p92')
  viewmodel.setVisible(state !== 'menu')
  deathHandled = false
}

function pauseGame() {
  if (state !== 'playing') return
  state = 'paused'
  input.enabled = false
  input.reset()
  input.unlock()
  pauseEl?.classList.remove('hidden')
  audio.zone(false)
}

function resumeGame() {
  if (state !== 'paused') return
  pauseEl?.classList.add('hidden')
  state = 'playing'
  input.enabled = true
  input.reset()
  if (!input.isTouch) input.lock()
}

function returnToMenu() {
  state = 'menu'
  input.enabled = false
  input.unlock()
  viewmodel.setVisible(false)
  hud.hide()
  hud.reset()
  pauseEl?.classList.add('hidden')
  endEl?.classList.add('hidden')
  if (menuEl) menuEl.classList.remove('closing', 'hidden')
  audio.zone(false)
  resetMatch()
  viewmodel.setVisible(false)
  updateMenuCamera(0)
}

function endGame(win, reason = '') {
  if (state !== 'playing') return
  state = 'over'
  lastWin = win
  input.enabled = false
  input.reset()
  input.unlock()
  audio.zone(false)
  const placement = win ? 1 : Math.max(1, Math.min(MATCH.totalPlayers, bots.aliveCount + 1))
  player.placement = placement
  const note = win
    ? 'Last circle secured. 29 hostiles down. The island belongs to you.'
    : reason === 'zone'
      ? 'The play zone took you. Watch the ring, not just the horizon.'
      : reason === 'time'
        ? 'The match clock ran out. Push the circle harder next time.'
        : 'Smart play. Bad luck. Run it again.'
  hud.showEnd({
    win,
    placement,
    kills: player.kills,
    damage: player.damageDealt,
    time: elapsed,
    note
  })
  writeSetting('lc-last-placement', placement)
}

function handlePlayerDeath() {
  if (deathHandled) return
  deathHandled = true
  setTimeout(() => endGame(false, player.health <= 0 && zone.outside(player.pos.x, player.pos.z) ? 'zone' : ''), 520)
}

player.onDeath = handlePlayerDeath
player.onKill = () => {
  if (!player.dead && bots.aliveCount === 0) setTimeout(() => endGame(true), 650)
}

/* ------------------------------------------------------------------ */
/* Input wiring                                                        */
/* ------------------------------------------------------------------ */

startBtn?.addEventListener('click', startGame)
againBtn?.addEventListener('click', () => {
  endEl?.classList.add('hidden')
  startGame()
})
menuBtn?.addEventListener('click', returnToMenu)
resumeBtn?.addEventListener('click', resumeGame)
quitBtn?.addEventListener('click', returnToMenu)

input.onPointerLockChange = () => {
  if (state === 'playing') pauseGame()
}

canvas.addEventListener('click', () => {
  if (state === 'playing' && !input.isTouch && !input.pointerLocked) input.lock()
})

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && state === 'playing') pauseGame()
  else if (e.code === 'Escape' && state === 'paused') resumeGame()
  if (e.code === 'Enter' && state === 'menu' && !e.repeat) startGame()
  if (e.code === 'KeyM' && state === 'playing') {
    soundOn = !soundOn
    audio.setEnabled(soundOn)
    if (soundToggle) soundToggle.checked = soundOn
    writeSetting('lc-sound', soundOn ? '1' : '0')
    hud.toast(soundOn ? 'AUDIO ON' : 'AUDIO MUTED', '', 0.8)
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame()
})

qualitySelect?.addEventListener('change', (e) => {
  writeSetting('lc-quality', e.target.value)
  location.reload()
})

sensRange?.addEventListener('input', (e) => {
  sensitivity = parseFloat(e.target.value) || 1
  input.sensitivity = sensitivity
  if (sensOut) sensOut.textContent = sensitivity.toFixed(2)
  writeSetting('lc-sens', sensitivity)
})

soundToggle?.addEventListener('change', (e) => {
  soundOn = e.target.checked
  audio.enabled = soundOn
  if (soundOn) audio.init()
  audio.setEnabled(soundOn)
  writeSetting('lc-sound', soundOn ? '1' : '0')
})

window.addEventListener('resize', onResize)
function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(currentPixelRatio())
  renderer.setSize(w, h, false)
  if (composer) {
    composer.setPixelRatio(currentPixelRatio())
    composer.setSize(w, h)
  }
  if (bloomPass) bloomPass.setSize(w, h)
}

/* ------------------------------------------------------------------ */
/* Game loop                                                           */
/* ------------------------------------------------------------------ */

let last = performance.now()
let fpsSample = 0
let fpsFrames = 0
let lowFpsNoted = false

function updateGame(dt) {
  elapsed += dt
  const zoneDps = zone.active && zone.outside(player.pos.x, player.pos.z) ? zone.damagePerSecond() : 0

  player.update(dt)
  building.update(dt)
  if (state !== 'playing') return

  bots.update(dt, zone)
  if (state !== 'playing') return

  if (zoneDps > 0 && !player.dead) player.damage(zoneDps * dt, null, { zone: true, silent: true })
  zone.update(dt)
  loot.update(dt, camera, player.pos)
  fx.update(dt)
  world.update(dt, player.pos)
  audio.update(dt, zone.outside(player.pos.x, player.pos.z), zone.danger)

  if (!player.dead && bots.aliveCount === 0) {
    endGame(true)
    return
  }
  if (elapsed >= MATCH.matchTimeLimit && state === 'playing') {
    endGame(false, 'time')
    return
  }
  hud.update(dt, player, bots, zone, building)
}

function updateIdle(dt) {
  if (state === 'menu') {
    updateMenuCamera(dt)
    world.update(dt, FOCUS)
    fx.update(dt)
    return
  }
  if (state === 'paused') {
    world.update(dt * 0.25, player.pos)
    return
  }
  if (state === 'over') {
    world.update(dt, player.pos)
    fx.update(dt)
  }
}

function render() {
  if (composer) composer.render()
  else renderer.render(scene, camera)
}

function frame(now) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000))
  last = now

  if (state === 'playing') updateGame(dt)
  else updateIdle(dt)

  render()
  input.endFrame()

  if (state === 'playing') {
    fpsSample += dt
    fpsFrames++
    if (fpsSample >= 5) {
      const fps = fpsFrames / fpsSample
      if (fps < 24 && !lowFpsNoted && quality === 'high') {
        lowFpsNoted = true
        renderScale = 0.72
        onResize()
      }
      fpsSample = 0
      fpsFrames = 0
    }
  }
}

updateMenuCamera(0)
input.enabled = false
requestAnimationFrame(frame)

// A tiny debug surface for smoke tests and browser automation.
window.__LAST_CIRCLE__ = {
  get state() { return state },
  player,
  bots,
  zone,
  world,
  startGame,
  endGame,
  quality,
  get fps() { return fpsFrames / Math.max(0.001, fpsSample) },
  get lastWin() { return lastWin }
}

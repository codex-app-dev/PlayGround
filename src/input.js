import { clamp } from './utils.js'

const ACTION_KEYS = {
  KeyR: 'reload',
  KeyE: 'interact',
  KeyF: 'harvest',
  KeyH: 'heal',
  KeyQ: 'build',
  KeyM: 'mute',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Space: 'jump'
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.pressed = new Set()
    this.lookX = 0
    this.lookY = 0
    this.fireHeld = false
    this.aimHeld = false
    this.aimTouch = false
    this.crouchTouch = false
    this.sprintTouch = false
    this.stick = { x: 0, z: 0 }
    this.enabled = false
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    this.pointerLocked = false
    this.hadLock = false
    this.sensitivity = 1
    this.onPauseRequest = null
    this.onPointerLockChange = null
    this.muteRequested = false
    this._bind()
    if (this.isTouch) document.body.classList.add('touch')
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return
      if (e.code === 'Tab') e.preventDefault()
      if (e.code === 'Escape') {
        this.pressed.add('escape')
        return
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (!this.keys.has(e.code)) {
        const action = ACTION_KEYS[e.code]
        if (action) this.pressed.add(action)
        if (e.code === 'KeyC' || e.code === 'ControlLeft') this.pressed.add('crouchToggle')
      }
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.fireHeld = false
      this.aimHeld = false
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return
      if (this.pointerLocked) {
        this.lookX += e.movementX || 0
        this.lookY += e.movementY || 0
      }
    })
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return
      if (e.button === 0) {
        this.fireHeld = true
        this.pressed.add('fire')
      }
      if (e.button === 2) this.aimHeld = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false
      if (e.button === 2) this.aimHeld = false
    })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return
      this.pressed.add(e.deltaY > 0 ? 'slot2' : 'slot1')
    }, { passive: true })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
      if (this.pointerLocked) this.hadLock = true
      if (!this.pointerLocked && this.hadLock && this.enabled && !this.isTouch && this.onPointerLockChange) {
        this.onPointerLockChange()
      }
    })

    if (this.isTouch) this._bindTouch()
  }

  _bindTouch() {
    const stickZone = document.getElementById('stickZone')
    const stickBase = document.getElementById('stickBase')
    const knob = document.getElementById('stickKnob')
    const lookZone = document.getElementById('lookZone')
    if (!stickZone) return
    let stickId = null
    let stickCenter = null
    const maxDistance = 44

    const updateStick = (e) => {
      const dx = e.clientX - stickCenter.x
      const dy = e.clientY - stickCenter.y
      const len = Math.hypot(dx, dy)
      const limited = Math.min(len, maxDistance)
      const nx = len > 0 ? (dx / len) * (limited / maxDistance) : 0
      const ny = len > 0 ? (dy / len) * (limited / maxDistance) : 0
      this.stick.x = nx
      this.stick.z = -ny
      this.sprintTouch = Math.hypot(nx, ny) > 0.94
      knob.style.transform = `translate(${nx * maxDistance}px, ${ny * maxDistance}px)`
    }

    stickZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return
      stickId = e.pointerId
      const rect = stickBase.getBoundingClientRect()
      stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      stickZone.setPointerCapture(e.pointerId)
      updateStick(e)
    })
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return
      updateStick(e)
    })
    const endStick = (e) => {
      if (e.pointerId !== stickId) return
      stickId = null
      this.stick.x = 0
      this.stick.z = 0
      this.sprintTouch = false
      knob.style.transform = 'translate(0, 0)'
    }
    stickZone.addEventListener('pointerup', endStick)
    stickZone.addEventListener('pointercancel', endStick)

    let lookId = null
    let lastX = 0
    let lastY = 0
    lookZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return
      lookId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      lookZone.setPointerCapture(e.pointerId)
    })
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return
      this.lookX += (e.clientX - lastX) * 1.35
      this.lookY += (e.clientY - lastY) * 1.35
      lastX = e.clientX
      lastY = e.clientY
    })
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null }
    lookZone.addEventListener('pointerup', endLook)
    lookZone.addEventListener('pointercancel', endLook)

    document.querySelectorAll('.tbtn').forEach((btn) => {
      const act = btn.dataset.act
      const down = (e) => {
        e.preventDefault()
        if (!this.enabled) return
        btn.classList.add('on')
        if (act === 'fire') {
          this.fireHeld = true
          this.pressed.add('fire')
        } else if (act === 'aim') {
          this.aimTouch = !this.aimTouch
          btn.classList.toggle('on', this.aimTouch)
        } else if (act === 'crouch') {
          this.crouchTouch = !this.crouchTouch
          btn.classList.toggle('on', this.crouchTouch)
          this.pressed.add('crouchToggle')
        } else {
          this.pressed.add(act)
          if (act === 'build') this.pressed.add('build')
        }
      }
      const up = (e) => {
        e.preventDefault()
        if (act === 'fire') {
          this.fireHeld = false
          btn.classList.remove('on')
        } else if (act !== 'aim' && act !== 'crouch') {
          btn.classList.remove('on')
        }
      }
      btn.addEventListener('pointerdown', down)
      btn.addEventListener('pointerup', up)
      btn.addEventListener('pointercancel', up)
      btn.addEventListener('pointerleave', up)
    })
  }

  get moving() {
    return Math.hypot(this.moveX, this.moveZ) > 0.08
  }

  get moveX() {
    let x = 0
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.isTouch) x += this.stick.x
    return clamp(x, -1, 1)
  }

  get moveZ() {
    let z = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1
    if (this.isTouch) z += this.stick.z
    return clamp(z, -1, 1)
  }

  get sprint() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprintTouch
  }

  get crouch() {
    return this.keys.has('ControlLeft') || this.keys.has('KeyC') || this.crouchTouch
  }

  get firing() {
    return this.fireHeld
  }

  get aiming() {
    return this.aimHeld || this.aimTouch
  }

  consume(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action)
      return true
    }
    return false
  }

  endFrame() {
    this.pressed.clear()
    this.lookX = 0
    this.lookY = 0
  }

  lock() {
    if (this.isTouch) return
    try {
      const result = this.canvas.requestPointerLock()
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch {
      /* pointer lock is best-effort */
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  reset() {
    this.keys.clear()
    this.pressed.clear()
    this.lookX = 0
    this.lookY = 0
    this.fireHeld = false
    this.aimHeld = false
    this.aimTouch = false
    this.crouchTouch = false
    this.stick.x = 0
    this.stick.z = 0
  }
}

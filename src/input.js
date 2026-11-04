/**
 * Unified input: keyboard, gamepad and multi-touch.
 * Produces a single control snapshot for the player car each frame.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.touch = { x: 0, y: 0, jump: false, boost: false, active: false };
    this.padPrev = new Array(16).fill(false);
    this.gamepadIndex = null;
    this.touchEnabled = false;
    this._bindKeyboard();
  }

  _bindKeyboard() {
    const blocked = new Set([
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Escape',
    ]);
    window.addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const action = this._keyAction(e.code);
      if (action) this.pressed.add(action);
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const action = this._keyAction(e.code);
      if (action) this.released.add(action);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  _keyAction(code) {
    switch (code) {
      case 'Space': return 'jump';
      case 'ShiftLeft':
      case 'ShiftRight': return 'boost';
      case 'KeyC': return 'ballcam';
      case 'KeyM': return 'sound';
      case 'Escape':
      case 'KeyP': return 'pause';
      default: return null;
    }
  }

  bindTouchControls({ stickZone, knob, jumpBtn, boostBtn }) {
    this.touchEnabled = true;
    const maxR = () => Math.min(stickZone.clientWidth, stickZone.clientHeight) * 0.34;
    let pointerId = null;

    const updateStick = (e) => {
      const rect = stickZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const r = maxR();
      const len = Math.hypot(dx, dy);
      if (len > r) { dx = dx / len * r; dy = dy / len * r; }
      this.touch.x = dx / r;
      this.touch.y = dy / r;
      this.touch.active = true;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const resetStick = () => {
      pointerId = null;
      this.touch.x = 0;
      this.touch.y = 0;
      this.touch.active = false;
      knob.style.transform = '';
    };

    stickZone.addEventListener('pointerdown', (e) => {
      pointerId = e.pointerId;
      stickZone.setPointerCapture(e.pointerId);
      updateStick(e);
      e.preventDefault();
    }, { passive: false });
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      updateStick(e);
      e.preventDefault();
    }, { passive: false });
    stickZone.addEventListener('pointerup', resetStick);
    stickZone.addEventListener('pointercancel', resetStick);
    stickZone.addEventListener('lostpointercapture', resetStick);

    const holdButton = (btn, prop, action) => {
      const press = (e) => {
        btn.classList.add('held');
        this.touch[prop] = true;
        this.touch.active = true;
        if (action) this.pressed.add(action);
        e.preventDefault();
      };
      const release = () => {
        btn.classList.remove('held');
        this.touch[prop] = false;
      };
      btn.addEventListener('pointerdown', press, { passive: false });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', (e) => { if (e.buttons === 0) release(); });
    };
    holdButton(jumpBtn, 'jump', 'jump');
    holdButton(boostBtn, 'boost', null);
  }

  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) { this.padPrev.fill(false); return; }
    const pressedNow = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const edges = { 0: 'jump', 2: 'ballcam', 9: 'pause' };
    for (const [index, action] of Object.entries(edges)) {
      const now = pressedNow(Number(index));
      if (now && !this.padPrev[index]) this.pressed.add(action);
      this.padPrev[index] = now;
    }
    this._pad = {
      steer: Math.abs(pad.axes[0] || 0) > 0.14 ? pad.axes[0] : 0,
      throttle: Math.abs(pad.axes[1] || 0) > 0.14 ? -pad.axes[1] : 0,
      boost: pressedNow(1) || pressedNow(7) || (pad.buttons[6] && pad.buttons[6].value > 0.2),
      jump: pressedNow(0),
    };
  }

  poll() {
    this._pollGamepad();
    let throttle = 0;
    let steer = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttle -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;

    let jump = this.keys.has('Space');
    let boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let roll = 0;
    if (this.keys.has('KeyE')) roll += 1;
    if (this.keys.has('KeyQ')) roll -= 1;

    if (this._pad) {
      if (Math.abs(this._pad.steer) > 0) steer = this._pad.steer;
      if (Math.abs(this._pad.throttle) > 0) throttle = this._pad.throttle;
      boost = boost || this._pad.boost;
      jump = jump || this._pad.jump;
    }
    if (this.touch.active) {
      steer += this.touch.x;
      throttle -= this.touch.y;
      jump = jump || this.touch.jump;
      boost = boost || this.touch.boost;
    }

    steer = Math.max(-1, Math.min(1, steer));
    throttle = Math.max(-1, Math.min(1, throttle));
    return {
      throttle,
      steer,
      jump,
      jumpPressed: this.pressed.has('jump'),
      boost,
      roll,
    };
  }

  wasPressed(action) { return this.pressed.has(action); }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  vibrate(ms = 40) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
}

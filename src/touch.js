const STICK_RADIUS = 52;
const DEAD_ZONE = 0.24;

let lookId = null;
let lookX = 0;
let lookY = 0;
let stickId = null;

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window;
}

export function initTouchControls({ getPlayer, actions, state }) {
  if (!isTouchDevice()) return { touch: false };

  document.body.classList.add('touch');

  const grid = document.querySelector('.controls-grid');
  if (grid) {
    grid.innerHTML = [
      ['LEFT STICK', 'MOVE'],
      ['DRAG', 'AIM'],
      ['FIRE', 'SHOOT'],
      ['JUMP', 'JETPACK'],
      ['SKI', 'SLIDE'],
      ['ZOOM', 'AIM DOWN'],
    ].map(([key, label]) => `<div class="control"><kbd>${key}</kbd><span>${label}</span></div>`).join('');
  }
  const footer = document.querySelector('.menu-footer');
  if (footer) {
    footer.innerHTML = '<span class="live-dot"></span> LIVE SIMULATION · CTF · 6 BOTS <span class="sep">/</span> TOUCH CONTROLS ENABLED';
  }

  const stick = document.getElementById('touch-stick');
  const thumb = document.getElementById('touch-stick-thumb');
  let centerX = 0;
  let centerY = 0;

  const releaseMove = () => {
    actions.forward = false;
    actions.back = false;
    actions.left = false;
    actions.right = false;
    if (thumb) thumb.style.transform = 'translate(-50%, -50%)';
  };

  const moveStick = (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const length = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(length, STICK_RADIUS);
    const nx = (dx / length) * clamped;
    const ny = (dy / length) * clamped;
    if (thumb) {
      thumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
    const forward = -ny / STICK_RADIUS;
    const strafe = nx / STICK_RADIUS;
    actions.forward = forward > DEAD_ZONE;
    actions.back = forward < -DEAD_ZONE;
    actions.right = strafe > DEAD_ZONE;
    actions.left = strafe < -DEAD_ZONE;
  };

  if (stick && thumb) {
    stick.addEventListener('pointerdown', (event) => {
      if (state.mode !== 'playing') return;
      event.preventDefault();
      stickId = event.pointerId;
      stick.setPointerCapture?.(event.pointerId);
      const rect = stick.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      moveStick(event.clientX, event.clientY);
    });
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== stickId) return;
      event.preventDefault();
      moveStick(event.clientX, event.clientY);
    });
    const endStick = (event) => {
      if (event.pointerId !== stickId) return;
      stickId = null;
      releaseMove();
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    stick.addEventListener('lostpointercapture', endStick);
  }

  document.querySelectorAll('#touch-controls [data-action]').forEach((button) => {
    const action = button.dataset.action;
    const press = (event) => {
      if (state.mode !== 'playing') return;
      event.preventDefault();
      button.classList.add('active');
      if (action === 'reload') actions.reloadPressed = true;
      else actions[action] = true;
    };
    const release = () => {
      button.classList.remove('active');
      if (action !== 'reload') actions[action] = false;
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });

  const isControlTarget = (target) => target && target.closest && target.closest('#touch-controls');

  window.addEventListener('touchstart', (event) => {
    const player = getPlayer();
    if (state.mode !== 'playing' || !player?.alive || lookId !== null) return;
    const touch = event.changedTouches[0];
    if (!touch || isControlTarget(touch.target)) return;
    lookId = touch.identifier;
    lookX = touch.clientX;
    lookY = touch.clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (lookId === null) return;
    const player = getPlayer();
    if (!player) return;
    for (const touch of event.changedTouches) {
      if (touch.identifier !== lookId) continue;
      const dx = touch.clientX - lookX;
      const dy = touch.clientY - lookY;
      lookX = touch.clientX;
      lookY = touch.clientY;
      player.applyLook(dx * 1.7, dy * 1.7);
      event.preventDefault();
    }
  }, { passive: false });

  const endLook = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === lookId) lookId = null;
    }
  };
  window.addEventListener('touchend', endLook, { passive: true });
  window.addEventListener('touchcancel', endLook, { passive: true });

  return { touch: true };
}

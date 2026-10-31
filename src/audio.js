export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.started = false;
    try { this.muted = localStorage.getItem('lc_muted') === '1'; } catch { /* ignore */ }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(1.2);
    this.startAmbience();
  }

  startAmbience() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();

    const drone = this.ctx.createOscillator();
    const dg = this.ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = 52;
    dg.gain.value = 0.018;
    drone.connect(dg).connect(this.master);
    drone.start();
  }

  makeNoise(seconds) {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.04);
    try { localStorage.setItem('lc_muted', muted ? '1' : '0'); } catch { /* ignore */ }
    return muted;
  }

  toggle() {
    this.init();
    return this.setMuted(!this.muted);
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  spatial(pos, listenerPos, listenerYaw) {
    if (!pos || !listenerPos) return { dist: 0, pan: 0 };
    const dx = pos.x - listenerPos.x;
    const dz = pos.z - listenerPos.z;
    const dist = Math.hypot(dx, dz);
    const rightX = Math.cos(listenerYaw);
    const rightZ = -Math.sin(listenerYaw);
    const pan = dist > 1 ? Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / dist)) * 0.85 : 0;
    return { dist, pan };
  }

  shot(kind, dist = 0, pan = 0, volume = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const near = Math.max(0, 1 - dist / 190);
    const vol = Math.pow(near, 1.45) * 0.72 * volume;
    if (vol < 0.008) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const base = kind === 'sniper' ? 3000 : kind === 'shotgun' ? 1700 : kind === 'pistol' ? 2400 : 2600;
    filter.frequency.setValueAtTime(Math.max(260, base - dist * 10), t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const gain = this.ctx.createGain();
    const peak = kind === 'sniper' ? 0.95 : kind === 'shotgun' ? 0.9 : 0.78;
    const decay = kind === 'sniper' ? 0.3 : kind === 'shotgun' ? 0.22 : 0.14;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol * peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(filter).connect(gain).connect(panner).connect(this.master);
    src.start(t);
    src.stop(t + decay + 0.02);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    const freq = kind === 'sniper' ? 58 : kind === 'shotgun' ? 66 : 86;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.14);
    og.gain.setValueAtTime(vol * 0.55, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(og).connect(panner).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  tone(freq, duration = 0.08, volume = 0.14, type = 'sine', slide = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  click() { this.tone(620, 0.045, 0.06, 'square', 400); }
  pickup() { this.tone(540, 0.07, 0.1, 'sine', 760); this.tone(810, 0.1, 0.07, 'sine', 980, 0.06); }
  reload() { this.tone(240, 0.04, 0.08, 'square', 180); this.tone(180, 0.05, 0.06, 'square', 120, 0.11); }
  reloadDone() { this.tone(420, 0.05, 0.09, 'square', 520); }
  hit(head = false) {
    this.tone(head ? 1320 : 880, 0.05, 0.14, 'triangle', head ? 1120 : 740);
    if (head) this.tone(1760, 0.08, 0.08, 'sine', 1500, 0.03);
  }
  kill() { this.tone(760, 0.08, 0.13, 'triangle', 1020); this.tone(1180, 0.15, 0.1, 'sine', 1560, 0.08); }
  heal() { this.tone(380, 0.22, 0.09, 'sine', 660); this.tone(540, 0.25, 0.06, 'sine', 820, 0.12); }
  land() {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.32);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.4);
  }
  footstep(volume = 0.045) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260 + Math.random() * 120;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, 0.11);
  }
  zoneWarn() {
    this.tone(210, 0.5, 0.08, 'sawtooth', 170);
    this.tone(210, 0.5, 0.055, 'sawtooth', 170, 0.65);
  }
  zonePhase() {
    this.tone(300, 0.12, 0.09, 'sine', 420);
    this.tone(420, 0.16, 0.08, 'sine', 560, 0.12);
  }
  death() {
    this.tone(180, 0.8, 0.12, 'sawtooth', 52);
    this.tone(90, 1.2, 0.1, 'sine', 38, 0.12);
  }
  win() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.32, 0.1, 'triangle', null, i * 0.14));
  }
  deploy() {
    this.tone(120, 0.4, 0.12, 'sawtooth', 240);
    this.tone(240, 0.45, 0.08, 'sine', 420, 0.18);
  }
}

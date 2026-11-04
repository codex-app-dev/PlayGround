export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('solt_muted') === '1';
    this.pad = null;
    this.timer = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.master.connect(this.ctx.destination);
    this.startPad();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('solt_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.2);
  }

  startPad() {
    if (!this.ctx || this.pad) return;
    const ctx = this.ctx;
    const root = ctx.createGain(); root.gain.value = 0.06; root.connect(this.master);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 480; filter.Q.value = 0.8; filter.connect(root);
    const notes = [55, 82.41, 110, 164.81];
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.13 / (i + 1);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017;
      const lg = ctx.createGain(); lg.gain.value = 0.06;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(filter); o.start();
      return o;
    });
    this.pad = { root, filter, oscs };
    this.timer = setInterval(() => {
      if (!this.ctx) return;
      this.chime(660 + Math.random() * 330, 0.012, 3.5);
    }, 11000);
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.08, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(this.master);
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  chime(freq = 660, vol = 0.05, dur = 1.5) {
    this.tone(freq, dur, 'sine', vol);
    this.tone(freq * 1.5, dur * 0.65, 'sine', vol * 0.4, 0.08);
  }

  step() { this.tone(92, 0.09, 'triangle', 0.05); }
  block() { this.tone(70, 0.16, 'square', 0.04); }
  mirror() { this.chime(880, 0.05, 1.2); }
  dial() { this.tone(340, 0.08, 'triangle', 0.06); this.tone(510, 0.12, 'sine', 0.04, 0.05); }
  water() { this.tone(120, 0.8, 'sine', 0.08); this.tone(180, 1.1, 'sine', 0.04, 0.1); }
  door() { this.tone(82, 1.2, 'sawtooth', 0.04); this.chime(392, 0.05, 2); }
  collect() { this.chime(1046, 0.06, 1.2); this.chime(1568, 0.035, 1.5); }
  relic() { [523, 659, 784, 1046].forEach((f, i) => this.chime(f, 0.06, 1.8)); }
  death() { this.tone(110, 0.75, 'sawtooth', 0.07); this.tone(82, 1.1, 'triangle', 0.05, 0.15); }
  complete() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.05, i * 0.12)); }
  click() { this.tone(600, 0.04, 'sine', 0.025); }
  error() { this.tone(160, 0.18, 'square', 0.035); }
  glyph(good = true) { good ? this.chime(720, 0.04, 1) : this.tone(180, 0.25, 'sawtooth', 0.04); }
  guardian() { this.tone(58, 0.3, 'sawtooth', 0.03); }
}

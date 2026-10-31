// Tiny procedural sound engine: no audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.5;
    this.lastHit = 0;
    this.ambient = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.16, slide = 0, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise(dur = 0.15, vol = 0.12, cutoff = 900, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  click() { this.tone(520, 0.05, 'square', 0.05); }
  select() { this.tone(660, 0.07, 'triangle', 0.08, 120); this.tone(990, 0.05, 'sine', 0.04, 0, 0.04); }
  order() { this.tone(420, 0.08, 'triangle', 0.08, 80); }
  attackOrder() { this.tone(300, 0.1, 'sawtooth', 0.06, -80); this.noise(0.08, 0.06, 1200); }
  deny() { this.tone(160, 0.12, 'square', 0.08, -30); }
  buildStart() { this.noise(0.2, 0.1, 500); this.tone(220, 0.18, 'triangle', 0.09, 40); }
  buildDone() { this.tone(392, 0.12, 'triangle', 0.09); this.tone(587, 0.14, 'triangle', 0.07, 0, 0.1); }
  trainDone() { this.tone(440, 0.08, 'triangle', 0.06); this.tone(660, 0.09, 'triangle', 0.05, 0, 0.07); }
  hit(strong = false) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastHit < 55) return;
    this.lastHit = now;
    this.noise(strong ? 0.12 : 0.07, strong ? 0.15 : 0.08, strong ? 420 : 900);
  }
  death() { this.tone(130, 0.4, 'sawtooth', 0.07, -70); this.noise(0.3, 0.1, 380); }
  victory() {
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.35, 'triangle', 0.12, 0, i * 0.16));
  }
  defeat() {
    const notes = [330, 277, 220, 165];
    notes.forEach((n, i) => this.tone(n, 0.55, 'sawtooth', 0.09, -30, i * 0.25));
  }
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.995 + (Math.random() * 2 - 1) * 0.005;
      data[i] = v;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.ambient = { src, gain };
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.6;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.15;
    this.music.connect(this.master);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 6;
    this.sfx.disconnect();
    this.sfx.connect(comp);
    comp.connect(this.master);
    this.sfxComp = comp;

    this._buildEngine();
    this.ready = true;
  }

  _buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 2.4;
    this.engineGain.connect(this.engineFilter);
    this.engineFilter.connect(this.sfx);

    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 68;
    this.engineOsc1.connect(this.engineGain);
    this.engineOsc1.start();

    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 34;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.engineOsc2.connect(g2);
    g2.connect(this.engineGain);
    this.engineOsc2.start();

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = noiseBuffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.03);
  }

  updateEngine(speed, maxSpeed, boosting, active) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const ratio = Math.min(1.25, speed / Math.max(1, maxSpeed));
    const target = active ? 0.018 + ratio * 0.025 + (boosting ? 0.018 : 0) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const freq = 52 + ratio * 110 + (boosting ? 30 : 0);
    this.engineOsc1.frequency.setTargetAtTime(freq, t, 0.07);
    this.engineOsc2.frequency.setTargetAtTime(freq * 0.5 + 1.4, t, 0.07);
    this.engineFilter.frequency.setTargetAtTime(480 + ratio * 1200 + (boosting ? 500 : 0), t, 0.08);
  }

  _tone(freq, duration, type = 'sine', gain = 0.18, slideTo = null, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  _noise(duration = 0.2, gain = 0.14, freq = 900, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, freq * 0.25), t0 + duration);
    filter.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  countdown(final = false) {
    if (final) {
      this._tone(660, 0.12, 'square', 0.12);
      this._tone(990, 0.45, 'square', 0.14, 1320, 0.1);
      this._noise(0.5, 0.12, 1800);
    } else {
      this._tone(520, 0.11, 'square', 0.1);
    }
  }

  coin() {
    this._tone(1320, 0.08, 'triangle', 0.1);
    this._tone(1760, 0.13, 'triangle', 0.09, null, 0.05);
  }

  pickup() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this._tone(n, 0.12, 'triangle', 0.08, null, i * 0.045));
  }

  boost() {
    this._noise(0.5, 0.2, 2400);
    this._tone(140, 0.45, 'sawtooth', 0.14, 420);
  }

  driftRelease(level = 1) {
    this._noise(0.22 + level * 0.1, 0.1 + level * 0.04, 1600 + level * 500);
    this._tone(180 + level * 40, 0.2, 'square', 0.08, 300 + level * 80);
  }

  hit() {
    this._noise(0.24, 0.22, 300);
    this._tone(90, 0.2, 'sawtooth', 0.12, 50);
  }

  item() {
    this._tone(420, 0.2, 'sawtooth', 0.1, 840);
    this._noise(0.3, 0.1, 1300);
  }

  shield() {
    this._tone(300, 0.4, 'sine', 0.1, 800);
    this._tone(600, 0.5, 'triangle', 0.06, 1200, 0.08);
  }

  lap() {
    [659, 784, 1047].forEach((n, i) => this._tone(n, 0.18, 'triangle', 0.1, null, i * 0.08));
  }

  finish(win = true) {
    const notes = win ? [523, 659, 784, 1047, 1319, 1568] : [392, 466, 523, 622];
    notes.forEach((n, i) => this._tone(n, 0.3, 'triangle', 0.12, null, i * 0.11));
    if (win) this._noise(0.9, 0.12, 2200, 0.25);
  }

  startMusic() {
    if (!this.ready || this.musicOn) return;
    this.musicOn = true;
    this.musicStep = 0;
    const bass = [0, 0, 7, 0, 5, 0, 3, 7];
    const lead = [12, 15, 19, 22, 19, 15, 12, 10];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + 0.02;
      const step = this.musicStep % 16;
      const root = 55;
      const note = 2 ** ((bass[step % 8] + (step >= 8 ? 2 : 0)) / 12);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root * note;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(g);
      g.connect(this.music);
      osc.start(t0);
      osc.stop(t0 + 0.24);

      if (step % 2 === 0) {
        const hi = ctx.createBufferSource();
        hi.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.018, t0);
        hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        hi.connect(hp);
        hp.connect(hg);
        hg.connect(this.music);
        hi.start(t0);
        hi.stop(t0 + 0.06);
      }

      if (step % 4 === 0) {
        const leadOsc = ctx.createOscillator();
        const lg = ctx.createGain();
        leadOsc.type = 'sine';
        leadOsc.frequency.value = root * 4 * 2 ** ((lead[step % 8]) / 12);
        lg.gain.setValueAtTime(0.0001, t0);
        lg.gain.exponentialRampToValueAtTime(0.025, t0 + 0.04);
        lg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
        leadOsc.connect(lg);
        lg.connect(this.music);
        leadOsc.start(t0);
        leadOsc.stop(t0 + 0.44);
      }
      this.musicStep++;
    }, 200);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

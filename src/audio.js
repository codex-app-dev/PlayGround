/** Procedural WebAudio soundscape — no external assets required. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this.scene = 'menu';
    this.cheer = 0;
    this.boostEnv = 0;
    this._lastHit = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.ready = true;
    const master = this.master = ctx.createGain();
    master.gain.value = this.enabled ? 0.62 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.005;
    comp.release.value = 0.22;
    master.connect(comp).connect(ctx.destination);

    this.noiseBuffer = this._makeNoise(2.4);

    // ---- engine ----
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;
    const engineFilter = this.engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 340;
    engineFilter.Q.value = 5.5;
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = 44;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.value = 67;
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;
    this.osc1.connect(engineFilter);
    this.osc2.connect(g2).connect(engineFilter);
    engineFilter.connect(this.engineGain).connect(master);
    this.osc1.start();
    this.osc2.start();

    // ---- wind ----
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = this.windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0001;
    wind.connect(windFilter).connect(this.windGain).connect(master);
    wind.start();

    // ---- boost ----
    const boost = ctx.createBufferSource();
    boost.buffer = this.noiseBuffer;
    boost.loop = true;
    const boostFilter = this.boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.value = 1500;
    boostFilter.Q.value = 0.9;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0.0001;
    boost.connect(boostFilter).connect(this.boostGain).connect(master);
    boost.start();

    // ---- crowd ----
    const crowd = ctx.createBufferSource();
    crowd.buffer = this.noiseBuffer;
    crowd.loop = true;
    const crowdFilter = this.crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = 'lowpass';
    crowdFilter.frequency.value = 620;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.0001;
    crowd.connect(crowdFilter).connect(this.crowdGain).connect(master);
    crowd.start();

    // ---- ambient pad ----
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 900;
    const notes = [55, 82.41, 110, 164.81];
    this.padOscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 3;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.055 : 0.028;
      o.connect(g).connect(musicFilter);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    lfo.connect(lfoGain).connect(musicFilter.frequency);
    lfo.start();
    musicFilter.connect(this.musicGain).connect(master);

    this.setScene('menu');
  }

  _makeNoise(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.86 + white * 0.14;
        data[i] = last * 1.9;
      }
    }
    return buffer;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(on ? 0.62 : 0.0001, this.ctx.currentTime + 0.15);
  }

  setScene(scene) {
    this.scene = scene;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const music = scene === 'menu' ? 0.16 : 0.055;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.linearRampToValueAtTime(music, t + 1.2);
    const crowd = scene === 'menu' ? 0.02 : 0.035;
    this.crowdGain.gain.linearRampToValueAtTime(crowd, t + 0.8);
  }

  update(dt, { speed = 0, throttle = 0, boosting = false, grounded = true, paused = false }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sp = Math.min(1, speed / 55);
    const target = paused ? 0.0001 : 0.055 + sp * 0.11 + (grounded ? Math.abs(throttle) * 0.035 : 0.02);
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const freq = 40 + sp * 92 + Math.abs(throttle) * (grounded ? 15 : 4);
    this.osc1.frequency.setTargetAtTime(freq, t, 0.1);
    this.osc2.frequency.setTargetAtTime(freq * 1.505, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(260 + sp * 900 + (boosting ? 260 : 0), t, 0.1);

    this.windGain.gain.setTargetAtTime(paused ? 0.0001 : sp * sp * 0.1, t, 0.16);
    this.windFilter.frequency.setTargetAtTime(500 + sp * 1800, t, 0.2);

    this.boostEnv += ((boosting && !paused ? 1 : 0) - this.boostEnv) * Math.min(1, dt * 15);
    this.boostGain.gain.setTargetAtTime(0.004 + this.boostEnv * 0.16, t, 0.04);
    this.boostFilter.frequency.setTargetAtTime(1200 + this.boostEnv * 1600, t, 0.05);

    this.cheer = Math.max(0, this.cheer - dt * 0.42);
    const crowd = paused ? 0.0001 : (this.scene === 'menu' ? 0.02 : 0.03) + this.cheer * 0.24;
    this.crowdGain.gain.setTargetAtTime(crowd, t, 0.14);
    this.crowdFilter.frequency.setTargetAtTime(500 + this.cheer * 900, t, 0.2);
  }

  _env(gain, t, attack, decay, peak = 1) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  hit(strength = 1, pitch = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this._lastHit < 0.035) return;
    this._lastHit = now;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + strength * 2200;
    const g = ctx.createGain();
    this._env(g, now, 0.005, 0.16, Math.min(0.55, 0.1 + strength * 0.3));
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.22);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140 * pitch + strength * 80, now);
    o.frequency.exponentialRampToValueAtTime(45, now + 0.16);
    const og = ctx.createGain();
    this._env(og, now, 0.004, 0.2, Math.min(0.45, 0.08 + strength * 0.24));
    o.connect(og).connect(this.master);
    o.start(now);
    o.stop(now + 0.25);
  }

  jump() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(390, t + 0.12);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.15, 0.16);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  boostPad(big = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [0, 0.06].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(big ? 520 + i * 160 : 780 + i * 220, t + d);
      o.frequency.exponentialRampToValueAtTime(big ? 980 + i * 220 : 1200 + i * 260, t + d + 0.1);
      const g = this.ctx.createGain();
      this._env(g, t + d, 0.005, 0.12, big ? 0.17 : 0.09);
      o.connect(g).connect(this.master);
      o.start(t + d); o.stop(t + d + 0.18);
    });
  }

  beep(high = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = high ? 880 : 620;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, high ? 0.37 : 0.12, 0.09);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.45);
  }

  goal() {
    if (!this.ready) return;
    this.cheer = 1;
    const t = this.ctx.currentTime;
    // stadium horn
    [0, 0.02].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(146 + i * 4, t + d);
      o.frequency.exponentialRampToValueAtTime(116, t + d + 0.75);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = this.ctx.createGain();
      this._env(g, t + d, 0.04, 1.35, 0.19);
      o.connect(f).connect(g).connect(this.master);
      o.start(t + d); o.stop(t + d + 1.5);
    });
    // impact boom
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    this._env(g, t, 0.01, 0.85, 0.36);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 1);
  }

  whistle() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1900 + i * 6, t + i * 0.18);
      o.frequency.linearRampToValueAtTime(2050, t + i * 0.18 + 0.22);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.18, 0.01, 0.22, 0.07);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.35);
    }
  }

  click() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(760, t);
    const g = this.ctx.createGain();
    this._env(g, t, 0.003, 0.07, 0.06);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.1);
  }
}

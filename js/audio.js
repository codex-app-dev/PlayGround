import { loadMuted, saveMuted } from './config.js';

export const audio = {
  ctx: null,
  master: null,
  engineGain: null,
  engineFilter: null,
  osc1: null,
  osc2: null,
  noiseBuffer: null,
  enabled: !loadMuted(),

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    try {
      const ctx = this.ctx = new AudioCtor();
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 0.62 : 0;
      this.master.connect(ctx.destination);

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 240;
      this.engineFilter.Q.value = 1.1;

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);

      const makeOsc = (frequency, type, level) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = level;
        osc.connect(gain);
        gain.connect(this.engineFilter);
        osc.start();
        return osc;
      };
      this.osc1 = makeOsc(52, 'sawtooth', 0.5);
      this.osc2 = makeOsc(78, 'square', 0.12);

      const length = Math.floor(ctx.sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  setMuted(muted) {
    this.enabled = !muted;
    saveMuted(muted);
    document.body.classList.toggle('muted', muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.04);
    }
  },

  update(speed, active) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(active ? 0.038 : 0, now, 0.12);
    if (!active) return;
    const frequency = 40 + Math.min(speed, 760) * 0.115;
    this.osc1.frequency.setTargetAtTime(frequency, now, 0.12);
    this.osc2.frequency.setTargetAtTime(frequency * 1.51, now, 0.12);
    this.engineFilter.frequency.setTargetAtTime(190 + Math.min(speed, 760) * 0.52, now, 0.12);
  },

  tone(startFrequency, endFrequency, duration, type = 'sine', volume = 0.05) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, startFrequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },

  pickup() {
    this.tone(680, 1180, 0.14, 'sine', 0.055);
    window.setTimeout(() => this.tone(1180, 1540, 0.1, 'sine', 0.035), 55);
  },

  nearMiss() {
    this.tone(220, 90, 0.16, 'sawtooth', 0.024);
  },

  crash() {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + 0.3);
    this.tone(120, 44, 0.24, 'triangle', 0.09);
  },

  siren() {
    this.tone(720, 470, 0.18, 'square', 0.018);
    window.setTimeout(() => this.tone(500, 760, 0.18, 'square', 0.018), 170);
  },

  levelUp() {
    this.tone(320, 520, 0.16, 'triangle', 0.05);
    window.setTimeout(() => this.tone(520, 760, 0.18, 'triangle', 0.04), 90);
  }
};

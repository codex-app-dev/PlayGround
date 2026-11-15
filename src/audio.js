import { clamp } from './util.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.master = null;
  }

  start() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) { return; }
    const ctx = this.ctx;
    this.started = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // ---- engine ----
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 3;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscA.frequency.value = 55;
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'square';
    this.oscB.frequency.value = 27.5;
    const bGain = ctx.createGain();
    bGain.gain.value = 0.4;
    const aGain = ctx.createGain();
    aGain.gain.value = 0.55;
    this.oscA.connect(aGain).connect(this.engineFilter);
    this.oscB.connect(bGain).connect(this.engineFilter);
    this.oscA.start(); this.oscB.start();

    // ---- tire / skid noise ----
    const bufLen = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    this.noiseBuffer = buf;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    this.tireFilter = ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.value = 1500;
    this.tireFilter.Q.value = 1.1;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    const noise2 = ctx.createBufferSource();
    noise2.buffer = buf; noise2.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(this.tireFilter).connect(this.tireGain).connect(this.master);
    noise2.connect(this.windFilter).connect(this.windGain).connect(this.master);
    noise.start(); noise2.start();

    // slight stereo width
    const merger = ctx.createChannelMerger(2);
    this.master.disconnect();
    this.master.connect(merger);
    merger.connect(ctx.destination);
  }

  update(vehicle) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const rpm = vehicle.rpm;
    const throttle = vehicle.controls.throttle;
    const speed = Math.abs(vehicle.forwardSpeed);
    const freq = 34 + (rpm / 7200) * 190;
    this.oscA.frequency.setTargetAtTime(freq, t, 0.055);
    this.oscB.frequency.setTargetAtTime(freq * 0.5, t, 0.055);
    this.engineFilter.frequency.setTargetAtTime(320 + rpm * 0.28 + throttle * 800, t, 0.06);
    const eGain = (0.12 + throttle * 0.16 + (rpm / 7200) * 0.12) * (this.enabled ? 1 : 0);
    this.engineGain.gain.setTargetAtTime(eGain, t, 0.07);

    const slip = clamp(vehicle.lateralSlip / 9, 0, 1);
    const skid = Math.max(slip * 0.5, vehicle.inputs.handbrake ? 0.12 : 0) * clamp(speed / 12, 0, 1);
    this.tireGain.gain.setTargetAtTime(skid * 0.34, t, 0.06);
    this.tireFilter.frequency.setTargetAtTime(900 + speed * 12, t, 0.08);
    this.windGain.gain.setTargetAtTime(clamp(speed / 70, 0, 1) * 0.14, t, 0.2);
  }

  idle() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.0, t, 0.2);
    this.tireGain.gain.setTargetAtTime(0, t, 0.2);
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
  }

  crash(power, soft = false) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = clamp(power / 30, 0.15, 1);
    // noise smash
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = soft ? 'lowpass' : 'bandpass';
    f.frequency.value = soft ? 220 : 650 + Math.random() * 400;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (soft ? 0.35 : 0.55));
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.6);
    // metal clank
    if (!soft) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180 + Math.random() * 120, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.22);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.16 * vol, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(og).connect(this.master);
      o.start(t); o.stop(t + 0.32);
    }
  }

  skidTick() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.16);
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.1);
    if (!v) this.idle();
  }
}

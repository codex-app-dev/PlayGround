export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.jetOn = false;
    this.skiOn = false;
    this.jetGain = null;
    this.skiGain = null;
    this.windGain = null;
    this.noiseBuffer = null;
    this.drone = null;
  }

  unlock() {
    if (this.enabled) {
      this.ctx?.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.enabled = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0.62;
    this.master.connect(ctx.destination);

    const seconds = 2.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last;
    }
    this.noiseBuffer = buffer;

    this.windGain = this.loopNoise({ type: 'lowpass', frequency: 420, q: 0.5, gain: 0.012 });
    this.jetGain = this.loopNoise({ type: 'bandpass', frequency: 820, q: 0.7, gain: 0 });
    this.skiGain = this.loopNoise({ type: 'highpass', frequency: 1900, q: 0.6, gain: 0 });

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.014;
    droneGain.connect(this.master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.connect(droneGain);
    for (const freq of [46, 69, 92]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(filter);
      osc.start();
    }
    this.drone = droneGain;
    ctx.resume();
  }

  loopNoise({ type, frequency, q, gain }) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp).connect(this.master);
    source.start();
    return amp;
  }

  setJet(on) {
    if (!this.enabled) return;
    if (on === this.jetOn) return;
    this.jetOn = on;
    const t = this.ctx.currentTime;
    this.jetGain.gain.cancelScheduledValues(t);
    this.jetGain.gain.setTargetAtTime(on ? 0.085 : 0, t, on ? 0.035 : 0.08);
  }

  setSki(on, speed = 0) {
    if (!this.enabled) return;
    if (on === this.skiOn && speed < 1) return;
    this.skiOn = on;
    const t = this.ctx.currentTime;
    const target = on ? Math.min(0.05, 0.015 + speed * 0.0012) : 0;
    this.skiGain.gain.setTargetAtTime(target, t, 0.06);
  }

  noiseBurst(duration, { frequency = 900, type = 'lowpass', gain = 0.25, decay = null } = {}) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.24), t + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + (decay || duration));
    source.connect(filter).connect(amp).connect(this.master);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  tone(freq, duration, { type = 'sine', gain = 0.12, slide = null, delay = 0 } = {}) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  fire() {
    this.tone(430, 0.28, { type: 'sawtooth', gain: 0.17, slide: 65 });
    this.tone(880, 0.1, { type: 'square', gain: 0.055, slide: 180 });
    this.noiseBurst(0.22, { frequency: 2200, type: 'highpass', gain: 0.09 });
  }

  explosion() {
    this.noiseBurst(0.85, { frequency: 900, gain: 0.4, type: 'lowpass' });
    this.tone(72, 0.5, { type: 'sine', gain: 0.28, slide: 30 });
    this.tone(160, 0.18, { type: 'sawtooth', gain: 0.08, slide: 50 });
  }

  hit() {
    this.tone(1250, 0.06, { type: 'square', gain: 0.075, slide: 1650 });
  }

  kill() {
    this.tone(740, 0.07, { type: 'square', gain: 0.07 });
    this.tone(1110, 0.09, { type: 'square', gain: 0.06, delay: 0.06 });
  }

  damage() {
    this.tone(138, 0.22, { type: 'sawtooth', gain: 0.13, slide: 62 });
    this.noiseBurst(0.14, { frequency: 500, type: 'lowpass', gain: 0.14 });
  }

  jump() {
    this.noiseBurst(0.18, { frequency: 1000, type: 'bandpass', gain: 0.07 });
    this.tone(170, 0.13, { type: 'sine', gain: 0.06, slide: 95 });
  }

  land() {
    this.noiseBurst(0.2, { frequency: 420, type: 'lowpass', gain: 0.18 });
    this.tone(78, 0.18, { type: 'sine', gain: 0.1, slide: 42 });
  }

  reload() {
    this.tone(340, 0.05, { type: 'square', gain: 0.045 });
    this.tone(520, 0.07, { type: 'square', gain: 0.05, delay: 0.18 });
    this.tone(830, 0.08, { type: 'square', gain: 0.055, delay: 0.4 });
  }

  empty() {
    this.tone(120, 0.045, { type: 'square', gain: 0.055 });
  }

  pickup() {
    this.tone(520, 0.12, { type: 'sine', gain: 0.1, slide: 880 });
    this.tone(1040, 0.16, { type: 'sine', gain: 0.06, delay: 0.08 });
  }

  capture() {
    [392, 523, 659, 784].forEach((freq, i) => {
      this.tone(freq, 0.5, { type: 'sine', gain: 0.09, delay: i * 0.11 });
    });
  }

  flagLost() {
    this.tone(320, 0.32, { type: 'sawtooth', gain: 0.08, slide: 150 });
  }

  ui() {
    this.tone(660, 0.07, { type: 'sine', gain: 0.05 });
  }
}

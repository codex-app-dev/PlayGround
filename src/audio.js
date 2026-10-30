const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.muted = false;
    this.musicOn = true;
    this.playing = false;
    this.nextTime = 0;
    this.step = 0;
    this.bpm = 112;
    this.engineOsc = [];
    this.engineFilter = null;
    this.engineTarget = 0;
    this.started = false;
    this.delay = null;
    this.compressor = null;
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
    this.master.gain.value = this.muted ? 0 : .8;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = .004;
    this.compressor.release.value = .22;
    this.master.connect(this.compressor).connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = .3;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = .55;
    this.sfxGain.connect(this.master);

    // warm synth delay for arps
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = .268;
    const fb = this.ctx.createGain();
    fb.gain.value = .28;
    const wet = this.ctx.createGain();
    wet.gain.value = .34;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.musicGain);

    // engine drone
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 340;
    this.engineFilter.Q.value = 2.4;
    this.engineGain.connect(this.engineFilter).connect(this.master);
    for (const [type, detune] of [['sawtooth', -7], ['sawtooth', 9], ['sine', 0]]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = 62;
      o.detune.value = detune;
      const g = this.ctx.createGain();
      g.gain.value = type === 'sine' ? .55 : .24;
      o.connect(g).connect(this.engineGain);
      o.start();
      this.engineOsc.push({ osc: o, base: 62, gain: g });
    }

    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
  }

  setMuted(v) {
    this.muted = v;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(v ? 0 : .8, this.ctx.currentTime + .12);
    }
  }

  setMusicOn(v) {
    this.musicOn = v;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v ? .3 : 0, this.ctx.currentTime, .2);
  }

  startMusic() {
    if (!this.ctx) return;
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + .08;
    this.step = 0;
  }

  stopMusic() {
    this.playing = false;
  }

  update(dt, speed = 0, boosting = false, active = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.playing) {
      const stepDur = 60 / this.bpm / 4;
      while (this.nextTime < now + .14) {
        this.scheduleStep(this.step, this.nextTime);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % 32;
      }
    }

    const target = active ? .035 + Math.min(.04, speed / 9000) + (boosting ? .02 : 0) : 0;
    this.engineTarget += (target - this.engineTarget) * Math.min(1, dt * 4);
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(this.engineTarget, now, .08);
      this.engineFilter.frequency.setTargetAtTime(280 + speed * 1.35 + (boosting ? 260 : 0), now, .12);
      for (const e of this.engineOsc) {
        e.osc.frequency.setTargetAtTime(e.base + speed * .035, now, .1);
      }
    }
  }

  scheduleStep(step, t) {
    const bar = Math.floor(step / 8) % 4;
    const s8 = step % 8;
    // kick: 1 and 3
    if (s8 === 0 || s8 === 4) this.kick(t);
    // snare on 2 and 4
    if (s8 === 2 || s8 === 6) this.snare(t, .055);
    // hats on offbeats
    if (s8 % 2 === 1) this.hat(t, .028);
    if (s8 === 7 && Math.random() > .6) this.hat(t, .02);

    const roots = [45, 41, 48, 43]; // A1 F1 C2 G1
    if (s8 === 0) this.bass(t, midi(roots[bar] - 12), .5);
    if (s8 === 3) this.bass(t, midi(roots[bar] - 12), .22);
    if (s8 === 6) this.bass(t, midi(roots[bar] - 5), .25);

    const arpNotes = [
      [69, 72, 76, 79, 76, 72, 76, 72],
      [65, 69, 72, 77, 76, 72, 69, 65],
      [72, 76, 79, 84, 79, 76, 72, 76],
      [67, 71, 74, 79, 77, 74, 71, 67],
    ][bar];
    if (s8 % 1 === 0) this.pluck(t, midi(arpNotes[s8]), .13, .1);

    if (step % 8 === 0) {
      const chord = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]][bar];
      this.pad(t, chord, 1.1);
    }
  }

  env(gainNode, t, attack, decay, peak) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  bass(t, freq, dur = .4) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    f.Q.value = 5;
    this.env(g, t, .006, dur, .16);
    o.connect(f).connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + .08);
  }

  pluck(t, freq, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    this.env(g, t, .004, dur, vol);
    o.connect(g);
    g.connect(this.musicGain);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + .06);
  }

  pad(t, notes, dur) {
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det;
        f.type = 'lowpass';
        f.frequency.value = 680;
        f.Q.value = .9;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(.018, t + .35);
        g.gain.linearRampToValueAtTime(.012, t + dur * .7);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(f).connect(g).connect(this.musicGain);
        o.start(t);
        o.stop(t + dur + .1);
      }
    }
  }

  kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(128, t);
    o.frequency.exponentialRampToValueAtTime(44, t + .11);
    this.env(g, t, .004, .22, .34);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + .28);
  }

  noiseBuffer(dur = .3) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  snare(t, vol = .08) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.16);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1100;
    const g = this.ctx.createGain();
    this.env(g, t, .002, .12, vol);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t);
  }

  hat(t, vol = .03) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.05);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    this.env(g, t, .001, .035, vol);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t);
  }

  /* ---------------- sfx ---------------- */

  laser() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1280 + Math.random() * 180, t);
    o.frequency.exponentialRampToValueAtTime(410, t + .075);
    this.env(g, t, .002, .075, .028);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + .11);
  }

  enemyShot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(340, t);
    o.frequency.exponentialRampToValueAtTime(110, t + .18);
    this.env(g, t, .004, .18, .035);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + .22);
  }

  explosion(size = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.8);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(90, t + .55);
    const g = this.ctx.createGain();
    this.env(g, t, .003, .55 * size, .26 * Math.min(1.6, size));
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + .45);
    this.env(og, t, .004, .5, .25 * size);
    o.connect(og).connect(this.sfxGain);
    o.start(t); o.stop(t + .55);
  }

  missile() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + .35);
    const g = this.ctx.createGain();
    this.env(g, t, .01, .42, .17);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.09);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3;
    const g = this.ctx.createGain();
    this.env(g, t, .001, .06, .06);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, .07, .14].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = [660, 880, 1320][i];
      this.env(g, t + d, .005, .2, .06);
      o.connect(g).connect(this.sfxGain);
      o.start(t + d); o.stop(t + d + .24);
    });
  }

  lock() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 1760;
    this.env(g, t, .002, .06, .035);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + .08);
  }

  roll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + .3);
    const g = this.ctx.createGain();
    this.env(g, t, .03, .38, .1);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  alarm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(440, t + i * .22);
      o.frequency.linearRampToValueAtTime(660, t + i * .22 + .16);
      this.env(g, t + i * .22, .01, .18, .035);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * .22); o.stop(t + i * .22 + .2);
    }
  }

  ui() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 980;
    this.env(g, t, .002, .055, .028);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + .08);
  }
}

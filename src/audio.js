// Procedural WebAudio sound design — no asset downloads.
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this.noiseBuffer = null
    this.ambient = null
    this.zoneHum = null
    this.lastBotShot = 0
    this.shotCount = 0
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.enabled ? 0.7 : 0
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -12
    limiter.knee.value = 18
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.22
    this.master.connect(limiter)
    limiter.connect(this.ctx.destination)
    this._buildNoise()
    this._startAmbient()
  }

  setEnabled(on) {
    this.enabled = on
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05)
    }
    if (on) this.init()
  }

  _buildNoise() {
    const len = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer
  }

  _startAmbient() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.045
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    this.ambient = { src, gain, filter }

    // A very low drone that rises when the zone is dangerous.
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 42
    const humGain = ctx.createGain()
    humGain.gain.value = 0
    osc.connect(humGain)
    humGain.connect(this.master)
    osc.start()
    this.zoneHum = { osc, gain: humGain }
    this._ambientTime = 0
  }

  _pan(pan = 0) {
    if (!this.ctx.createStereoPanner) return null
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    return p
  }

  _route(node, volume, pan) {
    const gain = this.ctx.createGain()
    gain.gain.value = volume
    const panner = this._pan(pan)
    if (panner) {
      node.connect(gain)
      gain.connect(panner)
      panner.connect(this.master)
    } else {
      node.connect(gain)
      gain.connect(this.master)
    }
    return gain
  }

  gun(type = 'm416', volume = 1, distance = 0, pan = 0) {
    if (!this.ctx || !this.enabled) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const profile = {
      p92: { dur: 0.14, freq: 1600, thump: 140, gain: 0.55, tail: 0.1 },
      ump45: { dur: 0.16, freq: 1300, thump: 120, gain: 0.6, tail: 0.12 },
      m416: { dur: 0.19, freq: 1050, thump: 95, gain: 0.7, tail: 0.16 },
      s686: { dur: 0.34, freq: 620, thump: 65, gain: 1.0, tail: 0.28 },
      kar98: { dur: 0.5, freq: 520, thump: 52, gain: 1.05, tail: 0.45 }
    }[type] || { dur: 0.2, freq: 900, thump: 90, gain: 0.7, tail: 0.15 }
    const distGain = distance > 0 ? Math.max(0.025, 1 - distance / 210) : 1
    const vol = Math.max(0, Math.min(1.4, volume * profile.gain * distGain))
    if (vol < 0.012) return
    if (distance > 0 && this.shotCount > 0 && now - this.lastBotShot < 0.035) return
    this.lastBotShot = now
    this.shotCount++

    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.9 + Math.random() * 0.2
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = profile.freq
    band.Q.value = 0.7
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 5200
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(vol, now + 0.004)
    env.gain.exponentialRampToValueAtTime(0.001, now + profile.dur)
    src.connect(band)
    band.connect(low)
    low.connect(env)
    const panner = this._pan(pan)
    if (panner) {
      env.connect(panner)
      panner.connect(this.master)
    } else env.connect(this.master)
    src.start(now)
    src.stop(now + profile.dur + 0.02)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(profile.thump, now)
    osc.frequency.exponentialRampToValueAtTime(profile.thump * 0.55, now + profile.dur * 0.7)
    const og = ctx.createGain()
    og.gain.setValueAtTime(vol * 0.8, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + profile.tail)
    osc.connect(og)
    const op = this._pan(pan)
    if (op) {
      og.connect(op)
      op.connect(this.master)
    } else og.connect(this.master)
    osc.start(now)
    osc.stop(now + profile.tail + 0.02)
  }

  click(freq = 900, dur = 0.04, volume = 0.15) {
    if (!this.ctx || !this.enabled) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(volume, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(now)
    osc.stop(now + dur + 0.01)
  }

  reloadStart() {
    this.click(320, 0.06, 0.18)
    this.click(210, 0.05, 0.12)
  }

  reloadEnd() {
    this.click(680, 0.05, 0.2)
    setTimeout(() => this.click(430, 0.05, 0.15), 55)
  }

  dryFire() {
    this.click(1100, 0.03, 0.12)
  }

  hit(headshot = false) {
    this.click(headshot ? 1900 : 1400, 0.035, headshot ? 0.16 : 0.12)
  }

  kill() {
    this.click(720, 0.09, 0.14)
    setTimeout(() => this.click(1080, 0.12, 0.12), 55)
  }

  hurt() {
    if (!this.ctx || !this.enabled) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.4, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(now)
    src.stop(now + 0.22)
  }

  pickup() {
    this.click(880, 0.06, 0.1)
    setTimeout(() => this.click(1320, 0.09, 0.1), 60)
  }

  build() {
    this.click(190, 0.12, 0.2)
    setTimeout(() => this.click(120, 0.1, 0.12), 70)
  }

  destroy() {
    if (!this.ctx || !this.enabled) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 420
    filter.Q.value = 0.5
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.4, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(now)
    src.stop(now + 0.36)
  }

  chop() {
    this.click(240, 0.06, 0.2)
    this.click(160, 0.1, 0.15)
  }

  heal() {
    this.click(620, 0.2, 0.07)
    setTimeout(() => this.click(780, 0.25, 0.06), 150)
  }

  footstep(volume = 0.09) {
    if (!this.ctx || !this.enabled) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.7 + Math.random() * 0.4
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(volume, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(now)
    src.stop(now + 0.1)
  }

  zone(on) {
    if (!this.zoneHum || !this.ctx) return
    this.zoneHum.gain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.6)
  }

  update(dt, outside, danger) {
    if (!this.ctx || !this.zoneHum) return
    const target = outside ? 0.06 : 0
    this.zoneHum.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35)
    this.zoneHum.osc.frequency.setTargetAtTime(38 + danger * 14, this.ctx.currentTime, 0.4)
  }
}

import * as THREE from 'three'
import { ZONE_PHASES, ZONE_START_RADIUS } from './config.js'
import { clamp, lerp, formatTime } from './utils.js'

export class Zone {
  constructor(scene, audio) {
    this.scene = scene
    this.audio = audio
    this.active = false
    this.center = { x: 0, z: 0 }
    this.fromCenter = { x: 0, z: 0 }
    this.targetCenter = { x: 0, z: 0 }
    this.radius = ZONE_START_RADIUS
    this.fromRadius = ZONE_START_RADIUS
    this.targetRadius = ZONE_START_RADIUS
    this.phaseIndex = 0
    this.state = 'wait'
    this.timer = ZONE_PHASES[0].wait
    this.duration = 0
    this.dps = ZONE_PHASES[0].dps
    this.final = false
    this.time = 0
    this._buildMesh()
    this._buildInner()
  }

  _buildMesh() {
    const uniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.5 },
      uDanger: { value: 0 }
    }
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true)
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uOpacity;
        uniform float uDanger;
        varying vec2 vUv;
        varying vec3 vWorld;

        void main() {
          float stripes = smoothstep(0.955, 1.0, fract(vUv.x * 130.0));
          float bands = smoothstep(0.92, 1.0, fract(vUv.y * 18.0 - uTime * 0.6));
          float verticalFade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
          float topGlow = smoothstep(0.94, 1.0, vUv.y) * 0.35;
          vec3 base = mix(vec3(0.12, 0.45, 0.95), vec3(0.55, 0.9, 1.0), uDanger);
          vec3 col = mix(base, vec3(0.72, 0.95, 1.0), stripes * 0.8 + bands * 0.4);
          float alpha = (0.055 + stripes * 0.105 + bands * 0.03 + topGlow) * uOpacity * verticalFade * 1.5;
          gl_FragColor = vec4(col, alpha);
        }
      `
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.visible = false
    this.scene.add(this.mesh)
    this.uniforms = uniforms
    this.material = mat
  }

  _buildInner() {
    // Faint inner shell gives the wall depth when you are close.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4fa8ff,
      transparent: true,
      opacity: 0.028,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.inner = new THREE.Mesh(geo, mat)
    this.inner.frustumCulled = false
    this.inner.visible = false
    this.inner.renderOrder = 1
    this.scene.add(this.inner)
  }

  reset() {
    this.phaseIndex = 0
    this.state = 'wait'
    this.timer = ZONE_PHASES[0].wait
    this.duration = 0
    this.radius = ZONE_START_RADIUS
    this.fromRadius = this.radius
    this.targetRadius = this.radius
    this.center = { x: 0, z: 0 }
    this.fromCenter = { ...this.center }
    this.targetCenter = { ...this.center }
    this.dps = ZONE_PHASES[0].dps
    this.final = false
    this.active = false
    this.time = 0
    this._sync(0)
  }

  start() {
    this.active = true
    this.mesh.visible = true
    this.inner.visible = true
    this.audio?.zone(false)
  }

  startShrink() {
    const phase = ZONE_PHASES[this.phaseIndex]
    this.fromRadius = this.radius
    this.targetRadius = phase.radius
    this.fromCenter = { ...this.center }
    const maxOffset = Math.max(0, this.radius - phase.radius) * 0.62
    const a = Math.random() * Math.PI * 2
    const dist = Math.sqrt(Math.random()) * maxOffset
    this.targetCenter = {
      x: this.center.x + Math.cos(a) * dist,
      z: this.center.z + Math.sin(a) * dist
    }
    this.state = 'shrink'
    this.duration = phase.shrink
    this.timer = phase.shrink
    this.dps = phase.dps
    this.audio?.zone(true)
  }

  update(dt) {
    if (!this.active) return
    this.time += dt
    this.uniforms.uTime.value = this.time
    if (this.timer !== Infinity) this.timer -= dt
    if (this.state === 'wait' && this.timer <= 0) {
      this.startShrink()
    } else if (this.state === 'shrink') {
      const t = clamp(1 - this.timer / this.duration, 0, 1)
      this.radius = lerp(this.fromRadius, this.targetRadius, t)
      this.center.x = lerp(this.fromCenter.x, this.targetCenter.x, t)
      this.center.z = lerp(this.fromCenter.z, this.targetCenter.z, t)
      if (this.timer <= 0) {
        this.radius = this.targetRadius
        this.center = { ...this.targetCenter }
        this.phaseIndex++
        if (this.phaseIndex >= ZONE_PHASES.length) {
          this.state = 'final'
          this.final = true
          this.timer = Infinity
          this.dps = ZONE_PHASES[ZONE_PHASES.length - 1].dps
        } else {
          this.state = 'wait'
          this.timer = ZONE_PHASES[this.phaseIndex].wait
          this.dps = ZONE_PHASES[this.phaseIndex].dps
        }
      }
    }
    this._sync(dt)
  }

  _sync(dt) {
    const h = 140
    this.mesh.position.set(this.center.x, h / 2, this.center.z)
    this.mesh.scale.set(this.radius, h, this.radius)
    this.inner.position.set(this.center.x, h / 2, this.center.z)
    this.inner.scale.set(this.radius * 0.997, h, this.radius * 0.997)
    const danger = clamp(this.phaseIndex / (ZONE_PHASES.length - 1), 0, 1)
    this.uniforms.uDanger.value = danger
    this.uniforms.uOpacity.value = 0.55 + danger * 0.35
    this.inner.material.opacity = 0.02 + danger * 0.02
  }

  outside(x, z) {
    const dx = x - this.center.x
    const dz = z - this.center.z
    return dx * dx + dz * dz > this.radius * this.radius
  }

  distanceInside(x, z) {
    return this.radius - Math.hypot(x - this.center.x, z - this.center.z)
  }

  damagePerSecond() {
    return this.dps
  }

  get phaseLabel() {
    if (this.final) return 'FINAL ZONE'
    if (this.state === 'shrink') return 'ZONE CLOSING'
    return 'ZONE CLOSING SOON'
  }

  get countdown() {
    if (this.final) return 'FINAL'
    return formatTime(Math.max(0, this.timer))
  }

  get nextRadius() {
    if (this.final) return this.radius
    if (this.state === 'shrink') return this.targetRadius
    return ZONE_PHASES[this.phaseIndex]?.radius ?? this.radius
  }

  get nextCenter() {
    if (this.final) return this.center
    if (this.state === 'shrink') return this.targetCenter
    return this.center
  }

  get danger() {
    return clamp(this.phaseIndex / (ZONE_PHASES.length - 1), 0, 1)
  }
}

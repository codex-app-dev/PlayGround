import * as THREE from 'three';
import { clamp } from './track.js';

const MAX_PARTICLES = 1600;

const vert = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (340.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */`
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - .5;
    float d = length(p) * 2.0;
    float a = smoothstep(1.0, .08, d);
    gl_FragColor = vec4(vColor, vAlpha * a);
  }
`;

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.time = 0;
    this.shakeAmount = 0;
    this.settings = { shake: true };

    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.size = new Float32Array(MAX_PARTICLES);
    this.alpha = new Float32Array(MAX_PARTICLES);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.drag = new Float32Array(MAX_PARTICLES);
    this.gravity = new Float32Array(MAX_PARTICLES);
    this.baseSize = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;

    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    // billboard shockwave rings
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(.74, 1, 40);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, depthWrite: false, toneMapped: false
      }));
      m.visible = false;
      m.userData = { life: 0, maxLife: 1, scale: 1 };
      scene.add(m);
      this.rings.push(m);
    }

    // muzzle flashes / engine glow sprites
    this.flashes = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeFlashTexture(), color: '#b7f9ff', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false
      }));
      s.visible = false;
      s.userData = { life: 0, maxLife: .12, scale: 1 };
      scene.add(s);
      this.flashes.push(s);
    }

    this.tmpColor = new THREE.Color();
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
    this.shakeAmount = 0;
    for (const r of this.rings) r.visible = false;
    for (const f of this.flashes) f.visible = false;
    const attrs = this.points.geometry.attributes;
    attrs.aAlpha.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, drag = 1.2, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.tmpColor.set(color);
    this.col[i * 3] = this.tmpColor.r; this.col[i * 3 + 1] = this.tmpColor.g; this.col[i * 3 + 2] = this.tmpColor.b;
    this.size[i] = size;
    this.baseSize[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.drag[i] = drag;
    this.gravity[i] = gravity;
  }

  burst(pos, color, count = 22, speed = 22, size = .55, life = .7, opts = {}) {
    const up = opts.up || 0;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = speed * (.3 + Math.random() * .9);
      const sx = Math.sin(phi) * Math.cos(theta) * sp;
      const sy = Math.cos(phi) * sp + up;
      const sz = Math.sin(phi) * Math.sin(theta) * sp;
      this.spawn(
        pos.x + (Math.random() - .5) * .8,
        pos.y + (Math.random() - .5) * .8,
        pos.z + (Math.random() - .5) * .8,
        sx, sy, sz, color, size * (.5 + Math.random() * 1.2),
        life * (.55 + Math.random() * .8), opts.drag ?? 1.8, opts.gravity ?? 0
      );
    }
  }

  ring(pos, color, scale = 8, life = .55) {
    const ring = this.rings.find(r => !r.visible);
    if (!ring) return;
    ring.visible = true;
    ring.position.copy(pos);
    ring.material.color.set(color);
    ring.material.opacity = .85;
    ring.userData.life = life;
    ring.userData.maxLife = life;
    ring.userData.scale = scale;
    ring.scale.setScalar(.3);
    ring.lookAt(this.camera.position);
  }

  flash(pos, color, scale = 3, life = .1) {
    const s = this.flashes.find(f => !f.visible);
    if (!s) return;
    s.visible = true;
    s.position.copy(pos);
    s.material.color.set(color);
    s.material.opacity = 1;
    s.scale.setScalar(scale);
    s.userData.life = life;
    s.userData.maxLife = life;
    s.userData.scale = scale;
  }

  trail(pos, color, dirx, diry, dirz, spread = 1, size = .36) {
    this.spawn(
      pos.x + (Math.random() - .5) * .3,
      pos.y + (Math.random() - .5) * .3,
      pos.z + (Math.random() - .5) * .3,
      dirx + (Math.random() - .5) * spread,
      diry + (Math.random() - .5) * spread,
      dirz + (Math.random() - .5) * spread,
      color, size * (.7 + Math.random() * .7), .26 + Math.random() * .22, 1.3
    );
  }

  shake(amount) {
    this.shakeAmount = Math.min(1.35, this.shakeAmount + amount);
  }

  shakeOffset() {
    if (!this.settings.shake || this.shakeAmount < .002) return { x: 0, y: 0, z: 0 };
    const a = this.shakeAmount;
    return {
      x: (Math.random() - .5) * a * 1.1,
      y: (Math.random() - .5) * a * .9,
      z: (Math.random() - .5) * a * .4
    };
  }

  update(dt) {
    this.time += dt;
    this.shakeAmount *= Math.exp(-5.2 * dt);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.pow(1 - t, 1.6);
      this.size[i] = this.baseSize[i] * (1 + t * 1.25);
    }
    const attrs = this.points.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.aColor.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
    attrs.aAlpha.needsUpdate = true;

    for (const ring of this.rings) {
      if (!ring.visible) continue;
      ring.userData.life -= dt;
      if (ring.userData.life <= 0) { ring.visible = false; continue; }
      const t = 1 - ring.userData.life / ring.userData.maxLife;
      ring.scale.setScalar(.3 + t * ring.userData.scale);
      ring.material.opacity = Math.pow(1 - t, 1.4) * .9;
      ring.lookAt(this.camera.position);
    }
    for (const f of this.flashes) {
      if (!f.visible) continue;
      f.userData.life -= dt;
      if (f.userData.life <= 0) { f.visible = false; continue; }
      const t = f.userData.life / f.userData.maxLife;
      f.material.opacity = t;
      f.scale.setScalar(f.userData.scale * (1.5 - t * .5));
    }
  }
}

function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.25, 'rgba(255,255,255,.8)');
  grad.addColorStop(.6, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

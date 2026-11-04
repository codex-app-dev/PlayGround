import * as THREE from 'three';

const MAX = 1600;

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,.24)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export class Effects {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.map = glowTexture();

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.alphas = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry = geo;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        uPixelRatio: { value: Math.min(2, renderer.getPixelRatio()) },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (145.0 / max(0.5, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);

    this.pool = [];
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, gravity: 0, drag: 0,
        r: 1, g: 1, b: 1, fade: 1, bounce: false,
      });
    }
    this.cursor = 0;
    this.live = 0;

    this.rings = [];
    this.ringPool = [];
    this._ringGeo = new THREE.RingGeometry(0.82, 1, 64);
    this._emitters = new WeakMap();
    this._ballTrailAcc = 0;
  }

  _spawn(x, y, z, vx, vy, vz, color, size, life, opts = {}) {
    let p = null;
    for (let i = 0; i < MAX; i++) {
      const cand = this.pool[(this.cursor + i) % MAX];
      if (!cand.active) { p = cand; this.cursor = (this.cursor + i + 1) % MAX; break; }
    }
    if (!p) return null;
    p.active = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = p.maxLife = life;
    p.size = size;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0.6;
    p.fade = opts.fade ?? 1;
    p.bounce = opts.bounce ?? false;
    p.r = color.r; p.g = color.g; p.b = color.b;
    return p;
  }

  burst(pos, colorHex, count = 24, power = 12, size = 1.2, life = 0.8, gravity = 18) {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      const speed = power * (0.25 + Math.random() * 0.9);
      this._spawn(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + (Math.random() - 0.5) * 0.6,
        pos.z + (Math.random() - 0.5) * 0.6,
        Math.cos(a) * s * speed,
        u * speed + power * 0.25,
        Math.sin(a) * s * speed,
        color, size * (0.5 + Math.random() * 0.9), life * (0.5 + Math.random() * 0.8),
        { gravity, drag: 1.1, fade: 1 }
      );
    }
  }

  hit(pos, colorHex, strength = 1) {
    const color = new THREE.Color(colorHex);
    const count = Math.round(6 + Math.min(26, strength * 9));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8;
      const speed = 4 + Math.random() * 16 * Math.min(2, strength);
      this._spawn(
        pos.x, pos.y, pos.z,
        Math.cos(a) * speed, up * speed * 0.6, Math.sin(a) * speed,
        color, 0.35 + Math.random() * 0.9, 0.3 + Math.random() * 0.55,
        { gravity: 10, drag: 1.8 }
      );
    }
  }

  boostEmitter(car, colorHex, dt) {
    if (!car || car.isMenu) return;
    let acc = this._emitters.get(car) || 0;
    acc += dt * 90;
    const color = new THREE.Color(colorHex);
    const forward = car.forward;
    const base = car.position;
    while (acc >= 1) {
      acc -= 1;
      for (const sz of [-0.52, 0.52]) {
        const off = new THREE.Vector3(-2.02, 0.02, sz).applyQuaternion(car.quaternion);
        const spread = 2.8;
        this._spawn(
          base.x + off.x, base.y + off.y, base.z + off.z,
          -forward.x * (17 + Math.random() * 10) + (Math.random() - 0.5) * spread,
          -forward.y * (17 + Math.random() * 10) + (Math.random() - 0.5) * spread + 1,
          -forward.z * (17 + Math.random() * 10) + (Math.random() - 0.5) * spread,
          Math.random() < 0.35 ? new THREE.Color(0xffffff) : color,
          0.32 + Math.random() * 0.5,
          0.22 + Math.random() * 0.2,
          { gravity: -2, drag: 2.6, fade: 1 }
        );
      }
    }
    this._emitters.set(car, acc);
  }

  ballTrail(ball, dt, colorHex = 0x74e4ff) {
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z);
    if (speed < 16) return;
    this._ballTrailAcc += dt * Math.min(52, speed * 1.2);
    const color = new THREE.Color(colorHex);
    while (this._ballTrailAcc >= 1) {
      this._ballTrailAcc -= 1;
      this._spawn(
        ball.position.x + (Math.random() - 0.5) * 1.6,
        ball.position.y + (Math.random() - 0.5) * 1.6,
        ball.position.z + (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        color, 0.6 + Math.random() * 0.75, 0.28 + Math.random() * 0.36,
        { gravity: 0, drag: 1.2, fade: 1 }
      );
    }
  }

  goalExplosion(pos, colorHex) {
    const color = new THREE.Color(colorHex);
    // core flash
    for (let i = 0; i < 170; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const speed = 10 + Math.random() * 52;
      this._spawn(
        pos.x, pos.y, pos.z,
        Math.cos(a) * Math.sin(b) * speed,
        Math.cos(b) * speed * 0.7 + 6,
        Math.sin(a) * Math.sin(b) * speed,
        Math.random() < 0.22 ? new THREE.Color(0xffffff) : color,
        0.5 + Math.random() * 1.6, 0.7 + Math.random() * 1.3,
        { gravity: 12, drag: 1.15, fade: 1, bounce: true }
      );
    }
    // confetti from the ceiling
    for (let i = 0; i < 160; i++) {
      const c = Math.random() < 0.5 ? color : new THREE.Color(Math.random() < 0.5 ? 0x22c8ff : 0xff7a18);
      const x = (Math.random() - 0.5) * 92;
      const z = (Math.random() - 0.5) * 64;
      this._spawn(
        x, 24 + Math.random() * 5, z,
        (Math.random() - 0.5) * 6,
        -2 - Math.random() * 5,
        (Math.random() - 0.5) * 6,
        c, 0.45 + Math.random() * 0.5, 2.4 + Math.random() * 2.2,
        { gravity: 8, drag: 0.4, fade: 0.8 }
      );
    }
    this.ring(pos, colorHex, 1.2, 40, 0.9);
    this.ring(pos, 0xffffff, 0.6, 56, 0.7);
  }

  ring(pos, colorHex, start = 1, max = 30, life = 1) {
    const color = new THREE.Color(colorHex);
    let obj = this.ringPool.find(r => !r.active);
    if (!obj) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      const mesh = new THREE.Mesh(this._ringGeo, mat);
      mesh.renderOrder = 7;
      this.scene.add(mesh);
      obj = { mesh, active: false };
      this.ringPool.push(obj);
    }
    obj.active = true;
    obj.life = obj.maxLife = life;
    obj.start = start; obj.max = max;
    obj.mesh.position.copy(pos);
    obj.mesh.quaternion.copy(new THREE.Quaternion());
    obj.mesh.scale.setScalar(start);
    obj.mesh.material.color.copy(color).multiplyScalar(1.7);
    obj.mesh.material.opacity = 0.85;
    obj.mesh.visible = true;
    return obj;
  }

  update(dt) {
    const pos = this.positions, col = this.colors, siz = this.sizes, alp = this.alphas;
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.active) { alp[i] = 0; continue; }
      p.life -= dt;
      if (p.life <= 0) { p.active = false; alp[i] = 0; continue; }
      live++;
      p.vy += p.gravity * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce && p.y < 0.18) {
        p.y = 0.18;
        p.vy = Math.abs(p.vy) * 0.35;
        p.vx *= 0.8; p.vz *= 0.8;
      }
      const t = p.life / p.maxLife;
      alp[i] = Math.min(1, t * 2.2) * p.fade;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r; col[i * 3 + 1] = p.g; col[i * 3 + 2] = p.b;
      siz[i] = p.size * (0.65 + t * 0.55);
    }
    this.live = live;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;

    for (const r of this.ringPool) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) { r.active = false; r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.maxLife;
      const s = r.start + (r.max - r.start) * (1 - Math.pow(1 - t, 3));
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - t) * 0.85;
      r.mesh.quaternion.copy(this._ringCameraQuat || new THREE.Quaternion());
    }
  }

  setCameraQuat(q) { this._ringCameraQuat = q; }

  reset() {
    for (const p of this.pool) p.active = false;
    this.alphas.fill(0);
    this.geometry.attributes.aAlpha.needsUpdate = true;
    for (const r of this.ringPool) { r.active = false; r.mesh.visible = false; }
  }
}

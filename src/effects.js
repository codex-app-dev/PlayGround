import * as THREE from 'three';
import { mulberry32 } from './utils.js';

export class Particles {
  constructor(scene, count = 1600) {
    this.scene = scene;
    this.count = count;
    this.cursor = 0;
    this.rng = mulberry32(555);
    this.particles = new Array(count);

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.setDrawRange(0, count);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (280.0 / max(2.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.08, d) * vAlpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.scene.add(this.points);

    for (let i = 0; i < count; i++) {
      this.particles[i] = {
        alive: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        size: 1, gravity: 0, drag: 0,
        r: 1, g: 1, b: 1,
      };
      this.sizes[i] = 0;
      this.alphas[i] = 0;
    }
  }

  spawn(x, y, z, opts = {}) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.count;
    const color = opts.color ?? 0xffffff;
    const c = new THREE.Color(color);
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vz = opts.vz ?? 0;
    p.life = opts.life ?? 1;
    p.maxLife = p.life;
    p.size = opts.size ?? 1;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0.98;
    p.r = c.r;
    p.g = c.g;
    p.b = c.b;
    return p;
  }

  burst(position, opts = {}) {
    const {
      count = 18,
      color = 0xffffff,
      colors = null,
      speed = 6,
      spread = 1,
      life = 0.8,
      size = 1,
      gravity = -7,
      drag = 0.95,
      direction = null,
      up = 1,
    } = opts;
    for (let i = 0; i < count; i++) {
      const theta = this.rng() * Math.PI * 2;
      const phi = Math.acos(this.rng() * 2 - 1);
      let vx = Math.sin(phi) * Math.cos(theta) * speed;
      let vy = Math.cos(phi) * speed * up;
      let vz = Math.sin(phi) * Math.sin(theta) * speed;
      if (direction) {
        vx += direction.x * speed * 0.4;
        vy += direction.y * speed * 0.4;
        vz += direction.z * speed * 0.4;
      }
      const chosen = colors ? colors[Math.floor(this.rng() * colors.length)] : color;
      this.spawn(
        position.x + (this.rng() - 0.5) * spread,
        position.y + (this.rng() - 0.5) * spread,
        position.z + (this.rng() - 0.5) * spread,
        {
          vx,
          vy,
          vz,
          color: chosen,
          life: life * (0.7 + this.rng() * 0.6),
          size: size * (0.7 + this.rng() * 0.8),
          gravity,
          drag,
        }
      );
    }
  }

  spark(position, color, direction, count = 1) {
    for (let i = 0; i < count; i++) {
      this.spawn(
        position.x + (this.rng() - 0.5) * 0.4,
        position.y + (this.rng() - 0.5) * 0.25,
        position.z + (this.rng() - 0.5) * 0.4,
        {
          vx: (this.rng() - 0.5) * 4 - direction.x * 3,
          vy: (this.rng() - 0.5) * 3 + 1.5,
          vz: (this.rng() - 0.5) * 4 - direction.z * 3,
          color,
          life: 0.28 + this.rng() * 0.3,
          size: 0.5 + this.rng() * 0.5,
          gravity: -9,
          drag: 0.92,
        }
      );
    }
  }

  trail(position, color, direction, count = 1, size = 0.8) {
    for (let i = 0; i < count; i++) {
      this.spawn(
        position.x + (this.rng() - 0.5) * 0.7,
        position.y + (this.rng() - 0.5) * 0.4,
        position.z + (this.rng() - 0.5) * 0.7,
        {
          vx: -direction.x * (3 + this.rng() * 4) + (this.rng() - 0.5) * 1.5,
          vy: -direction.y * 2 + (this.rng() - 0.5) * 1.5 + 0.8,
          vz: -direction.z * (3 + this.rng() * 4) + (this.rng() - 0.5) * 1.5,
          color,
          life: 0.28 + this.rng() * 0.35,
          size: size * (0.7 + this.rng() * 0.8),
          gravity: -2,
          drag: 0.94,
        }
      );
    }
  }

  update(dt) {
    const pos = this.positions;
    const col = this.colors;
    const sizes = this.sizes;
    const alphas = this.alphas;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        alphas[i] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        alphas[i] = 0;
        continue;
      }
      p.vy += p.gravity * dt;
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = p.life / p.maxLife;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r;
      col[i * 3 + 1] = p.g;
      col[i * 3 + 2] = p.b;
      sizes[i] = p.size * (0.5 + t * 0.7);
      alphas[i] = Math.min(1, t * 2.5) * 0.9;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }

  setPixelRatio(ratio) {
    this.points.material.uniforms.uPixelRatio.value = ratio;
  }
}

import * as THREE from 'three';

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.44, 'rgba(255,255,255,0.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const _color = new THREE.Color();
const _dir = new THREE.Vector3();
const _pos = new THREE.Vector3();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.texture = makeGlowTexture();
    this.particles = [];
    this.particleIndex = 0;

    for (let i = 0; i < 170; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.texture, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.particles.push({
        sprite, life: 0, maxLife: 1, velocity: new THREE.Vector3(),
        gravity: 0, startSize: 1, endSize: 0, drag: 0.98,
      });
    }

    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const geometry = new THREE.RingGeometry(0.82, 1, 48);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 1, start: 1, end: 10, vertical: false });
    }

    this.flashes = [];
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 30, 1.7);
      light.visible = false;
      scene.add(light);
      this.flashes.push({ light, life: 0, maxLife: 0.25, intensity: 0 });
    }
    this.time = 0;
  }

  particle(position, opts = {}) {
    const p = this.particles[this.particleIndex];
    this.particleIndex = (this.particleIndex + 1) % this.particles.length;
    const {
      color = 0xffffff, size = 1, endSize = 0, life = 0.7,
      speed = 3, direction = null, spread = 1, gravity = 0, drag = 0.97,
    } = opts;
    p.sprite.visible = true;
    p.sprite.position.copy(position);
    _color.set(color);
    p.sprite.material.color.copy(_color);
    p.sprite.material.opacity = 1;
    p.startSize = size;
    p.endSize = endSize;
    p.sprite.scale.set(size, size, 1);
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    p.drag = drag;
    if (direction) {
      _dir.copy(direction).normalize();
      _dir.x += (Math.random() - 0.5) * spread;
      _dir.y += (Math.random() - 0.5) * spread;
      _dir.z += (Math.random() - 0.5) * spread;
      _dir.normalize();
      p.velocity.copy(_dir).multiplyScalar(speed);
    } else {
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed
      );
    }
  }

  explosion(position, color = 0xffa34d, power = 1) {
    const count = Math.round(16 + power * 10);
    for (let i = 0; i < count; i++) {
      this.particle(position, {
        color: i % 3 === 0 ? 0xffffff : color,
        size: (0.5 + Math.random() * 1.1) * power,
        endSize: 0.02,
        life: 0.45 + Math.random() * 0.7,
        speed: (5 + Math.random() * 10) * power,
        gravity: -2.5,
        drag: 0.94,
      });
    }
    for (let i = 0; i < 8; i++) {
      this.particle(position, {
        color: 0x8b94a5, size: 1.6 * power, endSize: 2.8 * power,
        life: 0.9 + Math.random() * 0.7, speed: 1.6, gravity: 0.4, drag: 0.96,
      });
    }
    this.ring(position, color, { start: 1.5, end: 11 * power, life: 0.55 });
    this.ring(position, 0xffffff, { start: 0.5, end: 4 * power, life: 0.28, vertical: true });
    this.flash(position, color, 90 * power, 0.26);
  }

  ring(position, color, opts = {}) {
    const ring = this.rings.find(r => r.life <= 0) || this.rings[0];
    const { start = 1, end = 8, life = 0.5, vertical = false } = opts;
    ring.mesh.visible = true;
    ring.mesh.position.copy(position);
    _color.set(color);
    ring.mesh.material.color.copy(_color);
    ring.mesh.material.opacity = 0.9;
    ring.mesh.rotation.set(vertical ? 0 : -Math.PI / 2, vertical ? 0 : 0, 0);
    if (vertical) {
      ring.mesh.rotation.y = Math.random() * Math.PI;
    }
    ring.start = start;
    ring.end = end;
    ring.life = life;
    ring.maxLife = life;
    ring.vertical = vertical;
    ring.mesh.scale.setScalar(start);
  }

  flash(position, color, intensity, life = 0.2) {
    const item = this.flashes.find(f => f.life <= 0) || this.flashes[0];
    item.light.visible = true;
    item.light.position.copy(position);
    item.light.color.set(color);
    item.light.intensity = intensity;
    item.intensity = intensity;
    item.life = life;
    item.maxLife = life;
  }

  jet(position, color = 0x53d9ff) {
    for (let i = 0; i < 2; i++) {
      this.particle(position, {
        color: i === 0 ? 0xffffff : color,
        size: 0.45 + Math.random() * 0.5,
        endSize: 0.04,
        life: 0.22 + Math.random() * 0.22,
        speed: 2.4, direction: new THREE.Vector3((Math.random() - 0.5) * 0.7, -1, (Math.random() - 0.5) * 0.7),
        spread: 0.6, gravity: -3, drag: 0.9,
      });
    }
  }

  ski(position, color = 0xbdf6ff, speed = 1) {
    if (Math.random() > 0.72) return;
    this.particle(position, {
      color: Math.random() > 0.4 ? color : 0xffffff,
      size: 0.18 + Math.random() * 0.2,
      endSize: 0.02,
      life: 0.25 + Math.random() * 0.25,
      speed: 1.2 + speed * 0.08,
      direction: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 1.2),
      gravity: -4,
      drag: 0.93,
    });
  }

  dust(position, color = 0xcdbfa4, amount = 6) {
    for (let i = 0; i < amount; i++) {
      this.particle(position, {
        color, size: 0.7 + Math.random() * 0.8, endSize: 1.6,
        life: 0.5 + Math.random() * 0.5, speed: 2.2, gravity: -0.6, drag: 0.93,
      });
    }
  }

  sparks(position, color = 0xffd17a, amount = 10) {
    for (let i = 0; i < amount; i++) {
      this.particle(position, {
        color: Math.random() > 0.3 ? color : 0xffffff,
        size: 0.16 + Math.random() * 0.28, endSize: 0.02,
        life: 0.25 + Math.random() * 0.35,
        speed: 4 + Math.random() * 7, gravity: -9, drag: 0.97,
      });
    }
  }

  deathBurst(position, color) {
    this.explosion(position, color, 1.1);
    for (let i = 0; i < 14; i++) {
      this.particle(position, {
        color: Math.random() > 0.5 ? color : 0xffffff,
        size: 0.3, endSize: 0.02, life: 0.6 + Math.random() * 0.6,
        speed: 3 + Math.random() * 9, gravity: -6, drag: 0.96,
      });
    }
  }

  trail(position, color) {
    this.particle(position, {
      color, size: 0.38, endSize: 0.02, life: 0.18,
      speed: 0.4, gravity: 0, drag: 0.9,
    });
  }

  update(dt) {
    this.time += dt;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.velocity.y += p.gravity * dt;
      p.velocity.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.sprite.position.addScaledVector(p.velocity, dt);
      const size = THREE.MathUtils.lerp(p.startSize, p.endSize, t);
      p.sprite.scale.set(size, size, 1);
      p.sprite.material.opacity = Math.pow(1 - t, 1.35);
    }

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const scale = THREE.MathUtils.lerp(r.start, r.end, 1 - Math.pow(1 - t, 2));
      r.mesh.scale.setScalar(scale);
      r.mesh.material.opacity = (1 - t) * 0.85;
      if (r.vertical) {
        r.mesh.rotation.z += dt * 1.1;
      }
    }

    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.light.visible = false;
        continue;
      }
      f.light.intensity = f.intensity * (f.life / f.maxLife);
    }
  }
}

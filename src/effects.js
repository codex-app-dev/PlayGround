import * as THREE from 'three';

const PARTICLE_GEO = new THREE.SphereGeometry(0.055, 4, 3);
const MATS = {
  dust: new THREE.MeshBasicMaterial({ color: 0xc2ac83 }),
  blood: new THREE.MeshBasicMaterial({ color: 0x9f2721 }),
  spark: new THREE.MeshBasicMaterial({ color: 0xffc45f, blending: THREE.AdditiveBlending, transparent: true }),
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.tracerPool = [];
    for (let i = 0; i < 30; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xffc76a, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracerPool.push({ line, material, life: 0, maxLife: 0.1 });
    }
    for (let i = 0; i < 110; i++) {
      const mesh = new THREE.Mesh(PARTICLE_GEO, MATS.dust);
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({
        mesh, life: 0, maxLife: 0.4, vel: new THREE.Vector3(), scale: 1, gravity: -6,
      });
    }
  }

  tracer(start, end, color = 0xffc76a, strength = 0.8) {
    let slot = this.tracerPool.find(t => t.life <= 0);
    if (!slot) slot = this.tracerPool[0];
    const p = slot.line.geometry.attributes.position;
    p.setXYZ(0, start.x, start.y, start.z);
    p.setXYZ(1, end.x, end.y, end.z);
    p.needsUpdate = true;
    slot.material.color.setHex(color);
    slot.material.opacity = 0.85 * strength;
    slot.life = 0.075;
    slot.maxLife = 0.075;
    slot.line.visible = true;
    return slot;
  }

  particle(position, mat, speed, life, scale, gravity = -6) {
    let slot = this.particles.find(p => p.life <= 0);
    if (!slot) return;
    slot.mesh.material = mat;
    slot.mesh.visible = true;
    slot.mesh.position.copy(position);
    slot.mesh.scale.setScalar(scale);
    slot.life = life;
    slot.maxLife = life;
    slot.scale = scale;
    slot.gravity = gravity;
    slot.vel.set(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 0.8 + speed * 0.15,
      (Math.random() - 0.5) * speed,
    );
  }

  impact(point, kind = 'static') {
    const sparkCount = kind === 'terrain' ? 2 : 4;
    for (let i = 0; i < sparkCount; i++) {
      this.particle(point, MATS.spark, 4.5, 0.2 + Math.random() * 0.2, 0.7 + Math.random() * 0.6, -9);
    }
    for (let i = 0; i < 2; i++) {
      this.particle(point, MATS.dust, 1.6, 0.35, 1.4 + Math.random(), -1.5);
    }
  }

  blood(point, head = false) {
    const count = head ? 7 : 4;
    for (let i = 0; i < count; i++) {
      this.particle(point, MATS.blood, 3.2, 0.24 + Math.random() * 0.18, (head ? 1.1 : 0.8) + Math.random() * 0.5, -8);
    }
  }

  dust(point) {
    const pos = new THREE.Vector3(point.x, point.y + 0.15, point.z);
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const p = pos.clone().add(new THREE.Vector3(Math.cos(angle) * 0.4, 0, Math.sin(angle) * 0.4));
      this.particle(p, MATS.dust, 2.4, 0.55 + Math.random() * 0.4, 1.3 + Math.random() * 1.4, -1.2);
    }
  }

  reset() {
    for (const t of this.tracerPool) {
      t.life = 0;
      t.line.visible = false;
    }
    for (const p of this.particles) {
      p.life = 0;
      p.mesh.visible = false;
    }
  }

  update(dt) {
    for (const t of this.tracerPool) {
      if (t.life > 0) {
        t.life -= dt;
        t.material.opacity = Math.max(0, (t.life / t.maxLife) * 0.85);
        if (t.life <= 0) t.line.visible = false;
      }
    }
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.scale * Math.max(0.05, p.life / p.maxLife));
      const ground = p.mesh.position.y;
      if (ground < -2) p.life = 0;
    }
  }
}

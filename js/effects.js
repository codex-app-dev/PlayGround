import * as THREE from '../vendor/three.module.js';
import { GEO, GLOW_TEX, M, C } from './materials.js';

const ARROW_MAT = M(0x8b6a3e);

export class Effects {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.projectiles = [];
    this.particles = [];
    this.rings = [];
    this.flashes = [];
  }

  projectile(source, target, kind, damage) {
    const g = new THREE.Group();
    const isMagic = kind === 'holy' || kind === 'shadow' || kind === 'lightning';
    if (isMagic) {
      const colors = { holy: 0xffd76a, shadow: 0x79ffb0, lightning: 0x8de8ff };
      const color = colors[kind] || 0xffffff;
      const orb = new THREE.Mesh(GEO.sphere, M(color, { emissive: color, emissiveIntensity: 2.4 }));
      orb.scale.setScalar(kind === 'shadow' ? 0.24 : 0.18);
      g.add(orb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(1.2, 1.2, 1);
      g.add(glow);
    } else if (kind === 'spear') {
      const shaft = new THREE.Mesh(GEO.cyl6, ARROW_MAT);
      shaft.scale.set(0.045, 1.25, 0.045);
      shaft.rotation.x = Math.PI / 2;
      g.add(shaft);
      const tip = new THREE.Mesh(GEO.cone4, M(C.steel));
      tip.scale.set(0.09, 0.25, 0.09);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.72;
      g.add(tip);
      const feather = new THREE.Mesh(GEO.box, M(0xc9b27a));
      feather.scale.set(0.16, 0.16, 0.22);
      feather.position.z = -0.6;
      g.add(feather);
    } else {
      const shaft = new THREE.Mesh(GEO.cyl6, ARROW_MAT);
      shaft.scale.set(0.026, 0.82, 0.026);
      shaft.rotation.x = Math.PI / 2;
      g.add(shaft);
      const tip = new THREE.Mesh(GEO.cone4, M(kind === 'bone' ? 0xdcd5bb : C.steel));
      tip.scale.set(0.055, 0.16, 0.055);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.48;
      g.add(tip);
      const feather = new THREE.Mesh(GEO.box, M(kind === 'bone' ? 0x9f9781 : 0xe4d7b1));
      feather.scale.set(0.1, 0.1, 0.16);
      feather.position.z = -0.38;
      g.add(feather);
    }
    const start = new THREE.Vector3(source.pos.x, source.barHeight ? source.barHeight * 0.55 : 1.2, source.pos.z);
    g.position.copy(start);
    this.scene.add(g);
    this.projectiles.push({
      mesh: g,
      source,
      target,
      damage,
      kind,
      t: 0,
      duration: kind === 'spear' ? 0.34 : isMagic ? 0.42 : 0.28,
      end: new THREE.Vector3(target.pos.x, 1.0, target.pos.z),
      height: isMagic ? 0.6 : 1.1,
    });
  }

  hit(target, color = 0xffd78a, power = 1) {
    this.burst(target.pos.x, target.barHeight ? target.barHeight * 0.55 : 1.0, target.pos.z, color, Math.round(5 * power), 2.2 * power);
  }

  heal(target, color = 0x78ffb4) {
    const x = target.pos.x, z = target.pos.z;
    const y = target.barHeight ? target.barHeight * 0.5 : 1;
    for (let i = 0; i < 6; i++) {
      const s = this.makeSprite(color, 0.35 + Math.random() * 0.3, 1.2);
      s.position.set(x + (Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 1.6, z + (Math.random() - 0.5) * 0.8);
      this.particles.push({ sprite: s, vx: (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), vz: 0, life: 0.9, maxLife: 0.9, grow: 0.3, fade: true, gravity: -0.2 });
    }
    this.ring(x, z, color, 1.3, 0.75, 0.5);
    this.burst(x, y, z, color, 5, 1.2);
  }

  burst(x, y, z, color = 0xffd78a, count = 6, power = 2) {
    for (let i = 0; i < count; i++) {
      const s = this.makeSprite(color, 0.18 + Math.random() * 0.22, 1.5);
      s.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const up = 0.8 + Math.random() * 1.8;
      this.particles.push({
        sprite: s,
        vx: Math.cos(a) * power * (0.4 + Math.random()),
        vy: up * power * 0.35,
        vz: Math.sin(a) * power * (0.4 + Math.random()),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        grow: 0.6,
        fade: true,
        gravity: -5,
      });
    }
  }

  dust(x, z, color = 0xb9a884, count = 8, radius = 1) {
    for (let i = 0; i < count; i++) {
      const s = this.makeSprite(color, 0.8 + Math.random() * 0.8, 0.8);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      s.position.set(x + Math.cos(a) * r, 0.25 + Math.random() * 0.4, z + Math.sin(a) * r);
      this.particles.push({
        sprite: s, vx: Math.cos(a) * 0.9, vy: 0.5 + Math.random() * 0.8, vz: Math.sin(a) * 0.9,
        life: 0.9 + Math.random() * 0.7, maxLife: 1.6, grow: 1.2, fade: true, gravity: -0.4,
      });
    }
  }

  ring(x, z, color = 0xffd27a, radius = 1.5, duration = 0.6, opacity = 0.8) {
    const geo = new THREE.RingGeometry(0.75, 1, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.12, z);
    mesh.scale.setScalar(radius * 0.25);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, duration, radius, opacity });
  }

  buildComplete(x, z, color = 0xffd27a) {
    this.ring(x, z, color, 4, 1.1, 0.9);
    this.dust(x, z, 0xcabf9e, 14, 1.6);
    this.burst(x, 1, z, color, 14, 2.4);
  }

  makeSprite(color, scale = 0.4, opacity = 1) {
    const mat = new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    this.scene.add(s);
    return s;
  }

  update(dt) {
    const game = this.game;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.target || p.target.dead) {
        p.mesh.removeFromParent();
        this.projectiles.splice(i, 1);
        continue;
      }
      p.t += dt;
      const end = p.target.pos;
      p.end.set(end.x, p.target.barHeight ? p.target.barHeight * 0.55 : 1, end.z);
      const t = Math.min(1, p.t / p.duration);
      const sx = p.mesh.position.x, sz = p.mesh.position.z;
      const x = p.mesh.position.x + (p.end.x - p.mesh.position.x) * Math.min(1, dt / Math.max(0.02, p.duration - p.t + dt));
      // Simpler: recompute from the stored start is not available, so lerp toward end.
      p.mesh.position.x += (p.end.x - p.mesh.position.x) * Math.min(1, dt * 14);
      p.mesh.position.z += (p.end.z - p.mesh.position.z) * Math.min(1, dt * 14);
      p.mesh.position.y = 1 + Math.sin(t * Math.PI) * p.height + (p.end.y - 1) * t;
      const lookTarget = new THREE.Vector3(p.end.x, p.end.y, p.end.z);
      if (p.kind !== 'holy' && p.kind !== 'shadow' && p.kind !== 'lightning') {
        p.mesh.lookAt(lookTarget);
      } else {
        p.mesh.rotation.y += dt * 8;
      }
      if (t >= 1 || Math.hypot(p.mesh.position.x - p.end.x, p.mesh.position.z - p.end.z) < 0.5) {
        if (p.target && !p.target.dead) game.dealDamage(p.source, p.target, p.damage, p.kind);
        const color = p.kind === 'holy' ? 0xffe08a : p.kind === 'shadow' ? 0x76ffb5 : p.kind === 'bone' ? 0xdcd5bb : 0xffd18a;
        this.burst(p.end.x, p.end.y, p.end.z, color, 4, 1.2);
        p.mesh.removeFromParent();
        this.projectiles.splice(i, 1);
      }
      // Keep memory sane if something stalls.
      if (p.t > 3) {
        p.mesh.removeFromParent();
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.material.dispose();
        p.sprite.removeFromParent();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity ?? 0) * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const k = 1 - p.life / p.maxLife;
      const s = p.sprite.scale.x * (1 + p.grow * dt);
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = (1 - k) * 0.95;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.duration);
      const s = r.radius * (0.2 + k * 1.1);
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = r.opacity * (1 - k);
      if (k >= 1) {
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        r.mesh.removeFromParent();
        this.rings.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.projectiles) p.mesh.removeFromParent();
    for (const p of this.particles) { p.sprite.material.dispose(); p.sprite.removeFromParent(); }
    for (const r of this.rings) { r.mesh.geometry.dispose(); r.mesh.material.dispose(); r.mesh.removeFromParent(); }
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
  }
}

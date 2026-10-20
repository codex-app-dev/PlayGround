import * as THREE from 'three';
import { TEAM_COLORS, terrainHeight } from './world.js';

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.46, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.projectiles = [];
    this.glow = makeGlowTexture();
    this.coreGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.discGeo = new THREE.TorusGeometry(0.45, 0.075, 6, 20);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.time = 0;
    this.callbacks = {};
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  spawn({ origin, velocity, team, owner, damage, splash }) {
    const color = team === 'blue' ? 0x6ef4ff : 0xff7a5a;
    const group = new THREE.Group();
    const core = new THREE.Mesh(this.coreGeo, this.coreMat);
    core.scale.setScalar(0.85);
    group.add(core);

    const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    disc.rotation.x = Math.PI / 2;
    group.add(disc);

    const ring = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(0.6);
    group.add(ring);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.setScalar(2.4);
    group.add(sprite);

    const light = new THREE.PointLight(color, 3.4, 9, 2);
    group.add(light);

    group.position.copy(origin);
    const dir = velocity.clone().normalize();
    group.lookAt(origin.clone().add(dir));
    this.scene.add(group);

    this.projectiles.push({
      group, core, disc, ring, sprite, light,
      velocity: velocity.clone(), team, owner,
      damage: damage ?? 100, splash: splash ?? 8,
      life: 6, position: origin.clone(), spinning: Math.random() * Math.PI * 2,
    });

    this.effects.particle(origin, {
      color, size: 1.1, endSize: 0.1, life: 0.25, speed: 1.2, gravity: 0,
    });
  }

  explode(position, projectile) {
    const color = projectile.team === 'blue' ? 0x63eaff : 0xff6a45;
    this.effects.explosion(position, color, 1);
    this.audio.explosion();

    const damage = projectile.damage;
    const radius = projectile.splash;
    this.callbacks.onExplosion?.(position, projectile);

    for (const bot of this.callbacks.bots?.() || []) {
      if (!bot.alive || bot.team === projectile.team) continue;
      const dist = bot.position.distanceTo(position);
      if (dist > radius) continue;
      const falloff = 1 - Math.max(0, dist - 2.4) / (radius - 2.4);
      const amount = damage * Math.max(0.26, falloff);
      this.callbacks.onBotDamage?.(bot, amount, {
        type: projectile.owner === 'player' ? 'player' : 'bot',
        team: projectile.team,
        name: projectile.owner === 'player' ? 'YOU' : projectile.owner?.name,
      });
    }

    const player = this.callbacks.player?.();
    if (player && player.alive && projectile.team !== 'blue') {
      const center = player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      const dist = center.distanceTo(position);
      if (dist <= radius) {
        const falloff = 1 - Math.max(0, dist - 1.8) / (radius - 1.8);
        const amount = damage * 0.8 * Math.max(0.32, falloff);
        player.damage(amount, { name: projectile.owner?.name || 'RED TEAM', team: projectile.team });
      }
    }
  }

  update(dt) {
    this.time += dt;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.velocity.y -= 10.5 * dt;
      p.position.addScaledVector(p.velocity, dt);
      p.group.position.copy(p.position);
      p.spinning += dt * 24;
      p.disc.rotation.z = p.spinning;
      p.ring.rotation.z = -p.spinning * 0.8;
      const pulse = 1 + Math.sin(this.time * 30 + p.spinning) * 0.12;
      p.sprite.scale.setScalar(2.2 * pulse);
      p.light.intensity = 2.6 + Math.random() * 1.4;

      if (Math.random() < 0.85) {
        this.effects.trail(p.position.clone(), p.team === 'blue' ? 0x6ef4ff : 0xff8a66);
      }

      let exploded = false;
      const ground = terrainHeight(p.position.x, p.position.z);
      if (p.position.y <= ground + 0.12) {
        p.position.y = ground + 0.12;
        exploded = true;
      }

      if (!exploded) {
        for (const bot of this.callbacks.bots?.() || []) {
          if (!bot.alive || bot.team === p.team) continue;
          const center = bot.position.clone().add(new THREE.Vector3(0, 1.1, 0));
          if (center.distanceTo(p.position) < 1.25) {
            exploded = true;
            break;
          }
        }
      }

      if (!exploded) {
        const player = this.callbacks.player?.();
        if (player && player.alive && p.team !== 'blue') {
          const center = player.position.clone().add(new THREE.Vector3(0, 1.0, 0));
          if (center.distanceTo(p.position) < 1.15) exploded = true;
        }
      }

      if (playerOutOfBounds(p.position)) exploded = true;

      if (exploded || p.life <= 0) {
        this.explode(p.position, p);
        this.scene.remove(p.group);
        p.disc.material.dispose();
        p.ring.material.dispose();
        p.sprite.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }
}

function playerOutOfBounds(position) {
  const limit = 470;
  return Math.abs(position.x) > limit || Math.abs(position.z) > limit || position.y < -60 || position.y > 260;
}

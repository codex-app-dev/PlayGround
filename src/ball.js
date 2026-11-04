import * as THREE from 'three';
import { ARENA } from './arena.js';

function ballTextures() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // deep space base
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#07131f');
  grad.addColorStop(0.5, '#0a1f30');
  grad.addColorStop(1, '#050c15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // hex panels
  const r = 26;
  for (let row = -1; row < H / (r * 1.5) + 1; row++) {
    for (let col = -1; col < W / (r * Math.sqrt(3)) + 1; col++) {
      const cx = col * r * Math.sqrt(3) + (row % 2 ? r * Math.sqrt(3) / 2 : 0);
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k + Math.PI / 6;
        const x = cx + Math.cos(a) * (r - 2);
        const y = cy + Math.sin(a) * (r - 2);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const v = Math.sin(cx * 0.021) * Math.cos(cy * 0.037);
      if (v > 0.38) {
        ctx.fillStyle = 'rgba(120, 210, 240, 0.35)';
        ctx.fill();
      } else if (v < -0.55) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(110, 220, 255, 0.52)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  // team arcs
  ctx.lineWidth = 13;
  ctx.strokeStyle = 'rgba(32, 200, 255, 0.9)';
  ctx.beginPath(); ctx.ellipse(W * 0.24, H / 2, 42, 105, 0.2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 122, 24, 0.9)';
  ctx.beginPath(); ctx.ellipse(W * 0.76, H / 2, 42, 105, -0.2, 0, Math.PI * 2); ctx.stroke();

  // center line / glow
  ctx.strokeStyle = 'rgba(220,250,255,0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.fillStyle = 'rgba(200,245,255,0.9)';
  ctx.font = '700 46px "Russo One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('3D', W / 2, H / 2 + 16);

  // seams dark accents
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath(); ctx.arc(x, y, 8 + Math.random() * 16, 0, Math.PI * 2); ctx.fill();
  }

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // emissive map
  const ec = document.createElement('canvas');
  ec.width = W; ec.height = H;
  const ex = ec.getContext('2d');
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  ex.lineWidth = 2.2;
  ex.strokeStyle = 'rgba(40, 180, 255, 0.7)';
  for (let row = -1; row < H / (r * 1.5) + 1; row++) {
    for (let col = -1; col < W / (r * Math.sqrt(3)) + 1; col++) {
      const cx = col * r * Math.sqrt(3) + (row % 2 ? r * Math.sqrt(3) / 2 : 0);
      const cy = row * r * 1.5;
      ex.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k + Math.PI / 6;
        const x = cx + Math.cos(a) * (r - 2);
        const y = cy + Math.sin(a) * (r - 2);
        if (k === 0) ex.moveTo(x, y); else ex.lineTo(x, y);
      }
      ex.closePath(); ex.stroke();
    }
  }
  ex.lineWidth = 13;
  ex.strokeStyle = 'rgba(0, 180, 255, 0.85)';
  ex.beginPath(); ex.ellipse(W * 0.24, H / 2, 42, 105, 0.2, 0, Math.PI * 2); ex.stroke();
  ex.strokeStyle = 'rgba(255, 100, 0, 0.85)';
  ex.beginPath(); ex.ellipse(W * 0.76, H / 2, 42, 105, -0.2, 0, Math.PI * 2); ex.stroke();
  ex.lineWidth = 4;
  ex.strokeStyle = 'rgba(180, 245, 255, 0.8)';
  ex.beginPath(); ex.moveTo(W / 2, 0); ex.lineTo(W / 2, H); ex.stroke();
  const emissive = new THREE.CanvasTexture(ec);
  emissive.colorSpace = THREE.SRGBColorSpace;

  return { map, emissive };
}

export class Ball {
  constructor(scene) {
    this.scene = scene;
    this.radius = ARENA.ballRadius;
    this.position = new THREE.Vector3(0, this.radius, 0);
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.scoredAgainst = 0;
    this.onImpact = null;
    this.onGoal = null;
    this.lastTouch = null;
    this.trailAcc = 0;

    const tex = ballTextures();
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: 0x4fcfff,
      emissiveIntensity: 1.15,
      metalness: 0.32,
      roughness: 0.34,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.1,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 56, 36), mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    const glowTex = this._glow();
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x3fd4ff, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.glow.scale.setScalar(this.radius * 4.2);
    scene.add(this.glow);

  }

  _glow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 7, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.26)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }

  reset(x = 0, y = this.radius, z = 0, delayDrop = false) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.scoredAgainst = 0;
    this.lastTouch = null;
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.identity();
    this.glow.position.copy(this.position);
    this.dropOffset = delayDrop ? 9 : 0;
    if (delayDrop) this.mesh.position.y += this.dropOffset;
  }

  get speed() { return this.velocity.length(); }

  update(dt, effects) {
    if (this.dropOffset > 0) {
      this.dropOffset = Math.max(0, this.dropOffset - dt * 26);
      this.mesh.position.y = this.position.y + this.dropOffset;
      this.glow.position.copy(this.mesh.position);
      return;
    }

    const r = this.radius;
    const halfL = ARENA.halfLength, halfW = ARENA.halfWidth, ceiling = ARENA.ceiling;
    const goalHalf = ARENA.goalWidth / 2, goalH = ARENA.goalHeight;

    // gravity and drag
    this.velocity.y -= 29 * dt;
    const drag = Math.max(0, 1 - 0.085 * dt);
    this.velocity.multiplyScalar(drag);
    this.position.addScaledVector(this.velocity, dt);

    // --- ground ---
    if (this.position.y < r) {
      this.position.y = r;
      if (this.velocity.y < -3) {
        const s = Math.min(1, Math.abs(this.velocity.y) / 34);
        this.velocity.y = -this.velocity.y * 0.64;
        this.velocity.x *= 0.97;
        this.velocity.z *= 0.97;
        this._impact(s, new THREE.Vector3(this.position.x, 0.08, this.position.z));
      } else {
        this.velocity.y = 0;
        // rolling friction
        const f = Math.max(0, 1 - 0.55 * dt);
        this.velocity.x *= f;
        this.velocity.z *= f;
      }
    }

    // --- ceiling ---
    if (this.position.y > ceiling - r) {
      this.position.y = ceiling - r;
      if (this.velocity.y > 1) {
        this.velocity.y = -this.velocity.y * 0.58;
        this._impact(0.4, this.position.clone());
      }
    }

    // --- side walls ---
    if (this.position.z > halfW - r) {
      this.position.z = halfW - r;
      if (this.velocity.z > 0) {
        this.velocity.z = -this.velocity.z * 0.78;
        this.velocity.x *= 0.985;
        this._impact(Math.min(1, Math.abs(this.velocity.z) / 28), this.position.clone());
      }
    } else if (this.position.z < -halfW + r) {
      this.position.z = -halfW + r;
      if (this.velocity.z < 0) {
        this.velocity.z = -this.velocity.z * 0.78;
        this.velocity.x *= 0.985;
        this._impact(Math.min(1, Math.abs(this.velocity.z) / 28), this.position.clone());
      }
    }

    // --- end walls / goal opening ---
    const inMouth = Math.abs(this.position.z) < goalHalf - r * 0.15 && this.position.y < goalH - r * 0.05;
    if (this.position.x > halfL - r) {
      if (!inMouth) {
        this.position.x = halfL - r;
        if (this.velocity.x > 0) {
          this.velocity.x = -this.velocity.x * 0.76;
          this.velocity.z *= 0.985;
          this._impact(Math.min(1, Math.abs(this.velocity.x) / 30), this.position.clone());
        }
      } else if (this.position.x > halfL + 0.5 && this.scoredAgainst === 0) {
        this.scoredAgainst = 1;
        this.onGoal?.(1, this.position.clone());
      }
    } else if (this.position.x < -halfL + r) {
      if (!inMouth) {
        this.position.x = -halfL + r;
        if (this.velocity.x < 0) {
          this.velocity.x = -this.velocity.x * 0.76;
          this.velocity.z *= 0.985;
          this._impact(Math.min(1, Math.abs(this.velocity.x) / 30), this.position.clone());
        }
      } else if (this.position.x < -halfL - 0.5 && this.scoredAgainst === 0) {
        this.scoredAgainst = -1;
        this.onGoal?.(-1, this.position.clone());
      }
    }

    // inside goal: back net and side nets (unless already scored / frozen)
    if (Math.abs(this.position.x) > halfL) {
      const side = Math.sign(this.position.x);
      const backX = side * (halfL + ARENA.goalDepth - r);
      if (side > 0 ? this.position.x > backX : this.position.x < backX) {
        this.position.x = backX;
        this.velocity.x *= -0.28;
        this.velocity.y *= 0.7;
        this.velocity.z *= 0.7;
      }
      if (Math.abs(this.position.z) > goalHalf - r * 0.1) {
        this.position.z = Math.sign(this.position.z) * (goalHalf - r * 0.1);
        this.velocity.z *= -0.4;
      }
      if (this.position.y > goalH - r * 0.1) {
        this.position.y = goalH - r * 0.1;
        this.velocity.y = -Math.abs(this.velocity.y) * 0.3;
      }
    }

    // visual rotation
    const speed = this.velocity.length();
    const axis = new THREE.Vector3(-this.velocity.z, 0, this.velocity.x);
    if (axis.lengthSq() > 0.0001) {
      axis.normalize();
      this.mesh.rotateOnWorldAxis(axis, (speed / this.radius) * dt);
    }
    this.angularVelocity.multiplyScalar(0.995);

    // sync
    this.mesh.position.copy(this.position);
    this.glow.position.copy(this.position);
    this.glow.material.opacity = 0.22 + Math.min(0.32, speed / 120);

    if (effects) effects.ballTrail(this, dt, 0x74e4ff);
  }

  _impact(strength, pos) {
    if (this.onImpact) this.onImpact(strength, pos);
  }

  kick(velocity, spin = 0) {
    this.velocity.copy(velocity);
    this.angularVelocity.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
  }
}

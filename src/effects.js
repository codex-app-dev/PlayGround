import * as THREE from 'three';
import { rand, clamp, softDotTexture } from './util.js';

const MAX_SMOKE = 420;
const MAX_SPARK = 220;
const MAX_SKID = 420;

class PointsPool {
  constructor(scene, max, texture, additive, sizeScale = 1) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    this.sizeScale = sizeScale;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, max);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: texture }, uScale: { value: sizeScale } },
      vertexShader: `
        uniform float uScale;
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vAlpha; varying vec3 vColor;
        void main(){
          vAlpha = aAlpha; vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale * (260.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex; varying float vAlpha; varying vec3 vColor;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    this.mat = mat;
    scene.add(this.points);
    for (let i = 0; i < max; i++) { this.life[i] = 0; this.alpha[i] = 0; }
  }

  emit(p, v, opts) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    const c = opts.color || new THREE.Color(0x888888);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size[i] = opts.size ?? 1;
    this.alpha[i] = opts.alpha ?? 1;
    this.life[i] = opts.life ?? 1;
    this.maxLife[i] = this.life[i];
    this.grow[i] = opts.grow ?? 0;
    this.drag[i] = opts.drag ?? 0.8;
    this.grav[i] = opts.gravity ?? 0;
    this.geo.attributes.aColor.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = clamp(this.life[i] / this.maxLife[i], 0, 1);
      const i3 = i * 3;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.vel[i3 + 1] += this.grav[i] * dt;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 1] *= d; this.vel[i3 + 2] *= d;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = Math.min(1, t * 1.6) * 0.85;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const smokeTex = softDotTexture(64, 'rgba(255,255,255,0.9)');
    const sparkTex = softDotTexture(64, 'rgba(255,255,255,1)');
    this.smoke = new PointsPool(scene, MAX_SMOKE, smokeTex, false, 1.0);
    this.sparks = new PointsPool(scene, MAX_SPARK, sparkTex, true, 1.0);

    // skid marks
    this.skidPos = new Float32Array(MAX_SKID * 6 * 3);
    this.skidGeo = new THREE.BufferGeometry();
    this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3));
    this.skidGeo.setDrawRange(0, 0);
    this.skidGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2000);
    const mat = new THREE.MeshBasicMaterial({ color: 0x101215, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.skidMesh = new THREE.Mesh(this.skidGeo, mat);
    this.skidMesh.renderOrder = 2;
    scene.add(this.skidMesh);
    this.skidCursor = 0;
    this.skidCount = 0;
    this.lastSkid = [null, null, null, null];

    this.smokeAcc = 0;
  }

  wheelSmoke(vehicle, dt, world) {
    this.smokeAcc += dt;
    const wheels = vehicle.visual.wheels;
    const offroad = world && world.zoneAt(vehicle.body.pos.x, vehicle.body.pos.z) === 'grass';
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      if (!w.contact) continue;
      if (w.slip > 0.18 || (offroad && Math.abs(vehicle.forwardSpeed) > 6)) {
        const n = w.slip > 0.4 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const col = offroad
            ? new THREE.Color(0.55, 0.49, 0.38)
            : new THREE.Color(0.62, 0.63, 0.65);
          const v = new THREE.Vector3(rand(-1.1, 1.1), rand(0.7, 2.2), rand(-1.1, 1.1));
          v.addScaledVector(vehicle.body.vel, 0.12);
          this.smoke.emit(w.worldContact.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.15, rand(-0.2, 0.2))), v, {
            color: col, size: rand(0.5, 0.9), life: rand(0.9, 1.8), grow: rand(1.2, 2.4), drag: 1.2, gravity: 0.35, alpha: 0.35,
          });
        }
      }
    }
  }

  updateSkids(vehicle, world) {
    const wheels = vehicle.visual.wheels;
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      if (!w.contact || w.broken) { this.lastSkid[i] = null; continue; }
      const grass = world.zoneAt(w.worldContact.x, w.worldContact.z) === 'grass';
      const slipping = w.slip > 0.3 || (vehicle.inputs.handbrake && !w.isFront);
      if (!slipping || grass) { this.lastSkid[i] = null; continue; }
      const p = w.worldContact.clone();
      p.y = 0.055;
      const last = this.lastSkid[i];
      if (last && last.distanceTo(p) > 0.18) {
        this.pushSkid(last, p, 0.24);
        this.lastSkid[i] = p;
      } else if (!last) {
        this.lastSkid[i] = p;
      }
    }
  }

  pushSkid(a, b, width) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.02) return;
    const nx = -dz / len * width / 2, nz = dx / len * width / 2;
    const i = this.skidCursor * 18;
    const arr = this.skidPos;
    const verts = [
      a.x + nx, 0.055, a.z + nz,
      a.x - nx, 0.055, a.z - nz,
      b.x - nx, 0.055, b.z - nz,
      a.x + nx, 0.055, a.z + nz,
      b.x - nx, 0.055, b.z - nz,
      b.x + nx, 0.055, b.z + nz,
    ];
    for (let k = 0; k < 18; k++) arr[i + k] = verts[k];
    this.skidCursor = (this.skidCursor + 1) % MAX_SKID;
    this.skidCount = Math.min(this.skidCount + 1, MAX_SKID);
    this.skidGeo.setDrawRange(0, this.skidCount * 6);
    this.skidGeo.attributes.position.needsUpdate = true;
  }

  impactSparks(point, normal, power) {
    const n = clamp(Math.round(power * 1.4), 4, 34);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(3, 13));
      v.addScaledVector(normal, rand(1, 6));
      const warm = new THREE.Color().setHSL(rand(0.05, 0.11), 1, rand(0.55, 0.75));
      this.sparks.emit(point.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))), v, {
        color: warm, size: rand(0.14, 0.3), life: rand(0.25, 0.7), drag: 0.4, gravity: -12, alpha: 1,
      });
    }
    // glass / paint debris
    for (let i = 0; i < Math.min(16, power); i++) {
      const v = new THREE.Vector3(rand(-2, 2), rand(0, 4), rand(-2, 2));
      v.addScaledVector(normal, rand(1, 4));
      this.sparks.emit(point.clone(), v, {
        color: new THREE.Color(0.8, 0.85, 0.9), size: rand(0.08, 0.2), life: rand(0.4, 1.1), drag: 0.5, gravity: -14, alpha: 0.9,
      });
    }
  }

  dustPuff(point, color = new THREE.Color(0.55, 0.5, 0.4)) {
    for (let i = 0; i < 10; i++) {
      this.smoke.emit(point.clone(), new THREE.Vector3(rand(-2, 2), rand(0.5, 2), rand(-2, 2)), {
        color, size: rand(0.8, 1.4), life: rand(1.2, 2.2), grow: 2.4, drag: 1.4, gravity: 0.2, alpha: 0.3,
      });
    }
  }

  update(dt) {
    this.smoke.update(dt);
    this.sparks.update(dt);
  }
}

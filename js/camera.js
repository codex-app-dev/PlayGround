import * as THREE from '../vendor/three.module.js';
import { MAP } from './map.js';

export class CameraRig {
  constructor(camera, dom, game) {
    this.camera = camera;
    this.dom = dom;
    this.game = game;
    this.target = new THREE.Vector3(MAP.playerBase.x, 0, MAP.playerBase.z);
    this.desired = this.target.clone();
    this.yaw = -0.66;
    this.pitch = 0.92;
    this.dist = 36;
    this.desiredDist = 36;
    this.keys = new Set();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.intro = null;
    this.tmp = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.edge = 0.0;
    this.update(0, true);
  }

  setTarget(x, z, instant = false) {
    this.desired.set(x, 0, z);
    if (instant) {
      this.target.copy(this.desired);
      this.update(0, true);
    }
  }

  focusOn(x, z, instant = false) {
    this.setTarget(x, z, instant);
  }

  focusBase(instant = false) {
    const base = MAP.playerBase;
    this.setTarget(base.x, base.z, instant);
  }

  flyTo(x, z, dist = 30, duration = 1.4) {
    this.intro = {
      fromTarget: this.target.clone(),
      toTarget: new THREE.Vector3(x, 0, z),
      fromDist: this.dist,
      toDist: dist,
      t: 0,
      duration,
    };
  }

  panWorld(dx, dz) {
    this.desired.x += dx;
    this.desired.z += dz;
    this.clampTarget();
  }

  panScreen(dx, dy) {
    const k = this.dist * 0.0016;
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    this.desired.x -= (rightX * dx + fwdX * dy) * k;
    this.desired.z -= (rightZ * dx + fwdZ * dy) * k;
    this.clampTarget();
  }

  keyPan(dt) {
    if (!this.keys.size) return;
    const speed = this.dist * 0.95 * dt;
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    let dx = 0, dz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) { dx += fwdX; dz += fwdZ; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { dx -= fwdX; dz -= fwdZ; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { dx -= rightX; dz -= rightZ; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { dx += rightX; dz += rightZ; }
    this.panWorld(dx * speed, dz * speed);
  }

  rotate(dt) {
    let r = 0;
    if (this.keys.has('q')) r -= 1;
    if (this.keys.has('e')) r += 1;
    if (r) this.yaw += r * dt * 1.1;
  }

  zoomBy(delta) {
    this.desiredDist = THREE.MathUtils.clamp(this.desiredDist * (1 + delta), 20, 62);
  }

  zoomFactor(factor) {
    this.desiredDist = THREE.MathUtils.clamp(this.desiredDist * factor, 20, 62);
  }

  clampTarget() {
    const lim = MAP.playable + 1;
    this.desired.x = THREE.MathUtils.clamp(this.desired.x, -lim, lim);
    this.desired.z = THREE.MathUtils.clamp(this.desired.z, -lim, lim);
  }

  screenToGround(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, hit)) return hit;
    return null;
  }

  update(dt, instant = false) {
    if (this.intro) {
      this.intro.t += dt;
      const k = Math.min(1, this.intro.t / this.intro.duration);
      const e = 1 - Math.pow(1 - k, 3);
      this.target.lerpVectors(this.intro.fromTarget, this.intro.toTarget, e);
      this.desired.copy(this.target);
      this.dist = THREE.MathUtils.lerp(this.intro.fromDist, this.intro.toDist, e);
      this.desiredDist = this.dist;
      if (k >= 1) this.intro = null;
    } else {
      this.keyPan(dt);
      this.rotate(dt);
      if (instant) {
        this.target.copy(this.desired);
        this.dist = this.desiredDist;
      } else {
        this.target.lerp(this.desired, Math.min(1, dt * 11));
        this.dist += (this.desiredDist - this.dist) * Math.min(1, dt * 9);
      }
    }
    const horizontal = Math.cos(this.pitch) * this.dist;
    const y = Math.sin(this.pitch) * this.dist;
    const px = this.target.x + Math.sin(this.yaw) * horizontal;
    const pz = this.target.z + Math.cos(this.yaw) * horizontal;
    this.camera.position.set(px, y, pz);
    this.lookTarget.set(this.target.x, 0.8, this.target.z);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateMatrixWorld();
  }
}

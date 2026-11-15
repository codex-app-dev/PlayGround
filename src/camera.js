import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.modes = ['CHASE', 'HOOD', 'CINEMATIC'];
    this.yaw = Math.PI;
    this.pitch = 0.12;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.dragging = false;
    this.shake = 0;
    this.fov = 62;
    this.look = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 5, 70);
    this.forward = new THREE.Vector3(0, 0, -1);
    this.orbitAngle = 0;
    this.hoodQuat = new THREE.Quaternion();
    this.init = false;
    this.distance = 7.2;
  }

  setMode(m) {
    this.mode = ((m % this.modes.length) + this.modes.length) % this.modes.length;
    return this.modes[this.mode];
  }

  addShake(amount) { this.shake = Math.min(1.4, this.shake + amount); }

  update(dt, vehicle, world, options = {}) {
    const cam = this.camera;
    const body = vehicle.body;
    const speed = Math.abs(vehicle.forwardSpeed);
    const carPos = vehicle.visual.carGroup.position;

    // orientation (yaw only, so rolls don't roll the camera)
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(body.quat);
    const carYaw = Math.atan2(fwd.x, fwd.z);

    this.orbitYaw = damp(this.orbitYaw, 0, this.dragging ? 0 : 2.2, dt);

    // shake decay
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.5;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.5;
    const shakeZ = (Math.random() - 0.5) * this.shake * 0.5;

    if (!this.init) {
      this.yaw = carYaw;
      this.init = true;
    }

    if (this.mode === 2) {
      // cinematic orbit
      this.orbitAngle += dt * 0.22;
      const radius = 10 + Math.sin(this.orbitAngle * 0.7) * 2.5;
      const h = 2.4 + Math.sin(this.orbitAngle * 0.4) * 1.3;
      const desired = new THREE.Vector3(
        carPos.x + Math.sin(this.orbitAngle) * radius,
        carPos.y + h,
        carPos.z + Math.cos(this.orbitAngle) * radius
      );
      this.pos.lerp(desired, 1 - Math.exp(-3.2 * dt));
      this.look.lerp(carPos.clone().add(new THREE.Vector3(0, 0.8, 0)), 1 - Math.exp(-6 * dt));
      cam.position.copy(this.pos).add(new THREE.Vector3(shakeX, shakeY, shakeZ));
      if (world) cam.position.y = Math.max(cam.position.y, world.surfaceHeight(cam.position.x, cam.position.z) + 0.7);
      cam.lookAt(this.look);
      cam.fov = damp(cam.fov, 46, 3, dt);
      cam.updateProjectionMatrix();
      return;
    }

    if (this.mode === 1) {
      // bumper camera
      const local = new THREE.Vector3(0, vehicle.spec.beltline + 0.06, vehicle.spec.length / 2 + 0.75)
        .sub(vehicle.comOffset);
      const p = local.applyQuaternion(body.quat).add(body.pos);
      this.pos.lerp(p, 1 - Math.exp(-40 * dt));
      cam.position.copy(this.pos).add(new THREE.Vector3(shakeX * 0.5, shakeY * 0.5, shakeZ * 0.5));
      if (world) cam.position.y = Math.max(cam.position.y, world.surfaceHeight(cam.position.x, cam.position.z) + 0.35);
      const lookAt = this.pos.clone().addScaledVector(fwd, 20).add(new THREE.Vector3(0, 0.5, 0));
      cam.lookAt(lookAt);
      cam.fov = damp(cam.fov, 72 + speed * 0.18, 4, dt);
      cam.updateProjectionMatrix();
      return;
    }

    // chase camera follows yaw smoothly
    const follow = 3.4 + (vehicle.airborne ? -1.2 : 0);
    this.yaw = this.lerpAngle(this.yaw, carYaw, 1 - Math.exp(-follow * dt));
    const totalYaw = this.yaw + this.orbitYaw;
    const dist = this.distance + speed * 0.045 + (vehicle.airborne ? 1.5 : 0);
    const height = 1.55 + Math.sin(this.pitch + this.orbitPitch) * dist * 0.55;
    const horiz = Math.cos(this.pitch + this.orbitPitch) * dist;

    const behind = new THREE.Vector3(Math.sin(totalYaw), 0, Math.cos(totalYaw));
    const desired = carPos.clone()
      .addScaledVector(behind, -horiz)
      .add(new THREE.Vector3(0, height + 0.9, 0));

    if (!this._camInit) { this.pos.copy(desired); this._camInit = true; }
    const followPos = 1 - Math.exp(-6.5 * dt);
    this.pos.lerp(desired, followPos);
    if (world) {
      const gy = world.surfaceHeight(this.pos.x, this.pos.z) + 0.65;
      if (this.pos.y < gy) this.pos.y = gy;
    }
    cam.position.copy(this.pos).add(new THREE.Vector3(shakeX, shakeY, shakeZ));
    const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(behind, 2.8);
    this.look.lerp(lookTarget, 1 - Math.exp(-9 * dt));
    cam.lookAt(this.look);
    const targetFov = 62 + clamp(speed * 0.28, 0, 15);
    cam.fov = damp(cam.fov, targetFov, 4, dt);
    cam.updateProjectionMatrix();
  }

  lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
}

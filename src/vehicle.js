import * as THREE from 'three';
import { buildCar } from './car.js';
import { clamp, damp, lerp } from './util.js';

const G = 9.81;
const UP = new THREE.Vector3(0, 1, 0);

class RigidBody {
  constructor(mass, dims, comY) {
    this.mass = mass;
    this.invMass = 1 / mass;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();

    const L = dims.length, W = dims.width, H = dims.height;
    this.inertia = new THREE.Vector3(
      (mass / 12) * (L * L + H * H) * 1.12,
      (mass / 12) * (L * L + W * W) * 1.0,
      (mass / 12) * (W * W + H * H) * 1.35
    );
    this.invInertia = new THREE.Vector3(1 / this.inertia.x, 1 / this.inertia.y, 1 / this.inertia.z);
    this.invInertiaWorld = new THREE.Matrix3();
    this._m3 = new THREE.Matrix3();
    this._q = new THREE.Quaternion();
    this.updateInertia();
  }
  updateInertia() {
    const r = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(this.quat));
    const rt = r.clone().transpose();
    const d = new THREE.Matrix3().set(
      this.invInertia.x, 0, 0,
      0, this.invInertia.y, 0,
      0, 0, this.invInertia.z
    );
    this.invInertiaWorld.copy(r).multiply(d).multiply(rt);
  }
  applyImpulse(imp, point) {
    this.vel.addScaledVector(imp, this.invMass);
    const r = point.clone().sub(this.pos);
    const torque = r.cross(imp);
    this.angVel.add(torque.applyMatrix3(this.invInertiaWorld));
  }
  pointVelocity(point, out = new THREE.Vector3()) {
    const r = point.clone().sub(this.pos);
    return out.copy(this.angVel).cross(r).add(this.vel);
  }
  integrate(dt) {
    this.vel.y -= G * dt;
    this.pos.addScaledVector(this.vel, dt);
    const w = this.angVel;
    const q = this._q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(this.quat);
    this.quat.x += q.x; this.quat.y += q.y; this.quat.z += q.z; this.quat.w += q.w;
    this.quat.normalize();
    this.angVel.multiplyScalar(Math.exp(-0.25 * dt));
    this.updateInertia();
  }
}

export class Vehicle {
  constructor(scene, spec, options = {}) {
    this.scene = scene;
    this.spec = spec;
    this.visual = buildCar(spec, { color: options.color });
    scene.add(this.visual.carGroup);
    this.body = new RigidBody(spec.mass, { length: spec.length, width: spec.width, height: spec.height }, spec.comY);

    this.comOffset = new THREE.Vector3(0, spec.comY, 0);
    this.wheelZ = spec.wheelbase / 2;
    this.anchorY = 0.62;
    this.maxExt = 0.38;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    this.inputs = { up: false, down: false, left: false, right: false, handbrake: false };
    this.steerAngle = 0;
    this.engineDamage = 0;
    this.wheelDamage = [0, 0, 0, 0];
    this.score = 0;
    this.gear = 1;
    this.rpm = 900;
    this.forwardSpeed = 0;
    this.lateralSlip = 0;
    this.airborne = true;
    this.airTime = 0;
    this.groundedTime = 0;
    this.impactCooldown = 0;
    this.onImpact = options.onImpact || (() => {});
    this.onLand = options.onLand || (() => {});
    this.onSkid = options.onSkid || (() => {});
    this.lastLandTime = 0;
    this.trackPos = new THREE.Vector3();
    this._spheresWorld = [];
    this._wheelAnchors = [
      new THREE.Vector3(-spec.track / 2, this.anchorY - spec.comY, -this.wheelZ),
      new THREE.Vector3(spec.track / 2, this.anchorY - spec.comY, -this.wheelZ),
      new THREE.Vector3(-spec.track / 2, this.anchorY - spec.comY, this.wheelZ),
      new THREE.Vector3(spec.track / 2, this.anchorY - spec.comY, this.wheelZ),
    ];
    // collision hull, ground-based local coordinates
    const L = spec.length, W = spec.width, H = spec.height;
    this.hull = [
      { p: new THREE.Vector3(0, 0.62, L / 2 - 0.42), r: 0.5, zone: 'front' },
      { p: new THREE.Vector3(-W / 2 + 0.14, 0.6, L / 2 - 0.72), r: 0.43, zone: 'front' },
      { p: new THREE.Vector3(W / 2 - 0.14, 0.6, L / 2 - 0.72), r: 0.43, zone: 'front' },
      { p: new THREE.Vector3(0, 0.55, L / 2 - 1.35), r: 0.46, zone: 'mid' },
      { p: new THREE.Vector3(-W / 2 + 0.1, 0.5, 0.1), r: 0.45, zone: 'mid' },
      { p: new THREE.Vector3(W / 2 - 0.1, 0.5, 0.1), r: 0.45, zone: 'mid' },
      { p: new THREE.Vector3(0, 0.5, -L / 2 + 1.2), r: 0.44, zone: 'rear' },
      { p: new THREE.Vector3(0, 0.58, -L / 2 + 0.4), r: 0.5, zone: 'rear' },
      { p: new THREE.Vector3(0, Math.min(H - 0.12, 1.3), 0), r: 0.38, zone: 'roof' },
    ];
    this.hull.forEach(h => h.local = h.p.clone().sub(this.comOffset));

    this.scaleImpact = 2000 / (spec.mass + 700);
    this.lastSafe = new THREE.Vector3();
    this.reset(new THREE.Vector3(0, 0, 60), Math.PI);
    this.lastSafe.copy(this.body.pos);
  }

  dispose() {
    this.scene.remove(this.visual.carGroup);
    this.visual.dispose();
  }

  setInputs(i) { this.inputs = i; }

  toWorld(localGround, out = new THREE.Vector3()) {
    return out.copy(localGround).sub(this.comOffset).applyQuaternion(this.body.quat).add(this.body.pos);
  }
  toLocal(world, out = new THREE.Vector3()) {
    return out.copy(world).sub(this.body.pos).applyQuaternion(this.body.quat.clone().invert()).add(this.comOffset);
  }

  reset(point, yaw = 0) {
    const h = this.scene.userData.world ? this.scene.userData.world.surfaceHeight(point.x, point.z) : 0;
    this.body.pos.set(point.x, h + this.spec.comY + 0.12, point.z);
    this.body.quat.setFromAxisAngle(UP, yaw);
    this.body.vel.set(0, 0, 0);
    this.body.angVel.set(0, 0, 0);
    this.body.updateInertia();
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = 900;
    this.forwardSpeed = 0;
    this.airborne = true;
    this.airTime = 0;
    this.lastSafe.copy(this.body.pos);
  }

  repair() {
    this.reset(this.body.pos.clone().setY(this.body.pos.y), this.currentYaw());
    for (const nd of this.visual.shell.nodes) {
      nd.pos.copy(nd.orig);
      nd.home.copy(nd.orig);
      nd.vel.set(0, 0, 0);
    }
    this.visual.shell.maxDisp = 0;
    this.visual.shell.avgDisp = 0;
    this.engineDamage = 0;
    for (let i = 0; i < 4; i++) this.wheelDamage[i] = 0;
    for (const w of this.visual.wheels) w.broken = false;
    this.body.vel.set(0, 0, 0);
    this.body.angVel.set(0, 0, 0);
  }

  currentYaw() {
    const e = new THREE.Euler().setFromQuaternion(this.body.quat, 'YXZ');
    return e.y;
  }

  get damage() {
    const s = this.visual.shell;
    const wd = this.wheelDamage.reduce((a, b) => a + b, 0) / 4;
    return clamp(s.maxDisp * 62 + s.avgDisp * 400 + wd * 0.55, 0, 100);
  }

  get engineHealth() { return clamp(100 - this.engineDamage, 0, 100); }

  update(dt, world, audio) {
    dt = Math.min(dt, 1 / 20);
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);

    /* -------- inputs / steering -------- */
    const inp = this.inputs;
    const throttle = inp.up ? 1 : 0;
    this.controls.throttle = throttle;
    const brake = inp.down ? 1 : 0;
    let steerTarget = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    const spd = Math.abs(this.forwardSpeed);
    const steerLimit = this.spec.steerMax * (1 - 0.52 * clamp(spd / 48, 0, 1));
    const steerRate = steerTarget === 0 ? 7.5 : 4.6;
    this.steerAngle = damp(this.steerAngle, steerTarget * steerLimit, steerRate, dt);

    // alignment pull from bent wheels
    const wheelPull = (this.wheelDamage[0] - this.wheelDamage[1]) * 0.0006;
    this.steerAngle += wheelPull;
    this.steerAngle = clamp(this.steerAngle, -0.8, 0.8);

    /* -------- engine -------- */
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.body.quat);
    this.forwardSpeed = this.body.vel.dot(forward);
    const powerScale = 1 - (this.engineDamage / 100) * 0.78;
    const topSpeed = this.spec.topSpeed * (1 - (this.engineDamage / 100) * 0.3);
    this.updateGearbox(dt);

    const driven = this.spec.awd ? [true, true, true, true] : [false, false, true, true];
    const engineForceTotal = this._engineForce(throttle, powerScale, topSpeed);

    /* -------- fixed substeps -------- */
    const SUB = 4;
    const h = dt / SUB;
    for (let s = 0; s < SUB; s++) {
      this.step(h, world, {
        throttle, brake, engineForceTotal, driven,
        handbrake: inp.handbrake, steer: this.steerAngle, spd,
      });
    }

    this.airborne = this.visual.wheels.every(w => !w.contact);
    if (this.airborne) {
      this.airTime += dt;
      this.groundedTime = 0;
    } else {
      if (this.groundedTime === 0 && this.airTime > 0.35) {
        this.onLand({ airTime: this.airTime, speed: Math.abs(this.forwardSpeed), y: this.body.pos.y });
      }
      this.groundedTime += dt;
      this.airTime = 0;
      if (this.groundedTime > 0.4) this.lastSafe.copy(this.body.pos);
    }

    /* -------- visuals -------- */
    this.syncVisuals(dt);

    /* -------- shell deformation sim -------- */
    this.visual.updateShell(dt);
    this.visual.applyDamageLook(this.damage);

    /* -------- smoke / sound inputs -------- */
    if (audio) audio.update(this);
  }

  updateGearbox(dt) {
    const speed = Math.abs(this.forwardSpeed);
    const w = this.visual.wheels[2];
    const ratios = [3.6, 2.15, 1.5, 1.15, 0.92];
    const final = 3.6;
    const wheelR = this.spec.wheelR;
    let rpm = (speed / wheelR) * ratios[clamp(this.gear - 1, 0, 4)] * final * 60 / (2 * Math.PI);
    rpm = Math.max(rpm, 850 + this.controls.throttle * 500);
    if (rpm > 6500 && this.gear < 5) { this.gear++; }
    else if (rpm < 1900 && this.gear > 1) { this.gear--; }
    this.rpm = damp(this.rpm, clamp(rpm, 800, 7200), 9, dt);
    this.targetRpm = rpm;
  }

  _engineForce(throttle, powerScale, topSpeed) {
    if (throttle <= 0) return 0;
    const speed = Math.max(Math.abs(this.forwardSpeed), 5);
    let force = (this.spec.power * 1000) / speed;
    const cap = this.spec.mass * (this.spec.awd ? 7.4 : 8.2);
    force = Math.min(force, cap);
    // rpm power band
    const band = 0.68 + 0.32 * Math.sin(clamp((this.targetRpm - 900) / 5800, 0, 1) * Math.PI * 0.92);
    force *= band * powerScale;
    if (Math.abs(this.forwardSpeed) > topSpeed) force *= 0.15;
    return force;
  }

  step(dt, world, ctrl) {
    const body = this.body;
    const spec = this.spec;
    const wheels = this.visual.wheels;
    const up = UP;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(body.quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(body.quat);
    let onGround = 0;

    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      const anchor = this.toWorld(this.visual.wheels[i].local.clone().setY(this.anchorY));
      // use ray straight down
      const gY = world.surfaceHeight(anchor.x, anchor.z);
      const normal = world.normalAt(anchor.x, anchor.z);
      let ext = anchor.y - gY - spec.wheelR;
      const maxExt = this.maxExt;
      let contact = ext <= maxExt && ext > -0.2;

      w.groundY = gY;
      w.normal.copy(normal);
      if (!contact || w.broken) {
        w.contact = false;
        w.ext = maxExt;
        w.load = 0;
        continue;
      }
      onGround++;
      w.contact = true;
      const compression = clamp(maxExt - ext, 0, 0.5);
      w.ext = clamp(ext, 0.02, maxExt);
      const wheelCenter = anchor.clone().addScaledVector(UP, -w.ext);
      const contactPoint = wheelCenter.clone().addScaledVector(normal, -spec.wheelR);
      contactPoint.y = gY;
      w.worldContact.copy(contactPoint);

      const velAt = body.pointVelocity(contactPoint);
      const vn = velAt.dot(normal);
      let spring = spec.suspK * compression * (1 - this.wheelDamage[i] * 0.002);
      if (compression > 0.3) spring += spec.suspK * 9 * (compression - 0.3);
      const damping = spec.suspC * (-vn);
      let N = Math.max(0, spring + damping);
      N = Math.min(N, spec.mass * 34);
      w.load = N;
      const suspForce = normal.clone().multiplyScalar(N);
      body.vel.addScaledVector(suspForce, body.invMass * dt);
      const rS = contactPoint.clone().sub(body.pos);
      const tq = rS.cross(suspForce);
      body.angVel.addScaledVector(tq.applyMatrix3(body.invInertiaWorld), dt);

      /* ---- tire forces ---- */
      const steerAng = w.isFront ? ctrl.steer : 0;
      const wheelFwd = fwd.clone().applyAxisAngle(normal, steerAng).normalize();
      const wheelRight = normal.clone().cross(wheelFwd).normalize();
      const v = body.pointVelocity(contactPoint).sub(normal.clone().multiplyScalar(velAt.dot(normal)));
      const vLong = v.dot(wheelFwd);
      const vLat = v.dot(wheelRight);
      w.surfaceSpeed = vLong;

      const surfaceFric = world.frictionAt(contactPoint.x, contactPoint.z);
      let mu = spec.grip * surfaceFric;
      const wd = this.wheelDamage[i];
      mu *= 1 - clamp(wd * 0.007, 0, 0.42);
      if (ctrl.handbrake && !w.isFront) mu *= 0.32;

      const maxFric = N * mu;

      // drive force
      let longForce = 0;
      if (ctrl.throttle > 0 && ctrl.driven[i]) {
        const perWheel = ctrl.engineForceTotal / ctrl.driven.filter(Boolean).length;
        longForce += perWheel;
      }
      // brakes
      if (ctrl.brake > 0) {
        const brakePower = spec.mass * 9.4 * 0.25 * spec.brake;
        if (vLong > 0.4) longForce -= brakePower * ctrl.brake;
        else if (ctrl.throttle === 0) longForce -= spec.mass * 2.6 * 0.25; // reverse
      }
      if (ctrl.handbrake && !w.isFront) longForce -= spec.mass * 4.0 * 0.25;
      // rolling resistance
      longForce -= Math.sign(vLong) * Math.min(Math.abs(vLong) * 22, 140);

      // lateral
      const latGain = maxFric / 1.55;
      let latForce = clamp(-vLat * latGain * 4.2, -maxFric, maxFric);
      if (ctrl.handbrake && !w.isFront) latForce *= 0.42;

      // friction circle
      const totalMag = Math.hypot(longForce, latForce);
      if (totalMag > maxFric && totalMag > 0.001) {
        const k = maxFric / totalMag;
        longForce *= k;
        latForce *= k;
      }

      // wheel slip for smoke & sound
      const slip = clamp((Math.abs(vLat) - 1.2) / 8 + Math.max(0, Math.abs(longForce) - maxFric * 0.92) / (maxFric + 200), 0, 1);
      w.slip = slip;
      this.lateralSlip = Math.max(this.lateralSlip * 0.9, Math.abs(vLat));

      const tireForce = wheelFwd.clone().multiplyScalar(longForce).addScaledVector(wheelRight, latForce);
      body.vel.addScaledVector(tireForce, body.invMass * dt);
      const r = contactPoint.clone().sub(body.pos);
      const tqf = r.cross(tireForce);
      body.angVel.addScaledVector(tqf.applyMatrix3(body.invInertiaWorld), dt);

      // wheel spin
      const spinSlip = Math.max(0, (Math.abs(longForce) - maxFric) / (maxFric + 200)) * 30;
      w.spinVel = vLong / spec.wheelR + spinSlip * Math.sign(longForce || 1);
      if (ctrl.handbrake && !w.isFront) w.spinVel *= 0.15;
      w.spinAngle += w.spinVel * dt;
      w.steerVis = steerAng;

    }
    this.groundedWheels = onGround;

    // gravity + integrate
    body.integrate(dt);

    // aerodynamic drag and downforce
    const speed = body.vel.length();
    if (speed > 0.1) {
      const CdA = spec.width * spec.height * 0.31 + 0.18;
      const drag = body.vel.clone().multiplyScalar(-0.5 * 1.22 * CdA * speed);
      body.vel.addScaledVector(drag, body.invMass * dt);
      const df = spec.low ? 1.3 : 0.55;
      body.vel.y -= df * speed * speed * 0.0012 * dt;
    }

    this.collideWorld(dt, world);
    this.updateSpheresWorld();
  }

  collideWorld(dt, world) {
    const body = this.body;
    this.updateSpheresWorld();
    const up = UP;
    for (const sp of this._spheresWorld) {
      const gY = world.surfaceHeight(sp.pos.x, sp.pos.z);
      const normal = world.normalAt(sp.pos.x, sp.pos.z);
      // ground
      const dist = sp.pos.y - gY;
      if (dist < sp.r) {
        const pen = sp.r - dist;
        const speed = Math.max(0, -body.pointVelocity(sp.pos).dot(normal));
        this.resolveContact(sp.pos, normal, pen, 0.05, 0.8, 'ground', speed);
      }
      // static boxes
      for (const c of world.colliders) {
        if (c.type !== 'box') continue;
        const cp = new THREE.Vector3(
          clamp(sp.pos.x, c.min.x, c.max.x),
          clamp(sp.pos.y, c.min.y, c.max.y),
          clamp(sp.pos.z, c.min.z, c.max.z)
        );
        let n, pen;
        const d = sp.pos.distanceTo(cp);
        if (d < sp.r) {
          if (d > 1e-4) {
            n = sp.pos.clone().sub(cp).multiplyScalar(1 / d);
            pen = sp.r - d;
          } else {
            // inside: push out along smallest axis
            const dx1 = sp.pos.x - c.min.x, dx2 = c.max.x - sp.pos.x;
            const dy1 = sp.pos.y - c.min.y, dy2 = c.max.y - sp.pos.y;
            const dz1 = sp.pos.z - c.min.z, dz2 = c.max.z - sp.pos.z;
            const m = Math.min(dx1, dx2, dy1, dy2, dz1, dz2);
            if (m === dx1) { n = new THREE.Vector3(-1, 0, 0); pen = sp.r + dx1; }
            else if (m === dx2) { n = new THREE.Vector3(1, 0, 0); pen = sp.r + dx2; }
            else if (m === dy1) { n = new THREE.Vector3(0, -1, 0); pen = sp.r + dy1; }
            else if (m === dy2) { n = new THREE.Vector3(0, 1, 0); pen = sp.r + dy2; }
            else if (m === dz1) { n = new THREE.Vector3(0, 0, -1); pen = sp.r + dz1; }
            else { n = new THREE.Vector3(0, 0, 1); pen = sp.r + dz2; }
          }
          const speed = Math.max(0, -body.pointVelocity(sp.pos).dot(n));
          this.resolveContact(sp.pos, n, pen, c.restitution ?? 0.16, 0.55, c.tag, speed);
        }
      }
      // cylinders (poles, trees)
      for (const c of world.cylinders) {
        const dx = sp.pos.x - c.x, dz = sp.pos.z - c.z;
        const hd = Math.hypot(dx, dz);
        if (hd < c.r + sp.r && sp.pos.y - sp.r < c.h) {
          const n = new THREE.Vector3(dx / (hd || 1), 0, dz / (hd || 1));
          const pen = (c.r + sp.r - hd);
          const speed = Math.max(0, -body.pointVelocity(sp.pos).dot(n));
          this.resolveContact(sp.pos, n, pen, 0.15, 0.4, c.tag, speed);
        }
      }
    }
  }

  updateSpheresWorld() {
    this._spheresWorld.length = 0;
    const q = this.body.quat;
    for (const h of this.hull) {
      const pos = h.local.clone().applyQuaternion(q).add(this.body.pos);
      this._spheresWorld.push({ pos, r: h.r, zone: h.zone });
    }
  }

  collisionSpheres() { return this._spheresWorld; }

  resolveContact(point, normal, pen, restitution, friction, tag, impactSpeed) {
    const body = this.body;
    // positional correction (avoid sinking)
    const corr = Math.min(pen, 0.5);
    body.pos.addScaledVector(normal, corr * 0.72);

    const r = point.clone().sub(body.pos);
    const velAt = body.pointVelocity(point);
    const vn = velAt.dot(normal);
    if (vn < 0) {
      const cross = r.clone().cross(normal);
      const angPart = cross.clone().applyMatrix3(body.invInertiaWorld).cross(r).dot(normal);
      const denom = body.invMass + angPart;
      const j = -(1 + restitution) * vn / Math.max(denom, 1e-5);
      const impulse = normal.clone().multiplyScalar(j);
      body.applyImpulse(impulse, point);

      // friction impulse
      const vt = velAt.clone().addScaledVector(normal, -vn);
      const vtl = vt.length();
      if (vtl > 0.001) {
        const tdir = vt.multiplyScalar(-1 / vtl);
        const crossT = r.clone().cross(tdir);
        const angT = crossT.clone().applyMatrix3(body.invInertiaWorld).cross(r).dot(tdir);
        const denomT = body.invMass + angT;
        let jt = vtl / Math.max(denomT, 1e-5);
        jt = Math.min(jt, j * friction);
        body.applyImpulse(tdir.multiplyScalar(jt), point);
      }
    }

    if (impactSpeed > 5 && this.impactCooldown <= 0) {
      this.impactCooldown = 0.09;
      this.crush(point, normal, impactSpeed, tag);
    }
  }

  /* permanent deformation + damage event */
  crush(worldPoint, worldNormal, speed, tag) {
    const localPoint = this.toLocal(worldPoint);
    const invQ = this.body.quat.clone().invert();
    const localNormal = worldNormal.clone().applyQuaternion(invQ);
    const dir = localNormal.clone();

    const amount = clamp((speed - 4) * 0.0115, 0.015, 0.4) * this.scaleImpact;
    const radius = 1.15 + speed * 0.028;
    this.visual.shell.deform(localPoint, dir, amount, radius);

    // dents in the cabin transfer to engine / suspension if the hit is at that end
    const frontHit = localPoint.z > this.spec.length / 2 - 1.4;
    const rearHit = localPoint.z < -this.spec.length / 2 + 1.3;
    if (frontHit) this.engineDamage = Math.min(88, this.engineDamage + speed * 0.85);
    if (rearHit) this.engineDamage = Math.min(88, this.engineDamage + speed * 0.16);

    // wheels near the impact get bent
    for (let i = 0; i < 4; i++) {
      const wp = this.visual.wheels[i].local;
      const d = Math.hypot(localPoint.x - wp.x, localPoint.z - wp.z);
      if (d < 1.15 && localPoint.y < 1.2) {
        this.wheelDamage[i] = Math.min(100, this.wheelDamage[i] + speed * 1.55);
        if (this.wheelDamage[i] > 74) this.visual.wheels[i].broken = true;
      }
    }

    const points = Math.round(speed * speed * 10 * this.scaleImpact);
    this.score += points;
    this.onImpact({
      speed,
      points,
      localPoint,
      worldPoint,
      normal: worldNormal,
      tag,
      zone: localPoint.z > 0.8 ? 'front' : localPoint.z < -0.8 ? 'rear' : 'side',
      broken: this.damage,
    });
  }

  syncVisuals(dt) {
    const v = this.visual;
    v.carGroup.position.copy(this.body.pos).addScaledVector(this.comOffset.clone().applyQuaternion(this.body.quat), -1);
    v.carGroup.quaternion.copy(this.body.quat);
    const spec = this.spec;
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i];
      w.pivot.position.set(w.local.x, this.anchorY - w.ext, w.local.z);
      w.pivot.rotation.set(0, w.steerVis || 0, 0);
      w.spin.rotation.x = w.spinAngle;
      if (w.broken) {
        w.pivot.position.y = Math.min(w.pivot.position.y, spec.wheelR - 0.03);
        w.pivot.rotation.z = 0.28;
      }
    }
    // brake light glow
    const braking = this.inputs.down || this.inputs.handbrake;
    v.tailMat.emissiveIntensity = braking ? 2.6 : 0.55;
    v.headMat.emissiveIntensity = 0.8;

    // skidmark / dust callback
  }

  status() {
    return {
      speed: Math.abs(this.forwardSpeed) * 3.6,
      rpm: this.rpm,
      gear: this.forwardSpeed < -0.5 && this.inputs.down ? 'R' : this.gear,
      damage: this.damage,
      engine: this.engineHealth,
      airborne: this.airborne,
      airTime: this.airTime,
      steer: this.steerAngle,
      slip: this.lateralSlip,
      throttle: this.inputs.up ? 1 : 0,
      brake: this.inputs.down || this.inputs.handbrake ? 1 : 0,
    };
  }
}

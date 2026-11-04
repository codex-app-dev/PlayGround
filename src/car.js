import * as THREE from 'three';
import { ARENA } from './arena.js';

const TEAM_COLORS = {
  blue: {
    paint: 0x0d8fe8, paint2: 0x28cbff, accent: 0x0745c8,
    glow: 0x37d9ff, flame: 0x54e0ff, dark: 0x061521,
  },
  orange: {
    paint: 0xe26211, paint2: 0xffa23f, accent: 0xb62d00,
    glow: 0xff9a42, flame: 0xffb15c, dark: 0x210b03,
  },
};

const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.44, 22, 1);
wheelGeo.rotateX(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.46, 20, 1);
rimGeo.rotateX(Math.PI / 2);

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.32, 'rgba(255,255,255,.7)');
  g.addColorStop(0.65, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
let sharedGlow = null;
function getGlow() { return sharedGlow || (sharedGlow = glowTexture()); }

function bodyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-2.14, -0.2);
  s.lineTo(-1.8, -0.3);
  s.lineTo(1.72, -0.3);
  s.lineTo(2.13, -0.12);
  s.lineTo(2.18, 0.08);
  s.lineTo(1.9, 0.21);
  s.lineTo(1.1, 0.3);
  s.lineTo(0.25, 0.35);
  s.lineTo(-1.15, 0.33);
  s.lineTo(-1.9, 0.22);
  s.lineTo(-2.18, 0.03);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.84, bevelEnabled: true, bevelSegments: 4,
    bevelSize: 0.09, bevelThickness: 0.08, curveSegments: 8,
  });
  geo.translate(0, 0, -0.92);
  return geo;
}

function cabinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.05, 0.26);
  s.lineTo(1.02, 0.29);
  s.lineTo(0.66, 0.68);
  s.lineTo(-0.03, 0.79);
  s.lineTo(-0.8, 0.72);
  s.lineTo(-1.08, 0.53);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.34, bevelEnabled: true, bevelSegments: 3,
    bevelSize: 0.055, bevelThickness: 0.05,
  });
  geo.translate(0, 0, -0.67);
  return geo;
}

export class Car {
  constructor(scene, { team = 'blue', isPlayer = false, name = 'CAR', index = 0 } = {}) {
    this.scene = scene;
    this.team = team;
    this.isPlayer = isPlayer;
    this.name = name;
    this.index = index;
    this.colors = TEAM_COLORS[team];

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.yaw = 0;
    this.grounded = true;
    this.boosting = false;
    this.boost = 33;
    this.jumps = 0;
    this.jumpTimer = 0;
    this.airTime = 0;
    this.hitCooldown = 0;
    this.flipPower = 0;
    this.steerVisual = 0;
    this.wheelSpin = 0;
    this.throttleVisual = 0;
    this.speed = 0;
    this.stun = 0;
    this.angVel = new THREE.Vector3();
    this.landFlash = 0;
    this.boostingVisual = 0;
    this.lastImpact = 0;

    this.hooks = { onBallHit: null, onLand: null, onJump: null, onFlip: null };

    this._buildModel();
    this._tmp = {
      v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(),
      q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(),
      e1: new THREE.Euler(),
    };
  }

  _buildModel() {
    const c = this.colors;
    const root = this.root = new THREE.Group();
    root.name = `car-${this.name}`;
    this.scene.add(root);
    const body = this.bodyGroup = new THREE.Group();
    root.add(body);
    const wheels = this.wheelGroup = new THREE.Group();
    root.add(wheels);

    const paint = new THREE.MeshPhysicalMaterial({
      color: c.paint, metalness: 0.62, roughness: 0.25,
      clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.35,
    });
    const accent = new THREE.MeshStandardMaterial({ color: c.accent, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.1 });
    const trim = new THREE.MeshStandardMaterial({ color: c.paint2, metalness: 0.55, roughness: 0.3, emissive: c.glow, emissiveIntensity: 0.22 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x071522, metalness: 0.75, roughness: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.6,
    });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x0b1017, metalness: 0.7, roughness: 0.38 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.84, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xbdd8e8, metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
    const rimGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(c.glow).multiplyScalar(1.8), toneMapped: false });
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcdf6ff).multiplyScalar(2.4), toneMapped: false });
    const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a12).multiplyScalar(2.2), toneMapped: false });

    const chassis = new THREE.Mesh(bodyGeometry(), paint);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    body.add(chassis);

    const cabin = new THREE.Mesh(cabinGeometry(), glass);
    cabin.position.y = 0.01;
    cabin.castShadow = true;
    body.add(cabin);

    // roof / center stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.24), trim);
    stripe.position.set(-0.05, 0.372, 0);
    body.add(stripe);
    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.22), trim);
    hoodStripe.position.set(1.55, 0.235, 0);
    body.add(hoodStripe);
    const rearStripe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.2), trim);
    rearStripe.position.set(-1.55, 0.25, 0);
    body.add(rearStripe);

    // side blades
    for (const z of [-0.97, 0.97]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.12), accent);
      blade.position.set(-0.05, 0.04, z);
      body.add(blade);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.13, 0.14), carbon);
      skirt.position.set(-0.05, -0.29, z * 1.04);
      body.add(skirt);
    }

    // splitter + diffuser
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 2.1), carbon);
    splitter.position.set(2.12, -0.28, 0);
    body.add(splitter);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 1.8), carbon);
    diffuser.position.set(-2.1, -0.23, 0);
    body.add(diffuser);

    // spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 1.85), trim);
    wing.position.set(-1.9, 0.62, 0);
    wing.rotation.z = -0.06;
    body.add(wing);
    for (const z of [-0.7, 0.7]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), carbon);
      strut.position.set(-1.88, 0.43, z);
      body.add(strut);
    }
    // little canards
    for (const z of [-1.0, 1.0]) {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.3), accent);
      canard.position.set(1.72, -0.1, z);
      canard.rotation.z = 0.08;
      body.add(canard);
    }

    // headlights
    for (const z of [-0.63, 0.63]) {
      const lightBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), lamp);
      lightBox.position.set(2.145, 0.04, z);
      body.add(lightBox);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlow(), color: 0xa9efff, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      glow.scale.setScalar(0.9);
      glow.position.set(2.2, 0.04, z);
      body.add(glow);
    }
    // taillights
    for (const z of [-0.6, 0.6]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.38), tail);
      box.position.set(-2.19, 0.07, z);
      body.add(box);
    }

    // exhausts
    this.exhaustGlows = [];
    for (const z of [-0.52, 0.52]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 12), carbon);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-2.17, -0.12, z);
      body.add(pipe);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), rimGlow);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-2.34, -0.12, z);
      body.add(ring);

      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlow(), color: c.flame, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      flame.scale.set(1.4, 1, 1);
      flame.position.set(-2.65, -0.12, z);
      body.add(flame);
      this.exhaustGlows.push(flame);
    }

    // wheels
    this.wheels = [];
    for (const x of [-1.38, 1.38]) {
      for (const z of [-0.98, 0.98]) {
        const front = x > 0;
        const pivot = new THREE.Group();
        pivot.position.set(x, -0.32, z);
        const wheel = new THREE.Mesh(wheelGeo, rubber);
        wheel.castShadow = true;
        pivot.add(wheel);
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.z = z > 0 ? 0.01 : -0.01;
        wheel.add(rim);
        // glowing hub ring
        const hub = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18), rimGlow);
        hub.position.z = z > 0 ? 0.235 : -0.235;
        hub.rotation.y = 0;
        wheel.add(hub);
        wheels.add(pivot);
        this.wheels.push({ pivot, wheel, front, side: Math.sign(z) });
      }
    }

    // under-glow on the floor (separate so it stays flat)
    const gtex = getGlow();
    this.groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: gtex, color: new THREE.Color(c.glow).multiplyScalar(1.1), transparent: true,
        opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.scale.set(6, 10, 1);
    this.scene.add(this.groundGlow);

    // player marker
    if (this.isPlayer) {
      const marker = this.marker = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd257).multiplyScalar(2.0), toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), ringMat);
      cone.rotation.x = Math.PI;
      cone.position.y = 0.35;
      marker.add(cone);
      marker.position.y = 2.3;
      this.scene.add(marker);
    }

    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);
  }

  reset(x, z, yaw = 0) {
    this.position.set(x, ARENA.carBaseY, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.quaternion.setFromEuler(new THREE.Euler(0, -yaw, 0));
    this.grounded = true;
    this.boost = 33;
    this.jumps = 0;
    this.jumpTimer = 0;
    this.airTime = 0;
    this.angVel.set(0, 0, 0);
    this.flipPower = 0;
    this.stun = 0;
    this.speed = 0;
    this.steerVisual = 0;
    this.wheelSpin = 0;
    this.bodyGroup.rotation.set(0, 0, 0);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);
    this.groundGlow.position.set(x, 0.055, z);
    this._syncVisuals(0, 0);
  }

  get forward() {
    return this._tmp.v1.set(1, 0, 0).applyQuaternion(this.quaternion);
  }

  get right() {
    return this._tmp.v2.set(0, 0, 1).applyQuaternion(this.quaternion);
  }

  update(dt, controls, world) {
    const ball = world.ball;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.jumpTimer = Math.max(0, this.jumpTimer - dt);
    this.flipPower = Math.max(0, this.flipPower - dt * 2.6);
    this.stun = Math.max(0, this.stun - dt);
    this.landFlash = Math.max(0, this.landFlash - dt * 2);

    const throttle = this.stun > 0 ? 0 : controls.throttle || 0;
    const steer = this.stun > 0 ? 0 : controls.steer || 0;
    const jumpPressed = controls.jumpPressed && this.stun <= 0;
    const wantBoost = controls.boost && this.boost > 0.4 && this.stun <= 0;

    this.boosting = false;
    this.throttleVisual += (throttle - this.throttleVisual) * Math.min(1, dt * 9);

    const forward = this._tmp.v1.set(1, 0, 0).applyQuaternion(this.quaternion);
    const right = this._tmp.v2.set(0, 0, 1).applyQuaternion(this.quaternion);

    if (this.grounded) {
      this.airTime = 0;
      const fwdFlat = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
      const rightFlat = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
      let fwdSpeed = this.velocity.dot(fwdFlat);
      const latSpeed = this.velocity.dot(rightFlat);
      const entrySpeed = this.velocity.length();

      let accel = 0;
      if (throttle > 0.02) {
        accel = 34 * throttle;
      } else if (throttle < -0.02) {
        if (fwdSpeed > 2) accel = 46 * throttle;
        else accel = 15 * throttle;
      }
      if (wantBoost) {
        accel += 35;
        this.boosting = true;
        this.boost = Math.max(0, this.boost - 33 * dt);
      }
      this.velocity.addScaledVector(fwdFlat, accel * dt);

      // rolling resistance / brake: light enough to carry momentum,
      // strong enough that the car settles when the player lets go.
      const spd = this.velocity.length();
      const coasting = Math.abs(throttle) < 0.02 && !wantBoost;
      const resist = coasting
        ? 0.28 + spd * spd * 0.00006
        : 0.18 + spd * spd * 0.00005;
      this.velocity.multiplyScalar(Math.max(0, 1 - resist * dt));

      // lateral grip (cut sideways speed)
      const lat = this.velocity.dot(rightFlat);
      this.velocity.addScaledVector(rightFlat, -lat * Math.min(1, dt * (controls.drift ? 3.6 : 10.5)));
      // small drift when handbrake is held via S at speed? keep planted.

      // steering
      fwdSpeed = this.velocity.dot(fwdFlat);
      const speedAuthority = Math.min(1, 0.4 + Math.abs(fwdSpeed) / 18);
      const dir = fwdSpeed < -0.5 ? -1 : 1;
      this.yaw += steer * 2.25 * speedAuthority * dir * dt * (1 - Math.min(0.3, spd / 260));
      if (wantBoost && Math.abs(fwdSpeed) > 4) this.yaw += steer * 0.35 * dt;

      // speed caps: cap acceleration, but let external impulses/bumps
      // bleed off naturally instead of snapping the car to the limit.
      const cap = this.boosting ? 59 : 38;
      const allowed = Math.max(cap, entrySpeed - 18 * dt);
      const vlen = this.velocity.length();
      if (vlen > allowed) this.velocity.multiplyScalar(allowed / vlen);

      // settle on ground
      this.position.y = ARENA.carBaseY;
      this.velocity.y = 0;

      // align car to ground plane and yaw
      const target = this._tmp.q1.setFromEuler(this._tmp.e1.set(0, -this.yaw, 0));
      this.quaternion.slerp(target, Math.min(1, dt * 13));
      this.angVel.multiplyScalar(Math.max(0, 1 - dt * 12));

      // jump
      if (jumpPressed) {
        this.velocity.y = 13.6;
        this.grounded = false;
        this.jumps = 1;
        this.jumpTimer = 0.18;
        this.airTime = 0;
        this.hooks.onJump?.(this);
        // lift with a little nose-up
        this._applyLocalRotation(0, 0, 0.1);
      }
    } else {
      this.airTime += dt;
      this.velocity.y -= 31 * dt;

      if (wantBoost) {
        this.boosting = true;
        this.boost = Math.max(0, this.boost - 33 * dt);
        this.velocity.addScaledVector(forward, 35 * dt);
      }

      // air drag
      this.velocity.multiplyScalar(Math.max(0, 1 - 0.1 * dt));

      // air control: local pitch (W/S), yaw (A/D), roll (Q/E)
      const roll = controls.roll || 0;
      const targetPitch = -throttle * 4.6;
      const targetYaw = -steer * 3.6;
      const targetRoll = roll * 4.8;
      this.angVel.x += (targetRoll - this.angVel.x) * Math.min(1, dt * 7);
      this.angVel.y += (targetYaw - this.angVel.y) * Math.min(1, dt * 7);
      this.angVel.z += (targetPitch - this.angVel.z) * Math.min(1, dt * 7);
      if (Math.abs(roll) < 0.01 && this.angVel.x !== 0) this.angVel.x *= Math.max(0, 1 - dt * 1.2);
      this._applyLocalRotation(this.angVel.x * dt, this.angVel.y * dt, this.angVel.z * dt);

      // double jump / flip
      if (jumpPressed && this.jumps === 1 && this.jumpTimer <= 0) {
        this.jumps = 2;
        this.flipPower = 1;
        const dodge = new THREE.Vector3(forward.x * throttle + right.x * steer, 0, forward.z * throttle + right.z * steer);
        if (dodge.lengthSq() > 0.04) {
          dodge.normalize();
          this.velocity.addScaledVector(dodge, 15);
          this.velocity.y = Math.max(this.velocity.y, 4.2);
          // spin around the axis perpendicular to dodge for a visible flip
          const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dodge).normalize();
          this.angVel.addScaledVector(axis, -14);
          this._applyLocalRotation(0, 0, 0);
        } else {
          this.velocity.y = 10.8;
          this.angVel.multiplyScalar(0.5);
        }
        this.jumpTimer = 0.25;
        this.hooks.onFlip?.(this);
      }

      if (this.velocity.y < -55) this.velocity.y = -55;

      // land
      if (this.position.y <= ARENA.carBaseY && this.velocity.y <= 0) {
        const spd = Math.hypot(this.velocity.x, this.velocity.z);
        this.position.y = ARENA.carBaseY;
        this.velocity.y = 0;
        this.grounded = true;
        this.jumps = 0;
        this.airTime = 0;
        this.landFlash = 1;
        this.angVel.multiplyScalar(0);
        const fwd = forward;
        if (Math.hypot(fwd.x, fwd.z) > 0.1) this.yaw = Math.atan2(fwd.z, fwd.x);
        const target = this._tmp.q1.setFromEuler(this._tmp.e1.set(0, -this.yaw, 0));
        this.quaternion.slerp(target, 0.8);
        this.hooks.onLand?.(this, spd);
      }
    }

    // integrate
    this.position.addScaledVector(this.velocity, dt);

    // arena bounds
    const xLimit = ARENA.halfLength - 2.7;
    const zLimit = ARENA.halfWidth - 1.9;
    if (this.position.x > xLimit) { this.position.x = xLimit; if (this.velocity.x > 0) this.velocity.x *= -0.25; }
    if (this.position.x < -xLimit) { this.position.x = -xLimit; if (this.velocity.x < 0) this.velocity.x *= -0.25; }
    if (this.position.z > zLimit) { this.position.z = zLimit; if (this.velocity.z > 0) this.velocity.z *= -0.25; }
    if (this.position.z < -zLimit) { this.position.z = -zLimit; if (this.velocity.z < 0) this.velocity.z *= -0.25; }
    if (this.position.y < ARENA.carBaseY) {
      this.position.y = ARENA.carBaseY;
      if (!this.grounded && this.velocity.y <= 0) {
        this.grounded = true;
        this.jumps = 0;
        this.velocity.y = 0;
      }
    }

    this.speed = this.velocity.length();
    this.steerVisual += (steer - this.steerVisual) * Math.min(1, dt * 12);
    this.wheelSpin -= this.speed * dt / 0.5;

    // ball collision
    if (ball) this._collideBall(ball);

    this._syncVisuals(dt, steer);
  }

  _applyLocalRotation(x, y, z) {
    const q = this._tmp.q2;
    if (x) { q.setFromAxisAngle(this._tmp.v3.set(1, 0, 0), x); this.quaternion.multiply(q); }
    if (y) { q.setFromAxisAngle(this._tmp.v3.set(0, 1, 0), y); this.quaternion.multiply(q); }
    if (z) { q.setFromAxisAngle(this._tmp.v3.set(0, 0, 1), z); this.quaternion.multiply(q); }
    this.quaternion.normalize();
  }

  _collideBall(ball) {
    const qInv = this._tmp.q1.copy(this.quaternion).invert();
    const local = this._tmp.v1.copy(ball.position).sub(this.position).applyQuaternion(qInv);
    // chassis half-extents (slightly forgiving)
    const hx = 2.22, hy = 0.52, hz = 1.06;
    const cx = Math.max(-hx, Math.min(hx, local.x));
    const cy = Math.max(-hy, Math.min(hy, local.y));
    const cz = Math.max(-hz, Math.min(hz, local.z));
    const dx = local.x - cx, dy = local.y - cy, dz = local.z - cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const r = ball.radius;
    if (distSq > r * r) return;

    let dist = Math.sqrt(distSq);
    let nx, ny, nz;
    if (dist < 0.0001) {
      // deep overlap: push out through nearest face
      const px = hx - Math.abs(local.x);
      const py = hy - Math.abs(local.y);
      const pz = hz - Math.abs(local.z);
      if (px < py && px < pz) { nx = Math.sign(local.x) || 1; ny = 0; nz = 0; dist = 0; }
      else if (py < pz) { nx = 0; ny = Math.sign(local.y) || 1; nz = 0; dist = 0; }
      else { nx = 0; ny = 0; nz = Math.sign(local.z) || 1; dist = 0; }
    } else {
      nx = dx / dist; ny = dy / dist; nz = dz / dist;
    }

    const normal = this._tmp.v2.set(nx, ny, nz).applyQuaternion(this.quaternion).normalize();
    const pen = r - dist;
    ball.position.addScaledVector(normal, pen + 0.02);

    const rel = this._tmp.v3.copy(ball.velocity).sub(this.velocity);
    const vn = rel.dot(normal);
    const carSpeed = this.velocity.length();

    if (this.hitCooldown <= 0) {
      let strength = 0;
      if (vn < 0) {
        const e = 0.62;
        const impulse = -(1 + e) * vn * 0.96; // ball mass 1, car effectively much heavier
        ball.velocity.addScaledVector(normal, impulse);
        strength = Math.min(2.2, Math.abs(vn) / 18 + carSpeed / 45);
      }
      // transfer momentum from the car's motion into the ball
      const carAlong = Math.max(0, this.velocity.dot(normal));
      if (carAlong > 0.2) {
        ball.velocity.addScaledVector(normal, carAlong * 0.72);
        strength = Math.max(strength, Math.min(2.2, carAlong / 24));
      }
      // nose/flip hits pop the ball
      const upward = Math.min(9.5, Math.abs(vn) * 0.16 + carSpeed * 0.07 + this.flipPower * 3.4);
      ball.velocity.y += upward;
      if (this.flipPower > 0.2) {
        ball.velocity.addScaledVector(this.forward, this.flipPower * 11);
        ball.velocity.y += this.flipPower * 4;
        strength += this.flipPower * 1.2;
      }

      // spin ball with a bit of side english
      ball.angularVelocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * strength * 9,
        (Math.random() - 0.5) * strength * 9,
        (Math.random() - 0.5) * strength * 9
      ));

      // car loses a touch of speed
      this.velocity.multiplyScalar(0.978);
      if (strength > 0.15) {
        this.hitCooldown = 0.09;
        this.hooks.onBallHit?.(this, strength, ball);
      }
      this.lastImpact = strength;
    }
  }

  _syncVisuals(dt, steer) {
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);

    // body lean / pitch
    const spd = Math.min(1, Math.abs(this.velocity.length()) / 45);
    const targetRoll = this.grounded ? -this.steerVisual * 0.075 * spd : 0;
    const targetPitch = this.grounded
      ? Math.max(-0.06, Math.min(0.06, (this.grounded ? -this.throttleVisual : 0) * 0.025 + (this.boosting ? 0.02 : 0)))
      : 0;
    this.bodyGroup.rotation.x += (targetRoll - this.bodyGroup.rotation.x) * Math.min(1, (dt || 0.016) * 10);
    this.bodyGroup.rotation.z += (targetPitch - this.bodyGroup.rotation.z) * Math.min(1, (dt || 0.016) * 10);

    // wheels
    for (const w of this.wheels) {
      w.wheel.rotation.z = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -this.steerVisual * 0.4;
    }

    // boost flames
    this.boostingVisual += ((this.boosting ? 1 : 0) - this.boostingVisual) * Math.min(1, (dt || 0.016) * 18);
    for (const flame of this.exhaustGlows) {
      const flicker = 0.8 + Math.random() * 0.55;
      flame.material.opacity = this.boostingVisual * 0.9;
      flame.scale.set((1.3 + this.boostingVisual * 2.3) * flicker, (1 + this.boostingVisual * 0.9) * flicker, 1);
    }

    // ground glow follows car, fades in air
    const active = this.grounded || this.position.y < 4;
    const glowBase = this.isPlayer ? 0.16 : 0.075;
    this.groundGlow.material.opacity = (active ? glowBase : 0.025) + this.boostingVisual * (this.isPlayer ? 0.08 : 0.035);
    this.groundGlow.position.set(this.position.x, 0.055, this.position.z);
    this.groundGlow.rotation.z = -this.yaw;
    const glowScale = this.isPlayer ? 1 : 0.78;
    this.groundGlow.scale.set((4.7 + this.boostingVisual * 1.7) * glowScale, (8.2 + this.boostingVisual * 2.2) * glowScale, 1);
    this.groundGlow.material.color.setHex(this.colors.glow).multiplyScalar(1 + this.boostingVisual * 0.55);

    if (this.marker) {
      const t = performance.now() * 0.002;
      this.marker.position.set(this.position.x, this.position.y + 2.2 + Math.sin(t * 2.2) * 0.1, this.position.z);
      this.marker.rotation.y = t * 1.4;
      this.marker.visible = !this.grounded || this.position.y < 5;
    }
  }

  addBoost(amount) {
    const before = this.boost;
    this.boost = Math.min(100, this.boost + amount);
    return this.boost - before;
  }

  bump(nx, nz, power = 1) {
    this.velocity.x += nx * power;
    this.velocity.z += nz * power;
    this.stun = Math.min(0.35, this.stun + 0.08 * power / 10);
  }
}

import * as THREE from 'three';
import { groundHeight, terrainNormal, MAP_RADIUS } from './world.js';

const EYE_HEIGHT = 1.72;
const GRAVITY = 21;
const MAX_AMMO = 8;

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Player {
  constructor(camera, scene, effects, audio, callbacks = {}) {
    this.camera = camera;
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.callbacks = callbacks;

    this.position = new THREE.Vector3(-168, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI / 2;
    this.pitch = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.energy = 100;
    this.maxEnergy = 100;
    this.ammo = MAX_AMMO;
    this.maxAmmo = MAX_AMMO;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 1.65;
    this.fireCooldown = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.onGround = false;
    this.skiing = false;
    this.jetting = false;
    this.energyDelay = 0;
    this.jumpHeld = false;
    this.jumpedAt = -10;
    this.bobPhase = 0;
    this.shake = 0;
    this.time = 0;
    this.speed = 0;
    this.carriedFlag = null;
    this.zoom = false;
    this.fov = 78;
    this.fireHeld = false;
    this.reloadQueued = false;
    this.recoil = 0;
    this.jetEmitTimer = 0;
    this.skiEmitTimer = 0;
    this.landDust = 0;
    this.kills = 0;
    this.deaths = 0;

    this.weaponGroup = this.buildWeapon();
    this.weaponGroup.scale.setScalar(0.5);
    this.muzzleFlash = this.buildMuzzle();
    this.weaponGroup.add(this.muzzleFlash.sprite, this.muzzleFlash.light);
    camera.add(this.weaponGroup);
    const viewLight = new THREE.PointLight(0xa9ecff, 1.8, 3.4, 2);
    viewLight.position.set(0.35, 0.1, 0.35);
    camera.add(viewLight);
    this.muzzleTimer = 0;
  }

  buildWeapon() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6e8394, roughness: 0.48, metalness: 0.34, emissive: 0x15222d, emissiveIntensity: 1.0 });
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x3c4b58, roughness: 0.55, metalness: 0.34, emissive: 0x101922, emissiveIntensity: 1.1 });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x7af7ff, emissive: 0x2ed8ee, emissiveIntensity: 1.6, roughness: 0.28, metalness: 0.35,
    });
    const warm = new THREE.MeshStandardMaterial({
      color: 0xffb464, emissive: 0xff7b2b, emissiveIntensity: 1.5, roughness: 0.4,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.62, 8), metal);
    body.rotation.x = Math.PI / 2;
    body.rotation.z = Math.PI / 8;
    body.position.set(0, 0, -0.12);
    group.add(body);

    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.26), metalDark);
    rear.position.set(0, -0.005, 0.16);
    group.add(rear);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.15, 0.17, 16), metal);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0.01, -0.5);
    group.add(disc);

    const discFace = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), metalDark);
    discFace.rotation.x = Math.PI / 2;
    discFace.position.set(0, 0.01, -0.6);
    group.add(discFace);

    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.028, 8, 28), accent);
    muzzleRing.position.set(0, 0.01, -0.615);
    group.add(muzzleRing);

    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.06, 12), metalDark);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.01, -0.6);
    group.add(emitter);

    for (const z of [-0.08, -0.24]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.014, 6, 20), accent);
      coil.position.set(0, 0, z);
      group.add(coil);
    }

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.34), metal);
    topRail.position.set(0, 0.12, -0.06);
    group.add(topRail);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.1), accent);
    sight.position.set(0, 0.17, -0.14);
    group.add(sight);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.12), metalDark);
    grip.position.set(0, -0.16, 0.08);
    grip.rotation.x = -0.24;
    group.add(grip);

    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), warm);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0.09, -0.05, -0.06);
    group.add(cell);

    const cellRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 16), accent);
    cellRing.rotation.y = Math.PI / 2;
    cellRing.position.set(0.09, -0.05, -0.06);
    group.add(cellRing);

    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.04), metal);
    hook.position.set(-0.1, 0.02, -0.22);
    group.add(hook);

    const powerStrip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.34), accent);
    powerStrip.position.set(-0.092, 0.03, -0.2);
    group.add(powerStrip);
    const statusLamp = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), warm);
    statusLamp.position.set(0.085, 0.08, 0.02);
    group.add(statusLamp);

    group.position.set(0.4, -0.37, -0.74);
    group.rotation.set(0.03, -0.06, 0);
    group.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    group.userData.spin = [cellRing];
    return group;
  }

  buildMuzzle() {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0x9dfbff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0,
    }));
    sprite.position.set(0, 0.015, -0.82);
    sprite.scale.set(0.2, 0.2, 1);
    sprite.visible = false;
    const light = new THREE.PointLight(0x8ff4ff, 0, 7, 2);
    light.position.set(0, 0.05, -0.72);
    return { sprite, light };
  }

  setLookSensitivityScale() {
    return this.zoom ? 0.52 : 1;
  }

  applyLook(dx, dy) {
    if (!this.alive) return;
    const sensitivity = 0.00215 * this.setLookSensitivityScale();
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.03;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  respawn(position, yaw = Math.PI / 2) {
    this.position.copy(position);
    this.position.y = groundHeight(position.x, position.z) + 0.05;
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.energy = this.maxEnergy;
    this.ammo = this.maxAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.onGround = true;
    this.skiing = false;
    this.jetting = false;
    this.carriedFlag = null;
    this.weaponGroup.visible = true;
    this.weaponGroup.position.set(0.34, -0.32, -0.76);
    this.shake = 0;
    this.audio.setJet(false);
    this.audio.setSki(false);
  }

  damage(amount, source = null) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.shake = Math.min(1.2, this.shake + amount * 0.012);
    this.audio.damage();
    this.callbacks.onDamage?.(amount, source);
    if (this.health <= 0) this.die(source);
  }

  die(source = null) {
    if (!this.alive) return;
    this.alive = false;
    this.deaths++;
    this.deathTimer = 3.4;
    this.weaponGroup.visible = false;
    this.audio.setJet(false);
    this.audio.setSki(false);
    this.effects.deathBurst(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x54e7ff);
    this.callbacks.onDeath?.(source);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  startReload() {
    if (this.reloading || this.ammo === this.maxAmmo || !this.alive) return;
    this.reloading = true;
    this.reloadTimer = this.reloadDuration;
    this.audio.reload();
  }

  fire() {
    if (!this.alive || this.reloading || this.fireCooldown > 0) return;
    if (this.ammo <= 0) {
      this.audio.empty();
      this.startReload();
      return;
    }
    this.ammo--;
    this.fireCooldown = 0.9;
    this.recoil = 1;
    this.shake = Math.min(1.2, this.shake + 0.08);
    this.muzzleTimer = 0.07;
    this.muzzleFlash.sprite.visible = true;
    this.muzzleFlash.sprite.material.opacity = 1;
    this.muzzleFlash.sprite.scale.setScalar(0.2 + Math.random() * 0.1);
    this.muzzleFlash.light.intensity = 8;
    this.audio.fire();

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position.clone()
      .addScaledVector(dir, 0.9)
      .addScaledVector(right, 0.16)
      .add(new THREE.Vector3(0, -0.1, 0));
    const velocity = dir.clone().multiplyScalar(96).addScaledVector(this.velocity, 0.32);
    this.callbacks.onFire?.({ origin, velocity, team: 'blue', owner: 'player', damage: 100, splash: 8 });

    this.effects.sparks(this.camera.position.clone().addScaledVector(dir, 1.0), 0x9ffbff, 4);
    if (this.ammo === 0) this.reloadQueued = true;
  }

  update(dt, input) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.4);

    if (!this.alive) {
      this.deathTimer -= dt;
      this.camera.position.set(this.position.x, this.position.y + 0.6, this.position.z);
      this.camera.rotation.set(-0.5, this.yaw, 0.35, 'YXZ');
      return;
    }

    const forwardInput = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafeInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wish = new THREE.Vector3(
      -sin * forwardInput + cos * strafeInput, 0,
      -cos * forwardInput - sin * strafeInput
    );
    if (wish.lengthSq() > 1) wish.normalize();
    const hasWish = wish.lengthSq() > 0.001;

    this.zoom = !!input.zoom && !this.reloading;
    const targetFov = this.zoom ? 55 : 78;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 9);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const normal = terrainNormal(this.position.x, this.position.z);
    this.skiing = this.onGround && !!input.ski && horizontalSpeed > 2.4 && !this.jetting;

    if (this.onGround) {
      if (this.skiing) {
        const downhill = new THREE.Vector3(normal.x, 0, normal.z);
        const slope = Math.min(1, downhill.length() * 3.4);
        if (slope > 0.02) {
          downhill.normalize();
          this.velocity.x += downhill.x * 21 * slope * dt;
          this.velocity.z += downhill.z * 21 * slope * dt;
        }
        if (hasWish) {
          this.velocity.x += wish.x * 12 * dt;
          this.velocity.z += wish.z * 12 * dt;
        }
        const friction = Math.exp(-0.38 * dt);
        this.velocity.x *= friction;
        this.velocity.z *= friction;
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed > 46) {
          this.velocity.x *= 46 / speed;
          this.velocity.z *= 46 / speed;
        }
        this.skiEmitTimer -= dt;
        if (this.skiEmitTimer <= 0 && horizontalSpeed > 7) {
          this.skiEmitTimer = 0.035;
          const foot = this.position.clone();
          foot.y += 0.16;
          this.effects.ski(foot, 0xc8fbff, horizontalSpeed);
        }
      } else {
        const friction = Math.exp(-10 * dt);
        this.velocity.x *= friction;
        this.velocity.z *= friction;
        if (hasWish) {
          const accel = 58 * dt;
          this.velocity.x += wish.x * accel;
          this.velocity.z += wish.z * accel;
          const speed = Math.hypot(this.velocity.x, this.velocity.z);
          if (speed > 12.5) {
            const scale = 12.5 / speed;
            this.velocity.x *= scale;
            this.velocity.z *= scale;
          }
        }
      }
    } else if (hasWish) {
      this.velocity.x += wish.x * 15 * dt;
      this.velocity.z += wish.z * 15 * dt;
    }

    const jumpPressed = !!input.jump;
    if (jumpPressed && !this.jumpHeld && this.onGround) {
      this.velocity.y = 9.6;
      this.onGround = false;
      this.jumpedAt = this.time;
      this.audio.jump();
      this.effects.dust(this.position.clone(), 0xc2d8de, 4);
    }
    this.jumpHeld = jumpPressed;

    this.jetting = false;
    if (jumpPressed && !this.onGround && this.energy > 0.5 && this.time - this.jumpedAt > 0.1) {
      this.jetting = true;
      this.energy = Math.max(0, this.energy - 31 * dt);
      this.energyDelay = 0.55;
      this.velocity.y += 31 * dt;
      if (this.velocity.y > 15) this.velocity.y = 15;
      if (hasWish) {
        this.velocity.x += wish.x * 2.6 * dt;
        this.velocity.z += wish.z * 2.6 * dt;
      }
      this.jetEmitTimer -= dt;
      if (this.jetEmitTimer <= 0) {
        this.jetEmitTimer = 0.028;
        const flameOrigin = this.position.clone().add(new THREE.Vector3(0, 0.9, 0));
        const back = new THREE.Vector3(-sin * -1, 0, -cos * -1).multiplyScalar(-0.25);
        flameOrigin.add(back);
        this.effects.jet(flameOrigin, 0x5fe9ff);
      }
    }

    if (this.energyDelay > 0) this.energyDelay -= dt;
    if (!this.jetting) {
      if (this.energyDelay <= 0) {
        const regen = this.onGround ? 31 : 20;
        this.energy = Math.min(this.maxEnergy, this.energy + regen * dt);
      }
    }

    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt;
      this.velocity.y = Math.max(-45, this.velocity.y);
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const limit = MAP_RADIUS - 22;
    if (Math.abs(this.position.x) > limit) {
      this.position.x = Math.sign(this.position.x) * limit;
      this.velocity.x = 0;
    }
    if (Math.abs(this.position.z) > limit) {
      this.position.z = Math.sign(this.position.z) * limit;
      this.velocity.z = 0;
    }

    const ground = groundHeight(this.position.x, this.position.z);
    const wasOnGround = this.onGround;
    if (this.position.y <= ground + 0.02) {
      const impact = -this.velocity.y;
      this.position.y = ground;
      this.onGround = true;
      if (!wasOnGround && impact > 8) {
        const strength = Math.min(1, impact / 30);
        this.shake = Math.min(1.4, this.shake + strength * 0.75);
        this.effects.dust(this.position.clone(), 0xd8d2bd, 4 + Math.round(strength * 7));
        this.audio.land();
        if (impact > 31) this.damage((impact - 31) * 2.6, { name: 'THE GROUND', team: 'blue' });
      }
      this.velocity.y = 0;
      if (this.skiing) {
        const downhill = new THREE.Vector3(normal.x, 0, normal.z);
        if (downhill.lengthSq() > 0.001) {
          downhill.normalize();
          this.velocity.x += downhill.x * 21 * Math.min(1, downhill.length() * 3.4) * dt;
          this.velocity.z += downhill.z * 21 * Math.min(1, downhill.length() * 3.4) * dt;
        }
      }
    } else if (this.position.y > ground + 0.12) {
      this.onGround = false;
    }

    if (input.reloadPressed) this.startReload();
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.maxAmmo;
        this.reloadQueued = false;
      }
    } else if (this.reloadQueued) {
      this.startReload();
      this.reloadQueued = false;
    }
    if (input.fire) this.fire();

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.bobPhase += this.speed * dt * (this.onGround ? 1.55 : 0.3);
    const bobAmount = this.onGround && !this.skiing ? Math.min(0.055, this.speed * 0.0036) : 0.008;
    const bobY = Math.sin(this.bobPhase * 2) * bobAmount;
    const bobX = Math.cos(this.bobPhase) * bobAmount * 0.6;
    const right = new THREE.Vector3(cos, 0, -sin);

    const shakeX = (Math.random() - 0.5) * this.shake * 0.025;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.025;
    const roll = -strafeInput * 0.018 - (this.skiing ? Math.sign(this.velocity.x * cos - this.velocity.z * sin) * 0.01 : 0);

    this.camera.position.set(
      this.position.x + right.x * bobX,
      this.position.y + EYE_HEIGHT + bobY,
      this.position.z + right.z * bobX
    );
    this.camera.rotation.set(this.pitch + shakeY, this.yaw + shakeX, roll, 'YXZ');

    this.audio.setJet(this.jetting);
    this.audio.setSki(this.skiing, this.speed);

    this.updateWeapon(dt, input);
  }

  updateWeapon(dt, input) {
    this.recoil = Math.max(0, this.recoil - dt * 4.8);
    const back = this.recoil * 0.085;
    const sway = Math.sin(this.bobPhase) * 0.008 * Math.min(1, this.speed / 10);
    const narrow = this.camera.aspect < 0.85;
    const targetX = (narrow ? 0.2 : 0.4) + sway;
    const targetY = (narrow ? -0.33 : -0.37) + Math.abs(Math.cos(this.bobPhase)) * 0.004 * Math.min(1, this.speed / 10);
    const targetZ = -0.74 + back;
    this.weaponGroup.position.x += (targetX - this.weaponGroup.position.x) * Math.min(1, dt * 12);
    this.weaponGroup.position.y += (targetY - this.weaponGroup.position.y) * Math.min(1, dt * 12);
    this.weaponGroup.position.z += (targetZ - this.weaponGroup.position.z) * Math.min(1, dt * 18);
    this.weaponGroup.rotation.x = 0.03 + this.recoil * 0.14;
    this.weaponGroup.rotation.z = -this.recoil * 0.04;
    this.weaponGroup.rotation.y = -0.06 + Math.sin(this.time * 0.6) * 0.004;
    if (this.zoom) {
      const t = Math.min(1, dt * 10);
      this.weaponGroup.position.x += (0.14 - this.weaponGroup.position.x) * t;
      this.weaponGroup.position.y += (-0.19 - this.weaponGroup.position.y) * t;
      this.weaponGroup.position.z += (-0.68 - this.weaponGroup.position.z) * t;
    }
    const cellRing = this.weaponGroup.userData.spin?.[0];
    if (cellRing) cellRing.rotation.x += dt * 2.4;

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.sprite.visible = false;
        this.muzzleFlash.light.intensity = 0;
      } else {
        this.muzzleFlash.light.intensity = 8 * (this.muzzleTimer / 0.07);
      }
    }

    if (this.skiing && this.speed > 18) {
      this.camera.fov = Math.min(this.camera.fov + dt * 6, 84);
      this.camera.updateProjectionMatrix();
    }
  }

  muzzleWorldPosition(target = new THREE.Vector3()) {
    return this.muzzleFlash.sprite.getWorldPosition(target);
  }
}

import * as THREE from 'three';
import { buildWeaponModel, weaponFor, WEAPONS } from './weapons.js';
import { createBuildGhost, placeBuildPiece, setBuildGhostValid, BUILD_COST, BUILD_MATERIALS, BUILD_WALL_HEIGHT } from './building.js';

const GRAVITY = -24;
const UP = new THREE.Vector3(0, 1, 0);

function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

function box(parent, mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class Player {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.pos = new THREE.Vector3(0, 10, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.42;
    this.height = 1.82;
    this.grounded = false;
    this.mode = 'menu';
    this.dead = false;

    this.health = 100;
    this.armor = 0;
    this.meds = 2;
    this.kills = 0;
    this.damageDealt = 0;
    this.materials = BUILD_MATERIALS;

    this.weapons = [
      { id: 'ar', mag: 30, reserve: 90 },
      null,
    ];
    this.currentSlot = 0;
    this.reloadTimer = 0;
    this.reloadTotal = 0;
    this.fireCooldown = 0;
    this.fireWasDown = false;
    this.shotSpread = 0;
    this.aiming = false;
    this.healTimer = 0;
    this.healTotal = 0;
    this.stepTimer = 0;
    this.walkPhase = 0;
    this.moveSpeed = 0;
    this.chuteOpen = false;
    this.dropAlt = 0;
    this.shake = 0;
    this.cameraKick = 0;
    this.lastDamageTime = -10;
    this.buildMode = false;
    this.buildType = 'wall';
    this.buildValid = false;
    this.buildTransform = { x: 0, z: 0, y: 0, ry: 0 };
    this.input = {
      moveF: 0, moveR: 0, fire: false, aim: false, sprint: false, crouch: false, jump: false,
    };

    this.model = new THREE.Group();
    this.group = new THREE.Group();
    this.group.add(this.model);
    this.scene.add(this.group);
    this.group.visible = false;
    this.buildBody();
    this.buildWeaponModels();
    this.buildParachute();
    this.buildGhosts();
  }

  buildBody() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98564, roughness: 0.82 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x3c4a3d, roughness: 0.85 });
    const vest = new THREE.MeshStandardMaterial({ color: 0x59634b, roughness: 0.7, metalness: 0.08 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x41463d, roughness: 0.9 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 0.86 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xd6a949, roughness: 0.6, metalness: 0.18 });

    const torso = new THREE.Group();
    box(torso, shirt, 0.62, 0.68, 0.34, 0, 1.2, 0);
    box(torso, vest, 0.68, 0.52, 0.4, 0, 1.22, -0.01);
    box(torso, accent, 0.14, 0.1, 0.03, 0.18, 1.44, -0.21);
    box(torso, boots, 0.5, 0.12, 0.36, 0, 0.9, 0);
    const backpack = box(torso, new THREE.MeshStandardMaterial({ color: 0x2e352e, roughness: 0.88 }), 0.44, 0.54, 0.24, 0, 1.25, 0.27);
    backpack.castShadow = true;
    this.model.add(torso);

    this.head = new THREE.Group();
    box(this.head, skin, 0.28, 0.3, 0.28, 0, 1.76, 0);
    box(this.head, new THREE.MeshStandardMaterial({ color: 0x2a2f2a, roughness: 0.75 }), 0.34, 0.13, 0.34, 0, 1.94, 0);
    box(this.head, new THREE.MeshStandardMaterial({ color: 0x1d241f, roughness: 0.8 }), 0.33, 0.04, 0.1, 0, 1.86, 0.13);
    this.model.add(this.head);

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.93, 0);
    box(this.leftLeg, pants, 0.2, 0.58, 0.24, 0, -0.28, 0);
    box(this.leftLeg, boots, 0.22, 0.22, 0.34, 0, -0.63, -0.04);
    this.model.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.93, 0);
    box(this.rightLeg, pants, 0.2, 0.58, 0.24, 0, -0.28, 0);
    box(this.rightLeg, boots, 0.22, 0.22, 0.34, 0, -0.63, -0.04);
    this.model.add(this.rightLeg);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.38, 1.44, 0);
    box(this.leftArm, shirt, 0.14, 0.56, 0.17, 0, -0.25, 0);
    box(this.leftArm, skin, 0.13, 0.14, 0.15, 0, -0.55, 0);
    this.model.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.38, 1.44, 0);
    box(this.rightArm, shirt, 0.14, 0.56, 0.17, 0, -0.25, 0);
    box(this.rightArm, skin, 0.13, 0.14, 0.15, 0, -0.55, 0);
    this.model.add(this.rightArm);

    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0.3, 1.23, -0.36);
    this.model.add(this.weaponMount);
  }

  buildWeaponModels() {
    this.weaponModels = {};
    for (const id of Object.keys(WEAPONS)) {
      const model = buildWeaponModel(id);
      model.visible = false;
      this.weaponMount.add(model);
      this.weaponModels[id] = model;
    }
    this.updateWeaponVisual();
  }

  buildParachute() {
    this.parachute = new THREE.Group();
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xe8ddc2, roughness: 0.88, side: THREE.DoubleSide });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xc9623e, roughness: 0.82, side: THREE.DoubleSide });
    const canopyGeo = new THREE.SphereGeometry(2.0, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    canopyGeo.scale(1, 0.55, 1);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 4.3;
    canopy.castShadow = true;
    this.parachute.add(canopy);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const panel = new THREE.Mesh(new THREE.SphereGeometry(1.99, 4, 3, a, Math.PI / 4, 0, Math.PI / 2).scale(1, 0.552, 1), orangeMat);
      panel.position.y = 4.31;
      this.parachute.add(panel);
    }
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x2e2b22, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const end = new THREE.Vector3(Math.cos(a) * 1.85, 4.25, Math.sin(a) * 1.85);
      const start = new THREE.Vector3(Math.cos(a) * 0.35, 1.35, Math.sin(a) * 0.35);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dir = end.clone().sub(start);
      const len = dir.length();
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), lineMat);
      line.position.copy(mid);
      line.quaternion.setFromUnitVectors(UP, dir.normalize());
      this.parachute.add(line);
    }
    this.parachute.visible = false;
    this.group.add(this.parachute);
  }

  buildGhosts() {
    this.ghosts = {};
    for (const type of ['wall', 'floor', 'ramp']) {
      const ghost = createBuildGhost(type);
      ghost.visible = false;
      this.scene.add(ghost);
      this.ghosts[type] = ghost;
    }
  }

  resetForDeploy() {
    this.dead = false;
    this.mode = 'drop';
    this.health = 100;
    this.armor = 0;
    this.meds = 2;
    this.kills = 0;
    this.damageDealt = 0;
    this.materials = BUILD_MATERIALS;
    this.weapons = [{ id: 'ar', mag: 30, reserve: 90 }, null];
    this.currentSlot = 0;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.healTimer = 0;
    this.buildMode = false;
    this.group.visible = true;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.chuteOpen = false;
    this.parachute.visible = false;
    this.weaponMount.visible = true;
    this.updateWeaponVisual();
    for (const ghost of Object.values(this.ghosts)) ghost.visible = false;
  }

  startDrop(x, z) {
    this.pos.set(x, 188, z);
    this.vel.set(0, -8, 0);
    this.yaw = 0.9;
    this.pitch = -0.32;
    this.mode = 'drop';
    this.grounded = false;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.visible = true;
    this.chuteOpen = false;
    this.parachute.visible = false;
    this.weaponMount.visible = false;
  }

  get active() {
    return this.weapons[this.currentSlot];
  }

  get activeDef() {
    return this.active ? weaponFor(this.active.id) : null;
  }

  updateWeaponVisual() {
    if (!this.weaponModels) return;
    for (const [id, model] of Object.entries(this.weaponModels)) {
      model.visible = false;
      if (this.active && this.active.id === id) model.visible = !this.buildMode && this.mode !== 'drop';
    }
  }

  switchWeapon(slot, game) {
    if (!this.weapons[slot] || slot === this.currentSlot) return;
    this.currentSlot = slot;
    this.reloadTimer = 0;
    this.fireCooldown = 0.18;
    this.updateWeaponVisual();
    if (game) {
      game.audio.click();
      game.ui?.toast(this.activeDef.name, 'WEAPON READY', 'gold');
    }
  }

  toggleBuild(game) {
    if (this.mode !== 'playing' || this.dead) return;
    this.buildMode = !this.buildMode;
    this.weaponMount.visible = !this.buildMode;
    this.updateWeaponVisual();
    if (this.buildMode) {
      this.reloadTimer = 0;
      this.healTimer = 0;
      game.ui?.setBuildMode(true, this.buildType, this.materials);
    } else {
      for (const ghost of Object.values(this.ghosts)) ghost.visible = false;
      game.ui?.setBuildMode(false);
    }
    game.audio.click();
  }

  setBuildType(type, game) {
    if (!this.buildMode) return;
    this.buildType = type;
    for (const [key, ghost] of Object.entries(this.ghosts)) ghost.visible = key === type;
    game?.ui?.setBuildMode(true, type, this.materials);
    game?.audio.click();
  }

  onReload(game) {
    if (this.dead || this.mode !== 'playing' || this.buildMode) return;
    const w = this.active;
    if (!w) return;
    const def = weaponFor(w.id);
    if (this.reloadTimer > 0 || w.mag >= def.mag || w.reserve <= 0) return;
    this.reloadTotal = def.reload;
    this.reloadTimer = def.reload;
    this.healTimer = 0;
    game.audio.reload();
  }

  startHeal(game) {
    if (this.dead || this.mode !== 'playing' || this.buildMode) return;
    if (this.meds <= 0 || this.health >= 100 || this.healTimer > 0) return;
    this.healTotal = 1.5;
    this.healTimer = 1.5;
    this.reloadTimer = 0;
    game.audio.heal();
    game.ui?.toast('FIELD MEDKIT', 'HEALING IN PROGRESS', 'gold');
  }

  requestJump() {
    if (this.grounded && !this.dead) {
      this.vel.y = 7.5;
      this.grounded = false;
      this.input.jump = true;
    }
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.clampPitch();
  }

  clampPitch() {
    const min = this.mode === 'drop' ? -1.25 : -1.05;
    const max = this.mode === 'drop' ? 0.35 : 0.92;
    this.pitch = Math.max(min, Math.min(max, this.pitch));
  }

  update(dt, game) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.shotSpread = Math.max(0, this.shotSpread - dt * 0.11);
    this.shake = Math.max(0, this.shake - dt * 5);
    this.clampPitch();

    if (this.mode === 'drop') {
      this.updateDrop(dt, game);
      this.animate(dt);
      this.updateCamera(game.camera, dt);
      return;
    }
    if (this.mode !== 'playing' || this.dead) {
      this.animate(dt);
      this.updateCamera(game.camera, dt);
      return;
    }

    this.updateMovement(dt, game);
    this.updateActions(dt, game);
    if (this.buildMode) this.updateBuild(dt, game);
    this.checkPickups(game, dt);
    this.animate(dt);
    this.updateCamera(game.camera, dt);
  }

  updateDrop(dt, game) {
    if (this.dropAlt === 0) this.dropAlt = this.pos.y;
    const ground = this.world.terrainHeight(this.pos.x, this.pos.z);
    const altitude = this.pos.y - ground;
    this.dropAlt = altitude;
    if (!this.chuteOpen && altitude < 55) {
      this.chuteOpen = true;
      this.parachute.visible = true;
      this.vel.y = -9;
      game.audio.tone(180, 0.3, 0.08, 'sawtooth', 90);
      game.ui?.toast('PARACHUTE DEPLOYED', 'STEER TOWARD A COMPOUND', 'gold');
    }

    const f = this.input.moveF;
    const r = this.input.moveR;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = fwd.multiplyScalar(f).add(right.multiplyScalar(r));
    if (desired.lengthSq() > 0) desired.normalize();
    const hSpeed = this.chuteOpen ? 7.2 : 19;
    this.vel.x = damp(this.vel.x, desired.x * hSpeed, 2.4, dt);
    this.vel.z = damp(this.vel.z, desired.z * hSpeed, 2.4, dt);
    const targetFall = this.chuteOpen ? -7.4 : -31;
    this.vel.y = damp(this.vel.y, targetFall, this.chuteOpen ? 3.2 : 1.4, dt);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > 226) { this.pos.x *= 226 / d; this.pos.z *= 226 / d; }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.parachute.rotation.y = -this.yaw * 0.2;

    const g = this.world.terrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= g + 0.08) {
      let x = this.pos.x, z = this.pos.z;
      let guard = 0;
      while (this.world.terrainHeight(x, z) < 0.45 && guard < 30) {
        x *= 0.94; z *= 0.94; guard++;
      }
      this.pos.set(x, Math.max(this.world.terrainHeight(x, z), 0.5), z);
      this.vel.set(0, 0, 0);
      this.mode = 'playing';
      this.grounded = true;
      this.chuteOpen = false;
      this.parachute.visible = false;
      this.weaponMount.visible = !this.buildMode;
      this.updateWeaponVisual();
      this.world.resolveCircle(this.pos, this.radius, this.height);
      this.group.position.copy(this.pos);
      game.audio.land();
      game.effects.dust(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z));
      game.onLanded();
      this.pitch = -0.08;
    }
  }

  updateMovement(dt, game) {
    const input = this.input;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = fwd.multiplyScalar(input.moveF).add(right.multiplyScalar(input.moveR));
    if (desired.lengthSq() > 1) desired.normalize();
    const moving = desired.lengthSq() > 0.001;

    this.aiming = input.aim && !this.buildMode;
    let speed = input.sprint && !this.aiming && !this.buildMode ? 7.3 : 5.15;
    if (this.aiming) speed = 3.1;
    if (input.crouch) speed = 2.6;
    if (this.buildMode) speed = 4.4;
    if (this.healTimer > 0) speed = 2.2;
    if (!moving) speed = 0;

    const accel = this.grounded ? 13 : 3.5;
    this.vel.x = damp(this.vel.x, desired.x * speed, accel, dt);
    this.vel.z = damp(this.vel.z, desired.z * speed, accel, dt);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.resolveCircle(this.pos, this.radius, this.height);

    this.vel.y += GRAVITY * dt;
    this.pos.y += this.vel.y * dt;
    const support = this.world.surfaceHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= support) {
      this.pos.y = support;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    if (this.pos.y < -2) {
      this.damage(25, null, game);
      this.pos.y = support;
      this.vel.y = 0;
    }

    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && this.moveSpeed > 0.7) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = input.sprint ? 0.3 : 0.43;
        game.audio.footstep(this.aiming ? 0.025 : input.sprint ? 0.055 : 0.04);
      }
    } else {
      this.stepTimer = 0;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  updateActions(dt, game) {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const w = this.active;
        const def = weaponFor(w.id);
        const need = def.mag - w.mag;
        const take = Math.min(need, w.reserve);
        w.mag += take;
        w.reserve -= take;
        this.reloadTimer = 0;
        game.audio.reloadDone();
        game.ui?.toast(def.name, 'RELOADED', 'gold');
      }
    }

    if (this.healTimer > 0) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = 0;
        this.meds = Math.max(0, this.meds - 1);
        this.health = Math.min(100, this.health + 45);
        game.audio.pickup();
        game.ui?.toast('FIELD MEDKIT USED', '+45 HEALTH', 'gold');
      }
    }

    const fireDown = this.input.fire;
    const firePressed = fireDown && !this.fireWasDown;
    this.fireWasDown = fireDown;

    if (this.buildMode) {
      if (firePressed) this.placeBuild(game);
      return;
    }

    if (this.input.aim) this.shotSpread = Math.max(0, this.shotSpread - dt * 0.2);

    if (this.fireCooldown <= 0 && !this.reloadTimer && this.healTimer <= 0) {
      const def = this.activeDef;
      if (def && (def.auto ? fireDown : firePressed)) {
        this.fire(game);
      }
    }
  }

  fire(game) {
    const w = this.active;
    const def = this.activeDef;
    if (!w || !def) return;
    if (w.mag <= 0) {
      this.onReload(game);
      game.audio.click();
      if (this.reloadTimer <= 0) game.ui?.toast('OUT OF AMMO', 'FIND AMMUNITION', 'red');
      return;
    }
    w.mag--;
    this.fireCooldown = 60 / def.rpm;
    const spreadBase = def.spread * (1 + Math.min(1.8, this.moveSpeed * 0.11)) * (this.aiming ? 0.62 : 1) * (this.input.crouch ? 0.78 : 1);
    this.shotSpread = Math.min(0.12, this.shotSpread + spreadBase * 2.2);
    this.cameraKick = def.damage > 60 ? 0.07 : 0.022;
    this.shake = Math.max(this.shake, def.id === 'sniper' ? 0.2 : 0.055);

    const camera = game.camera;
    const origin = camera.position.clone();
    const baseDir = new THREE.Vector3();
    camera.getWorldDirection(baseDir);
    const model = this.weaponModels[def.id];
    const muzzle = new THREE.Vector3();
    if (model) {
      model.updateMatrixWorld(true);
      muzzle.set(0, 0.03, model.userData.muzzleZ);
      model.localToWorld(muzzle);
      const flash = model.userData.flash;
      if (flash) {
        flash.visible = true;
        flash.material.opacity = 1;
        flash.material.rotation = Math.random() * Math.PI * 2;
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(() => { flash.visible = false; }, 46);
      }
    } else {
      muzzle.copy(origin);
    }

    for (let p = 0; p < def.pellets; p++) {
      const dir = baseDir.clone();
      const spread = spreadBase * (def.pellets > 1 ? 1.9 : 1);
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
      const hit = game.hitscan(origin, dir, def.range, this);
      const end = hit ? hit.point : origin.clone().add(dir.multiplyScalar(def.range));
      game.effects.tracer(muzzle, end, def.id === 'sniper' ? 0xffe9b0 : 0xffc76a, def.id === 'sniper' ? 1 : 0.8);
      if (hit) {
        if (hit.bot) {
          const falloff = Math.max(0.62, 1 - hit.distance / def.range * 0.38);
          const dmg = def.damage * falloff * (hit.head ? def.headshot : 1);
          hit.bot.damage(dmg, game, this, def, hit.head);
          this.damageDealt += dmg;
          game.ui?.hitmarker(hit.head, hit.bot.health <= 0);
          game.audio.hit(hit.head);
          game.effects.blood(hit.point, hit.head);
        } else {
          game.effects.impact(hit.point, hit.kind);
        }
      }
    }

    this.pitch += this.cameraKick * (0.75 + Math.random() * 0.5);
    this.yaw += (Math.random() - 0.5) * this.cameraKick * 0.35;
    this.clampPitch();
    game.audio.shot(def.sound, 0, 0, 1);
    if (w.mag === 0) game.ui?.toast('MAGAZINE EMPTY', 'PRESS R TO RELOAD', 'red');
  }

  updateBuild(dt, game) {
    const type = this.buildType;
    for (const [key, ghost] of Object.entries(this.ghosts)) ghost.visible = key === type;
    const ghost = this.ghosts[type];
    const snapped = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const dist = type === 'wall' ? 3.5 : type === 'ramp' ? 3.2 : 3.1;
    let x = this.pos.x + forward.x * dist;
    let z = this.pos.z + forward.z * dist;
    x = Math.round(x / 2) * 2;
    z = Math.round(z / 2) * 2;

    const support = this.world.surfaceHeight(this.pos.x, this.pos.z, this.pos.y);
    let y;
    if (type === 'wall') y = this.world.surfaceHeight(x, z, this.pos.y + 0.75);
    else if (type === 'floor') y = support + (this.pitch > 0.16 ? 2.9 : 0.02);
    else y = support + 0.02;

    const dx = x - this.pos.x, dz = z - this.pos.z;
    const rounded = Math.round(snapped / (Math.PI / 2)) * (Math.PI / 2);
    ghost.position.set(x, y, z);
    ghost.rotation.y = rounded;

    const insideIsland = Math.hypot(x, z) < 220;
    const ground = this.world.terrainHeight(x, z);
    let blocked = false;
    const cy = y + (type === 'wall' ? 1.2 : 0.4);
    for (const box of this.world.colliders) {
      if (x > box.minX - 0.3 && x < box.maxX + 0.3 && z > box.minZ - 0.3 && z < box.maxZ + 0.3 && cy > box.minY && cy < box.maxY) {
        blocked = true;
        break;
      }
    }
    const tooFar = Math.hypot(dx, dz) > 7;
    const valid = insideIsland && ground > 0.4 && !blocked && !tooFar && this.materials >= BUILD_COST;
    this.buildValid = valid;
    setBuildGhostValid(ghost, valid);
    this.buildTransform = { x, z, y, ry: rounded, type };
    game.ui?.updateBuildValid(valid, this.materials);
  }

  placeBuild(game) {
    if (!this.buildValid || this.materials < BUILD_COST) {
      game.audio.click();
      return;
    }
    const t = this.buildTransform;
    placeBuildPiece(this.world, t.type, t.x, t.z, t.y, t.ry);
    this.materials -= BUILD_COST;
    game.audio.reloadDone();
    game.effects.dust(new THREE.Vector3(t.x, t.y + 0.1, t.z));
    game.ui?.setBuildMode(true, this.buildType, this.materials);
  }

  checkPickups(game, dt = 1 / 60) {
    if (!this._pickupTimer || this._pickupTimer <= 0) {
      this._pickupTimer = 0.18;
      const item = this.world.nearestLoot(this.pos, 2.3);
      if (item) this.pickup(item, game);
    } else {
      this._pickupTimer -= dt;
    }
  }

  pickup(item, game) {
    const type = item.type;
    if (type === 'weapon') {
      const def = weaponFor(item.weaponId);
      const same = this.weapons.findIndex(w => w && w.id === item.weaponId);
      if (same >= 0) {
        const w = this.weapons[same];
        w.reserve = Math.min(def.reserveMax, w.reserve + def.pickupAmmo);
        game.ui?.toast(def.name, `+${def.pickupAmmo} AMMO`, 'gold');
      } else {
        const empty = this.weapons.findIndex(w => !w);
        const slot = empty >= 0 ? empty : this.currentSlot;
        this.weapons[slot] = { id: item.weaponId, mag: def.mag, reserve: def.pickupAmmo };
        if (empty < 0 || slot === this.currentSlot) {
          this.currentSlot = slot;
          this.updateWeaponVisual();
        }
        game.ui?.toast(def.name, 'WEAPON ACQUIRED', 'gold');
      }
    } else if (type === 'ammo') {
      const w = this.active;
      if (w) {
        const def = weaponFor(w.id);
        const add = Math.max(def.pickupAmmo, 20);
        const before = w.reserve;
        w.reserve = Math.min(def.reserveMax, w.reserve + add);
        game.ui?.toast('AMMUNITION', `+${w.reserve - before} RESERVE`, 'gold');
      } else {
        game.ui?.toast('AMMUNITION', 'NO WEAPON EQUIPPED', 'red');
        return;
      }
    } else if (type === 'med') {
      if (this.meds >= 3) {
        game.ui?.toast('MEDKITS FULL', '3 MAX', 'red');
        return;
      }
      this.meds = Math.min(3, this.meds + 1);
      game.ui?.toast('FIELD MEDKIT', 'PRESS F TO HEAL', 'gold');
    } else if (type === 'armor') {
      if (this.armor >= 100) {
        game.ui?.toast('ARMOR FULL', '100 MAX', 'red');
        return;
      }
      this.armor = Math.min(100, this.armor + 50);
      game.ui?.toast('BALLISTIC PLATE', '+50 ARMOR', 'gold');
    }
    this.world.removeLoot(item);
    game.audio.pickup();
  }

  damage(amount, attacker, game, ignoreArmor = false) {
    if (this.dead || this.mode !== 'playing') return;
    let dmg = amount;
    if (!ignoreArmor && this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.55);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.health -= dmg;
    this.lastDamageTime = game.elapsed;
    this.healTimer = 0;
    this.shake = Math.max(this.shake, Math.min(0.3, amount * 0.012));
    game.ui?.damage(amount, attacker);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.mode = 'dead';
      this.weaponMount.visible = false;
      this.parachute.visible = false;
      this.model.rotation.x = -Math.PI / 2;
      this.model.position.y = 0.42;
      for (const ghost of Object.values(this.ghosts)) ghost.visible = false;
      game.onPlayerDeath(attacker);
    }
  }

  animate(dt) {
    if (this.mode === 'drop') {
      this.leftArm.rotation.z = -1.1 + Math.sin(this.walkPhase) * 0.05;
      this.rightArm.rotation.z = 1.1 - Math.sin(this.walkPhase) * 0.05;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.leftLeg.rotation.x = 0.18;
      this.rightLeg.rotation.x = -0.12;
      this.walkPhase += dt * 2;
      return;
    }
    if (this.dead) return;
    const speed = this.moveSpeed;
    if (speed > 0.25 && this.grounded) {
      this.walkPhase += dt * (5.2 + speed * 1.15);
      const swing = Math.min(0.9, 0.32 + speed * 0.075);
      this.leftLeg.rotation.x = Math.sin(this.walkPhase) * swing;
      this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * swing;
      this.leftArm.rotation.x = -Math.sin(this.walkPhase) * swing * 0.65;
      this.rightArm.rotation.x = Math.sin(this.walkPhase) * swing * 0.65;
    } else {
      this.walkPhase += dt * 1.4;
      const breathe = Math.sin(this.walkPhase) * 0.035;
      this.leftLeg.rotation.x = damp(this.leftLeg.rotation.x, 0, 8, dt);
      this.rightLeg.rotation.x = damp(this.rightLeg.rotation.x, 0, 8, dt);
      this.leftArm.rotation.x = damp(this.leftArm.rotation.x, breathe, 8, dt);
      this.rightArm.rotation.x = damp(this.rightArm.rotation.x, breathe, 8, dt);
    }
    this.leftArm.rotation.z = this.aiming ? -0.24 : 0;
    this.rightArm.rotation.z = this.aiming ? -0.18 : 0;
    if (this.aiming) {
      this.rightArm.rotation.x = -1.2;
      this.leftArm.rotation.x = -1.34;
    }
    if (!this.grounded) {
      this.leftLeg.rotation.x = 0.35;
      this.rightLeg.rotation.x = -0.2;
    }
  }

  updateCamera(camera, dt) {
    const pivot = new THREE.Vector3(this.pos.x, this.pos.y + 1.58, this.pos.z);
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    forward.normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const drop = this.mode === 'drop';
    const aimZoom = this.aiming && this.mode === 'playing';
    let dist = drop ? 10.5 : aimZoom ? 2.55 : 4.75;
    let side = drop ? 3.6 : aimZoom ? 0.52 : 0.76;
    let up = drop ? 1.0 : 0.26;
    if (this.input.sprint && !aimZoom && !drop) dist += 0.35;

    const desired = pivot.clone().addScaledVector(forward, -dist).addScaledVector(right, side).addScaledVector(UP, up);

    const toCam = desired.clone().sub(pivot);
    const distToCam = toCam.length();
    if (distToCam > 0.2) {
      const dir = toCam.clone().normalize();
      const hit = this.world.raycastStatic(pivot, dir, distToCam);
      if (hit && hit.distance < distToCam) {
        desired.copy(pivot).addScaledVector(dir, Math.max(0.55, hit.distance - 0.22));
        desired.y += 0.12;
      }
    }
    const terrainAtCam = this.world.terrainHeight(desired.x, desired.z) + 0.42;
    if (desired.y < terrainAtCam) desired.y = terrainAtCam;

    const bob = this.mode === 'playing' && this.grounded && this.moveSpeed > 0.6
      ? Math.sin(this.walkPhase * 2) * 0.026 * Math.min(1, this.moveSpeed / 5)
      : 0;
    desired.y += bob;

    const smooth = 1 - Math.exp(-(drop ? 6 : 18) * dt);
    camera.position.lerp(desired, smooth);
    if (this.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
    }

    const lookAt = pivot.clone().addScaledVector(forward, 12).addScaledVector(right, aimZoom ? 0.48 : 0.58);
    if (drop) lookAt.copy(pivot).addScaledVector(forward, 18);
    camera.lookAt(lookAt);

    const targetFov = drop ? 72 : aimZoom ? (this.active?.id === 'sniper' ? 38 : 48) : this.input.sprint ? 70 : 66;
    camera.fov = damp(camera.fov, targetFov, 8, dt);
    camera.updateProjectionMatrix();
  }

  ammoText() {
    const w = this.active;
    const def = this.activeDef;
    if (!w || !def) return { mag: 0, reserve: 0 };
    return { mag: w.mag, reserve: w.reserve };
  }

  resetVelocity() {
    this.vel.set(0, 0, 0);
  }
}

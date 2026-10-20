import * as THREE from 'three';
import { BASE_POSITIONS, TEAM_COLORS, groundHeight } from './world.js';

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function whiteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sharedGlow = typeof document !== 'undefined' ? glowTexture() : null;
const sharedWhite = typeof document !== 'undefined' ? whiteTexture() : null;

class Bot {
  constructor(manager, team, name, index, spawnIndex) {
    this.manager = manager;
    this.team = team;
    this.name = name;
    this.index = index;
    this.spawnIndex = spawnIndex;
    this.enemyTeam = team === 'blue' ? 'red' : 'blue';
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = team === 'blue' ? Math.PI / 2 : -Math.PI / 2;
    this.health = 100;
    this.maxHealth = 100;
    this.alive = true;
    this.respawnTimer = 0;
    this.fireCooldown = 1 + Math.random() * 2;
    this.jetTimer = 0;
    this.jetCooldown = 2 + Math.random() * 5;
    this.jetting = false;
    this.onGround = true;
    this.carrierFlag = null;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.objective = new THREE.Vector3();
    this.target = null;
    this.aimTarget = new THREE.Vector3();
    this.role = spawnIndex === 0 ? 'defend' : 'attack';
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.deathTimer = 0;
    this.group = this.buildMesh();
    this.manager.scene.add(this.group);
    this.reset();
  }

  buildMesh() {
    const group = new THREE.Group();
    const teamColor = TEAM_COLORS[this.team].clone();
    const armor = new THREE.MeshStandardMaterial({ color: 0x3a4e5e, roughness: 0.48, metalness: 0.55, emissive: teamColor.clone().multiplyScalar(0.16), emissiveIntensity: 0.9 });
    const armorDark = new THREE.MeshStandardMaterial({ color: 0x1b2833, roughness: 0.62, metalness: 0.45, emissive: teamColor.clone().multiplyScalar(0.09), emissiveIntensity: 0.8 });
    const accent = new THREE.MeshStandardMaterial({
      color: teamColor, emissive: teamColor, emissiveIntensity: 1.9, roughness: 0.36, metalness: 0.32,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: 0xf4feff, emissive: teamColor, emissiveIntensity: 2.8, roughness: 0.15, metalness: 0.4,
    });
    this.materials = { armor, armorDark, accent, visor };

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 5, 10), armor);
    torso.position.y = 1.16;
    torso.castShadow = true;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.44, 0.38), armorDark);
    chest.position.set(0, 1.27, -0.04);
    chest.castShadow = true;
    group.add(chest);
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.4), accent);
    chestPlate.position.set(0, 1.34, -0.05);
    group.add(chestPlate);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), armorDark);
    head.position.y = 1.74;
    head.scale.set(0.92, 1.06, 0.95);
    head.castShadow = true;
    group.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), armor);
    helmet.position.y = 1.79;
    helmet.castShadow = true;
    group.add(helmet);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.06), visor);
    visorMesh.position.set(0, 1.75, -0.2);
    group.add(visorMesh);
    this.visor = visorMesh;

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.2, 0.3), armor);
      shoulder.position.set(side * 0.38, 1.4, 0);
      shoulder.rotation.z = side * -0.15;
      shoulder.castShadow = true;
      group.add(shoulder);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), armorDark);
      arm.position.set(side * 0.4, 1.06, 0.02);
      arm.rotation.z = side * 0.12;
      arm.castShadow = true;
      group.add(arm);

      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 4, 8), armor);
      thigh.position.y = -0.4;
      thigh.castShadow = true;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.36, 4, 8), armorDark);
      shin.position.y = -0.88;
      shin.castShadow = true;
      leg.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.36), armorDark);
      boot.position.set(0, -1.08, -0.05);
      boot.castShadow = true;
      leg.add(boot);
      leg.position.set(side * 0.15, 0.92, 0);
      group.add(leg);
      if (side === -1) this.leftLeg = leg;
      else this.rightLeg = leg;
    }

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.28), armorDark);
    backpack.position.set(0, 1.24, 0.26);
    backpack.castShadow = true;
    group.add(backpack);
    const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.02), accent);
    packGlow.position.set(0, 1.18, 0.41);
    group.add(packGlow);

    const thrusterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedGlow, color: teamColor, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    thrusterGlow.position.set(0, 0.86, 0.24);
    thrusterGlow.scale.set(0.9, 1.4, 1);
    group.add(thrusterGlow);
    this.thrusterGlow = thrusterGlow;

    const weapon = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.62), armorDark);
    weapon.add(gunBody);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.4, 8), armor);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.z = -0.44;
    weapon.add(gunBarrel);
    const gunGlow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.22), accent);
    gunGlow.position.set(0, 0.02, -0.2);
    weapon.add(gunGlow);
    weapon.position.set(0.3, 1.18, -0.24);
    weapon.rotation.y = 0;
    group.add(weapon);
    this.weapon = weapon;

    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.56, 28),
      new THREE.MeshBasicMaterial({
        color: teamColor, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.06;
    group.add(aura);
    this.aura = aura;

    const barGroup = new THREE.Group();
    barGroup.position.y = 2.25;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.11),
      new THREE.MeshBasicMaterial({ map: sharedWhite, color: 0x07131f, transparent: true, opacity: 0.72, depthWrite: false })
    );
    bg.position.z = 0.002;
    barGroup.add(bg);
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.065),
      new THREE.MeshBasicMaterial({ map: sharedWhite, color: teamColor, transparent: true, opacity: 0.96, depthWrite: false })
    );
    fill.position.z = 0.004;
    barGroup.add(fill);
    const pip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      new THREE.MeshBasicMaterial({ color: teamColor })
    );
    pip.position.set(0, 0.15, 0);
    barGroup.add(pip);
    group.add(barGroup);
    this.healthBar = barGroup;
    this.healthFill = fill;

    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const ctx = nameCanvas.getContext('2d');
    ctx.font = '700 34px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226,250,255,0.92)';
    ctx.shadowColor = `#${teamColor.getHexString()}`;
    ctx.shadowBlur = 14;
    ctx.fillText(this.name, 128, 30);
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    nameTexture.colorSpace = THREE.SRGBColorSpace;
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nameTexture, transparent: true, depthWrite: false, depthTest: false, opacity: 0.88,
    }));
    nameSprite.position.y = 2.55;
    nameSprite.scale.set(1.7, 0.42, 1);
    group.add(nameSprite);
    this.nameSprite = nameSprite;

    group.traverse((object) => {
      if (object.isMesh) {
        object.receiveShadow = false;
      }
    });
    return group;
  }

  spawnPoint() {
    const base = BASE_POSITIONS[this.team];
    const inward = this.team === 'blue' ? 1 : -1;
    const spots = [
      [8, -4], [15, 7], [12, -9], [19, 2], [6, 11], [22, -6],
    ];
    const [forward, side] = spots[this.spawnIndex % spots.length];
    return new THREE.Vector3(base.x + inward * forward, 0, base.z + side);
  }

  reset() {
    const spawn = this.spawnPoint();
    this.position.set(spawn.x, groundHeight(spawn.x, spawn.z), spawn.z);
    if (this.team === 'blue' && this.spawnIndex === 1) {
      this.position.set(-118, 0, -26);
      this.position.y = groundHeight(-118, -26);
    }
    if (this.team === 'red') {
      const shuffle = [
        new THREE.Vector3(154, 0, 22),
        new THREE.Vector3(96, 0, 44),
        new THREE.Vector3(146, 0, -62),
        new THREE.Vector3(-94, 0, -16),
        new THREE.Vector3(120, 0, 110),
        new THREE.Vector3(168, 0, -120),
      ];
      const pick = shuffle[this.spawnIndex % shuffle.length];
      this.position.x = pick.x;
      this.position.z = pick.z;
      this.position.y = groundHeight(pick.x, pick.z);
    }
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.deathTimer = 0;
    this.respawnTimer = 0;
    this.carrierFlag = null;
    this.fireCooldown = 0.8 + Math.random() * 1.8;
    this.jetTimer = 0;
    this.jetCooldown = 2 + Math.random() * 4;
    this.jetting = false;
    this.group.visible = true;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.team === 'blue' ? Math.PI / 2 : -Math.PI / 2;
    this.healthBar.visible = true;
    this.updateHealthBar();
  }

  takeDamage(amount, attacker) {
    if (!this.alive) return;
    this.health -= amount;
    this.manager.effects.sparks(
      this.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      TEAM_COLORS[this.team], 6
    );
    if (attacker && attacker.type === 'player') {
      this.manager.callbacks.onHit?.();
      this.manager.audio.hit();
    }
    if (this.health <= 0) {
      this.die(attacker);
    } else {
      this.updateHealthBar();
    }
  }

  die(attacker) {
    this.alive = false;
    this.deathTimer = 5.2;
    this.group.visible = false;
    this.manager.effects.deathBurst(
      this.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
      TEAM_COLORS[this.team]
    );
    this.manager.audio.explosion();
    this.manager.callbacks.onBotKilled?.(this, attacker);
  }

  updateHealthBar() {
    const ratio = Math.max(0, this.health / this.maxHealth);
    this.healthFill.scale.x = Math.max(0.001, ratio);
    this.healthFill.position.x = -(1 - ratio) * 0.54;
    this.healthFill.material.color.copy(TEAM_COLORS[this.team]);
    this.healthFill.material.opacity = ratio < 0.35 ? 0.98 : 0.8;
    this.healthBar.visible = ratio < 0.999;
  }

  chooseObjective(player, flags, elapsed = 0) {
    const ownFlag = flags[this.team];
    const enemyFlag = flags[this.enemyTeam];
    const ownBase = BASE_POSITIONS[this.team];
    const enemyBase = BASE_POSITIONS[this.enemyTeam];

    if (this.carrierFlag) {
      return new THREE.Vector3(ownBase.x, 0, ownBase.z);
    }
    if (ownFlag.carrier && ownFlag.carrier.team !== this.team) {
      const carrierPos = ownFlag.carrier === 'player' ? player.position : ownFlag.carrier.position;
      return carrierPos.clone();
    }
    if (this.role === 'defend' && !enemyFlag.carrier) {
      const nearest = this.manager.nearestEnemy(this, player, 85);
      if (nearest) return nearest.position.clone();
      const patrol = Math.sin(elapsed * 0.35 + this.index * 1.9) * 15;
      return new THREE.Vector3(ownBase.x + (this.team === 'blue' ? 15 : -15), 0, ownBase.z + patrol);
    }
    if (enemyFlag.dropped) {
      return enemyFlag.group.position.clone();
    }
    if (enemyFlag.carrier) {
      if (enemyFlag.carrier.team === this.team) {
        return new THREE.Vector3(ownBase.x, 0, ownBase.z);
      }
      const carrierPos = enemyFlag.carrier === 'player' ? player.position : enemyFlag.carrier.position;
      return carrierPos.clone();
    }
    return new THREE.Vector3(enemyBase.x, 0, enemyBase.z);
  }

  update(dt, elapsed, player, flags) {
    this.group.updateMatrixWorld();
    this.healthBar.quaternion.copy(this.manager.camera.quaternion);
    const nameDistance = player.position.distanceTo(this.position);
    this.nameSprite.material.opacity = nameDistance > 7 && nameDistance < 60 ? 0.88 : 0;

    if (!this.alive) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.reset();
      return;
    }

    const ownFlag = flags[this.team];
    const enemyFlag = flags[this.enemyTeam];
    const objective = this.chooseObjective(player, flags, elapsed);
    this.objective.copy(objective);

    const enemy = this.manager.nearestEnemy(this, player, 120);
    this.target = enemy;
    const distanceToEnemy = enemy ? this.position.distanceTo(enemy.position) : Infinity;

    const dx = objective.x - this.position.x;
    const dz = objective.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    let dirX = distance > 0.4 ? dx / distance : 0;
    let dirZ = distance > 0.4 ? dz / distance : 0;

    if (distanceToEnemy < 34 && enemy && !enemy.isPlayer) {
      const side = Math.sin(elapsed * 1.3 + this.index * 2.1) > 0 ? 1 : -1;
      const ex = enemy.position.x - this.position.x;
      const ez = enemy.position.z - this.position.z;
      const ed = Math.max(1, Math.hypot(ex, ez));
      dirX += (-ez / ed) * side * 0.8;
      dirZ += (ex / ed) * side * 0.8;
      const mag = Math.hypot(dirX, dirZ) || 1;
      dirX /= mag;
      dirZ /= mag;
    }

    const closeToGoal = distance < 1.8;
    const ski = distance > 25 && this.onGround;
    const desiredSpeed = closeToGoal ? 0 : ski ? 15.5 : 8.5;
    const accel = this.onGround ? 15 : 6;
    this.velocity.x += (dirX * desiredSpeed - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (dirZ * desiredSpeed - this.velocity.z) * Math.min(1, accel * dt);

    if (dirX !== 0 || dirZ !== 0) {
      const targetYaw = Math.atan2(-dirX, -dirZ);
      let delta = targetYaw - this.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.yaw += delta * Math.min(1, dt * 7);
    }
    this.group.rotation.y = this.yaw;

    this.jetCooldown -= dt;
    if (this.onGround && this.jetCooldown <= 0 && distance > 18 && Math.random() < dt * 0.7) {
      this.jetTimer = 1 + Math.random() * 1.4;
      this.jetCooldown = 5 + Math.random() * 7;
      this.velocity.y = 8.5;
      this.onGround = false;
    }

    this.jetting = this.jetTimer > 0;
    if (this.jetting) {
      this.jetTimer -= dt;
      this.velocity.y += 29 * dt;
      if (this.velocity.y > 13) this.velocity.y = 13;
      this.thrusterGlow.material.opacity = 0.85 + Math.random() * 0.15;
      this.thrusterGlow.scale.set(0.8, 1.7 + Math.random() * 0.5, 1);
      if (Math.random() < 0.7) {
        this.manager.effects.jet(
          this.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
          TEAM_COLORS[this.team]
        );
      }
    } else {
      this.thrusterGlow.material.opacity = 0;
    }

    if (!this.onGround) this.velocity.y -= 21 * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const ground = groundHeight(this.position.x, this.position.z);
    if (this.position.y <= ground) {
      if (!this.onGround && this.velocity.y < -11) {
        this.manager.effects.dust(this.position.clone(), 0xc6cbb6, 3);
      }
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (this.onGround && this.position.y - ground < 0.7 && this.velocity.y <= 0) {
      this.position.y = ground;
    } else {
      this.onGround = false;
    }

    this.group.position.copy(this.position);

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.walkPhase += dt * (4 + speed * 0.8);
    const swing = Math.sin(this.walkPhase) * Math.min(0.8, speed * 0.055);
    if (this.leftLeg) this.leftLeg.rotation.x = swing;
    if (this.rightLeg) this.rightLeg.rotation.x = -swing;
    this.aura.material.opacity = 0.16 + Math.sin(elapsed * 2 + this.index) * 0.05;
    this.visor.material.emissiveIntensity = 3.4 + Math.sin(elapsed * 4 + this.index) * 0.6;

    if (enemy && distanceToEnemy < 95) {
      const eye = new THREE.Vector3(this.position.x, this.position.y + 1.55, this.position.z);
      const targetPos = enemy.isPlayer
        ? new THREE.Vector3(enemy.position.x, enemy.position.y + 1.5, enemy.position.z)
        : new THREE.Vector3(enemy.position.x, enemy.position.y + 1.2, enemy.position.z);
      const aimDx = targetPos.x - eye.x;
      const aimDy = targetPos.y - eye.y;
      const aimDz = targetPos.z - eye.z;
      const yawToTarget = Math.atan2(-aimDx, -aimDz);
      const smooth = Math.min(1, dt * 5);
      let aimDelta = yawToTarget - this.group.rotation.y;
      aimDelta = Math.atan2(Math.sin(aimDelta), Math.cos(aimDelta));
      this.group.rotation.y += aimDelta * smooth;

      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0 && distanceToEnemy < 78) {
        this.fireCooldown = 1.25 + Math.random() * 1.5;
        const spread = 0.035 + distanceToEnemy * 0.00045;
        const dir = new THREE.Vector3(aimDx, aimDy + 0.35, aimDz).normalize();
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        const origin = eye.clone().addScaledVector(dir, 0.65);
        const velocity = dir.multiplyScalar(76);
        this.manager.callbacks.onBotFire?.({
          origin, velocity, team: this.team, owner: this, damage: 34, splash: 6.5,
        });
        this.manager.audio.fire();
        this.manager.effects.sparks(origin, TEAM_COLORS[this.team], 3);
      }
    }

    this.aura.material.color.copy(TEAM_COLORS[this.team]);

    if (this.carrierFlag) {
      this.carrierFlag.group.position.copy(this.position).add(new THREE.Vector3(0, 1.6, 0));
    }
    if (this.carrierFlag && this.carrierFlag === enemyFlag) {
      const base = BASE_POSITIONS[this.team];
      if (Math.hypot(this.position.x - base.x, this.position.z - base.z) < 7) {
        this.manager.callbacks.onBotCapture?.(this);
      }
    }
  }
}

export class BotManager {
  constructor(scene, camera, world, effects, audio, callbacks = {}) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.callbacks = callbacks;
    this.player = null;
    this.bots = [];
    this.elapsed = 0;

    const redNames = ['RAZOR', 'VEX', 'KILO', 'HEX'];
    const blueNames = ['NOVA', 'JINX'];
    redNames.forEach((name, i) => this.bots.push(new Bot(this, 'red', name, i, i)));
    blueNames.forEach((name, i) => this.bots.push(new Bot(this, 'blue', name, redNames.length + i, i)));
  }

  setPlayer(player) {
    this.player = player;
  }

  resetAll() {
    this.bots.forEach(bot => bot.reset());
  }

  nearestEnemy(bot, player, maxDistance) {
    const candidates = [];
    if (bot.enemyTeam === 'blue' && player.alive) {
      candidates.push({ position: player.position, isPlayer: true, ref: player, team: 'blue' });
    }
    for (const other of this.bots) {
      if (other === bot || !other.alive || other.team !== bot.enemyTeam) continue;
      candidates.push({ position: other.position, isPlayer: false, ref: other, team: other.team });
    }
    let best = null;
    let bestDist = maxDistance;
    for (const candidate of candidates) {
      const d = bot.position.distanceTo(candidate.position);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    return best;
  }

  damageBot(bot, amount, attacker) {
    bot.takeDamage(amount, attacker);
  }

  aliveCount(team) {
    return this.bots.filter(b => b.team === team && b.alive).length;
  }

  update(dt, elapsed) {
    if (!this.player) return;
    this.elapsed = elapsed;
    for (const bot of this.bots) {
      bot.update(dt, elapsed, this.player, this.world.flags);
    }
  }
}

import * as THREE from 'three';
import {
  pathX, pathSlope, trackYaw, halfWidth, clamp, damp, noise1, TRACK_LENGTH
} from './track.js';

const TAU = Math.PI * 2;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

function shared() {
  if (shared._cache) return shared._cache;
  const hull = new THREE.MeshStandardMaterial({ color: '#181527', metalness: .78, roughness: .36 });
  const dark = new THREE.MeshStandardMaterial({ color: '#090913', metalness: .55, roughness: .52 });
  const rust = new THREE.MeshStandardMaterial({ color: '#3a1b28', metalness: .65, roughness: .45 });
  const red = new THREE.MeshBasicMaterial({ color: '#ff315f', toneMapped: false });
  const orange = new THREE.MeshBasicMaterial({ color: '#ff8a3d', toneMapped: false });
  const cyan = new THREE.MeshBasicMaterial({ color: '#2ef2ff', toneMapped: false });
  const glass = new THREE.MeshStandardMaterial({
    color: '#170914', metalness: .9, roughness: .18,
    emissive: new THREE.Color('#8d143f'), emissiveIntensity: 1.2
  });
  shared._cache = { hull, dark, rust, red, orange, cyan, glass };
  return shared._cache;
}

function makeRaider(kind = 'scout') {
  const M = shared();
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const scale = kind === 'heavy' ? 1.35 : 1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(.6, 2.3, 6), kind === 'heavy' ? M.rust : M.hull);
  body.rotation.x = Math.PI / 2;
  body.scale.z = .72;
  g.add(body);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.26, .44, 1.1, 6), M.dark);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -1.3;
  g.add(tail);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), kind === 'heavy' ? M.orange : M.red);
  eye.position.set(0, .02, 1.06);
  g.add(eye);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.55, .08, .62), M.dark);
    wing.position.set(side * 1.02, -.02, -.18);
    wing.rotation.z = side * .24;
    wing.rotation.y = side * -.34;
    g.add(wing);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.1, .028, .035), kind === 'heavy' ? M.orange : M.red);
    edge.position.set(side * 1.05, .06, .3);
    edge.rotation.y = side * -.34;
    edge.rotation.z = side * .24;
    g.add(edge);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(.06, .62, .5), M.hull);
    fin.position.set(side * .3, .26, -1.15);
    fin.rotation.z = side * -.28;
    g.add(fin);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeOrbTexture(), color: kind === 'heavy' ? '#ff9a3d' : '#ff2f92',
      transparent: true, opacity: .65, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }));
    glow.scale.set(1.4, 1.4, 1);
    glow.position.set(side * .2, 0, -1.75);
    g.add(glow);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeTurret() {
  const M = shared();
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.3, 1.5, 6), M.dark);
  base.rotation.z = Math.PI / 2;
  g.add(base);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.05, 1.25), M.hull);
  head.position.x = -.55;
  g.add(head);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, 2.6, 6), M.rust);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-1.9, 0, 0);
  g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.23, 8, 6), M.red);
  muzzle.position.set(-3.15, 0, 0);
  g.add(muzzle);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeOrbTexture(), color: '#ff315f', transparent: true, opacity: .5,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  glow.scale.set(2.1, 2.1, 1);
  glow.position.set(-3.15, 0, 0);
  g.add(glow);
  return g;
}

let orbTex;
function makeOrbTexture() {
  if (orbTex) return orbTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.22, 'rgba(255,255,255,.68)');
  gr.addColorStop(.6, 'rgba(255,255,255,.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  orbTex = new THREE.CanvasTexture(c);
  orbTex.colorSpace = THREE.SRGBColorSpace;
  return orbTex;
}

function makeBullet(color, length = 2.2) {
  const geo = new THREE.CapsuleGeometry(.04, length, 3, 4);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .95, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false
  }));
  return m;
}

function makePlasma(color, scale = 1) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(.2 * scale, 8, 6), new THREE.MeshBasicMaterial({
    color: '#fff4ff', toneMapped: false
  }));
  g.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeOrbTexture(), color, transparent: true, opacity: .9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  glow.scale.set(1.9 * scale, 1.9 * scale, 1);
  g.add(glow);
  return g;
}

function makeMissile() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.1, .13, 1.25, 6), shared().hull);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.1, .35, 6), shared().red);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = .79;
  g.add(nose);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .26), shared().dark);
    fin.position.z = -.5;
    fin.rotation.z = i * TAU / 3;
    g.add(fin);
  }
  return g;
}

function makePickup(kind) {
  const g = new THREE.Group();
  const color = kind === 'health' ? '#71ffb0' : '#ffb347';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .075, 5, 20), new THREE.MeshBasicMaterial({
    color, toneMapped: false
  }));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(.25, 0), new THREE.MeshBasicMaterial({
    color: '#ffffff', toneMapped: false
  }));
  g.add(inner);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeOrbTexture(), color, transparent: true, opacity: .6,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  glow.scale.set(2.4, 2.4, 1);
  g.add(glow);
  g.userData.spin = ring;
  g.userData.kind = kind;
  return g;
}

function segmentSphere(prev, next, center, radius) {
  const dx = next.x - prev.x, dy = next.y - prev.y, dz = next.z - prev.z;
  const fx = center.x - prev.x, fy = center.y - prev.y, fz = center.z - prev.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = len2 > 0 ? (fx * dx + fy * dy + fz * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = prev.x + dx * t, py = prev.y + dy * t, pz = prev.z + dz * t;
  const ex = center.x - px, ey = center.y - py, ez = center.z - pz;
  return ex * ex + ey * ey + ez * ez <= radius * radius;
}

export class CombatSystem {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;

    this.enemies = [];
    this.turrets = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.missiles = [];
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.spawnTimer = 2.4;
    this.turretTimer = 8;
    this.wave = 1;
    this.time = 0;
    this.fireTimer = 0;
    this.missileCharges = 3;
    this.missileRegen = 0;
    this.kills = 0;
    this.bossKills = 0;

    this.callbacks = {
      onKill: () => {},
      onBossNode: () => {},
      onBossDefeated: () => {},
      onPlayerHit: () => {},
      onPickup: () => {},
    };

    this.bulletGeo = new THREE.CapsuleGeometry(.035, 2.1, 3, 4);
    this.bulletGeo.rotateX(Math.PI / 2);
    this.plasmaGeo = new THREE.SphereGeometry(.2, 8, 6);
    this.orbTexture = makeOrbTexture();
  }

  reset() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const t of this.turrets) this.scene.remove(t.mesh);
    for (const b of this.playerBullets) this.scene.remove(b.mesh);
    for (const b of this.enemyBullets) this.scene.remove(b.mesh);
    for (const m of this.missiles) this.scene.remove(m.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    if (this.boss) this.scene.remove(this.boss.root);
    this.enemies = [];
    this.turrets = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.missiles = [];
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.spawnTimer = 2.2;
    this.turretTimer = 9;
    this.wave = 1;
    this.time = 0;
    this.fireTimer = 0;
    this.missileCharges = 3;
    this.missileRegen = 0;
    this.kills = 0;
    this.bossKills = 0;
  }

  startBoss(playerS) {
    if (this.bossActive) return;
    this.bossActive = true;
    this.bossDefeated = false;
    this.boss = this.buildBoss();
    this.scene.add(this.boss.root);
    this.boss.s = playerS + 230;
    this.boss.x = 0;
    this.boss.y = 25;
    this.boss.root.position.set(pathX(this.boss.s), this.boss.y, -this.boss.s);
    this.audio.alarm();
  }

  /* ------------------------------------------------------------------ */
  /* spawn / ai                                                         */
  /* ------------------------------------------------------------------ */

  spawnRaider(playerS, sector, kindOverride) {
    const kind = kindOverride || (Math.random() < .22 + sector * .045 ? 'heavy' : 'scout');
    const s = playerS + 560 + Math.random() * 260;
    const w = halfWidth(s);
    const xRel = (Math.random() - .5) * 1.55 * (w - 6);
    const y = 7 + Math.random() * 25;
    const mesh = makeRaider(kind);
    const hp = kind === 'heavy' ? 6 : 2;
    const enemy = {
      kind, mesh, s, xRel, y, hp, maxHp: hp, radius: kind === 'heavy' ? 2.6 : 2.1,
      phase: Math.random() * TAU, amp: 4 + Math.random() * 12,
      freq: .55 + Math.random() * .5, fire: 1.4 + Math.random() * 2.2,
      speed: 38 + Math.random() * 34 + sector * 7, dead: false,
      bank: 0, hitFlash: 0, score: kind === 'heavy' ? 300 : 120,
    };
    mesh.position.set(pathX(s) + xRel, y, -s);
    mesh.rotation.y = 0;
    this.scene.add(mesh);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnTurret(playerS, sector) {
    const side = Math.random() < .5 ? -1 : 1;
    const s = playerS + 520 + Math.random() * 220;
    const w = halfWidth(s);
    const y = 8 + Math.random() * 20;
    const mesh = makeTurret();
    mesh.position.set(pathX(s) + side * (w - 1.4), y, -s);
    mesh.rotation.y = side > 0 ? Math.PI : 0;
    const turret = {
      mesh, s, side, y, hp: 4 + Math.floor(sector * .7), maxHp: 4 + Math.floor(sector * .7),
      radius: 2.8, fire: 2.5 + Math.random() * 2.6, dead: false, score: 180, hitFlash: 0
    };
    this.scene.add(mesh);
    this.turrets.push(turret);
  }

  updateSpawns(dt, playerS, sector) {
    if (this.bossActive) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const alive = this.enemies.length;
      const maxAlive = 5 + sector * 2;
      if (alive < maxAlive) {
        const count = 1 + Math.floor(Math.random() * (1.5 + sector * .6));
        for (let i = 0; i < count && this.enemies.length < maxAlive; i++) {
          this.spawnRaider(playerS, sector);
        }
        this.wave = Math.floor(playerS / 520) + 1;
      }
      this.spawnTimer = Math.max(1.7, 4.5 - sector * .75) + Math.random() * 1.6;
    }
    this.turretTimer -= dt;
    if (this.turretTimer <= 0 && sector >= 1) {
      if (this.turrets.length < 3) this.spawnTurret(playerS, sector);
      this.turretTimer = 8 + Math.random() * 6 - sector;
    }
  }

  fireEnemy(enemy, playerPos, playerVel, speed = 96) {
    const start = tmpV.copy(enemy.mesh.position);
    start.y += .1;
    const aim = tmpV2.copy(playerPos).addScaledVector(playerVel, .32).sub(start).normalize();
    const spread = .02 + Math.random() * .03;
    aim.x += (Math.random() - .5) * spread;
    aim.y += (Math.random() - .5) * spread;
    aim.z += (Math.random() - .5) * spread;
    aim.normalize();
    this.spawnEnemyBullet(start, aim.multiplyScalar(speed), enemy.kind === 'heavy' ? 11 : 8, .85);
    this.effects.flash(start, '#ff4d7c', 1.8, .12);
    this.audio.enemyShot();
  }

  fireTurret(turret, playerPos, playerVel) {
    const start = turret.mesh.position.clone();
    const aim = playerPos.clone().addScaledVector(playerVel, .36).sub(start).normalize();
    aim.x += (Math.random() - .5) * .025;
    aim.y += (Math.random() - .5) * .025;
    this.spawnEnemyBullet(start, aim.normalize().multiplyScalar(118), 10, 1.15);
    this.effects.flash(start, '#ff315f', 2.2, .14);
    this.audio.enemyShot();
  }

  spawnEnemyBullet(pos, vel, damage, scale = 1) {
    if (this.enemyBullets.length > 90) return;
    const mesh = makePlasma('#ff3f78', scale);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.enemyBullets.push({ mesh, pos: mesh.position, prev: mesh.position.clone(), vel: vel.clone(), damage, life: 5, radius: .6 * scale, trail: 0 });
  }

  /* ------------------------------------------------------------------ */
  /* player weapons                                                     */
  /* ------------------------------------------------------------------ */

  findTarget(playerPos, forward, maxDist = 520, maxAngle = .20) {
    let best = null, bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = tmpV.copy(e.mesh.position).sub(playerPos);
      const dist = d.length();
      if (dist > maxDist || dist < 8) continue;
      const dot = d.normalize().dot(forward);
      if (dot < 1 - maxAngle) continue;
      const score = dot * 2 - dist / maxDist * .4;
      if (score > bestScore) { bestScore = score; best = { pos: e.mesh.position, vel: new THREE.Vector3(0, 0, e.speed), enemy: e, radius: e.radius }; }
    }
    if (this.boss && this.bossActive && !this.bossDefeated) {
      for (const t of this.bossTargets()) {
        const d = tmpV.copy(t.pos).sub(playerPos);
        const dist = d.length();
        if (dist > 700) continue;
        const dot = d.normalize().dot(forward);
        if (dot < Math.cos(.12)) continue;
        const score = dot * 2.2 - dist / 800;
        if (score > bestScore) { bestScore = score; best = t; }
      }
    }
    return best;
  }

  fireCannons(ctx) {
    const { playerPos, forward, target, muzzleSide, invulnerable } = ctx;
    const aim = tmpV3.copy(forward);
    if (target) {
      const t = tmpV2.copy(target.pos);
      // simple lead
      const dist = t.distanceTo(playerPos);
      const lead = Math.min(.45, dist / 750);
      if (target.vel) t.addScaledVector(target.vel, lead);
      aim.copy(t).sub(playerPos).normalize();
      // gentle aim assist: limit deviation from forward
      const dot = clamp(aim.dot(forward), -1, 1);
      const angle = Math.acos(dot);
      if (angle > .11) aim.lerp(forward, clamp((angle - .11) / angle, 0, 1)).normalize();
    }
    const muzzle = playerPos.clone();
    muzzle.x += muzzleSide * 1.7;
    muzzle.y -= .03;
    muzzle.z -= .4;
    // camera space offset is approximated in world x/y; acceptable at these distances
    const bullet = {
      mesh: makeBullet('#8ef8ff'), pos: muzzle.clone(), prev: muzzle.clone(),
      vel: aim.clone().multiplyScalar(760), life: 1.2, damage: 1, radius: .35
    };
    bullet.mesh.position.copy(muzzle);
    bullet.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim);
    this.scene.add(bullet.mesh);
    this.playerBullets.push(bullet);
    this.effects.flash(muzzle, '#a7fbff', 1.2, .06);
    this.audio.laser();
  }

  fireMissiles(playerPos, forward) {
    if (this.missileCharges <= 0) return false;
    this.missileCharges--;
    this.missileRegen = 0;
    const targets = [];
    const target = this.findTarget(playerPos, forward, 760, .32);
    for (let i = 0; i < 2; i++) {
      const mesh = makeMissile();
      const pos = playerPos.clone();
      pos.x += (i === 0 ? -1.3 : 1.3);
      pos.y -= .25;
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.missiles.push({
        mesh, pos, prev: pos.clone(), vel: forward.clone().multiplyScalar(130),
        target: target ? target : null, life: 5.2, dead: false, side: i === 0 ? -1 : 1,
        delay: i * .09, trail: 0
      });
    }
    this.audio.missile();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* boss                                                               */
  /* ------------------------------------------------------------------ */

  buildBoss() {
    const M = shared();
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const hull = new THREE.MeshStandardMaterial({ color: '#14111f', metalness: .9, roughness: .32 });
    const plate = new THREE.MeshStandardMaterial({ color: '#241528', metalness: .8, roughness: .42 });
    const red = new THREE.MeshBasicMaterial({ color: '#ff2f6a', toneMapped: false });
    const orange = new THREE.MeshBasicMaterial({ color: '#ff9b45', toneMapped: false });

    const body = new THREE.Mesh(new THREE.BoxGeometry(48, 16, 9), hull);
    body.position.set(0, 1, 0);
    root.add(body);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(27, 10, 7), plate);
    upper.position.set(0, 10, -1);
    root.add(upper);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(11, 4, 5), hull);
    bridge.position.set(0, 16, -1);
    root.add(bridge);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(34, 4.5, 7), plate);
    keel.position.set(0, -7.2, 0);
    root.add(keel);

    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.1, 9, 7), hull);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(side * 26, 1, 0);
      root.add(pod);
      const podRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, .26, 5, 24), red);
      podRing.rotation.y = Math.PI / 2;
      podRing.position.set(side * 26, 1, 4.6);
      root.add(podRing);
      // engine glow facing away
      const glow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), new THREE.MeshBasicMaterial({
        color: '#ff7a3d', transparent: true, opacity: .85, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide
      }));
      glow.position.set(side * 26, 1, -4.7);
      glow.rotation.y = Math.PI;
      root.add(glow);

      // armored ribs
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(.38, 15, .4), M.dark);
        rib.position.set(side * (8 + i * 5.5), 1, 4.7);
        root.add(rib);
      }
      // underside turret
      const tur = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 2.2, 8), M.dark);
      tur.position.set(side * 13, -9.8, 1);
      root.add(tur);
      const turEye = new THREE.Mesh(new THREE.SphereGeometry(.65, 8, 6), red);
      turEye.position.set(side * 13, -10.9, 1);
      root.add(turEye);
    }

    // warning strips
    for (let i = 0; i < 9; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.2, .18, .18), i % 2 ? orange : red);
      strip.position.set(-19 + i * 4.75, -3.9, 4.62);
      root.add(strip);
    }

    const nodes = [];
    const positions = [
      { x: -16.5, y: 2.2, name: 'PORT GENERATOR' },
      { x: 16.5, y: 2.2, name: 'STARBOARD GENERATOR' },
      { x: 0, y: 10.6, name: 'DORSAL GENERATOR' },
    ];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const group = new THREE.Group();
      group.position.set(p.x, p.y, 4.9);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.55, 1.2, 8), M.dark);
      housing.rotation.x = Math.PI / 2;
      group.add(housing);
      const ringMat = new THREE.MeshBasicMaterial({ color: i === 1 ? '#ff9b45' : '#ff2f6a', toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, .22, 5, 26), ringMat);
      group.add(ring);
      const core = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 8), new THREE.MeshBasicMaterial({
        color: '#fff0f5', toneMapped: false
      }));
      group.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.orbTexture, color: i === 1 ? '#ff9b45' : '#ff2f6a', transparent: true, opacity: .85,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      }));
      glow.scale.set(10, 10, 1);
      group.add(glow);
      root.add(group);
      nodes.push({
        kind: 'node', mesh: group, pos: new THREE.Vector3(), radius: 3.1,
        hp: 10, maxHp: 10, down: false, ring, core, glow, ringMat, name: p.name
      });
    }

    // core
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 1.8, 5.05);
    const coreHousing = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.3, 1.4, 12), M.dark);
    coreHousing.rotation.x = Math.PI / 2;
    coreGroup.add(coreHousing);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, .28, 6, 34), red);
    coreGroup.add(coreRing);
    const coreRing2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, .12, 5, 34), orange);
    coreGroup.add(coreRing2);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshBasicMaterial({
      color: '#ffe6f1', toneMapped: false
    }));
    coreGroup.add(core);
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.orbTexture, color: '#ff2f92', transparent: true, opacity: .9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    coreGlow.scale.set(20, 20, 1);
    coreGroup.add(coreGlow);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(7.4, 24, 16), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: .5 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#ff4f9a') } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uOpacity; uniform float uTime; uniform vec3 uColor; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.); float band=.5+.5*sin(uTime*4.+vN.y*10.); gl_FragColor=vec4(uColor,f*(.35+band*.2)*uOpacity); }`
    }));
    coreGroup.add(shield);
    root.add(coreGroup);

    const boss = {
      root, nodes, coreGroup, core, coreRing, coreRing2, coreGlow, shield,
      coreHp: 36, coreMaxHp: 36, coreExposed: false, defeated: false,
      s: 0, x: 0, y: 25, time: 0, sway: 0, fireTimer: 2.2, burst: 0,
      flash: 0, turrets: []
    };
    boss.getTargets = () => this.bossTargets();
    return boss;
  }

  bossTargets() {
    if (!this.boss || this.boss.defeated) return [];
    const out = [];
    for (const n of this.boss.nodes) {
      if (n.down) continue;
      n.mesh.getWorldPosition(tmpV);
      out.push({ pos: tmpV.clone(), vel: new THREE.Vector3(), radius: n.radius, node: n, kind: 'node', name: n.name });
    }
    if (this.boss.coreExposed && this.boss.coreHp > 0) {
      this.boss.coreGroup.getWorldPosition(tmpV);
      out.push({
        pos: tmpV.clone(),
        vel: new THREE.Vector3(), radius: 4.8, kind: 'core', name: 'REACTOR CORE'
      });
    }
    return out;
  }

  updateBoss(dt, ctx) {
    const b = this.boss;
    if (!b) return;
    b.time += dt;
    const player = ctx.player;
    b.s = player.s + 225 + Math.sin(b.time * .35) * 16;
    b.x = Math.sin(b.time * .43) * (halfWidth(b.s) * .16);
    b.y = 25 + Math.sin(b.time * .61) * 2.8;
    b.root.position.set(pathX(b.s) + b.x, b.y, -b.s);
    b.root.rotation.y = Math.sin(b.time * .28) * .055;
    b.root.rotation.z = Math.sin(b.time * .37) * .025;
    b.root.rotation.x = Math.sin(b.time * .23) * .02;

    for (let i = 0; i < b.nodes.length; i++) {
      const n = b.nodes[i];
      if (n.down) continue;
      n.ring.rotation.z += dt * (i % 2 ? -1.5 : 1.5);
      n.core.scale.setScalar(1 + Math.sin(b.time * 4 + i) * .08);
      n.mesh.getWorldPosition(tmpV);
    }
    b.coreRing.rotation.z += dt * 1.2;
    b.coreRing2.rotation.z -= dt * 1.7;
    b.core.scale.setScalar(1 + Math.sin(b.time * 3.4) * .06);
    b.shield.material.uniforms.uTime.value = b.time;
    b.shield.material.uniforms.uOpacity.value = b.coreExposed ? Math.max(0, b.shield.material.uniforms.uOpacity.value - dt * .55) : .55 + Math.sin(b.time * 2.1) * .12;
    b.shield.visible = b.shield.material.uniforms.uOpacity.value > .01;
    b.coreGlow.scale.setScalar((b.coreExposed ? 24 : 18) + Math.sin(b.time * 3.6) * 2);
    if (b.flash > 0) {
      b.flash -= dt;
      b.root.position.x += (Math.random() - .5) * b.flash * 3;
    }

    if (b.defeated) return;

    // fire patterns
    b.fireTimer -= dt;
    if (b.fireTimer <= 0) {
      b.fireTimer = b.coreExposed ? 1.35 : 1.9;
      const origin = b.root.position.clone();
      const aim = player.pos.clone().addScaledVector(player.vel, .32).sub(origin).normalize();
      const count = b.coreExposed ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const a = (i / (count - 1) - .5) * .32;
        const v = aim.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        v.y += (Math.random() - .5) * .07;
        this.spawnEnemyBullet(origin.clone().add(new THREE.Vector3((Math.random() - .5) * 22, (Math.random() - .5) * 10, 5)), v.normalize().multiplyScalar(105), 9, 1.25);
      }
      this.audio.enemyShot();
      this.effects.flash(origin.clone().add(new THREE.Vector3(0, 0, 5)), '#ff2f92', 12, .2);
    }
    // aimed turret shots
    b.burst -= dt;
    if (b.burst <= 0) {
      b.burst = .72;
      const origin = b.root.position.clone().add(new THREE.Vector3((Math.random() < .5 ? -1 : 1) * 14, -8, 2));
      const aim = player.pos.clone().sub(origin).normalize();
      aim.x += (Math.random() - .5) * .05;
      aim.y += (Math.random() - .5) * .05;
      this.spawnEnemyBullet(origin, aim.normalize().multiplyScalar(135), 11, 1.05);
    }

    // resolve projectile hits on nodes/core handled in bullet update
    if (b.coreHp <= 0 && !b.defeated) {
      b.defeated = true;
      this.bossDefeated = true;
      this.callbacks.onBossDefeated(b);
      for (let i = 0; i < 9; i++) {
        const p = b.root.position.clone().add(new THREE.Vector3((Math.random() - .5) * 40, (Math.random() - .5) * 18, (Math.random() - .5) * 8));
        this.effects.burst(p, i % 3 ? '#ff8a3d' : '#ff2f92', 34, 32, .9, 1.3, { drag: 1.1 });
        this.effects.ring(p, '#ffb347', 16, 1.1);
      }
      this.audio.explosion(2.2);
    }
  }

  /* ------------------------------------------------------------------ */
  /* damage / projectiles                                               */
  /* ------------------------------------------------------------------ */

  damageEnemy(enemy, damage, hitPos) {
    if (enemy.dead) return;
    enemy.hp -= damage;
    enemy.hitFlash = .12;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      this.kills++;
      this.effects.burst(enemy.mesh.position, enemy.kind === 'heavy' ? '#ffb347' : '#ff5f8f', enemy.kind === 'heavy' ? 34 : 20, 22, .65, .8, { drag: 1.4 });
      this.effects.ring(enemy.mesh.position, enemy.kind === 'heavy' ? '#ffb347' : '#ff2f92', 7, .5);
      this.audio.explosion(enemy.kind === 'heavy' ? 1.3 : .8);
      this.effects.shake(enemy.kind === 'heavy' ? .22 : .12);
      this.callbacks.onKill(enemy);
      if (Math.random() < (enemy.kind === 'heavy' ? .55 : .16)) {
        this.spawnPickup(enemy.mesh.position, Math.random() < .7 ? 'health' : 'missile');
      }
      this.scene.remove(enemy.mesh);
    } else {
      this.effects.burst(hitPos, '#ffd7e6', 5, 7, .25, .25, { drag: 3 });
      this.audio.hit();
    }
  }

  damageTurret(turret, damage, hitPos) {
    if (turret.dead) return;
    turret.hp -= damage;
    turret.hitFlash = .12;
    if (turret.hp <= 0) {
      turret.dead = true;
      this.kills++;
      const p = turret.mesh.position;
      this.effects.burst(p, '#ff8a3d', 26, 22, .7, .85, { drag: 1.4 });
      this.effects.ring(p, '#ffb347', 6, .5);
      this.audio.explosion(.9);
      this.effects.shake(.13);
      this.callbacks.onKill(turret);
      this.scene.remove(turret.mesh);
    } else {
      this.audio.hit();
    }
  }

  damageBossTarget(target, damage, hitPos) {
    const b = this.boss;
    if (!b || b.defeated) return;
    if (target.kind === 'node') {
      const n = target.node;
      if (n.down) return;
      n.hp -= damage;
      this.effects.burst(hitPos, '#ffd4e4', 7, 10, .35, .25, { drag: 3 });
      this.effects.shake(.04);
      this.audio.hit();
      if (n.hp <= 0) {
        n.down = true;
        n.ring.visible = false;
        n.core.visible = false;
        n.glow.material.opacity = 0;
        n.ringMat.color.set('#371522');
        this.callbacks.onBossNode(n);
        const p = new THREE.Vector3();
        n.mesh.getWorldPosition(p);
        this.effects.burst(p, '#ffb347', 40, 28, .9, 1.2, { drag: 1.2 });
        this.effects.ring(p, '#ffb347', 12, .8);
        this.audio.explosion(1.4);
        this.effects.shake(.3);
        if (b.nodes.every(x => x.down)) {
          b.coreExposed = true;
          this.callbacks.onBossNode({ name: 'CORE EXPOSED' });
          this.audio.alarm();
        }
      }
    } else if (target.kind === 'core' && b.coreExposed) {
      b.coreHp -= damage;
      b.flash = .08;
      this.effects.burst(hitPos, '#ffe4ef', 8, 12, .4, .3, { drag: 3 });
      this.audio.hit();
      if (b.coreHp <= 0) {
        b.core.visible = false;
        b.coreGlow.material.opacity = 0;
      }
    }
  }

  spawnPickup(pos, kind) {
    const mesh = makePickup(kind);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, life: 16, bob: Math.random() * TAU, vel: new THREE.Vector3() });
  }

  /* ------------------------------------------------------------------ */
  /* main update                                                        */
  /* ------------------------------------------------------------------ */

  update(dt, ctx) {
    this.time += dt;
    this.updateSpawns(dt, ctx.player.s, ctx.sector);
    if (this.bossActive) this.updateBoss(dt, ctx);

    const { player } = ctx;
    const sector = ctx.sector;

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.s -= e.speed * dt;
      const rel = e.s - player.s;
      e.phase += dt * e.freq;
      const px = clamp(pathX(e.s) + e.xRel + Math.sin(e.phase) * e.amp, pathX(e.s) - halfWidth(e.s) + 3, pathX(e.s) + halfWidth(e.s) - 3);
      const py = e.y + Math.sin(e.phase * .8 + 1) * 2.2;
      const oldX = e.mesh.position.x;
      e.mesh.position.set(px, py, -e.s);
      const dx = px - oldX;
      e.bank = damp(e.bank, clamp(-dx / Math.max(.001, dt) * .025 + Math.sin(e.phase) * .22, -.75, .75), 4, dt);
      e.mesh.rotation.y = Math.sin(e.phase * .6) * .18;
      e.mesh.rotation.z = e.bank;
      e.mesh.rotation.x = -clamp((player.pos.y - py) * .012, -.15, .15);

      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.mesh.scale.setScalar((e.kind === 'heavy' ? 1.35 : 1) * (1 + e.hitFlash * .6));
      } else {
        e.mesh.scale.setScalar(e.kind === 'heavy' ? 1.35 : 1);
      }

      e.fire -= dt;
      if (e.fire <= 0 && rel < 440 && rel > 16) {
        e.fire = (e.kind === 'heavy' ? 1.5 : 2.3) + Math.random() * 1.8 - sector * .12;
        this.fireEnemy(e, player.pos, player.vel);
      }

      if (rel < -24) {
        e.dead = true;
        this.scene.remove(e.mesh);
      } else if (rel < 8 && e.mesh.position.distanceTo(player.pos) < 4.5) {
        this.damageEnemy(e, 99, e.mesh.position);
        this.callbacks.onPlayerHit(26, e.mesh.position);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    // turrets
    for (const t of this.turrets) {
      if (t.dead) continue;
      const rel = t.s - player.s;
      t.mesh.rotation.y = (t.side > 0 ? Math.PI : 0);
      t.fire -= dt;
      if (t.fire <= 0 && rel < 420 && rel > 18) {
        t.fire = 1.8 + Math.random() * 1.5;
        this.fireTurret(t, player.pos, player.vel);
      }
      if (t.hitFlash > 0) {
        t.hitFlash -= dt;
        t.mesh.scale.setScalar(1 + t.hitFlash * .5);
      } else t.mesh.scale.setScalar(1);
      if (rel < -20) {
        t.dead = true;
        this.scene.remove(t.mesh);
      }
    }
    this.turrets = this.turrets.filter(t => !t.dead);

    // player cannons
    this.fireTimer -= dt;
    if (ctx.firing && this.fireTimer <= 0) {
      this.fireTimer = .115;
      this.fireCannons(ctx);
      ctx.muzzleSide = -ctx.muzzleSide;
      ctx.muzzleSideRef.value = ctx.muzzleSide;
    }

    // player bullets
    for (const b of this.playerBullets) {
      if (b.dead) continue;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
      // check enemies
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (segmentSphere(b.prev, b.pos, e.mesh.position, e.radius)) {
          this.damageEnemy(e, b.damage, b.pos);
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      for (const t of this.turrets) {
        if (t.dead) continue;
        if (segmentSphere(b.prev, b.pos, t.mesh.position, t.radius)) {
          this.damageTurret(t, b.damage, b.pos);
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      if (this.boss && this.bossActive && !this.boss.defeated) {
        for (const target of this.bossTargets()) {
          if (target.kind === 'core' && !this.boss.coreExposed) continue;
          if (segmentSphere(b.prev, b.pos, target.pos, target.radius)) {
            this.damageBossTarget(target, b.damage, b.pos);
            b.dead = true;
            break;
          }
        }
      }
      if (b.dead) {
        this.scene.remove(b.mesh);
      }
    }
    this.playerBullets = this.playerBullets.filter(b => !b.dead);

    // enemy plasma
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.life -= dt;
      b.trail -= dt;
      if (b.trail <= 0) {
        b.trail = .035;
        this.effects.trail(b.pos, '#ff507f', 0, 0, 0, .25, .15);
      }
      if (b.life <= 0) b.dead = true;
      if (!b.dead && player.invulnerable <= 0 && segmentSphere(b.prev, b.pos, player.pos, 1.7 + b.radius)) {
        b.dead = true;
        this.callbacks.onPlayerHit(b.damage, b.pos);
        this.effects.burst(b.pos, '#ff7098', 12, 12, .35, .4, { drag: 2 });
      }
      if (b.dead) this.scene.remove(b.mesh);
    }
    this.enemyBullets = this.enemyBullets.filter(b => !b.dead);

    // missiles
    for (const m of this.missiles) {
      if (m.dead) continue;
      m.life -= dt;
      if (m.life <= 0) { m.dead = true; this.scene.remove(m.mesh); continue; }
      m.prev.copy(m.pos);
      // acquire if target dead/removed
      if (!m.target || (m.target.enemy && m.target.enemy.dead) ||
          (m.target.node && m.target.node.down) ||
          (m.target.kind === 'core' && (!this.boss || this.boss.defeated))) {
        m.target = this.findTarget(m.pos, tmpV.copy(m.vel).normalize(), 900, .65);
      }
      let desired;
      if (m.target) {
        const to = tmpV.copy(m.target.pos).sub(m.pos);
        const dist = to.length();
        desired = to.normalize().multiplyScalar(245);
        if (dist < 14) {
          this.detonateMissile(m);
        }
      } else {
        desired = tmpV.copy(m.vel).normalize().multiplyScalar(245);
      }
      const turn = 1 - Math.exp(-4.2 * dt);
      m.vel.lerp(desired, turn);
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      if (m.vel.lengthSq() > 0) {
        m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpV.copy(m.vel).normalize());
      }
      m.trail -= dt;
      if (m.trail <= 0) {
        m.trail = .018;
        this.effects.trail(m.pos, '#ffb347', -m.vel.x * .02, -m.vel.y * .02, -m.vel.z * .02, .3, .34);
      }
      // direct collisions too
      for (const e of this.enemies) {
        if (!e.dead && segmentSphere(m.prev, m.pos, e.mesh.position, e.radius + .5)) { this.detonateMissile(m); break; }
      }
      if (m.dead) continue;
      if (this.boss && this.bossActive && !this.boss.defeated) {
        for (const target of this.bossTargets()) {
          if (target.kind === 'core' && !this.boss.coreExposed) continue;
          if (segmentSphere(m.prev, m.pos, target.pos, target.radius + 1.5)) { this.detonateMissile(m); break; }
        }
      }
    }
    this.missiles = this.missiles.filter(m => !m.dead);

    // missile recharge
    if (this.missileCharges < 3) {
      this.missileRegen += dt;
      if (this.missileRegen >= 14) {
        this.missileRegen = 0;
        this.missileCharges++;
      }
    }

    // pickups
    for (const p of this.pickups) {
      p.life -= dt;
      p.bob += dt;
      const toPlayer = tmpV.copy(player.pos).sub(p.mesh.position);
      const dist = toPlayer.length();
      if (dist < 90) {
        const speed = clamp((90 - dist) * 3.3, 8, 150);
        p.mesh.position.addScaledVector(toPlayer.normalize(), speed * dt);
      } else {
        p.mesh.position.y += Math.sin(p.bob * 2) * dt * .4;
      }
      p.mesh.rotation.y += dt * 2;
      p.mesh.userData.spin.rotation.z += dt * 3;
      if (p.mesh.position.distanceToSquared(player.pos) < 6.5 * 6.5) {
        p.life = -1;
        this.callbacks.onPickup(p.kind);
        this.audio.pickup();
        this.effects.burst(p.mesh.position, p.kind === 'health' ? '#71ffb0' : '#ffb347', 12, 10, .3, .5, { drag: 2 });
        this.scene.remove(p.mesh);
      } else if (p.life <= 0) {
        this.scene.remove(p.mesh);
      }
    }
    this.pickups = this.pickups.filter(p => p.life > 0);
  }

  detonateMissile(m) {
    m.dead = true;
    this.scene.remove(m.mesh);
    const p = m.pos.clone();
    const radius = 13;
    this.effects.burst(p, '#ffd27a', 26, 20, .75, .65, { drag: 1.5 });
    this.effects.burst(p, '#ff5f9a', 14, 12, .55, .8, { drag: 1.2 });
    this.effects.ring(p, '#ffb347', 9, .55);
    this.effects.flash(p, '#ffd9a0', 8, .18);
    this.effects.shake(.2);
    this.audio.explosion(1.1);
    for (const e of this.enemies) {
      if (!e.dead && e.mesh.position.distanceTo(p) < radius) this.damageEnemy(e, 7, p);
    }
    for (const t of this.turrets) {
      if (!t.dead && t.mesh.position.distanceTo(p) < radius) this.damageTurret(t, 7, p);
    }
    if (this.boss && this.bossActive && !this.boss.defeated) {
      for (const target of this.bossTargets()) {
        if (target.kind === 'core' && !this.boss.coreExposed) continue;
        if (target.pos.distanceTo(p) < radius + target.radius) this.damageBossTarget(target, 5, p);
      }
    }
  }
}

import * as THREE from 'three';

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'P9 SIDEARM',
    typeLabel: 'SIDEARM',
    mode: 'SEMI',
    damage: 17,
    headshot: 2.2,
    rpm: 300,
    mag: 12,
    reserveMax: 72,
    reload: 1.25,
    spread: 0.024,
    pellets: 1,
    auto: false,
    range: 130,
    pickupAmmo: 24,
    color: 0xd9a44c,
    sound: 'pistol',
  },
  ar: {
    id: 'ar',
    name: 'RANGER AR',
    typeLabel: 'ASSAULT RIFLE',
    mode: 'AUTO',
    damage: 19,
    headshot: 2.25,
    rpm: 610,
    mag: 30,
    reserveMax: 210,
    reload: 2.05,
    spread: 0.013,
    pellets: 1,
    auto: true,
    range: 270,
    pickupAmmo: 60,
    color: 0xe46b42,
    sound: 'rifle',
  },
  shotgun: {
    id: 'shotgun',
    name: 'BREACH 12',
    typeLabel: 'SHOTGUN',
    mode: 'PUMP',
    damage: 12,
    headshot: 1.8,
    rpm: 78,
    mag: 6,
    reserveMax: 48,
    reload: 2.55,
    spread: 0.072,
    pellets: 8,
    auto: false,
    range: 88,
    pickupAmmo: 18,
    color: 0xc9b04a,
    sound: 'shotgun',
  },
  sniper: {
    id: 'sniper',
    name: 'M40 MARKSMAN',
    typeLabel: 'MARKSMAN RIFLE',
    mode: 'BOLT',
    damage: 86,
    headshot: 2.5,
    rpm: 46,
    mag: 5,
    reserveMax: 35,
    reload: 2.9,
    spread: 0.0018,
    pellets: 1,
    auto: false,
    range: 420,
    pickupAmmo: 10,
    color: 0x6db6d9,
    sound: 'sniper',
  },
};

export function weaponFor(id) {
  return WEAPONS[id] || WEAPONS.ar;
}

let flashTexture = null;
export function getFlashTexture() {
  if (flashTexture) return flashTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 54);
  g.addColorStop(0, 'rgba(255,255,238,1)');
  g.addColorStop(0.18, 'rgba(255,233,156,0.95)');
  g.addColorStop(0.45, 'rgba(255,164,58,0.4)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.save();
  ctx.translate(64, 64);
  ctx.fillStyle = 'rgba(255,238,176,0.9)';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -58);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  flashTexture = new THREE.CanvasTexture(canvas);
  flashTexture.colorSpace = THREE.SRGBColorSpace;
  return flashTexture;
}

const share = {
  gunmetal: new THREE.MeshStandardMaterial({ color: 0x242a27, roughness: 0.5, metalness: 0.45 }),
  gunmetalLight: new THREE.MeshStandardMaterial({ color: 0x3c443f, roughness: 0.46, metalness: 0.35 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x151a17, roughness: 0.78, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6c4b30, roughness: 0.82 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb59142, roughness: 0.35, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x7eb4c0, roughness: 0.15, metalness: 0.5, emissive: 0x18343a, emissiveIntensity: 0.7 }),
};

function box(group, material, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

function cyl(group, material, r1, r2, h, x, y, z, rx = Math.PI / 2, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 8), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildWeaponModel(id) {
  const group = new THREE.Group();
  const accentMat = new THREE.MeshStandardMaterial({ color: weaponFor(id).color, roughness: 0.5, metalness: 0.25 });
  let muzzleZ = -0.84;
  let flashScale = 0.8;

  if (id === 'pistol') {
    box(group, share.gunmetal, 0.085, 0.1, 0.34, 0, 0, -0.08);
    box(group, share.polymer, 0.075, 0.19, 0.1, 0, -0.12, 0.02, -0.18);
    box(group, accentMat, 0.09, 0.018, 0.12, 0, 0.055, -0.12);
    cyl(group, share.gunmetalLight, 0.022, 0.022, 0.13, 0, 0.018, -0.31);
    box(group, share.gunmetalLight, 0.03, 0.025, 0.04, 0, 0.07, -0.2);
    muzzleZ = -0.39;
    flashScale = 0.55;
  } else if (id === 'shotgun') {
    box(group, share.gunmetal, 0.09, 0.11, 0.55, 0, 0, -0.22);
    cyl(group, share.gunmetalLight, 0.028, 0.028, 0.68, 0, 0.035, -0.58);
    box(group, share.wood, 0.1, 0.12, 0.32, 0, -0.01, -0.46);
    box(group, share.polymer, 0.085, 0.14, 0.15, 0, -0.09, -0.46);
    box(group, share.wood, 0.09, 0.15, 0.34, 0, -0.035, 0.17, 0.05);
    box(group, share.polymer, 0.075, 0.2, 0.1, 0, -0.13, -0.03, -0.2);
    box(group, accentMat, 0.09, 0.022, 0.14, 0, 0.065, -0.25);
    box(group, share.gunmetalLight, 0.03, 0.03, 0.05, 0, 0.09, -0.59);
    muzzleZ = -0.94;
    flashScale = 1.05;
  } else if (id === 'sniper') {
    box(group, share.gunmetal, 0.085, 0.1, 0.38, 0, 0, -0.12);
    cyl(group, share.gunmetalLight, 0.02, 0.023, 0.98, 0, 0.02, -0.69);
    cyl(group, share.polymer, 0.035, 0.035, 0.2, 0, 0.02, -1.11);
    box(group, share.polymer, 0.09, 0.16, 0.36, 0, -0.045, 0.24, 0.04);
    box(group, share.polymer, 0.075, 0.2, 0.1, 0, -0.14, 0.0, -0.2);
    box(group, share.gunmetalLight, 0.12, 0.12, 0.3, 0, 0.13, -0.12);
    cyl(group, share.glass, 0.05, 0.05, 0.05, 0, 0.13, -0.28);
    box(group, accentMat, 0.09, 0.022, 0.16, 0, 0.055, -0.36);
    box(group, share.polymer, 0.06, 0.07, 0.13, 0, 0.14, 0.02);
    muzzleZ = -1.18;
    flashScale = 1.15;
  } else {
    box(group, share.gunmetal, 0.1, 0.13, 0.5, 0, 0, -0.16);
    box(group, share.gunmetalLight, 0.105, 0.06, 0.32, 0, 0.035, -0.5);
    cyl(group, share.gunmetalLight, 0.022, 0.022, 0.45, 0, 0.035, -0.78);
    cyl(group, share.polymer, 0.032, 0.032, 0.16, 0, 0.035, -0.94);
    box(group, share.polymer, 0.085, 0.19, 0.12, 0, -0.13, -0.04, -0.22);
    box(group, share.polymer, 0.08, 0.18, 0.1, 0, -0.12, -0.3, 0.16);
    box(group, share.polymer, 0.085, 0.15, 0.28, 0, -0.02, 0.22, 0.03);
    box(group, accentMat, 0.1, 0.024, 0.16, 0, 0.07, -0.3);
    cyl(group, share.gunmetalLight, 0.025, 0.025, 0.1, 0, 0.1, -0.35);
    muzzleZ = -1.03;
    flashScale = 0.95;
  }

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getFlashTexture(), color: 0xffd488, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.95,
  }));
  flash.position.set(0, 0.03, muzzleZ);
  flash.scale.setScalar(flashScale);
  flash.visible = false;
  group.add(flash);

  group.userData.muzzleZ = muzzleZ;
  group.userData.flash = flash;
  return group;
}

const pickupPalette = {
  weapon: 0xe46b42,
  ammo: 0xd6b24a,
  med: 0xece7da,
  armor: 0x60bce8,
};

export function buildPickupModel(type, weaponId) {
  const group = new THREE.Group();
  const accent = pickupPalette[type] || 0xf2c14e;
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.2 });

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.38, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x2a302b, roughness: 0.72, metalness: 0.18 }),
  );
  crate.position.y = 0.22;
  crate.castShadow = true;
  group.add(crate);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.76), accentMat);
  band.position.y = 0.28;
  group.add(band);

  if (type === 'weapon') {
    const model = buildWeaponModel(weaponId || 'ar');
    model.scale.setScalar(0.72);
    model.position.set(0, 0.62, 0);
    model.rotation.set(0.12, 0.7, -0.35);
    group.add(model);
  } else if (type === 'ammo') {
    for (let i = 0; i < 3; i++) {
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6), share.brass);
      bullet.position.set(-0.16 + i * 0.16, 0.54, 0);
      bullet.rotation.z = 0.22;
      group.add(bullet);
    }
  } else if (type === 'med') {
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xc7352e, emissive: 0x6c100d, emissiveIntensity: 0.35, roughness: 0.5 });
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xefeadd, roughness: 0.5 }));
    boxM.position.y = 0.57; group.add(boxM);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.32), crossMat);
    v.position.y = 0.57; group.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.32), crossMat);
    h.position.y = 0.57; group.add(h);
  } else if (type === 'armor') {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x2f4d5e, roughness: 0.6 }));
    vest.position.y = 0.58; group.add(vest);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.06), accentMat);
    plate.position.set(0, 0.58, 0.12); group.add(plate);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 28),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.48, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.58, 2.6, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.075, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beam.position.y = 1.3;
  group.add(beam);

  group.userData.ring = ring;
  group.userData.beam = beam;
  return group;
}

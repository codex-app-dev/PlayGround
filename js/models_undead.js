import * as THREE from '../vendor/three.module.js';
import { add, group, limb, M, C, teamMat, darkTeamMat } from './materials.js';

const GREEN_GLOW = { emissive: 0x31e08a, emissiveIntensity: 2.2 };

export function undeadWorker(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const robe = M(0x3b3347);
  const robeD = M(0x241f2c);
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 1.95, kind: 'worker' };

  add(g, 'frustum', robeD, 0, 0.82, 0, 0.92, 1.64, 0.92);
  add(g, 'frustum', robe, 0, 1.02, 0, 0.7, 1.15, 0.68);
  add(g, 'box', cloth, 0, 1.18, 0, 0.5, 0.34, 0.4);
  // skull face under a deep hood
  add(g, 'sphere', bone, 0, 1.66, 0.08, 0.36, 0.4, 0.34);
  add(g, 'sphere', robeD, 0, 1.73, -0.03, 0.52, 0.5, 0.46);
  add(g, 'cone', robeD, 0, 1.92, -0.05, 0.24, 0.36, 0.24, 0.25, 0, 0);
  add(g, 'box', M(0x11110f), -0.09, 1.68, 0.24, 0.08, 0.07, 0.02);
  add(g, 'box', M(0x11110f), 0.09, 1.68, 0.24, 0.08, 0.07, 0.02);
  const eyeL = add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), -0.09, 1.68, 0.27, 0.045, 0.045, 0.03);
  const eyeR = add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), 0.09, 1.68, 0.27, 0.045, 0.045, 0.03);
  add(g, 'box', M(0xddd6bb), 0, 1.55, 0.24, 0.16, 0.1, 0.04);

  const left = limb(g, -0.35, 1.37, 0, robe, 0.18, 0.56, 0.2);
  const right = limb(g, 0.35, 1.37, 0, robe, 0.18, 0.56, 0.2);
  add(left, 'sphere', bone, 0, -0.52, 0, 0.13, 0.14, 0.13);
  const staff = group(right, 0, -0.52, 0.05);
  add(staff, 'cyl6', M(C.woodDark), 0, 0.15, 0, 0.05, 1.45, 0.05);
  const orb = add(staff, 'sphere', M(0x76ffb5, GREEN_GLOW), 0, 0.92, 0, 0.2, 0.2, 0.2);
  add(staff, 'torus', M(0x3c2f4d), 0, 0.92, 0, 0.32, 0.1, 0.32, Math.PI / 2, 0, 0);
  anim.arms.push(left, right);
  anim.weapon = staff;
  anim.glow = orb;
  anim.eyes = [eyeL, eyeR];
  g.userData.anim = anim;
  return g;
}

export function undeadMelee(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const flesh = M(C.undeadSkin);
  const fleshD = M(0x7f8b78);
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 2.2, kind: 'melee' };

  // Crouched, long-armed silhouette
  anim.legs.push(limb(g, -0.21, 0.78, 0, fleshD, 0.24, 0.78, 0.26));
  anim.legs.push(limb(g, 0.21, 0.78, 0, fleshD, 0.24, 0.78, 0.26));
  add(g, 'sphereLo', flesh, 0, 1.2, 0.06, 0.86, 0.88, 0.62);
  add(g, 'box', cloth, 0, 0.98, 0.02, 0.62, 0.25, 0.45);
  add(g, 'sphere', fleshD, 0, 1.55, 0.18, 0.52, 0.48, 0.44);
  add(g, 'sphereLo', flesh, 0, 1.22, -0.24, 0.62, 0.5, 0.3);
  // exposed ribs
  for (let i = 0; i < 3; i++) add(g, 'box', bone, 0, 1.16 + i * 0.12, 0.3, 0.4 - i * 0.05, 0.04, 0.03);
  // jaw and eyes
  add(g, 'box', M(0x3d2e2c), 0, 1.46, 0.42, 0.28, 0.14, 0.12);
  add(g, 'sphere', M(0xff5a3c, { emissive: 0xff2d10, emissiveIntensity: 2 }), -0.11, 1.58, 0.39, 0.06, 0.06, 0.04);
  add(g, 'sphere', M(0xff5a3c, { emissive: 0xff2d10, emissiveIntensity: 2 }), 0.11, 1.58, 0.39, 0.06, 0.06, 0.04);
  // spine spikes
  for (let i = 0; i < 4; i++) add(g, 'cone', bone, 0, 1.42 + i * 0.12, -0.26 - i * 0.025, 0.08, 0.24, 0.08, -0.9, 0, 0);
  add(g, 'cone', bone, 0, 1.78, 0.04, 0.08, 0.2, 0.08);

  const left = limb(g, -0.48, 1.45, 0, flesh, 0.22, 0.88, 0.24);
  const right = limb(g, 0.48, 1.45, 0, flesh, 0.22, 0.88, 0.24);
  for (const arm of [left, right]) {
    const hand = add(arm, 'sphere', fleshD, 0, -0.9, 0.02, 0.2, 0.18, 0.2);
    for (let i = 0; i < 3; i++) {
      add(arm, 'cone', bone, (i - 1) * 0.08, -1.06, 0.1, 0.035, 0.26, 0.035, Math.PI / 2.8, 0, (i - 1) * 0.22);
    }
  }
  add(g, 'box', cloth, 0, 1.3, -0.02, 0.8, 0.18, 0.55);
  anim.arms.push(left, right);
  g.userData.anim = anim;
  return g;
}

export function undeadRanged(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const bone = M(C.bone);
  const boneD = M(C.boneDark);
  const cloak = M(0x393044);
  const anim = { legs: [], arms: [], height: 2.05, kind: 'ranged' };

  anim.legs.push(limb(g, -0.15, 0.8, 0, boneD, 0.12, 0.8, 0.14));
  anim.legs.push(limb(g, 0.15, 0.8, 0, boneD, 0.12, 0.8, 0.14));
  add(g, 'box', boneD, 0, 0.89, 0, 0.36, 0.12, 0.22);
  add(g, 'cyl', bone, 0, 1.18, 0, 0.22, 0.55, 0.2);
  for (let i = 0; i < 4; i++) add(g, 'box', bone, 0, 1.02 + i * 0.1, 0.1, 0.48 - i * 0.04, 0.035, 0.03);
  add(g, 'sphere', bone, 0, 1.62, 0.06, 0.38, 0.42, 0.36);
  add(g, 'box', M(0x17130f), 0, 1.68, 0.23, 0.28, 0.18, 0.05);
  add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), -0.09, 1.63, 0.26, 0.055, 0.055, 0.035);
  add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), 0.09, 1.63, 0.26, 0.055, 0.055, 0.035);
  add(g, 'box', M(0xd9d2b7), 0, 1.52, 0.24, 0.16, 0.08, 0.04);
  // tattered cloak
  add(g, 'plane', cloak, 0, 1.2, -0.24, 0.7, 1.0, 1, 0, 0, 0);
  add(g, 'box', cloth, 0, 1.04, 0, 0.42, 0.14, 0.3);
  add(g, 'cone', cloth, 0, 1.9, -0.04, 0.15, 0.3, 0.15, 0.4, 0, 0);

  const left = limb(g, -0.3, 1.45, 0, bone, 0.1, 0.56, 0.1);
  const right = limb(g, 0.3, 1.45, 0, bone, 0.1, 0.56, 0.1);
  add(left, 'sphere', boneD, 0, -0.5, 0, 0.12, 0.12, 0.12);
  add(right, 'sphere', boneD, 0, -0.5, 0, 0.12, 0.12, 0.12);
  // bone bow
  const bow = group(left, 0, -0.54, 0.04);
  add(bow, 'torus', M(C.boneDark), 0, 0, 0, 0.22, 0.8, 0.22);
  add(bow, 'box', M(0x8a7f68), 0, 0, 0.01, 0.012, 0.8, 0.012);
  add(right, 'cyl6', M(0x8a7f68), 0, -0.5, 0.12, 0.02, 0.6, 0.02, Math.PI / 2, 0, 0);
  anim.arms.push(left, right);
  g.userData.anim = anim;
  return g;
}

export function undeadHeavy(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const flesh = M(0x9aa58f);
  const fleshL = M(0xb7c0a9);
  const stitch = M(0x3e3a33);
  const bone = M(C.bone);
  const iron = M(C.iron, { metalness: 0.45, roughness: 0.5 });
  const anim = { legs: [], arms: [], height: 3.1, kind: 'heavy' };

  anim.legs.push(limb(g, -0.38, 1.0, 0, flesh, 0.42, 1.0, 0.45));
  anim.legs.push(limb(g, 0.38, 0.95, 0, flesh, 0.42, 0.95, 0.45));
  add(g, 'sphereLo', flesh, 0, 1.65, 0, 1.55, 1.45, 1.1);
  add(g, 'sphere', fleshL, 0, 1.42, 0.25, 1.3, 1.0, 0.8);
  add(g, 'box', cloth, 0, 1.1, 0, 1.25, 0.45, 0.95);
  add(g, 'box', stitch, 0, 1.05, 0, 1.28, 0.08, 0.98);
  // stitched seams and ribs
  for (let i = 0; i < 4; i++) {
    add(g, 'box', stitch, -0.52 + i * 0.34, 1.86, 0.57, 0.035, 0.44, 0.03);
    add(g, 'box', stitch, -0.52 + i * 0.34, 1.86, -0.57, 0.035, 0.44, 0.03);
  }
  add(g, 'box', stitch, 0, 1.55, 0.66, 1.1, 0.04, 0.02);
  // small head mostly swallowed by shoulders
  add(g, 'sphere', fleshL, 0, 2.55, 0.4, 0.55, 0.5, 0.5);
  add(g, 'sphere', M(0x201d18), -0.13, 2.61, 0.65, 0.1, 0.09, 0.06);
  add(g, 'sphere', M(0x201d18), 0.13, 2.61, 0.65, 0.1, 0.09, 0.06);
  add(g, 'box', stitch, 0, 2.47, 0.68, 0.34, 0.06, 0.02);
  add(g, 'box', stitch, 0, 2.32, 0.55, 0.65, 0.06, 0.03);
  add(g, 'box', bone, 0, 2.83, 0.38, 0.9, 0.12, 0.18);
  // metal stakes in shoulders
  add(g, 'cone', iron, -0.72, 2.55, 0, 0.12, 0.6, 0.12, 0, 0, -0.15);
  add(g, 'cone', iron, 0.72, 2.55, 0, 0.12, 0.6, 0.12, 0, 0, 0.15);

  const left = limb(g, -0.92, 1.95, 0, flesh, 0.4, 0.95, 0.42);
  const right = limb(g, 0.92, 1.95, 0, flesh, 0.4, 0.95, 0.42);
  add(left, 'sphere', fleshL, 0, -0.95, 0, 0.36, 0.32, 0.36);
  add(right, 'sphere', fleshL, 0, -0.95, 0, 0.36, 0.32, 0.36);
  // hook
  const hook = group(left, 0, -0.95, 0.1);
  add(hook, 'cyl6', iron, 0, -0.2, 0, 0.05, 0.65, 0.05);
  add(hook, 'torus', iron, 0, -0.6, 0.18, 0.34, 0.34, 0.34, 0, 0, 0);
  // cleaver
  const cleaver = group(right, 0, -0.92, 0.1);
  add(cleaver, 'cyl6', M(C.woodDark), 0, 0.1, 0, 0.06, 0.8, 0.06);
  add(cleaver, 'box', iron, 0.1, 0.55, 0, 0.7, 0.6, 0.08, 0, 0, 0.12);
  add(cleaver, 'box', M(0xb4532f), 0.3, 0.55, 0.05, 0.18, 0.3, 0.02);
  anim.arms.push(left, right);
  anim.weapon = cleaver;
  g.userData.anim = anim;
  return g;
}

export function undeadCaster(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const robe = M(0x2b2237);
  const trim = M(0x8c74b8);
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 2.1, kind: 'caster' };

  add(g, 'frustum', robe, 0, 0.92, 0, 1.0, 1.84, 1.0);
  add(g, 'box', trim, 0, 0.6, 0, 0.72, 0.08, 0.62);
  add(g, 'sphereLo', robe, 0, 1.38, 0, 0.9, 0.7, 0.6);
  add(g, 'box', cloth, 0, 1.3, 0, 0.58, 0.3, 0.44);
  // skull mask
  add(g, 'sphere', bone, 0, 1.76, 0.1, 0.42, 0.48, 0.38);
  add(g, 'sphere', robe, 0, 1.84, -0.02, 0.6, 0.55, 0.52);
  add(g, 'cone', robe, 0, 2.05, -0.06, 0.28, 0.42, 0.28, 0.3, 0, 0);
  add(g, 'box', M(0x10100f), 0, 1.74, 0.29, 0.32, 0.18, 0.05);
  add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), -0.1, 1.71, 0.33, 0.06, 0.06, 0.035);
  add(g, 'sphere', M(0x63ffb2, GREEN_GLOW), 0.1, 1.71, 0.33, 0.06, 0.06, 0.035);
  add(g, 'box', M(0xd9d2b7), 0, 1.59, 0.3, 0.17, 0.08, 0.04);
  // bone pauldrons
  add(g, 'sphere', bone, -0.48, 1.5, 0, 0.3, 0.2, 0.34);
  add(g, 'sphere', bone, 0.48, 1.5, 0, 0.3, 0.2, 0.34);

  const left = limb(g, -0.42, 1.38, 0, robe, 0.2, 0.6, 0.22);
  const right = limb(g, 0.42, 1.38, 0, robe, 0.2, 0.6, 0.22);
  add(left, 'sphere', bone, 0, -0.56, 0, 0.13, 0.14, 0.13);
  const staff = group(right, 0, -0.56, 0.08);
  add(staff, 'cyl6', M(0x3d314b), 0, 0.2, 0, 0.055, 1.6, 0.055);
  // skull on top
  add(staff, 'sphere', bone, 0, 1.02, 0, 0.28, 0.3, 0.25);
  add(staff, 'box', M(0x12110f), 0, 1.03, 0.14, 0.2, 0.1, 0.04);
  const orb = add(staff, 'sphere', M(0x63ffb2, GREEN_GLOW), 0, 0.82, 0.18, 0.16, 0.16, 0.16);
  // floating runes
  const runes = group(g, 0, 1.2, 0);
  for (let i = 0; i < 3; i++) {
    const rune = add(runes, 'torusThin', M(0x76ffb5, { emissive: 0x2fe08a, emissiveIntensity: 1.8, transparent: true, opacity: 0.8 }), Math.cos(i * 2.1) * 0.65, 0.8 + i * 0.25, Math.sin(i * 2.1) * 0.65, 0.16, 0.16, 0.16, i, i, i);
    rune.userData.spin = 0.6 + i * 0.25;
  }
  anim.arms.push(left, right);
  anim.weapon = staff;
  anim.glow = orb;
  anim.runes = runes;
  g.userData.anim = anim;
  return g;
}

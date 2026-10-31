import * as THREE from '../vendor/three.module.js';
import { add, group, limb, M, C, teamMat, darkTeamMat, banner } from './materials.js';

// Human models. Every unit faces +Z and stands on y=0.
export function humanWorker(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const pants = M(C.leatherDark);
  const skin = M(C.skin);
  const straw = M(0xd3b36a);
  const anim = { legs: [], arms: [], height: 1.9, kind: 'worker' };

  anim.legs.push(limb(g, -0.15, 0.76, 0, pants, 0.2, 0.76, 0.23));
  anim.legs.push(limb(g, 0.15, 0.76, 0, pants, 0.2, 0.76, 0.23));
  add(g, 'box', M(C.leatherDark), 0, 0.82, 0, 0.48, 0.12, 0.3);
  add(g, 'box', cloth, 0, 1.13, 0, 0.52, 0.64, 0.34);
  add(g, 'box', M(C.leather), 0, 0.9, 0, 0.55, 0.09, 0.36);
  add(g, 'sphere', skin, 0, 1.58, 0, 0.42, 0.46, 0.4);
  add(g, 'sphereLo', M(0x3b2a1e), 0, 1.55, 0.19, 0.12, 0.12, 0.08);
  // straw hat
  add(g, 'cyl', straw, 0, 1.75, 0, 0.62, 0.06, 0.62);
  add(g, 'cone', straw, 0, 1.87, 0, 0.54, 0.24, 0.54);

  const left = limb(g, -0.33, 1.38, 0, skin, 0.15, 0.55, 0.16);
  const right = limb(g, 0.33, 1.38, 0, skin, 0.15, 0.55, 0.16);
  add(left, 'box', cloth, 0, -0.2, 0, 0.16, 0.24, 0.18);
  add(right, 'box', cloth, 0, -0.2, 0, 0.16, 0.24, 0.18);
  // pickaxe
  const tool = group(right, 0, -0.55, 0.06);
  add(tool, 'cyl6', M(C.woodLight), 0, 0.12, 0, 0.055, 0.82, 0.055);
  add(tool, 'box', M(C.steelDark), 0, 0.5, 0, 0.5, 0.09, 0.1, 0, 0, -0.08);
  add(tool, 'cone', M(C.steelDark), -0.23, 0.5, 0, 0.13, 0.14, 0.1, 0, 0, Math.PI / 2);
  anim.arms.push(left, right);
  anim.tool = tool;
  g.userData.anim = anim;
  return g;
}

export function humanMelee(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const dark = darkTeamMat(team);
  const steel = M(C.steel, { metalness: 0.45, roughness: 0.42 });
  const steelD = M(C.steelDark, { metalness: 0.4, roughness: 0.45 });
  const skin = M(C.skin);
  const anim = { legs: [], arms: [], height: 2.1, kind: 'melee' };

  anim.legs.push(limb(g, -0.18, 0.82, 0, steelD, 0.24, 0.8, 0.26));
  anim.legs.push(limb(g, 0.18, 0.82, 0, steelD, 0.24, 0.8, 0.26));
  add(g, 'box', M(C.steelDark), 0, 0.94, 0, 0.56, 0.2, 0.36);
  add(g, 'box', steel, 0, 1.22, 0, 0.66, 0.6, 0.4);
  add(g, 'box', cloth, 0, 1.16, 0.215, 0.42, 0.54, 0.04);
  add(g, 'box', cloth, 0, 1.13, -0.22, 0.4, 0.5, 0.04);
  add(g, 'box', M(C.gold, { metalness: 0.6, roughness: 0.35 }), 0, 1.32, 0.24, 0.12, 0.12, 0.04);
  add(g, 'sphere', steel, -0.42, 1.43, 0, 0.34, 0.32, 0.34);
  add(g, 'sphere', steel, 0.42, 1.43, 0, 0.34, 0.32, 0.34);
  add(g, 'sphere', skin, 0, 1.68, 0.02, 0.38, 0.4, 0.36);
  // helmet
  add(g, 'cyl', steel, 0, 1.78, 0.01, 0.46, 0.3, 0.44);
  add(g, 'sphere', steel, 0, 1.86, 0.01, 0.44, 0.26, 0.42);
  add(g, 'box', steelD, 0, 1.75, 0.2, 0.32, 0.08, 0.12);
  add(g, 'cone', cloth, 0, 2.02, 0.01, 0.18, 0.32, 0.22);

  const left = limb(g, -0.42, 1.42, 0, steel, 0.2, 0.58, 0.22);
  const right = limb(g, 0.42, 1.42, 0, steel, 0.2, 0.58, 0.22);
  add(left, 'box', cloth, 0, -0.34, 0, 0.22, 0.22, 0.24);
  add(right, 'box', cloth, 0, -0.32, 0, 0.21, 0.2, 0.23);
  // shield
  const shield = group(left, -0.08, -0.5, 0.08);
  add(shield, 'box', dark, 0, 0, 0, 0.48, 0.62, 0.08);
  add(shield, 'box', steel, 0, 0, 0.055, 0.52, 0.68, 0.03);
  add(shield, 'box', cloth, 0, 0, 0.08, 0.28, 0.4, 0.02);
  add(shield, 'sphere', M(C.gold, { metalness: 0.7, roughness: 0.3 }), 0, 0, 0.11, 0.14, 0.14, 0.05);
  // sword
  const sword = group(right, 0, -0.56, 0.03);
  add(sword, 'cyl6', M(C.leatherDark), 0, -0.1, 0, 0.07, 0.22, 0.07);
  add(sword, 'box', M(C.gold, { metalness: 0.6 }), 0, 0.03, 0, 0.3, 0.07, 0.07);
  add(sword, 'box', steel, 0, 0.42, 0, 0.09, 0.75, 0.05);
  add(sword, 'cone4', steel, 0, 0.82, 0, 0.09, 0.14, 0.05);
  anim.arms.push(left, right);
  anim.weapon = sword;
  g.userData.anim = anim;
  return g;
}

export function humanRanged(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const leather = M(C.leather);
  const leatherD = M(C.leatherDark);
  const green = M(0x4e6b3b);
  const skin = M(C.skin);
  const anim = { legs: [], arms: [], height: 1.95, kind: 'ranged' };

  anim.legs.push(limb(g, -0.15, 0.78, 0, leatherD, 0.2, 0.76, 0.22));
  anim.legs.push(limb(g, 0.15, 0.78, 0, leatherD, 0.2, 0.76, 0.22));
  add(g, 'box', green, 0, 1.12, 0, 0.52, 0.6, 0.33);
  add(g, 'box', cloth, 0, 1.02, 0, 0.55, 0.12, 0.36);
  add(g, 'box', leather, 0, 0.9, 0, 0.5, 0.1, 0.34);
  add(g, 'sphere', skin, 0, 1.55, 0.02, 0.4, 0.43, 0.38);
  // hood
  add(g, 'sphere', green, 0, 1.61, -0.02, 0.48, 0.48, 0.46);
  add(g, 'sphereLo', M(C.skinDark), 0, 1.53, 0.19, 0.19, 0.2, 0.12);
  add(g, 'cone', green, 0, 1.82, -0.06, 0.22, 0.32, 0.22, 0.4, 0, 0);
  // quiver
  add(g, 'cyl6', leatherD, -0.24, 1.3, -0.22, 0.16, 0.62, 0.16, 0.24, 0, -0.25);
  for (let i = 0; i < 3; i++) add(g, 'cyl6', M(C.woodLight), -0.29 + i * 0.07, 1.64, -0.28, 0.02, 0.34, 0.02, 0.24, 0, -0.25);

  const left = limb(g, -0.33, 1.34, 0, green, 0.15, 0.55, 0.16);
  const right = limb(g, 0.33, 1.34, 0, green, 0.15, 0.55, 0.16);
  add(left, 'sphere', skin, 0, -0.5, 0, 0.16, 0.16, 0.16);
  add(right, 'sphere', skin, 0, -0.5, 0, 0.16, 0.16, 0.16);
  // bow
  const bow = group(left, 0, -0.55, 0.03);
  add(bow, 'torus', M(C.woodLight), 0, 0, 0, 0.24, 0.72, 0.24, 0, 0, 0);
  add(bow, 'box', M(0xddd2b0), 0, 0, 0.01, 0.015, 0.72, 0.015);
  // arrow
  add(right, 'cyl6', M(C.woodLight), 0, -0.5, 0.12, 0.025, 0.62, 0.025, Math.PI / 2, 0, 0);
  add(right, 'cone4', M(C.steelDark), 0, -0.5, 0.42, 0.06, 0.12, 0.06, Math.PI / 2, 0, 0);
  anim.arms.push(left, right);
  g.userData.anim = anim;
  return g;
}

export function humanHeavy(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const steel = M(C.steel, { metalness: 0.5, roughness: 0.4 });
  const steelD = M(C.steelDark, { metalness: 0.45 });
  const horse = M(0x6b4a32);
  const mane = M(0x38261a);
  const gold = M(C.gold, { metalness: 0.65, roughness: 0.32 });
  const anim = { legs: [], arms: [], height: 2.85, kind: 'heavy', mount: true };

  // Horse legs
  const lx = [-0.27, 0.27, -0.27, 0.27];
  const lz = [-0.52, -0.52, 0.5, 0.5];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(lx[i], 0.78, lz[i]);
    add(pivot, 'box', horse, 0, -0.36, 0, 0.17, 0.72, 0.2);
    add(pivot, 'box', mane, 0, -0.7, 0, 0.19, 0.09, 0.22);
    g.add(pivot);
    anim.legs.push(pivot);
  }
  add(g, 'box', horse, 0, 1.1, 0, 0.62, 0.58, 1.35);
  add(g, 'box', mane, 0, 1.28, -0.56, 0.55, 0.35, 0.18);
  // neck and head
  add(g, 'box', horse, 0, 1.45, 0.58, 0.34, 0.75, 0.38, 0.5, 0, 0);
  add(g, 'box', horse, 0, 1.76, 0.85, 0.3, 0.32, 0.52, 0.2, 0, 0);
  add(g, 'box', mane, 0, 1.65, 0.67, 0.1, 0.5, 0.18, 0.5, 0, 0);
  add(g, 'cone', horse, -0.09, 1.95, 0.88, 0.08, 0.18, 0.08);
  add(g, 'cone', horse, 0.09, 1.95, 0.88, 0.08, 0.18, 0.08);
  add(g, 'box', M(0x201712), 0, 1.79, 1.08, 0.2, 0.14, 0.08);
  add(g, 'cone', mane, 0, 1.25, -0.85, 0.22, 0.6, 0.16, -0.7, 0, 0);
  // saddle cloth
  add(g, 'box', cloth, 0, 1.42, -0.1, 0.72, 0.12, 0.72);
  add(g, 'box', cloth, 0, 1.12, 0.22, 0.7, 0.55, 0.06);
  add(g, 'box', gold, 0, 1.38, 0.24, 0.74, 0.06, 0.08);

  // Rider
  add(g, 'box', steelD, 0, 1.62, -0.02, 0.5, 0.45, 0.4);
  add(g, 'box', steel, 0, 1.98, -0.02, 0.56, 0.5, 0.42);
  add(g, 'box', cloth, 0, 1.96, 0.22, 0.32, 0.42, 0.04);
  add(g, 'sphere', steel, -0.1, 2.27, 0.02, 0.32, 0.32, 0.32);
  add(g, 'sphere', steel, 0.1, 2.27, 0.02, 0.32, 0.32, 0.32);
  add(g, 'cyl', steel, 0, 2.33, 0.02, 0.42, 0.26, 0.4);
  add(g, 'sphere', steel, 0, 2.4, 0.02, 0.4, 0.24, 0.38);
  add(g, 'cone', cloth, 0, 2.48, 0, 0.15, 0.38, 0.18, 0, 0, -0.22);
  add(g, 'box', M(0x1e1e22), 0, 2.31, 0.2, 0.28, 0.07, 0.08);

  const left = limb(g, -0.4, 1.96, 0, steel, 0.2, 0.55, 0.22);
  const right = limb(g, 0.4, 1.96, 0, steel, 0.2, 0.55, 0.22);
  add(left, 'box', cloth, 0, -0.32, 0, 0.21, 0.2, 0.23);
  add(right, 'box', cloth, 0, -0.32, 0, 0.21, 0.2, 0.23);
  // shield
  const shield = group(left, -0.04, -0.48, 0.1);
  add(shield, 'box', darkTeamMat(team), 0, 0, 0, 0.46, 0.6, 0.07);
  add(shield, 'box', steel, 0, 0, 0.05, 0.5, 0.64, 0.03);
  add(shield, 'box', gold, 0, 0, 0.08, 0.12, 0.34, 0.02);
  // lance
  const lance = group(right, 0, -0.54, 0.05);
  add(lance, 'cyl6', M(C.woodLight), 0, 0.2, 0.5, 0.045, 1.9, 0.045, Math.PI / 2, 0, 0);
  add(lance, 'cone4', steel, 0, 0.2, 1.48, 0.1, 0.34, 0.1, Math.PI / 2, 0, 0);
  add(lance, 'plane', cloth, 0, 0.34, 0.38, 0.4, 0.25, 1);
  anim.arms.push(left, right);
  anim.weapon = lance;
  g.userData.anim = anim;
  return g;
}

export function humanCaster(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const robe = M(0xe8e2d0);
  const gold = M(C.gold, { metalness: 0.5, roughness: 0.38 });
  const skin = M(C.skin);
  const anim = { legs: [], arms: [], height: 2.0, kind: 'caster' };

  add(g, 'frustum', robe, 0, 0.85, 0, 0.92, 1.7, 0.92);
  add(g, 'box', cloth, 0, 1.18, 0, 0.54, 0.5, 0.4);
  add(g, 'box', gold, 0, 0.9, 0, 0.62, 0.1, 0.45);
  add(g, 'sphere', skin, 0, 1.67, 0.02, 0.38, 0.4, 0.36);
  add(g, 'sphere', robe, 0, 1.72, -0.02, 0.46, 0.44, 0.42);
  add(g, 'cone', cloth, 0, 1.9, -0.04, 0.2, 0.34, 0.2, 0.3, 0, 0);
  // halo
  add(g, 'torus', M(0xffd977, { emissive: 0xffb733, emissiveIntensity: 0.8 }), 0, 2.08, 0, 0.36, 0.1, 0.36, Math.PI / 2, 0, 0);

  const left = limb(g, -0.34, 1.35, 0, robe, 0.18, 0.52, 0.2);
  const right = limb(g, 0.34, 1.35, 0, robe, 0.18, 0.52, 0.2);
  add(left, 'sphere', skin, 0, -0.48, 0, 0.14, 0.14, 0.14);
  const staff = group(right, 0, -0.48, 0.05);
  add(staff, 'cyl6', M(C.woodLight), 0, 0.15, 0, 0.05, 1.35, 0.05);
  const orb = add(staff, 'sphere', M(0xffe9a8, { emissive: 0xffc233, emissiveIntensity: 2.2 }), 0, 0.9, 0, 0.24, 0.24, 0.24);
  add(staff, 'torus', gold, 0, 0.9, 0, 0.34, 0.14, 0.34, Math.PI / 2, 0, 0);
  anim.arms.push(left, right);
  anim.weapon = staff;
  anim.glow = orb;
  g.userData.anim = anim;
  return g;
}

import * as THREE from '../vendor/three.module.js';
import { add, group, limb, M, C, teamMat, darkTeamMat } from './materials.js';

export function orcWorker(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const skin = M(C.orcSkin);
  const skinD = M(C.orcDark);
  const leather = M(C.leatherDark);
  const anim = { legs: [], arms: [], height: 2.0, kind: 'worker' };

  anim.legs.push(limb(g, -0.17, 0.75, 0, leather, 0.24, 0.75, 0.25));
  anim.legs.push(limb(g, 0.17, 0.75, 0, leather, 0.24, 0.75, 0.25));
  add(g, 'box', M(C.leather), 0, 0.82, 0, 0.52, 0.14, 0.34);
  add(g, 'sphereLo', skin, 0, 1.15, 0, 0.78, 0.78, 0.54);
  add(g, 'box', cloth, 0, 0.96, 0, 0.56, 0.25, 0.38);
  add(g, 'sphere', skin, 0, 1.54, 0.08, 0.42, 0.44, 0.4);
  add(g, 'box', skinD, 0, 1.42, 0.23, 0.19, 0.12, 0.08);
  // topknot
  add(g, 'sphere', M(0x27201b), 0, 1.75, -0.03, 0.22, 0.16, 0.22);
  add(g, 'cone', M(0x27201b), 0, 1.9, -0.08, 0.1, 0.3, 0.1, -0.3, 0, 0);
  // tusks
  add(g, 'cone', M(0xe8e0c2), -0.13, 1.46, 0.26, 0.045, 0.15, 0.045, 0, 0, 0.35);
  add(g, 'cone', M(0xe8e0c2), 0.13, 1.46, 0.26, 0.045, 0.15, 0.045, 0, 0, -0.35);

  const left = limb(g, -0.42, 1.36, 0, skin, 0.19, 0.62, 0.2);
  const right = limb(g, 0.42, 1.36, 0, skin, 0.19, 0.62, 0.2);
  add(left, 'sphere', skinD, 0, -0.55, 0, 0.2, 0.2, 0.2);
  add(right, 'sphere', skinD, 0, -0.55, 0, 0.2, 0.2, 0.2);
  const tool = group(right, 0, -0.5, 0.05);
  add(tool, 'cyl6', M(C.woodLight), 0, 0.1, 0, 0.06, 0.9, 0.06);
  add(tool, 'box', M(C.iron), 0, 0.54, 0, 0.56, 0.11, 0.12, 0, 0, -0.1);
  add(tool, 'cone', M(C.iron), -0.27, 0.54, 0, 0.14, 0.16, 0.12, 0, 0, Math.PI / 2);
  anim.arms.push(left, right);
  anim.tool = tool;
  g.userData.anim = anim;
  return g;
}

export function orcMelee(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const skin = M(C.orcSkin);
  const skinD = M(C.orcDark);
  const iron = M(C.iron, { metalness: 0.35 });
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 2.3, kind: 'melee' };

  anim.legs.push(limb(g, -0.22, 0.86, 0, M(C.leatherDark), 0.3, 0.86, 0.32));
  anim.legs.push(limb(g, 0.22, 0.86, 0, M(C.leatherDark), 0.3, 0.86, 0.32));
  add(g, 'box', M(C.leather), 0, 0.98, 0, 0.72, 0.24, 0.45);
  add(g, 'sphereLo', skin, 0, 1.38, 0, 1.02, 0.92, 0.7);
  add(g, 'box', cloth, 0, 1.08, 0, 0.7, 0.35, 0.5);
  add(g, 'box', iron, 0, 1.55, 0, 0.7, 0.22, 0.55);
  // shoulder plates and spikes
  add(g, 'sphere', iron, -0.58, 1.72, 0, 0.46, 0.38, 0.46);
  add(g, 'sphere', iron, 0.58, 1.72, 0, 0.46, 0.38, 0.46);
  add(g, 'cone', bone, -0.63, 1.94, 0, 0.11, 0.3, 0.11, 0, 0, -0.2);
  add(g, 'cone', bone, 0.63, 1.94, 0, 0.11, 0.3, 0.11, 0, 0, 0.2);
  add(g, 'sphere', skin, 0, 1.98, 0.08, 0.48, 0.46, 0.44);
  add(g, 'box', skinD, 0, 1.86, 0.28, 0.28, 0.18, 0.1);
  add(g, 'sphere', M(0x2f261d), 0, 2.2, -0.02, 0.26, 0.2, 0.26);
  add(g, 'cone', M(0x2f261d), 0, 2.3, -0.1, 0.13, 0.34, 0.13, -0.35, 0, 0);
  add(g, 'cone', bone, -0.16, 1.88, 0.3, 0.055, 0.2, 0.055, 0, 0, 0.4);
  add(g, 'cone', bone, 0.16, 1.88, 0.3, 0.055, 0.2, 0.055, 0, 0, -0.4);
  // jaw paint
  add(g, 'box', cloth, 0, 1.78, 0.25, 0.24, 0.06, 0.03);

  const left = limb(g, -0.62, 1.62, 0, skin, 0.28, 0.72, 0.3);
  const right = limb(g, 0.62, 1.62, 0, skin, 0.28, 0.72, 0.3);
  add(left, 'sphere', skinD, 0, -0.64, 0, 0.29, 0.28, 0.29);
  add(right, 'sphere', skinD, 0, -0.64, 0, 0.29, 0.28, 0.29);
  // axe
  const axe = group(right, 0, -0.58, 0.08);
  add(axe, 'cyl6', M(C.woodDark), 0, 0.15, 0, 0.075, 1.55, 0.075);
  add(axe, 'box', iron, 0.18, 0.72, 0, 0.7, 0.45, 0.1, 0, 0, 0.25);
  add(axe, 'cone4', iron, -0.12, 0.78, 0, 0.35, 0.5, 0.1, 0, 0, -0.6);
  add(axe, 'box', cloth, 0, 0.2, 0.06, 0.2, 0.25, 0.03);
  anim.arms.push(left, right);
  anim.weapon = axe;
  g.userData.anim = anim;
  return g;
}

export function orcRanged(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const skin = M(C.orcSkin);
  const skinD = M(C.orcDark);
  const leather = M(C.leather);
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 2.1, kind: 'ranged' };

  anim.legs.push(limb(g, -0.17, 0.8, 0, M(C.leatherDark), 0.23, 0.8, 0.26));
  anim.legs.push(limb(g, 0.17, 0.8, 0, M(C.leatherDark), 0.23, 0.8, 0.26));
  add(g, 'sphereLo', skin, 0, 1.3, 0, 0.78, 0.78, 0.56);
  add(g, 'box', leather, 0, 1.02, 0, 0.64, 0.3, 0.45);
  add(g, 'box', cloth, 0, 0.92, 0.02, 0.6, 0.2, 0.36);
  add(g, 'sphere', skin, 0, 1.75, 0.06, 0.46, 0.44, 0.4);
  // tribal mask
  add(g, 'box', bone, 0, 1.78, 0.25, 0.4, 0.32, 0.07);
  add(g, 'box', M(0x1e2422), 0, 1.82, 0.29, 0.09, 0.05, 0.02);
  add(g, 'box', M(0x1e2422), 0.16, 1.82, 0.29, 0.09, 0.05, 0.02);
  add(g, 'cone', bone, 0, 1.65, 0.3, 0.1, 0.2, 0.06, Math.PI, 0, 0);
  // feather crest
  for (let i = 0; i < 3; i++) {
    add(g, 'cone', i === 1 ? cloth : M(0xc9a24a), (i - 1) * 0.12, 2.08 - Math.abs(i - 1) * 0.05, -0.06, 0.06, 0.5, 0.08, -0.25, 0, (i - 1) * 0.35);
  }
  add(g, 'cone', bone, -0.15, 1.68, 0.3, 0.045, 0.14, 0.045, 0, 0, 0.4);
  add(g, 'cone', bone, 0.15, 1.68, 0.3, 0.045, 0.14, 0.045, 0, 0, -0.4);

  const left = limb(g, -0.38, 1.52, 0, skin, 0.18, 0.6, 0.19);
  const right = limb(g, 0.38, 1.52, 0, skin, 0.18, 0.6, 0.19);
  add(left, 'sphere', skinD, 0, -0.52, 0, 0.19, 0.19, 0.19);
  add(right, 'sphere', skinD, 0, -0.52, 0, 0.19, 0.19, 0.19);
  // spear
  const spear = group(right, 0, -0.52, 0.12);
  add(spear, 'cyl6', M(C.woodLight), 0, 0.2, 0, 0.035, 2.35, 0.035, Math.PI / 2, 0, 0);
  add(spear, 'cone4', M(C.steel), 0, 0.2, 1.35, 0.09, 0.36, 0.09, Math.PI / 2, 0, 0);
  add(spear, 'cone', cloth, 0, 0.26, 0.9, 0.1, 0.28, 0.1, Math.PI / 2, 0, 0);
  anim.arms.push(left, right);
  anim.weapon = spear;
  g.userData.anim = anim;
  return g;
}

export function orcHeavy(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const fur = M(0x6b4a2e);
  const furD = M(0x47301f);
  const skin = M(0x7b5a3a);
  const horn = M(C.bone);
  const iron = M(C.iron, { metalness: 0.4 });
  const anim = { legs: [], arms: [], height: 3.0, kind: 'heavy' };

  anim.legs.push(limb(g, -0.32, 1.05, 0, furD, 0.36, 1.0, 0.38));
  anim.legs.push(limb(g, 0.32, 1.05, 0, furD, 0.36, 1.0, 0.38));
  add(g, 'box', M(C.iron), -0.32, 0.08, 0.18, 0.4, 0.16, 0.5);
  add(g, 'box', M(C.iron), 0.32, 0.08, 0.18, 0.4, 0.16, 0.5);
  add(g, 'sphereLo', M(0x5c4128), 0, 1.62, 0, 1.35, 1.15, 0.95);
  add(g, 'box', cloth, 0, 1.25, 0, 1.0, 0.45, 0.9);
  add(g, 'box', fur, 0, 1.75, -0.02, 1.38, 0.4, 1.0);
  // bull head
  add(g, 'sphere', skin, 0, 2.28, 0.34, 0.8, 0.72, 0.92);
  add(g, 'box', M(0x4a3120), 0, 2.12, 0.78, 0.5, 0.32, 0.22);
  add(g, 'box', M(0x241b14), 0, 2.12, 0.9, 0.36, 0.16, 0.06);
  add(g, 'sphere', M(0x171310), -0.22, 2.4, 0.68, 0.13, 0.13, 0.1);
  add(g, 'sphere', M(0x171310), 0.22, 2.4, 0.68, 0.13, 0.13, 0.1);
  // horns
  add(g, 'cone', horn, -0.5, 2.56, 0.3, 0.2, 0.7, 0.2, 0, 0, 1.15);
  add(g, 'cone', horn, 0.5, 2.56, 0.3, 0.2, 0.7, 0.2, 0, 0, -1.15);
  add(g, 'cone', horn, -0.76, 2.71, 0.3, 0.1, 0.3, 0.1, 0, 0, 0.8);
  add(g, 'cone', horn, 0.76, 2.71, 0.3, 0.1, 0.3, 0.1, 0, 0, -0.8);
  // nose ring
  add(g, 'torus', M(C.gold), 0, 2.04, 0.9, 0.2, 0.2, 0.2);
  // war totem on back
  add(g, 'cyl6', M(C.woodDark), 0, 1.8, -0.55, 0.13, 1.8, 0.13);
  add(g, 'box', cloth, 0, 2.35, -0.52, 0.4, 0.45, 0.06);
  add(g, 'cone', M(0xd8c27a), 0, 2.72, -0.54, 0.08, 0.3, 0.08);
  add(g, 'cone', M(0xd8c27a), -0.16, 2.62, -0.54, 0.06, 0.28, 0.06, 0, 0, 0.6);
  add(g, 'cone', M(0xd8c27a), 0.16, 2.62, -0.54, 0.06, 0.28, 0.06, 0, 0, -0.6);

  const left = limb(g, -0.78, 1.85, 0, skin, 0.34, 0.85, 0.35);
  const right = limb(g, 0.78, 1.85, 0, skin, 0.34, 0.85, 0.35);
  add(left, 'sphere', M(0x62462d), 0, -0.78, 0, 0.35, 0.35, 0.35);
  add(right, 'sphere', M(0x62462d), 0, -0.78, 0, 0.35, 0.35, 0.35);
  // massive totem mace
  const mace = group(right, 0, -0.75, 0.05);
  add(mace, 'cyl6', M(C.woodDark), 0, 0.15, 0, 0.08, 1.6, 0.08);
  add(mace, 'box', M(C.stoneDark), 0.12, 0.8, 0, 0.6, 0.7, 0.5);
  add(mace, 'sphere', cloth, 0.12, 1.14, 0, 0.35, 0.22, 0.35);
  add(mace, 'box', M(C.gold), 0.12, 0.8, 0.28, 0.34, 0.34, 0.06);
  anim.arms.push(left, right);
  anim.weapon = mace;
  g.userData.anim = anim;
  return g;
}

export function orcCaster(team) {
  const g = new THREE.Group();
  const cloth = teamMat(team);
  const robe = M(0x5c4a33);
  const fur = M(0x8a6a42);
  const skin = M(C.orcSkin);
  const bone = M(C.bone);
  const anim = { legs: [], arms: [], height: 2.15, kind: 'caster' };

  add(g, 'frustum', robe, 0, 0.9, 0, 1.0, 1.8, 1.0);
  add(g, 'sphereLo', fur, 0, 1.35, 0, 0.95, 0.75, 0.65);
  add(g, 'box', cloth, 0, 1.05, 0, 0.66, 0.22, 0.5);
  add(g, 'sphere', skin, 0, 1.78, 0.06, 0.42, 0.42, 0.4);
  // wolf skull headdress
  add(g, 'box', bone, 0, 1.96, 0.06, 0.5, 0.3, 0.5);
  add(g, 'box', bone, 0, 1.96, 0.32, 0.26, 0.22, 0.3);
  add(g, 'cone', bone, -0.18, 2.15, 0.04, 0.07, 0.28, 0.07, 0, 0, -0.3);
  add(g, 'cone', bone, 0.18, 2.15, 0.04, 0.07, 0.28, 0.07, 0, 0, 0.3);
  add(g, 'sphere', M(0x67ffcf, { emissive: 0x38d99b, emissiveIntensity: 1.2 }), -0.1, 1.99, 0.44, 0.06, 0.06, 0.04);
  add(g, 'sphere', M(0x67ffcf, { emissive: 0x38d99b, emissiveIntensity: 1.2 }), 0.1, 1.99, 0.44, 0.06, 0.06, 0.04);
  add(g, 'cone', bone, -0.16, 1.72, 0.28, 0.045, 0.16, 0.045, 0, 0, 0.4);
  add(g, 'cone', bone, 0.16, 1.72, 0.28, 0.045, 0.16, 0.045, 0, 0, -0.4);

  const left = limb(g, -0.4, 1.48, 0, robe, 0.2, 0.62, 0.22);
  const right = limb(g, 0.4, 1.48, 0, robe, 0.2, 0.62, 0.22);
  add(left, 'sphere', skin, 0, -0.58, 0, 0.17, 0.17, 0.17);
  const staff = group(right, 0, -0.58, 0.08);
  add(staff, 'cyl6', M(C.woodDark), 0, 0.2, 0, 0.055, 1.55, 0.055);
  add(staff, 'box', cloth, 0, 0.7, 0.03, 0.2, 0.3, 0.02);
  const orb = add(staff, 'sphere', M(0xa7fff0, { emissive: 0x35e6c0, emissiveIntensity: 2.4 }), 0, 1.04, 0, 0.26, 0.26, 0.26);
  add(staff, 'torus', M(0xc9a24a), 0, 1.04, 0, 0.38, 0.12, 0.38, Math.PI / 2, 0, 0);
  // floating spirit stones
  add(g, 'dodeca', M(0x7be8c0, { emissive: 0x2aa886, emissiveIntensity: 0.8 }), -0.6, 1.9, -0.2, 0.1, 0.1, 0.1);
  add(g, 'dodeca', M(0x7be8c0, { emissive: 0x2aa886, emissiveIntensity: 0.8 }), 0.62, 2.0, -0.15, 0.08, 0.08, 0.08);
  anim.arms.push(left, right);
  anim.weapon = staff;
  anim.glow = orb;
  g.userData.anim = anim;
  return g;
}

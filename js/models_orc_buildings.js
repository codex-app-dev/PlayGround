import * as THREE from '../vendor/three.module.js';
import { add, group, M, C, teamMat, banner, flagPole } from './materials.js';

const wood = M(C.wood);
const woodD = M(C.woodDark);
const woodL = M(C.woodLight);
const hide = M(C.hide);
const hideD = M(C.hideDark);
const stone = M(C.stone);
const stoneD = M(C.stoneDark);
const bone = M(C.bone);
const iron = M(C.iron, { metalness: 0.35, roughness: 0.5 });
const fireMat = M(0xff9a3c, { emissive: 0xff5a12, emissiveIntensity: 2.5 });

function spikeRing(parent, r, y, n, h, mat = bone) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    add(parent, 'cone', mat, Math.cos(a) * r, y, Math.sin(a) * r, 0.07, h, 0.07, 0, 0, Math.cos(a) * 0.35);
  }
}

export function orcHall(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.45, fire: null };
  add(g, 'cyl', stoneD, 0, 0.09, 0, 1.95, 0.18, 1.95);
  add(g, 'frustum', wood, 0, 0.72, 0, 3.2, 1.1, 3.2);
  add(g, 'cyl', woodD, 0, 0.24, 0, 1.7, 0.2, 1.7);
  // hide roof
  add(g, 'cone', hide, 0, 1.52, 0, 2.55, 0.95, 2.55);
  add(g, 'cone', hideD, 0, 1.85, 0, 1.1, 0.4, 1.1);
  // doorway
  add(g, 'box', M(0x1c140d), 0, 0.5, 0.78, 0.52, 0.7, 0.08);
  add(g, 'box', woodD, 0, 0.92, 0.82, 0.9, 0.12, 0.12);
  add(g, 'cone', bone, -0.32, 0.62, 0.82, 0.08, 0.5, 0.08, 0, 0, 0.25);
  add(g, 'cone', bone, 0.32, 0.62, 0.82, 0.08, 0.5, 0.08, 0, 0, -0.25);
  // support beams
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    add(g, 'cyl6', woodD, Math.cos(a) * 0.92, 0.78, Math.sin(a) * 0.92, 0.075, 1.15, 0.075, 0.18 * Math.cos(a), 0, -0.18 * Math.sin(a));
  }
  spikeRing(g, 0.92, 1.08, 7, 0.34);
  // skull totem over the door
  add(g, 'box', woodD, 0, 1.12, 0.7, 0.1, 0.55, 0.1);
  add(g, 'sphere', bone, 0, 1.38, 0.72, 0.26, 0.24, 0.2);
  add(g, 'box', M(0x18120c), 0, 1.38, 0.84, 0.18, 0.06, 0.03);
  // fire pit
  add(g, 'cyl', stoneD, -0.78, 0.18, 0.78, 0.38, 0.16, 0.38);
  add(g, 'cone', fireMat, -0.78, 0.42, 0.78, 0.22, 0.4, 0.22);
  anim.fire = [];

  anim.flags.push(banner(g, team, -0.88, 0.48, -0.58, 1.55, 0.44, 0.7));
  anim.flags.push(banner(g, team, 0.88, 0.48, -0.58, 1.55, 0.44, 2.1));
  anim.flags.push(flagPole(g, team, 0, 2.25, 0, 0.75));
  g.userData.anim = anim;
  return g;
}

export function orcFarm(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.15 };
  // muddy pen
  add(g, 'cyl', M(0x5c452b), 0, 0.04, 0, 1.8, 0.08, 1.5);
  add(g, 'box', M(0x6b5234), 0, 0.08, 0.1, 1.5, 0.08, 1.2);
  // fence
  for (let i = 0; i < 6; i++) {
    add(g, 'cyl6', woodD, -0.85 + i * 0.34, 0.28, 0.66, 0.045, 0.56, 0.045);
  }
  add(g, 'box', wood, 0, 0.38, 0.66, 1.72, 0.05, 0.05);
  add(g, 'box', wood, 0, 0.2, 0.66, 1.72, 0.05, 0.05);
  // hut
  add(g, 'box', wood, -0.4, 0.42, -0.35, 0.62, 0.5, 0.55);
  add(g, 'cone4', hide, -0.4, 0.78, -0.35, 0.82, 0.38, 0.7, 0, Math.PI / 4, 0);
  add(g, 'box', M(0x1d150d), -0.4, 0.32, -0.06, 0.22, 0.34, 0.04);
  // pig
  const pig = group(g, 0.35, 0.22, 0.08);
  add(pig, 'sphere', M(0xc98b82), 0, 0, 0, 0.5, 0.3, 0.3);
  add(pig, 'sphere', M(0xb57872), 0.25, 0.02, 0, 0.2, 0.18, 0.18);
  add(pig, 'box', M(0x8e5c58), 0.36, 0.02, 0, 0.04, 0.1, 0.1);
  add(pig, 'cone', M(0xb57872), 0.28, 0.14, 0.1, 0.04, 0.08, 0.04, 0, 0, -0.4);
  add(pig, 'cone', M(0xb57872), 0.28, 0.14, -0.1, 0.04, 0.08, 0.04, 0, 0, -0.4);
  for (const x of [-0.15, 0.15]) for (const z of [-0.1, 0.1]) add(pig, 'cyl6', M(0x9b6b60), x, -0.18, z, 0.05, 0.16, 0.05);
  add(pig, 'box', M(0xb57872), -0.26, 0.08, 0, 0.06, 0.12, 0.06);
  // trough and mud
  add(g, 'box', woodD, 0.55, 0.2, 0.42, 0.5, 0.1, 0.16);
  add(g, 'cyl', M(0x4c3a26), 0.55, 0.21, 0.42, 0.4, 0.04, 0.12);
  add(g, 'sphere', M(0x4f3c28), -0.05, 0.09, 0.35, 0.5, 0.06, 0.22);
  anim.flags.push(flagPole(g, team, 0.62, 0.55, -0.55, 0.5));
  g.userData.anim = anim;
  return g;
}

export function orcBarracks(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.55 };
  add(g, 'box', stoneD, 0, 0.08, 0, 1.85, 0.16, 1.3);
  add(g, 'box', wood, 0, 0.42, 0, 1.65, 0.62, 0.95);
  add(g, 'box', woodD, 0, 0.7, 0, 1.7, 0.1, 1.0);
  // gable hide roof
  add(g, 'box', hide, -0.46, 1.02, 0, 0.98, 0.14, 1.18, 0, 0, 0.56);
  add(g, 'box', hide, 0.46, 1.02, 0, 0.98, 0.14, 1.18, 0, 0, -0.56);
  add(g, 'box', hideD, 0, 1.23, 0, 0.14, 0.22, 1.14);
  spikeRing(g, 0.8, 0.48, 6, 0.28, iron);
  for (let i = 0; i < 5; i++) add(g, 'cone', bone, -0.7 + i * 0.35, 1.25, 0.55, 0.06, 0.3, 0.06);
  // door
  add(g, 'box', M(0x1d150d), 0, 0.4, 0.5, 0.4, 0.55, 0.05);
  add(g, 'box', woodL, 0, 0.68, 0.53, 0.55, 0.08, 0.05);
  // war drum
  const drum = group(g, 0.72, 0.35, 0.42);
  add(drum, 'cyl', hide, 0, 0, 0, 0.34, 0.3, 0.34);
  add(drum, 'cyl', woodD, 0, 0.16, 0, 0.36, 0.04, 0.36);
  add(drum, 'cyl', woodD, 0, -0.16, 0, 0.36, 0.04, 0.36);
  for (let i = 0; i < 3; i++) add(drum, 'cyl6', bone, -0.1 + i * 0.1, 0.22, 0, 0.03, 0.3, 0.03);
  // weapon rack
  add(g, 'box', woodD, -0.75, 0.25, 0.45, 0.45, 0.06, 0.12);
  add(g, 'box', iron, -0.82, 0.45, 0.45, 0.3, 0.3, 0.05, 0, 0, 0.2);
  add(g, 'cyl6', woodL, -0.7, 0.45, 0.45, 0.025, 0.55, 0.025, 0, 0, -0.2);
  anim.flags.push(banner(g, team, -0.84, 0.22, -0.45, 1.1, 0.38, 1.2));
  anim.flags.push(flagPole(g, team, 0.8, 1.02, 0.35, 0.45));
  g.userData.anim = anim;
  return g;
}

export function orcTower(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.2, fire: null };
  add(g, 'cyl', stoneD, 0, 0.1, 0, 0.95, 0.2, 0.95);
  // legs and braces
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    add(g, 'cyl6', woodD, Math.cos(a) * 0.42, 0.68, Math.sin(a) * 0.42, 0.08, 1.35, 0.08);
  }
  add(g, 'box', wood, 0, 0.62, 0, 0.94, 0.06, 0.08, 0, 0, 0.6);
  add(g, 'box', wood, 0, 0.62, 0, 0.94, 0.06, 0.08, 0, Math.PI / 2, 0.6);
  add(g, 'cyl', wood, 0, 1.35, 0, 1.25, 0.14, 1.25);
  add(g, 'cyl6', woodD, 0, 1.65, 0, 0.98, 0.04, 0.98);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    add(g, 'cyl6', woodD, Math.cos(a) * 0.38, 1.52, Math.sin(a) * 0.38, 0.04, 0.35, 0.04);
  }
  add(g, 'cone', hide, 0, 1.92, 0, 1.2, 0.5, 1.2);
  add(g, 'cone', hideD, 0, 2.1, 0, 0.4, 0.2, 0.4);
  spikeRing(g, 0.52, 1.55, 6, 0.26);
  // brazier
  add(g, 'cyl', iron, 0.38, 1.48, 0.38, 0.16, 0.12, 0.16);
  add(g, 'cone', fireMat, 0.38, 1.64, 0.38, 0.12, 0.24, 0.12);
  add(g, 'sphere', bone, 0, 1.38, 0.58, 0.18, 0.16, 0.12);
  anim.flags.push(banner(g, team, -0.62, 0.3, 0.42, 1.3, 0.34, 1.6));
  anim.flags.push(flagPole(g, team, 0.5, 1.4, -0.35, 0.55));
  g.userData.anim = anim;
  return g;
}

export function orcSpecial(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.7, fire: [] };
  add(g, 'cyl', stoneD, 0, 0.12, 0, 1.65, 0.24, 1.65);
  add(g, 'cyl', stone, 0, 0.3, 0, 1.25, 0.22, 1.25);
  add(g, 'box', woodD, 0, 0.42, 0, 1.1, 0.2, 1.1);
  // giant totem
  add(g, 'cyl6', wood, 0, 1.35, 0, 0.28, 2.2, 0.28);
  // carved faces
  for (let i = 0; i < 3; i++) {
    const y = 0.8 + i * 0.55;
    add(g, 'box', woodL, 0, y, 0.16, 0.42, 0.4, 0.18);
    add(g, 'box', M(0x1a140d), -0.09, y + 0.05, 0.26, 0.08, 0.05, 0.03);
    add(g, 'box', M(0x1a140d), 0.09, y + 0.05, 0.26, 0.08, 0.05, 0.03);
    add(g, 'box', M(0x6b2d22), 0, y - 0.09, 0.26, 0.18, 0.05, 0.03);
    add(g, 'cone', bone, -0.24, y + 0.02, 0.18, 0.05, 0.22, 0.05, 0, 0, 0.9);
    add(g, 'cone', bone, 0.24, y + 0.02, 0.18, 0.05, 0.22, 0.05, 0, 0, -0.9);
  }
  add(g, 'box', woodL, 0, 2.5, 0, 0.7, 0.18, 0.3);
  add(g, 'cone', bone, -0.45, 2.55, 0, 0.09, 0.55, 0.09, 0, 0, 0.7);
  add(g, 'cone', bone, 0.45, 2.55, 0, 0.09, 0.55, 0.09, 0, 0, -0.7);
  add(g, 'cone', teamMat(team), 0, 2.75, 0, 0.12, 0.4, 0.12);
  // side totems
  for (const x of [-0.72, 0.72]) {
    add(g, 'cyl6', woodD, x, 0.7, -0.3, 0.1, 1.1, 0.1);
    add(g, 'sphere', bone, x, 1.3, -0.3, 0.18, 0.2, 0.16);
    add(g, 'box', M(0x1a140d), x, 1.32, -0.2, 0.12, 0.05, 0.03);
  }
  // brazier with fire
  add(g, 'cyl', stone, 0, 0.6, 0.72, 0.3, 0.45, 0.3);
  add(g, 'cyl', iron, 0, 0.86, 0.72, 0.26, 0.08, 0.26);
  add(g, 'cone', fireMat, 0, 1.03, 0.72, 0.2, 0.3, 0.2);
  add(g, 'sphere', M(0xffd54a, { emissive: 0xff8a00, emissiveIntensity: 2 }), 0, 0.97, 0.72, 0.18, 0.18, 0.18);
  anim.flags.push(banner(g, team, -0.95, 0.35, 0.45, 1.5, 0.42, 0.5));
  anim.flags.push(banner(g, team, 0.95, 0.35, 0.45, 1.5, 0.42, 2.8));
  anim.flags.push(flagPole(g, team, 0.55, 1.75, -0.35, 0.6));
  g.userData.anim = anim;
  return g;
}

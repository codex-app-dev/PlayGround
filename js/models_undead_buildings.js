import * as THREE from '../vendor/three.module.js';
import { add, group, M, C, teamMat, banner, flagPole } from './materials.js';

const darkStone = M(0x4d4858);
const darkerStone = M(0x2f2b39);
const stone = M(0x6a6475);
const bone = M(C.bone);
const boneD = M(C.boneDark);
const purple = M(0x4a3a63);
const green = M(0x53ffa5, { emissive: 0x2be08a, emissiveIntensity: 2.1 });
const greenDim = M(0x3ac984, { emissive: 0x1d9b63, emissiveIntensity: 1 });
const ghost = M(0x7dffc0, { emissive: 0x35e08f, emissiveIntensity: 0.9, transparent: true, opacity: 0.25, depthWrite: false });

export function undeadHall(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.5, glow: [] };
  add(g, 'box', darkerStone, 0, 0.16, 0, 1.9, 0.32, 1.7);
  add(g, 'box', darkStone, 0, 0.5, 0, 1.55, 0.45, 1.35);
  add(g, 'box', stone, 0, 0.85, 0, 1.15, 0.38, 1.0);
  add(g, 'box', purple, 0, 1.08, 0, 0.85, 0.15, 0.76);
  // central spire
  add(g, 'cyl6', darkStone, 0, 1.55, -0.05, 0.46, 1.1, 0.46);
  add(g, 'cone', M(0x352d45), 0, 2.23, -0.05, 0.56, 0.55, 0.56);
  add(g, 'sphere', bone, 0, 1.56, 0.22, 0.34, 0.34, 0.28);
  add(g, 'box', M(0x111013), 0, 1.57, 0.36, 0.22, 0.12, 0.04);
  add(g, 'sphere', green, -0.07, 1.59, 0.4, 0.05, 0.05, 0.03);
  add(g, 'sphere', green, 0.07, 1.59, 0.4, 0.05, 0.05, 0.03);
  // side spires
  for (const x of [-0.62, 0.62]) {
    add(g, 'box', darkStone, x, 1.02, -0.25, 0.24, 1.1, 0.24);
    add(g, 'cone', M(0x3a3149), x, 1.67, -0.25, 0.32, 0.42, 0.32);
    add(g, 'cone', green, x, 1.9, -0.25, 0.07, 0.2, 0.07);
  }
  // entrance
  add(g, 'box', M(0x0f0d12), 0, 0.48, 0.69, 0.42, 0.68, 0.08);
  add(g, 'cone', bone, -0.33, 0.82, 0.72, 0.08, 0.28, 0.08, 0, 0, 0.2);
  add(g, 'cone', bone, 0.33, 0.82, 0.72, 0.08, 0.28, 0.08, 0, 0, -0.2);
  // green crystals
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    add(g, 'cone', i % 2 ? green : greenDim, Math.cos(a) * 0.78, 0.55, Math.sin(a) * 0.62, 0.1, 0.44, 0.1, 0, 0, Math.cos(a) * 0.3);
  }
  add(g, 'cyl', ghost, 0, 1.3, 0.1, 0.55, 1.2, 0.55, 0, 0, 0);
  // floating rock
  add(g, 'dodeca', darkStone, 0.7, 1.85, 0.4, 0.2, 0.16, 0.18);
  anim.flags.push(banner(g, team, -0.88, 0.35, 0.5, 1.25, 0.35, 0.3));
  anim.flags.push(banner(g, team, 0.88, 0.35, 0.5, 1.25, 0.35, 2.0));
  anim.flags.push(flagPole(g, team, 0.35, 1.9, -0.55, 0.55));
  g.userData.anim = anim;
  return g;
}

export function undeadFarm(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.2, glow: [] };
  add(g, 'box', M(0x3d3a33), 0, 0.06, 0, 1.8, 0.12, 1.5);
  // crypt
  add(g, 'box', darkStone, -0.38, 0.45, -0.35, 0.58, 0.62, 0.5);
  add(g, 'cone4', M(0x3a3345), -0.38, 0.83, -0.35, 0.76, 0.36, 0.66, 0, Math.PI / 4, 0);
  add(g, 'box', M(0x111014), -0.38, 0.35, -0.07, 0.24, 0.42, 0.04);
  // gravestones
  for (let i = 0; i < 5; i++) {
    const x = 0.25 + (i % 3) * 0.3;
    const z = 0.15 + Math.floor(i / 3) * 0.33;
    add(g, 'box', M(0x777165), x, 0.25, z, 0.18, 0.36, 0.08, 0, i * 0.2, (i % 2 ? 0.06 : -0.05));
    add(g, 'sphere', M(0x777165), x, 0.42, z, 0.18, 0.14, 0.08);
  }
  // dead tree
  add(g, 'cyl6', M(0x3f352b), 0.7, 0.5, -0.45, 0.07, 1.0, 0.07);
  add(g, 'cyl6', M(0x3f352b), 0.58, 0.85, -0.45, 0.04, 0.45, 0.04, 0, 0, 0.7);
  add(g, 'cyl6', M(0x3f352b), 0.82, 0.78, -0.45, 0.04, 0.4, 0.04, 0, 0, -0.6);
  // fence
  for (let i = 0; i < 5; i++) add(g, 'cyl6', M(0x3c342b), -0.85 + i * 0.42, 0.2, 0.67, 0.035, 0.4, 0.035);
  add(g, 'box', M(0x3c342b), 0, 0.26, 0.67, 1.72, 0.035, 0.035);
  add(g, 'cyl', greenDim, 0.35, 0.1, 0.45, 0.3, 0.05, 0.2);
  add(g, 'sphere', M(0x63ffb2, { emissive: 0x2be08a, emissiveIntensity: 1.4, transparent: true, opacity: 0.35 }), -0.35, 0.3, 0.3, 0.3, 0.3, 0.3);
  anim.flags.push(flagPole(g, team, -0.72, 0.7, 0.55, 0.45));
  g.userData.anim = anim;
  return g;
}

export function undeadBarracks(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.65, glow: [] };
  add(g, 'box', darkerStone, 0, 0.1, 0, 1.85, 0.2, 1.3);
  add(g, 'box', darkStone, 0, 0.48, 0, 1.55, 0.55, 0.95);
  add(g, 'box', stone, 0, 0.78, 0, 1.62, 0.12, 1.0);
  // roof
  add(g, 'box', M(0x3b324a), -0.44, 1.0, 0, 0.98, 0.14, 1.2, 0, 0, 0.5);
  add(g, 'box', M(0x3b324a), 0.44, 1.0, 0, 0.98, 0.14, 1.2, 0, 0, -0.5);
  add(g, 'box', purple, 0, 1.2, 0, 0.12, 0.2, 1.15);
  // bone arches
  for (const x of [-0.55, 0.55]) {
    add(g, 'cyl6', boneD, x, 0.55, 0.55, 0.055, 0.7, 0.055);
    add(g, 'sphere', bone, x, 0.92, 0.55, 0.1, 0.1, 0.1);
  }
  add(g, 'box', boneD, 0, 0.95, 0.55, 1.2, 0.06, 0.06);
  add(g, 'box', M(0x0d0c10), 0, 0.44, 0.51, 0.48, 0.6, 0.05);
  add(g, 'cone', bone, -0.32, 0.85, 0.56, 0.06, 0.22, 0.06, 0, 0, 0.25);
  add(g, 'cone', bone, 0.32, 0.85, 0.56, 0.06, 0.22, 0.06, 0, 0, -0.25);
  // skull pile and green fire
  add(g, 'sphere', bone, 0.72, 0.18, 0.35, 0.22, 0.2, 0.2);
  add(g, 'sphere', bone, 0.55, 0.14, 0.47, 0.18, 0.16, 0.16);
  add(g, 'box', M(0x111014), 0.72, 0.2, 0.45, 0.12, 0.05, 0.03);
  add(g, 'cone', green, 0.72, 0.42, 0.35, 0.13, 0.35, 0.13);
  add(g, 'sphere', M(0x7dffc0, { emissive: 0x35e08f, emissiveIntensity: 1.3, transparent: true, opacity: 0.25 }), -0.62, 1.2, 0.2, 0.5, 0.5, 0.5);
  anim.flags.push(banner(g, team, -0.84, 0.22, -0.42, 1.2, 0.36, 0.9));
  anim.flags.push(flagPole(g, team, 0.75, 1.0, 0.3, 0.48));
  g.userData.anim = anim;
  return g;
}

export function undeadTower(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.35, glow: [] };
  add(g, 'cyl', darkerStone, 0, 0.1, 0, 0.9, 0.2, 0.9);
  add(g, 'cyl6', darkStone, 0, 0.82, 0, 0.6, 1.4, 0.6);
  add(g, 'cyl6', stone, 0, 1.55, 0, 0.72, 0.12, 0.72);
  // bone ribs
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    add(g, 'cyl6', boneD, Math.cos(a) * 0.55, 0.85, Math.sin(a) * 0.55, 0.05, 1.3, 0.05, 0.05, 0, 0.05);
  }
  // skull top
  add(g, 'sphere', bone, 0, 1.76, 0.05, 0.46, 0.44, 0.4);
  add(g, 'box', M(0x131117), 0, 1.72, 0.25, 0.3, 0.14, 0.04);
  add(g, 'sphere', green, -0.11, 1.74, 0.29, 0.06, 0.05, 0.03);
  add(g, 'sphere', green, 0.11, 1.74, 0.29, 0.06, 0.05, 0.03);
  add(g, 'cone', bone, -0.22, 2.0, 0.02, 0.07, 0.34, 0.07, 0, 0, 0.3);
  add(g, 'cone', bone, 0.22, 2.0, 0.02, 0.07, 0.34, 0.07, 0, 0, -0.3);
  add(g, 'cone', green, 0, 2.15, 0.05, 0.16, 0.38, 0.16);
  // entrance
  add(g, 'box', M(0x0f0e12), 0, 0.45, 0.55, 0.28, 0.55, 0.06);
  add(g, 'cyl', ghost, 0, 1.3, 0.05, 0.45, 1.1, 0.45);
  add(g, 'dodeca', darkStone, 0.5, 1.35, -0.25, 0.16, 0.14, 0.16);
  anim.flags.push(banner(g, team, -0.6, 0.3, 0.38, 1.25, 0.3, 1.7));
  anim.flags.push(flagPole(g, team, 0, 1.95, -0.15, 0.45));
  g.userData.anim = anim;
  return g;
}

export function undeadSpecial(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.5, glow: [] };
  // ziggurat
  add(g, 'box', darkerStone, 0, 0.14, 0, 1.9, 0.28, 1.65);
  add(g, 'box', darkStone, 0, 0.42, 0, 1.55, 0.32, 1.35);
  add(g, 'box', stone, 0, 0.7, 0, 1.2, 0.28, 1.05);
  add(g, 'box', purple, 0, 0.9, 0, 0.95, 0.14, 0.85);
  // altar
  add(g, 'box', stone, 0, 1.05, 0, 0.8, 0.2, 0.65);
  add(g, 'box', boneD, 0, 1.18, 0, 0.55, 0.08, 0.45);
  add(g, 'sphere', bone, 0, 1.38, 0.08, 0.38, 0.4, 0.32);
  add(g, 'box', M(0x0e0d11), 0, 1.38, 0.25, 0.26, 0.12, 0.04);
  add(g, 'sphere', green, -0.09, 1.4, 0.29, 0.055, 0.055, 0.03);
  add(g, 'sphere', green, 0.09, 1.4, 0.29, 0.055, 0.055, 0.03);
  add(g, 'cone', bone, -0.28, 1.6, 0.02, 0.07, 0.4, 0.07, 0, 0, 0.4);
  add(g, 'cone', bone, 0.28, 1.6, 0.02, 0.07, 0.4, 0.07, 0, 0, -0.4);
  // vertical necrotic beam
  add(g, 'cyl', M(0x5effa8, { emissive: 0x2be08a, emissiveIntensity: 1.6, transparent: true, opacity: 0.32, depthWrite: false }), 0, 1.85, -0.05, 0.24, 1.7, 0.24);
  add(g, 'torus', green, 0, 1.55, -0.05, 0.4, 0.12, 0.4, Math.PI / 2, 0, 0);
  add(g, 'torus', green, 0, 1.85, -0.05, 0.32, 0.1, 0.32, Math.PI / 2, 0.4, 0);
  // floating crystals
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    add(g, 'dodeca', greenDim, Math.cos(a) * 0.72, 1.2 + (i % 2) * 0.3, Math.sin(a) * 0.55, 0.16, 0.22, 0.16);
  }
  // obelisks
  for (const x of [-0.75, 0.75]) {
    add(g, 'box', darkStone, x, 0.95, -0.45, 0.18, 1.4, 0.18);
    add(g, 'cone', purple, x, 1.72, -0.45, 0.18, 0.3, 0.18);
    add(g, 'sphere', green, x, 1.5, -0.35, 0.07, 0.07, 0.05);
  }
  anim.flags.push(banner(g, team, -0.92, 0.3, 0.45, 1.5, 0.4, 0.4));
  anim.flags.push(banner(g, team, 0.92, 0.3, 0.45, 1.5, 0.4, 2.5));
  g.userData.anim = anim;
  return g;
}
